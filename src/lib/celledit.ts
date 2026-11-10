import type { Cell, Format, Layout, Page, Rect } from "../types";
import { uid, useStore } from "../store";
import { cellRect } from "./formats";
import { photoPlacement, placementFor } from "./render";

/* ---------- edit kotak foto (template manual) ---------- */

export const MIN_CELL = 0.04;

export type Edges = { l: boolean; r: boolean; t: boolean; b: boolean };

const blankCell = (r: Rect): Cell => ({ ...r, photoId: null, zoom: 1, ox: 0, oy: 0, rot: 0 });

/**
 * Zoom & geser baru untuk foto di sel `before` setelah sel diubah ke `after`, supaya foto
 * tetap di ukuran & posisi yang sama di halaman (mengubah sel = memotong foto, bukan menskalakan).
 */
export function keepPhoto(f: Format, page: Page, before: Cell, after: Rect): Partial<Cell> {
  const ph = before.photoId ? useStore.getState().photos.find((p) => p.id === before.photoId) : undefined;
  if (!ph) return {};
  const p0 = photoPlacement(cellRect(f, page, before), ph.width, ph.height, before);
  return placementFor(cellRect(f, page, { ...before, ...after }), ph.width, ph.height, before.rot ?? 0, { cx: p0.cx, cy: p0.cy, s: p0.w / ph.width });
}

function edit(fn: (cells: Cell[]) => void) {
  const s = useStore.getState();
  const i = s.pageIdx;
  s.commit((p) => {
    fn(p.pages[i].cells);
    p.pages[i].layoutId = null;
  });
}

/** Tambah kotak baru di tengah halaman. */
export function addCell() {
  edit((cs) => void cs.push(blankCell({ x: 0.3, y: 0.3, w: 0.4, h: 0.4 })));
  const s = useStore.getState();
  s.select({ kind: "cell", index: s.project!.pages[s.pageIdx].cells.length - 1 });
}

/** Bagi kotak jadi dua: "v" = kiri-kanan, "h" = atas-bawah. */
export function splitCell(i: number, dir: "v" | "h") {
  const s = useStore.getState();
  const p = s.project!;
  const page = p.pages[s.pageIdx];
  edit((cs) => {
    const c = cs[i];
    if (!c) return;
    const half = dir === "v" ? { x: c.x, y: c.y, w: c.w / 2, h: c.h } : { x: c.x, y: c.y, w: c.w, h: c.h / 2 };
    const keep = keepPhoto(p.format, page, c, half);
    Object.assign(c, half, keep);
    cs.splice(i + 1, 0, blankCell(dir === "v" ? { x: c.x + half.w, y: c.y, w: half.w, h: c.h } : { x: c.x, y: c.y + half.h, w: c.w, h: half.h }));
  });
}

/**
 * Hapus kolom ("col") atau baris ("row") tempat kotak i berada: semua kotak yang seluruhnya
 * berada dalam rentang kotak itu dibuang, lalu ruangnya dirapatkan dan sisa kotak melebar memenuhi halaman.
 * Kotak yang melintasi rentang tersebut (mis. kotak lebar 2 kolom) ikut menyempit.
 */
export function removeLine(i: number, axis: "col" | "row") {
  const s = useStore.getState();
  const ref = s.project?.pages[s.pageIdx].cells[i];
  if (!ref) return 0;
  const P = axis === "col" ? "x" : "y";
  const S = axis === "col" ? "w" : "h";
  const a = ref[P];
  const b = ref[P] + ref[S];
  const gap = b - a;
  const E = 1e-4;
  let removed = 0;
  edit((cs) => {
    const keep = cs.filter((c) => !(c[P] >= a - E && c[P] + c[S] <= b + E));
    removed = cs.length - keep.length;
    // jika tidak ada sisa, atau kolom selebar halaman, cukup buang kotaknya
    const k = gap < 1 - E ? 1 / (1 - gap) : 0;
    const map = (v: number) => (v <= a ? v : v >= b ? v - gap : a) * k;
    const out = keep
      .map((c) => {
        if (!k) return c;
        const p0 = map(c[P]);
        const p1 = map(c[P] + c[S]);
        return { ...c, [P]: p0, [S]: p1 - p0 };
      })
      .filter((c) => c[S] >= MIN_CELL - E);
    cs.splice(0, cs.length, ...out);
  });
  s.select(null);
  return removed;
}

