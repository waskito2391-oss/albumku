import { Component, type ReactNode } from "react";

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex h-full items-center justify-center bg-ink-950 p-8">
        <div className="max-w-lg space-y-3 rounded-xl bg-ink-900 p-6 ring-1 ring-ink-700">
          <h2 className="font-semibold text-ink-100">Terjadi kesalahan tampilan</h2>
          <pre className="max-h-40 overflow-auto whitespace-pre-wrap text-xs text-red-300">{this.state.error.message}</pre>
          <p className="text-xs text-ink-400">Data proyek masih ada di memori. Klik lanjutkan; jika berulang, simpan proyek (Ctrl+S) lalu buka ulang aplikasi.</p>
          <button onClick={() => this.setState({ error: null })} className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-on-accent">
            Lanjutkan
          </button>
        </div>
      </div>
    );
  }
}
