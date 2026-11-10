import type { Fill, Format, Page, Rect } from "../types";

export const DPI = 300;
export const cmToPx = (cm: number, dpi = DPI) => Math.round((cm / 2.54) * dpi);
export const mmToPx = (mm: number, dpi = DPI) => Math.round((mm / 25.4) * dpi);

export function printFormat(kind: "album" | "magazine", label: string, wCm: number, hCm: number, spread: boolean, bleedMm: number): Format {
  return {
    kind,
    label,
    pageW: cmToPx(wCm),
    pageH: cmToPx(hCm),
    spread,
    bleed: mmToPx(bleedMm),
    dpi: DPI,
    isPrint: true,
    exportScale: 1,
    wCm,
    hCm,
  };
}

export function socialFormat(kind: "story" | "feed" | "carousel" | "puzzle", label: string, w: number, h: number, cols = 1, rows = 1): Format {
  return { kind, label, pageW: w, pageH: h, spread: false, bleed: 0, dpi: 72, isPrint: false, exportScale: 2, cols, rows };
}

export const SLIDE_RATIOS = [
  { label: "4:5", w: 1080, h: 1350 },
  { label: "3:4", w: 1080, h: 1440 },
  { label: "1:1", w: 1080, h: 1080 },
];

export const panelCols = (f: Format) => (f.spread ? 2 : f.cols ?? 1);
export const panelRows = (f: Format) => f.rows ?? 1;

/** Potongan output (koordinat dokumen): slide carousel / tile puzzle / halaman. */
export function tiles(f: Format, bleed: boolean, splitSpread: boolean) {
  const { W, H } = docSize(f);
  const b = f.bleed;
  const out: { x: number; y: number; w: number; h: number; suffix: string }[] = [];
  if (f.kind === "carousel" || f.kind === "puzzle") {
    const cols = panelCols(f);
    const rows = panelRows(f);
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        // puzzle: urutan UNGGAH dimulai dari kanan-bawah supaya grid profil tersusun benar
        const order = f.kind === "puzzle" ? rows * cols - (r * cols + c) : c + 1;
        out.push({ x: c * f.pageW, y: r * f.pageH, w: f.pageW, h: f.pageH, suffix: f.kind === "puzzle" ? `-unggah${String(order).padStart(2, "0")}` : `-slide${String(order).padStart(2, "0")}` });
      }
    return f.kind === "puzzle" ? out.sort((a, b2) => a.suffix.localeCompare(b2.suffix)) : out;
  }
  const e = bleed ? 0 : b;
  if (f.spread && splitSpread) {
    const mid = W / 2;
    return [
      { x: e, y: e, w: mid - e, h: H - 2 * e, suffix: "-kiri" },
      { x: mid, y: e, w: W - e - mid, h: H - 2 * e, suffix: "-kanan" },
    ];
  }
  return [{ x: e, y: e, w: W - 2 * e, h: H - 2 * e, suffix: "" }];
}

export const ALBUM_SIZES = [
  { label: "20 x 30 cm", w: 20, h: 30 },
  { label: "30 x 30 cm", w: 30, h: 30 },
  { label: "40 x 30 cm", w: 40, h: 30 },
];

export const MAGAZINE_SIZES = [
  { label: "A4 (21 x 29.7 cm)", w: 21, h: 29.7 },
  { label: "Letter (21.6 x 27.9 cm)", w: 21.6, h: 27.9 },
];

export const SOCIAL_SIZES: { kind: "story" | "feed"; label: string; w: number; h: number; hint: string }[] = [
  { kind: "story", label: "Story / Reels 9:16", w: 1080, h: 1920, hint: "Instagram, TikTok, WA Status" },
  { kind: "feed", label: "Feed Portrait 4:5", w: 1080, h: 1350, hint: "Paling banyak ruang di feed" },
  { kind: "feed", label: "Feed Grid 3:4", w: 1080, h: 1440, hint: "Pas dengan grid profil IG" },
  { kind: "feed", label: "Feed Square 1:1", w: 1080, h: 1080, hint: "Klasik" },
  { kind: "feed", label: "Feed Landscape 1.91:1", w: 1080, h: 566, hint: "Foto lebar" },
];

