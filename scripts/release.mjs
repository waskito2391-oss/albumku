// Rilis ALBUMKU: installer Windows (build lokal) + macOS (GitHub Actions), keduanya bertanda tangan,
// lalu latest.json & semua file diunggah ke GitHub Releases (repo publik khusus rilis)
// supaya aplikasi pembeli bisa update otomatis.
//
//   npm run release -- "Catatan rilis baris 1" "baris 2"   -> build Windows + Mac, lalu unggah
//   npm run release -- --no-mac "catatan"                  -> tanpa Mac
//   npm run release -- --no-publish                        -> build Windows saja (file di folder release/)
//
// Build Mac memakai kode yang sudah di-push ke origin/main, jadi commit & push dulu sebelum rilis.
// Kunci tanda tangan: C:\Users\<user>\.tauri\albumku.key (JANGAN hilang & jangan dibagikan:
// tanpa kunci ini, update berikutnya tidak bisa dipasang oleh aplikasi yang sudah terinstal).
// Untuk build Mac, kunci yang sama tersimpan sebagai secret TAURI_SIGNING_PRIVATE_KEY di repo kode.

import { execSync, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const REPO = "waskito2391-oss/albumku-releases";
const SRC_REPO = "waskito2391-oss/albumku";
const KEY = process.env.ALBUMKU_KEY || join(homedir(), ".tauri", "albumku.key");

const args = process.argv.slice(2);
const publish = !args.includes("--no-publish");
const mac = publish && !args.includes("--no-mac");
const notesArg = args.filter((a) => !a.startsWith("--")).join("\n").trim();

const conf = JSON.parse(readFileSync("src-tauri/tauri.conf.json", "utf8"));
const version = conf.version;
const tag = `v${version}`;
const notes = notesArg || `Albumku ${version}`;
const sh = (cmd) => execSync(cmd, { stdio: "pipe" }).toString().trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (!existsSync(KEY)) {
  console.error(`Kunci tanda tangan tidak ditemukan: ${KEY}`);
  process.exit(1);
}

/* ---------- mulai build Mac di GitHub (jalan paralel dengan build Windows) ---------- */
let macRun = null;
if (mac) {
  sh("git fetch -q origin main");
  const head = sh("git rev-parse HEAD");
  if (sh("git status --porcelain")) throw new Error("Ada perubahan yang belum di-commit. Commit & push dulu sebelum rilis.");
  if (head !== sh("git rev-parse origin/main")) throw new Error("Commit terbaru belum di-push ke origin/main. Push dulu sebelum rilis.");
  const since = Date.now() - 5000;
  sh(`gh workflow run release-mac.yml -R ${SRC_REPO} --ref main`);
  for (let i = 0; i < 30 && !macRun; i++) {
    await sleep(3000);
    const runs = JSON.parse(sh(`gh run list -R ${SRC_REPO} --workflow release-mac.yml --limit 5 --json databaseId,headSha,createdAt`));
    macRun = runs.find((r) => r.headSha === head && Date.parse(r.createdAt) >= since)?.databaseId ?? null;
  }
  if (!macRun) throw new Error("Build Mac di GitHub tidak terdeteksi.");
  console.log(`\n== Build Mac berjalan di GitHub (run ${macRun}) ==`);
}

/* ---------- build Windows (lokal) ---------- */
console.log(`\n== Build ALBUMKU ${version} (Windows) ==\n`);
const b = spawnSync("npx tauri build", {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, TAURI_SIGNING_PRIVATE_KEY: readFileSync(KEY, "utf8"), TAURI_SIGNING_PRIVATE_KEY_PASSWORD: process.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD ?? "" },
});
if (b.status !== 0) process.exit(b.status ?? 1);

const exe = `${conf.productName}_${version}_x64-setup.exe`;
const src = join("src-tauri", "target", "release", "bundle", "nsis");
const out = join("release", tag);
mkdirSync(out, { recursive: true });
copyFileSync(join(src, exe), join(out, exe));
copyFileSync(join(src, `${exe}.sig`), join(out, `${exe}.sig`));

// nama file di URL: GitHub mengganti spasi dengan titik
const url = (name) => `https://github.com/${REPO}/releases/download/${tag}/${name.replace(/ /g, ".")}`;
const latest = {
  version,
  notes,
  pub_date: new Date().toISOString(),
  platforms: {
    "windows-x86_64": { signature: readFileSync(join(out, `${exe}.sig`), "utf8").trim(), url: url(exe) },
  },
};
const assets = [exe, `${exe}.sig`];

/* ---------- tunggu & ambil hasil build Mac ---------- */
if (mac) {
  console.log(`\nMenunggu build Mac selesai (run ${macRun})…`);
  const w = spawnSync(`gh run watch ${macRun} -R ${SRC_REPO} --exit-status --interval 30`, { stdio: "inherit", shell: true });
  if (w.status !== 0) throw new Error(`Build Mac gagal. Lihat: https://github.com/${SRC_REPO}/actions/runs/${macRun}`);
  const md = join(out, "mac");
  sh(`gh run download ${macRun} -R ${SRC_REPO} -n mac-bundle -D "${md}"`);
  const files = (function walk(d) {
    return readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));
  })(md);
  const dmg = files.find((f) => f.endsWith(".dmg"));
  const tgz = files.find((f) => f.endsWith(".app.tar.gz"));
  const sig = files.find((f) => f.endsWith(".app.tar.gz.sig"));
  if (!dmg || !tgz || !sig) throw new Error("File hasil build Mac tidak lengkap.");
  const dmgName = `${conf.productName}_${version}_mac-universal.dmg`;
  const tgzName = `${conf.productName}_${version}_mac-universal.app.tar.gz`;
  copyFileSync(dmg, join(out, dmgName));
  copyFileSync(tgz, join(out, tgzName));
  copyFileSync(sig, join(out, `${tgzName}.sig`));
  const mp = { signature: readFileSync(sig, "utf8").trim(), url: url(tgzName) };
  latest.platforms["darwin-aarch64"] = mp;
  latest.platforms["darwin-x86_64"] = mp;
  assets.push(dmgName, tgzName, `${tgzName}.sig`);
}

writeFileSync(join(out, "latest.json"), JSON.stringify(latest, null, 2));
assets.push("latest.json");
console.log(`\nFile rilis siap di ${out}: ${assets.join(", ")}`);

if (!publish) process.exit(0);

try {
  sh("gh auth status");
} catch {
  console.log(`\nGitHub CLI belum login. Jalankan "gh auth login", lalu ulangi, atau unggah manual file di atas ke https://github.com/${REPO}/releases/new dengan tag ${tag}.`);
  process.exit(0);
}
try {
  sh(`gh repo view ${REPO}`);
} catch {
  console.log(`Membuat repo publik ${REPO}…`);
  sh(`gh repo create ${REPO} --public --description "Installer & update ALBUMKU"`);
}
const notesFile = join(out, "notes.txt");
writeFileSync(notesFile, notes);
console.log(`Mengunggah rilis ${tag} ke ${REPO}…`);
execSync(`gh release create ${tag} ${assets.map((a) => `"${join(out, a)}"`).join(" ")} --repo ${REPO} --title "Albumku ${version}" --notes-file "${notesFile}"`, { stdio: "inherit" });
console.log(`\nSelesai. Aplikasi versi lama akan menawarkan update ke ${version}.`);
