//! Export resolusi tinggi dari piksel RGBA mentah kanvas:
//! JPG (4:4:4 + DPI), TIFF (LZW + DPI), dan PDF multi-halaman (JPEG tertanam, TrimBox untuk bleed).
use jpeg_encoder::{ColorType, Density, Encoder, SamplingFactor};
use percent_encoding::percent_decode_str;
use std::fs::File;
use std::io::{BufWriter, Write};
use std::path::Path;
use std::sync::Mutex;
use tauri::ipc::{InvokeBody, Request};

fn header(req: &Request<'_>, k: &str) -> Result<String, String> {
    req.headers()
        .get(k)
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string())
        .ok_or_else(|| format!("header {k} tidak ada"))
}

fn num<T: std::str::FromStr>(req: &Request<'_>, k: &str) -> Result<T, String> {
    header(req, k)?.parse().map_err(|_| format!("{k} tidak valid"))
}

struct Frame<'a> {
    w: u16,
    h: u16,
    dpi: u16,
    quality: u8,
    data: &'a [u8],
}

fn frame<'a>(req: &'a Request<'_>) -> Result<Frame<'a>, String> {
    let w: u16 = num(req, "x-width")?;
    let h: u16 = num(req, "x-height")?;
    let InvokeBody::Raw(data) = req.body() else {
        return Err("data gambar harus raw".into());
    };
    if data.len() != w as usize * h as usize * 4 {
        return Err(format!("ukuran data salah: {} vs {}x{}", data.len(), w, h));
    }
    Ok(Frame { w, h, dpi: num(req, "x-dpi")?, quality: num::<u8>(req, "x-quality").unwrap_or(98).clamp(1, 100), data })
}

fn out_path(req: &Request<'_>) -> Result<String, String> {
    let path = percent_decode_str(&header(req, "x-path")?).decode_utf8_lossy().to_string();
    if let Some(parent) = Path::new(&path).parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    Ok(path)
}

