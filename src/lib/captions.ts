import type { Fill, Format, Overlay, Rect, TextItem } from "../types";
import { docSize } from "./formats";
import { GRADIENTS, makeText } from "./presets";

/*
 * Template caption = KOMPOSISI (susunan & isi teks) x TEMA (font, warna, bentuk kotak).
 * Tiap komposisi dipasangkan dengan 5 tema berbeda -> 125 template.
 * Semua bagian template diberi `group` yang sama supaya bergeser bersama di kanvas.
 */

export type CaptionCat = "Pernikahan" | "Caption" | "Kutipan" | "Judul" | "Majalah" | "Acara";
export const CAPTION_CATS: CaptionCat[] = ["Pernikahan", "Caption", "Kutipan", "Judul", "Majalah", "Acara"];

type Role = "kicker" | "title" | "big" | "script" | "sub" | "date" | "body" | "quote" | "sign" | "orn";
type Part = { role: Role; text: string; size?: number };
type Place = "center" | "top" | "bottom" | "left" | "right" | "top-left" | "bottom-left" | "bottom-right";
type Comp = { name: string; cat: CaptionCat; align: "left" | "center" | "right"; place: Place; w: number; parts: Part[] };

type Face = { family: string[]; weight: number; italic?: boolean; upper?: boolean; ls?: number };
type Theme = {
  name: string;
  title: Face;
  big: Face;
  script: Face;
  label: Face;
  body: Face;
  /** warna judul (boleh gradient), isi, aksen (label/tanggal/ornamen) */
  ink: { title: string | Fill; body: string; accent: string };
  /** kotak di belakang teks */
  box?: { color: string; alpha: number; radius: number };
  /** gelapkan foto di belakang teks */
  fade?: string;
  /** warna bayangan teks (tanpa kotak); default hitam */
  glow?: string;
};

/* ---------- font ---------- */

const SERIF = ["Playfair Display", "Cormorant Garamond", "Georgia"];
const GARAMOND = ["Cormorant Garamond", "Cormorant", "Garamond", "Georgia"];
const ROMAN = ["Cinzel", "Trajan Pro", "Georgia"];
const DIDONE = ["Bodoni MT", "Didot", "Playfair Display", "Times New Roman"];
const SCRIPT = ["Great Vibes", "Allura", "Alex Brush", "Segoe Script", "Gabriola"];
const SANS = ["Montserrat", "Poppins", "Segoe UI", "Arial"];
const ROUND = ["Poppins", "Nunito", "Segoe UI", "Arial"];
const CONDENSED = ["Bebas Neue", "Oswald", "Bahnschrift", "Impact"];
const BODY = ["Segoe UI", "Arial"];
const MONO = ["Courier Prime", "Courier New", "Consolas"];

const face = (family: string[], weight: number, x: Partial<Face> = {}): Face => ({ family, weight, ...x });

/* ---------- tema ---------- */

