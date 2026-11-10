import { open, save } from "@tauri-apps/plugin-dialog";
import type { Format, Layout, Page, Photo, Project } from "../types";
import { invoke } from "@tauri-apps/api/core";
import { currentPage, emptyPage, uid, useStore } from "../store";
import { importPhotos, readText, saveFrame, scanFolder, writeText } from "./api";
import { assign, bestLayout, pagePhotoIds, smartOffset, toCells } from "./fit";
import { docSize, tiles } from "./formats";
import { loadFull } from "./images";
import { renderPage } from "./render";

const photoMap = () => new Map(useStore.getState().photos.map((p) => [p.id, p]));
const IMG_FILTER = [{ name: "Foto", extensions: ["jpg", "jpeg", "png", "webp"] }];

export async function importFiles() {
  const r = await open({ multiple: true, filters: IMG_FILTER });
  if (!r) return;
  await runImport(Array.isArray(r) ? r : [r]);
}

export async function importFolder() {
  const dir = await open({ directory: true });
  if (!dir || Array.isArray(dir)) return;
  await runImport(await scanFolder(dir));
}

async function runImport(paths: string[]): Promise<Photo[]> {
  if (!paths.length) return [];
  const s = useStore.getState();
  s.set({ importing: { done: 0, total: paths.length } });
  try {
    const ps = await importPhotos(paths);
    s.addPhotos(ps);
    return ps;
  } finally {
    s.set({ importing: null });
  }
}

const IMG_EXT = /\.(jpe?g|png|webp)$/i;

/**
 * File/folder dilepas dari Explorer. Folder dipindai rekursif.
 * Bila dilepas di kanvas: 1 foto di atas sel -> isi sel itu; selain itu -> susun ke halaman aktif.
 */
export async function importDropped(paths: string[], onCanvas: { cell: number } | null) {
  const files: string[] = [];
  for (const p of paths) {
    if (IMG_EXT.test(p)) files.push(p);
    else files.push(...(await scanFolder(p)));
  }
  const ps = await runImport(files);
  const s = useStore.getState();
  if (!onCanvas || !ps.length || !s.project) return ps.length;
  s.set({ libSel: ps.map((p) => p.id) });
  if (onCanvas.cell >= 0 && ps.length === 1) setCellPhoto(s.pageIdx, onCanvas.cell, ps[0].id);
  else await addToPage(s.pageIdx, ps.slice(0, 12).map((p) => p.id));
  return ps.length;
}

/** Terapkan template ke halaman, foto dipasangkan otomatis. */
export function applyLayout(pageIdx: number, layout: Layout, photoIds?: string[]) {
  const s = useStore.getState();
  const p = s.project!;
  const page = p.pages[pageIdx];
  const map = photoMap();
  const ids = photoIds ?? pagePhotoIds(page);
  const photos = ids.map((id) => map.get(id)).filter((x): x is Photo => !!x);
  const { photos: placed } = assign(p.format, page, layout, photos);
  s.commit((d) => {
    d.pages[pageIdx].cells = toCells(p.format, page, layout, placed, s.smartCrop);
    d.pages[pageIdx].layoutId = layout.id;
  });
  s.select(null);
}

/** Tambah foto ke halaman lalu susun ulang otomatis memakai template paling cocok. */
export async function addToPage(pageIdx: number, ids: string[]) {
  const s = useStore.getState();
  const p = s.project!;
  const page = p.pages[pageIdx];
  const all = [...pagePhotoIds(page), ...ids.filter((id) => !pagePhotoIds(page).includes(id))].slice(0, 12);
  const map = photoMap();
  const photos = all.map((id) => map.get(id)).filter((x): x is Photo => !!x);
  if (!photos.length) return;
  const l = await bestLayout(p.format, page, photos);
  applyLayout(pageIdx, l, all);
}

/** Isi satu sel dengan foto (posisi otomatis mengikuti wajah bila Smart crop aktif). */
export function setCellPhoto(pageIdx: number, cellIdx: number, photoId: string) {
  const s = useStore.getState();
  const p = s.project!;
  const ph = photoMap().get(photoId);
  const off = s.smartCrop ? smartOffset(p.format, p.pages[pageIdx], p.pages[pageIdx].cells[cellIdx], ph) : { ox: 0, oy: 0 };
  s.commit((d) => Object.assign(d.pages[pageIdx].cells[cellIdx], { photoId, zoom: 1, rot: 0, ...off }));
}

