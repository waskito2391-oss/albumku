import { listen } from "@tauri-apps/api/event";
import { Download, FrameCorners, LayoutGrid, Palette, Type } from "./components/icons";
import { FramePanel } from "./components/panels/FramePanel";
import { useEffect } from "react";
import { useStore, type Tab } from "./store";
import { listFonts } from "./lib/api";
import { saveProject } from "./lib/actions";
import { Canvas } from "./components/Canvas";
import { PageStrip } from "./components/PageStrip";
import { PhotoLibrary } from "./components/PhotoLibrary";
import { TopBar } from "./components/TopBar";
import { Welcome } from "./components/Welcome";
import { FeedPlanner } from "./components/FeedPlanner";
import { DropLayer, useExplorerDrop } from "./components/DropLayer";
import { ExportPanel } from "./components/panels/ExportPanel";
import { GradientPanel } from "./components/panels/GradientPanel";
import { LayoutPanel } from "./components/panels/LayoutPanel";
import { TextPanel } from "./components/panels/TextPanel";

const TABS: { v: Tab; label: string; icon: JSX.Element }[] = [
  { v: "layout", label: "Layout", icon: <LayoutGrid size={15} /> },
  { v: "text", label: "Teks", icon: <Type size={15} /> },
  { v: "gradient", label: "Gradient", icon: <Palette size={15} /> },
  { v: "frame", label: "Bingkai", icon: <FrameCorners size={15} /> },
  { v: "export", label: "Export", icon: <Download size={15} /> },
];

function isTyping(e: KeyboardEvent) {
  const t = e.target as HTMLElement;
  return t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable;
}

export default function App() {
  const project = useStore((s) => s.project);
  const tab = useStore((s) => s.tab);
  const set = useStore((s) => s.set);
  const planner = useStore((s) => s.planner);
  useExplorerDrop();

  useEffect(() => {
    listFonts().then((fonts) => set({ fonts }));
    const un = listen<[number, number]>("import-progress", (e) => {
      const [done, total] = e.payload;
      if (useStore.getState().importing) set({ importing: { done, total } });
    });
    return () => {
      un.then((f) => f());
    };
  }, []);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const st = useStore.getState();
      if (!st.project) return;
      const k = e.key.toLowerCase();
      if (e.ctrlKey && k === "s") {
        e.preventDefault();
        saveProject(e.shiftKey);
        return;
      }
      if (isTyping(e)) return;
      if (e.ctrlKey && k === "z") {
        e.preventDefault();
        e.shiftKey ? st.redo() : st.undo();
      } else if (e.ctrlKey && k === "y") {
        e.preventDefault();
        st.redo();
      } else if (k === "delete" || k === "backspace") {
        const sel = st.sel;
        const i = st.pageIdx;
        if (!sel) return;
        e.preventDefault();
        st.commit((p) => {
          const pg = p.pages[i];
          if (sel.kind === "text") pg.texts = pg.texts.filter((t) => t.id !== sel.id);
          else if (sel.kind === "overlay") pg.overlays = pg.overlays.filter((o) => o.id !== sel.id);
          else if (pg.cells[sel.index]) pg.cells[sel.index].photoId = null;
        });
        if (sel.kind !== "cell") st.select(null);
      } else if (k === "pagedown" || (k === "arrowright" && !st.sel)) {
        st.setPage(Math.min(st.project.pages.length - 1, st.pageIdx + 1));
      } else if (k === "pageup" || (k === "arrowleft" && !st.sel)) {
        st.setPage(Math.max(0, st.pageIdx - 1));
      } else if (k === "escape") st.select(null);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  if (!project) return <Welcome />;

  return (
    <div className="flex h-full flex-col">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <PhotoLibrary />
        <main className="flex min-w-0 flex-1 flex-col">
          <Canvas />
          <PageStrip />
        </main>
        <aside className="flex w-[330px] shrink-0 flex-col border-l border-ink-700/70 bg-ink-900">
          <nav className="grid grid-cols-5 border-b border-ink-700/70">
            {TABS.map((t) => (
              <button
                key={t.v}
                onClick={() => set({ tab: t.v })}
                className={`flex flex-col items-center gap-1 py-2.5 text-[11px] transition-colors ${tab === t.v ? "border-b-2 border-accent text-accent" : "border-b-2 border-transparent text-ink-300 hover:text-ink-100"}`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </nav>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {tab === "layout" && <LayoutPanel />}
            {tab === "text" && <TextPanel />}
            {tab === "gradient" && <GradientPanel />}
            {tab === "frame" && <FramePanel />}
            {tab === "export" && <ExportPanel />}
          </div>
        </aside>
      </div>
      {planner && <FeedPlanner />}
      <DropLayer />
    </div>
  );
}