const THEMES: Theme[] = [
  {
    name: "Putih Klasik",
    title: face(SERIF, 400, { italic: true }),
    big: face(DIDONE, 700),
    script: face(SCRIPT, 400),
    label: face(SANS, 500, { upper: true, ls: 35 }),
    body: face(BODY, 400),
    ink: { title: "#ffffff", body: "#f4f1ec", accent: "#f3e2bd" },
  },
  {
    name: "Emas Mewah",
    title: face(ROMAN, 600),
    big: face(ROMAN, 700),
    script: face(SCRIPT, 400),
    label: face(SANS, 500, { upper: true, ls: 40 }),
    body: face(BODY, 400),
    ink: { title: GRADIENTS[11].fill, body: "#efe4cc", accent: "#d4b06a" },
    box: { color: "#15110b", alpha: 0.74, radius: 0.012 },
  },
  {
    name: "Kartu Krem",
    title: face(GARAMOND, 600),
    big: face(GARAMOND, 700),
    script: face(SCRIPT, 400),
    label: face(SANS, 500, { upper: true, ls: 30 }),
    body: face(GARAMOND, 500),
    ink: { title: "#4a3728", body: "#6b5646", accent: "#a07d4f" },
    box: { color: "#f7f1e6", alpha: 0.94, radius: 0.01 },
  },
  {
    name: "Minimal Hitam",
    title: face(SANS, 700, { upper: true, ls: 8 }),
    big: face(SANS, 800, { upper: true, ls: -2 }),
    script: face(SERIF, 400, { italic: true }),
    label: face(SANS, 500, { upper: true, ls: 45 }),
    body: face(SANS, 400),
    ink: { title: "#111111", body: "#3a3a3a", accent: "#111111" },
    box: { color: "#ffffff", alpha: 0.96, radius: 0 },
  },
  {
    name: "Romantis Blush",
    title: face(SCRIPT, 400),
    big: face(SERIF, 700, { italic: true }),
    script: face(SCRIPT, 400),
    label: face(SANS, 500, { upper: true, ls: 35 }),
    body: face(GARAMOND, 500, { italic: true }),
    ink: { title: "#8c4a5a", body: "#7a5a62", accent: "#c27b8a" },
    box: { color: "#fbeef0", alpha: 0.93, radius: 0.03 },
  },
  {
    name: "Sage Natural",
    title: face(SERIF, 400),
    big: face(SERIF, 700),
    script: face(SCRIPT, 400),
    label: face(SANS, 600, { upper: true, ls: 30 }),
    body: face(BODY, 400),
    ink: { title: "#2f4a3a", body: "#4d6355", accent: "#7c9a7e" },
    box: { color: "#eef2ea", alpha: 0.93, radius: 0.016 },
  },
  {
    name: "Malam Elegan",
    title: face(GARAMOND, 500, { italic: true }),
    big: face(DIDONE, 700),
    script: face(SCRIPT, 400),
    label: face(SANS, 400, { upper: true, ls: 50 }),
    body: face(BODY, 300),
    ink: { title: "#ffffff", body: "#e9e4da", accent: "#e3c58c" },
    fade: "#000000",
  },
  {
    name: "Majalah Bold",
    title: face(CONDENSED, 700, { upper: true, ls: 2 }),
    big: face(CONDENSED, 700, { upper: true, ls: 0 }),
    script: face(SCRIPT, 400),
    label: face(SANS, 800, { upper: true, ls: 20 }),
    body: face(SANS, 500),
    ink: { title: "#ffffff", body: "#ffffff", accent: "#ff3b3b" },
  },
  {
    name: "Navy Formal",
    title: face(ROMAN, 600),
    big: face(ROMAN, 700),
    script: face(SCRIPT, 400),
    label: face(SANS, 600, { upper: true, ls: 35 }),
    body: face(BODY, 400),
    ink: { title: "#1d2b4f", body: "#3b4866", accent: "#b08d57" },
    box: { color: "#ffffff", alpha: 0.95, radius: 0.004 },
  },
  {
    name: "Pastel Pop",
    title: face(ROUND, 700),
    big: face(ROUND, 800),
    script: face(SCRIPT, 400),
    label: face(ROUND, 700, { upper: true, ls: 20 }),
    body: face(ROUND, 400),
    ink: { title: "#2d2a32", body: "#4a4650", accent: "#ff6f61" },
    box: { color: "#fff3d1", alpha: 0.96, radius: 0.05 },
  },
  {
    name: "Vintage Ketik",
    title: face(MONO, 700),
    big: face(MONO, 700, { upper: true }),
    script: face(SCRIPT, 400),
    label: face(MONO, 400, { upper: true, ls: 25 }),
    body: face(MONO, 400),
    ink: { title: "#3b2f24", body: "#4e4034", accent: "#8b5e3c" },
    box: { color: "#efe3cc", alpha: 0.95, radius: 0 },
  },
  {
    name: "Neon Malam",
    title: face(SANS, 700, { upper: true, ls: 10 }),
    big: face(CONDENSED, 700, { upper: true }),
    script: face(SCRIPT, 400),
    label: face(SANS, 600, { upper: true, ls: 40 }),
    body: face(SANS, 400),
    ink: { title: "#ffffff", body: "#f5e9ff", accent: "#ff4fd8" },
    glow: "#ff2fcf",
    fade: "#12001f",
  },
  {
    name: "Terakota",
    title: face(SERIF, 700),
    big: face(SERIF, 800),
    script: face(SCRIPT, 400),
    label: face(SANS, 600, { upper: true, ls: 30 }),
    body: face(BODY, 400),
    ink: { title: "#7a3b26", body: "#5e3a2c", accent: "#c4683f" },
    box: { color: "#f4e4d4", alpha: 0.94, radius: 0.02 },
  },
  {
    name: "Kaca Gelap",
    title: face(SANS, 300, { ls: 4 }),
    big: face(SANS, 700, { upper: true }),
    script: face(SCRIPT, 400),
    label: face(SANS, 600, { upper: true, ls: 40 }),
    body: face(SANS, 300),
    ink: { title: "#ffffff", body: "#ececec", accent: "#ffd27a" },
    box: { color: "#000000", alpha: 0.42, radius: 0.02 },
  },
];