/** Ukuran kanvas dokumen penuh (termasuk bleed). */
export function docSize(f: Format) {
  const tw = f.pageW * panelCols(f);
  const th = f.pageH * panelRows(f);
  return { W: tw + f.bleed * 2, H: th + f.bleed * 2, TW: tw, TH: th };
}

/** Rasio area isi satu halaman (untuk generator template). */
export function pageAspect(f: Format, margin: number) {
  if (f.spread) return Math.max(0.1, (f.pageW - margin) / Math.max(1, f.pageH - margin * 2));
  const { TW, TH } = docSize(f);
  return Math.max(0.1, (TW - margin * 2) / Math.max(1, TH - margin * 2));
}

/** Rasio tampilan template (seluruh kanvas isi). */
export const displayAspect = (f: Format, margin: number) => pageAspect(f, margin) * (f.spread ? 2 : 1);

export function contentRect(f: Format, page: Page): Rect {
  const { TW, TH } = docSize(f);
  const m = page.margin;
  return { x: f.bleed + m, y: f.bleed + m, w: TW - 2 * m, h: TH - 2 * m };
}

/** Rect sel dalam koordinat dokumen; gutter di sisi dalam, full-bleed bila margin 0. */
export function cellRect(f: Format, page: Page, c: Rect): Rect {
  const cr = contentRect(f, page);
  const g = page.gutter / 2;
  const E = 1e-4;
  const b = page.margin === 0 ? f.bleed : 0;
  let x0 = cr.x + c.x * cr.w;
  let y0 = cr.y + c.y * cr.h;
  let x1 = cr.x + (c.x + c.w) * cr.w;
  let y1 = cr.y + (c.y + c.h) * cr.h;
  if (c.x > E) x0 += g; else x0 -= b;
  if (c.y > E) y0 += g; else y0 -= b;
  if (c.x + c.w < 1 - E) x1 -= g; else x1 += b;
  if (c.y + c.h < 1 - E) y1 -= g; else y1 += b;
  return { x: x0, y: y0, w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0) };
}

/** Konversi satuan dokumen <-> label UI (mm untuk cetak, px untuk sosmed). */
export function unitOf(f: Format) {
  return f.isPrint ? "mm" : "px";
}
export function toUnit(f: Format, px: number) {
  return f.isPrint ? Math.round((px / f.dpi) * 25.4 * 10) / 10 : Math.round(px);
}
export function fromUnit(f: Format, v: number) {
  return f.isPrint ? (v / 25.4) * f.dpi : v;
}

export const WHITE: Fill = { type: "solid", color: "#ffffff", alpha: 1 };

export function defaultPageStyle(f: Format): Pick<Page, "bg" | "gutter" | "margin" | "radius"> {
  return {
    bg: { ...WHITE },
    gutter: f.isPrint ? mmToPx(3) : 10,
    margin: 0,
    radius: 0,
  };
}

export function formatSummary(f: Format) {
  const { W, H } = docSize(f);
  if (f.isPrint) {
    const w = (f.wCm ?? 0) * (f.spread ? 2 : 1);
    return `${w} × ${f.hCm} cm${f.spread ? " spread" : ""}, ${W} × ${H} px, ${f.dpi} dpi`;
  }
  if (f.kind === "carousel") return `Carousel ${panelCols(f)} slide, ${f.pageW} × ${f.pageH} px per slide`;
  if (f.kind === "puzzle") return `Puzzle ${panelCols(f)} × ${panelRows(f)} post, ${f.pageW} × ${f.pageH} px per post`;
  return `${f.pageW} × ${f.pageH} px, export ${f.pageW * f.exportScale} × ${f.pageH * f.exportScale} px`;
}
