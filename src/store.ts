import { create } from "zustand";
import type { FontFamily, Format, Page, Photo, Project, Selection } from "./types";
import { defaultPageStyle } from "./lib/formats";
import { PRESET_PALETTES, loadPaletteState, savePaletteState } from "./lib/palette";

const initialPalette = loadPaletteState();

export const uid = () => Math.random().toString(36).slice(2, 10);

export function emptyPage(f: Format, style?: Partial<Page>): Page {
  return { id: uid(), layoutId: null, cells: [], texts: [], overlays: [], ...defaultPageStyle(f), ...style };
}

export type Tab = "layout" | "text" | "gradient" | "frame" | "watermark" | "export";

interface State {
  project: Project | null;
  filePath: string | null;
  photos: Photo[];
  pageIdx: number;
  sel: Selection;
  past: Project[];
  future: Project[];
  fonts: FontFamily[];
  fontTick: number;
  guides: boolean;
  zoom: number;
  tab: Tab;
  libSel: string[];
  focusText: number;
  dirty: boolean;
  importing: { done: number; total: number } | null;
  smartCrop: boolean;
  planner: boolean;
  /** mode edit kotak foto (template manual) */
  cellEdit: boolean;
  /** lisensi aktif di komputer ini (null = mode pengembangan) */
  license: { email: string; name: string; offline: boolean } | null;
  /** id palet aktif: preset, "photo" (dari foto halaman) atau "custom" (Paletku) */
  paletteId: string;
  customColors: string[];
  photoColors: string[];
  setPalette: (id: string, custom?: string[]) => void;

  setProject: (p: Project | null, filePath?: string | null) => void;
  /** perubahan dengan riwayat; mergeKey menggabungkan perubahan beruntun (slider) jadi 1 langkah undo */
  commit: (fn: (p: Project) => void, mergeKey?: string) => void;
  beginGesture: () => void;
  live: (fn: (p: Project) => void) => void;
  endGesture: () => void;
  undo: () => void;
  redo: () => void;
  setPage: (i: number) => void;
  select: (s: Selection) => void;
  addPhotos: (ps: Photo[]) => void;
  set: (s: Partial<State>) => void;
}

let gestureBase: Project | null = null;
let lastKey = "";
let lastTime = 0;

/** Nomor halaman aktif selalu valid untuk proyek ini (halaman bisa berkurang lewat hapus/undo/auto isi). */
const fixIdx = (p: Project | null, i: number) => (p ? Math.max(0, Math.min(i, p.pages.length - 1)) : 0);

const clone = (p: Project): Project => ({ ...p, format: { ...p.format }, pages: structuredClone(p.pages), watermark: p.watermark && { ...p.watermark } });

export const useStore = create<State>((set, get) => ({
  project: null,
  filePath: null,
  photos: [],
  pageIdx: 0,
  sel: null,
  past: [],
  future: [],
  fonts: [],
  fontTick: 0,
  guides: true,
  zoom: 1,
  tab: "layout",
  libSel: [],
  focusText: 0,
  dirty: false,
  importing: null,
  smartCrop: true,
  planner: false,
  cellEdit: false,
  license: null,
  paletteId: initialPalette.activeId,
  customColors: initialPalette.custom,
  photoColors: [],
  setPalette: (id, custom) => {
    const next = { paletteId: id, customColors: custom ?? get().customColors };
    set(next);
    if (id !== "photo") savePaletteState({ activeId: id, custom: next.customColors });
    else savePaletteState({ activeId: loadPaletteState().activeId, custom: next.customColors });
  },

  setProject: (p, filePath = null) => set({ project: p, filePath, past: [], future: [], pageIdx: 0, sel: null, dirty: false }),

  commit: (fn, mergeKey) => {
    const prev = get().project;
    if (!prev) return;
    const next = clone(prev);
    fn(next);
    const now = Date.now();
    const merge = !!mergeKey && mergeKey === lastKey && now - lastTime < 900;
    lastKey = mergeKey ?? "";
    lastTime = now;
    set((s) => ({
      project: next,
      pageIdx: fixIdx(next, s.pageIdx),
      past: merge ? s.past : [...s.past.slice(-99), prev],
      future: [],
      dirty: true,
    }));
  },

  beginGesture: () => {
    gestureBase = get().project;
  },
  live: (fn) => {
    const prev = get().project;
    if (!prev) return;
    const next = clone(prev);
    fn(next);
    set((s) => ({ project: next, pageIdx: fixIdx(next, s.pageIdx), dirty: true }));
  },
  endGesture: () => {
    const base = gestureBase;
    gestureBase = null;
    if (base && base !== get().project) set((s) => ({ past: [...s.past.slice(-99), base], future: [] }));
  },

  undo: () => {
    const { past, project, future } = get();
    if (!past.length || !project) return;
    const prev = past[past.length - 1];
    set({
      project: prev,
      past: past.slice(0, -1),
      future: [project, ...future],
      pageIdx: fixIdx(prev, get().pageIdx),
      sel: null,
    });
  },
  redo: () => {
    const { past, project, future } = get();
    if (!future.length || !project) return;
    const next = future[0];
    set({ project: next, past: [...past, project], future: future.slice(1), pageIdx: fixIdx(next, get().pageIdx), sel: null });
  },

  setPage: (i) => set((s) => ({ pageIdx: fixIdx(s.project, i), sel: null })),
  select: (s) => set({ sel: s }),
  addPhotos: (ps) =>
    set((s) => {
      const have = new Set(s.photos.map((p) => p.id));
      return { photos: [...s.photos, ...ps.filter((p) => !have.has(p.id))] };
    }),
  set: (s) => set(s),
}));

/** Warna palet yang sedang aktif. */
export function paletteColors(s: Pick<State, "paletteId" | "customColors" | "photoColors">): string[] {
  if (s.paletteId === "custom") return s.customColors;
  if (s.paletteId === "photo") return s.photoColors;
  return PRESET_PALETTES.find((p) => p.id === s.paletteId)?.colors ?? PRESET_PALETTES[0].colors;
}

/** Pulihkan state yang tidak konsisten (dipakai tombol "Lanjutkan" setelah error tampilan). */
export function repairState() {
  const s = useStore.getState();
  const p = s.project;
  if (p && !p.pages.length) {
    s.set({ project: { ...p, pages: [emptyPage(p.format)] } });
  }
  s.set({ pageIdx: fixIdx(useStore.getState().project, s.pageIdx), sel: null });
}

export const currentPage = () => {
  const s = useStore.getState();
  return s.project?.pages[s.pageIdx] ?? null;
};
