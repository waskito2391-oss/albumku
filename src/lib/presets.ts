import type { Fill, Format, Overlay, TextItem } from "../types";
import { docSize } from "./formats";

export const GRADIENTS: { name: string; fill: Fill }[] = [
  { name: "Senja", fill: { type: "linear", angle: 45, stops: [{ pos: 0, color: "#f6d365", alpha: 1 }, { pos: 1, color: "#fda085", alpha: 1 }] } },
  { name: "Peach", fill: { type: "linear", angle: 90, stops: [{ pos: 0, color: "#ffecd2", alpha: 1 }, { pos: 1, color: "#fcb69f", alpha: 1 }] } },
  { name: "Rose Gold", fill: { type: "linear", angle: 135, stops: [{ pos: 0, color: "#e8cbc0", alpha: 1 }, { pos: 1, color: "#636fa4", alpha: 1 }] } },
  { name: "Blush", fill: { type: "linear", angle: 90, stops: [{ pos: 0, color: "#fbe9e7", alpha: 1 }, { pos: 1, color: "#f8bbd0", alpha: 1 }] } },
  { name: "Sage", fill: { type: "linear", angle: 90, stops: [{ pos: 0, color: "#e3ead8", alpha: 1 }, { pos: 1, color: "#9fb59a", alpha: 1 }] } },
  { name: "Champagne", fill: { type: "linear", angle: 60, stops: [{ pos: 0, color: "#f7f1e3", alpha: 1 }, { pos: 0.5, color: "#e8d7b5", alpha: 1 }, { pos: 1, color: "#c9a96e", alpha: 1 }] } },
  { name: "Laut", fill: { type: "linear", angle: 90, stops: [{ pos: 0, color: "#a1c4fd", alpha: 1 }, { pos: 1, color: "#c2e9fb", alpha: 1 }] } },
  { name: "Lavender", fill: { type: "linear", angle: 120, stops: [{ pos: 0, color: "#e0c3fc", alpha: 1 }, { pos: 1, color: "#8ec5fc", alpha: 1 }] } },
  { name: "Malam", fill: { type: "linear", angle: 90, stops: [{ pos: 0, color: "#232526", alpha: 1 }, { pos: 1, color: "#414345", alpha: 1 }] } },
  { name: "Navy Gold", fill: { type: "linear", angle: 135, stops: [{ pos: 0, color: "#141e30", alpha: 1 }, { pos: 1, color: "#243b55", alpha: 1 }] } },
  { name: "Krem Radial", fill: { type: "radial", angle: 0, stops: [{ pos: 0, color: "#fffaf2", alpha: 1 }, { pos: 1, color: "#e9dcc6", alpha: 1 }] } },
  { name: "Emas", fill: { type: "linear", angle: 30, stops: [{ pos: 0, color: "#bf953f", alpha: 1 }, { pos: 0.25, color: "#fcf6ba", alpha: 1 }, { pos: 0.5, color: "#b38728", alpha: 1 }, { pos: 0.75, color: "#fbf5b7", alpha: 1 }, { pos: 1, color: "#aa771c", alpha: 1 }] } },
  { name: "Sunset Pop", fill: { type: "linear", angle: 90, stops: [{ pos: 0, color: "#ff5f6d", alpha: 1 }, { pos: 1, color: "#ffc371", alpha: 1 }] } },
  { name: "Tosca", fill: { type: "linear", angle: 45, stops: [{ pos: 0, color: "#43cea2", alpha: 1 }, { pos: 1, color: "#185a9d", alpha: 1 }] } },
  { name: "Ungu Neon", fill: { type: "linear", angle: 45, stops: [{ pos: 0, color: "#7f00ff", alpha: 1 }, { pos: 1, color: "#e100ff", alpha: 1 }] } },
  { name: "Hitam Putih", fill: { type: "linear", angle: 90, stops: [{ pos: 0, color: "#000000", alpha: 1 }, { pos: 1, color: "#ffffff", alpha: 1 }] } },
];

export const SOLIDS = ["#ffffff", "#f7f3ee", "#efe6da", "#e8e8e8", "#1a1a1a", "#000000", "#2c3e50", "#7b5e57", "#c9a96e", "#9fb59a"];

type OvPreset = { name: string; make: (f: Format) => Omit<Overlay, "id"> };

const fade = (angle: number, color = "#000000", a = 0.75): Fill => ({
  type: "linear",
  angle,
  stops: [{ pos: 0, color, alpha: 0 }, { pos: 1, color, alpha: a }],
});

