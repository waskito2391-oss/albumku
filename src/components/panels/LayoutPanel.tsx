import { BoundingBox, Copy, Crosshair, ImageOff, ImagePlus, Plus, RotateCcw, RotateCw, Save, ScanFace, Shuffle, SplitH, SplitV, Trash2, X } from "../icons";
import { memo, useEffect, useMemo, useState } from "react";
import { useStore } from "../../store";
import type { Layout, Photo } from "../../types";
import { layoutCount } from "../../lib/api";
import { applyLayout, setPageBackground, smartCropAll } from "../../lib/actions";
import { pagePhotoIds, rankedLayouts, smartOffset } from "../../lib/fit";
import { displayAspect, fromUnit, pageAspect, panelCols, panelRows, toUnit, unitOf } from "../../lib/formats";
import { addCell, duplicateCell, gridCells, loadTemplates, makeTemplate, removeLine, setCellRect, splitCell, storeTemplates, templateLayout, type MyTemplate } from "../../lib/celledit";
import { Btn, Section, Seg, Slider, Toggle } from "../ui";

const LayoutThumb = memo(function LayoutThumb({ l, disp, cols, rows }: { l: Layout; disp: number; cols: number; rows: number }) {
  const A = disp * 100;
  const g = 1.6;
  return (
    <svg viewBox={`0 0 ${A} 100`} className="block h-full w-full">
      <rect width={A} height={100} fill="#f3f3f3" />
      {l.blanks.map((c, i) => (
        <rect key={`b${i}`} x={c.x * A + g} y={c.y * 100 + g} width={c.w * A - 2 * g} height={c.h * 100 - 2 * g} fill="none" stroke="#c4c4c4" strokeDasharray="3 2" strokeWidth={0.8} />
      ))}
      {l.cells.map((c, i) => (
        <rect key={i} x={c.x * A + g} y={c.y * 100 + g} width={c.w * A - 2 * g} height={c.h * 100 - 2 * g} fill="#9b9b9b" />
      ))}
      {Array.from({ length: cols - 1 }, (_, i) => (
        <line key={`c${i}`} x1={(A * (i + 1)) / cols} y1={0} x2={(A * (i + 1)) / cols} y2={100} stroke="#d06bd0" strokeWidth={0.6} strokeDasharray="2 2" />
      ))}
      {Array.from({ length: rows - 1 }, (_, i) => (
        <line key={`r${i}`} x1={0} y1={(100 * (i + 1)) / rows} x2={A} y2={(100 * (i + 1)) / rows} stroke="#d06bd0" strokeWidth={0.6} strokeDasharray="2 2" />
      ))}
    </svg>
  );
});

type Kind = "all" | "grid" | "magazine" | "split";
const kindOf = (l: Layout): Kind => (l.kind === "split" ? "split" : l.kind === "magazine" || l.kind === "spread-mag" ? "magazine" : "grid");

