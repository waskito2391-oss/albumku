import { Eye, EyeOff, FilePlus2, FolderOpen, Grid3x3, Maximize2, Redo2, Save, Undo2, Wand2, ZoomIn, ZoomOut } from "./icons";
import { useState } from "react";
import { useStore } from "../store";
import { autoBuild, openProject, saveProject } from "../lib/actions";
import { formatSummary } from "../lib/formats";
import { Btn, Toggle } from "./ui";
import { AppVersion, LicenseMenu, Logo, ThemeMenu } from "./Brand";

function AutoBuildDialog({ onClose }: { onClose: () => void }) {
  const photos = useStore((s) => s.photos);
  const [min, setMin] = useState(2);
  const [max, setMax] = useState(4);
  const [onlyUnused, setOnlyUnused] = useState(true);
  const [replace, setReplace] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const run = async () => {
    setBusy(true);
    const n = await autoBuild({ min, max: Math.max(min, max), onlyUnused, replace });
    setBusy(false);
    if (n) onClose();
    else setMsg("Tidak ada foto yang bisa disusun. Import foto dulu.");
  };

  const num = (v: number, set: (n: number) => void) => (
    <input type="number" min={1} max={12} value={v} onChange={(e) => set(Math.min(12, Math.max(1, +e.target.value)))} className="w-14 rounded bg-ink-800 px-2 py-1 text-right text-sm outline-none ring-1 ring-ink-600" />
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-[380px] space-y-4 rounded-xl bg-ink-900 p-5 ring-1 ring-ink-600">
        <div>
          <h3 className="flex items-center gap-2 font-semibold text-ink-100">
            <Wand2 size={16} className="text-accent" /> Auto Isi
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-ink-400">
            Foto diurutkan menurut waktu jepret (EXIF), dikelompokkan per momen, lalu tiap halaman diberi template paling cocok dengan orientasi fotonya.
          </p>
        </div>
        <div className="flex items-center justify-between text-sm text-ink-200">
          <span>Foto per halaman</span>
          <span className="flex items-center gap-2">
            {num(min, setMin)} – {num(max, setMax)}
          </span>
        </div>
        <Toggle label="Hanya foto yang belum dipakai" value={onlyUnused} onChange={setOnlyUnused} />
        <Toggle label="Ganti semua halaman yang ada" value={replace} onChange={setReplace} />
        <p className="text-[11px] text-ink-400">{photos.length} foto di pustaka.</p>
        {msg && <p className="text-xs text-red-300">{msg}</p>}
        <div className="flex justify-end gap-2">
          <Btn onClick={onClose}>Batal</Btn>
          <Btn variant="primary" onClick={run} disabled={busy}>
            {busy ? "Menyusun…" : "Susun otomatis"}
          </Btn>
        </div>
      </div>
    </div>
  );
}

export function TopBar() {
  const project = useStore((s) => s.project)!;
  const past = useStore((s) => s.past);
  const future = useStore((s) => s.future);
  const guides = useStore((s) => s.guides);
  const zoom = useStore((s) => s.zoom);
  const dirty = useStore((s) => s.dirty);
  const set = useStore((s) => s.set);
  const [auto, setAuto] = useState(false);

  const newProject = () => {
    if (dirty && !confirm("Perubahan belum disimpan. Tetap buat proyek baru?")) return;
    useStore.getState().setProject(null);
  };

  return (
    <header className="flex h-12 shrink-0 items-center gap-1 border-b border-ink-700/70 bg-ink-900 px-3">
      <Logo className="mr-1.5 text-[15px]" />
      <AppVersion className="mr-3" />
      <Btn title="Proyek baru" onClick={newProject}>
        <FilePlus2 size={15} />
      </Btn>
      <Btn title="Buka proyek" onClick={openProject}>
        <FolderOpen size={15} />
      </Btn>
      <Btn title="Simpan (Ctrl+S)" onClick={() => saveProject()}>
        <Save size={15} />
      </Btn>
      <div className="mx-2 h-5 w-px bg-ink-700" />
      <Btn title="Undo (Ctrl+Z)" disabled={!past.length} onClick={() => useStore.getState().undo()}>
        <Undo2 size={15} />
      </Btn>
      <Btn title="Redo (Ctrl+Y)" disabled={!future.length} onClick={() => useStore.getState().redo()}>
        <Redo2 size={15} />
      </Btn>
      <div className="mx-2 h-5 w-px bg-ink-700" />
      <Btn variant="soft" onClick={() => setAuto(true)}>
        <Wand2 size={14} className="text-accent" /> Auto Isi
      </Btn>
      {!project.format.isPrint && project.format.kind !== "story" && (
        <Btn variant="soft" className="ml-1" onClick={() => set({ planner: true })}>
          <Grid3x3 size={14} className="text-accent" /> Feed Planner
        </Btn>
      )}

      <div className="mx-auto flex min-w-0 items-center gap-2 px-4">
        <input
          value={project.name}
          onChange={(e) => useStore.getState().commit((p) => void (p.name = e.target.value), "name")}
          className="w-48 truncate rounded bg-transparent px-2 py-1 text-center text-sm text-ink-100 outline-none hover:bg-ink-800 focus:bg-ink-800"
        />
        {dirty && <span className="h-1.5 w-1.5 rounded-full bg-accent" title="Belum disimpan" />}
        <span className="truncate text-[11px] text-ink-400">{formatSummary(project.format)}</span>
      </div>

      <LicenseMenu />
      <ThemeMenu />
      <Btn title={guides ? "Sembunyikan garis bantu" : "Tampilkan garis bantu"} onClick={() => set({ guides: !guides })} active={guides}>
        {guides ? <Eye size={15} /> : <EyeOff size={15} />} Garis bantu
      </Btn>
      <div className="mx-2 h-5 w-px bg-ink-700" />
      <Btn title="Perkecil" onClick={() => set({ zoom: Math.max(0.25, zoom / 1.25) })}>
        <ZoomOut size={15} />
      </Btn>
      <span className="w-11 text-center text-xs tabular-nums text-ink-300">{Math.round(zoom * 100)}%</span>
      <Btn title="Perbesar" onClick={() => set({ zoom: Math.min(4, zoom * 1.25) })}>
        <ZoomIn size={15} />
      </Btn>
      <Btn title="Pas layar" onClick={() => set({ zoom: 1 })}>
        <Maximize2 size={15} />
      </Btn>
      {auto && <AutoBuildDialog onClose={() => setAuto(false)} />}
    </header>
  );
}
