//! Daftar font terpasang (Windows & macOS: sistem + per-user) langsung dari file font,
//! digabung font yang hanya terdaftar lewat GDI di Windows (Adobe Fonts / Creative Cloud, dll).
//! Font Adobe ditandai dengan membaca NAMA family dari folder sinkron Creative Cloud
//! (file tidak disalin/diubah; lisensi tetap dikelola Creative Cloud).
use rayon::prelude::*;
use serde::Serialize;
use std::collections::{BTreeMap, BTreeSet};
use std::path::PathBuf;
use std::collections::HashSet;
use std::sync::Mutex;
use ttf_parser::name_id;

#[derive(Serialize, Clone)]
pub struct FontFamily {
    pub name: String,
    pub weights: Vec<u16>,
    pub italic: bool,
    /// "adobe" bila berasal dari Adobe Fonts (Creative Cloud), selain itu "system"
    pub source: &'static str,
}

static CACHE: Mutex<Option<Vec<FontFamily>>> = Mutex::new(None);

/// Folder sinkron Adobe Fonts (berisi OTF/TTF aktif dengan nama file teracak).
fn adobe_dirs() -> Vec<PathBuf> {
    #[cfg(windows)]
    let base = match std::env::var("APPDATA") {
        Ok(r) => PathBuf::from(r).join("Adobe\\CoreSync\\plugins\\livetype"),
        Err(_) => return vec![],
    };
    #[cfg(not(windows))]
    let base = match std::env::var("HOME") {
        Ok(h) => PathBuf::from(h).join("Library/Application Support/Adobe/CoreSync/plugins/livetype"),
        Err(_) => return vec![],
    };
    ["r", "t", "w", ".r", ".t", ".w"].iter().map(|d| base.join(d)).collect()
}

/// File font Adobe yang sedang aktif (nama file teracak, kadang tanpa ekstensi).
fn adobe_files() -> Vec<PathBuf> {
    let mut files = Vec::new();
    for d in adobe_dirs() {
        if let Ok(rd) = std::fs::read_dir(d) {
            files.extend(rd.flatten().map(|e| e.path()).filter(|p| p.is_file()));
        }
    }
    files
}

/// Semua nama family (ID1 & ID16) dari font Adobe yang sedang aktif, huruf kecil.
fn adobe_names() -> HashSet<String> {
    adobe_files()
        .par_iter()
        .flat_map(|p| {
            let Ok(data) = std::fs::read(p) else { return vec![] };
            let n = ttf_parser::fonts_in_collection(&data).unwrap_or(1);
            let mut out = Vec::new();
            for i in 0..n {
                if let Ok(face) = ttf_parser::Face::parse(&data, i) {
                    for nm in face.names() {
                        if (nm.name_id == name_id::FAMILY || nm.name_id == name_id::TYPOGRAPHIC_FAMILY) && nm.is_unicode() {
                            if let Some(s) = nm.to_string() {
                                out.push(s.trim().to_lowercase());
                            }
                        }
                    }
                }
            }
            out
        })
        .collect()
}

#[cfg(windows)]
fn font_dirs() -> Vec<PathBuf> {
    let mut v = Vec::new();
    let win = std::env::var("WINDIR").unwrap_or_else(|_| "C:\\Windows".into());
    v.push(PathBuf::from(win).join("Fonts"));
    if let Ok(local) = std::env::var("LOCALAPPDATA") {
        v.push(PathBuf::from(local).join("Microsoft\\Windows\\Fonts"));
    }
    v
}

#[cfg(not(windows))]
fn font_dirs() -> Vec<PathBuf> {
    let mut v: Vec<PathBuf> = ["/System/Library/Fonts", "/System/Library/Fonts/Supplemental", "/Library/Fonts"].iter().map(PathBuf::from).collect();
    if let Ok(h) = std::env::var("HOME") {
        v.push(PathBuf::from(h).join("Library/Fonts"));
    }
    v
}

fn family_name(face: &ttf_parser::Face) -> Option<String> {
    // prioritas: typographic family (ID16) > family (ID1); bahasa en-US diutamakan
    let mut best: Option<(u8, String)> = None;
    for n in face.names() {
        if n.name_id != name_id::TYPOGRAPHIC_FAMILY && n.name_id != name_id::FAMILY {
            continue;
        }
        if !n.is_unicode() {
            continue;
        }
        let Some(s) = n.to_string() else { continue };
        let s = s.trim().to_string();
        if s.is_empty() || s.starts_with('@') {
            continue;
        }
        let pri = if n.name_id == name_id::TYPOGRAPHIC_FAMILY { 2 } else { 0 }
            + if n.language_id == 0x409 { 1 } else { 0 };
        if best.as_ref().map(|(p, _)| pri > *p).unwrap_or(true) {
            best = Some((pri, s));
        }
    }
    best.map(|(_, s)| s)
}