export function duplicateCell(i: number) {
  edit((cs) => {
    const c = cs[i];
    if (!c) return;
    const d = 0.03;
    cs.push(blankCell({ x: Math.min(c.x + d, 1 - c.w), y: Math.min(c.y + d, 1 - c.h), w: c.w, h: c.h }));
  });
  const s = useStore.getState();
  s.select({ kind: "cell", index: s.project!.pages[s.pageIdx].cells.length - 1 });
}

/** Isi halaman dengan grid baris x kolom (foto yang ada dipertahankan berurutan). */
export function gridCells(rows: number, cols: number) {
  edit((cs) => {
    const ids = cs.map((c) => c.photoId).filter((x): x is string => !!x);
    const out: Cell[] = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out.push(blankCell({ x: c / cols, y: r / rows, w: 1 / cols, h: 1 / rows }));
    out.forEach((c, k) => (c.photoId = ids[k] ?? null));
    cs.splice(0, cs.length, ...out);
  });
  useStore.getState().select(null);
}

export function setCellRect(i: number, patch: Partial<Rect>, key: string) {
  const s = useStore.getState();
  const idx = s.pageIdx;
  s.commit((p) => {
    const c = p.pages[idx].cells[i];
    if (!c) return;
    const before = { ...c };
    Object.assign(c, patch);
    c.w = Math.min(Math.max(MIN_CELL, c.w), 1);
    c.h = Math.min(Math.max(MIN_CELL, c.h), 1);
    c.x = Math.min(Math.max(0, c.x), 1 - c.w);
    c.y = Math.min(Math.max(0, c.y), 1 - c.h);
    // ubah ukuran: foto tetap di tempat; geser posisi: foto ikut pindah bersama sel
    if (before.w !== c.w || before.h !== c.h) Object.assign(c, keepPhoto(p.format, p.pages[idx], before, c));
    p.pages[idx].layoutId = null;
  }, `cr-${key}-${i}`);
}

/** Tepi kotak yang dekat titik (untuk resize); semua false = di dalam (geser). null = di luar. */
export function edgesAt(p: { x: number; y: number }, r: Rect, tol: number): Edges | null {
  if (p.x < r.x - tol || p.x > r.x + r.w + tol || p.y < r.y - tol || p.y > r.y + r.h + tol) return null;
  const e = { l: Math.abs(p.x - r.x) < tol, r: Math.abs(p.x - (r.x + r.w)) < tol, t: Math.abs(p.y - r.y) < tol, b: Math.abs(p.y - (r.y + r.h)) < tol };
  if (e.l && e.r) e.l = false;
  if (e.t && e.b) e.t = false;
  const inside = p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
  return inside || e.l || e.r || e.t || e.b ? e : null;
}

export function edgeCursor(e: Edges) {
  if ((e.l && e.t) || (e.r && e.b)) return "nwse-resize";
  if ((e.r && e.t) || (e.l && e.b)) return "nesw-resize";
  if (e.l || e.r) return "ew-resize";
  if (e.t || e.b) return "ns-resize";
  return "move";
}

function snap(v: number, targets: number[], tol: number) {
  let best = v;
  let d = tol;
  for (const t of targets) {
    const k = Math.abs(t - v);
    if (k < d) {
      d = k;
      best = t;
    }
  }
  return { v: best, d: d < tol ? d : Infinity };
}

/** Garis bantu yang sedang "kena" (koordinat 0..1 area isi). */
export interface SnapGuides {
  gx: number[];
  gy: number[];
}

