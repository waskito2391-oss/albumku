import { AlignCenter, AlignLeft, AlignRight, ArrowDown, ArrowUp, Copy, Italic, Plus, Trash2, Type } from "../icons";
import { useEffect, useRef } from "react";
import { uid, useStore } from "../../store";
import type { TextItem } from "../../types";
import { docSize } from "../../lib/formats";
import { TEXT_PRESETS, makeText } from "../../lib/presets";
import { FontPicker } from "../FontPicker";
import { GradientEditor } from "../GradientEditor";
import { Btn, ColorInput, Empty, Section, Seg, Slider, Toggle } from "../ui";

const WEIGHT_NAMES: Record<number, string> = { 100: "Thin", 200: "ExtraLight", 300: "Light", 400: "Regular", 500: "Medium", 600: "SemiBold", 700: "Bold", 800: "ExtraBold", 900: "Black", 950: "ExtraBlack" };

export function TextPanel() {
  const project = useStore((s) => s.project)!;
  const pageIdx = useStore((s) => s.pageIdx);
  const sel = useStore((s) => s.sel);
  const fonts = useStore((s) => s.fonts);
  const focusText = useStore((s) => s.focusText);
  const commit = useStore((s) => s.commit);
  const f = project.format;
  const page = project.pages[pageIdx];
  const t = sel?.kind === "text" ? page.texts.find((x) => x.id === sel.id) : undefined;
  const area = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (focusText && area.current) {
      area.current.focus();
      area.current.select();
    }
  }, [focusText]);

  const add = (preset?: (typeof TEXT_PRESETS)[number]) => {
    const id = uid();
    commit((p) => void p.pages[pageIdx].texts.push({ id, ...makeText(f, fonts.map((x) => x.name), preset) }));
    useStore.getState().select({ kind: "text", id });
  };

  const upd = (patch: Partial<TextItem>, key?: string) =>
    t && commit((p) => {
      const x = p.pages[pageIdx].texts.find((y) => y.id === t.id);
      if (x) Object.assign(x, patch);
    }, key && `${t.id}-${key}`);

  const family = fonts.find((x) => x.name === t?.fontFamily);
  const weights = family?.weights.length ? family.weights : [400, 700];
  const { H } = docSize(f);
  const sizeLabel = (px: number) => (f.isPrint ? `${Math.round((px / f.dpi) * 72)} pt` : `${Math.round(px)} px`);

  return (
    <div>
      <Section title="Tambah teks">
        <div className="grid grid-cols-2 gap-1.5">
          {TEXT_PRESETS.map((p) => (
            <button key={p.name} onClick={() => add(p)} className="rounded-md bg-ink-800 px-2 py-2 text-left ring-1 ring-ink-700 hover:ring-accent/60">
              <div className="truncate text-[13px] text-ink-100" style={{ fontFamily: p.family.map((x) => `"${x}"`).join(","), fontStyle: p.t.italic ? "italic" : undefined, fontWeight: p.t.weight }}>
                {p.t.uppercase ? p.sample.toUpperCase() : p.sample}
              </div>
              <div className="mt-0.5 text-[10px] text-ink-400">{p.name}</div>
            </button>
          ))}
        </div>
        <Btn variant="soft" className="w-full" onClick={() => add()}>
          <Plus size={14} /> Teks kosong
        </Btn>
      </Section>

      {page.texts.length > 0 && (
        <Section title={`Teks di halaman (${page.texts.length})`}>
          <div className="space-y-1">
            {page.texts.map((x) => (
              <button
                key={x.id}
                onClick={() => useStore.getState().select({ kind: "text", id: x.id })}
                className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs ${x.id === t?.id ? "bg-accent-soft text-accent" : "text-ink-200 hover:bg-ink-800"}`}
              >
                <Type size={12} />
                <span className="truncate">{x.text || "(kosong)"}</span>
              </button>
            ))}
          </div>
        </Section>
      )}

      {!t ? (
        <Empty>Pilih teks di kanvas untuk mengedit. Klik 2x teks untuk langsung mengetik.</Empty>
      ) : (
        <>
          <Section
            title="Isi & font"
            right={
              <div className="flex gap-0.5">
                <Btn title="Naik lapisan" onClick={() => commit((p) => { const a = p.pages[pageIdx].texts; const i = a.findIndex((y) => y.id === t.id); if (i < a.length - 1) [a[i], a[i + 1]] = [a[i + 1], a[i]]; })}>
                  <ArrowUp size={13} />
                </Btn>
                <Btn title="Turun lapisan" onClick={() => commit((p) => { const a = p.pages[pageIdx].texts; const i = a.findIndex((y) => y.id === t.id); if (i > 0) [a[i], a[i - 1]] = [a[i - 1], a[i]]; })}>
                  <ArrowDown size={13} />
                </Btn>
                <Btn
                  title="Duplikat"
                  onClick={() => {
                    const id = uid();
                    commit((p) => void p.pages[pageIdx].texts.push({ ...structuredClone(t), id, x: t.x + H * 0.02, y: t.y + H * 0.02 }));
                    useStore.getState().select({ kind: "text", id });
                  }}
                >
                  <Copy size={13} />
                </Btn>
                <Btn title="Hapus" variant="danger" onClick={() => { commit((p) => void (p.pages[pageIdx].texts = p.pages[pageIdx].texts.filter((y) => y.id !== t.id))); useStore.getState().select(null); }}>
                  <Trash2 size={13} />
                </Btn>
              </div>
            }
          >
            <textarea
              ref={area}
              value={t.text}
              onChange={(e) => upd({ text: e.target.value }, "text")}
              rows={3}
              className="w-full resize-y rounded-md bg-ink-800 px-2.5 py-2 text-sm text-ink-100 outline-none ring-1 ring-ink-600 focus:ring-accent"
            />
            <FontPicker value={t.fontFamily} onChange={(name) => {
              const fam = fonts.find((x) => x.name === name);
              const w = fam?.weights.includes(t.weight) ? t.weight : fam?.weights.reduce((a, b) => (Math.abs(b - 400) < Math.abs(a - 400) ? b : a), fam.weights[0]) ?? 400;
              upd({ fontFamily: name, weight: w });
            }} />
            {fonts.length > 0 && !fonts.some((x) => x.name.toLowerCase() === t.fontFamily.toLowerCase()) && (
              <p className="rounded-md bg-amber-500/10 px-2.5 py-2 text-[11px] leading-relaxed text-amber-200 ring-1 ring-amber-500/30">
                ⚠ Font "{t.fontFamily}" tidak aktif di PC ini, teks memakai font pengganti. Jika ini Adobe Fonts, aktifkan lagi di Creative Cloud lalu tekan ⟳ di daftar font.
              </p>
            )}
            <div className="flex gap-1.5">
              <select
                value={t.weight}
                onChange={(e) => upd({ weight: +e.target.value })}
                className="flex-1 rounded-md bg-ink-800 px-2 py-1.5 text-xs text-ink-100 outline-none ring-1 ring-ink-600"
              >
                {weights.map((w) => (
                  <option key={w} value={w}>
                    {WEIGHT_NAMES[w] ?? w} ({w})
                  </option>
                ))}
              </select>
              <Btn active={t.italic} variant="soft" onClick={() => upd({ italic: !t.italic })} title="Miring">
                <Italic size={14} />
              </Btn>
              <Btn active={t.uppercase} variant="soft" onClick={() => upd({ uppercase: !t.uppercase })} title="Huruf kapital">
                AA
              </Btn>
            </div>
            <Seg
              value={t.align}
              onChange={(a) => upd({ align: a })}
              options={[
                { v: "left", label: <AlignLeft size={14} /> },
                { v: "center", label: <AlignCenter size={14} /> },
                { v: "right", label: <AlignRight size={14} /> },
              ]}
            />
            <Slider label="Ukuran" min={Math.round(H * 0.008)} max={Math.round(H * 0.3)} value={t.fontSize} fmt={sizeLabel} onChange={(v) => upd({ fontSize: v }, "size")} />
            <Slider label="Jarak huruf" min={-10} max={80} value={t.letterSpacing} fmt={(v) => `${(v / 100).toFixed(2)} em`} onChange={(v) => upd({ letterSpacing: v }, "ls")} />
            <Slider label="Jarak baris" min={0.7} max={2.5} step={0.01} value={t.lineHeight} onChange={(v) => upd({ lineHeight: v }, "lh")} />
            <Slider label="Rotasi" min={-180} max={180} value={t.rotation} suffix="°" onChange={(v) => upd({ rotation: v }, "rot")} />
            <Slider label="Opasitas" min={0} max={1} step={0.01} value={t.opacity} fmt={(v) => `${Math.round(v * 100)}%`} onChange={(v) => upd({ opacity: v }, "op")} />
          </Section>

          <Section title="Warna teks">
            <GradientEditor value={t.fill} onChange={(fill) => upd({ fill }, "fill")} />
          </Section>

          <Section title="Outline & bayangan">
            <Toggle label="Outline" value={t.stroke.on} onChange={(on) => upd({ stroke: { ...t.stroke, on } })} />
            {t.stroke.on && (
              <div className="flex items-end gap-2">
                <ColorInput value={t.stroke.color} onChange={(color) => upd({ stroke: { ...t.stroke, color } }, "sc")} />
                <div className="flex-1">
                  <Slider label="Tebal" min={1} max={Math.round(t.fontSize * 0.2) + 2} value={t.stroke.width} onChange={(width) => upd({ stroke: { ...t.stroke, width } }, "sw")} />
                </div>
              </div>
            )}
            <Toggle label="Bayangan" value={t.shadow.on} onChange={(on) => upd({ shadow: { ...t.shadow, on } })} />
            {t.shadow.on && (
              <>
                <div className="flex items-end gap-2">
                  <ColorInput value={t.shadow.color} onChange={(color) => upd({ shadow: { ...t.shadow, color } }, "shc")} />
                  <div className="flex-1">
                    <Slider label="Kepekatan" min={0} max={1} step={0.01} value={t.shadow.alpha} fmt={(v) => `${Math.round(v * 100)}%`} onChange={(alpha) => upd({ shadow: { ...t.shadow, alpha } }, "sha")} />
                  </div>
                </div>
                <Slider label="Blur" min={0} max={Math.round(H * 0.05)} value={t.shadow.blur} onChange={(blur) => upd({ shadow: { ...t.shadow, blur } }, "shb")} />
                <Slider label="Geser Y" min={-Math.round(H * 0.03)} max={Math.round(H * 0.03)} value={t.shadow.dy} onChange={(dy) => upd({ shadow: { ...t.shadow, dy } }, "shy")} />
              </>
            )}
          </Section>
        </>
      )}
    </div>
  );
}
