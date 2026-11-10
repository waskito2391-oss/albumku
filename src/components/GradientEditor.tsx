import { Plus, X } from "./icons";
import type { Fill, Stop } from "../types";
import { fillCss } from "../lib/render";
import { GRADIENTS } from "../lib/presets";
import { paletteColors, useStore } from "../store";
import { ColorInput, Seg, Slider } from "./ui";

/** Editor isian: warna solid, gradient linear, atau radial (dengan stop warna & transparansi). */
export function GradientEditor({ value, onChange, allowSolid = true }: { value: Fill; onChange: (f: Fill) => void; allowSolid?: boolean }) {
  const stops: Stop[] = value.type === "solid" ? [] : value.stops;
  const palette = useStore((s) => paletteColors(s));
  const swatches = [...new Set(["#ffffff", ...palette, "#000000"])];

  const setType = (t: Fill["type"]) => {
    if (t === value.type) return;
    if (t === "solid") onChange({ type: "solid", color: value.type === "solid" ? value.color : stops[0]?.color ?? "#ffffff", alpha: 1 });
    else if (value.type === "solid")
      onChange({ type: t, angle: 90, stops: [{ pos: 0, color: value.color, alpha: value.alpha }, { pos: 1, color: "#000000", alpha: 1 }] });
    else onChange({ ...value, type: t });
  };
  const setStop = (i: number, s: Partial<Stop>) => {
    if (value.type === "solid") return;
    onChange({ ...value, stops: value.stops.map((x, j) => (j === i ? { ...x, ...s } : x)) });
  };

  return (
    <div className="space-y-2.5">
      <Seg
        value={value.type}
        onChange={setType}
        options={[...(allowSolid ? [{ v: "solid" as const, label: "Solid" }] : []), { v: "linear" as const, label: "Linear" }, { v: "radial" as const, label: "Radial" }]}
      />
      <div className="h-7 rounded-md ring-1 ring-ink-600" style={{ background: `${fillCss(value)}, repeating-conic-gradient(#555 0 25%, #777 0 50%) 0 0/10px 10px` }} />

      {value.type === "solid" ? (
        <>
          <div className="flex flex-wrap gap-1.5">
            {swatches.map((c) => (
              <button key={c} onClick={() => onChange({ type: "solid", color: c, alpha: value.alpha })} className="h-6 w-6 rounded ring-1 ring-ink-600" style={{ background: c }} />
            ))}
            <ColorInput value={value.color} onChange={(c) => onChange({ ...value, color: c })} />
          </div>
          <Slider label="Transparansi" min={0} max={1} step={0.01} value={value.alpha} onChange={(a) => onChange({ ...value, alpha: a })} fmt={(v) => `${Math.round(v * 100)}%`} />
        </>
      ) : (
        <>
          <div className="grid grid-cols-8 gap-1.5">
            {GRADIENTS.map((g) => (
              <button
                key={g.name}
                title={g.name}
                onClick={() => g.fill.type !== "solid" && onChange({ ...g.fill, type: value.type, angle: value.type === "linear" ? g.fill.angle : 0, stops: structuredClone(g.fill.stops) })}
                className="aspect-square rounded ring-1 ring-ink-600 hover:ring-accent"
                style={{ background: fillCss(g.fill) }}
              />
            ))}
          </div>
          {value.type === "linear" && <Slider label="Sudut" min={0} max={360} value={value.angle} onChange={(a) => onChange({ ...value, angle: a })} suffix="°" />}
          <div className="space-y-1.5">
            {stops.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="flex flex-col items-center gap-1">
                  <ColorInput value={s.color} onChange={(c) => setStop(i, { color: c })} />
                  <div className="flex w-9 flex-wrap gap-[2px]">
                    {palette.slice(0, 6).map((c) => (
                      <button key={c} title={c} onClick={() => setStop(i, { color: c })} className="h-2.5 w-2.5 rounded-[2px] ring-1 ring-ink-600" style={{ background: c }} />
                    ))}
                  </div>
                </div>
                <div className="flex-1 space-y-1">
                  <input type="range" className="range" min={0} max={1} step={0.01} value={s.pos} onChange={(e) => setStop(i, { pos: +e.target.value })} title="Posisi" />
                  <input type="range" className="range range-alpha" min={0} max={1} step={0.01} value={s.alpha} onChange={(e) => setStop(i, { alpha: +e.target.value })} title="Transparansi" />
                </div>
                <button
                  disabled={stops.length <= 2}
                  onClick={() => onChange({ ...value, stops: value.stops.filter((_, j) => j !== i) })}
                  className="text-ink-400 hover:text-red-300 disabled:opacity-30"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
            <button
              onClick={() => onChange({ ...value, stops: [...value.stops, { pos: 0.5, color: "#ffffff", alpha: 1 }] })}
              className="flex items-center gap-1 text-xs text-ink-300 hover:text-accent"
            >
              <Plus size={13} /> Tambah warna
            </button>
            <p className="text-[10px] text-ink-400">Slider atas = posisi, bawah = transparansi.</p>
          </div>
        </>
      )}
    </div>
  );
}
