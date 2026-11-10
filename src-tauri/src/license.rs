//! Lisensi: 1 email = 1 komputer, dicek ke Google Apps Script yang menempel di Google Sheet.
//!
//! Isi `URL` dengan URL aplikasi web Apps Script (berakhiran /exec). Lihat `license/README.md`.

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::path::PathBuf;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::Manager;

/** URL aplikasi web Apps Script; kosong = lisensi belum diatur */
const URL: &str = "https://script.google.com/macros/s/AKfycbzTd4pj8V-bo1715ICW3KIYCLE8cOHnEYfDLz7HnlSGemWx6EvbRDNWP0Jw2F4EY_Yl/exec";
/** boleh dipakai tanpa internet selama ini sejak cek online terakhir yang berhasil */
const OFFLINE_GRACE: u64 = 7 * 24 * 3600;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LicenseState {
    ok: bool,
    code: String,
    message: String,
    email: Option<String>,
    name: Option<String>,
    machine: String,
    offline: bool,
}

#[derive(Serialize, Deserialize)]
struct Cache {
    email: String,
    name: String,
    machine: String,
    checked: u64,
    sig: String,
}

#[derive(Deserialize)]
struct Reply {
    ok: bool,
    #[serde(default)]
    code: String,
    #[serde(default)]
    message: String,
    #[serde(default)]
    name: String,
}

fn sha_hex(s: &str) -> String {
    Sha256::digest(s.as_bytes()).iter().map(|b| format!("{b:02X}")).collect()
}

fn now() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0)
}

#[cfg(windows)]
fn raw_machine_guid() -> Option<String> {
    use windows_sys::Win32::System::Registry::{RegGetValueW, HKEY_LOCAL_MACHINE, RRF_RT_REG_SZ, RRF_SUBKEY_WOW6464KEY};
    let w = |s: &str| s.encode_utf16().chain(Some(0)).collect::<Vec<u16>>();
    let key = w("SOFTWARE\\Microsoft\\Cryptography");
    let val = w("MachineGuid");
    let mut buf = [0u16; 128];
    let mut len = (buf.len() * 2) as u32;
    let r = unsafe {
        RegGetValueW(
            HKEY_LOCAL_MACHINE,
            key.as_ptr(),
            val.as_ptr(),
            RRF_RT_REG_SZ | RRF_SUBKEY_WOW6464KEY,
            std::ptr::null_mut(),
            buf.as_mut_ptr().cast(),
            &mut len,
        )
    };
    if r != 0 {
        return None;
    }
    let n = (len as usize / 2).saturating_sub(1);
    Some(String::from_utf16_lossy(&buf[..n]))
}

/// macOS: IOPlatformUUID (UUID perangkat keras, tetap walau macOS diinstal ulang).
#[cfg(target_os = "macos")]
fn raw_machine_guid() -> Option<String> {
    let out = std::process::Command::new("/usr/sbin/ioreg").args(["-rd1", "-c", "IOPlatformExpertDevice"]).output().ok()?;
    let s = String::from_utf8_lossy(&out.stdout);
    // baris:   "IOPlatformUUID" = "XXXXXXXX-XXXX-..."
    s.lines().find(|l| l.contains("IOPlatformUUID")).and_then(|l| l.split('"').nth(3)).map(|x| x.to_string())
}

#[cfg(not(any(windows, target_os = "macos")))]
fn raw_machine_guid() -> Option<String> {
    std::fs::read_to_string("/etc/machine-id").ok()
}

/// ID komputer: hash dari MachineGuid Windows (ID asli tidak dikirim), format XXXX-XXXX-XXXX-XXXX.
fn machine_id() -> String {
    let raw = raw_machine_guid()
        .filter(|x| !x.trim().is_empty())
        .unwrap_or_else(|| std::env::var("COMPUTERNAME").or_else(|_| std::env::var("HOSTNAME")).unwrap_or_default());
    let h = sha_hex(&format!("albumku|{}", raw.trim().to_lowercase()));
    h[..16].as_bytes().chunks(4).map(|c| std::str::from_utf8(c).unwrap()).collect::<Vec<_>>().join("-")
}

fn cache_path(app: &tauri::AppHandle) -> Option<PathBuf> {
    app.path().app_data_dir().ok().map(|d| d.join("license.json"))
}

fn cache_sig(email: &str, machine: &str, checked: u64) -> String {
    sha_hex(&format!("albumku-lisensi|{email}|{machine}|{checked}"))
}

fn read_cache(app: &tauri::AppHandle, machine: &str) -> Option<Cache> {
    let c: Cache = serde_json::from_str(&std::fs::read_to_string(cache_path(app)?).ok()?).ok()?;
    (c.machine == machine && c.sig == cache_sig(&c.email, &c.machine, c.checked)).then_some(c)
}

