/**
 * Generator bingkai vektor: garis x ornamen sudut, pola tepi x ornamen sudut, dan bingkai spesial,
 * masing-masing dengan variasi ketebalan & ukuran ornamen (±1.100 bingkai).
 * Semua digambar sebagai vektor kanvas sehingga tetap tajam saat export 300 dpi, dan warnanya bebas.
 */
import type { Fill, Rect } from "../types";

export type LineKind = "none" | "single" | "double" | "triple" | "thinThick" | "thickThin" | "dashed" | "dotted" | "dashDot" | "ridge";
export type CornerKind = "none" | "lcorner" | "bracket" | "deco" | "circle" | "diamond" | "star" | "flourish" | "fan" | "heart";
export type PatternKind = "none" | "beads" | "scallop" | "zigzag" | "wave" | "rope" | "battlement" | "chevron" | "stitch" | "sprocket" | "lace";
export type SpecialKind = "none" | "mat" | "polaroid" | "rounded" | "roundedDouble";
export type FrameCategory = "garis" | "sudut" | "pola" | "spesial";

export interface FrameRecipe {
  id: string;
  name: string;
  category: FrameCategory;
  line: LineKind;
  corner: CornerKind;
  pattern: PatternKind;
  special: SpecialKind;
  /** pengali ketebalan dasar */
  weight: number;
  /** pengali ukuran ornamen sudut */
  cornerScale: number;
}

export interface FrameStyle extends FrameRecipe {
  /** ketebalan dasar (piksel dokumen) */
  width: number;
  /** jarak bingkai dari tepi foto/halaman (piksel dokumen) */
  inset: number;
  fill: Fill;
  opacity: number;
  /** khusus bingkai halaman pada spread: satu bingkai melingkupi kedua halaman */
  whole?: boolean;
  /** pojok yang diberi ornamen [kiri-atas, kanan-atas, kiri-bawah, kanan-bawah]; default semua */
  corners?: [boolean, boolean, boolean, boolean];
}

export const ALL_CORNERS: [boolean, boolean, boolean, boolean] = [true, true, true, true];

const LINES: LineKind[] = ["single", "double", "triple", "thinThick", "thickThin", "dashed", "dotted", "dashDot", "ridge"];
const CORNERS: CornerKind[] = ["none", "lcorner", "bracket", "deco", "circle", "diamond", "star", "flourish", "fan", "heart"];
const PATTERNS: PatternKind[] = ["beads", "scallop", "zigzag", "wave", "rope", "battlement", "chevron", "stitch", "sprocket", "lace"];
const SPECIALS: SpecialKind[] = ["mat", "polaroid", "rounded", "roundedDouble"];

const LABEL: Record<string, string> = {
  single: "Garis tunggal", double: "Garis ganda", triple: "Garis tiga", thinThick: "Tipis-tebal", thickThin: "Tebal-tipis",
  dashed: "Putus-putus", dotted: "Titik", dashDot: "Garis titik", ridge: "Garis renggang",
  lcorner: "sudut L", bracket: "sudut bracket", deco: "sudut deco", circle: "sudut bulat", diamond: "sudut wajik",
  star: "sudut bintang", flourish: "sudut flourish", fan: "kipas deco", heart: "sudut hati",
  beads: "Manik", scallop: "Scallop", zigzag: "Zigzag", wave: "Gelombang", rope: "Tali", battlement: "Kastil",
  chevron: "Chevron", stitch: "Jahitan", sprocket: "Film strip", lace: "Renda",
  mat: "Passe-partout", polaroid: "Polaroid", rounded: "Bulat", roundedDouble: "Bulat ganda",
};
const WEIGHTS: [number, string][] = [[0.6, "tipis"], [1, "sedang"], [1.7, "tebal"]];
const CSCALES: [number, string][] = [[1, ""], [1.6, ", ornamen besar"]];

let cache: FrameRecipe[] | null = null;

/**
 * Urutan tampilan "Semua": bentuk unik (ketebalan sedang) dicampur antar kategori dulu
 * supaya variasi langsung terlihat, baru varian ketebalan/ukuran ornamen.
 */
