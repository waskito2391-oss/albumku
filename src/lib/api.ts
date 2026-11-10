import { invoke } from "@tauri-apps/api/core";
import type { FontFamily, Layout, Photo } from "../types";

const layoutCache = new Map<string, Promise<Layout[]>>();

export function getLayouts(n: number, aspect: number, spread: boolean): Promise<Layout[]> {
  const key = `${n}|${aspect.toFixed(3)}|${spread}`;
  let p = layoutCache.get(key);
  if (!p) {
    p = invoke<Layout[]>("gen_layouts", { n, aspect, spread });
    layoutCache.set(key, p);
  }
  return p;
}

export const layoutCount = (aspect: number, spread: boolean) => invoke<number>("layout_count", { aspect, spread });
export const listFonts = (refresh = false) => invoke<FontFamily[]>("list_fonts", { refresh });
export const openAdobeFonts = (query = "") => invoke("open_adobe_fonts", { query });
export const importPhotos = (paths: string[]) => invoke<Photo[]>("import_photos", { paths });
export const scanFolder = (dir: string) => invoke<string[]>("scan_folder", { dir });
export const writeText = (path: string, content: string) => invoke("write_text", { path, content });
export const readText = (path: string) => invoke<string>("read_text", { path });
export const openFolder = (path: string) => invoke("open_folder", { path });

/** Kirim piksel RGBA mentah ke Rust (raw IPC, tanpa base64). */
export function saveFrame(cmd: "save_jpeg" | "save_tiff" | "pdf_add", path: string, data: Uint8ClampedArray, width: number, height: number, quality: number, dpi: number, bleedPx = 0) {
  return invoke(cmd, new Uint8Array(data.buffer, data.byteOffset, data.byteLength), {
    headers: {
      "x-path": encodeURIComponent(path),
      "x-width": String(width),
      "x-height": String(height),
      "x-quality": String(quality),
      "x-dpi": String(dpi),
      "x-bleed": String(bleedPx),
    },
  });
}