export const OVERLAY_PRESETS: OvPreset[] = [
  { name: "Fade bawah", make: (f) => { const { W, H } = docSize(f); return { x: 0, y: H * 0.55, w: W, h: H * 0.45, fill: fade(90), opacity: 1, radius: 0 }; } },
  { name: "Fade atas", make: (f) => { const { W, H } = docSize(f); return { x: 0, y: 0, w: W, h: H * 0.4, fill: fade(270), opacity: 1, radius: 0 }; } },
  { name: "Fade kiri", make: (f) => { const { W, H } = docSize(f); return { x: 0, y: 0, w: W * 0.5, h: H, fill: fade(180), opacity: 1, radius: 0 }; } },
  { name: "Fade kanan", make: (f) => { const { W, H } = docSize(f); return { x: W * 0.5, y: 0, w: W * 0.5, h: H, fill: fade(0), opacity: 1, radius: 0 }; } },
  { name: "Fade putih bawah", make: (f) => { const { W, H } = docSize(f); return { x: 0, y: H * 0.5, w: W, h: H * 0.5, fill: fade(90, "#ffffff", 0.95), opacity: 1, radius: 0 }; } },
  {
    name: "Vignette",
    make: (f) => {
      const { W, H } = docSize(f);
      return { x: 0, y: 0, w: W, h: H, fill: { type: "radial", angle: 0, stops: [{ pos: 0.45, color: "#000000", alpha: 0 }, { pos: 1, color: "#000000", alpha: 0.65 }] }, opacity: 1, radius: 0 };
    },
  },
  { name: "Tint senja", make: (f) => { const { W, H } = docSize(f); return { x: 0, y: 0, w: W, h: H, fill: GRADIENTS[0].fill, opacity: 0.35, radius: 0 }; } },
  {
    name: "Kotak caption",
    make: (f) => {
      const { W, H } = docSize(f);
      return { x: W * 0.08, y: H * 0.72, w: W * 0.5, h: H * 0.16, fill: { type: "solid", color: "#ffffff", alpha: 0.85 }, opacity: 1, radius: Math.min(W, H) * 0.01 };
    },
  },
];

type TextPreset = { name: string; sample: string; family: string[]; t: Partial<TextItem>; sizeRel: number };

export const TEXT_PRESETS: TextPreset[] = [
  { name: "Judul Elegan", sample: "Andi & Sari", family: ["Playfair Display", "Georgia"], sizeRel: 0.09, t: { weight: 400, italic: true, align: "center", letterSpacing: 0 } },
  { name: "Script", sample: "Forever Yours", family: ["Great Vibes", "Segoe Script", "Gabriola"], sizeRel: 0.1, t: { weight: 400, align: "center" } },
  { name: "Minimal Lebar", sample: "THE WEDDING DAY", family: ["Montserrat", "Bahnschrift", "Segoe UI"], sizeRel: 0.035, t: { weight: 300, uppercase: true, letterSpacing: 35, align: "center" } },
  { name: "Tanggal", sample: "12 · 10 · 2026", family: ["Cormorant Garamond", "Georgia"], sizeRel: 0.04, t: { weight: 400, letterSpacing: 15, align: "center" } },
  { name: "Caption", sample: "Hari yang kami tunggu, akhirnya tiba.", family: ["Segoe UI", "Arial"], sizeRel: 0.03, t: { weight: 400, align: "left", lineHeight: 1.35 } },
  { name: "Majalah Bold", sample: "VOGUE-STYLE", family: ["Bodoni MT", "Didot", "Times New Roman"], sizeRel: 0.14, t: { weight: 700, uppercase: true, letterSpacing: -2, align: "center", lineHeight: 0.95 } },
  { name: "Gradient Emas", sample: "Golden Moment", family: ["Cinzel", "Trajan Pro", "Georgia"], sizeRel: 0.07, t: { weight: 700, align: "center", fill: GRADIENTS[11].fill } },
  { name: "Story Outline", sample: "SAVE THE DATE", family: ["Impact", "Arial Black"], sizeRel: 0.07, t: { weight: 400, uppercase: true, align: "center", stroke: { on: true, color: "#000000", width: 6 } } },
];

export function makeText(f: Format, fonts: string[], p?: TextPreset): Omit<TextItem, "id"> {
  const { W, H } = docSize(f);
  const have = new Set(fonts.map((x) => x.toLowerCase()));
  const family = p?.family.find((x) => have.has(x.toLowerCase())) ?? (have.has("segoe ui") ? "Segoe UI" : fonts[0] ?? "Segoe UI");
  const base: Omit<TextItem, "id"> = {
    text: p?.sample ?? "Teks baru",
    x: W * 0.15,
    y: H * 0.42,
    w: W * 0.7,
    fontFamily: family,
    fontSize: Math.round(H * (p?.sizeRel ?? 0.05)),
    weight: 400,
    italic: false,
    align: "center",
    lineHeight: 1.2,
    letterSpacing: 0,
    uppercase: false,
    fill: { type: "solid", color: "#ffffff", alpha: 1 },
    stroke: { on: false, color: "#000000", width: Math.max(2, Math.round(H * 0.003)) },
    shadow: { on: true, color: "#000000", alpha: 0.35, blur: Math.round(H * 0.008), dx: 0, dy: Math.round(H * 0.002) },
    opacity: 1,
    rotation: 0,
  };
  return { ...base, ...p?.t, stroke: { ...base.stroke, ...p?.t.stroke } };
}

