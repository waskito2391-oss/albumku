import { FolderPlus, ImagePlus, LayoutGrid, ScanFace } from "./icons";
import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../store";
import { addToPage, importFiles, importFolder, setCellPhoto } from "../lib/actions";
import { pagePhotoIds } from "../lib/fit";
import { fileUrl } from "../lib/images";
import { startPhotoDrag } from "../lib/dnd";
import type { Photo } from "../types";
import { Btn, Seg } from "./ui";

const H_KEY = "albumku.libHeight";
const H_MIN = 140;
const H_DEF = 230;

function loadHeight() {
  try {
    const v = Number(localStorage.getItem(H_KEY));
    return v >= H_MIN ? v : H_DEF;
  } catch {
    return H_DEF;
  }
}

export function PhotoLibrary() {
  const photos = useStore((s) => s.photos);
  const project = useStore((s) => s.project)!;
  const libSel = useStore((s) => s.libSel);
  const importing = useStore((s) => s.importing);
  const set = useStore((s) => s.set);
  const [sort, setSort] = useState<"time" | "name">("time");
  const [filter, setFilter] = useState<"all" | "unused">("all");
  const anchor = useRef<number>(-1);
  const [height, setHeight] = useState(loadHeight);
  const [preview, setPreview] = useState<{ photo: Photo; rect: DOMRect } | null>(null);
  const hoverTimer = useRef<number>();

  const hoverIn = (photo: Photo, el: HTMLElement) => {
    window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => setPreview({ photo, rect: el.getBoundingClientRect() }), 350);
  };
  const hoverOut = () => {
    window.clearTimeout(hoverTimer.current);
    setPreview(null);
  };
  useEffect(() => () => window.clearTimeout(hoverTimer.current), []);

  useEffect(() => {
    try {
      localStorage.setItem(H_KEY, String(height));
    } catch {}
  }, [height]);

  // tarik garis atas panel untuk mengubah tinggi pustaka
  const startResize = (e: React.PointerEvent) => {
    e.preventDefault();
    const y0 = e.clientY;
    const h0 = height;
    const max = () => Math.max(H_MIN, window.innerHeight - 320);
    const move = (ev: PointerEvent) => setHeight(Math.round(Math.min(max(), Math.max(H_MIN, h0 + y0 - ev.clientY))));
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.style.cursor = "";
    };
    document.body.style.cursor = "row-resize";
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const usage = useMemo(() => {
    const m = new Map<string, number>();
    project.pages.forEach((p) => pagePhotoIds(p).forEach((id) => m.set(id, (m.get(id) ?? 0) + 1)));
    return m;
  }, [project.pages]);

  const list = useMemo(() => {
    let l = [...photos];
    if (filter === "unused") l = l.filter((p) => !usage.has(p.id));
    l.sort(sort === "time" ? (a, b) => a.taken - b.taken || a.name.localeCompare(b.name) : (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    return l;
  }, [photos, sort, filter, usage]);

  const click = (e: React.MouseEvent, i: number, id: string) => {
    if (e.shiftKey && anchor.current >= 0) {
      const [a, b] = [Math.min(anchor.current, i), Math.max(anchor.current, i)];
      set({ libSel: list.slice(a, b + 1).map((p) => p.id) });
    } else if (e.ctrlKey) {
      set({ libSel: libSel.includes(id) ? libSel.filter((x) => x !== id) : [...libSel, id] });
      anchor.current = i;
    } else {
      set({ libSel: [id] });
      anchor.current = i;
    }
  };

  const dblClick = (id: string) => {
    const st = useStore.getState();
    const sel = st.sel;
    if (sel?.kind === "cell") {
      setCellPhoto(st.pageIdx, sel.index, id);
    } else addToPage(st.pageIdx, [id]);
  };

  return (
    <section className="relative flex shrink-0 border-t border-ink-700/70 bg-ink-900" style={{ height }}>
      <div onPointerDown={startResize} title="Tarik untuk mengubah tinggi" className="absolute inset-x-0 -top-1 z-10 h-2 cursor-row-resize hover:bg-accent/40" />
      <div className="flex w-[230px] shrink-0 flex-col gap-2.5 overflow-y-auto border-r border-ink-700/70 p-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-[13px] font-medium text-ink-200">Pustaka foto</h2>
          <span className="text-[11px] tabular-nums text-ink-400">
            {usage.size}/{photos.length} dipakai
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <Btn variant="soft" onClick={importFiles}>
            <ImagePlus size={14} /> Foto
          </Btn>
          <Btn variant="soft" onClick={importFolder}>
            <FolderPlus size={14} /> Folder
          </Btn>
        </div>
        {importing && (
          <div>
            <div className="mb-1 flex justify-between text-[11px] text-ink-300">
              <span>Membaca foto…</span>
              <span className="tabular-nums">
                {importing.done}/{importing.total}
              </span>
            </div>
            <div className="h-1 overflow-hidden rounded bg-ink-700">
              <div className="h-full bg-accent transition-all" style={{ width: `${(importing.done / Math.max(1, importing.total)) * 100}%` }} />
            </div>
          </div>
        )}
        <Seg value={sort} onChange={setSort} options={[{ v: "time", label: "Waktu" }, { v: "name", label: "Nama" }]} />
        <Seg value={filter} onChange={setFilter} options={[{ v: "all", label: "Semua" }, { v: "unused", label: "Belum" }]} />
        {libSel.length > 0 && (
          <div className="mt-auto space-y-1.5 border-t border-ink-700/70 pt-2.5">
            <div className="text-xs text-ink-300">{libSel.length} dipilih</div>
            <Btn variant="primary" className="w-full" onClick={() => addToPage(useStore.getState().pageIdx, libSel.slice(0, 12))} title="Maksimal 12 foto per halaman">
              <LayoutGrid size={14} /> Isi ke halaman
            </Btn>
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2" onScroll={hoverOut} onClick={(e) => e.target === e.currentTarget && set({ libSel: [] })}>
        {!photos.length && !importing && (
          <div className="mt-10 px-4 text-center text-xs leading-relaxed text-ink-400">
            Import foto atau satu folder sesi pemotretan.
            <br />
            JPG / PNG / WEBP, orientasi EXIF otomatis.
          </div>
        )}
        <div className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-1.5">
          {list.map((p, i) => {
            const selected = libSel.includes(p.id);
            const used = usage.get(p.id) ?? 0;
            return (
              <div
                key={p.id}
                onPointerEnter={(e) => e.buttons === 0 && hoverIn(p, e.currentTarget)}
                onPointerLeave={hoverOut}
                onPointerDown={(e) => {
                  hoverOut();
                  if (e.button === 0 && !e.shiftKey && !e.ctrlKey) startPhotoDrag(e, selected ? libSel : [p.id]);
                }}
                onClick={(e) => click(e, i, p.id)}
                onDoubleClick={() => dblClick(p.id)}
                className={`group relative aspect-square cursor-pointer overflow-hidden rounded bg-ink-800 ${selected ? "ring-2 ring-accent" : "ring-1 ring-transparent hover:ring-ink-500"}`}
              >
                <img src={fileUrl(p.thumb)} loading="lazy" draggable={false} className={`h-full w-full object-cover ${used ? "opacity-45" : ""}`} />
                {used > 0 && <span className="absolute right-1 top-1 rounded bg-accent px-1 text-[10px] font-semibold text-on-accent">{used}</span>}
                {!!p.faces?.length && (
                  <span className="absolute bottom-1 left-1 flex items-center gap-0.5 rounded bg-black/55 px-1 text-[10px] text-white" title={`${p.faces.length} wajah terdeteksi`}>
                    <ScanFace size={10} /> {p.faces.length}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {preview && <HoverPreview {...preview} />}
    </section>
  );
}

const PV_MAX = 420;

/** Pratinjau besar yang melayang di atas foto pustaka saat kursor diam di atasnya. */
function HoverPreview({ photo, rect }: { photo: Photo; rect: DOMRect }) {
  const r = photo.width / Math.max(1, photo.height);
  const maxH = Math.min(PV_MAX, rect.top - 24);
  let w = r >= 1 ? PV_MAX : PV_MAX * r;
  let h = w / r;
  if (h > maxH) {
    h = maxH;
    w = h * r;
  }
  const left = Math.min(window.innerWidth - w - 8, Math.max(8, rect.left + rect.width / 2 - w / 2));
  const top = Math.max(8, rect.top - h - 30);
  return (
    <div className="pointer-events-none fixed z-50 overflow-hidden rounded-md bg-ink-900 shadow-2xl ring-1 ring-ink-600" style={{ left, top, width: w }}>
      <img src={fileUrl(photo.thumb)} draggable={false} className="block w-full bg-ink-800 object-cover" style={{ height: h }} />
      <div className="flex justify-between gap-2 px-2 py-1 text-[11px] text-ink-300">
        <span className="truncate">{photo.name}</span>
        <span className="shrink-0 tabular-nums text-ink-400">
          {photo.width}×{photo.height}
        </span>
      </div>
    </div>
  );
}
