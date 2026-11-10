// Rilis ALBUMKU: build installer bertanda tangan + latest.json, lalu unggah ke GitHub Releases
// (repo publik khusus rilis) supaya aplikasi pembeli bisa update otomatis.
//
//   npm run release -- "Catatan rilis baris 1" "baris 2"   -> build + unggah
//   npm run release -- --no-publish                        -> build saja (file di folder release/)
//
// Kunci tanda tangan: C:\Users\<user>\.tauri\albumku.key (JANGAN hilang & jangan dibagikan:
// tanpa kunci ini, update berikutnya tidak bisa dipasang oleh aplikasi yang sudah terinstal).

import { execSync, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const REPO = "waskito2391-oss/albumku-releases";
const KEY = process.env.ALBUMKU_KEY || join(homedir(), ".tauri", "albumku.key");

const args = process.argv.slice(2);
const publish = !args.includes("--no-publish");
const notesArg = args.filter((a) => !a.startsWith("--")).join("\n").trim();

const conf = JSON.parse(readFileSync("src-tauri/tauri.conf.json", "utf8"));
const version = conf.version;
const tag = `v${version}`;
const notes = notesArg || `Albumku ${version}`;

if (!existsSync(KEY)) {
  console.error(`Kunci tanda tangan tidak ditemukan: ${KEY}`);
  process.exit(1);
}

console.log(`\n== Build ALBUMKU ${version} ==\n`);
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
const assetName = exe.replace(/ /g, ".");
const latest = {
  version,
  notes,
  pub_date: new Date().toISOString(),
  platforms: {
    "windows-x86_64": {
      signature: readFileSync(join(out, `${exe}.sig`), "utf8").trim(),
      url: `https://github.com/${REPO}/releases/download/${tag}/${assetName}`,
    },
  },
};
writeFileSync(join(out, "latest.json"), JSON.stringify(latest, null, 2));
console.log(`\nFile rilis siap di ${out}: ${exe}, ${exe}.sig, latest.json`);

if (!publish) process.exit(0);

const sh = (cmd) => execSync(cmd, { stdio: "pipe" }).toString();
try {
  sh("gh auth status");
} catch {
  console.log(`\nGitHub CLI belum login. Jalankan "gh auth login", lalu ulangi, atau unggah manual ketiga file di atas ke https://github.com/${REPO}/releases/new dengan tag ${tag}.`);
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
execSync(`gh release create ${tag} "${join(out, exe)}" "${join(out, `${exe}.sig`)}" "${join(out, "latest.json")}" --repo ${REPO} --title "Albumku ${version}" --notes-file "${notesFile}"`, { stdio: "inherit" });
console.log(`\nSelesai. Aplikasi versi lama akan menawarkan update ke ${version}.`);
