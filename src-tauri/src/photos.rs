//! Import foto: dimensi (sudah dikoreksi orientasi EXIF), waktu jepret, thumbnail cache.
use image::{DynamicImage, GenericImageView, ImageDecoder, ImageReader};
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::hash_map::DefaultHasher;
use std::fs::File;
use std::hash::{Hash, Hasher};
use std::io::{BufReader, BufWriter};
use std::cell::RefCell;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::OnceLock;
use std::time::UNIX_EPOCH;
use tauri::{AppHandle, Emitter, Manager};

const EXTS: &[&str] = &["jpg", "jpeg", "png", "webp"];
const THUMB: u32 = 1600;
/// naikkan bila algoritma deteksi berubah -> cache lama dihitung ulang
const FACE_V: u8 = 1;
const FACE_MODEL: &[u8] = include_bytes!("../models/seeta_fd_frontal_v1.0.bin");

#[derive(Serialize, Deserialize, Clone, Copy)]
pub struct Rect {
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PhotoInfo {
    pub id: String,
    pub path: String,
    pub name: String,
    pub width: u32,
    pub height: u32,
    pub thumb: String,
    pub taken: i64,
    /// kotak wajah, dinormalisasi 0..1 terhadap foto (sudah terkoreksi orientasi)
    #[serde(default)]
    pub faces: Vec<Rect>,
    #[serde(default)]
    pub face_v: u8,
}

static MODEL: OnceLock<Option<rustface::Model>> = OnceLock::new();
thread_local! {
    static DETECTOR: RefCell<Option<Box<dyn rustface::Detector>>> = const { RefCell::new(None) };
}

/// Deteksi wajah (SeetaFace, pure Rust) pada thumbnail, diperkecil ke maks 800px.
fn detect_faces(img: &image::RgbImage) -> Vec<Rect> {
    let mut gray = image::imageops::grayscale(img);
    let (w0, h0) = gray.dimensions();
    let k = 800.0 / w0.max(h0) as f64;
    if k < 1.0 {
        gray = image::imageops::resize(&gray, (w0 as f64 * k) as u32, (h0 as f64 * k) as u32, image::imageops::FilterType::Triangle);
    }
    let (w, h) = gray.dimensions();
    if w < 40 || h < 40 {
        return vec![];
    }
    DETECTOR.with(|cell| {
        let mut d = cell.borrow_mut();
        if d.is_none() {
            let Some(model) = MODEL.get_or_init(|| rustface::read_model(FACE_MODEL).ok()).clone() else { return vec![] };
            let mut det = rustface::create_detector_with_model(model);
            det.set_min_face_size(24);
            det.set_score_thresh(2.0);
            det.set_pyramid_scale_factor(0.8);
            det.set_slide_window_step(4, 4);
            *d = Some(det);
        }
        let det = d.as_mut().unwrap();
        let data = rustface::ImageData::new(gray.as_raw(), w, h);
        det.detect(&data)
            .into_iter()
            .filter(|f| f.score() >= 2.5)
            .map(|f| {
                let b = f.bbox();
                let x = (b.x().max(0) as f64 / w as f64).min(1.0);
                let y = (b.y().max(0) as f64 / h as f64).min(1.0);
                Rect { x, y, w: (b.width() as f64 / w as f64).min(1.0 - x), h: (b.height() as f64 / h as f64).min(1.0 - y) }
            })
            .collect()
    })
}

fn is_img(p: &Path) -> bool {
    p.extension()
        .and_then(|e| e.to_str())
        .map(|e| EXTS.contains(&e.to_ascii_lowercase().as_str()))
        .unwrap_or(false)
}

fn hash_str(s: &str) -> u64 {
    let mut h = DefaultHasher::new();
    s.hash(&mut h);
    h.finish()
}

fn walk(dir: &Path, out: &mut Vec<String>) {
    let Ok(rd) = std::fs::read_dir(dir) else { return };
    for e in rd.flatten() {
        let p = e.path();
        if p.is_dir() {
            walk(&p, out);
        } else if is_img(&p) {
            out.push(p.to_string_lossy().to_string());
        }
    }
}

#[tauri::command]
pub fn scan_folder(dir: String) -> Vec<String> {
    let mut v = Vec::new();
    walk(Path::new(&dir), &mut v);
    v.sort();
    v
}

fn exif_taken(path: &str) -> Option<i64> {
    let f = File::open(path).ok()?;
    let ex = exif::Reader::new()
        .read_from_container(&mut BufReader::new(f))
        .ok()?;
    let field = ex
        .get_field(exif::Tag::DateTimeOriginal, exif::In::PRIMARY)
        .or_else(|| ex.get_field(exif::Tag::DateTime, exif::In::PRIMARY))?;
    if let exif::Value::Ascii(ref v) = field.value {
        let s = std::str::from_utf8(v.first()?).ok()?;
        let dt = chrono::NaiveDateTime::parse_from_str(s.trim(), "%Y:%m:%d %H:%M:%S").ok()?;
        Some(dt.and_utc().timestamp_millis())
    } else {
        None
    }
}

/// Satu file = satu ID walau path ditulis dengan `/` atau `\` (ID lama dari dialog Windows tetap sama).
fn normalize(path: &str) -> String {
    if cfg!(windows) {
        path.replace('/', "\\")
    } else {
        path.to_string()
    }
}

fn process(path: &str, cache: &Path) -> Result<PhotoInfo, String> {
    let norm = normalize(path);
    let path = norm.as_str();

    let meta = std::fs::metadata(path).map_err(|e| e.to_string())?;
    let mtime = meta
        .modified()
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0);
    let id = format!("{:016x}", hash_str(path));
    let key = format!("{:016x}", hash_str(&format!("{path}|{}|{mtime}", meta.len())));
    let thumb = cache.join(format!("{key}.jpg"));
    let metaf = cache.join(format!("{key}.json"));
    if thumb.exists() {
        if let Some(mut info) = std::fs::read_to_string(&metaf)
            .ok()
            .and_then(|s| serde_json::from_str::<PhotoInfo>(&s).ok())
        {
            if info.face_v != FACE_V {
                if let Ok(t) = image::open(&thumb) {
                    info.faces = detect_faces(&t.to_rgb8());
                    info.face_v = FACE_V;
                    let _ = std::fs::write(&metaf, serde_json::to_string(&info).unwrap_or_default());
                }
            }
            return Ok(info);
        }
    }

