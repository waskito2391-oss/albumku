import type { Format, Page, Rect, Watermark } from "../types";
import { docSize, panelCols, panelRows } from "./formats";

type Ctx = CanvasRenderingContext2D;

export function defaultWatermark(fontFamily = "Segoe UI"): Watermark {
  return {
    on: true,
    mode: "text",
    text: "© Nama Studio",
    fontFamily,
    weight: 600,
    color: "#ffffff",
    imagePath: null,
    size: 0.3,
    opacity: 0.5,
    rotation: 0,
    pos: "br",
    tile: false,
    gap: 0.6,
    margin: 0.04,
    shadow: true,
  };
}

/** Apakah halaman ini diberi watermark. */
export const wmOnPage = (wm: Watermark, page: Page) => wm.on && (wm.scope !== "pick" || !!wm.pages?.includes(page.id));

export const wmFont = (wm: Watermark, size: number) => `${wm.weight} ${size}px "${wm.fontFamily}", "Segoe UI", sans-serif`;

/** Area tempat watermark dipasang: tiap slide/post untuk carousel & puzzle, selain itu seluruh area potong. */
function regions(f: Format): Rect[] {
  const b = f.bleed;
  if (f.kind === "carousel" || f.kind === "puzzle") {
    const out: Rect[] = [];
    for (let r = 0; r < panelRows(f); r++) for (let c = 0; c < panelCols(f); c++) out.push({ x: b + c * f.pageW, y: b + r * f.pageH, w: f.pageW, h: f.pageH });
    return out;
  }
  const { TW, TH } = docSize(f);
  return [{ x: b, y: b, w: TW, h: TH }];
}

let measureCtx: Ctx | null = null;

/** Ukuran watermark (lebar, tinggi, ukuran font) di area dengan sisi pendek `S`. */
function wmSize(wm: Watermark, img: CanvasImageSource | null, S: number) {
  const w = Math.max(1, wm.size * S);
  if (wm.mode === "image") {
    const im = img as HTMLImageElement;
    const iw = im.naturalWidth || (im.width as number);
    const ih = im.naturalHeight || (im.height as number);
    return { w, h: (w * ih) / Math.max(1, iw), fs: 0 };
  }
  if (!measureCtx) measureCtx = document.createElement("canvas").getContext("2d")!;
  measureCtx.font = wmFont(wm, 100);
  const fs = (100 * w) / Math.max(1, measureCtx.measureText(wm.text.trim()).width);
  return { w, h: fs * 1.15, fs };
}

export type WmItem = { r: Rect; cx: number; cy: number; w: number; h: number };

/** Letak watermark tunggal (bukan pola) di tiap area: titik tengah + ukuran, untuk digambar & diseret. */
export function wmItems(f: Format, wm: Watermark, img: CanvasImageSource | null): WmItem[] {
  if (!wm.on || wm.tile || (wm.mode === "image" ? !img : !wm.text.trim())) return [];
  const th = (wm.rotation * Math.PI) / 180;
  return regions(f).map((r) => {
    const S = Math.min(r.w, r.h);
    const { w, h } = wmSize(wm, img, S);
    if (wm.free) return { r, w, h, cx: r.x + wm.free.x * r.w, cy: r.y + wm.free.y * r.h };
    const m = wm.margin * S;
    const bw = Math.abs(w * Math.cos(th)) + Math.abs(h * Math.sin(th));
    const bh = Math.abs(w * Math.sin(th)) + Math.abs(h * Math.cos(th));
    const [v, hz] = wm.pos;
    const cx = hz === "l" ? r.x + m + bw / 2 : hz === "r" ? r.x + r.w - m - bw / 2 : r.x + r.w / 2;
    const cy = v === "t" ? r.y + m + bh / 2 : v === "b" ? r.y + r.h - m - bh / 2 : r.y + r.h / 2;
    return { r, w, h, cx, cy };
  });
}

/** Gambar watermark di atas semua isi halaman. `img` = logo yang sudah termuat (mode gambar). */
export function drawWatermark(ctx: Ctx, f: Format, wm: Watermark, img: CanvasImageSource | null) {
  if (!wm.on) return;
  const text = wm.text.trim();
  if (wm.mode === "image" ? !img : !text) return;
  const devScale = ctx.getTransform().a;
  const th = (wm.rotation * Math.PI) / 180;
  const single = wmItems(f, wm, img);

  regions(f).forEach((r, ri) => {
    const { w, h, fs } = wmSize(wm, img, Math.min(r.w, r.h));

    const item = (cx: number, cy: number) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(th);
      if (wm.mode === "image") ctx.drawImage(img!, -w / 2, -h / 2, w, h);
      else ctx.fillText(text, 0, 0);
      ctx.restore();
    };

    ctx.save();
    ctx.beginPath();
    ctx.rect(r.x, r.y, r.w, r.h);
    ctx.clip();
    ctx.globalAlpha = wm.opacity;
    if (wm.mode === "text") {
      ctx.font = wmFont(wm, fs);
      ctx.fillStyle = wm.color;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
    }
    if (wm.shadow) {
      // shadow tidak ikut transformasi kanvas -> skalakan manual
      ctx.shadowColor = "rgba(0,0,0,0.45)";
      ctx.shadowBlur = h * 0.12 * devScale;
      ctx.shadowOffsetY = h * 0.03 * devScale;
    }

    if (wm.tile) {
      // grid di sumbu yang diputar, baris selang-seling digeser setengah langkah
      const sx = w * (1 + wm.gap);
      const sy = h * (1 + wm.gap * 2);
      const R = Math.hypot(r.w, r.h) / 2;
      const cx = r.x + r.w / 2;
      const cy = r.y + r.h / 2;
      const nx = Math.ceil(R / sx) + 1;
      const ny = Math.ceil(R / sy) + 1;
      for (let j = -ny; j <= ny; j++)
        for (let i = -nx; i <= nx; i++) {
          const ux = (i + (j & 1 ? 0.5 : 0)) * sx;
          const uy = j * sy;
          item(cx + ux * Math.cos(th) - uy * Math.sin(th), cy + ux * Math.sin(th) + uy * Math.cos(th));
        }
    } else if (single[ri]) item(single[ri].cx, single[ri].cy);
    ctx.restore();
  });
}