let mixedCache: FrameRecipe[] | null = null;
export function mixedFrames(): FrameRecipe[] {
  if (mixedCache) return mixedCache;
  const all = allFrames();
  const primary = all.filter((r) => r.weight === 1 && r.cornerScale === 1);
  const rest = all.filter((r) => !(r.weight === 1 && r.cornerScale === 1));
  const groups: Record<string, FrameRecipe[]> = {};
  for (const r of primary) (groups[r.category] ??= []).push(r);
  // dalam kategori besar, selang-seling bentuk dasar agar tidak berderet sama
  const spread = (l: FrameRecipe[]) => {
    const by: Record<string, FrameRecipe[]> = {};
    for (const r of l) (by[r.corner] ??= []).push(r);
    const keys = Object.keys(by);
    const out: FrameRecipe[] = [];
    for (let i = 0; out.length < l.length; i++) for (const k of keys) if (by[k][i]) out.push(by[k][i]);
    return out;
  };
  const order = ["sudut", "pola", "garis", "spesial"].map((k) => spread(groups[k] ?? []));
  const mixed: FrameRecipe[] = [];
  for (let i = 0; mixed.length < primary.length; i++) for (const g of order) if (g[i]) mixed.push(g[i]);
  mixedCache = [...mixed, ...rest];
  return mixedCache;
}

export function allFrames(): FrameRecipe[] {
  if (cache) return cache;
  const out: FrameRecipe[] = [];
  const add = (category: FrameCategory, line: LineKind, corner: CornerKind, pattern: PatternKind, special: SpecialKind) => {
    const base = special !== "none" ? LABEL[special] : pattern !== "none" ? LABEL[pattern] : line !== "none" ? LABEL[line] : "Ornamen";
    const name = corner !== "none" ? `${base} + ${LABEL[corner]}` : base;
    const scales = corner === "none" ? [CSCALES[0]] : CSCALES;
    for (const [weight, wl] of WEIGHTS)
      for (const [cornerScale, cl] of scales)
        out.push({ id: [line, corner, pattern, special, weight, cornerScale].join("|"), name: `${name}, ${wl}${cl}`, category, line, corner, pattern, special, weight, cornerScale });
  };
  for (const l of LINES) add("garis", l, "none", "none", "none");
  for (const c of CORNERS.slice(1)) add("sudut", "none", c, "none", "none");
  for (const l of LINES) for (const c of CORNERS.slice(1)) add("sudut", l, c, "none", "none");
  for (const p of PATTERNS) for (const c of CORNERS) add("pola", "none", c, p, "none");
  for (const s of SPECIALS) add("spesial", "none", "none", "none", s);
  cache = out;
  return out;
}

export const GOLD: Fill = {
  type: "linear",
  angle: 35,
  stops: [
    { pos: 0, color: "#a8792a", alpha: 1 },
    { pos: 0.22, color: "#f6e3a1", alpha: 1 },
    { pos: 0.45, color: "#c99a3e", alpha: 1 },
    { pos: 0.7, color: "#f3dc93", alpha: 1 },
    { pos: 1, color: "#9c6f22", alpha: 1 },
  ],
};

export const FRAME_COLORS: { name: string; fill: Fill }[] = [
  { name: "Emas", fill: GOLD },
  { name: "Emas lembut", fill: { type: "solid", color: "#c9a96e", alpha: 1 } },
  { name: "Rose gold", fill: { type: "linear", angle: 35, stops: [{ pos: 0, color: "#b5727c", alpha: 1 }, { pos: 0.45, color: "#f1d0c2", alpha: 1 }, { pos: 1, color: "#a85f6b", alpha: 1 }] } },
  { name: "Perak", fill: { type: "linear", angle: 35, stops: [{ pos: 0, color: "#8a959e", alpha: 1 }, { pos: 0.45, color: "#f1f4f6", alpha: 1 }, { pos: 1, color: "#7d8891", alpha: 1 }] } },
  { name: "Putih", fill: { type: "solid", color: "#ffffff", alpha: 1 } },
  { name: "Hitam", fill: { type: "solid", color: "#141414", alpha: 1 } },
  { name: "Krem", fill: { type: "solid", color: "#efe6da", alpha: 1 } },
  { name: "Champagne", fill: { type: "solid", color: "#e3d3b0", alpha: 1 } },
  { name: "Burgundy", fill: { type: "solid", color: "#6d1f2b", alpha: 1 } },
  { name: "Sage", fill: { type: "solid", color: "#8a9a76", alpha: 1 } },
  { name: "Navy", fill: { type: "solid", color: "#243b55", alpha: 1 } },
];

