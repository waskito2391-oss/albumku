import { ImagePlus } from "./icons";
import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../store";
import type { Page, Rect } from "../types";
import { addToPage, setCellPhoto } from "../lib/actions";
import { registerDropTarget } from "../lib/dnd";
import { cellRect, contentRect, docSize } from "../lib/formats";
import { getImg, onImageLoaded } from "../lib/images";
import { fontString, photoPlacement, renderPage, textBox } from "../lib/render";
import { smartOffset } from "../lib/fit";
import { wmFont } from "../lib/watermark";
import { dragCell, edgeCursor, edgesAt, type Edges } from "../lib/celledit";

type Pt = { x: number; y: number };
type Drag =
  | { mode: "cell"; cell: number; e: Edges; sx: number; sy: number; r0: Rect }
  | { mode: "pan"; cell: number; sx: number; sy: number; ox: number; oy: number; slackX: number; slackY: number; th: number }
  | { mode: "move"; kind: "text" | "overlay"; id: string; sx: number; sy: number; x0: number; y0: number }
  | { mode: "resize"; kind: "text" | "overlay"; handle: "corner" | "edge"; id: string; sx: number; sy: number; w0: number; h0: number; fs0: number; rot: number };


const inRect = (p: Pt, r: Rect) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

function toLocal(p: Pt, b: Rect, rot: number): Pt {
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  const a = (-rot * Math.PI) / 180;
  const dx = p.x - cx;
  const dy = p.y - cy;
  return { x: cx + dx * Math.cos(a) - dy * Math.sin(a), y: cy + dx * Math.sin(a) + dy * Math.cos(a) };
}

