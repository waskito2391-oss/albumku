import type { Cell, Format, Layout, Page, Photo, Rect } from "../types";
import { getLayouts } from "./api";
import { cellRect, contentRect, pageAspect } from "./formats";

const loss = (a: number, b: number) => 1 - Math.min(a / b, b / a);

/** Gabungan semua kotak wajah (null kalau tidak ada wajah). */
export function faceBox(p: Photo): Rect | null {
  const fs = p.faces;
  if (!fs?.length) return null;
  const x0 = Math.min(...fs.map((f) => f.x));
  const y0 = Math.min(...fs.map((f) => f.y));
  const x1 = Math.max(...fs.map((f) => f.x + f.w));
  const y1 = Math.max(...fs.map((f) => f.y + f.h));
  // beri ruang kepala/rambut di atas wajah
  const pad = (y1 - y0) * 0.35;
  return { x: x0, y: Math.max(0, y0 - pad), w: x1 - x0, h: Math.min(1, y1) - Math.max(0, y0 - pad) };
}

/** Penalti bila semua wajah tidak muat dalam potongan sel dengan rasio `cellAsp`. */
function facePenalty(p: Photo, cellAsp: number) {
  const fb = faceBox(p);
  if (!fb) return 0;
  const ia = p.width / p.height;
  const cw = cellAsp > ia ? 1 : cellAsp / ia;
  const ch = cellAsp > ia ? ia / cellAsp : 1;
  return fb.w > cw + 0.01 || fb.h > ch + 0.01 ? 0.3 : 0;
}

/**
 * Pasangkan foto ke sel template: sel diurutkan menurut rasio, foto juga, lalu dipasangkan
 * berurutan (optimal untuk meminimalkan potongan/crop). Urutan stabil menjaga urutan kronologis.
 * Template yang memotong wajah mendapat penalti.
 */
export function assign(f: Format, page: Page, layout: Layout, photos: Photo[]) {
  const cr = contentRect(f, page);
  const cellAsp = layout.cells.map((c) => (c.w * cr.w) / (c.h * cr.h));
  const cellOrder = cellAsp.map((a, i) => [a, i] as const).sort((x, y) => x[0] - y[0]).map((x) => x[1]);
  const usable = photos.slice(0, layout.cells.length);
  const photoOrder = usable.map((p, i) => [p.width / p.height, i] as const).sort((x, y) => x[0] - y[0]).map((x) => x[1]);
  const result: (Photo | null)[] = layout.cells.map(() => null);
  let total = 0;
  photoOrder.forEach((pi, k) => {
    const ci = cellOrder[k + Math.floor((cellOrder.length - photoOrder.length) / 2)];
    const ph = usable[pi];
    result[ci] = ph;
    total += loss(cellAsp[ci], ph.width / ph.height) + facePenalty(ph, cellAsp[ci]);
  });
  const score = usable.length ? total / usable.length : 0;
  return { photos: result, score };
}

/** Geser (ox, oy) supaya wajah berada di tengah sel (sedikit di atas tengah untuk ruang kepala). */
export function smartOffset(f: Format, page: Page, c: Rect, p: Photo | null | undefined): { ox: number; oy: number } {
  const fb = p ? faceBox(p) : null;
  if (!p || !fb) return { ox: 0, oy: 0 };
  const r = cellRect(f, page, c);
  const s = Math.max(r.w / p.width, r.h / p.height);
  const dw = p.width * s;
  const dh = p.height * s;
  const sx = dw - r.w;
  const sy = dh - r.h;
  const fx = fb.x + fb.w / 2;
  const fy = fb.y + fb.h / 2;
  const clamp = (v: number) => Math.max(-1, Math.min(1, v));
  return {
    ox: sx > 0.5 ? clamp((2 * (fx * dw - 0.5 * r.w)) / sx - 1) : 0,
    oy: sy > 0.5 ? clamp((2 * (fy * dh - 0.45 * r.h)) / sy - 1) : 0,
  };
}

export function toCells(f: Format, page: Page, layout: Layout, photos: (Photo | null)[], smart = true): Cell[] {
  return layout.cells.map((c, i) => {
    const p = photos[i];
    const off = smart ? smartOffset(f, page, c, p) : { ox: 0, oy: 0 };
    return { ...c, photoId: p?.id ?? null, zoom: 1, rot: 0, ...off };
  });
}

export function pagePhotoIds(page: Page): string[] {
  return page.cells.map((c) => c.photoId).filter((x): x is string => !!x);
}

export async function layoutsFor(f: Format, page: Page, n: number) {
  return getLayouts(n, pageAspect(f, page.margin), f.spread);
}

/** Template terurut dari yang paling cocok dengan foto-foto halaman. */
export async function rankedLayouts(f: Format, page: Page, n: number, photos: Photo[], blankPenalty = 0) {
  const ls = await layoutsFor(f, page, n);
  const blank = (l: Layout) => l.blanks.reduce((a, b) => a + b.w * b.h, 0);
  return ls
    .map((l, i) => ({ l, score: (photos.length ? assign(f, page, l, photos).score : 0) + blank(l) * blankPenalty + i * 1e-6 }))
    .sort((a, b) => a.score - b.score)
    .map((x) => x.l);
}

/** Pilih template terbaik untuk sekumpulan foto (dengan variasi: hindari id yang baru dipakai). */
export async function bestLayout(f: Format, page: Page, photos: Photo[], avoid: string[] = [], pickFrom = 1) {
  const n = Math.max(1, Math.min(12, photos.length));
  // mode otomatis: utamakan template yang penuh foto (ruang kosong magazine dipilih manual)
  const ranked = await rankedLayouts(f, page, n, photos, 3);
  const pool = ranked.filter((l) => !avoid.includes(l.id)).slice(0, Math.max(1, pickFrom));
  const l = pool[Math.floor(Math.random() * pool.length)] ?? ranked[0];
  return l;
}