/**
 * Posisi kotak baru setelah diseret (koordinat 0..1 area isi).
 * Tepi & titik tengah kotak menempel ke tepi/tengah halaman dan tepi/tengah kotak lain bila cukup dekat.
 * Ikut dikembalikan: garis bantu yang sedang sejajar, untuk digambar di kanvas.
 */
export function dragCell(r0: Rect, dx: number, dy: number, e: Edges, others: Rect[], tolX: number, tolY: number, snapOn: boolean): { r: Rect; guides: SnapGuides } {
  const xs = snapOn ? [0, 0.5, 1, ...others.flatMap((o) => [o.x, o.x + o.w / 2, o.x + o.w])] : [];
  const ys = snapOn ? [0, 0.5, 1, ...others.flatMap((o) => [o.y, o.y + o.h / 2, o.y + o.h])] : [];
  const move = !e.l && !e.r && !e.t && !e.b;
  let r: Rect;
  if (move) {
    // pilih yang paling dekat di antara tepi kiri, tengah, dan tepi kanan (begitu juga vertikal)
    const pick = (p: number, size: number, ts: number[], tol: number) => {
      const c = [snap(p, ts, tol), snap(p + size / 2, ts, tol), snap(p + size, ts, tol)];
      const k = c.reduce((bi, s, i) => (s.d < c[bi].d ? i : bi), 0);
      return c[k].d < Infinity ? c[k].v - (size / 2) * k : p;
    };
    const x = pick(r0.x + dx, r0.w, xs, tolX);
    const y = pick(r0.y + dy, r0.h, ys, tolY);
    r = { x: Math.min(Math.max(0, x), 1 - r0.w), y: Math.min(Math.max(0, y), 1 - r0.h), w: r0.w, h: r0.h };
  } else {
    let x0 = r0.x;
    let x1 = r0.x + r0.w;
    let y0 = r0.y;
    let y1 = r0.y + r0.h;
    if (e.l) x0 = Math.min(Math.max(0, snap(x0 + dx, xs, tolX).v), x1 - MIN_CELL);
    if (e.r) x1 = Math.max(Math.min(1, snap(x1 + dx, xs, tolX).v), x0 + MIN_CELL);
    if (e.t) y0 = Math.min(Math.max(0, snap(y0 + dy, ys, tolY).v), y1 - MIN_CELL);
    if (e.b) y1 = Math.max(Math.min(1, snap(y1 + dy, ys, tolY).v), y0 + MIN_CELL);
    r = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }
  // garis bantu: target yang tepat sejajar dengan tepi/tengah kotak (tepi halaman tidak perlu digambar)
  const E = 1e-6;
  const hit = (ts: number[], vs: number[]) => [...new Set(ts.filter((t) => t > E && t < 1 - E && vs.some((v) => Math.abs(v - t) < E)))];
  return {
    r,
    guides: {
      gx: hit(xs, [r.x, r.x + r.w / 2, r.x + r.w]),
      gy: hit(ys, [r.y, r.y + r.h / 2, r.y + r.h]),
    },
  };
}

/* ---------- Templateku: template buatan sendiri (tersimpan di PC ini) ---------- */

export interface MyTemplate {
  id: string;
  name: string;
  cells: Rect[];
  /** rasio area isi saat disimpan */
  aspect: number;
  spread: boolean;
  created: number;
}

const KEY = "albumku.templates";

export function loadTemplates(): MyTemplate[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function storeTemplates(list: MyTemplate[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

export function makeTemplate(cells: Rect[], name: string, aspect: number, spread: boolean): MyTemplate {
  const r = (v: number) => Math.round(v * 10000) / 10000;
  return { id: uid(), name, cells: cells.map((c) => ({ x: r(c.x), y: r(c.y), w: r(c.w), h: r(c.h) })), aspect, spread, created: Date.now() };
}

export const templateLayout = (t: MyTemplate): Layout => ({ id: `my-${t.id}`, kind: "custom", cells: t.cells.map((c) => ({ ...c })), blanks: [] });
