import { open, save } from "@tauri-apps/plugin-dialog";
import { Download, FolderOpen } from "../icons";
import { useState } from "react";
import { useStore } from "../../store";
import { openFolder } from "../../lib/api";
import { exportPages, exportPixelSize, type ExportKind } from "../../lib/actions";
import { pagePhotoIds } from "../../lib/fit";
import { panelCols, panelRows } from "../../lib/formats";
import { Btn, Section, Seg, Slider, Toggle } from "../ui";

export function ExportPanel() {
  const project = useStore((s) => s.project)!;
  const pageIdx = useStore((s) => s.pageIdx);
  const photos = useStore((s) => s.photos);
  const f = project.format;
  const [kind, setKind] = useState<ExportKind>("jpg");
  const [quality, setQuality] = useState(98);
  const [scale, setScale] = useState(f.isPrint ? 1 : f.exportScale);
  const [bleed, setBleed] = useState(true);
  const [split, setSplit] = useState(false);
  const [withWm, setWithWm] = useState(true);
  const [which, setWhich] = useState<"all" | "current">("all");
  const [dir, setDir] = useState("");
  const [busy, setBusy] = useState(false);
  const [prog, setProg] = useState({ done: 0, total: 0, msg: "" });
  const [result, setResult] = useState<{ ok: boolean; text: string; folder?: string } | null>(null);

  const multi = f.kind === "carousel" || f.kind === "puzzle";
  const px = exportPixelSize(f, scale, f.isPrint && bleed, f.spread && split);
  const lowRes = (() => {
    // foto yang diperbesar jauh melebihi resolusi aslinya (berisiko pecah saat dicetak)
    const map = new Map(photos.map((p) => [p.id, p]));
    const tw = f.pageW * panelCols(f);
    const th = f.pageH * panelRows(f);
    let n = 0;
    for (const pg of project.pages)
      for (const c of pg.cells) {
        const ph = c.photoId ? map.get(c.photoId) : undefined;
        if (!ph) continue;
        const need = Math.max((c.w * tw * scale * c.zoom) / ph.width, (c.h * th * scale * c.zoom) / ph.height);
        if (need > 1.6) n++;
      }
    return n;
  })();

  const run = async () => {
    const prefix = project.name.replace(/[\\/:*?"<>|]+/g, "_") || "album";
    let target = dir;
    if (kind === "pdf") {
      const r = await save({ defaultPath: `${prefix}.pdf`, filters: [{ name: "PDF", extensions: ["pdf"] }] });
      if (!r) return;
      target = r;
    } else if (!target) {
      const r = await open({ directory: true, title: "Pilih folder export" });
      if (!r || Array.isArray(r)) return;
      target = r;
      setDir(r);
    }
    setBusy(true);
    setResult(null);
    const pages = which === "all" ? project.pages.map((_, i) => i).filter((i) => pagePhotoIds(project.pages[i]).length || project.pages[i].texts.length) : [pageIdx];
    try {
      const files = await exportPages({
        kind,
        dir: target,
        prefix,
        quality,
        scale,
        bleed: f.isPrint && bleed,
        split: f.spread && split,
        pages,
        watermark: withWm,
        onProgress: (done, total, msg) => setProg({ done, total, msg }),
      });
      const folder = kind === "pdf" ? target.replace(/[\\/][^\\/]*$/, "") : target;
      setResult({ ok: true, text: kind === "pdf" ? `PDF ${pages.length} halaman tersimpan.` : `${files.length} file ${kind.toUpperCase()} tersimpan.`, folder });
    } catch (e) {
      setResult({ ok: false, text: String(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <Section title="Hasil">
        <div className="rounded-md bg-ink-800 p-3 text-xs leading-relaxed text-ink-200 ring-1 ring-ink-700">
          <div className="text-lg font-semibold tabular-nums text-ink-100">
            {px.w.toLocaleString("id-ID")} × {px.h.toLocaleString("id-ID")} px
            {px.count > 1 && <span className="ml-1.5 text-xs font-normal text-ink-300">× {px.count} file / halaman</span>}
          </div>
          {f.isPrint ? (
            <div className="text-ink-300">
              {f.dpi} dpi, {((px.w / f.dpi) * 2.54).toFixed(1)} × {((px.h / f.dpi) * 2.54).toFixed(1)} cm
            </div>
          ) : (
            <div className="text-ink-300">{scale}× resolusi standar sosmed</div>
          )}
          {f.kind === "carousel" && <div className="mt-1 text-ink-400">Unggah berurutan slide01 → slide{String(px.count).padStart(2, "0")} dalam satu post carousel.</div>}
          {f.kind === "puzzle" && <div className="mt-1 text-ink-400">Unggah sebagai post terpisah mulai unggah01 (kanan-bawah) sampai unggah{String(px.count).padStart(2, "0")} supaya grid profil tersusun.</div>}
        </div>
        {lowRes > 0 && (
          <p className="rounded-md bg-amber-500/10 px-2.5 py-2 text-[11px] text-amber-200 ring-1 ring-amber-500/30">
            ⚠ {lowRes} foto diperbesar jauh melebihi resolusi aslinya — bisa terlihat pecah. Kurangi zoom atau pakai sel lebih kecil.
          </p>
        )}
      </Section>

      <Section title="Pengaturan">
        <div>
          <div className="mb-1 text-xs text-ink-300">Format file</div>
          <Seg
            value={kind}
            onChange={setKind}
            options={[
              { v: "jpg", label: "JPG", title: "4:4:4 tanpa subsampling + DPI" },
              { v: "tif", label: "TIFF", title: "Tanpa kompresi lossy (LZW)" },
              { v: "pdf", label: "PDF", title: "Satu file multi-halaman, TrimBox untuk bleed" },
            ]}
          />
        </div>
        {kind !== "tif" && <Slider label="Kualitas JPEG" min={80} max={100} value={quality} onChange={setQuality} />}
        {!f.isPrint && (
          <div>
            <div className="mb-1 text-xs text-ink-300">Resolusi</div>
            <Seg
              value={scale}
              onChange={setScale}
              options={[
                { v: 1, label: `1× (${f.pageW})` },
                { v: 2, label: `2× (${f.pageW * 2})` },
                { v: 3, label: `3× (${f.pageW * 3})` },
              ]}
            />
          </div>
        )}
        {f.isPrint && f.bleed > 0 && <Toggle label="Sertakan bleed (untuk lab cetak)" value={bleed} onChange={setBleed} />}
        {f.spread && <Toggle label="Pisah jadi halaman kiri & kanan" value={split} onChange={setSplit} />}
        {project.watermark?.on && <Toggle label="Sertakan watermark" value={withWm} onChange={setWithWm} />}
        {!multi || project.pages.length > 1 ? (
          <Seg value={which} onChange={setWhich} options={[{ v: "all", label: "Semua halaman" }, { v: "current", label: "Halaman ini" }]} />
        ) : null}
        {dir && kind !== "pdf" && (
          <button onClick={() => setDir("")} className="w-full truncate text-left text-[11px] text-ink-400 hover:text-ink-200" title="Klik untuk ganti folder">
            📁 {dir}
          </button>
        )}
      </Section>

      <div className="space-y-2 p-4">
        <Btn variant="primary" className="w-full py-2.5 text-sm" onClick={run} disabled={busy}>
          <Download size={16} /> {busy ? "Mengekspor…" : `Export ${kind.toUpperCase()}`}
        </Btn>
        {busy && (
          <div>
            <div className="mb-1 flex justify-between text-[11px] text-ink-300">
              <span className="truncate">{prog.msg}</span>
              <span className="tabular-nums">
                {prog.done}/{prog.total}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded bg-ink-700">
              <div className="h-full bg-accent transition-all" style={{ width: `${(prog.done / Math.max(1, prog.total)) * 100}%` }} />
            </div>
          </div>
        )}
        {result && (
          <div className={`rounded-md px-3 py-2 text-xs ${result.ok ? "bg-emerald-500/10 text-emerald-200" : "bg-red-500/10 text-red-200"}`}>
            {result.text}
            {result.ok && result.folder && (
              <button onClick={() => openFolder(result.folder!)} className="ml-2 inline-flex items-center gap-1 underline">
                <FolderOpen size={12} /> Buka folder
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