/** Terapkan ulang smart crop wajah ke semua sel di semua halaman (zoom direset). */
export function smartCropAll() {
  const s = useStore.getState();
  const map = photoMap();
  let n = 0;
  s.commit((d) => {
    for (const pg of d.pages)
      for (const c of pg.cells) {
        const ph = c.photoId ? map.get(c.photoId) : undefined;
        if (!ph?.faces?.length) continue;
        Object.assign(c, { zoom: 1, ...smartOffset(d.format, pg, c, ph) });
        n++;
      }
  });
  return n;
}

export function addPage(after: number, dup = false) {
  const s = useStore.getState();
  const p = s.project!;
  const ref = p.pages[after] ?? p.pages[p.pages.length - 1];
  s.commit((d) => {
    const np: Page = dup && ref
      ? { ...structuredClone(ref), id: uid(), texts: ref.texts.map((t) => ({ ...structuredClone(t), id: uid() })), overlays: ref.overlays.map((o) => ({ ...structuredClone(o), id: uid() })) }
      : emptyPage(d.format, ref ? { bg: structuredClone(ref.bg), gutter: ref.gutter, margin: ref.margin, radius: ref.radius } : undefined);
    d.pages.splice(after + 1, 0, np);
  });
  s.setPage(after + 1);
}

export function deletePage(i: number) {
  const s = useStore.getState();
  s.commit((d) => {
    d.pages.splice(i, 1);
    if (!d.pages.length) d.pages.push(emptyPage(d.format));
  });
  s.setPage(Math.max(0, Math.min(i, s.project!.pages.length - 1)));
}

export function movePage(i: number, dir: -1 | 1) {
  const s = useStore.getState();
  const j = i + dir;
  if (j < 0 || j >= s.project!.pages.length) return;
  s.commit((d) => {
    const [pg] = d.pages.splice(i, 1);
    d.pages.splice(j, 0, pg);
  });
  s.setPage(j);
}

/**
 * Auto Isi: foto diurutkan menurut waktu jepret, dikelompokkan per momen (jeda waktu)
 * dan jumlah per halaman, lalu tiap kelompok mendapat template paling cocok (bervariasi).
 */
export async function autoBuild(opts: { min: number; max: number; onlyUnused: boolean; replace: boolean }) {
  const s = useStore.getState();
  const p = s.project!;
  const used = new Set(opts.replace ? [] : p.pages.flatMap(pagePhotoIds));
  const photos = [...s.photos].filter((ph) => !opts.onlyUnused || !used.has(ph.id)).sort((a, b) => a.taken - b.taken || a.name.localeCompare(b.name));
  if (!photos.length) return 0;
  const groups: Photo[][] = [];
  let cur: Photo[] = [];
  let target = opts.min;
  const GAP = 20 * 60 * 1000;
  const nextTarget = () => opts.min + Math.floor(Math.random() * (opts.max - opts.min + 1));
  target = nextTarget();
  for (const ph of photos) {
    const gap = cur.length ? ph.taken - cur[cur.length - 1].taken : 0;
    if (cur.length >= target || (cur.length >= opts.min && gap > GAP)) {
      groups.push(cur);
      cur = [];
      target = nextTarget();
    }
    cur.push(ph);
  }
  if (cur.length) {
    // sisa yang terlalu sedikit digabung ke kelompok sebelumnya bila muat
    const last = groups[groups.length - 1];
    if (last && cur.length < opts.min && last.length + cur.length <= 12) last.push(...cur);
    else groups.push(cur);
  }
  const ref = currentPage() ?? emptyPage(p.format);
  const style = { bg: structuredClone(ref.bg), gutter: ref.gutter, margin: ref.margin, radius: ref.radius };
  const recent: string[] = [];
  const pages: Page[] = [];
  for (const g of groups) {
    const pg = emptyPage(p.format, style);
    const l = await bestLayout(p.format, pg, g, recent, 6);
    recent.push(l.id);
    if (recent.length > 8) recent.shift();
    const { photos: placed } = assign(p.format, pg, l, g);
    pg.cells = toCells(p.format, pg, l, placed, s.smartCrop);
    pg.layoutId = l.id;
    pages.push(pg);
  }
  s.commit((d) => {
    const keep = opts.replace ? [] : d.pages.filter((pg) => pg.cells.length || pg.texts.length || pg.overlays.length);
    d.pages = [...keep, ...pages];
  });
  s.setPage(opts.replace ? 0 : Math.max(0, useStore.getState().project!.pages.length - pages.length));
  return pages.length;
}

/* ---------- simpan / buka proyek ---------- */

