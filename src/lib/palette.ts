import type { Photo } from "../types";
import { fileUrl } from "./images";

export interface Palette {
  id: string;
  name: string;
  colors: string[];
}

export const PRESET_PALETTES: Palette[] = [
  { id: "netral", name: "Netral Elegan", colors: ["#ffffff", "#f5f1ea", "#e6dccf", "#c8b8a6", "#8c7b6b", "#2b2622"] },
  { id: "sage", name: "Sage Wedding", colors: ["#f3f4ee", "#dfe5d6", "#b7c4a6", "#8a9a76", "#5e6b4f", "#2f3628"] },
  { id: "rose", name: "Dusty Rose", colors: ["#fbf3f1", "#f0d9d4", "#dcb3ab", "#c08b84", "#8e5b57", "#4a2f2e"] },
  { id: "terracotta", name: "Terracotta", colors: ["#f7ede3", "#e9c9a9", "#d39a6a", "#b86b43", "#8a4a2f", "#3d2418"] },
  { id: "navygold", name: "Navy & Gold", colors: ["#f8f5ee", "#e8dcc0", "#c9a96e", "#9c7c43", "#243b55", "#141e30"] },
  { id: "ocean", name: "Ocean", colors: ["#f0f7fa", "#cfe6ee", "#9cc9d9", "#5b9db8", "#2f6f8c", "#173a4a"] },
  { id: "lavender", name: "Lavender", colors: ["#f7f4fb", "#e6def3", "#c9b8e6", "#9f8cc4", "#6d5a96", "#352b4d"] },
  { id: "pastel", name: "Pastel", colors: ["#fff1f2", "#ffe4e6", "#e0f2fe", "#ede9fe", "#ecfccb", "#fef9c3"] },
  { id: "mono", name: "Monokrom", colors: ["#ffffff", "#e5e5e5", "#a3a3a3", "#525252", "#262626", "#000000"] },
];

const KEY = "albumku.palettes.v1";

export interface PaletteState {
  activeId: string;
  custom: string[];
}

export function loadPaletteState(): PaletteState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { activeId: "netral", custom: [], ...JSON.parse(raw) };
  } catch {
    /* penyimpanan tidak tersedia */
  }
  return { activeId: "netral", custom: [] };
}

export function savePaletteState(s: PaletteState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* abaikan */
  }
}

const hex = (r: number, g: number, b: number) => "#" + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
const lum = (c: number[]) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

/** Campur warna dengan putih (versi lembut untuk background). */
export function soften(h: string, amount = 0.75) {
  const n = parseInt(h.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return hex(...(c.map((v) => v + (255 - v) * amount) as [number, number, number]));
}

function loadImage(path: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const im = new Image();
    im.crossOrigin = "anonymous";
    im.onload = () => res(im);
    im.onerror = rej;
    im.src = fileUrl(path);
  });
}

/** Ambil palet dominan dari foto (k-means sederhana pada thumbnail kecil), urut terang -> gelap. */
export async function extractPalette(photos: Photo[], k = 6): Promise<string[]> {
  const px: number[][] = [];
  const cv = document.createElement("canvas");
  cv.width = cv.height = 48;
  const ctx = cv.getContext("2d", { willReadFrequently: true })!;
  for (const p of photos.slice(0, 8)) {
    try {
      const im = await loadImage(p.thumb);
      ctx.drawImage(im, 0, 0, 48, 48);
      const d = ctx.getImageData(0, 0, 48, 48).data;
      for (let i = 0; i < d.length; i += 4) px.push([d[i], d[i + 1], d[i + 2]]);
    } catch {
      /* lewati foto yang gagal dimuat */
    }
  }
  if (!px.length) return [];
  // inisialisasi k-means++ deterministik: mulai dari piksel median kecerahan
  const sorted = [...px].sort((a, b) => lum(a) - lum(b));
  const cents: number[][] = [sorted[Math.floor(sorted.length / 2)]];
  const dist = (a: number[], b: number[]) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
  while (cents.length < k) {
    let best = px[0];
    let bd = -1;
    for (let i = 0; i < px.length; i += 3) {
      const d = Math.min(...cents.map((c) => dist(c, px[i])));
      if (d > bd) {
        bd = d;
        best = px[i];
      }
    }
    cents.push([...best]);
  }
  const counts = new Array(k).fill(0);
  for (let it = 0; it < 10; it++) {
    const sum = cents.map(() => [0, 0, 0]);
    counts.fill(0);
    for (const p of px) {
      let bi = 0;
      let bd = Infinity;
      cents.forEach((c, i) => {
        const d = dist(c, p);
        if (d < bd) {
          bd = d;
          bi = i;
        }
      });
      sum[bi][0] += p[0];
      sum[bi][1] += p[1];
      sum[bi][2] += p[2];
      counts[bi]++;
    }
    cents.forEach((c, i) => {
      if (counts[i]) for (let j = 0; j < 3; j++) c[j] = sum[i][j] / counts[i];
    });
  }
  return cents
    .map((c, i) => ({ c, n: counts[i] }))
    .filter((x) => x.n > px.length * 0.01)
    .sort((a, b) => lum(b.c) - lum(a.c))
    .map((x) => hex(x.c[0], x.c[1], x.c[2]));
}
