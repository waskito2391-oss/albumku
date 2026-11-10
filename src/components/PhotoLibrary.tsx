import { FolderPlus, ImagePlus, LayoutGrid, ScanFace } from "./icons";
import { useMemo, useRef, useState } from "react";
import { useStore } from "../store";
import { addToPage, importFiles, importFolder, setCellPhoto } from "../lib/actions";
import { pagePhotoIds } from "../lib/fit";
import { fileUrl } from "../lib/images";
import { startPhotoDrag } from "../lib/dnd";
import { Btn, Seg } from "./ui";

export function PhotoLibrary() {
  const photos = useStore((s) => s.photos);
  const project = useStore((s) => s.project)!;
  const libSel = useStore((s) => s.libSel);
  const importing = useStore((s) => s.importing);
  const set = useStore((s) => s.set);
  const [sort, setSort] = useState<"time" | "name">("time");
  const [filter, setFilter] = useState<"all" | "unused">("all");
  const anchor = useRef<number>(-1);

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
    <aside className="flex w-[300px] shrink-0 flex-col border-r border-ink-700/70 bg-ink-900">
      <div className="space-y-2.5 border-b border-ink-700/70 p-3">
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
        <div className="flex gap-1.5">
          <div className="flex-1">
            <Seg value={sort} onChange={setSort} options={[{ v: "time", label: "Waktu" }, { v: "name", label: "Nama" }]} />
          </div>
          <div className="flex-1">
            <Seg value={filter} onChange={setFilter} options={[{ v: "all", label: "Semua" }, { v: "unused", label: "Belum" }]} />
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2" onClick={(e) => e.target === e.currentTarget && set({ libSel: [] })}>
        {!photos.length && !importing && (
          <div className="mt-10 px-4 text-center text-xs leading-relaxed text-ink-400">
            Import foto atau satu folder sesi pemotretan.
            <br />
            JPG / PNG / WEBP, orientasi EXIF otomatis.
          </div>
        )}
        <div className="grid grid-cols-3 gap-1.5">
          {list.map((p, i) => {
            const selected = libSel.includes(p.id);
            const used = usage.get(p.id) ?? 0;
            return (
              <div
                key={p.id}
                onPointerDown={(e) => e.button === 0 && !e.shiftKey && !e.ctrlKey && startPhotoDrag(e, selected ? libSel : [p.id])}
                onClick={(e) => click(e, i, p.id)}
                onDoubleClick={() => dblClick(p.id)}
                title={p.name}
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

      {libSel.length > 0 && (
        <div className="flex items-center gap-2 border-t border-ink-700/70 p-2.5">
          <span className="flex-1 text-xs text-ink-300">{libSel.length} dipilih</span>
          <Btn variant="primary" onClick={() => addToPage(useStore.getState().pageIdx, libSel.slice(0, 12))} title="Maksimal 12 foto per halaman">
            <LayoutGrid size={14} /> Isi ke halaman
          </Btn>
        </div>
      )}
    </aside>
  );
}
