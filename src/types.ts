import type { FrameStyle } from "./lib/frames";

export interface Stop {
  pos: number; // 0..1
  color: string; // #rrggbb
  alpha: number; // 0..1
}

export type Fill =
  | { type: "solid"; color: string; alpha: number }
  | { type: "linear" | "radial"; angle: number; stops: Stop[] };

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Sel foto. x/y/w/h dinormalisasi 0..1 terhadap area isi (setelah margin). */
export interface Cell extends Rect {
  photoId: string | null;
  zoom: number; // >= 1
  ox: number; // -1..1 geser horizontal
  oy: number; // -1..1 geser vertikal
  /** rotasi foto dalam sel (derajat) untuk meluruskan foto miring */
  rot?: number;
  /** bingkai khusus sel ini: undefined = ikut halaman, null = tanpa bingkai */
  frame?: FrameStyle | null;
}

export interface Shadow {
  on: boolean;
  color: string;
  alpha: number;
  blur: number;
  dx: number;
  dy: number;
}

export interface Stroke {
  on: boolean;
  color: string;
  width: number;
}

/** Teks: posisi & ukuran dalam satuan dokumen (piksel output, termasuk bleed). */
export interface TextItem {
  id: string;
  text: string;
  x: number;
  y: number;
  w: number;
  fontFamily: string;
  fontSize: number;
  weight: number;
  italic: boolean;
  align: "left" | "center" | "right";
  lineHeight: number;
  letterSpacing: number; // em * 100 (mis. 10 = 0.1em)
  uppercase: boolean;
  fill: Fill;
  stroke: Stroke;
  shadow: Shadow;
  opacity: number;
  rotation: number;
}

export interface Overlay {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  fill: Fill;
  opacity: number;
  radius: number;
  /** rotasi overlay (derajat) di sekitar titik tengahnya */
  rotation?: number;
}

/** Foto sebagai background halaman (menutup seluruh halaman, di bawah semua foto). */
export interface BgPhoto {
  photoId: string;
  opacity: number;
  /** 0..1 relatif sisi pendek halaman */
  blur: number;
}

export interface Page {
  id: string;
  layoutId: string | null;
  cells: Cell[];
  texts: TextItem[];
  overlays: Overlay[];
  bg: Fill;
  bgPhoto?: BgPhoto | null;
  gutter: number;
  margin: number;
  radius: number;
  /** bingkai untuk semua foto di halaman */
  cellFrame?: FrameStyle | null;
  /** bingkai tepi halaman */
  pageFrame?: FrameStyle | null;
}

export type FormatKind = "album" | "magazine" | "story" | "feed" | "carousel" | "puzzle";

export interface Format {
  kind: FormatKind;
  label: string;
  /** ukuran SATU halaman dalam piksel dokumen */
  pageW: number;
  pageH: number;
  spread: boolean;
  bleed: number;
  dpi: number;
  isPrint: boolean;
  /** pengali resolusi saat export (sosmed) */
  exportScale: number;
  /** jumlah panel mendatar/menurun (carousel = slide, puzzle = 3 kolom x N baris) */
  cols?: number;
  rows?: number;
  wCm?: number;
  hCm?: number;
}

export interface Photo {
  id: string;
  path: string;
  name: string;
  width: number;
  height: number;
  thumb: string;
  taken: number;
  /** kotak wajah 0..1 terhadap foto */
  faces?: Rect[];
}

export type WmPos = "tl" | "tc" | "tr" | "ml" | "mc" | "mr" | "bl" | "bc" | "br";

/** Watermark global: berlaku di semua halaman (tiap slide/post untuk carousel & puzzle). */
export interface Watermark {
  on: boolean;
  mode: "text" | "image";
  text: string;
  fontFamily: string;
  weight: number;
  color: string;
  imagePath: string | null;
  /** lebar watermark relatif sisi pendek halaman (0..1) */
  size: number;
  opacity: number;
  rotation: number;
  pos: WmPos;
  /** ulang memenuhi halaman (pola) */
  tile: boolean;
  /** jarak antar ulangan relatif ukuran watermark */
  gap: number;
  /** jarak dari tepi relatif sisi pendek halaman */
  margin: number;
  shadow: boolean;
  /** "all" = semua halaman, "pick" = hanya halaman di `pages` */
  scope?: "all" | "pick";
  /** id halaman yang diberi watermark (scope "pick") */
  pages?: string[];
}

export interface Project {
  version: 1;
  name: string;
  format: Format;
  pages: Page[];
  watermark?: Watermark;
}

export interface Layout {
  id: string;
  kind: "grid" | "magazine" | "spread" | "spread-mag" | "split" | "custom";
  cells: Rect[];
  blanks: Rect[];
}

export interface FontFamily {
  name: string;
  weights: number[];
  italic: boolean;
  source: "system" | "adobe";
}

export type Selection =
  | { kind: "cell"; index: number }
  | { kind: "text"; id: string }
  | { kind: "overlay"; id: string }
  | null;