/* ---------- template teks: judul + isi (beberapa teks sekaligus, tersusun rapi) ---------- */

type ComboPart = { family: string[]; sample: string; sizeRel: number; t: Partial<TextItem> };
export type TextCombo = { name: string; align: "left" | "center"; parts: ComboPart[] };

const SERIF = ["Playfair Display", "Cormorant Garamond", "Georgia"];
const SANS = ["Montserrat", "Segoe UI", "Arial"];
const BODY = (sample: string, align: "left" | "center", sizeRel = 0.026): ComboPart => ({ family: ["Segoe UI", "Arial"], sample, sizeRel, t: { weight: 400, align, lineHeight: 1.45 } });

export const TEXT_COMBOS: TextCombo[] = [
  {
    name: "Judul + Isi",
    align: "center",
    parts: [
      { family: SERIF, sample: "Kisah Kita", sizeRel: 0.075, t: { weight: 400, italic: true, align: "center" } },
      BODY("Setiap foto menyimpan cerita.\nDan inilah awal dari cerita kami.", "center"),
    ],
  },
  {
    name: "Judul + Isi (kiri)",
    align: "left",
    parts: [
      { family: SANS, sample: "OUR STORY", sizeRel: 0.05, t: { weight: 700, uppercase: true, letterSpacing: 8, align: "left" } },
      BODY("Dua hati, satu tujuan. Hari ini kami memulai perjalanan baru bersama keluarga dan sahabat tercinta.", "left"),
    ],
  },
  {
    name: "Bab + Judul + Isi",
    align: "center",
    parts: [
      { family: SANS, sample: "BAB 01", sizeRel: 0.022, t: { weight: 500, uppercase: true, letterSpacing: 45, align: "center" } },
      { family: SERIF, sample: "Hari Bahagia", sizeRel: 0.08, t: { weight: 400, align: "center" } },
      BODY("Pagi yang cerah, senyum yang tak berhenti, dan pelukan hangat dari orang-orang tersayang.", "center"),
    ],
  },
  {
    name: "Script + Isi",
    align: "center",
    parts: [
      { family: ["Great Vibes", "Segoe Script", "Gabriola"], sample: "Love Story", sizeRel: 0.1, t: { weight: 400, align: "center" } },
      BODY("Cinta tidak saling menatap, tetapi bersama melihat ke arah yang sama.", "center"),
    ],
  },
  {
    name: "Tanggal + Judul + Isi",
    align: "center",
    parts: [
      { family: ["Cormorant Garamond", "Georgia"], sample: "12 · 10 · 2026", sizeRel: 0.032, t: { weight: 400, letterSpacing: 15, align: "center" } },
      { family: SANS, sample: "THE WEDDING DAY", sizeRel: 0.055, t: { weight: 300, uppercase: true, letterSpacing: 25, align: "center" } },
      BODY("Terima kasih telah menjadi bagian dari hari terindah kami.", "center"),
    ],
  },
  {
    name: "Kutipan + Nama",
    align: "center",
    parts: [
      { family: SERIF, sample: "“Rumah bukanlah tempat, melainkan orang-orang di dalamnya.”", sizeRel: 0.042, t: { weight: 400, italic: true, align: "center", lineHeight: 1.3 } },
      { family: SANS, sample: "— KELUARGA BESAR", sizeRel: 0.02, t: { weight: 500, uppercase: true, letterSpacing: 30, align: "center" } },
    ],
  },
];

/**
 * Buat teks-teks template judul + isi, ditumpuk vertikal dan berada di tengah halaman
 * (rata kiri: di sisi kiri halaman). `measure` = tinggi kotak teks (untuk menyusun jarak).
 */
export function makeCombo(f: Format, fonts: string[], c: TextCombo, measure: (t: Omit<TextItem, "id">) => number): Omit<TextItem, "id">[] {
  const { W, H } = docSize(f);
  const x = c.align === "left" ? W * 0.08 : W * 0.15;
  const w = c.align === "left" ? W * 0.5 : W * 0.7;
  const gap = H * 0.018;
  const items = c.parts.map((p) => ({ ...makeText(f, fonts, { name: "", sample: p.sample, family: p.family, sizeRel: p.sizeRel, t: p.t }), x, w }));
  const hs = items.map(measure);
  const total = hs.reduce((a, b) => a + b, 0) + gap * (items.length - 1);
  let y = (H - total) / 2;
  return items.map((t, i) => {
    const out = { ...t, y };
    y += hs[i] + gap;
    return out;
  });
}