fn encode_jpeg<W: Write>(w: W, f: &Frame) -> Result<(), String> {
    let mut enc = Encoder::new(w, f.quality);
    // 4:4:4 = tanpa chroma subsampling, warna & tepi teks tetap tajam saat dicetak
    enc.set_sampling_factor(SamplingFactor::F_1_1);
    enc.set_density(Density::Inch { x: f.dpi, y: f.dpi });
    enc.encode(f.data, f.w, f.h, ColorType::Rgba).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn save_jpeg(request: Request<'_>) -> Result<(), String> {
    let f = frame(&request)?;
    let path = out_path(&request)?;
    let file = File::create(&path).map_err(|e| e.to_string())?;
    encode_jpeg(BufWriter::new(file), &f)
}

#[tauri::command]
pub async fn save_tiff(request: Request<'_>) -> Result<(), String> {
    use tiff::encoder::{colortype::RGB8, compression::Lzw, Rational, TiffEncoder};
    use tiff::tags::ResolutionUnit;
    let f = frame(&request)?;
    let path = out_path(&request)?;
    let rgb: Vec<u8> = f.data.chunks_exact(4).flat_map(|p| [p[0], p[1], p[2]]).collect();
    let file = File::create(&path).map_err(|e| e.to_string())?;
    let mut enc = TiffEncoder::new(BufWriter::new(file)).map_err(|e| e.to_string())?;
    let mut img = enc
        .new_image_with_compression::<RGB8, _>(f.w as u32, f.h as u32, Lzw)
        .map_err(|e| e.to_string())?;
    img.resolution(ResolutionUnit::Inch, Rational { n: f.dpi as u32, d: 1 });
    img.write_data(&rgb).map_err(|e| e.to_string())
}

/* ---------------- PDF ---------------- */

struct PdfPage {
    jpeg: Vec<u8>,
    w: u32,
    h: u32,
    wpt: f64,
    hpt: f64,
    bleed_pt: f64,
}

static PDF: Mutex<Option<(String, Vec<PdfPage>)>> = Mutex::new(None);

#[tauri::command]
pub fn pdf_begin(path: String) -> Result<(), String> {
    *PDF.lock().unwrap() = Some((path, Vec::new()));
    Ok(())
}

#[tauri::command]
pub async fn pdf_add(request: Request<'_>) -> Result<(), String> {
    let f = frame(&request)?;
    let bleed_px: f64 = num(&request, "x-bleed").unwrap_or(0.0);
    let mut jpeg = Vec::new();
    encode_jpeg(&mut jpeg, &f)?;
    let pt = |px: f64| px / f.dpi as f64 * 72.0;
    let page = PdfPage { jpeg, w: f.w as u32, h: f.h as u32, wpt: pt(f.w as f64), hpt: pt(f.h as f64), bleed_pt: pt(bleed_px) };
    PDF.lock().unwrap().as_mut().ok_or("pdf_begin belum dipanggil")?.1.push(page);
    Ok(())
}

#[tauri::command]
pub async fn pdf_finish() -> Result<String, String> {
    let (path, pages) = PDF.lock().unwrap().take().ok_or("tidak ada PDF aktif")?;
    if pages.is_empty() {
        return Err("PDF kosong".into());
    }
    let mut out: Vec<u8> = Vec::new();
    let n_obj = 2 + pages.len() * 3;
    let mut offs = vec![0usize; n_obj + 1];
    out.extend_from_slice(b"%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");

    offs[1] = out.len();
    out.extend_from_slice(b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
    offs[2] = out.len();
    let kids: Vec<String> = (0..pages.len()).map(|i| format!("{} 0 R", 3 + i * 3)).collect();
    out.extend_from_slice(format!("2 0 obj\n<< /Type /Pages /Kids [{}] /Count {} >>\nendobj\n", kids.join(" "), pages.len()).as_bytes());

    for (i, p) in pages.iter().enumerate() {
        let (pid, cid, iid) = (3 + i * 3, 4 + i * 3, 5 + i * 3);
        let b = p.bleed_pt;
        let trim = if b > 0.0 {
            format!(" /TrimBox [{:.3} {:.3} {:.3} {:.3}] /BleedBox [0 0 {:.3} {:.3}]", b, b, p.wpt - b, p.hpt - b, p.wpt, p.hpt)
        } else {
            String::new()
        };
        offs[pid] = out.len();
        out.extend_from_slice(
            format!(
                "{pid} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {:.3} {:.3}]{trim} /Resources << /XObject << /Im0 {iid} 0 R >> >> /Contents {cid} 0 R >>\nendobj\n",
                p.wpt, p.hpt
            )
            .as_bytes(),
        );
        let content = format!("q {:.3} 0 0 {:.3} 0 0 cm /Im0 Do Q", p.wpt, p.hpt);
        offs[cid] = out.len();
        out.extend_from_slice(format!("{cid} 0 obj\n<< /Length {} >>\nstream\n{content}\nendstream\nendobj\n", content.len()).as_bytes());
        offs[iid] = out.len();
        out.extend_from_slice(
            format!(
                "{iid} 0 obj\n<< /Type /XObject /Subtype /Image /Width {} /Height {} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length {} >>\nstream\n",
                p.w,
                p.h,
                p.jpeg.len()
            )
            .as_bytes(),
        );
        out.extend_from_slice(&p.jpeg);
        out.extend_from_slice(b"\nendstream\nendobj\n");
    }
    let xref = out.len();
    out.extend_from_slice(format!("xref\n0 {}\n0000000000 65535 f \n", n_obj + 1).as_bytes());
    for o in &offs[1..] {
        out.extend_from_slice(format!("{:010} 00000 n \n", o).as_bytes());
    }
    out.extend_from_slice(format!("trailer\n<< /Size {} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n", n_obj + 1).as_bytes());
    if let Some(parent) = Path::new(&path).parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::write(&path, out).map_err(|e| e.to_string())?;
    Ok(path)
}

#[tauri::command]
pub fn write_text(path: String, content: String) -> Result<(), String> {
    std::fs::write(path, content).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn read_text(path: String) -> Result<String, String> {
    std::fs::read_to_string(path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn open_folder(path: String) -> Result<(), String> {
    std::process::Command::new("explorer")
        .arg(path)
        .spawn()
        .map(|_| ())
        .map_err(|e| e.to_string())
}
