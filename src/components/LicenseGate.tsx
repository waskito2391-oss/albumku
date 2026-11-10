import { invoke } from "@tauri-apps/api/core";
import { Check, Copy } from "./icons";
import { useEffect, useState, type ReactNode } from "react";
import { Logo } from "./Brand";
import { useStore } from "../store";

export interface LicenseState {
  ok: boolean;
  code: string;
  message: string;
  email: string | null;
  name: string | null;
  machine: string;
  offline: boolean;
}

const remember = (s: LicenseState) =>
  useStore.getState().set({ license: s.ok && s.email ? { email: s.email, name: s.name ?? "", offline: s.offline } : null });

/** Aplikasi baru tampil setelah lisensi (email terdaftar + komputer ini) terverifikasi. */
export function LicenseGate({ children }: { children: ReactNode }) {
  const [st, setSt] = useState<LicenseState | null>(null);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [note, setNote] = useState("");

  const check = () => {
    setSt(null);
    invoke<LicenseState>("license_status").then((s) => {
      setSt(s);
      remember(s);
      if (s.email) setEmail(s.email);
      if (s.ok && s.offline) setNote(s.message);
    });
  };
  useEffect(check, []);

  const activate = async () => {
    if (!email.trim() || busy) return;
    setBusy(true);
    try {
      const s = await invoke<LicenseState>("license_activate", { email });
      setSt(s);
      remember(s);
    } finally {
      setBusy(false);
    }
  };

  if (st?.ok)
    return (
      <>
        {children}
        {note && (
          <div className="fixed bottom-3 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-md bg-amber-500/15 px-3 py-2 text-xs text-amber-200 shadow-lg ring-1 ring-amber-500/40 backdrop-blur">
            {note}
            <button onClick={() => setNote("")} className="text-amber-100 underline">
              Tutup
            </button>
          </div>
        )}
      </>
    );

  return (
    <div className="flex h-full items-center justify-center bg-ink-950 p-6">
      <div className="w-full max-w-sm space-y-4 rounded-xl bg-ink-900 p-6 ring-1 ring-ink-700">
        <Logo size={28} className="text-lg" />
        {!st ? (
          <p className="text-sm text-ink-300">Memeriksa lisensi…</p>
        ) : (
          <>
            <div>
              <h1 className="font-display text-base font-semibold text-ink-100">Aktivasi lisensi</h1>
              <p className="mt-1 text-xs leading-relaxed text-ink-400">Masukkan email yang terdaftar saat pembelian. Satu email hanya bisa dipakai di satu komputer.</p>
            </div>
            <input
              type="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && activate()}
              placeholder="email@contoh.com"
              className="w-full rounded-md bg-ink-800 px-3 py-2 text-sm text-ink-100 outline-none ring-1 ring-ink-600 focus:ring-accent"
            />
            {st.code !== "need_activation" && st.message && (
              <p className="rounded-md bg-red-500/10 px-3 py-2 text-xs leading-relaxed text-red-200 ring-1 ring-red-500/30">{st.message}</p>
            )}
            <button
              onClick={activate}
              disabled={busy || !email.trim()}
              className="w-full rounded-md bg-accent py-2 text-sm font-semibold text-on-accent hover:bg-accent-deep disabled:opacity-50"
            >
              {busy ? "Memeriksa…" : "Aktifkan"}
            </button>
            {(st.code === "offline_expired" || st.code === "network") && (
              <button onClick={check} className="w-full text-xs text-ink-300 underline hover:text-ink-100">
                Coba lagi
              </button>
            )}
            <div className="border-t border-ink-700/70 pt-3 text-[11px] text-ink-400">
              ID komputer ini
              <button
                title="Salin ID komputer"
                onClick={() => {
                  navigator.clipboard.writeText(st.machine).then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  });
                }}
                className="mt-1 flex w-full items-center justify-between rounded-md bg-ink-800 px-3 py-1.5 font-mono text-xs text-ink-200 ring-1 ring-ink-700 hover:ring-ink-500"
              >
                {st.machine}
                {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
              </button>
              <p className="mt-1.5">Kirim ID ini ke admin bila perlu pindah komputer.</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
