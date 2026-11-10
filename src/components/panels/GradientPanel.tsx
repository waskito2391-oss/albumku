import { Layers, Maximize, Trash2 } from "../icons";
import { uid, useStore } from "../../store";
import type { Overlay } from "../../types";
import { docSize } from "../../lib/formats";
import { OVERLAY_PRESETS } from "../../lib/presets";
import { fillCss } from "../../lib/render";
import { GradientEditor } from "../GradientEditor";
import { PalettePicker } from "../PalettePicker";
import { Btn, Empty, Section, Slider } from "../ui";

export function GradientPanel() {
  const project = useStore((s) => s.project)!;
  const pageIdx = useStore((s) => s.pageIdx);
  const sel = useStore((s) => s.sel);
  const commit = useStore((s) => s.commit);
  const f = project.format;
  const page = project.pages[pageIdx];
  const o = sel?.kind === "overlay" ? page.overlays.find((x) => x.id === sel.id) : undefined;
  const { W, H } = docSize(f);

  const upd = (patch: Partial<Overlay>, key?: string) =>
    o && commit((p) => {
      const x = p.pages[pageIdx].overlays.find((y) => y.id === o.id);
      if (x) Object.assign(x, patch);
    }, key && `${o.id}-${key}`);

  return (
    <div>
      <PalettePicker />

      <Section title="Background halaman">
        <GradientEditor value={page.bg} onChange={(bg) => commit((p) => void (p.pages[pageIdx].bg = bg), "bg")} />
        <p className="text-[10px] text-ink-400">Terlihat di sela foto (gutter), margin, dan ruang kosong template magazine.</p>
      </Section>

      <Section title="Overlay gradient (untuk caption)">
        <div className="grid grid-cols-2 gap-1.5">
          {OVERLAY_PRESETS.map((pr) => {
            const ov = pr.make(f);
            return (
              <button
                key={pr.name}
                onClick={() => {
                  const id = uid();
                  commit((p) => void p.pages[pageIdx].overlays.push({ id, ...pr.make(f) }));
                  useStore.getState().select({ kind: "overlay", id });
                }}
                className="overflow-hidden rounded-md bg-ink-800 text-left ring-1 ring-ink-700 hover:ring-accent/60"
              >
                <div className="relative h-10 bg-[linear-gradient(135deg,#8a9bb0,#c8b8a6)]">
                  <div
                    className="absolute"
                    style={{ left: `${(ov.x / W) * 100}%`, top: `${(ov.y / H) * 100}%`, width: `${(ov.w / W) * 100}%`, height: `${(ov.h / H) * 100}%`, background: fillCss(ov.fill), opacity: ov.opacity }}
                  />
                </div>
                <div className="px-2 py-1 text-[11px] text-ink-200">{pr.name}</div>
              </button>
            );
          })}
        </div>
        {page.overlays.length > 0 && (
          <div className="space-y-1">
            {page.overlays.map((x, i) => (
              <button
                key={x.id}
                onClick={() => useStore.getState().select({ kind: "overlay", id: x.id })}
                className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs ${x.id === o?.id ? "bg-accent-soft text-accent" : "text-ink-200 hover:bg-ink-800"}`}
              >
                <Layers size={12} />
                <span className="h-3 w-8 rounded-sm" style={{ background: fillCss(x.fill) }} />
                Overlay {i + 1}
              </button>
            ))}
          </div>
        )}
      </Section>

      {!o ? (
        <Empty>Tambah overlay di atas, atau klik overlay di kanvas (saat tab ini aktif) untuk mengedit. Seret untuk memindah, tarik sudut kanan-bawah untuk mengubah ukuran.</Empty>
      ) : (
        <Section
          title="Edit overlay"
          right={
            <div className="flex gap-0.5">
              <Btn title="Penuhi halaman" onClick={() => upd({ x: 0, y: 0, w: W, h: H })}>
                <Maximize size={13} />
              </Btn>
              <Btn
                title="Hapus"
                variant="danger"
                onClick={() => {
                  commit((p) => void (p.pages[pageIdx].overlays = p.pages[pageIdx].overlays.filter((y) => y.id !== o.id)));
                  useStore.getState().select(null);
                }}
              >
                <Trash2 size={13} />
              </Btn>
            </div>
          }
        >
          <GradientEditor value={o.fill} onChange={(fill) => upd({ fill }, "fill")} />
          <Slider label="Opasitas" min={0} max={1} step={0.01} value={o.opacity} fmt={(v) => `${Math.round(v * 100)}%`} onChange={(v) => upd({ opacity: v }, "op")} />
          <Slider label="Sudut membulat" min={0} max={Math.round(Math.min(o.w, o.h) / 2)} value={o.radius} onChange={(v) => upd({ radius: v }, "rad")} />
        </Section>
      )}
    </div>
  );
}
