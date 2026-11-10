mod export;
mod fonts;
mod layouts;
mod license;
mod photos;

use percent_encoding::percent_decode_str;
use tauri::http::Response;

fn mime_of(path: &str) -> &'static str {
    let p = path.to_ascii_lowercase();
    if p.ends_with(".png") {
        "image/png"
    } else if p.ends_with(".webp") {
        "image/webp"
    } else {
        "image/jpeg"
    }
}

/// albumku://localhost/f?p=<path>  (Windows: http://albumku.localhost/f?p=...)
/// Sengaja pakai protokol sendiri (bukan asset protocol) supaya bisa kirim header CORS:
/// canvas tidak "tainted" sehingga getImageData() saat export tetap jalan.
fn serve_file(uri: &str) -> Response<Vec<u8>> {
    let path = uri
        .split_once("?p=")
        .map(|(_, q)| percent_decode_str(q).decode_utf8_lossy().to_string());
    match path.and_then(|p| std::fs::read(&p).ok().map(|b| (p, b))) {
        Some((p, bytes)) => Response::builder()
            .header("Content-Type", mime_of(&p))
            .header("Access-Control-Allow-Origin", "*")
            .header("Cache-Control", "max-age=31536000")
            .body(bytes)
            .unwrap(),
        None => Response::builder()
            .status(404)
            .header("Access-Control-Allow-Origin", "*")
            .body(Vec::new())
            .unwrap(),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .register_asynchronous_uri_scheme_protocol("albumku", |_ctx, req, responder| {
            let uri = req.uri().to_string();
            std::thread::spawn(move || responder.respond(serve_file(&uri)));
        })
        .setup(|_app| {
            // pindai font Windows di belakang supaya panel Teks langsung siap
            std::thread::spawn(fonts::warm_up);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            fonts::list_fonts,
            fonts::open_adobe_fonts,
            layouts::gen_layouts,
            layouts::layout_count,
            photos::import_photos,
            photos::scan_folder,
            export::save_jpeg,
            export::save_tiff,
            export::pdf_begin,
            export::pdf_add,
            export::pdf_finish,
            export::write_text,
            export::read_text,
            export::open_folder,
            license::license_status,
            license::license_activate,
            license::license_logout,
        ])
        .run(tauri::generate_context!())
        .expect("error while running ALBUMKU");
}
