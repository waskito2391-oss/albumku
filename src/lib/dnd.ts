/**
 * Drag & drop tanpa HTML5 DnD.
 * Di Windows, drop file dari Explorer (event native Tauri) mematikan HTML5 drag-and-drop di WebView,
 * jadi drag internal (pustaka -> kanvas) memakai pointer event. Kanvas mendaftarkan diri sebagai target
 * sehingga drag internal dan drop file dari Explorer memakai logika sasaran yang sama.
 */
import { create } from "zustand";

export interface DropTarget {
  /** titik (koordinat layar CSS) berada di area kanvas? */
  hit: (x: number, y: number) => boolean;
  hover: (x: number, y: number) => void;
  leave: () => void;
  /** foto (id pustaka) dilepas di kanvas */
  drop: (x: number, y: number, ids: string[]) => void;
  /** indeks sel di bawah titik, -1 bila bukan sel */
  cellAt: (x: number, y: number) => number;
}

interface DragUi {
  /** drag foto dari pustaka */
  drag: { ids: string[]; x: number; y: number } | null;
  /** drag file dari Explorer */
  fileDrag: { x: number; y: number; count: number; overCanvas: boolean } | null;
}

export const useDrag = create<DragUi>(() => ({ drag: null, fileDrag: null }));

let target: DropTarget | null = null;

export function registerDropTarget(t: DropTarget) {
  target = t;
  return () => {
    if (target === t) target = null;
  };
}

export const dropTarget = () => target;

/** Mulai drag foto dari pustaka (aktif setelah kursor bergerak > 5px). */
export function startPhotoDrag(e: { clientX: number; clientY: number }, ids: string[]) {
  const sx = e.clientX;
  const sy = e.clientY;
  let started = false;
  const move = (ev: PointerEvent) => {
    if (!started && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 5) return;
    started = true;
    document.body.style.cursor = "grabbing";
    useDrag.setState({ drag: { ids, x: ev.clientX, y: ev.clientY } });
    if (target?.hit(ev.clientX, ev.clientY)) target.hover(ev.clientX, ev.clientY);
    else target?.leave();
  };
  const up = (ev: PointerEvent) => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    document.body.style.cursor = "";
    if (started && target?.hit(ev.clientX, ev.clientY)) target.drop(ev.clientX, ev.clientY, ids);
    target?.leave();
    useDrag.setState({ drag: null });
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
}