export function LayoutPanel() {
  const project = useStore((s) => s.project)!;
  const pageIdx = useStore((s) => s.pageIdx);
  const sel = useStore((s) => s.sel);
  const photos = useStore((s) => s.photos);
  const commit = useStore((s) => s.commit);
  const f = project.format;
  const page = project.pages[pageIdx];
  const map = useMemo(() => new Map(photos.map((p) => [p.id, p])), [photos]);
  const ids = pagePhotoIds(page);
  const idKey = ids.join(",");
  const pagePhotos = useMemo(() => ids.map((id) => map.get(id)).filter((x): x is Photo => !!x), [idKey, map]);

  const [n, setN] = useState(Math.max(1, ids.length || page.cells.length || 3));
  useEffect(() => {
    if (ids.length) setN(ids.length);
  }, [page.id, ids.length]);

  const [kind, setKind] = useState<Kind>("all");
  const [layouts, setLayouts] = useState<Layout[]>([]);
  const [shown, setShown] = useState(48);
  const [total, setTotal] = useState(0);
  const aspect = pageAspect(f, page.margin);
  const disp = displayAspect(f, page.margin);
  const smartCrop = useStore((s) => s.smartCrop);
  const cellEdit = useStore((s) => s.cellEdit);
  const [cropMsg, setCropMsg] = useState("");
  const [mine, setMine] = useState<MyTemplate[]>(loadTemplates);
  const [tplName, setTplName] = useState("");
  const [tplMsg, setTplMsg] = useState("");
  const [gr, setGr] = useState({ rows: 2, cols: 2 });
  const myList = mine.filter((t) => t.spread === f.spread);
  const updMine = (list: MyTemplate[]) => {
    setMine(list);
    return storeTemplates(list);
  };
  const saveTpl = () => {
    if (!page.cells.length) return;
    const name = tplName.trim() || `Templateku ${mine.length + 1}`;
    const ok = updMine([makeTemplate(page.cells, name, aspect, f.spread), ...mine]);
    setTplName("");
    setTplMsg(ok ? `"${name}" tersimpan di Templateku.` : "Gagal menyimpan template.");
  };

  useEffect(() => {
    let alive = true;
    rankedLayouts(f, page, n, pagePhotos.slice(0, n), 0.4).then((l) => alive && setLayouts(l));
    setShown(48);
    return () => {
      alive = false;
    };
  }, [n, idKey, aspect, f.spread, pagePhotos]);

  useEffect(() => {
    layoutCount(aspect, f.spread).then(setTotal);
  }, [aspect, f.spread]);

  const filtered = kind === "all" ? layouts : layouts.filter((l) => kindOf(l) === kind);
  const unit = unitOf(f);
  const maxG = f.isPrint ? 15 : 60;
  const maxM = f.isPrint ? 30 : 150;

  const cell = sel?.kind === "cell" ? page.cells[sel.index] : undefined;
  const cellPhoto = cell?.photoId ? map.get(cell.photoId) : undefined;

  return (
    <div>
      {cell && sel?.kind === "cell" && (
        <Section title="Foto terpilih">
          <p className="truncate text-xs text-ink-300">
            {cellPhoto?.name ?? "Sel kosong — klik 2x foto di pustaka untuk mengisi"}
            {!!cellPhoto?.faces?.length && <span className="ml-2 text-accent">({cellPhoto.faces.length} wajah)</span>}
          </p>
          {cellPhoto && (
            <>
              <Slider
                label="Zoom foto"
                min={1}
                max={5}
                step={0.01}
                value={cell.zoom}
                fmt={(v) => `${Math.round(v * 100)}%`}
                onChange={(v) => commit((p) => void (p.pages[pageIdx].cells[sel.index].zoom = v), `cz-${sel.index}`)}
              />
              {(() => {
                const rot = cell.rot ?? 0;
                const base = Math.round(rot / 90) * 90;
                const fine = Math.round((rot - base) * 10) / 10;
                const setRot = (v: number) => commit((p) => void (p.pages[pageIdx].cells[sel.index].rot = v), `crot-${sel.index}`);
                return (
                  <>
                    <Slider label="Rotasi (luruskan)" min={-45} max={45} step={0.1} value={fine} fmt={(v) => `${v > 0 ? "+" : ""}${v.toFixed(1)}°`} onChange={(v) => setRot(base + v)} />
                    <div className="grid grid-cols-3 gap-1">
                      <Btn variant="soft" title="Putar 90° ke kiri" onClick={() => setRot(((((base - 90) % 360) + 540) % 360) - 180 + fine)}>
                        <RotateCcw size={13} /> 90°
                      </Btn>
                      <Btn variant="soft" title="Putar 90° ke kanan" onClick={() => setRot(((((base + 90) % 360) + 540) % 360) - 180 + fine)}>
                        <RotateCw size={13} /> 90°
                      </Btn>
                      <Btn variant="soft" disabled={!rot} onClick={() => setRot(0)}>
                        Reset
                      </Btn>
                    </div>
                  </>
                );
              })()}
              <Btn variant="soft" className="w-full" title="Foto ini menutup seluruh halaman sebagai background" onClick={() => setPageBackground(pageIdx, cellPhoto.id)}>
                <ImagePlus size={13} /> Jadikan background halaman
              </Btn>
              <p className="text-[10px] text-ink-400">Klik 2x foto untuk mengatur ukuran & posisinya (tarik sudut biru, Esc = selesai). Seret foto untuk menggeser. Seret ke sel lain untuk menukar. Scroll = zoom. Saat diputar, foto otomatis diperbesar agar tidak ada sudut kosong.</p>
            </>
          )}
          <div className="grid grid-cols-3 gap-1">
            <Btn
              variant="soft"
              title={cellPhoto?.faces?.length ? "Posisikan ke wajah" : "Kembalikan ke tengah"}
              onClick={() => commit((p) => Object.assign(p.pages[pageIdx].cells[sel.index], { zoom: 1, ...smartOffset(f, page, cell, smartCrop ? cellPhoto : null) }))}
            >
              <Crosshair size={13} /> Pusat
            </Btn>
            <Btn variant="soft" onClick={() => commit((p) => void (p.pages[pageIdx].cells[sel.index].photoId = null))}>
              <ImageOff size={13} /> Kosong
            </Btn>
            <Btn
              variant="danger"
              onClick={() => {
                commit((p) => void p.pages[pageIdx].cells.splice(sel.index, 1));
                useStore.getState().select(null);
              }}
            >
              <Trash2 size={13} /> Sel
            </Btn>
          </div>
        </Section>
      )}

      <Section
        title="Template"
        right={<span className="text-[10px] tabular-nums text-ink-400">{total.toLocaleString("id-ID")} template di format ini</span>}
      >
        <div>
          <div className="mb-1.5 text-xs text-ink-300">Jumlah foto</div>
          <div className="grid grid-cols-6 gap-1">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((k) => (
              <button
                key={k}
                onClick={() => setN(k)}
                className={`rounded py-1 text-xs tabular-nums ${k === n ? "bg-accent font-semibold text-on-accent" : "bg-ink-800 text-ink-200 hover:bg-ink-700"}`}
              >
                {k}
              </button>
            ))}
          </div>
        </div>
        <Seg
          value={kind}
          onChange={setKind}
          options={[
            { v: "all", label: "Semua" },
            { v: "grid", label: f.spread ? "Bentang" : "Grid" },
            ...(f.spread ? [{ v: "split" as const, label: "Per hlm" }] : []),
            { v: "magazine", label: "Magazine" },
          ]}
        />
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-ink-400">{filtered.length} pilihan, urut paling cocok</span>
          <Btn
            variant="soft"
            onClick={() => {
              const pool = filtered.slice(0, 40);
              if (pool.length) applyLayout(pageIdx, pool[Math.floor(Math.random() * pool.length)]);
            }}
          >
            <Shuffle size={13} /> Acak
          </Btn>
        </div>
        <div className={`grid gap-2 ${disp > 2.2 ? "grid-cols-1" : disp > 1.2 ? "grid-cols-2" : "grid-cols-3"}`}>
          {filtered.slice(0, shown).map((l) => (
            <button
              key={l.id}
              onClick={() => applyLayout(pageIdx, l)}
              title={l.kind}
              className={`overflow-hidden rounded ring-1 transition ${page.layoutId === l.id ? "ring-2 ring-accent" : "ring-ink-600 hover:ring-accent/70"}`}
              style={{ aspectRatio: `${disp}` }}
            >
              <LayoutThumb l={l} disp={disp} cols={panelCols(f)} rows={panelRows(f)} />
            </button>
          ))}
        </div>
        {filtered.length > shown && (
          <Btn variant="soft" className="w-full" onClick={() => setShown(shown + 60)}>
            Tampilkan lebih banyak ({filtered.length - shown})
          </Btn>
        )}
      </Section>

      <Section title="Template manual">
        <Toggle label="Mode edit kotak" value={cellEdit} onChange={(v) => useStore.getState().set({ cellEdit: v })} />
        {cellEdit && (
          <>
            <p className="text-[10px] leading-relaxed text-ink-400">
              Seret kotak untuk memindah, tarik tepi/sudut untuk mengubah ukuran. Tepi otomatis menempel ke tepi halaman & kotak lain (tahan Alt agar bebas). Jarak antar foto ikut slider "Jarak antar foto".
            </p>
            <div className="grid grid-cols-2 gap-1">
              <Btn variant="soft" onClick={addCell}>
                <Plus size={13} /> Kotak baru
              </Btn>
              <Btn
                variant="danger"
                disabled={!page.cells.length}
                onClick={() => {
                  commit((p) => {
                    p.pages[pageIdx].cells = [];
                    p.pages[pageIdx].layoutId = null;
                  });
                  useStore.getState().select(null);
                }}
              >
                <Trash2 size={13} /> Hapus semua
              </Btn>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-ink-300">
              <span>Grid</span>
              <select value={gr.rows} onChange={(e) => setGr({ ...gr, rows: +e.target.value })} className="rounded bg-ink-800 px-1.5 py-1 text-ink-100 ring-1 ring-ink-600">
                {[1, 2, 3, 4, 5, 6].map((k) => (
                  <option key={k} value={k}>
                    {k} baris
                  </option>
                ))}
              </select>
              <span>×</span>
              <select value={gr.cols} onChange={(e) => setGr({ ...gr, cols: +e.target.value })} className="rounded bg-ink-800 px-1.5 py-1 text-ink-100 ring-1 ring-ink-600">
                {[1, 2, 3, 4, 5, 6].map((k) => (
                  <option key={k} value={k}>
                    {k} kolom
                  </option>
                ))}
              </select>
              <Btn variant="soft" className="ml-auto" onClick={() => gridCells(gr.rows, gr.cols)}>
                Pasang
              </Btn>
            </div>
            {cell && sel?.kind === "cell" ? (
              <div className="space-y-2 rounded-md bg-ink-800/60 p-2 ring-1 ring-ink-700">
                <div className="text-[11px] text-ink-300">Kotak {sel.index + 1}</div>
                <div className="grid grid-cols-4 gap-1">
                  <Btn variant="soft" title="Bagi kiri-kanan" onClick={() => splitCell(sel.index, "v")}>
                    <SplitV size={14} />
                  </Btn>
                  <Btn variant="soft" title="Bagi atas-bawah" onClick={() => splitCell(sel.index, "h")}>
                    <SplitH size={14} />
                  </Btn>
                  <Btn variant="soft" title="Duplikat kotak" onClick={() => duplicateCell(sel.index)}>
                    <Copy size={14} />
                  </Btn>
                  <Btn
                    variant="danger"
                    title="Hapus kotak"
                    onClick={() => {
                      commit((p) => {
                        p.pages[pageIdx].cells.splice(sel.index, 1);
                        p.pages[pageIdx].layoutId = null;
                      });
                      useStore.getState().select(null);
                    }}
                  >
                    <Trash2 size={14} />
                  </Btn>
                </div>
                <div className="grid grid-cols-2 gap-1">
                  <Btn variant="danger" title="Hapus semua kotak di kolom ini, sisa kotak melebar mengisi ruang" onClick={() => removeLine(sel.index, "col")}>
                    <Trash2 size={13} /> Hapus kolom
                  </Btn>
                  <Btn variant="danger" title="Hapus semua kotak di baris ini, sisa kotak memanjang mengisi ruang" onClick={() => removeLine(sel.index, "row")}>
                    <Trash2 size={13} /> Hapus baris
                  </Btn>
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {(
                    [
                      ["x", "X"],
                      ["y", "Y"],
                      ["w", "Lebar"],
                      ["h", "Tinggi"],
                    ] as const
                  ).map(([k, label]) => (
                    <label key={k} className="block text-[10px] text-ink-400">
                      {label} %
                      <input
                        type="number"
                        step={0.5}
                        value={Math.round(cell[k] * 1000) / 10}
                        onChange={(e) => e.target.value !== "" && setCellRect(sel.index, { [k]: +e.target.value / 100 }, k)}
                        className="mt-0.5 w-full rounded bg-ink-900 px-1.5 py-1 text-xs tabular-nums text-ink-100 outline-none ring-1 ring-ink-600 focus:ring-accent"
                      />
                    </label>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-ink-400">Klik kotak di kanvas untuk membagi, menduplikat, atau mengatur ukuran persisnya.</p>
            )}
          </>
        )}
        <div className="flex gap-1.5">
          <input
            value={tplName}
            onChange={(e) => setTplName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && saveTpl()}
            placeholder={`Templateku ${mine.length + 1}`}
            className="min-w-0 flex-1 rounded-md bg-ink-800 px-2.5 py-1.5 text-xs text-ink-100 outline-none ring-1 ring-ink-600 focus:ring-accent"
          />
          <Btn variant="soft" disabled={!page.cells.length} onClick={saveTpl} title="Simpan susunan kotak halaman ini sebagai template">
            <Save size={13} /> Simpan
          </Btn>
        </div>
        {tplMsg && <p className="text-[11px] text-ink-300">{tplMsg}</p>}
        {myList.length > 0 ? (
          <div className={`grid gap-2 ${disp > 2.2 ? "grid-cols-1" : disp > 1.2 ? "grid-cols-2" : "grid-cols-3"}`}>
            {myList.map((t) => {
              const l = templateLayout(t);
              return (
                <div key={t.id} className="group relative">
                  <button
                    onClick={() => applyLayout(pageIdx, l)}
                    title={`${t.name} (${t.cells.length} foto)${Math.abs(t.aspect - aspect) > 0.05 ? " — dibuat untuk rasio halaman lain" : ""}`}
                    className={`block w-full overflow-hidden rounded ring-1 transition ${page.layoutId === l.id ? "ring-2 ring-accent" : "ring-ink-600 hover:ring-accent/70"}`}
                    style={{ aspectRatio: `${disp}` }}
                  >
                    <LayoutThumb l={l} disp={disp} cols={panelCols(f)} rows={panelRows(f)} />
                  </button>
                  <div className="mt-0.5 truncate text-[10px] text-ink-400">{t.name}</div>
                  <button
                    title="Hapus dari Templateku"
                    onClick={() => updMine(mine.filter((x) => x.id !== t.id))}
                    className="absolute right-1 top-1 hidden rounded bg-black/60 p-0.5 text-white hover:bg-red-500/80 group-hover:block"
                  >
                    <X size={11} />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="flex items-center gap-1.5 text-[11px] text-ink-400">
            <BoundingBox size={13} /> Templateku masih kosong. Susun kotak lalu tekan Simpan.
          </p>
        )}
      </Section>

      <Section title="Smart crop wajah">
        <Toggle label="Posisikan foto mengikuti wajah" value={smartCrop} onChange={(v) => useStore.getState().set({ smartCrop: v })} />
        <p className="text-[10px] leading-relaxed text-ink-400">
          Wajah dideteksi saat import. Template yang memotong wajah diturunkan peringkatnya, dan foto otomatis digeser agar wajah tetap di dalam bingkai.
        </p>
        <Btn
          variant="soft"
          className="w-full"
          onClick={() => {
            const n = smartCropAll();
            setCropMsg(n ? `${n} foto berwajah diposisikan ulang.` : "Tidak ada foto berwajah di halaman.");
          }}
        >
          <ScanFace size={13} /> Terapkan ke semua halaman
        </Btn>
        {cropMsg && <p className="text-[11px] text-ink-300">{cropMsg}</p>}
      </Section>

      <Section title="Gaya halaman">
        <Slider
          label="Jarak antar foto"
          min={0}
          max={maxG}
          step={f.isPrint ? 0.5 : 1}
          value={toUnit(f, page.gutter)}
          suffix={` ${unit}`}
          onChange={(v) => commit((p) => void (p.pages[pageIdx].gutter = fromUnit(f, v)), "gutter")}
        />
        <Slider
          label="Margin tepi"
          min={0}
          max={maxM}
          step={f.isPrint ? 0.5 : 1}
          value={toUnit(f, page.margin)}
          suffix={` ${unit}`}
          onChange={(v) => commit((p) => void (p.pages[pageIdx].margin = fromUnit(f, v)), "margin")}
        />
        <Slider
          label="Sudut membulat"
          min={0}
          max={f.isPrint ? 15 : 80}
          step={f.isPrint ? 0.5 : 1}
          value={toUnit(f, page.radius)}
          suffix={` ${unit}`}
          onChange={(v) => commit((p) => void (p.pages[pageIdx].radius = fromUnit(f, v)), "radius")}
        />
        <Btn
          variant="soft"
          className="w-full"
          onClick={() =>
            commit((p) => {
              const r = p.pages[pageIdx];
              p.pages.forEach((pg) => Object.assign(pg, { gutter: r.gutter, margin: r.margin, radius: r.radius, bg: structuredClone(r.bg), bgPhoto: r.bgPhoto ? { ...r.bgPhoto } : null }));
            })
          }
        >
          Terapkan gaya & background ke semua halaman
        </Btn>
      </Section>
    </div>
  );
}
