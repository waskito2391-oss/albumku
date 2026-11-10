import type { Cell, Fill, Format, Overlay, Page, Photo, Rect, TextItem, Watermark } from "../types";
import { cellRect, docSize, mmToPx, panelCols, panelRows } from "./formats";
import { drawFrame, pageFrameRects } from "./frames";
import { drawWatermark, wmOnPage } from "./watermark";

type Ctx = CanvasRenderingContext2D;

export interface RenderOpts {
  /** skala dokumen -> piksel kanvas */
  scale: number;
  image: (photo: Photo) => CanvasImageSource | null;
  photos: Map<string, Photo>;
  editor?: boolean;
  guides?: boolean;
  /** geser asal (koordinat dokumen) — untuk merender satu potongan saja */
  offsetX?: number;
  offsetY?: number;
  /** watermark global + logonya (bila mode gambar) */
  watermark?: { wm: Watermark; image: CanvasImageSource | null };
}

export function rgba(hex: string, a: number) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h.slice(0, 6), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export function fillStyle(ctx: Ctx, fill: Fill, r: Rect): string | CanvasGradient {
  if (fill.type === "solid") return rgba(fill.color, fill.alpha);
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  let g: CanvasGradient;
  if (fill.type === "linear") {
    const a = (fill.angle * Math.PI) / 180;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    const L = (Math.abs(r.w * dx) + Math.abs(r.h * dy)) / 2;
    g = ctx.createLinearGradient(cx - dx * L, cy - dy * L, cx + dx * L, cy + dy * L);
  } else {
    g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.hypot(r.w, r.h) / 2);
  }
  for (const s of [...fill.stops].sort((a, b) => a.pos - b.pos)) g.addColorStop(Math.min(1, Math.max(0, s.pos)), rgba(s.color, s.alpha));
  return g;
}

export function fillCss(fill: Fill): string {
  if (fill.type === "solid") return rgba(fill.color, fill.alpha);
  const stops = [...fill.stops].sort((a, b) => a.pos - b.pos).map((s) => `${rgba(s.color, s.alpha)} ${Math.round(s.pos * 100)}%`).join(",");
  return fill.type === "linear" ? `linear-gradient(${fill.angle + 90}deg,${stops})` : `radial-gradient(circle,${stops})`;
}

function roundRect(ctx: Ctx, r: Rect, rad: number) {
  ctx.beginPath();
  if (rad > 0) ctx.roundRect(r.x, r.y, r.w, r.h, Math.min(rad, r.w / 2, r.h / 2));
  else ctx.rect(r.x, r.y, r.w, r.h);
}

/**
 * Posisi & ukuran gambar "cover" di dalam sel, mempertimbangkan zoom, geser & rotasi.
 * Saat diputar, foto otomatis diperbesar secukupnya agar sel tetap tertutup penuh (tanpa sudut kosong).
 * Geser (ox, oy) berlaku pada sumbu foto yang sudah diputar.
 */
export function photoPlacement(r: Rect, iw: number, ih: number, c: Cell) {
  const th = ((c.rot ?? 0) * Math.PI) / 180;
  const cs = Math.abs(Math.cos(th));
  const sn = Math.abs(Math.sin(th));
  const bw = r.w * cs + r.h * sn;
  const bh = r.w * sn + r.h * cs;
  const s = Math.max(bw / iw, bh / ih) * Math.max(1, c.zoom);
  const dw = iw * s;
  const dh = ih * s;
  const sx = dw - bw;
  const sy = dh - bh;
  const ux = (-c.ox * sx) / 2;
  const uy = (-c.oy * sy) / 2;
  const cx = r.x + r.w / 2 + ux * Math.cos(th) - uy * Math.sin(th);
  const cy = r.y + r.h / 2 + ux * Math.sin(th) + uy * Math.cos(th);
  return { cx, cy, th, x: cx - dw / 2, y: cy - dh / 2, w: dw, h: dh, slackX: sx, slackY: sy };
}

/**
 * Kebalikan photoPlacement: zoom & geser supaya foto tampil dengan pusat (cx, cy) dan skala `s`
 * di sel `r`. Zoom tidak boleh < 1 (sel harus tetap tertutup penuh), geser dibatasi -1..1.
 */
