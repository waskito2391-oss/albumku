const BASE = navigator.userAgent.includes("Windows") ? "http://albumku.localhost" : "albumku://localhost";

export const fileUrl = (path: string) => `${BASE}/f?p=${encodeURIComponent(path)}`;

const cache = new Map<string, HTMLImageElement>();
const listeners = new Set<() => void>();

export function onImageLoaded(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

let pending = 0;
function notify() {
  if (pending) return;
  pending = requestAnimationFrame(() => {
    pending = 0;
    listeners.forEach((f) => f());
  });
}

/** Gambar thumbnail untuk editor; null kalau belum termuat (redraw otomatis saat siap). */
export function getImg(path: string): HTMLImageElement | null {
  let im = cache.get(path);
  if (!im) {
    im = new Image();
    im.crossOrigin = "anonymous";
    im.decoding = "async";
    im.onload = notify;
    im.src = fileUrl(path);
    cache.set(path, im);
  }
  return im.complete && im.naturalWidth > 0 ? im : null;
}

/** Muat gambar resolusi penuh (untuk export). */
export function loadFull(path: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.crossOrigin = "anonymous";
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error(`Gagal memuat ${path}`));
    im.src = fileUrl(path);
  });
}
