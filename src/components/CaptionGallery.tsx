import { memo, useEffect, useMemo, useRef, useState } from "react";
import { uid, useStore } from "../store";
import type { Format, Page, Photo, TextItem } from "../types";
import { CAPTION_CATS, CAPTIONS, makeCaption, type Caption, type CaptionCat } from "../lib/captions";
import { docSize } from "../lib/formats";
import { getImg, onImageLoaded } from "../lib/images";
import { renderPage, textBox } from "../lib/render";

const PV_W = 146;
const PV_H = 110;
const measure = (t: Omit<TextItem, "id">) => textBox({ ...t, id: "" }).h;

/** Pratinjau satu template: dirender sungguhan di atas foto halaman ini, dipotong di sekitar teksnya. */
const Preview = memo(function Preview({ cap, f, fonts, bgId, photos, tick }: { cap: Caption; f: Format; fonts: string[]; bgId: string | null; photos: Map<string, Photo>; tick: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const el = ref.current!;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setSeen(true), { rootMargin: "200px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!seen) return;
    const c = ref.current!;
    const { W, H } = docSize(f);
    const { texts, overlays } = makeCaption(f, fonts, cap, "", measure);
    const page: Page = {
      id: "",
      layoutId: null,
      cells: [],
      texts: texts.map((t, i) => ({ ...t, id: `t${i}` })),
      overlays: overlays.map((o, i) => ({ ...o, id: `o${i}` })),
      bg: { type: "linear", angle: 135, stops: [{ pos: 0, color: "#8a7461", alpha: 1 }, { pos: 1, color: "#2c2622", alpha: 1 }] },
      bgPhoto: bgId ? { photoId: bgId, opacity: 1, blur: 0 } : null,
      gutter: 0,
      margin: 0,
      radius: 0,
    };
    // jendela pratinjau: area di sekitar teks, rasio kartu
    const ys = page.texts.map((t) => t.y);
    const ye = page.texts.map((t) => t.y + measure(t));
    const xs = page.texts.map((t) => t.x);
    const x0 = Math.min(...xs, ...page.overlays.map((o) => o.x));
    const x1 = Math.max(...page.texts.map((t) => t.x + t.w), ...page.overlays.map((o) => o.x + o.w));
    const y0 = Math.min(...ys);
    const y1 = Math.max(...ye);
    const ratio = PV_W / PV_H;
    let vw = Math.min(W, Math.max((x1 - x0) * 1.15, H * 0.5 * ratio));
    let vh = vw / ratio;
    if (vh > H) {
      vh = H;
      vw = vh * ratio;
    }
    if (vh < (y1 - y0) * 1.15) {
      vh = Math.min(H, (y1 - y0) * 1.15);
      vw = Math.min(W, vh * ratio);
    }
    const ox = Math.min(W - vw, Math.max(0, (x0 + x1) / 2 - vw / 2));
    const oy = Math.min(H - vh, Math.max(0, (y0 + y1) / 2 - vh / 2));
    const dpr = window.devicePixelRatio || 1;
    const s = (PV_W / vw) * dpr;
    c.width = Math.round(PV_W * dpr);
    c.height = Math.round((vh / vw) * PV_W * dpr);
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#2c2622";
    ctx.fillRect(0, 0, c.width, c.height);
    renderPage(ctx, f, page, { scale: s, photos, image: (p) => getImg(p.thumb), offsetX: ox, offsetY: oy });
  }, [seen, cap, f, fonts, bgId, photos, tick]);

  return <canvas ref={ref} style={{ height: PV_H }} className="block w-full bg-ink-800 object-cover" />;
});

export function CaptionGallery() {
  const project = useStore((s) => s.project)!;
  const pageIdx = useStore((s) => s.pageIdx);
  const fontList = useStore((s) => s.fonts);
  const photoList = useStore((s) => s.photos);
  const commit = useStore((s) => s.commit);
  const [cat, setCat] = useState<CaptionCat | "all">("all");
  const [tick, setTick] = useState(0);
  useEffect(() => onImageLoaded(() => setTick((t) => t + 1)), []);

  const f = project.format;
  const page = project.pages[pageIdx];
  const fonts = useMemo(() => fontList.map((x) => x.name), [fontList]);
  const photos = useMemo(() => new Map(photoList.map((p) => [p.id, p])), [photoList]);
  const bgId = page.cells.find((c) => c.photoId)?.photoId ?? page.bgPhoto?.photoId ?? null;
  const list = cat === "all" ? CAPTIONS : CAPTIONS.filter((c) => c.cat === cat);

  const add = (cap: Caption) => {
    const group = uid();
    const { texts, overlays } = makeCaption(f, fonts, cap, group, measure);
    const items = texts.map((t) => ({ ...t, id: uid() }));
    commit((p) => {
      const pg = p.pages[pageIdx];
      pg.overlays.push(...overlays.map((o) => ({ ...o, id: uid() })));
      pg.texts.push(...items);
    });
    useStore.getState().select({ kind: "text", id: items[0].id });
  };

  const chip = (v: CaptionCat | "all", label: string, n: number) => (
    <button
      key={v}
      onClick={() => setCat(v)}
      className={`rounded-full px-2.5 py-1 text-[11px] ring-1 transition-colors ${cat === v ? "bg-accent text-on-accent ring-accent" : "bg-ink-800 text-ink-300 ring-ink-700 hover:text-ink-100"}`}
    >
      {label} <span className="tabular-nums opacity-70">{n}</span>
    </button>
  );

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap gap-1">
        {chip("all", "Semua", CAPTIONS.length)}
        {CAPTION_CATS.map((c) => chip(c, c, CAPTIONS.filter((x) => x.cat === c).length))}
      </div>
      <div className="max-h-[460px] overflow-y-auto pr-0.5">
        <div className="grid grid-cols-2 gap-1.5">
          {list.map((c) => (
            <button key={c.id} onClick={() => add(c)} title={`Tambahkan "${c.name}"`} className="overflow-hidden rounded-md bg-ink-800 text-left ring-1 ring-ink-700 transition-shadow hover:ring-2 hover:ring-accent">
              <Preview cap={c} f={f} fonts={fonts} bgId={bgId} photos={photos} tick={tick} />
              <div className="truncate px-1.5 py-1 text-[10px] text-ink-300">{c.name}</div>
            </button>
          ))}
        </div>
      </div>
      <p className="text-[10px] leading-relaxed text-ink-400">Semua bagian template bergeser bersama saat diseret. Tahan Alt untuk menggeser satu bagian saja. Kotak/latar template bisa diatur di tab Gradient.</p>
    </div>
  );
}