export function placementFor(r: Rect, iw: number, ih: number, rotDeg: number, target: { cx: number; cy: number; s: number }) {
  const th = (rotDeg * Math.PI) / 180;
  const cs = Math.abs(Math.cos(th));
  const sn = Math.abs(Math.sin(th));
  const bw = r.w * cs + r.h * sn;
  const bh = r.w * sn + r.h * cs;
  const base = Math.max(bw / iw, bh / ih);
  const zoom = Math.max(1, target.s / base);
  const s = base * zoom;
  const sx = iw * s - bw;
  const sy = ih * s - bh;
  const dx = target.cx - (r.x + r.w / 2);
  const dy = target.cy - (r.y + r.h / 2);
  const ux = dx * Math.cos(th) + dy * Math.sin(th);
  const uy = -dx * Math.sin(th) + dy * Math.cos(th);
  const cl = (v: number) => Math.max(-1, Math.min(1, v));
  return { zoom, ox: sx > 0.5 ? cl((-2 * ux) / sx) : 0, oy: sy > 0.5 ? cl((-2 * uy) / sy) : 0 };
}

function imgSize(im: CanvasImageSource): [number, number] {
  const a = im as HTMLImageElement;
  return [a.naturalWidth || (a.width as number), a.naturalHeight || (a.height as number)];
}

export function fontString(t: TextItem, size = t.fontSize) {
  return `${t.italic ? "italic " : ""}${t.weight} ${size}px "${t.fontFamily}", "Segoe UI", sans-serif`;
}

function applyTextStyle(ctx: Ctx, t: TextItem) {
  ctx.font = fontString(t);
  (ctx as any).letterSpacing = `${(t.letterSpacing / 100) * t.fontSize}px`;
}

/** Bungkus teks ke lebar kotak. */
export function textLines(ctx: Ctx, t: TextItem): string[] {
  applyTextStyle(ctx, t);
  const src = t.uppercase ? t.text.toUpperCase() : t.text;
  const out: string[] = [];
  for (const para of src.split("\n")) {
    const words = para.split(/(\s+)/).filter((w) => w.length);
    let line = "";
    for (const w of words) {
      const test = line + w;
      if (line.trim() && ctx.measureText(test.trimEnd()).width > t.w) {
        out.push(line.trimEnd());
        line = w.trimStart();
      } else line = test;
    }
    out.push(line.trimEnd());
  }
  return out;
}

let measureCtx: Ctx | null = null;
export function textBox(t: TextItem): Rect {
  if (!measureCtx) measureCtx = document.createElement("canvas").getContext("2d")!;
  const lines = textLines(measureCtx, t);
  return { x: t.x, y: t.y, w: t.w, h: Math.max(1, lines.length) * t.fontSize * t.lineHeight };
}

export function drawText(ctx: Ctx, t: TextItem, devScale: number) {
  const lines = textLines(ctx, t);
  const lh = t.fontSize * t.lineHeight;
  const box = { x: -t.w / 2, y: -(lines.length * lh) / 2, w: t.w, h: lines.length * lh };
  ctx.save();
  ctx.translate(t.x + t.w / 2, t.y + (lines.length * lh) / 2);
  ctx.rotate((t.rotation * Math.PI) / 180);
  ctx.globalAlpha *= t.opacity;
  ctx.textAlign = t.align;
  ctx.textBaseline = "middle";
  const ax = t.align === "left" ? box.x : t.align === "right" ? box.x + box.w : 0;
  const setShadow = (on: boolean) => {
    if (on && t.shadow.on) {
      ctx.shadowColor = rgba(t.shadow.color, t.shadow.alpha);
      // shadow tidak ikut transformasi kanvas -> skalakan manual
      ctx.shadowBlur = t.shadow.blur * devScale;
      ctx.shadowOffsetX = t.shadow.dx * devScale;
      ctx.shadowOffsetY = t.shadow.dy * devScale;
    } else {
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    }
  };
  if (t.stroke.on && t.stroke.width > 0) {
    setShadow(true);
    ctx.lineJoin = "round";
    ctx.lineWidth = t.stroke.width;
    ctx.strokeStyle = t.stroke.color;
    lines.forEach((l, i) => ctx.strokeText(l, ax, box.y + (i + 0.5) * lh));
    setShadow(false);
  } else setShadow(true);
  ctx.fillStyle = fillStyle(ctx, t.fill, box);
  lines.forEach((l, i) => ctx.fillText(l, ax, box.y + (i + 0.5) * lh));
  ctx.restore();
}