export function Canvas() {
  const project = useStore((s) => s.project)!;
  const pageIdx = useStore((s) => s.pageIdx);
  const sel = useStore((s) => s.sel);
  const guides = useStore((s) => s.guides);
  const zoom = useStore((s) => s.zoom);
  const photos = useStore((s) => s.photos);
  const fontTick = useStore((s) => s.fontTick);
  const tab = useStore((s) => s.tab);
  const cellEdit = useStore((s) => s.cellEdit) && tab === "layout";
  const f = project.format;
  const page = project.pages[pageIdx];
  const wm = project.watermark;
  const photoMap = useMemo(() => new Map(photos.map((p) => [p.id, p])), [photos]);

  const wrap = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const [box, setBox] = useState({ w: 900, h: 600 });
  const [tick, setTick] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const drag = useRef<Drag | null>(null);

  const { W, H } = docSize(f);
  const fit = Math.min((box.w - 72) / W, (box.h - 72) / H);
  const scale = Math.max(0.01, fit * zoom);
  const cur = useRef({ page, scale });
  cur.current = { page, scale };

  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setBox({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(wrap.current!);
    return () => ro.disconnect();
  }, []);
  useEffect(() => onImageLoaded(() => setTick((t) => t + 1)), []);

  const fontKey = page.texts.map((t) => `${t.fontFamily}${t.weight}${t.italic}`).join("|");
  useEffect(() => {
    let alive = true;
    Promise.all(page.texts.map((t) => document.fonts.load(fontString(t, 40)).catch(() => null))).then(() => alive && setTick((x) => x + 1));
    return () => {
      alive = false;
    };
  }, [fontKey]);

  const wmKey = wm?.on && wm.mode === "text" ? wmFont(wm, 40) : "";
  useEffect(() => {
    if (!wmKey) return;
    let alive = true;
    document.fonts.load(wmKey).catch(() => null).then(() => alive && setTick((x) => x + 1));
    return () => {
      alive = false;
    };
  }, [wmKey]);

  const toDoc = (e: { clientX: number; clientY: number }): Pt => {
    const r = cv.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) / cur.current.scale, y: (e.clientY - r.top) / cur.current.scale };
  };
  const cellAt = (pt: Pt, pg: Page = cur.current.page) => pg.cells.findIndex((c) => inRect(pt, cellRect(f, pg, c)));

  /* ---------- gambar ---------- */
  useEffect(() => {
    const c = cv.current!;
    const dpr = window.devicePixelRatio || 1;
    const pw = Math.round(W * scale * dpr);
    const ph = Math.round(H * scale * dpr);
    if (c.width !== pw) c.width = pw;
    if (c.height !== ph) c.height = ph;
    c.style.width = `${W * scale}px`;
    c.style.height = `${H * scale}px`;
    const ctx = c.getContext("2d")!;
    const s = scale * dpr;
    renderPage(ctx, f, page, {
      scale: s,
      photos: photoMap,
      image: (p) => getImg(p.thumb),
      editor: true,
      guides,
      watermark: wm?.on ? { wm, image: wm.imagePath ? getImg(wm.imagePath) : null } : undefined,
    });

    const lw = 2 / s;
    const hs = (9 * dpr) / s;
    const handle = (x: number, y: number) => {
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "#e3b341";
      ctx.lineWidth = lw;
      ctx.fillRect(x - hs / 2, y - hs / 2, hs, hs);
      ctx.strokeRect(x - hs / 2, y - hs / 2, hs, hs);
    };
    ctx.save();
    if (cellEdit) {
      // mode edit kotak: semua kotak diberi garis + nomor supaya terlihat walau kosong/bertumpuk
      ctx.setLineDash([6 / s, 4 / s]);
      ctx.lineWidth = lw * 0.75;
      ctx.font = `600 ${12 / scale}px "Segoe UI", sans-serif`;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      page.cells.forEach((c, i) => {
        const r = cellRect(f, page, c);
        ctx.strokeStyle = "rgba(227,179,65,0.9)";
        ctx.strokeRect(r.x, r.y, r.w, r.h);
        const pad = 5 / scale;
        const tw = ctx.measureText(String(i + 1)).width;
        ctx.fillStyle = "rgba(20,20,24,0.75)";
        ctx.fillRect(r.x + pad, r.y + pad, tw + 8 / scale, 16 / scale);
        ctx.fillStyle = "#e3b341";
        ctx.fillText(String(i + 1), r.x + pad + 4 / scale, r.y + pad + 2 / scale);
      });
      ctx.setLineDash([]);
    }
    if (hover != null && page.cells[hover]) {
      const r = cellRect(f, page, page.cells[hover]);
      ctx.fillStyle = "rgba(227,179,65,0.28)";
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = "#e3b341";
      ctx.lineWidth = lw * 2;
      ctx.strokeRect(r.x, r.y, r.w, r.h);
    }
    if (sel?.kind === "cell" && page.cells[sel.index]) {
      const sc = page.cells[sel.index];
      const r = cellRect(f, page, sc);
      ctx.strokeStyle = "#e3b341";
      ctx.lineWidth = lw * 1.5;
      ctx.strokeRect(r.x, r.y, r.w, r.h);
      if (cellEdit) for (const [hx, hy] of [[0, 0], [0.5, 0], [1, 0], [0, 0.5], [1, 0.5], [0, 1], [0.5, 1], [1, 1]]) handle(r.x + r.w * hx, r.y + r.h * hy);
      if (sc.photoId && (sc.rot ?? 0) % 90 !== 0) {
        // grid bantu meluruskan (garis horizon / tiang harus sejajar)
        ctx.strokeStyle = "rgba(255,255,255,0.55)";
        ctx.lineWidth = lw * 0.6;
        ctx.beginPath();
        for (let i = 1; i < 6; i++) {
          ctx.moveTo(r.x + (r.w * i) / 6, r.y);
          ctx.lineTo(r.x + (r.w * i) / 6, r.y + r.h);
          ctx.moveTo(r.x, r.y + (r.h * i) / 6);
          ctx.lineTo(r.x + r.w, r.y + (r.h * i) / 6);
        }
        ctx.stroke();
      }
    }
    if (sel?.kind === "text") {
      const t = page.texts.find((x) => x.id === sel.id);
      if (t) {
        const b = textBox(t);
        ctx.translate(b.x + b.w / 2, b.y + b.h / 2);
        ctx.rotate((t.rotation * Math.PI) / 180);
        ctx.strokeStyle = "#e3b341";
        ctx.lineWidth = lw;
        ctx.setLineDash([6 / s, 4 / s]);
        ctx.strokeRect(-b.w / 2, -b.h / 2, b.w, b.h);
        ctx.setLineDash([]);
        handle(b.w / 2, 0);
        handle(b.w / 2, b.h / 2);
      }
    }
    if (sel?.kind === "overlay") {
      const o = page.overlays.find((x) => x.id === sel.id);
      if (o) {
        ctx.strokeStyle = "#e3b341";
        ctx.lineWidth = lw;
        ctx.setLineDash([6 / s, 4 / s]);
        ctx.strokeRect(o.x, o.y, o.w, o.h);
        ctx.setLineDash([]);
        handle(o.x + o.w, o.y + o.h);
      }
    }
    ctx.restore();
  }, [page, scale, sel, tick, guides, hover, photoMap, f, fontTick, W, H, wm, cellEdit]);

  /* ---------- zoom foto (scroll) & zoom tampilan (Ctrl+scroll) ---------- */
  useEffect(() => {
    const el = wrap.current!;
    const h = (e: WheelEvent) => {
      const st = useStore.getState();
      if (e.ctrlKey) {
        e.preventDefault();
        st.set({ zoom: clamp(st.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1), 0.25, 4) });
        return;
      }
      if (!cv.current || e.target !== cv.current) return;
      const pt = toDoc(e);
      const pg = cur.current.page;
      const ci = cellAt(pt, pg);
      if (ci < 0 || !pg.cells[ci].photoId) return;
      e.preventDefault();
      const idx = st.pageIdx;
      st.commit((d) => {
        const c = d.pages[idx].cells[ci];
        c.zoom = clamp(c.zoom * (e.deltaY < 0 ? 1.06 : 1 / 1.06), 1, 5);
      }, `zoom-${pg.id}-${ci}`);
      st.select({ kind: "cell", index: ci });
    };
    el.addEventListener("wheel", h, { passive: false });
    return () => el.removeEventListener("wheel", h);
  }, []);

  /* ---------- pointer ---------- */
  const onDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const st = useStore.getState();
    const pt = toDoc(e);
    const begin = (d: Drag) => {
      drag.current = d;
      st.beginGesture();
      (e.target as Element).setPointerCapture(e.pointerId);
    };

    // mode edit kotak: pegangan kotak terpilih didahulukan (boleh sedikit di luar kotak)
    const cellDrag = (i: number, e: Edges) => {
      st.select({ kind: "cell", index: i });
      const c = page.cells[i];
      begin({ mode: "cell", cell: i, e, sx: pt.x, sy: pt.y, r0: { x: c.x, y: c.y, w: c.w, h: c.h } });
    };
    const tol = 8 / scale;
    if (cellEdit && sel?.kind === "cell" && page.cells[sel.index]) {
      const e = edgesAt(pt, cellRect(f, page, page.cells[sel.index]), tol);
      if (e && (e.l || e.r || e.t || e.b)) return cellDrag(sel.index, e);
    }

    // pegangan resize pada objek terpilih
    if (sel?.kind === "text") {
      const t = page.texts.find((x) => x.id === sel.id);
      if (t) {
        const b = textBox(t);
        const lp = toLocal(pt, b, t.rotation);
        const tol = 12 / scale;
        const nearX = Math.abs(lp.x - (b.x + b.w)) < tol;
        if (nearX && Math.abs(lp.y - (b.y + b.h)) < tol)
          return begin({ mode: "resize", kind: "text", handle: "corner", id: t.id, sx: lp.x, sy: lp.y, w0: t.w, h0: b.h, fs0: t.fontSize, rot: t.rotation });
        if (nearX && Math.abs(lp.y - (b.y + b.h / 2)) < tol)
          return begin({ mode: "resize", kind: "text", handle: "edge", id: t.id, sx: lp.x, sy: lp.y, w0: t.w, h0: b.h, fs0: t.fontSize, rot: t.rotation });
      }
    }
    if (sel?.kind === "overlay") {
      const o = page.overlays.find((x) => x.id === sel.id);
      if (o && Math.hypot(pt.x - (o.x + o.w), pt.y - (o.y + o.h)) < 14 / scale)
        return begin({ mode: "resize", kind: "overlay", handle: "corner", id: o.id, sx: pt.x, sy: pt.y, w0: o.w, h0: o.h, fs0: 0, rot: 0 });
    }
    for (let i = page.texts.length - 1; i >= 0; i--) {
      const t = page.texts[i];
      const b = textBox(t);
      if (inRect(toLocal(pt, b, t.rotation), b)) {
        st.select({ kind: "text", id: t.id });
        st.set({ tab: "text" });
        return begin({ mode: "move", kind: "text", id: t.id, sx: pt.x, sy: pt.y, x0: t.x, y0: t.y });
      }
    }
    // overlay hanya bisa diklik saat tab Gradient aktif (supaya tidak menghalangi foto)
    if (tab === "gradient") {
      for (let i = page.overlays.length - 1; i >= 0; i--) {
        const o = page.overlays[i];
        if (inRect(pt, o)) {
          st.select({ kind: "overlay", id: o.id });
          return begin({ mode: "move", kind: "overlay", id: o.id, sx: pt.x, sy: pt.y, x0: o.x, y0: o.y });
        }
      }
    }
    if (cellEdit) {
      // kotak paling atas yang kena (kotak boleh bertumpuk)
      for (let i = page.cells.length - 1; i >= 0; i--) {
        const e = edgesAt(pt, cellRect(f, page, page.cells[i]), tol);
        if (e) return cellDrag(i, e);
      }
      st.select(null);
      return;
    }
    const ci = cellAt(pt);
    if (ci >= 0) {
      st.select({ kind: "cell", index: ci });
      if (tab !== "layout") st.set({ tab: "layout" });
      const c = page.cells[ci];
      const ph = c.photoId ? photoMap.get(c.photoId) : undefined;
      if (ph) {
        const p = photoPlacement(cellRect(f, page, c), ph.width, ph.height, c);
        begin({ mode: "pan", cell: ci, sx: pt.x, sy: pt.y, ox: c.ox, oy: c.oy, slackX: p.slackX, slackY: p.slackY, th: p.th });
      }
      return;
    }
    st.select(null);
  };

  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    const pt = toDoc(e);
    const st = useStore.getState();
    const idx = st.pageIdx;
    if (!d) {
      const overText = page.texts.some((t) => {
        const b = textBox(t);
        return inRect(toLocal(pt, b, t.rotation), b);
      });
      if (cellEdit && !overText) {
        const tol = 8 / scale;
        let e: Edges | null = null;
        if (sel?.kind === "cell" && page.cells[sel.index]) e = edgesAt(pt, cellRect(f, page, page.cells[sel.index]), tol);
        for (let i = page.cells.length - 1; i >= 0 && !e; i--) e = edgesAt(pt, cellRect(f, page, page.cells[i]), tol);
        cv.current!.style.cursor = e ? edgeCursor(e) : "default";
        return;
      }
      cv.current!.style.cursor = overText ? "move" : cellAt(pt) >= 0 ? "grab" : "default";
      return;
    }
    const dx = pt.x - d.sx;
    const dy = pt.y - d.sy;
    if (d.mode === "cell") {
      const cr = contentRect(f, page);
      const others = page.cells.filter((_, i) => i !== d.cell);
      // Alt = tanpa menempel
      const r = dragCell(d.r0, dx / cr.w, dy / cr.h, d.e, others, 8 / scale / cr.w, 8 / scale / cr.h, !e.altKey);
      st.live((p) => {
        Object.assign(p.pages[idx].cells[d.cell], r);
        p.pages[idx].layoutId = null;
      });
    } else if (d.mode === "pan") {
      const ci = cellAt(pt);
      if (ci >= 0 && ci !== d.cell) {
        // di atas sel lain -> mode tukar foto
        if (hover !== ci) setHover(ci);
        st.live((p) => {
          const c = p.pages[idx].cells[d.cell];
          c.ox = d.ox;
          c.oy = d.oy;
        });
        cv.current!.style.cursor = "copy";
        return;
      }
      if (hover !== null) setHover(null);
      cv.current!.style.cursor = "grabbing";
      // gerakan mouse diterjemahkan ke sumbu foto yang sedang diputar
      const lx = dx * Math.cos(d.th) + dy * Math.sin(d.th);
      const ly = -dx * Math.sin(d.th) + dy * Math.cos(d.th);
      st.live((p) => {
        const c = p.pages[idx].cells[d.cell];
        if (d.slackX > 0.5) c.ox = clamp(d.ox - (2 * lx) / d.slackX, -1, 1);
        if (d.slackY > 0.5) c.oy = clamp(d.oy - (2 * ly) / d.slackY, -1, 1);
      });
    } else if (d.mode === "move") {
      st.live((p) => {
        const pg = p.pages[idx];
        const o = d.kind === "text" ? pg.texts.find((x) => x.id === d.id) : pg.overlays.find((x) => x.id === d.id);
        if (o) {
          o.x = d.x0 + dx;
          o.y = d.y0 + dy;
        }
      });
    } else {
      st.live((p) => {
        const pg = p.pages[idx];
        if (d.kind === "text") {
          const t = pg.texts.find((x) => x.id === d.id);
          if (!t) return;
          const b = textBox(t);
          const lp = toLocal(pt, b, d.rot);
          const ddx = lp.x - d.sx;
          if (d.handle === "edge") t.w = Math.max(40, d.w0 + ddx);
          else {
            const k = Math.max(0.1, (d.w0 + ddx) / d.w0);
            t.w = d.w0 * k;
            t.fontSize = Math.max(4, Math.round(d.fs0 * k));
          }
        } else {
          const o = pg.overlays.find((x) => x.id === d.id);
          if (o) {
            o.w = Math.max(20, d.w0 + dx);
            o.h = Math.max(20, d.h0 + dy);
          }
        }
      });
    }
  };

  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    const st = useStore.getState();
    if (d?.mode === "pan" && hover !== null) {
      const idx = st.pageIdx;
      const to = hover;
      st.live((p) => {
        const cs = p.pages[idx].cells;
        const a = cs[d.cell];
        const b = cs[to];
        [a.photoId, b.photoId] = [b.photoId, a.photoId];
        [a.rot, b.rot] = [b.rot ?? 0, a.rot ?? 0];
        for (const c of [a, b]) Object.assign(c, { zoom: 1, ...smartOffset(p.format, p.pages[idx], c, st.smartCrop && c.photoId ? photoMap.get(c.photoId) : null) });
      });
      st.select({ kind: "cell", index: to });
    }
    setHover(null);
    if (d) st.endGesture();
  };

  const onDouble = (e: React.MouseEvent) => {
    const st = useStore.getState();
    if (sel?.kind === "text") {
      st.set({ tab: "text", focusText: Date.now() });
      return;
    }
    const ci = cellAt(toDoc(e));
    if (ci >= 0) {
      const idx = st.pageIdx;
      st.commit((p) => Object.assign(p.pages[idx].cells[ci], { zoom: 1, ox: 0, oy: 0 }));
    }
  };

  /* ---------- target drop: foto dari pustaka & file dari Explorer ---------- */
  useEffect(
    () =>
      registerDropTarget({
        hit: (x, y) => {
          const r = wrap.current?.getBoundingClientRect();
          return !!r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
        },
        cellAt: (x, y) => (cv.current ? cellAt(toDoc({ clientX: x, clientY: y })) : -1),
        hover: (x, y) => {
          const ci = cv.current ? cellAt(toDoc({ clientX: x, clientY: y })) : -1;
          setHover(ci >= 0 ? ci : null);
        },
        leave: () => setHover(null),
        drop: (x, y, ids) => {
          setHover(null);
          if (!ids.length) return;
          const st = useStore.getState();
          const idx = st.pageIdx;
          const ci = cellAt(toDoc({ clientX: x, clientY: y }));
          if (ci >= 0 && ids.length === 1) {
            setCellPhoto(idx, ci, ids[0]);
            st.select({ kind: "cell", index: ci });
          } else addToPage(idx, ids);
        },
      }),
    [],
  );

  const empty = !page.cells.length && !page.texts.length;

  return (
    <div ref={wrap} className="relative min-h-0 flex-1 overflow-auto bg-stage">
      <div className="flex min-h-full min-w-full items-center justify-center p-9" style={{ width: W * scale + 72, height: H * scale + 72 }}>
        <canvas
          ref={cv}
          className="shadow-[0_10px_40px_rgb(var(--shadow)/0.45)]"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onDoubleClick={onDouble}
        />
      </div>
      {empty && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2 rounded-xl bg-ink-900/85 px-6 py-5 text-center ring-1 ring-ink-700">
            <ImagePlus className="text-accent" size={26} />
            <p className="text-sm text-ink-100">Seret foto dari pustaka atau langsung dari Windows Explorer</p>
            <p className="text-xs text-ink-400">Folder juga bisa. Atau pilih beberapa foto lalu klik "Isi ke halaman", atau pakai Auto Isi</p>
          </div>
        </div>
      )}
    </div>
  );
}