/* ---------------- menggambar ---------------- */

type Ctx = CanvasRenderingContext2D;

function strokeRect(ctx: Ctx, r: Rect, inset: number, lw: number, dash: number[] = [], cap: CanvasLineCap = "butt") {
  const k = inset + lw / 2;
  if (r.w - 2 * k <= 0 || r.h - 2 * k <= 0) return;
  ctx.lineWidth = lw;
  ctx.setLineDash(dash);
  ctx.lineCap = cap;
  ctx.strokeRect(r.x + k, r.y + k, r.w - 2 * k, r.h - 2 * k);
  ctx.setLineDash([]);
}

function drawLine(ctx: Ctx, r: Rect, w: number, kind: LineKind) {
  switch (kind) {
    case "single": return strokeRect(ctx, r, 0, w);
    case "double": strokeRect(ctx, r, 0, w * 0.4); return strokeRect(ctx, r, w * 0.95, w * 0.4);
    case "triple": strokeRect(ctx, r, 0, w * 0.3); strokeRect(ctx, r, w * 0.7, w * 0.3); return strokeRect(ctx, r, w * 1.4, w * 0.3);
    case "thinThick": strokeRect(ctx, r, 0, w * 0.25); return strokeRect(ctx, r, w * 0.65, w * 0.75);
    case "thickThin": strokeRect(ctx, r, 0, w * 0.75); return strokeRect(ctx, r, w * 1.15, w * 0.25);
    case "dashed": return strokeRect(ctx, r, 0, w, [w * 3, w * 2]);
    case "dotted": return strokeRect(ctx, r, 0, w, [0.001, w * 2], "round");
    case "dashDot": return strokeRect(ctx, r, 0, w * 0.8, [w * 3, w * 1.6, 0.001, w * 1.6], "round");
    case "ridge": strokeRect(ctx, r, 0, w * 0.3); return strokeRect(ctx, r, w * 2.2, w * 0.3);
  }
}

