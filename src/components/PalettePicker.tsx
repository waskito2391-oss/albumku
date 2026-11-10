import { Pipette, Plus, Sparkles, X } from "./icons";
import { useMemo, useState } from "react";
import { paletteColors, useStore } from "../store";
import type { Fill, Photo } from "../types";
import { pagePhotoIds } from "../lib/fit";
import { PRESET_PALETTES, extractPalette, soften } from "../lib/palette";
import { Btn, ColorInput, Section } from "./ui";

/** Pilih palet warna lalu klik warnanya untuk dijadikan background (solid atau gradient). */
export function PalettePicker() {
  const project = useStore((s) => s.project)!;
  const pageIdx = useStore((s) => s.pageIdx);
  const photos = useStore((s) => s.photos);
  const paletteId = useStore((s) => s.paletteId);
  const custom = useStore((s) => s.customColors);
  const photoColors = useStore((s) => s.photoColors);
  const setPalette = useStore((s) => s.setPalette);
  const commit = useStore((s) => s.commit);
  const colors = useStore((s) => paletteColors(s));
  const [newColor, setNewColor] = useState("#c9a96e");
  const [busy, setBusy] = useState(false);
  const page = project.pages[pageIdx];
  const map = useMemo(() => new Map(photos.map((p) => [p.id, p])), [photos]);

  const setBg = (bg: Fill) => commit((p) => void (p.pages[pageIdx].bg = bg), "bg-palette");
  const fromPhotos = async () => {
    const ps = pagePhotoIds(page).map((id) => map.get(id)).filter((x): x is Photo => !!x);
    if (!ps.length) return;
    setBusy(true);
    const cs = await extractPalette(ps);
    setBusy(false);
    useStore.getState().set({ photoColors: cs });
    setPalette("photo");
  };

  const options = [
    ...PRESET_PALETTES.map((p) => ({ id: p.id, name: p.name, colors: p.colors })),
    { id: "custom", name: "Paletku", colors: custom },
    ...(photoColors.length ? [{ id: "photo", name: "Dari foto", colors: photoColors }] : []),
  ];

  return (
    <Section title="Palet warna">
      <div className="grid grid-cols-2 gap-1.5">
        {options.map((o) => (
          <button
            key={o.id}
            onClick={() => setPalette(o.id)}
            className={`rounded-md p-1.5 text-left ring-1 transition ${paletteId === o.id ? "bg-accent-soft ring-accent" : "bg-ink-800 ring-ink-700 hover:ring-ink-500"}`}
          >
            <div className="flex h-4 overflow-hidden rounded-sm">
              {o.colors.length ? o.colors.map((c) => <span key={c} className="flex-1" style={{ background: c }} />) : <span className="flex-1 bg-ink-700" />}
            </div>
            <div className={`mt-1 text-[10px] ${paletteId === o.id ? "text-accent" : "text-ink-300"}`}>{o.name}</div>
          </button>
        ))}
      </div>

      <Btn variant="soft" className="w-full" onClick={fromPhotos} disabled={busy || !pagePhotoIds(page).length}>
        <Sparkles size={13} className="text-accent" /> {busy ? "Membaca warna…" : "Ambil palet dari foto halaman ini"}
      </Btn>

      {paletteId === "custom" && (
        <div className="space-y-2 rounded-md bg-ink-850 p-2.5 ring-1 ring-ink-700">
          <div className="flex flex-wrap gap-1.5">
            {custom.map((c) => (
              <span key={c} className="group relative">
                <span className="block h-7 w-7 rounded ring-1 ring-ink-600" style={{ background: c }} />
                <button
                  onClick={() => setPalette("custom", custom.filter((x) => x !== c))}
                  className="absolute -right-1 -top-1 hidden rounded-full bg-ink-950 p-0.5 text-ink-200 group-hover:block"
                  title="Hapus warna"
                >
                  <X size={10} />
                </button>
              </span>
            ))}
            {!custom.length && <span className="text-[11px] text-ink-400">Belum ada warna. Tambahkan warna brand / tema klienmu.</span>}
          </div>
          <div className="flex items-center gap-2">
            <ColorInput value={newColor} onChange={setNewColor} />
            <input
              value={newColor}
              onChange={(e) => setNewColor(e.target.value)}
              className="w-24 rounded bg-ink-800 px-2 py-1 font-mono text-xs text-ink-100 outline-none ring-1 ring-ink-600"
            />
            <Btn
              variant="soft"
              onClick={() => /^#[0-9a-f]{6}$/i.test(newColor) && !custom.includes(newColor.toLowerCase()) && setPalette("custom", [...custom, newColor.toLowerCase()].slice(0, 16))}
            >
              <Plus size={13} /> Tambah
            </Btn>
          </div>
          {page.bg.type === "solid" && (
            <button
              onClick={() => !custom.includes(page.bg.type === "solid" ? page.bg.color : "") && page.bg.type === "solid" && setPalette("custom", [...custom, page.bg.color].slice(0, 16))}
              className="flex items-center gap-1 text-[11px] text-ink-300 hover:text-accent"
            >
              <Pipette size={11} /> Simpan warna background sekarang ke Paletku
            </button>
          )}
        </div>
      )}

      {colors.length > 0 && (
        <div className="space-y-2">
          <div>
            <div className="mb-1 text-[11px] text-ink-300">Klik untuk jadikan background</div>
            <div className="flex flex-wrap gap-1.5">
              {colors.map((c) => (
                <button
                  key={c}
                  title={c}
                  onClick={() => setBg({ type: "solid", color: c, alpha: 1 })}
                  className={`h-8 w-8 rounded-md ring-1 hover:scale-110 ${page.bg.type === "solid" && page.bg.color === c ? "ring-2 ring-accent" : "ring-ink-600"}`}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>
          <div>
            <div className="mb-1 text-[11px] text-ink-300">Versi lembut (cocok untuk album)</div>
            <div className="flex flex-wrap gap-1.5">
              {colors.map((c) => {
                const s = soften(c);
                return (
                  <button key={c} title={s} onClick={() => setBg({ type: "solid", color: s, alpha: 1 })} className="h-6 w-8 rounded ring-1 ring-ink-600 hover:scale-110" style={{ background: s }} />
                );
              })}
            </div>
          </div>
          {colors.length > 1 && (
            <div>
              <div className="mb-1 text-[11px] text-ink-300">Gradient dari palet</div>
              <div className="grid grid-cols-5 gap-1.5">
                {colors.slice(0, -1).map((c, i) => {
                  const d = colors[i + 1];
                  const fill: Fill = { type: "linear", angle: 90, stops: [{ pos: 0, color: c, alpha: 1 }, { pos: 1, color: d, alpha: 1 }] };
                  return <button key={c + d} onClick={() => setBg(fill)} className="h-7 rounded ring-1 ring-ink-600 hover:ring-accent" style={{ background: `linear-gradient(180deg, ${c}, ${d})` }} />;
                })}
              </div>
            </div>
          )}
          <Btn
            variant="soft"
            className="w-full"
            onClick={() =>
              commit((p) => {
                const bg = p.pages[pageIdx].bg;
                p.pages.forEach((pg) => (pg.bg = structuredClone(bg)));
              })
            }
          >
            Terapkan background ini ke semua halaman
          </Btn>
        </div>
      )}
    </Section>
  );
}