/* ---------- komposisi ---------- */

const COMPS: Comp[] = [
  { name: "Klasik Tengah", cat: "Pernikahan", align: "center", place: "center", w: 0.7, parts: [{ role: "kicker", text: "The Wedding of" }, { role: "script", text: "Andi & Sari" }, { role: "date", text: "12 · 10 · 2026" }] },
  { name: "Undangan", cat: "Pernikahan", align: "center", place: "center", w: 0.62, parts: [{ role: "kicker", text: "Bersama keluarga kami" }, { role: "title", text: "Raka & Dinda" }, { role: "orn", text: "— ✦ —" }, { role: "body", text: "Sabtu, 12 Oktober 2026\nGedung Serbaguna, Yogyakarta" }] },
  { name: "Save the Date", cat: "Acara", align: "center", place: "center", w: 0.75, parts: [{ role: "big", text: "Save the Date" }, { role: "date", text: "12 . 10 . 2026" }, { role: "body", text: "Simpan tanggalnya, kabar bahagia segera menyusul." }] },
  { name: "Caption Kiri Bawah", cat: "Caption", align: "left", place: "bottom-left", w: 0.5, parts: [{ role: "title", text: "Hari Bahagia" }, { role: "body", text: "Pagi yang cerah, senyum yang tak berhenti, dan pelukan hangat dari orang-orang tersayang." }] },
  { name: "Pita Bawah", cat: "Caption", align: "center", place: "bottom", w: 0.9, parts: [{ role: "sub", text: "Momen Akad Nikah" }, { role: "body", text: "Satu kalimat yang mengubah dua kehidupan menjadi satu." }] },
  { name: "Kutipan Tengah", cat: "Kutipan", align: "center", place: "center", w: 0.7, parts: [{ role: "quote", text: "“Rumah bukanlah tempat, melainkan orang-orang di dalamnya.”" }, { role: "sign", text: "Andi & Sari" }] },
  { name: "Kutipan Kiri", cat: "Kutipan", align: "left", place: "left", w: 0.48, parts: [{ role: "orn", text: "“", size: 3 }, { role: "quote", text: "Cinta tidak saling menatap, tetapi bersama melihat ke arah yang sama." }, { role: "kicker", text: "Antoine de Saint-Exupéry" }] },
  { name: "Bab Cerita", cat: "Judul", align: "center", place: "center", w: 0.66, parts: [{ role: "kicker", text: "Bab 01" }, { role: "title", text: "Awal Cerita" }, { role: "body", text: "Semua dimulai dari sapaan sederhana, lalu berubah menjadi cerita yang ingin kami ulang setiap hari." }] },
  { name: "Sampul Majalah", cat: "Majalah", align: "center", place: "top", w: 0.9, parts: [{ role: "big", text: "LOVE", size: 1.6 }, { role: "kicker", text: "Edisi Spesial · 2026" }] },
  { name: "Majalah Kiri", cat: "Majalah", align: "left", place: "left", w: 0.46, parts: [{ role: "kicker", text: "Cover Story" }, { role: "big", text: "Dua\nHati" }, { role: "body", text: "Kisah di balik senyum paling tulus tahun ini." }] },
  { name: "Headline Atas", cat: "Judul", align: "left", place: "top-left", w: 0.6, parts: [{ role: "title", text: "Pagi di Hari Itu" }, { role: "sub", text: "Persiapan sebelum akad" }] },
  { name: "Nama Bertumpuk", cat: "Pernikahan", align: "center", place: "center", w: 0.6, parts: [{ role: "script", text: "Sari" }, { role: "orn", text: "&", size: 1.6 }, { role: "script", text: "Andi" }, { role: "date", text: "12 Oktober 2026" }] },
  { name: "Terima Kasih", cat: "Acara", align: "center", place: "bottom", w: 0.7, parts: [{ role: "script", text: "Terima Kasih" }, { role: "body", text: "Atas doa dan kehadiran Bapak/Ibu/Saudara/i di hari bahagia kami." }] },
  { name: "Ulang Tahun", cat: "Acara", align: "center", place: "center", w: 0.7, parts: [{ role: "kicker", text: "Happy" }, { role: "big", text: "Birthday" }, { role: "script", text: "Alya ke-7", size: 0.8 }] },
  { name: "Wisuda", cat: "Acara", align: "center", place: "center", w: 0.66, parts: [{ role: "kicker", text: "Class of 2026" }, { role: "title", text: "Selamat Wisuda" }, { role: "sub", text: "Nadia Putri, S.Ds." }] },
  { name: "Lokasi & Tanggal", cat: "Caption", align: "right", place: "bottom-right", w: 0.42, parts: [{ role: "sub", text: "Yogyakarta" }, { role: "date", text: "12 Oktober 2026" }] },
  { name: "Jurnal", cat: "Caption", align: "left", place: "left", w: 0.44, parts: [{ role: "date", text: "12.10.26 — 07:30" }, { role: "title", text: "Catatan Pagi" }, { role: "body", text: "Kopi belum habis, tapi hati sudah penuh. Hari ini kami belajar bahwa bahagia itu sederhana: ada kamu, ada keluarga, ada tawa yang tak dibuat-buat." }] },
  { name: "Puisi", cat: "Kutipan", align: "center", place: "center", w: 0.62, parts: [{ role: "body", text: "Aku ingin mencintaimu dengan sederhana\ndengan kata yang tak sempat diucapkan\nkayu kepada api\nyang menjadikannya abu", size: 1.15 }, { role: "sign", text: "Sapardi Djoko Damono" }] },
  { name: "Doa", cat: "Kutipan", align: "center", place: "center", w: 0.66, parts: [{ role: "title", text: "Barakallahu lakuma" }, { role: "body", text: "Semoga Allah memberkahi kalian berdua dalam kebaikan dan mengumpulkan kalian dalam kebaikan." }, { role: "kicker", text: "Doa untuk pengantin" }] },
  { name: "Cerita Keluarga", cat: "Judul", align: "center", place: "bottom", w: 0.72, parts: [{ role: "kicker", text: "Keluarga" }, { role: "title", text: "Rumah Kami" }, { role: "body", text: "Tempat pulang paling hangat, sejauh apa pun kaki melangkah." }] },
  { name: "Prewedding", cat: "Pernikahan", align: "right", place: "right", w: 0.46, parts: [{ role: "script", text: "Prewedding" }, { role: "sub", text: "Andi & Sari" }, { role: "date", text: "Bromo · 2026" }] },
  { name: "Satu Baris", cat: "Caption", align: "center", place: "bottom", w: 0.8, parts: [{ role: "sub", text: "Momen yang tak akan terulang" }] },
  { name: "Susunan Acara", cat: "Acara", align: "center", place: "center", w: 0.56, parts: [{ role: "title", text: "Susunan Acara" }, { role: "orn", text: "— ✦ —" }, { role: "body", text: "08.00   Akad Nikah\n11.00   Resepsi\n14.00   Sesi Foto Keluarga", size: 1.1 }] },
  { name: "Hashtag", cat: "Caption", align: "left", place: "bottom-left", w: 0.56, parts: [{ role: "title", text: "#AndiSariBahagia", size: 0.8 }, { role: "body", text: "Bagikan momenmu bersama kami dengan tagar di atas." }] },
  { name: "Angka Besar", cat: "Majalah", align: "center", place: "center", w: 0.6, parts: [{ role: "big", text: "10", size: 2 }, { role: "kicker", text: "Tahun bersama" }, { role: "body", text: "Sepuluh tahun, ribuan cerita, satu rumah." }] },
];

