import { BookOpen, FolderOpen, Instagram, Newspaper } from "./icons";
import { useState } from "react";
import { emptyPage, useStore } from "../store";
import type { Format } from "../types";
import { openProject } from "../lib/actions";
import { ALBUM_SIZES, MAGAZINE_SIZES, SLIDE_RATIOS, SOCIAL_SIZES, docSize, printFormat, socialFormat } from "../lib/formats";
import { Btn, Toggle } from "./ui";
import { Logo, ThemeMenu } from "./Brand";

type Cat = "album" | "magazine" | "social";

const CAROUSEL = 100;
const PUZZLE = 101;

function SizeCard({ active, onClick, label, sub, ratio }: { active: boolean; onClick: () => void; label: string; sub?: string; ratio: number }) {
  return (
    <button
      onClick={onClick}
      className={`group flex items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors ${active ? "bg-accent-soft ring-1 ring-accent/70" : "hover:bg-ink-800"}`}
    >
      <div className="flex h-9 w-11 shrink-0 items-center justify-center">
        <div
          className={`rounded-[2px] border-[1.5px] ${active ? "border-accent bg-accent/25" : "border-ink-400 group-hover:border-ink-300"}`}
          style={ratio >= 1 ? { width: 40, height: 40 / ratio } : { height: 34, width: 34 * ratio }}
        />
      </div>
      <div className="min-w-0">
        <div className={`font-display text-[15px] ${active ? "text-ink-100" : "text-ink-200"}`}>{label}</div>
        {sub && <div className="truncate text-[11px] text-ink-400">{sub}</div>}
      </div>
    </button>
  );
}

/** Pratinjau bentuk kanvas sesuai skala: spread + lipatan, slide carousel, tile puzzle, bleed. */
function FormatPreview({ f }: { f: Format }) {
  const { W, H, TW, TH } = docSize(f);
  const k = Math.min(560 / W, 360 / H);
  const cols = f.spread ? 2 : f.cols ?? 1;
  const rows = f.rows ?? 1;
  const b = f.bleed * k;
  return (
    <div className="relative" style={{ width: W * k, height: H * k }}>
      <div className="absolute inset-0 rounded-[2px] bg-[#fbfaf8] shadow-[0_18px_40px_rgb(var(--shadow)/0.45)]" />
      {b > 0 && <div className="absolute border border-dashed border-red-400/70" style={{ left: b, top: b, width: TW * k, height: TH * k }} />}
      {Array.from({ length: cols - 1 }, (_, i) => (
        <div key={`c${i}`} className="absolute top-0 h-full w-px" style={{ left: b + ((TW * k) / cols) * (i + 1), background: f.spread ? "linear-gradient(90deg, rgba(0,0,0,.18), rgba(0,0,0,0))" : "rgba(180,80,180,.55)", width: f.spread ? 10 : 1 }} />
      ))}
      {Array.from({ length: rows - 1 }, (_, i) => (
        <div key={`r${i}`} className="absolute left-0 h-px w-full" style={{ top: b + ((TH * k) / rows) * (i + 1), background: "rgba(180,80,180,.55)" }} />
      ))}
    </div>
  );
}