fn parse_file(p: &PathBuf) -> Vec<(String, u16, bool)> {
    let Ok(data) = std::fs::read(p) else { return vec![] };
    let count = ttf_parser::fonts_in_collection(&data).unwrap_or(1);
    let mut out = Vec::new();
    for i in 0..count {
        if let Ok(face) = ttf_parser::Face::parse(&data, i) {
            if let Some(name) = family_name(&face) {
                out.push((name, face.weight().to_number(), face.is_italic()));
            }
        }
    }
    out
}

fn scan() -> Vec<FontFamily> {
    let mut files = Vec::new();
    for d in font_dirs() {
        if let Ok(rd) = std::fs::read_dir(d) {
            for e in rd.flatten() {
                let p = e.path();
                let ext = p
                    .extension()
                    .and_then(|x| x.to_str())
                    .unwrap_or("")
                    .to_ascii_lowercase();
                if matches!(ext.as_str(), "ttf" | "otf" | "ttc" | "otc") {
                    files.push(p);
                }
            }
        }
    }
    // macOS: font Adobe aktif tidak ada di folder Fonts, jadi dibaca langsung dari folder sinkronnya
    #[cfg(not(windows))]
    files.extend(adobe_files());
    let faces: Vec<(String, u16, bool)> = files.par_iter().flat_map(parse_file).collect();
    let mut map: BTreeMap<String, (String, BTreeSet<u16>, bool)> = BTreeMap::new();
    for (name, w, it) in faces {
        let e = map
            .entry(name.to_lowercase())
            .or_insert_with(|| (name.clone(), BTreeSet::new(), false));
        e.1.insert(w);
        e.2 |= it;
    }
    // font yang didaftarkan di luar folder Fonts (Adobe Fonts/Creative Cloud, installer pihak ketiga)
    // hanya terlihat lewat GDI; WebView tetap bisa merendernya lewat nama family ini
    for name in gdi_families() {
        let key = name.to_lowercase();
        if name.starts_with('@') || name.chars().count() >= 31 || map.contains_key(&key) {
            continue;
        }
        map.insert(key, (name, BTreeSet::from([400u16, 700]), true));
    }
    let adobe = adobe_names();
    map.into_iter()
        .map(|(key, (name, w, italic))| FontFamily {
            source: if adobe.contains(&key) { "adobe" } else { "system" },
            name,
            weights: w.into_iter().collect(),
            italic,
        })
        .collect()
}

#[cfg(windows)]
fn gdi_families() -> Vec<String> {
    use windows_sys::Win32::Foundation::LPARAM;
    use windows_sys::Win32::Graphics::Gdi::{EnumFontFamiliesExW, GetDC, ReleaseDC, DEFAULT_CHARSET, LOGFONTW, TEXTMETRICW};

    unsafe extern "system" fn cb(lf: *const LOGFONTW, _tm: *const TEXTMETRICW, _ft: u32, lp: LPARAM) -> i32 {
        let out = &mut *(lp as *mut Vec<String>);
        let face = &(*lf).lfFaceName;
        let len = face.iter().position(|&c| c == 0).unwrap_or(face.len());
        out.push(String::from_utf16_lossy(&face[..len]));
        1
    }

    let mut out: Vec<String> = Vec::new();
    unsafe {
        let hdc = GetDC(std::ptr::null_mut());
        let mut lf: LOGFONTW = std::mem::zeroed();
        lf.lfCharSet = DEFAULT_CHARSET as _;
        EnumFontFamiliesExW(hdc, &lf, Some(cb), &mut out as *mut Vec<String> as LPARAM, 0);
        ReleaseDC(std::ptr::null_mut(), hdc);
    }
    out.sort();
    out.dedup();
    out
}

#[cfg(not(windows))]
fn gdi_families() -> Vec<String> {
    Vec::new()
}

fn cached(refresh: bool) -> Vec<FontFamily> {
    if !refresh {
        if let Some(v) = CACHE.lock().unwrap().as_ref() {
            return v.clone();
        }
    }
    let v = scan();
    *CACHE.lock().unwrap() = Some(v.clone());
    v
}

pub fn warm_up() {
    cached(false);
}

/// refresh=true memindai ulang (mis. setelah mengaktifkan font baru di Creative Cloud).
#[tauri::command]
pub async fn list_fonts(refresh: Option<bool>) -> Vec<FontFamily> {
    tauri::async_runtime::spawn_blocking(move || cached(refresh.unwrap_or(false)))
        .await
        .unwrap_or_default()
}

/// Buka halaman Adobe Fonts di browser (hanya domain fonts.adobe.com).
#[tauri::command]
pub fn open_adobe_fonts(query: String) -> Result<(), String> {
    let q: String = query.chars().filter(|c| c.is_alphanumeric() || *c == ' ').collect();
    let url = format!("https://fonts.adobe.com/fonts?query={}", q.trim().replace(' ', "%20"));
    crate::export::open_with_system(&url)
}