/* ---------- ukuran dasar per peran (relatif sisi acuan halaman) ---------- */

const ROLE_SIZE: Record<Role, number> = { kicker: 0.02, title: 0.07, big: 0.12, script: 0.09, sub: 0.032, date: 0.024, body: 0.024, quote: 0.042, sign: 0.045, orn: 0.03 };

export type Caption = { id: string; name: string; cat: CaptionCat; comp: Comp; theme: Theme };

export const CAPTIONS: Caption[] = COMPS.flatMap((comp, i) =>
  [0, 1, 2, 3, 4].map((k) => {
    const theme = THEMES[(i * 5 + k * 3) % THEMES.length];
    return { id: `${i}-${k}`, name: `${comp.name} · ${theme.name}`, cat: comp.cat, comp, theme };
  }),
);

const solid = (color: string): Fill => ({ type: "solid", color, alpha: 1 });

/** Gaya teks satu bagian template menurut perannya dan tema. */
function partStyle(p: Part, th: Theme): { face: Face; size: number; fill: Fill; lh: number } {
  const size = ROLE_SIZE[p.role] * (p.size ?? 1);
  const title = typeof th.ink.title === "string" ? solid(th.ink.title) : th.ink.title;
  switch (p.role) {
    case "kicker":
      return { face: th.label, size, fill: solid(th.ink.accent), lh: 1.3 };
    case "date":
      return { face: { ...th.label, upper: false, ls: Math.max(15, th.label.ls ?? 0) }, size, fill: solid(th.ink.accent), lh: 1.3 };
    case "sub":
      return { face: { ...th.label, ls: Math.min(25, th.label.ls ?? 0) }, size, fill: title, lh: 1.25 };
    case "title":
      return { face: th.title, size, fill: title, lh: 1.1 };
    case "big":
      return { face: th.big, size, fill: title, lh: 0.95 };
    case "script":
      return { face: th.script, size, fill: title, lh: 1.15 };
    case "quote":
      return { face: { ...th.title, italic: true, upper: false, ls: 0 }, size, fill: title, lh: 1.3 };
    case "sign":
      return { face: th.script, size, fill: solid(th.ink.accent), lh: 1.2 };
    case "orn":
      return { face: { ...th.title, upper: false, italic: false, ls: 0 }, size, fill: solid(th.ink.accent), lh: 1 };
    default:
      return { face: th.body, size, fill: solid(th.ink.body), lh: 1.5 };
  }
}