export function drawOverlay(ctx: Ctx, o: Overlay) {
  ctx.save();
  ctx.globalAlpha *= o.opacity;
  if (o.rotation) {
    const cx = o.x + o.w / 2;
    const cy = o.y + o.h / 2;
    ctx.translate(cx, cy);
    ctx.rotate((o.rotation * Math.PI) / 180);
    ctx.translate(-cx, -cy);
  }
  ctx.fillStyle = fillStyle(ctx, o.fill, o);
  roundRect(ctx, o, o.radius);
  ctx.fill();
  ctx.restore();
}

export function renderPage(ctx: Ctx, f: Format, page: Page, o: RenderOpts) {
  const { W, H, TW, TH } = docSize(f);
  ctx.setTransform(o.scale, 0, 0, o.scale, -(o.offsetX ?? 0) * o.scale, -(o.offsetY ?? 0) * o.scale);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.globalAlpha = 1;
  ctx.fillStyle = fillStyle(ctx, page.bg, { x: 0, y: 0, w: W, h: H });
  ctx.fillRect(0, 0, W, H);

  const bp = page.bgPhoto;
  const bph = bp ? o.photos.get(bp.photoId) : undefined;
  const bim = bph ? o.image(bph) : null;
  if (bp && bim) {
    const [iw, ih] = imgSize(bim);
    const blur = bp.blur * Math.min(W, H) * 0.03;
    // saat diblur gambar diperbesar sedikit supaya tepinya tidak memudar
    const s = Math.max((W + blur * 4) / iw, (H + blur * 4) / ih);
    ctx.save();
    ctx.globalAlpha = bp.opacity;
    if (blur > 0) ctx.filter = `blur(${blur * o.scale}px)`;
    ctx.drawImage(bim, (W - iw * s) / 2, (H - ih * s) / 2, iw * s, ih * s);
    ctx.restore();
  }

  page.cells.forEach((c) => {
    const r = cellRect(f, page, c);
    const photo = c.photoId ? o.photos.get(c.photoId) : undefined;
    const im = photo ? o.image(photo) : null;
    ctx.save();
    roundRect(ctx, r, page.radius);
    ctx.clip();
    if (im) {
      const [iw, ih] = imgSize(im);
      const p = photoPlacement(r, iw, ih, c);
      if (p.th) {
        ctx.translate(p.cx, p.cy);
        ctx.rotate(p.th);
        ctx.drawImage(im, -p.w / 2, -p.h / 2, p.w, p.h);
      } else ctx.drawImage(im, p.x, p.y, p.w, p.h);
    } else if (o.editor) {
      ctx.fillStyle = photo ? "#d9dce3" : "#e9ebef";
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = "#b9bfcc";
      ctx.lineWidth = 2 / o.scale;
      ctx.setLineDash([8 / o.scale, 6 / o.scale]);
      ctx.strokeRect(r.x + 1 / o.scale, r.y + 1 / o.scale, r.w - 2 / o.scale, r.h - 2 / o.scale);
      ctx.setLineDash([]);
      const s = Math.min(r.w, r.h) * 0.12;
      ctx.strokeStyle = "#a3a9b8";
      ctx.lineWidth = s * 0.12;
      ctx.beginPath();
      ctx.moveTo(r.x + r.w / 2 - s / 2, r.y + r.h / 2);
      ctx.lineTo(r.x + r.w / 2 + s / 2, r.y + r.h / 2);
      ctx.moveTo(r.x + r.w / 2, r.y + r.h / 2 - s / 2);
      ctx.lineTo(r.x + r.w / 2, r.y + r.h / 2 + s / 2);
      ctx.stroke();
    }
    ctx.restore();
  });

  // bingkai foto (di atas foto, di luar klip)
  page.cells.forEach((c) => {
    const fr = c.frame === undefined ? page.cellFrame : c.frame;
    if (!fr || !c.photoId) return;
    const r = cellRect(f, page, c);
    drawFrame(ctx, r, fr, fillStyle(ctx, fr.fill, r));
  });

  page.overlays.forEach((ov) => drawOverlay(ctx, ov));

  if (page.pageFrame) {
    const pf = page.pageFrame;
    for (const r of pageFrameRects({ x: f.bleed, y: f.bleed, w: TW, h: TH }, f.spread && !pf.whole)) drawFrame(ctx, r, pf, fillStyle(ctx, pf.fill, r));
  }
  page.texts.forEach((t) => drawText(ctx, t, o.scale));
  if (o.watermark && wmOnPage(o.watermark.wm, page)) drawWatermark(ctx, f, o.watermark.wm, o.watermark.image);

  if (o.editor && o.guides) drawGuides(ctx, f, o.scale, W, H, TW, TH);
}

