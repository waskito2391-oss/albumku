import { memo, useEffect, useMemo, useRef, useState } from "react";
import { paletteColors, useStore } from "../../store";
import type { Fill, Page } from "../../types";
import { ALL_CORNERS, FRAME_COLORS, GOLD, allFrames, drawFrame, mixedFrames, type FrameCategory, type FrameRecipe, type FrameStyle } from "../../lib/frames";
import { fromUnit, toUnit, unitOf } from "../../lib/formats";
import { fillCss, fillStyle } from "../../lib/render";
import { GradientEditor } from "../GradientEditor";
import { Btn, Empty, Section, Seg, Slider } from "../ui";

type Target = "cells" | "cell" | "page";
type Mask = [boolean, boolean, boolean, boolean];

const FrameThumb = memo(function FrameThumb({ recipe, fill, corners, active, onClick }: { recipe: FrameRecipe | null; fill: Fill; corners?: Mask; active: boolean; onClick: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!;
    const dpr = window.devicePixelRatio || 1;
    const W = 84;
    const H = 64;
    c.width = W * dpr;
    c.height = H * dpr;
    const ctx = c.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, "#c9b7a6");
    g.addColorStop(1, "#6e7f8c");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    if (recipe) {
      const r = { x: 0, y: 0, w: W, h: H };
      const st: FrameStyle = { ...recipe, width: 2.2, inset: 4, fill, opacity: 1, corners };
      drawFrame(ctx, r, st, fillStyle(ctx, fill, r));
    }
  }, [recipe, fill, corners]);
  return (
    <button
      onClick={onClick}
      title={recipe?.name ?? "Tanpa bingkai"}
      className={`relative overflow-hidden rounded ring-1 transition ${active ? "ring-2 ring-accent" : "ring-ink-700 hover:ring-accent/70"}`}
    >
      <canvas ref={ref} style={{ width: "100%", aspectRatio: "84 / 64" }} className="block" />
      {!recipe && <span className="absolute inset-0 flex items-center justify-center text-[11px] font-medium text-white drop-shadow">Tanpa</span>}
    </button>
  );
});

const CORNER_PRESETS: { label: string; v: Mask }[] = [
  { label: "Semua", v: [true, true, true, true] },
  { label: "Diagonal", v: [true, false, false, true] },
  { label: "Diagonal lain", v: [false, true, true, false] },
  { label: "Atas", v: [true, true, false, false] },
  { label: "Bawah", v: [false, false, true, true] },
];

