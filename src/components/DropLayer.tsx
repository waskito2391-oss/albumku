import { getCurrentWebview } from "@tauri-apps/api/webview";
import { useEffect, useMemo } from "react";
import { useStore } from "../store";
import { importDropped } from "../lib/actions";
import { dropTarget, useDrag } from "../lib/dnd";
import { fileUrl } from "../lib/images";
import { ImagePlus, LayoutGrid } from "./icons";

/** Dengarkan file/folder yang diseret dari Windows Explorer ke jendela aplikasi. */
export function useExplorerDrop() {
  useEffect(() => {
    let count = 0;
    const un = getCurrentWebview().onDragDropEvent((ev) => {
      const p = ev.payload;
      const st = useStore.getState();
      if (!st.project) return;
      if (p.type === "leave") {
        useDrag.setState({ fileDrag: null });
        dropTarget()?.leave();
        return;
      }
      // posisi dari Tauri dalam piksel fisik
      const dpr = window.devicePixelRatio || 1;
      const x = p.position.x / dpr;
      const y = p.position.y / dpr;
      const t = dropTarget();
      const overCanvas = !!t?.hit(x, y);
      if (p.type === "enter") count = p.paths.length;
      if (p.type === "enter" || p.type === "over") {
        useDrag.setState({ fileDrag: { x, y, count, overCanvas } });
        if (overCanvas) t!.hover(x, y);
        else t?.leave();
        return;
      }
      // drop
      useDrag.setState({ fileDrag: null });
      const cell = overCanvas ? t!.cellAt(x, y) : -1;
      t?.leave();
      importDropped(p.paths, overCanvas ? { cell } : null);
    });
    return () => {
      un.then((f) => f());
    };
  }, []);
}

/** Overlay petunjuk drop + bayangan foto yang sedang diseret dari pustaka. */
export function DropLayer() {
  const drag = useDrag((s) => s.drag);
  const fileDrag = useDrag((s) => s.fileDrag);
  const photos = useStore((s) => s.photos);
  const map = useMemo(() => new Map(photos.map((p) => [p.id, p])), [photos]);

  return (
    <>
      {fileDrag && (
        <div className="pointer-events-none fixed inset-0 z-[60] flex items-end justify-center bg-black/25 p-6">
          <div className="absolute inset-3 rounded-xl border-2 border-dashed border-accent/80" />
          <div className="relative flex items-center gap-3 rounded-lg bg-ink-900 px-5 py-3 shadow-[0_16px_40px_rgb(var(--shadow)/0.5)] ring-1 ring-ink-700">
            {fileDrag.overCanvas ? <LayoutGrid size={22} className="text-accent" /> : <ImagePlus size={22} className="text-accent" />}
            <div>
              <div className="font-display text-[15px] text-ink-100">
                {fileDrag.overCanvas ? "Lepaskan untuk menyusun ke halaman ini" : "Lepaskan untuk import ke pustaka"}
              </div>
              <div className="text-xs text-ink-400">
                {fileDrag.count} item. Folder ikut dipindai; foto JPG, PNG, WEBP.
                {fileDrag.overCanvas ? " Satu foto di atas kotak foto langsung mengisinya." : " Lepas di kanvas untuk langsung disusun."}
              </div>
            </div>
          </div>
        </div>
      )}
      {drag && (
        <div className="pointer-events-none fixed z-[60]" style={{ left: drag.x + 14, top: drag.y + 14 }}>
          <div className="relative h-16 w-16">
            {drag.ids.slice(0, 3).map((id, i) => {
              const p = map.get(id);
              return p ? (
                <img
                  key={id}
                  src={fileUrl(p.thumb)}
                  className="absolute h-14 w-14 rounded-md object-cover shadow-lg ring-2 ring-ink-900"
                  style={{ left: i * 5, top: i * 5, transform: `rotate(${(i - 1) * 4}deg)` }}
                />
              ) : null;
            })}
            {drag.ids.length > 1 && (
              <span className="absolute -right-2 -top-2 rounded-full bg-accent px-1.5 text-[11px] font-semibold tabular-nums text-on-accent">{drag.ids.length}</span>
            )}
          </div>
        </div>
      )}
    </>
  );
}
