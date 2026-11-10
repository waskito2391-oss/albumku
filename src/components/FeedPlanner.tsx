import { GalleryHorizontal, Grid3x3, X } from "./icons";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../store";
import type { Format, Page, Photo, Rect } from "../types";
import { fileUrl, getImg, onImageLoaded } from "../lib/images";
import { docSize, panelCols, tiles } from "../lib/formats";
import { renderPage } from "../lib/render";
import { Toggle } from "./ui";

interface Post {
  key: string;
  pageIdx: number;
  region: Rect;
  badge?: string;
}

/** Potongan 3:4 tengah — yang tampil di grid profil Instagram. */
function gridCrop(r: Rect): Rect {
  const ra = r.w / r.h;
  if (ra > 0.75) {
    const w = r.h * 0.75;
    return { x: r.x + (r.w - w) / 2, y: r.y, w, h: r.h };
  }
  const h = r.w / 0.75;
  return { x: r.x, y: r.y + (r.h - h) / 2, w: r.w, h };
}

const PostThumb = memo(function PostThumb({ page, f, region, photos, width, tick }: { page: Page; f: Format; region: Rect; photos: Map<string, Photo>; width: number; tick: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!;
    const dpr = window.devicePixelRatio || 1;
    const sub = gridCrop(region);
    c.width = Math.round(width * dpr);
    c.height = Math.round(width * (4 / 3) * dpr);
    renderPage(c.getContext("2d")!, f, page, { scale: (width / sub.w) * dpr, photos, image: (p) => getImg(p.thumb), offsetX: sub.x, offsetY: sub.y });
  }, [page, f, region, photos, width, tick]);
  return <canvas ref={ref} style={{ width, height: width * (4 / 3) }} className="block" />;
});

export function FeedPlanner() {
  const project = useStore((s) => s.project)!;
  const photos = useStore((s) => s.photos);
  const libSel = useStore((s) => s.libSel);
  const set = useStore((s) => s.set);
  const f = project.format;
  const map = useMemo(() => new Map(photos.map((p) => [p.id, p])), [photos]);
  const [tick, setTick] = useState(0);
  const [showOld, setShowOld] = useState(true);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  useEffect(() => onImageLoaded(() => setTick((t) => t + 1)), []);

  // urutan UNGGAH (paling lama dulu); grid profil menampilkan kebalikannya
  const posts = useMemo(() => {
    const out: Post[] = [];
    const { W, H } = docSize(f);
    project.pages.forEach((pg, i) => {
      if (!pg.cells.length && !pg.texts.length) return;
      if (f.kind === "puzzle") tiles(f, false, false).forEach((t) => out.push({ key: `${pg.id}${t.suffix}`, pageIdx: i, region: t }));
      else if (f.kind === "carousel") out.push({ key: pg.id, pageIdx: i, region: tiles(f, false, false)[0], badge: `${panelCols(f)}` });
      else out.push({ key: pg.id, pageIdx: i, region: { x: 0, y: 0, w: W, h: H } });
    });
    return out.reverse();
  }, [project.pages, f]);

  const old = showOld ? libSel.map((id) => map.get(id)).filter((x): x is Photo => !!x) : [];
  const W = 168;
  const canReorder = f.kind !== "puzzle";

  const drop = (from: number, toPage: number) => {
    useStore.getState().commit((d) => {
      const [pg] = d.pages.splice(from, 1);
      d.pages.splice(toPage, 0, pg);
    });
    reorderedAt.current = Date.now();
  };
  // klik setelah drag-urut tidak membuka halaman
  const reorderedAt = useRef(0);

  return (
    <div className="fixed inset-0 z-50 flex bg-black/70" onMouseDown={(e) => e.target === e.currentTarget && set({ planner: false })}>
      <div className="m-auto flex max-h-[92vh] overflow-hidden rounded-xl bg-ink-900 ring-1 ring-ink-600">
        <div className="overflow-y-auto bg-white p-0">
          <div className="sticky top-0 z-10 flex items-center justify-center gap-2 border-b border-neutral-200 bg-white py-2.5 text-xs font-semibold text-neutral-800">
            <Grid3x3 size={14} /> Pratinjau grid profil
          </div>
          <div className="grid grid-cols-3 gap-[2px]" style={{ width: W * 3 + 4 }}>
            {posts.map((p) => (
              <button
                key={p.key}
                data-page={p.pageIdx}
                onPointerDown={(e) => {
                  if (!canReorder || e.button !== 0) return;
                  const from = p.pageIdx;
                  setDragFrom(from);
                  const up = (ev: PointerEvent) => {
                    window.removeEventListener("pointerup", up);
                    const el = document.elementFromPoint(ev.clientX, ev.clientY)?.closest("[data-page]");
                    const to = el ? Number(el.getAttribute("data-page")) : NaN;
                    if (!Number.isNaN(to) && to !== from) drop(from, to);
                    setDragFrom(null);
                  };
                  window.addEventListener("pointerup", up);
                }}
                onClick={() => {
                  if (Date.now() - reorderedAt.current < 300) return;
                  useStore.getState().setPage(p.pageIdx);
                  set({ planner: false });
                }}
                className={`relative block ${dragFrom === p.pageIdx ? "opacity-40" : ""}`}
                title={`Halaman ${p.pageIdx + 1}`}
              >
                <PostThumb page={project.pages[p.pageIdx]} f={f} region={p.region} photos={map} width={W} tick={tick} />
                {p.badge && (
                  <span className="absolute right-1.5 top-1.5 text-white drop-shadow">
                    <GalleryHorizontal size={16} />
                  </span>
                )}
              </button>
            ))}
            {old.map((ph) => (
              <div key={ph.id} className="relative" style={{ width: W, height: W * (4 / 3) }}>
                <img src={fileUrl(ph.thumb)} className="h-full w-full object-cover" />
                <span className="absolute bottom-1 left-1 rounded bg-black/50 px-1 text-[9px] text-white">feed lama</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex w-[290px] flex-col gap-4 p-5">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-ink-100">Feed Planner</h3>
              <p className="mt-1 text-xs leading-relaxed text-ink-400">Post terbaru tampil di kiri-atas, dipotong 3:4 seperti grid profil Instagram.</p>
            </div>
            <button onClick={() => set({ planner: false })} className="text-ink-400 hover:text-ink-100">
              <X size={18} />
            </button>
          </div>
          <div className="space-y-2 rounded-md bg-ink-800 p-3 text-xs leading-relaxed text-ink-300 ring-1 ring-ink-700">
            <div>
              <span className="text-ink-100">{posts.length}</span> post baru
            </div>
            {canReorder ? <div>Seret post untuk mengubah urutan unggah. Klik untuk mengedit.</div> : <div>Puzzle: unggah file unggah01 → unggah{String(posts.length).padStart(2, "0")} secara berurutan.</div>}
          </div>
          <Toggle label="Tampilkan feed lama" value={showOld} onChange={setShowOld} />
          <p className="text-[11px] leading-relaxed text-ink-400">
            Feed lama = foto yang sedang dipilih di pustaka ({libSel.length}). Import beberapa post lama dari akunmu lalu pilih untuk melihat kecocokan warna dengan feed.
          </p>
        </div>
      </div>
    </div>
  );
}
