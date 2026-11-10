import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { Download, X } from "./icons";
import { useEffect, useState } from "react";
import { useStore } from "../store";
import { saveProject } from "../lib/actions";

const RECHECK_MS = 6 * 3600 * 1000;

/** Cek versi baru (GitHub Releases) saat aplikasi dibuka & berkala, lalu tawarkan update otomatis. */
export function UpdateNotice() {
  const [upd, setUpd] = useState<Update | null>(null);
  const [hidden, setHidden] = useState(false);
  const [phase, setPhase] = useState<"idle" | "downloading" | "installing" | "error">("idle");
  const [prog, setProg] = useState({ got: 0, total: 0 });
  const [err, setErr] = useState("");
  const dirty = useStore((s) => s.dirty && !!s.project);

  useEffect(() => {
    // build pengembangan tidak punya rilis untuk dibandingkan
    if (!import.meta.env.PROD) return;
    const run = () =>
      check()
        .then((u) => {
          if (u) {
            setUpd(u);
            setHidden(false);
          }
        })
        .catch(() => null);
    run();
    const t = setInterval(run, RECHECK_MS);
    return () => clearInterval(t);
  }, []);

  if (!upd || hidden) return null;

  const install = async (saveFirst: boolean) => {
    setErr("");
    try {
      if (saveFirst) {
        await saveProject();
        if (useStore.getState().dirty) return; // simpan dibatalkan
      }
      setPhase("downloading");
      let got = 0;
      await upd.downloadAndInstall((ev) => {
        if (ev.event === "Started") setProg({ got: 0, total: ev.data.contentLength ?? 0 });
        else if (ev.event === "Progress") {
          got += ev.data.chunkLength;
          setProg((p) => ({ ...p, got }));
        } else if (ev.event === "Finished") setPhase("installing");
      });
      await relaunch();
    } catch (e) {
      setPhase("error");
      setErr(String(e));
    }
  };

  const mb = (n: number) => (n / 1048576).toFixed(1);
  const busy = phase === "downloading" || phase === "installing";

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 space-y-2.5 rounded-xl bg-ink-900 p-4 text-xs shadow-2xl ring-1 ring-accent/50">
      <div className="flex items-start gap-2">
        <Download size={16} className="mt-0.5 shrink-0 text-accent" />
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-ink-100">Albumku {upd.version} tersedia</div>
          <div className="text-ink-400">Versi kamu sekarang {upd.currentVersion}</div>
        </div>
        {!busy && (
          <button title="Nanti saja" onClick={() => setHidden(true)} className="text-ink-400 hover:text-ink-100">
            <X size={14} />
          </button>
        )}
      </div>
      {upd.body && <p className="max-h-28 overflow-auto whitespace-pre-line leading-relaxed text-ink-300">{upd.body}</p>}
      {busy ? (
        <div>
          <div className="mb-1 flex justify-between text-[11px] text-ink-300">
            <span>{phase === "installing" ? "Memasang… aplikasi akan terbuka ulang" : "Mengunduh…"}</span>
            {prog.total > 0 && (
              <span className="tabular-nums">
                {mb(prog.got)} / {mb(prog.total)} MB
              </span>
            )}
          </div>
          <div className="h-1.5 overflow-hidden rounded bg-ink-700">
            <div className="h-full bg-accent transition-all" style={{ width: phase === "installing" ? "100%" : `${prog.total ? (prog.got / prog.total) * 100 : 5}%` }} />
          </div>
        </div>
      ) : dirty ? (
        <>
          <p className="text-amber-200">Proyek belum disimpan. Aplikasi akan tertutup sebentar saat update.</p>
          <div className="flex gap-1.5">
            <button onClick={() => install(true)} className="flex-1 rounded-md bg-accent py-1.5 font-semibold text-on-accent hover:bg-accent-deep">
              Simpan & update
            </button>
            <button onClick={() => install(false)} className="rounded-md px-2.5 py-1.5 text-ink-300 ring-1 ring-ink-600 hover:text-ink-100">
              Update tanpa simpan
            </button>
          </div>
        </>
      ) : (
        <button onClick={() => install(false)} className="w-full rounded-md bg-accent py-1.5 font-semibold text-on-accent hover:bg-accent-deep">
          Update sekarang
        </button>
      )}
      {err && <p className="text-red-300">Gagal update: {err}</p>}
    </div>
  );
}
