import { ChevronLeft, ChevronRight, Copy, Plus, Trash2 } from "./icons";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../store";
import type { Format, Page, Photo } from "../types";
import { addPage, deletePage, movePage } from "../lib/actions";
import { docSize } from "../lib/formats";
import { getImg, onImageLoaded } from "../lib/images";
import { renderPage } from "../lib/render";
import { Btn } from "./ui";

const THUMB_H = 64;

const PageThumb = memo(function PageThumb({ page, f, photos, tick }: { page: Page; f: Format; photos: Map<string, Photo>; tick: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { W, H } = docSize(f);
  const s = THUMB_H / H;
  useEffect(() => {
    const c = ref.current!;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(W * s * dpr);
    c.height = Math.round(H * s * dpr);
    renderPage(c.getContext("2d")!, f, page, { scale: s * dpr, photos, image: (p) => getImg(p.thumb), editor: true });
  }, [page, f, photos, tick, W, H, s]);
  return <canvas ref={ref} style={{ width: W * s, height: THUMB_H }} className="block" />;
});

export function PageStrip() {
  const project = useStore((s) => s.project)!;
  const pageIdx = useStore((s) => s.pageIdx);
  const setPage = useStore((s) => s.setPage);
  const photos = useStore((s) => s.photos);
  const map = useMemo(() => new Map(photos.map((p) => [p.id, p])), [photos]);
  const [tick, setTick] = useState(0);
  useEffect(() => onImageLoaded(() => setTick((t) => t + 1)), []);
  const activeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [pageIdx]);
  const k = project.format.kind;
  const label = project.format.spread ? "Spread" : project.format.isPrint ? "Halaman" : k === "carousel" ? "Carousel" : k === "puzzle" ? "Puzzle" : "Post";

  return (
    <div className="flex h-[112px] shrink-0 items-stretch border-t border-ink-700/70 bg-ink-900">
      <div className="flex min-w-0 flex-1 items-center gap-2.5 overflow-x-auto px-3">
        {project.pages.map((pg, i) => (
          <button
            key={pg.id}
            ref={i === pageIdx ? activeRef : undefined}
            onClick={() => setPage(i)}
            className={`shrink-0 rounded p-1 transition-colors ${i === pageIdx ? "bg-accent-soft ring-2 ring-accent" : "ring-1 ring-ink-700 hover:ring-ink-500"}`}
          >
            <PageThumb page={pg} f={project.format} photos={map} tick={tick} />
            <div className={`mt-1 text-center text-[10px] tabular-nums ${i === pageIdx ? "text-accent" : "text-ink-400"}`}>
              {label} {i + 1}
            </div>
          </button>
        ))}
        <button onClick={() => addPage(project.pages.length - 1)} className="flex h-[84px] w-16 shrink-0 flex-col items-center justify-center gap-1 rounded border border-dashed border-ink-600 text-ink-400 hover:border-accent hover:text-accent">
          <Plus size={18} />
          <span className="text-[10px]">Tambah</span>
        </button>
      </div>
      <div className="flex w-[150px] shrink-0 flex-col justify-center gap-1 border-l border-ink-700/70 px-2">
        <div className="text-center text-[11px] tabular-nums text-ink-300">
          {label} {pageIdx + 1} / {project.pages.length}
        </div>
        <div className="grid grid-cols-4 gap-0.5">
          <Btn title="Geser ke kiri" onClick={() => movePage(pageIdx, -1)}>
            <ChevronLeft size={14} />
          </Btn>
          <Btn title="Duplikat" onClick={() => addPage(pageIdx, true)}>
            <Copy size={14} />
          </Btn>
          <Btn title="Hapus" variant="danger" onClick={() => deletePage(pageIdx)}>
            <Trash2 size={14} />
          </Btn>
          <Btn title="Geser ke kanan" onClick={() => movePage(pageIdx, 1)}>
            <ChevronRight size={14} />
          </Btn>
        </div>
      </div>
    </div>
  );
}