/** Ornamen di satu sudut: koordinat lokal, sudut di (0,0), bingkai ke arah +x dan +y. */
function corner(ctx: Ctx, kind: CornerKind, s: number, w: number) {
  const d = w * 1.6;
  ctx.lineWidth = Math.max(w * 0.6, 0.5);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const L = (o: number, len: number) => {
    ctx.beginPath();
    ctx.moveTo(o, o + len);
    ctx.lineTo(o, o);
    ctx.lineTo(o + len, o);
    ctx.stroke();
  };
  switch (kind) {
    case "lcorner":
      ctx.lineWidth = w * 1.2;
      ctx.lineCap = "butt";
      return L(d, s);
    case "bracket":
      L(d, s);
      return L(d + w * 1.8, s * 0.55);
    case "deco": {
      const q = s / 3;
      ctx.beginPath();
      ctx.moveTo(d, d + s);
      ctx.lineTo(d, d + q);
      ctx.lineTo(d + q * 0.5, d + q);
      ctx.lineTo(d + q * 0.5, d + q * 0.5);
      ctx.lineTo(d + q, d + q * 0.5);
      ctx.lineTo(d + q, d);
      ctx.lineTo(d + s, d);
      ctx.stroke();
      return L(d + q * 1.4, s * 0.35);
    }
    case "circle": {
      L(d, s * 0.8);
      ctx.beginPath();
      ctx.arc(d + s * 0.22, d + s * 0.22, s * 0.11, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(d + s * 0.22, d + s * 0.22, s * 0.19, 0, Math.PI * 2);
      return ctx.stroke();
    }
    case "diamond": {
      L(d, s);
      const c = d + s * 0.24;
      const h = s * 0.14;
      ctx.beginPath();
      ctx.moveTo(c, c - h);
      ctx.lineTo(c + h, c);
      ctx.lineTo(c, c + h);
      ctx.lineTo(c - h, c);
      ctx.closePath();
      return ctx.fill();
    }
    case "star": {
      const c = d + s * 0.24;
      const R = s * 0.22;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4 - Math.PI / 2;
        const rr = i % 2 ? R * 0.28 : R;
        ctx.lineTo(c + Math.cos(a) * rr, c + Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(c + R * 1.2, d);
      ctx.lineTo(d + s, d);
      ctx.moveTo(d, c + R * 1.2);
      ctx.lineTo(d, d + s);
      return ctx.stroke();
    }
    case "flourish": {
      // lengkung membulat + dua daun + titik, seperti ornamen undangan
      ctx.beginPath();
      ctx.moveTo(d + s, d);
      ctx.bezierCurveTo(d + s * 0.35, d, d, d + s * 0.05, d, d + s * 0.35);
      ctx.lineTo(d, d + s);
      ctx.stroke();
      const leaf = (x: number, y: number, a: number) => {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(a);
        ctx.beginPath();
        ctx.ellipse(0, 0, s * 0.16, s * 0.06, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      };
      leaf(d + s * 0.42, d + s * 0.2, -0.35);
      leaf(d + s * 0.2, d + s * 0.42, -1.22);
      ctx.beginPath();
      ctx.arc(d + s * 0.24, d + s * 0.24, s * 0.05, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(d + s * 0.82, d + s * 0.09, s * 0.06, Math.PI, Math.PI * 2.4);
      return ctx.stroke();
    }
    case "fan": {
      const R = s * 0.62;
      for (let i = 0; i <= 5; i++) {
        const a = (i / 5) * (Math.PI / 2);
        ctx.beginPath();
        ctx.moveTo(d, d);
        ctx.lineTo(d + Math.cos(a) * R, d + Math.sin(a) * R);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(d, d, R, 0, Math.PI / 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(d, d, R * 0.45, 0, Math.PI / 2);
      return ctx.stroke();
    }
    case "heart": {
      L(d, s);
      const c = d + s * 0.26;
      const h = s * 0.2;
      ctx.beginPath();
      ctx.moveTo(c, c + h * 0.75);
      ctx.bezierCurveTo(c - h * 1.1, c, c - h * 0.55, c - h * 0.85, c, c - h * 0.3);
      ctx.bezierCurveTo(c + h * 0.55, c - h * 0.85, c + h * 1.1, c, c, c + h * 0.75);
      return ctx.fill();
    }
  }
}

function drawCorners(ctx: Ctx, r: Rect, w: number, kind: CornerKind, scale: number, mask = ALL_CORNERS) {
  const s = Math.min(Math.max(w * 6, Math.min(r.w, r.h) * 0.075) * scale, Math.min(r.w, r.h) * 0.42);
  const spots: [number, number, number, number][] = [
    [r.x, r.y, 1, 1],
    [r.x + r.w, r.y, -1, 1],
    [r.x, r.y + r.h, 1, -1],
    [r.x + r.w, r.y + r.h, -1, -1],
  ];
  for (const [i, [x, y, sx, sy]] of spots.entries()) {
    if (!mask[i]) continue;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(sx, sy);
    corner(ctx, kind, s, w);
    ctx.restore();
  }
}

/** Panggil fn untuk tiap posisi di sepanjang 4 sisi; koordinat lokal: x sejajar tepi, +y ke dalam. */
function alongEdges(ctx: Ctx, r: Rect, spacing: number, fn: (step: number) => void, skipCorners = 0) {
  const sides: [number, number, number, number][] = [
    [r.x, r.y, 0, r.w],
    [r.x + r.w, r.y, Math.PI / 2, r.h],
    [r.x + r.w, r.y + r.h, Math.PI, r.w],
    [r.x, r.y + r.h, -Math.PI / 2, r.h],
  ];
  for (const [ox, oy, a, len] of sides) {
    const usable = len - 2 * skipCorners;
    const n = Math.max(1, Math.round(usable / spacing));
    const step = usable / n;
    for (let i = 0; i < n; i++) {
      ctx.save();
      ctx.translate(ox, oy);
      ctx.rotate(a);
      ctx.translate(skipCorners + step * (i + 0.5), 0);
      fn(step);
      ctx.restore();
    }
  }
}

function drawPattern(ctx: Ctx, r: Rect, w: number, kind: PatternKind) {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  switch (kind) {
    case "beads":
      return alongEdges(ctx, r, w * 1.7, () => {
        ctx.beginPath();
        ctx.arc(0, w * 0.75, w * 0.55, 0, Math.PI * 2);
        ctx.fill();
      });
    case "scallop":
    case "lace":
      alongEdges(ctx, r, w * 3, (st) => {
        ctx.lineWidth = w * 0.45;
        ctx.beginPath();
        ctx.arc(0, 0, st / 2, 0, Math.PI);
        ctx.stroke();
        if (kind === "lace") {
          ctx.beginPath();
          ctx.arc(0, st * 0.24, w * 0.28, 0, Math.PI * 2);
          ctx.fill();
        }
      });
      if (kind === "lace") strokeRect(ctx, r, 0, w * 0.3);
      return;
    case "zigzag":
      return alongEdges(ctx, r, w * 2.6, (st) => {
        ctx.lineWidth = w * 0.45;
        ctx.beginPath();
        ctx.moveTo(-st / 2, w * 0.3);
        ctx.lineTo(0, w * 1.5);
        ctx.lineTo(st / 2, w * 0.3);
        ctx.stroke();
      });
    case "wave":
      return alongEdges(ctx, r, w * 4, (st) => {
        ctx.lineWidth = w * 0.45;
        ctx.beginPath();
        for (let k = 0; k <= 12; k++) {
          const x = -st / 2 + (st * k) / 12;
          const y = w * 0.9 + w * 0.6 * Math.sin((k / 12) * Math.PI * 2);
          if (k) ctx.lineTo(x, y);
          else ctx.moveTo(x, y);
        }
        ctx.stroke();
      });
    case "rope":
      return alongEdges(ctx, r, w * 1.4, (st) => {
        ctx.lineWidth = w * 0.3;
        ctx.beginPath();
        ctx.ellipse(0, w * 0.8, st * 0.62, w * 0.45, -0.55, 0, Math.PI * 2);
        ctx.stroke();
      });
    case "battlement":
      return alongEdges(ctx, r, w * 3, (st) => {
        ctx.lineWidth = w * 0.4;
        const h = w * 1.4;
        ctx.beginPath();
        ctx.moveTo(-st / 2, h);
        ctx.lineTo(-st / 2, w * 0.2);
        ctx.lineTo(0, w * 0.2);
        ctx.lineTo(0, h);
        ctx.lineTo(st / 2, h);
        ctx.stroke();
      });
    case "chevron":
      return alongEdges(ctx, r, w * 2.4, (st) => {
        ctx.lineWidth = w * 0.4;
        ctx.beginPath();
        ctx.moveTo(-st * 0.3, w * 0.4);
        ctx.lineTo(0, w * 1.4);
        ctx.lineTo(st * 0.3, w * 0.4);
        ctx.stroke();
      });
    case "stitch":
      return alongEdges(ctx, r, w * 2.2, (st) => {
        ctx.lineWidth = w * 0.35;
        ctx.beginPath();
        ctx.moveTo(-st * 0.25, w * 1.2);
        ctx.lineTo(st * 0.25, w * 1.2);
        ctx.stroke();
      });
    case "sprocket": {
      // pita film: cincin tebal dengan lubang perforasi (evenodd)
      const b = w * 3.2;
      const p = new Path2D();
      p.rect(r.x, r.y, r.w, r.h);
      p.rect(r.x + b, r.y + b, r.w - 2 * b, r.h - 2 * b);
      const hw = b * 0.42;
      const hh = b * 0.5;
      const gap = b * 1.25;
      const holes = (x0: number, y0: number, len: number, horiz: boolean) => {
        const n = Math.max(1, Math.floor((len - 2 * b) / gap));
        const st = (len - 2 * b) / n;
        for (let i = 0; i < n; i++) {
          const c = b + st * (i + 0.5);
          if (horiz) p.roundRect(x0 + c - hw / 2, y0 + (b - hh) / 2, hw, hh, hw * 0.25);
          else p.roundRect(x0 + (b - hh) / 2, y0 + c - hw / 2, hh, hw, hw * 0.25);
        }
      };
      holes(r.x, r.y, r.w, true);
      holes(r.x, r.y + r.h - b, r.w, true);
      holes(r.x, r.y, r.h, false);
      holes(r.x + r.w - b, r.y, r.h, false);
      return ctx.fill(p, "evenodd");
    }
  }
}

function drawSpecial(ctx: Ctx, r: Rect, w: number, kind: SpecialKind) {
  const ring = (t: number, bottom = t) => {
    const p = new Path2D();
    p.rect(r.x, r.y, r.w, r.h);
    p.rect(r.x + t, r.y + t, r.w - 2 * t, r.h - t - bottom);
    ctx.fill(p, "evenodd");
  };
  const rad = Math.min(r.w, r.h) * 0.06;
  switch (kind) {
    case "mat":
      ring(w * 3.4);
      return strokeRect(ctx, r, w * 3.4 + w * 0.6, w * 0.25);
    case "polaroid":
      return ring(w * 3, Math.min(w * 10, r.h * 0.22));
    case "rounded":
    case "roundedDouble": {
      const rr = (inset: number, lw: number) => {
        ctx.lineWidth = lw;
        ctx.beginPath();
        ctx.roundRect(r.x + inset + lw / 2, r.y + inset + lw / 2, r.w - 2 * inset - lw, r.h - 2 * inset - lw, Math.max(0, rad - inset));
        ctx.stroke();
      };
      if (kind === "rounded") return rr(0, w);
      rr(0, w * 0.4);
      return rr(w * 0.95, w * 0.4);
    }
  }
}

/** Gambar bingkai di dalam rect (inset diterapkan di sini). `paint` = warna/gradient yang sudah dibuat. */
export function drawFrame(ctx: Ctx, rect: Rect, f: FrameStyle, paint: string | CanvasGradient) {
  const r = { x: rect.x + f.inset, y: rect.y + f.inset, w: rect.w - 2 * f.inset, h: rect.h - 2 * f.inset };
  if (r.w < 4 || r.h < 4) return;
  const w = Math.max(0.3, f.width * f.weight);
  ctx.save();
  ctx.globalAlpha *= f.opacity;
  ctx.fillStyle = paint;
  ctx.strokeStyle = paint;
  if (f.special !== "none") drawSpecial(ctx, r, w, f.special);
  else if (f.pattern !== "none") drawPattern(ctx, r, w, f.pattern);
  else if (f.line !== "none") drawLine(ctx, r, w, f.line);
  if (f.corner !== "none") drawCorners(ctx, r, w, f.corner, f.cornerScale, f.corners ?? ALL_CORNERS);
  ctx.restore();
}

/** Area yang dipakai bingkai halaman: per halaman untuk spread, utuh untuk format lain. */
export function pageFrameRects(trim: Rect, spread: boolean): Rect[] {
  if (!spread) return [trim];
  return spreadHalves(trim);
}

function spreadHalves(trim: Rect): Rect[] {
  return [
    { x: trim.x, y: trim.y, w: trim.w / 2, h: trim.h },
    { x: trim.x + trim.w / 2, y: trim.y, w: trim.w / 2, h: trim.h },
  ];
}
