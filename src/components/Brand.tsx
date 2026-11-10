import { Check, Contrast, SignOut, UserCircle } from "./icons";
import { invoke } from "@tauri-apps/api/core";
import { ask } from "@tauri-apps/plugin-dialog";
import { useStore } from "../store";
import { useEffect, useRef, useState } from "react";
import { getThemeMode, setThemeMode, type ThemeMode } from "../lib/theme";
import { getVersion } from "@tauri-apps/api/app";

let versionCache = "";

/** Nomor versi aplikasi yang sedang terpasang (untuk memastikan update sudah masuk). */
export function AppVersion({ className = "" }: { className?: string }) {
  const [v, setV] = useState(versionCache);
  useEffect(() => {
    if (!versionCache) getVersion().then((x) => setV((versionCache = x))).catch(() => null);
  }, []);
  return v ? <span className={`rounded bg-ink-800 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-ink-400 ring-1 ring-ink-700 ${className}`}>v{v}</span> : null;
}

/** Tanda ALBUMKU: ikon aplikasi (album terbuka) + nama. */
export function Logo({ size = 18, wordmark = true, className = "" }: { size?: number; wordmark?: boolean; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <img src="/logo.png" width={size} height={size} alt="" className="rounded-[22%]" draggable={false} />
      {wordmark && <span className="font-display font-semibold tracking-[-0.01em] text-ink-100">Albumku</span>}
    </span>
  );
}

const MODES: { v: ThemeMode; label: string; hint: string }[] = [
  { v: "dark", label: "Gelap", hint: "Nyaman untuk menilai foto" },
  { v: "light", label: "Terang", hint: "Ruangan terang / siang hari" },
  { v: "system", label: "Ikuti sistem", hint: "Berubah mengikuti pengaturan Windows / macOS" },
];

/** Pilihan tampilan gelap / terang / sistem. */
export function ThemeMenu() {
  const [mode, setMode] = useState<ThemeMode>(getThemeMode());
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    window.addEventListener("mousedown", h);
    return () => window.removeEventListener("mousedown", h);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        title="Tampilan"
        className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition-colors ${open ? "bg-ink-700 text-ink-100" : "text-ink-200 hover:bg-ink-700"}`}
      >
        <Contrast size={15} /> Tampilan
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-1.5 w-60 rounded-lg bg-ink-850 p-1 shadow-[0_12px_32px_rgb(var(--shadow)/0.35)] ring-1 ring-ink-700">
          {MODES.map((m) => (
            <button
              key={m.v}
              onClick={() => {
                setThemeMode(m.v);
                setMode(m.v);
                setOpen(false);
              }}
              className="flex w-full items-start gap-2 rounded-md px-2.5 py-2 text-left hover:bg-ink-700"
            >
              <span className="mt-0.5 w-3.5">{mode === m.v && <Check size={14} className="text-accent" />}</span>
              <span>
                <span className="block text-[13px] text-ink-100">{m.label}</span>
                <span className="block text-[11px] text-ink-400">{m.hint}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Menu akun lisensi: email aktif + logout supaya lisensi bisa dipindah ke komputer lain. */
export function LicenseMenu() {
  const lic = useStore((s) => s.license);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    window.addEventListener("mousedown", h);
    return () => window.removeEventListener("mousedown", h);
  }, [open]);

  if (!lic) return null;

  const logout = async () => {
    setErr("");
    const dirty = useStore.getState().dirty && !!useStore.getState().project;
    const ok = await ask(
      `Lisensi ${lic.email} akan dilepas dari komputer ini, lalu bisa diaktifkan di komputer lain.${dirty ? "\n\nProyek yang belum disimpan akan hilang. Simpan dulu (Ctrl+S) bila perlu." : ""}`,
      { title: "Logout lisensi", kind: "warning", okLabel: "Logout", cancelLabel: "Batal" },
    );
    if (!ok) return;
    setBusy(true);
    try {
      const r = await invoke<{ ok: boolean; message: string }>("license_logout");
      if (r.ok) location.reload();
      else setErr(r.message);
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        title={`Lisensi: ${lic.email}`}
        className={`inline-flex max-w-[180px] items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition-colors ${open ? "bg-ink-700 text-ink-100" : "text-ink-200 hover:bg-ink-700"}`}
      >
        <UserCircle size={15} className="shrink-0" />
        <span className="truncate">{lic.name || lic.email}</span>
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-1.5 w-72 rounded-lg bg-ink-850 p-3 text-xs shadow-[0_12px_32px_rgb(var(--shadow)/0.35)] ring-1 ring-ink-700">
          <div className="text-[11px] text-ink-400">Lisensi aktif{lic.offline ? " (offline)" : ""}</div>
          {lic.name && <div className="mt-1 text-[13px] text-ink-100">{lic.name}</div>}
          <div className="truncate text-ink-200">{lic.email}</div>
          <button
            onClick={logout}
            disabled={busy}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-md py-2 text-red-300 ring-1 ring-red-500/40 hover:bg-red-500/10 disabled:opacity-50"
          >
            <SignOut size={14} /> {busy ? "Melepas lisensi…" : "Logout dari komputer ini"}
          </button>
          <p className="mt-2 leading-relaxed text-ink-400">Pakai saat pindah komputer. Setelah logout, aktifkan email yang sama di komputer baru.</p>
          {err && <p className="mt-2 rounded bg-red-500/10 px-2 py-1.5 text-red-200">{err}</p>}
        </div>
      )}
    </div>
  );
}