fn write_cache(app: &tauri::AppHandle, email: &str, name: &str, machine: &str) {
    let Some(p) = cache_path(app) else { return };
    let checked = now();
    let c = Cache { email: email.into(), name: name.into(), machine: machine.into(), checked, sig: cache_sig(email, machine, checked) };
    if let Some(dir) = p.parent() {
        let _ = std::fs::create_dir_all(dir);
    }
    let _ = std::fs::write(p, serde_json::to_string(&c).unwrap_or_default());
}

fn clear_cache(app: &tauri::AppHandle) {
    if let Some(p) = cache_path(app) {
        let _ = std::fs::remove_file(p);
    }
}

/// Cek ke server. Err = gagal terhubung (bukan penolakan dari server).
fn verify(email: &str, machine: &str) -> Result<Reply, String> {
    let agent = ureq::AgentBuilder::new().timeout(Duration::from_secs(12)).build();
    let res = agent
        .get(URL)
        .query("email", email)
        .query("machine", machine)
        .query("v", env!("CARGO_PKG_VERSION"))
        .call()
        .map_err(|e| e.to_string())?;
    let body = res.into_string().map_err(|e| e.to_string())?;
    serde_json::from_str::<Reply>(&body).map_err(|_| "Jawaban server lisensi tidak dikenali. Periksa URL Apps Script.".to_string())
}

fn state(ok: bool, code: &str, message: impl Into<String>, machine: &str) -> LicenseState {
    LicenseState { ok, code: code.into(), message: message.into(), email: None, name: None, machine: machine.into(), offline: false }
}

fn status_blocking(app: tauri::AppHandle) -> LicenseState {
    let machine = machine_id();
    if URL.is_empty() {
        // build pengembangan tanpa konfigurasi: jangan menghalangi
        if cfg!(debug_assertions) {
            return state(true, "dev", "Mode pengembangan (lisensi tidak dicek).", &machine);
        }
        return state(false, "unconfigured", "Server lisensi belum diatur di build ini.", &machine);
    }
    let Some(c) = read_cache(&app, &machine) else {
        return state(false, "need_activation", "", &machine);
    };
    let done = |offline: bool, msg: &str, name: String| LicenseState {
        ok: true,
        code: if offline { "offline".into() } else { "ok".into() },
        message: msg.into(),
        email: Some(c.email.clone()),
        name: Some(name),
        machine: machine.clone(),
        offline,
    };
    match verify(&c.email, &machine) {
        Ok(r) if r.ok => {
            write_cache(&app, &c.email, &r.name, &machine);
            done(false, "", r.name)
        }
        Ok(r) => {
            clear_cache(&app);
            let mut s = state(false, &r.code, r.message, &machine);
            s.email = Some(c.email.clone());
            s
        }
        Err(_) if now().saturating_sub(c.checked) <= OFFLINE_GRACE => {
            let left = (OFFLINE_GRACE - now().saturating_sub(c.checked)) / 86400;
            done(true, &format!("Mode offline: sambungkan internet dalam {} hari agar lisensi tetap aktif.", left.max(1)), c.name.clone())
        }
        Err(_) => state(false, "offline_expired", "Sudah lebih dari 7 hari tanpa cek lisensi. Sambungkan internet lalu coba lagi.", &machine),
    }
}

fn activate_blocking(app: tauri::AppHandle, email: String) -> LicenseState {
    let machine = machine_id();
    let email = email.trim().to_lowercase();
    if URL.is_empty() {
        return state(false, "unconfigured", "Server lisensi belum diatur di build ini.", &machine);
    }
    match verify(&email, &machine) {
        Ok(r) if r.ok => {
            write_cache(&app, &email, &r.name, &machine);
            LicenseState { ok: true, code: "ok".into(), message: r.message, email: Some(email), name: Some(r.name), machine, offline: false }
        }
        Ok(r) => state(false, &r.code, r.message, &machine),
        Err(e) => state(false, "network", format!("Tidak bisa terhubung ke server lisensi. Periksa internet. ({e})"), &machine),
    }
}

#[tauri::command]
pub async fn license_status(app: tauri::AppHandle) -> LicenseState {
    tauri::async_runtime::spawn_blocking(move || status_blocking(app))
        .await
        .unwrap_or_else(|e| state(false, "error", e.to_string(), ""))
}

#[tauri::command]
pub async fn license_activate(app: tauri::AppHandle, email: String) -> LicenseState {
    tauri::async_runtime::spawn_blocking(move || activate_blocking(app, email))
        .await
        .unwrap_or_else(|e| state(false, "error", e.to_string(), ""))
}

/// Lepas lisensi di komputer ini saja (ganti email). Data di sheet tidak berubah.
#[tauri::command]
pub fn license_reset(app: tauri::AppHandle) {
    clear_cache(&app);
}
