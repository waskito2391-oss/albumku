import type { Cell, Layout, Rect } from "../types";
import { uid, useStore } from "../store";

/* ---------- edit kotak foto (template manual) ---------- */

export const MIN_CELL = 0.04;

export type Edges = { l: boolean; r: boolean; t: boolean; b: boolean };

const blankCell = (r: Rect): Cell => ({ ...r, photoId: null, zoom: 1, ox: 0, oy: 0, rot: 0 });

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
  edit((cs) => {
    const c = cs[i];
    if (!c) return;
    if (dir === "v") {
      const w = c.w / 2;
      c.w = w;
      cs.splice(i + 1, 0, blankCell({ x: c.x + w, y: c.y, w, h: c.h }));
    } else {
      const h = c.h / 2;
      c.h = h;
      cs.splice(i + 1, 0, blankCell({ x: c.x, y: c.y + h, w: c.w, h }));
    }
  });
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
    Object.assign(c, patch);
    c.w = Math.min(Math.max(MIN_CELL, c.w), 1);
    c.h = Math.min(Math.max(MIN_CELL, c.h), 1);
    c.x = Math.min(Math.max(0, c.x), 1 - c.w);
    c.y = Math.min(Math.max(0, c.y), 1 - c.h);
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

/**
 * Posisi kotak baru setelah diseret (koordinat 0..1 area isi).
 * Tepi menempel ke tepi halaman, garis tengah, dan tepi kotak lain bila cukup dekat.
 */
export function dragCell(r0: Rect, dx: number, dy: number, e: Edges, others: Rect[], tolX: number, tolY: number, snapOn: boolean): Rect {
  const xs = snapOn ? [0, 0.5, 1, ...others.flatMap((o) => [o.x, o.x + o.w])] : [];
  const ys = snapOn ? [0, 0.5, 1, ...others.flatMap((o) => [o.y, o.y + o.h])] : [];
  const move = !e.l && !e.r && !e.t && !e.b;
  if (move) {
    let x = r0.x + dx;
    let y = r0.y + dy;
    const a = snap(x, xs, tolX);
    const b = snap(x + r0.w, xs, tolX);
    x = a.d <= b.d ? (a.d < Infinity ? a.v : x) : b.v - r0.w;
    const c = snap(y, ys, tolY);
    const d = snap(y + r0.h, ys, tolY);
    y = c.d <= d.d ? (c.d < Infinity ? c.v : y) : d.v - r0.h;
    return { x: Math.min(Math.max(0, x), 1 - r0.w), y: Math.min(Math.max(0, y), 1 - r0.h), w: r0.w, h: r0.h };
  }
  let x0 = r0.x;
  let x1 = r0.x + r0.w;
  let y0 = r0.y;
  let y1 = r0.y + r0.h;
  if (e.l) x0 = Math.min(Math.max(0, snap(x0 + dx, xs, tolX).v), x1 - MIN_CELL);
  if (e.r) x1 = Math.max(Math.min(1, snap(x1 + dx, xs, tolX).v), x0 + MIN_CELL);
  if (e.t) y0 = Math.min(Math.max(0, snap(y0 + dy, ys, tolY).v), y1 - MIN_CELL);
  if (e.b) y1 = Math.max(Math.min(1, snap(y1 + dy, ys, tolY).v), y0 + MIN_CELL);
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
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