    let reader = ImageReader::open(path)
        .map_err(|e| e.to_string())?
        .with_guessed_format()
        .map_err(|e| e.to_string())?;
    let mut dec = reader.into_decoder().map_err(|e| e.to_string())?;
    let orient = dec
        .orientation()
        .unwrap_or(image::metadata::Orientation::NoTransforms);
    let mut img = DynamicImage::from_decoder(dec).map_err(|e| e.to_string())?;
    img.apply_orientation(orient);
    let (width, height) = img.dimensions();
    let t = img.thumbnail(THUMB, THUMB).to_rgb8();
    drop(img);
    let f = File::create(&thumb).map_err(|e| e.to_string())?;
    image::codecs::jpeg::JpegEncoder::new_with_quality(BufWriter::new(f), 86)
        .encode_image(&t)
        .map_err(|e| e.to_string())?;

    let info = PhotoInfo {
        id,
        path: path.to_string(),
        name: Path::new(path)
            .file_name()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_default(),
        width,
        height,
        thumb: thumb.to_string_lossy().to_string(),
        taken: exif_taken(path).unwrap_or(mtime),
        faces: detect_faces(&t),
        face_v: FACE_V,
    };
    let _ = std::fs::write(&metaf, serde_json::to_string(&info).unwrap_or_default());
    Ok(info)
}

#[tauri::command]
pub async fn import_photos(app: AppHandle, paths: Vec<String>) -> Result<Vec<PhotoInfo>, String> {
    let cache: PathBuf = app
        .path()
        .app_cache_dir()
        .map_err(|e| e.to_string())?
        .join("thumbs");
    std::fs::create_dir_all(&cache).map_err(|e| e.to_string())?;
    let total = paths.len();
    tauri::async_runtime::spawn_blocking(move || {
        let done = AtomicUsize::new(0);
        // batasi thread: tiap foto 24MP butuh ~70MB RAM saat decode
        let threads = std::thread::available_parallelism()
            .map(|n| n.get())
            .unwrap_or(4)
            .clamp(2, 6);
        let pool = rayon::ThreadPoolBuilder::new()
            .num_threads(threads)
            .build()
            .map_err(|e| e.to_string())?;
        let res: Vec<Option<PhotoInfo>> = pool.install(|| {
            paths
                .par_iter()
                .map(|p| {
                    let r = process(p, &cache).ok();
                    let d = done.fetch_add(1, Ordering::SeqCst) + 1;
                    let _ = app.emit("import-progress", (d, total));
                    r
                })
                .collect()
        });
        Ok(res.into_iter().flatten().collect())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    #[test]
    fn faces_found() {
        let p = concat!(env!("CARGO_MANIFEST_DIR"), "/../testdata/scientists.jpg");
        let img = image::open(p).expect("gambar uji").thumbnail(1600, 1600).to_rgb8();
        let t = std::time::Instant::now();
        let f = super::detect_faces(&img);
        println!("{} wajah dalam {:?}", f.len(), t.elapsed());
        assert!(f.len() >= 5);
    }
}