export async function saveProject(as = false) {
  const s = useStore.getState();
  if (!s.project) return;
  let path = s.filePath;
  if (!path || as) {
    const r = await save({ defaultPath: `${s.project.name}.albumku`, filters: [{ name: "Proyek ALBUMKU", extensions: ["albumku"] }] });
    if (!r) return;
    path = r;
  }
  const used = new Set(s.project.pages.flatMap(pagePhotoIds));
  const data = { app: "ALBUMKU", project: s.project, photos: s.photos.map((p) => ({ path: p.path, used: used.has(p.id) })) };
  await writeText(path, JSON.stringify(data));
  s.set({ filePath: path, dirty: false });
}

export async function openProject() {
  const r = await open({ filters: [{ name: "Proyek ALBUMKU", extensions: ["albumku"] }] });
  if (!r || Array.isArray(r)) return;
  const data = JSON.parse(await readText(r)) as { project: Project; photos: { path: string }[] };
  const ps = await importPhotos(data.photos.map((x) => x.path));
  const s = useStore.getState();
  s.set({ photos: ps });
  s.setProject(data.project, r);
}

/* ---------- export resolusi tinggi (JPG / TIFF / PDF) ---------- */

export type ExportKind = "jpg" | "tif" | "pdf";

export interface ExportOpts {
  kind: ExportKind;
  /** folder (JPG/TIFF) atau path file .pdf */
  dir: string;
  prefix: string;
  quality: number;
  scale: number;
  bleed: boolean;
  split: boolean;
  pages: number[];
  onProgress: (done: number, total: number, msg: string) => void;
}

const MAX_SIDE = 16384;

/** Ukuran piksel satu file output (potongan pertama). */
export function exportPixelSize(f: Format, scale: number, bleed: boolean, split = false) {
  const t = tiles(f, bleed, split)[0];
  return { w: Math.round(t.w * scale), h: Math.round(t.h * scale), count: tiles(f, bleed, split).length };
}

export async function exportPages(o: ExportOpts) {
  const s = useStore.getState();
  const p = s.project!;
  const f = p.format;
  const map = photoMap();
  const regions = tiles(f, o.bleed, o.split);
  for (const r of regions) {
    if (r.w * o.scale > MAX_SIDE || r.h * o.scale > MAX_SIDE)
      throw new Error(`Ukuran ${Math.round(r.w * o.scale)}x${Math.round(r.h * o.scale)}px melebihi batas ${MAX_SIDE}px. Kecilkan ukuran atau skala.`);
  }
  const dpi = f.isPrint ? f.dpi : 72;
  const files: string[] = [];
  const pad = Math.max(2, String(p.pages.length).length);
  if (o.kind === "pdf") await invoke("pdf_begin", { path: o.dir });
  let done = 0;
  for (const idx of o.pages) {
    const page = p.pages[idx];
    o.onProgress(done, o.pages.length, `Memuat foto halaman ${idx + 1}…`);
    const imgs = new Map<string, HTMLImageElement>();
    await Promise.all(
      pagePhotoIds(page).map(async (id) => {
        const ph = map.get(id);
        if (ph) imgs.set(id, await loadFull(ph.path));
      }),
    );
    await Promise.all(page.texts.map((t) => document.fonts.load(`${t.italic ? "italic " : ""}${t.weight} 40px "${t.fontFamily}"`).catch(() => null)));
    for (const r of regions) {
      // render tiap potongan terpisah: hemat memori & tidak terbentur batas ukuran kanvas
      const w = Math.round(r.w * o.scale);
      const h = Math.round(r.h * o.scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
      o.onProgress(done, o.pages.length, `Merender halaman ${idx + 1}${r.suffix}…`);
      renderPage(ctx, f, page, { scale: o.scale, photos: map, image: (ph) => imgs.get(ph.id) ?? null, offsetX: r.x, offsetY: r.y });
      const data = ctx.getImageData(0, 0, w, h).data;
      canvas.width = canvas.height = 0;
      const base = `${o.prefix}-${String(idx + 1).padStart(pad, "0")}${r.suffix}`;
      if (o.kind === "pdf") {
        o.onProgress(done, o.pages.length, `Menambah ke PDF: ${base}…`);
        const bleedPx = f.isPrint && o.bleed ? f.bleed * o.scale : 0;
        await saveFrame("pdf_add", "", data, w, h, o.quality, dpi, bleedPx);
      } else {
        const sep = o.dir.includes("\\") ? "\\" : "/";
        const path = `${o.dir}${sep}${base}.${o.kind}`;
        o.onProgress(done, o.pages.length, `Menyimpan ${base}.${o.kind}…`);
        await saveFrame(o.kind === "jpg" ? "save_jpeg" : "save_tiff", path, data, w, h, o.quality, dpi);
        files.push(path);
      }
    }
    imgs.clear();
    done++;
    o.onProgress(done, o.pages.length, "");
  }
  if (o.kind === "pdf") files.push(await invoke<string>("pdf_finish"));
  return files;
}