/** Pilih pojok yang diberi ornamen: klik pojok di mini-bingkai, atau pakai tombol cepat. */
function CornerPicker({ value, onChange }: { value: Mask; onChange: (v: Mask) => void }) {
  const names = ["Kiri atas", "Kanan atas", "Kiri bawah", "Kanan bawah"];
  const pos = ["left-0 top-0", "right-0 top-0", "left-0 bottom-0", "right-0 bottom-0"];
  const shape = ["border-l-[3px] border-t-[3px] rounded-tl", "border-r-[3px] border-t-[3px] rounded-tr", "border-l-[3px] border-b-[3px] rounded-bl", "border-r-[3px] border-b-[3px] rounded-br"];
  const toggle = (i: number) => {
    const next = [...value] as Mask;
    next[i] = !next[i];
    if (next.some(Boolean)) onChange(next);
  };
  const same = (a: Mask) => a.every((x, i) => x === value[i]);
  return (
    <div>
      <div className="mb-1.5 text-xs text-ink-300">Ornamen di pojok</div>
      <div className="flex items-center gap-3">
        <div className="relative h-[68px] w-[90px] shrink-0 rounded-sm bg-ink-800 ring-1 ring-ink-600">
          {value.map((on, i) => (
            <button
              key={i}
              title={`${names[i]}: ${on ? "aktif" : "mati"}`}
              onClick={() => toggle(i)}
              className={`absolute m-1 h-6 w-6 transition-colors ${pos[i]} ${shape[i]} ${on ? "border-accent bg-accent/15" : "border-ink-500 hover:border-ink-300"}`}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          {CORNER_PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => onChange(p.v)}
              className={`rounded px-2 py-1 text-[11px] ${same(p.v) ? "bg-ink-600 text-ink-100" : "bg-ink-800 text-ink-300 hover:text-ink-100"}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-1 text-[10px] text-ink-400">Klik pojok di kotak kecil untuk menyalakan/mematikan satu per satu.</p>
    </div>
  );
}

const CATS: { v: FrameCategory | "all"; label: string }[] = [
  { v: "all", label: "Semua" },
  { v: "garis", label: "Garis" },
  { v: "sudut", label: "Ornamen sudut" },
  { v: "pola", label: "Pola" },
  { v: "spesial", label: "Spesial" },
];

export function FramePanel() {
  const project = useStore((s) => s.project)!;
  const pageIdx = useStore((s) => s.pageIdx);
  const sel = useStore((s) => s.sel);
  const commit = useStore((s) => s.commit);
  const palette = useStore((s) => paletteColors(s));
  const f = project.format;
  const page = project.pages[pageIdx];
  const cellIdx = sel?.kind === "cell" ? sel.index : -1;
  const [target, setTarget] = useState<Target>(cellIdx >= 0 ? "cell" : "cells");
  const [cat, setCat] = useState<FrameCategory | "all">("all");
  const [shown, setShown] = useState(60);
  const [customOpen, setCustomOpen] = useState(false);

  useEffect(() => {
    if (cellIdx < 0 && target === "cell") setTarget("cells");
  }, [cellIdx, target]);

  const minSide = Math.min(f.pageW, f.pageH);
  const baseWidth = target === "page" ? minSide * 0.005 : minSide * 0.0035;
  const baseInset = target === "page" ? minSide * 0.035 : minSide * 0.006;

  const current: FrameStyle | null | undefined =
    target === "page" ? page.pageFrame : target === "cells" ? page.cellFrame : cellIdx >= 0 ? (page.cells[cellIdx]?.frame === undefined ? page.cellFrame : page.cells[cellIdx]?.frame) : undefined;
  const fill = current?.fill ?? GOLD;

  const list = useMemo(() => (cat === "all" ? mixedFrames() : allFrames().filter((r) => r.category === cat)), [cat]);
  useEffect(() => setShown(60), [cat]);

  /** Tulis bingkai ke target (null = tanpa bingkai). */
  const write = (fr: FrameStyle | null, key?: string) =>
    commit((p) => {
      const pg = p.pages[pageIdx];
      if (target === "page") pg.pageFrame = fr;
      else if (target === "cells") pg.cellFrame = fr;
      else if (pg.cells[cellIdx]) pg.cells[cellIdx].frame = fr;
    }, key);

  const pick = (r: FrameRecipe | null, withFill: Fill = fill) => {
    if (!r) return write(null);
    write({ ...r, width: current?.width ?? baseWidth, inset: current?.inset ?? baseInset, fill: withFill, opacity: current?.opacity ?? 1, corners: current?.corners, whole: current?.whole });
  };
  // bingkai awal bila warna dipilih sebelum memilih bingkai: garis ganda, sedang
  const starter = () => allFrames().find((r) => r.line === "double" && r.corner === "none" && r.weight === 1)!;
  const upd = (patch: Partial<FrameStyle>, key: string) => current && write({ ...current, ...patch }, `frame-${target}-${key}`);

  const unit = unitOf(f);
  // warna palet aktif, tanpa yang sudah ada di preset
  const presetSolids = new Set(FRAME_COLORS.map((c) => (c.fill.type === "solid" ? c.fill.color.toLowerCase() : "")));
  const solids = [...new Set(palette.map((c) => c.toLowerCase()))]
    .filter((c) => !presetSolids.has(c))
    .map((c) => ({ name: c, fill: { type: "solid", color: c, alpha: 1 } as Fill }));
  const photoCount = page.cells.filter((c) => c.photoId).length;

  return (
    <div>
      <Section title="Pasang ke">
        <Seg
          value={target}
          onChange={setTarget}
          options={[
            { v: "cells", label: "Semua foto" },
            { v: "cell", label: "Foto terpilih", title: cellIdx < 0 ? "Klik satu foto di kanvas dulu" : undefined },
            { v: "page", label: "Tepi halaman" },
          ]}
        />
        {target === "cell" && cellIdx < 0 && <p className="text-[11px] text-ink-400">Klik satu foto di kanvas untuk memberi bingkai khusus.</p>}
        {target === "cells" && !photoCount && <p className="text-[11px] text-ink-400">Halaman ini belum punya foto. Bingkai tampil setelah foto ditambahkan.</p>}
        {target === "cell" && cellIdx >= 0 && page.cells[cellIdx]?.frame !== undefined && (
          <button
            onClick={() => commit((p) => void delete p.pages[pageIdx].cells[cellIdx].frame)}
            className="text-[11px] text-ink-300 underline hover:text-accent"
          >
            Ikuti bingkai semua foto
          </button>
        )}
      </Section>

      <Section title="Warna bingkai">
        <div className="grid grid-cols-6 gap-1.5">
          {[...FRAME_COLORS, ...solids].map((c) => (
            <button
              key={c.name}
              title={c.name}
              onClick={() => (current ? upd({ fill: c.fill }, "fill") : pick(starter(), c.fill))}
              className={`aspect-square rounded-md ring-1 hover:scale-105 ${JSON.stringify(fill) === JSON.stringify(c.fill) ? "ring-2 ring-accent" : "ring-ink-600"}`}
              style={{ background: fillCss(c.fill) }}
            />
          ))}
        </div>
        <button onClick={() => setCustomOpen(!customOpen)} className="text-[11px] text-ink-300 hover:text-accent">
          {customOpen ? "Tutup warna kustom" : "Warna atau gradient kustom…"}
        </button>
        {customOpen && current && <GradientEditor value={current.fill} onChange={(v) => upd({ fill: v }, "fill")} />}
        {customOpen && !current && <p className="text-[11px] text-ink-400">Pilih bingkai dulu.</p>}
      </Section>

      {current && (
        <Section title="Atur bingkai">
          <p className="truncate text-xs text-ink-300">{current.name}</p>
          <Slider
            label="Ketebalan"
            min={f.isPrint ? 0.1 : 1}
            max={f.isPrint ? 6 : 40}
            step={f.isPrint ? 0.1 : 1}
            value={toUnit(f, current.width)}
            suffix={` ${unit}`}
            onChange={(v) => upd({ width: fromUnit(f, v) }, "w")}
          />
          <Slider
            label="Jarak dari tepi"
            min={0}
            max={f.isPrint ? 40 : 200}
            step={f.isPrint ? 0.5 : 1}
            value={toUnit(f, current.inset)}
            suffix={` ${unit}`}
            onChange={(v) => upd({ inset: fromUnit(f, v) }, "inset")}
          />
          {current.corner !== "none" && <CornerPicker value={current.corners ?? ALL_CORNERS} onChange={(corners) => upd({ corners }, "corners")} />}
          <Slider label="Opasitas" min={0.1} max={1} step={0.01} value={current.opacity} fmt={(v) => `${Math.round(v * 100)}%`} onChange={(v) => upd({ opacity: v }, "op")} />
          {target === "page" && f.spread && (
            <Seg
              value={current.whole ? "whole" : "each"}
              onChange={(v) => upd({ whole: v === "whole" }, "whole")}
              options={[
                { v: "each", label: "Per halaman" },
                { v: "whole", label: "Satu bentang" },
              ]}
            />
          )}
          {target !== "cell" && (
            <Btn
              variant="soft"
              className="w-full"
              onClick={() =>
                commit((p) => {
                  const src = p.pages[pageIdx];
                  p.pages.forEach((pg: Page) => {
                    if (target === "page") pg.pageFrame = structuredClone(src.pageFrame);
                    else pg.cellFrame = structuredClone(src.cellFrame);
                  });
                })
              }
            >
              Terapkan ke semua halaman
            </Btn>
          )}
        </Section>
      )}

      <Section title="Pilih bingkai" right={<span className="text-[10px] tabular-nums text-ink-400">{allFrames().length.toLocaleString("id-ID")} bingkai</span>}>
        <div className="flex flex-wrap gap-1">
          {CATS.map((c) => (
            <button
              key={c.v}
              onClick={() => setCat(c.v)}
              className={`rounded px-2 py-1 text-[11px] ${cat === c.v ? "bg-ink-600 text-ink-100" : "bg-ink-800 text-ink-300 hover:text-ink-100"}`}
            >
              {c.label}
            </button>
          ))}
        </div>
        {target === "cell" && cellIdx < 0 ? (
          <Empty>Pilih foto di kanvas dulu.</Empty>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-1.5">
              <FrameThumb recipe={null} fill={fill} active={!current} onClick={() => pick(null)} />
              {list.slice(0, shown).map((r) => (
                <FrameThumb key={r.id} recipe={r} fill={fill} corners={current?.corners} active={current?.id === r.id} onClick={() => pick(r)} />
              ))}
            </div>
            {list.length > shown && (
              <Btn variant="soft" className="w-full" onClick={() => setShown(shown + 90)}>
                Tampilkan lebih banyak ({(list.length - shown).toLocaleString("id-ID")})
              </Btn>
            )}
          </>
        )}
      </Section>
    </div>
  );
}