function drawGuides(ctx: Ctx, f: Format, scale: number, W: number, H: number, TW: number, TH: number) {
  const lw = 1 / scale;
  const b = f.bleed;
  ctx.save();
  if (b > 0) {
    ctx.fillStyle = "rgba(220,40,60,0.18)";
    ctx.fillRect(0, 0, W, b);
    ctx.fillRect(0, H - b, W, b);
    ctx.fillRect(0, b, b, TH);
    ctx.fillRect(W - b, b, b, TH);
    ctx.strokeStyle = "rgba(220,40,60,0.9)";
    ctx.lineWidth = lw;
    ctx.strokeRect(b, b, TW, TH);
  }
  if (f.isPrint) {
    const s = mmToPx(5, f.dpi);
    ctx.strokeStyle = "rgba(0,170,220,0.85)";
    ctx.setLineDash([6 * lw, 5 * lw]);
    ctx.lineWidth = lw;
    if (f.spread) {
      ctx.strokeRect(b + s, b + s, TW / 2 - 2 * s, TH - 2 * s);
      ctx.strokeRect(b + TW / 2 + s, b + s, TW / 2 - 2 * s, TH - 2 * s);
      ctx.setLineDash([]);
      ctx.strokeStyle = "rgba(200,0,200,0.8)";
      ctx.beginPath();
      ctx.moveTo(b + TW / 2, 0);
      ctx.lineTo(b + TW / 2, H);
      ctx.stroke();
    } else ctx.strokeRect(b + s, b + s, TW - 2 * s, TH - 2 * s);
  } else if (f.kind === "story") {
    // area yang tertutup UI Instagram (profil di atas, kolom balas di bawah)
    const top = (250 / 1920) * TH;
    const bot = (340 / 1920) * TH;
    ctx.fillStyle = "rgba(0,140,255,0.13)";
    ctx.fillRect(0, 0, W, top);
    ctx.fillRect(0, H - bot, W, bot);
    ctx.strokeStyle = "rgba(0,140,255,0.8)";
    ctx.setLineDash([6 * lw, 5 * lw]);
    ctx.lineWidth = lw;
    ctx.strokeRect(0, top, W, H - top - bot);
  } else if (f.kind === "carousel" || f.kind === "puzzle") {
    // batas potongan slide / post
    ctx.strokeStyle = "rgba(200,0,200,0.85)";
    ctx.setLineDash([8 * lw, 6 * lw]);
    ctx.lineWidth = lw * 1.5;
    ctx.beginPath();
    for (let c = 1; c < panelCols(f); c++) {
      ctx.moveTo(c * f.pageW, 0);
      ctx.lineTo(c * f.pageW, H);
    }
    for (let r = 1; r < panelRows(f); r++) {
      ctx.moveTo(0, r * f.pageH);
      ctx.lineTo(W, r * f.pageH);
    }
    ctx.stroke();
  } else if (f.kind === "feed") {
    // potongan 3:4 yang tampil di grid profil IG
    ctx.strokeStyle = "rgba(0,140,255,0.8)";
    ctx.setLineDash([6 * lw, 5 * lw]);
    ctx.lineWidth = lw;
    const gw = TH * 0.75;
    if (gw < TW - 1) ctx.strokeRect((TW - gw) / 2, 0, gw, TH);
    else if (TW / 0.75 < TH - 1) ctx.strokeRect(0, (TH - TW / 0.75) / 2, TW, TW / 0.75);
  }
  ctx.restore();
}
