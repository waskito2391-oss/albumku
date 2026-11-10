import { open } from "@tauri-apps/plugin-dialog";
import { ImageSquare, Trash2, Type } from "../icons";
import { useStore } from "../../store";
import type { Watermark, WmPos } from "../../types";
import { fileUrl } from "../../lib/images";
import { defaultWatermark } from "../../lib/watermark";
import { FontPicker } from "../FontPicker";
import { Btn, ColorInput, Empty, Section, Seg, Slider, Toggle } from "../ui";

const POS: WmPos[] = ["tl", "tc", "tr", "ml", "mc", "mr", "bl", "bc", "br"];
const POS_NAMES: Record<WmPos, string> = { tl: "Kiri atas", tc: "Tengah atas", tr: "Kanan atas", ml: "Kiri tengah", mc: "Tengah", mr: "Kanan tengah", bl: "Kiri bawah", bc: "Tengah bawah", br: "Kanan bawah" };
const LOGO_FILTER = [{ name: "Logo", extensions: ["png", "webp", "jpg", "jpeg"] }];

export function WatermarkPanel() {
  const project = useStore((s) => s.project)!;
  const fonts = useStore((s) => s.fonts);
  const commit = useStore((s) => s.commit);
  const pageIdx = useStore((s) => s.pageIdx);
  const wm = project.watermark;

  const upd = (patch: Partial<Watermark>, key?: string) =>
    commit((p) => void (p.watermark = { ...(p.watermark ?? defaultWatermark()), ...patch }), key && `wm-${key}`);

  const pickLogo = async () => {
    const r = await open({ filters: LOGO_FILTER, title: "Pilih logo watermark" });
    if (!r || Array.isArray(r)) return;
    upd({ imagePath: r, mode: "image", on: true });
  };

  if (!wm)
    return (
      <div>
        <Empty>Watermark dipasang otomatis di semua halaman. Pakai teks (mis. nama studio) atau logo PNG transparan.</Empty>
        <div className="px-4">
          <Btn variant="primary" className="w-full py-2" onClick={() => commit((p) => void (p.watermark = defaultWatermark(fonts.some((x) => x.name === "Segoe UI") || !fonts.length ? "Segoe UI" : fonts[0].name)))}>
            Tambah watermark
          </Btn>
        </div>
      </div>
    );

  const weights = fonts.find((x) => x.name === wm.fontFamily)?.weights ?? [400, 700];

  return (
    <div>
      <Section
        title="Watermark"
        right={
          <Btn title="Hapus watermark" variant="danger" onClick={() => commit((p) => void delete p.watermark)}>
            <Trash2 size={13} />
          </Btn>
        }
      >
        <Toggle label="Tampilkan watermark" value={wm.on} onChange={(on) => upd({ on })} />
        <Seg
          value={wm.mode}
          onChange={(mode) => upd({ mode })}
          options={[
            { v: "text", label: <span className="flex items-center gap-1"><Type size={13} /> Teks</span> },
            { v: "image", label: <span className="flex items-center gap-1"><ImageSquare size={13} /> Gambar / logo</span> },
          ]}
        />
      </Section>

      {wm.mode === "text" ? (
        <Section title="Teks watermark">
          <input
            value={wm.text}
            onChange={(e) => upd({ text: e.target.value }, "text")}
            placeholder="© Nama Studio"
            className="w-full rounded-md bg-ink-800 px-2.5 py-2 text-sm text-ink-100 outline-none ring-1 ring-ink-600 focus:ring-accent"
          />
          <FontPicker value={wm.fontFamily} onChange={(name) => {
            const ws = fonts.find((x) => x.name === name)?.weights ?? [400];
            upd({ fontFamily: name, weight: ws.includes(wm.weight) ? wm.weight : ws.reduce((a, b) => (Math.abs(b - 600) < Math.abs(a - 600) ? b : a), ws[0]) });
          }} />
          <div className="flex items-center gap-2">
            <ColorInput value={wm.color} onChange={(color) => upd({ color }, "color")} />
            <select
              value={wm.weight}
              onChange={(e) => upd({ weight: +e.target.value })}
              className="flex-1 rounded-md bg-ink-800 px-2 py-1.5 text-xs text-ink-100 outline-none ring-1 ring-ink-600"
            >
              {weights.map((w) => (
                <option key={w} value={w}>
                  Tebal {w}
                </option>
              ))}
            </select>
          </div>
        </Section>
      ) : (
        <Section title="Gambar watermark">
          {wm.imagePath ? (
            <div className="flex items-center gap-2.5">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-[repeating-conic-gradient(#555_0_25%,#777_0_50%)] bg-[length:12px_12px] ring-1 ring-ink-600">
                <img src={fileUrl(wm.imagePath)} alt="" className="max-h-[48px] max-w-[48px] object-contain" draggable={false} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs text-ink-200" title={wm.imagePath}>{wm.imagePath.split(/[\\/]/).pop()}</div>
                <Btn variant="soft" className="mt-1" onClick={pickLogo}>Ganti gambar</Btn>
              </div>
            </div>
          ) : (
            <Btn variant="soft" className="w-full py-2" onClick={pickLogo}>
              <ImageSquare size={14} /> Pilih gambar / logo
            </Btn>
          )}
          <p className="text-[11px] leading-relaxed text-ink-400">Paling bagus pakai PNG dengan latar transparan.</p>
        </Section>
      )}

      <Section title="Halaman">
        <Seg
          value={wm.scope ?? "all"}
          onChange={(scope) => upd(scope === "pick" && !wm.pages?.length ? { scope, pages: [project.pages[pageIdx].id] } : { scope })}
          options={[
            { v: "all", label: "Semua halaman" },
            { v: "pick", label: "Pilih halaman" },
          ]}
        />
        {wm.scope === "pick" && (
          <>
            <div className="grid grid-cols-8 gap-1">
              {project.pages.map((pg, i) => {
                const on = !!wm.pages?.includes(pg.id);
                return (
                  <button
                    key={pg.id}
                    title={`Halaman ${i + 1}${on ? " (diberi watermark)" : ""}`}
                    onClick={() => upd({ pages: on ? wm.pages!.filter((x) => x !== pg.id) : [...(wm.pages ?? []), pg.id] })}
                    className={`rounded py-1 text-xs tabular-nums ring-1 ${on ? "bg-accent font-semibold text-on-accent ring-accent" : "bg-ink-800 text-ink-300 ring-ink-700 hover:text-ink-100"} ${i === pageIdx ? "outline outline-1 outline-offset-1 outline-ink-300" : ""}`}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-1">
              <Btn variant="soft" onClick={() => upd({ pages: project.pages.map((x) => x.id) })}>
                Pilih semua
              </Btn>
              <Btn variant="soft" onClick={() => upd({ pages: [] })}>
                Kosongkan
              </Btn>
              <span className="ml-auto text-[11px] tabular-nums text-ink-400">{project.pages.filter((x) => wm.pages?.includes(x.id)).length} halaman</span>
            </div>
            <p className="text-[10px] text-ink-400">Klik nomor halaman untuk memasang/melepas watermark. Kotak bergaris = halaman yang sedang dibuka.</p>
          </>
        )}
      </Section>

      <Section title="Tampilan">
        <Slider label="Ukuran" min={0.05} max={1} step={0.01} value={wm.size} fmt={(v) => `${Math.round(v * 100)}%`} onChange={(size) => upd({ size }, "size")} />
        <Slider label="Opasitas" min={0.05} max={1} step={0.01} value={wm.opacity} fmt={(v) => `${Math.round(v * 100)}%`} onChange={(opacity) => upd({ opacity }, "op")} />
        <Slider label="Rotasi" min={-90} max={90} value={wm.rotation} suffix="°" onChange={(rotation) => upd({ rotation }, "rot")} />
        <Toggle label="Bayangan halus" value={wm.shadow} onChange={(shadow) => upd({ shadow })} />
      </Section>

      <Section title="Posisi">
        <Toggle label="Ulang memenuhi halaman (pola)" value={wm.tile} onChange={(tile) => upd(tile && wm.rotation === 0 ? { tile, rotation: -30 } : { tile })} />
        {wm.tile ? (
          <Slider label="Jarak antar ulangan" min={0.1} max={2} step={0.05} value={wm.gap} fmt={(v) => `${Math.round(v * 100)}%`} onChange={(gap) => upd({ gap }, "gap")} />
        ) : (
          <>
            <div className="grid w-28 grid-cols-3 gap-1">
              {POS.map((p) => (
                <button
                  key={p}
                  title={POS_NAMES[p]}
                  onClick={() => upd({ pos: p })}
                  className={`flex h-8 items-center justify-center rounded ring-1 ${wm.pos === p ? "bg-accent-soft ring-accent" : "bg-ink-800 ring-ink-700 hover:ring-ink-500"}`}
                >
                  <span className={`h-2 w-2 rounded-full ${wm.pos === p ? "bg-accent" : "bg-ink-500"}`} />
                </button>
              ))}
            </div>
            <Slider label="Jarak dari tepi" min={0} max={0.2} step={0.005} value={wm.margin} fmt={(v) => `${Math.round(v * 100)}%`} onChange={(margin) => upd({ margin }, "margin")} />
          </>
        )}
      </Section>
    </div>
  );
}