export function Welcome() {
  const setProject = useStore((s) => s.setProject);
  const [cat, setCat] = useState<Cat>("album");
  const [size, setSize] = useState(0);
  const [manual, setManual] = useState(false);
  const [mw, setMw] = useState(25);
  const [mh, setMh] = useState(25);
  const [spread, setSpread] = useState(true);
  const [bleed, setBleed] = useState(3);
  const [orient, setOrient] = useState<"landscape" | "portrait">("landscape");
  const [slides, setSlides] = useState(3);
  const [ratio, setRatio] = useState(0);
  const [rows, setRows] = useState(2);
  const [name, setName] = useState("Album Baru");

  const build = (): Format => {
    if (cat === "social") {
      const r = SLIDE_RATIOS[ratio];
      if (size === CAROUSEL) return socialFormat("carousel", `Carousel ${slides} slide ${r.label}`, r.w, r.h, slides, 1);
      if (size === PUZZLE) return socialFormat("puzzle", `Puzzle 3 x ${rows}`, 1080, 1440, 3, rows);
      const s = SOCIAL_SIZES[size];
      return socialFormat(s.kind, s.label, s.w, s.h);
    }
    const list = cat === "album" ? ALBUM_SIZES : MAGAZINE_SIZES;
    const [w, h] = manual ? [mw, mh] : oriented(list[size].w, list[size].h);
    return printFormat(cat, `${w} × ${h} cm`, w, h, spread, bleed);
  };

  const create = () => {
    const f = build();
    setProject({ version: 1, name: name.trim() || "Album", format: f, pages: [emptyPage(f)] });
  };

  /** sesuaikan ukuran dengan orientasi (persegi tidak berubah) */
  function oriented(a: number, b: number): [number, number] {
    const [lo, hi] = [Math.min(a, b), Math.max(a, b)];
    return orient === "landscape" ? [hi, lo] : [lo, hi];
  }

  const fmt = build();
  const { W, H } = docSize(fmt);
  const cats: { v: Cat; label: string; icon: JSX.Element }[] = [
    { v: "album", label: "Album cetak", icon: <BookOpen size={16} /> },
    { v: "magazine", label: "Magazine", icon: <Newspaper size={16} /> },
    { v: "social", label: "Sosmed", icon: <Instagram size={16} /> },
  ];

  return (
    <div className="grid h-full grid-cols-[minmax(420px,520px)_1fr] bg-ink-950">
      <section className="flex min-h-0 flex-col border-r border-ink-700/70 bg-ink-900">
        <header className="flex items-center justify-between px-7 pb-5 pt-6">
          <Logo size={22} className="text-[19px]" />
          <div className="flex items-center gap-1">
            <ThemeMenu />
            <Btn onClick={openProject}>
              <FolderOpen size={15} /> Buka proyek
            </Btn>
          </div>
        </header>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-7 pb-6">
          <div>
            <h1 className="font-display text-[28px] font-medium leading-tight tracking-[-0.01em] text-ink-100">Mulai proyek baru</h1>
            <p className="mt-1 max-w-[42ch] text-[13px] leading-relaxed text-ink-300">Pilih ukuran, lalu seret foto sesi ke halaman. Template menyesuaikan orientasi foto dan wajah di dalamnya.</p>
          </div>

          <div className="flex gap-1 rounded-lg bg-ink-800 p-1">
            {cats.map((c) => (
              <button
                key={c.v}
                onClick={() => {
                  setCat(c.v);
                  setSize(0);
                  setManual(false);
                }}
                className={`flex flex-1 items-center justify-center gap-2 rounded-md py-2 text-[13px] transition-colors ${cat === c.v ? "bg-ink-600 text-ink-100" : "text-ink-300 hover:text-ink-100"}`}
              >
                {c.icon}
                {c.label}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-1">
              {cat === "social"
                ? [
                    ...SOCIAL_SIZES.map((s, i) => (
                      <SizeCard key={s.label} active={size === i} onClick={() => setSize(i)} label={s.label} sub={s.hint} ratio={s.w / s.h} />
                    )),
                    <SizeCard key="car" active={size === CAROUSEL} onClick={() => setSize(CAROUSEL)} label="Carousel seamless" sub="Foto menyambung antar slide" ratio={2.4} />,
                    <SizeCard key="puz" active={size === PUZZLE} onClick={() => setSize(PUZZLE)} label="Puzzle feed" sub="Satu desain jadi grid profil" ratio={1.5} />,
                  ]
                : (cat === "album" ? ALBUM_SIZES : MAGAZINE_SIZES).map((s, i) => {
                    const [w, h] = oriented(s.w, s.h);
                    return (
                      <SizeCard
                        key={s.label}
                        active={!manual && size === i}
                        onClick={() => {
                          setSize(i);
                          setManual(false);
                        }}
                        label={`${w} × ${h} cm`}
                        sub={spread ? `spread ${Math.round(w * 20) / 10} × ${h} cm` : "per halaman"}
                        ratio={w / h}
                      />
                    );
                  })}
              {cat !== "social" && <SizeCard active={manual} onClick={() => setManual(true)} label="Ukuran manual" sub="Tentukan sendiri (cm)" ratio={mw / mh} />}
            </div>

            {cat === "social" && size === CAROUSEL && (
              <div className="grid grid-cols-2 gap-4 rounded-lg bg-ink-850 p-4">
                <label className="flex items-center justify-between text-xs text-ink-200">
                  <span>Jumlah slide</span>
                  <input type="number" min={2} max={10} value={slides} onChange={(e) => setSlides(Math.min(10, Math.max(2, +e.target.value)))} className="w-16 rounded bg-ink-800 px-2 py-1 text-right outline-none ring-1 ring-ink-600" />
                </label>
                <div className="flex items-center justify-between gap-2 text-xs text-ink-200">
                  <span>Rasio slide</span>
                  <div className="flex gap-1">
                    {SLIDE_RATIOS.map((r, i) => (
                      <button key={r.label} onClick={() => setRatio(i)} className={`rounded px-2 py-1 ${ratio === i ? "bg-accent text-on-accent" : "bg-ink-800 text-ink-200"}`}>
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {cat === "social" && size === PUZZLE && (
              <div className="rounded-lg bg-ink-850 p-4">
                <label className="flex items-center justify-between text-xs text-ink-200">
                  <span>Jumlah baris (3 post per baris, tile 3:4 pas grid profil)</span>
                  <input type="number" min={1} max={4} value={rows} onChange={(e) => setRows(Math.min(4, Math.max(1, +e.target.value)))} className="w-16 rounded bg-ink-800 px-2 py-1 text-right outline-none ring-1 ring-ink-600" />
                </label>
              </div>
            )}

            {cat !== "social" && (
              <div className="grid grid-cols-2 gap-4 rounded-lg bg-ink-850 p-4">
                <div className="col-span-2 flex items-center justify-between gap-3 text-xs text-ink-200">
                  <span>Orientasi halaman</span>
                  <div className="flex gap-1.5">
                    {(["landscape", "portrait"] as const).map((o) => (
                      <button
                        key={o}
                        onClick={() => {
                          setOrient(o);
                          // ukuran manual ikut diputar
                          if ((o === "landscape") !== mw >= mh) {
                            setMw(mh);
                            setMh(mw);
                          }
                        }}
                        className={`flex items-center gap-2 rounded-md px-3 py-1.5 ${orient === o ? "bg-accent font-semibold text-on-accent" : "bg-ink-800 text-ink-200 hover:bg-ink-700"}`}
                      >
                        <span className={`inline-block rounded-[2px] border-2 ${orient === o ? "border-on-accent" : "border-ink-300"}`} style={o === "landscape" ? { width: 16, height: 11 } : { width: 11, height: 16 }} />
                        {o === "landscape" ? "Landscape" : "Portrait"}
                      </button>
                    ))}
                  </div>
                </div>
                {manual && (
                  <div className="col-span-2 flex items-center gap-2 text-sm text-ink-200">
                    <span className="text-xs text-ink-400">Lebar</span>
                    <input type="number" min={5} max={60} step={0.1} value={mw} onChange={(e) => setMw(Math.max(5, +e.target.value))} className="w-20 rounded bg-ink-800 px-2 py-1.5 outline-none ring-1 ring-ink-600" />
                    <span className="text-xs text-ink-400">× Tinggi</span>
                    <input type="number" min={5} max={60} step={0.1} value={mh} onChange={(e) => setMh(Math.max(5, +e.target.value))} className="w-20 rounded bg-ink-800 px-2 py-1.5 outline-none ring-1 ring-ink-600" />
                    <span className="text-xs text-ink-400">cm (per halaman)</span>
                  </div>
                )}
                <Toggle label="Spread (2 halaman berhadapan)" value={spread} onChange={setSpread} />
                <label className="flex items-center justify-between text-xs text-ink-200">
                  <span>Bleed</span>
                  <span className="flex items-center gap-1.5">
                    <input type="number" min={0} max={10} step={0.5} value={bleed} onChange={(e) => setBleed(Math.max(0, +e.target.value))} className="w-14 rounded bg-ink-800 px-2 py-1 text-right outline-none ring-1 ring-ink-600" />
                    mm
                  </span>
                </label>
              </div>
            )}

            <label className="block">
              <span className="mb-1 block text-xs text-ink-300">Nama proyek</span>
              <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-md bg-ink-800 px-3 py-2 text-sm text-ink-100 outline-none ring-1 ring-ink-600 focus:ring-accent" />
            </label>
          </div>
        </div>

        <footer className="border-t border-ink-700/70 px-7 py-4">
          <Btn variant="primary" className="w-full py-3 text-sm" onClick={create}>
            Buat proyek
          </Btn>
        </footer>
      </section>

      <section className="relative flex min-w-0 flex-col items-center justify-center gap-6 bg-stage p-10">
        <FormatPreview f={fmt} />
        <div className="text-center">
          <div className="font-display text-[22px] text-ink-100">{fmt.label}{fmt.spread ? ", spread" : ""}</div>
          <div className="mt-1 text-[13px] tabular-nums text-ink-300">
            Kanvas {W.toLocaleString("id-ID")} × {H.toLocaleString("id-ID")} px
            {fmt.isPrint ? ` pada ${fmt.dpi} dpi${fmt.bleed ? ", termasuk bleed (garis merah putus-putus)" : ""}` : `, export hingga ${fmt.pageW * 3} px per ${fmt.kind === "carousel" ? "slide" : "post"}`}
          </div>
        </div>
      </section>
    </div>
  );
}
