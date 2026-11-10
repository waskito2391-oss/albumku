import { ChevronDown, ExternalLink, RefreshCw, Search } from "./icons";
import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../store";
import { listFonts, openAdobeFonts } from "../lib/api";

let lastScan = Date.now();

/** Pindai ulang font (mis. setelah mengaktifkan font baru di Creative Cloud). */
export async function refreshFonts() {
  lastScan = Date.now();
  const fonts = await listFonts(true);
  useStore.getState().set({ fonts, fontTick: useStore.getState().fontTick + 1 });
  return fonts;
}

/** Pemilih font dari semua font Windows + Adobe Fonts yang aktif, dengan pratinjau langsung. */
export function FontPicker({ value, onChange }: { value: string; onChange: (name: string) => void }) {
  const fonts = useStore((s) => s.fonts);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [src, setSrc] = useState<"all" | "adobe">("all");
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    window.addEventListener("mousedown", h);
    // font yang baru diaktifkan di Creative Cloud langsung ikut muncul
    if (Date.now() - lastScan > 15000) refreshFonts();
    return () => window.removeEventListener("mousedown", h);
  }, [open]);

  const adobeCount = useMemo(() => fonts.filter((f) => f.source === "adobe").length, [fonts]);
  const list = useMemo(() => {
    const k = q.trim().toLowerCase();
    return fonts.filter((f) => (src === "all" || f.source === "adobe") && (!k || f.name.toLowerCase().includes(k)));
  }, [fonts, q, src]);

  const reload = async () => {
    setBusy(true);
    await refreshFonts();
    setBusy(false);
  };

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between rounded-md bg-ink-800 px-2.5 py-2 text-left ring-1 ring-ink-600 hover:ring-ink-500">
        <span className="truncate text-sm text-ink-100" style={{ fontFamily: `"${value}"` }}>
          {value}
        </span>
        <ChevronDown size={14} className="text-ink-400" />
      </button>
      {open && (
        <div className="absolute left-0 right-0 z-30 mt-1 rounded-lg bg-ink-850 shadow-2xl ring-1 ring-ink-600">
          <div className="flex items-center gap-2 border-b border-ink-700 px-2.5 py-2">
            <Search size={13} className="text-ink-400" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Cari dari ${fonts.length} font…`} className="w-full bg-transparent text-xs text-ink-100 outline-none placeholder:text-ink-400" />
            <button onClick={reload} title="Muat ulang daftar font (setelah aktifkan font di Creative Cloud)" className="text-ink-400 hover:text-accent">
              <RefreshCw size={13} className={busy ? "animate-spin" : ""} />
            </button>
          </div>
          <div className="flex gap-1 border-b border-ink-700 px-2 py-1.5">
            {(["all", "adobe"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSrc(s)}
                className={`rounded px-2 py-0.5 text-[11px] ${src === s ? "bg-ink-600 text-ink-100" : "text-ink-300 hover:text-ink-100"}`}
              >
                {s === "all" ? `Semua (${fonts.length})` : `Adobe Fonts (${adobeCount})`}
              </button>
            ))}
          </div>
          <div className="max-h-80 overflow-y-auto py-1">
            {!fonts.length && <p className="px-3 py-4 text-center text-xs text-ink-400">Membaca font…</p>}
            {src === "adobe" && !adobeCount && fonts.length > 0 && (
              <p className="px-3 py-3 text-xs leading-relaxed text-ink-400">
                Belum ada Adobe Fonts aktif. Buka Creative Cloud, aktifkan font di fonts.adobe.com, lalu tekan ⟳.
              </p>
            )}
            {list.slice(0, 400).map((f) => (
              <button
                key={f.name}
                onClick={() => {
                  onChange(f.name);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-ink-700 ${f.name === value ? "text-accent" : "text-ink-100"}`}
              >
                <span className="truncate text-[15px]" style={{ fontFamily: `"${f.name}"` }}>
                  {f.name}
                </span>
                <span className="ml-auto flex shrink-0 items-center gap-1.5 text-[10px] text-ink-400" style={{ fontFamily: "Segoe UI" }}>
                  {f.weights.length > 2 ? `${f.weights.length} ketebalan` : ""}
                  {f.source === "adobe" && <span className="rounded bg-red-500/15 px-1 font-semibold text-red-300">Adobe</span>}
                </span>
              </button>
            ))}
          </div>
          <button
            onClick={() => openAdobeFonts(q)}
            className="flex w-full items-center justify-center gap-1.5 border-t border-ink-700 py-2 text-[11px] text-ink-300 hover:text-accent"
          >
            <ExternalLink size={12} /> Cari & aktifkan font baru di Adobe Fonts{q ? ` "${q}"` : ""}
          </button>
        </div>
      )}
    </div>
  );
}