/** Area tempat template diletakkan: slide pertama untuk carousel/puzzle, selain itu area potong. */
function area(f: Format): Rect {
  const b = f.bleed;
  if (f.kind === "carousel" || f.kind === "puzzle") return { x: b, y: b, w: f.pageW, h: f.pageH };
  const { TW, TH } = docSize(f);
  return { x: b, y: b, w: TW, h: TH };
}

/**
 * Susun template menjadi teks (+ kotak/fade bila temanya memakai) di halaman.
 * `measure` = tinggi kotak teks, untuk menumpuk bagian-bagian dengan rapi.
 */
export function makeCaption(
  f: Format,
  fonts: string[],
  cap: Caption,
  group: string,
  measure: (t: Omit<TextItem, "id">) => number,
): { texts: Omit<TextItem, "id">[]; overlays: Omit<Overlay, "id">[] } {
  const { comp, theme: th } = cap;
  const A = area(f);
  const base = Math.min(A.h, A.w * 1.25);
  const w = Math.min(A.w, A.h * 1.25) * comp.w;
  const pad = th.box ? base * 0.04 : 0;
  const m = base * 0.06;
  const shadowOn = !th.box;

  const texts = comp.parts.map((p) => {
    const st = partStyle(p, th);
    const t = makeText(f, fonts, { name: "", sample: p.text, family: st.face.family, sizeRel: 0, t: {} });
    return {
      ...t,
      w,
      fontSize: Math.max(4, Math.round(base * st.size)),
      weight: st.face.weight,
      italic: !!st.face.italic,
      uppercase: !!st.face.upper,
      letterSpacing: st.face.ls ?? 0,
      lineHeight: st.lh,
      align: comp.align,
      fill: st.fill,
      shadow: shadowOn
        ? { ...t.shadow, on: true, color: th.glow ?? "#000000", alpha: th.glow ? 0.85 : 0.4, blur: Math.round(base * (th.glow ? 0.02 : 0.01)) }
        : { ...t.shadow, on: false },
      group,
    };
  });

  const hs = texts.map(measure);
  const gaps = comp.parts.slice(1).map((p, i) => base * (p.role === "body" || comp.parts[i].role === "body" ? 0.022 : 0.012));
  const th0 = hs.reduce((a, b) => a + b, 0) + gaps.reduce((a, b) => a + b, 0);
  const bw = w + pad * 2;
  const bh = th0 + pad * 2;

  // pita: kotak selebar halaman untuk teks lebar di atas/bawah
  const band = !!th.box && (comp.place === "bottom" || comp.place === "top") && comp.w >= 0.85;
  const bx = comp.place.includes("left") ? A.x + m : comp.place.includes("right") ? A.x + A.w - m - bw : A.x + (A.w - bw) / 2;
  const by =
    comp.place === "top" || comp.place === "top-left"
      ? A.y + m
      : comp.place.startsWith("bottom")
        ? A.y + A.h - m - bh
        : A.y + (A.h - bh) / 2;

  let y = by + pad;
  const placed = texts.map((t, i) => {
    const out = { ...t, x: bx + pad, y };
    y += hs[i] + (gaps[i] ?? 0);
    return out;
  });

  const overlays: Omit<Overlay, "id">[] = [];
  if (th.fade) {
    const c = th.fade;
    const top = comp.place === "top" || comp.place === "top-left";
    const bottom = comp.place.startsWith("bottom");
    if (top || bottom) {
      const h = Math.min(A.h, bh + m * 4);
      overlays.push({
        x: A.x,
        y: top ? A.y : A.y + A.h - h,
        w: A.w,
        h,
        fill: { type: "linear", angle: top ? 270 : 90, stops: [{ pos: 0, color: c, alpha: 0 }, { pos: 1, color: c, alpha: 0.72 }] },
        opacity: 1,
        radius: 0,
        group,
      });
    } else {
      overlays.push({
        x: bx - m,
        y: by - m,
        w: bw + m * 2,
        h: bh + m * 2,
        fill: { type: "radial", angle: 0, stops: [{ pos: 0, color: c, alpha: 0.55 }, { pos: 1, color: c, alpha: 0 }] },
        opacity: 1,
        radius: 0,
        group,
      });
    }
  }
  if (th.box) {
    const r = band ? { x: A.x, y: by - (comp.place === "top" ? m : 0), w: A.w, h: bh + m } : { x: bx, y: by, w: bw, h: bh };
    overlays.push({ ...r, fill: { type: "solid", color: th.box.color, alpha: th.box.alpha }, opacity: 1, radius: band ? 0 : base * th.box.radius, group });
  }
  return { texts: placed, overlays };
}
