//! Generator template grid prosedural.
//!
//! Setiap template = pohon potongan (slicing tree): area dibelah vertikal/horizontal dengan
//! berbagai rasio (1/2, 1/3, golden ratio, proporsional jumlah foto) secara rekursif.
//! Varian "magazine" menyisakan satu sel kosong untuk teks/ruang napas.
//! Untuk album spread, ada template satu-bentang penuh + kombinasi halaman kiri/kanan.
//! Semua kandidat difilter berdasarkan rasio sel nyata agar tidak ada foto yang kekecilan/gepeng.
use serde::Serialize;
use std::collections::hash_map::DefaultHasher;
use std::collections::{HashMap, HashSet};
use std::hash::{Hash, Hasher};
use std::rc::Rc;
use std::sync::{Mutex, OnceLock};


#[derive(Clone, Copy, Serialize, Debug)]
pub struct R {
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
}

#[derive(Clone, Serialize)]
pub struct Layout {
    pub id: String,
    pub kind: &'static str,
    pub cells: Vec<R>,
    pub blanks: Vec<R>,
}

pub const MAX_PHOTOS: usize = 12;
const MAX_LEAVES: usize = MAX_PHOTOS + 1;
const SUB_TREE_CAP: usize = 48;
const FINAL_CAP: usize = 900;
const PAIR_CAP: usize = 14;
const MAG_CAP: usize = 420;

fn xorshift(s: &mut u64) -> u64 {
    *s ^= *s << 13;
    *s ^= *s >> 7;
    *s ^= *s << 17;
    *s
}

fn grid(rows: usize, cols: usize) -> Vec<R> {
    let mut v = Vec::new();
    for r in 0..rows {
        for c in 0..cols {
            v.push(R {
                x: c as f64 / cols as f64,
                y: r as f64 / rows as f64,
                w: 1.0 / cols as f64,
                h: 1.0 / rows as f64,
            });
        }
    }
    v
}

fn compose(a: &[R], b: &[R], r: f64, vertical: bool) -> Vec<R> {
    let mut v = Vec::with_capacity(a.len() + b.len());
    if vertical {
        v.extend(a.iter().map(|c| R { x: c.x * r, w: c.w * r, ..*c }));
        v.extend(b.iter().map(|c| R { x: r + c.x * (1.0 - r), w: c.w * (1.0 - r), ..*c }));
    } else {
        v.extend(a.iter().map(|c| R { y: c.y * r, h: c.h * r, ..*c }));
        v.extend(b.iter().map(|c| R { y: r + c.y * (1.0 - r), h: c.h * (1.0 - r), ..*c }));
    }
    v
}

fn sig(cells: &[R], blanks: &[R]) -> u64 {
    let q = |v: &[R]| {
        let mut k: Vec<[i32; 4]> = v
            .iter()
            .map(|c| [(c.x * 1000.0).round() as i32, (c.y * 1000.0).round() as i32, (c.w * 1000.0).round() as i32, (c.h * 1000.0).round() as i32])
            .collect();
        k.sort_unstable();
        k
    };
    let mut h = DefaultHasher::new();
    q(cells).hash(&mut h);
    0xB1A2u16.hash(&mut h);
    q(blanks).hash(&mut h);
    h.finish()
}

fn hash_id(s: u64) -> String {
    format!("{:012x}", s & 0xffff_ffff_ffff)
}

/// Generator pohon potongan yang sadar rasio: tiap sub-area tahu rasio nyatanya,
/// jadi daun yang terlalu gepeng/tinggi langsung dipangkas saat rekursi.
struct Gen {
    memo: HashMap<(usize, i32), Rc<Vec<Vec<R>>>>,
    seed: u64,
}

const LEAF_MIN: f64 = 0.38;
const LEAF_MAX: f64 = 2.7;

impl Gen {
    fn new() -> Self {
        Gen { memo: HashMap::new(), seed: 0x9E37_79B9_7F4A_7C15 }
    }

    fn ratios(k: usize, n: usize) -> Vec<f64> {
        let mut uniq: Vec<f64> = Vec::new();
        for r in [k as f64 / n as f64, 0.5, 1.0 / 3.0, 2.0 / 3.0, 0.382, 0.618, 0.25, 0.75, 0.4, 0.6] {
            if (0.2..=0.8).contains(&r) && !uniq.iter().any(|u| (u - r).abs() < 0.03) {
                uniq.push(r);
            }
        }
        uniq
    }

    /// Semua susunan n daun untuk area beraspek `a`, maksimal `cap` (sub-pohon di-memo).
    fn tree(&mut self, n: usize, a: f64, cap: usize, memo: bool) -> Rc<Vec<Vec<R>>> {
        if n == 1 {
            return Rc::new(if (LEAF_MIN..=LEAF_MAX).contains(&a) { vec![vec![R { x: 0.0, y: 0.0, w: 1.0, h: 1.0 }]] } else { vec![] });
        }
        let key = (n, (a.ln() * 40.0).round() as i32);
        if memo {
            if let Some(v) = self.memo.get(&key) {
                return Rc::clone(v);
            }
        }
        let mut out: Vec<Vec<R>> = Vec::new();
        for rows in 1..=n {
            if n % rows == 0 {
                let ca = a * rows as f64 / (n / rows) as f64;
                if (LEAF_MIN..=LEAF_MAX).contains(&ca) {
                    out.push(grid(rows, n / rows));
                }
            }
        }
        let head = out.len();
        let pair_cap = if memo { 6 } else { PAIR_CAP };
        for k in 1..n {
            for vertical in [true, false] {
                for r in Self::ratios(k, n) {
                    let (aa, ab) = if vertical { (a * r, a * (1.0 - r)) } else { (a / r, a / (1.0 - r)) };
                    let sa = self.tree(k, aa, SUB_TREE_CAP, true);
                    if sa.is_empty() {
                        continue;
                    }
                    let sb = self.tree(n - k, ab, SUB_TREE_CAP, true);
                    if sb.is_empty() {
                        continue;
                    }
                    let total = sa.len() * sb.len();
                    for t in 0..pair_cap.min(total) {
                        let idx = if total <= pair_cap || t == 0 { t } else { (xorshift(&mut self.seed) as usize) % total };
                        out.push(compose(&sa[idx / sb.len()], &sb[idx % sb.len()], r, vertical));
                    }
                }
            }
        }
        let mut seen = HashSet::new();
        out.retain(|l| seen.insert(sig(l, &[])));
        if out.len() > cap {
            // grid seragam tetap di depan, sisanya sampel acak deterministik
            let mut rest = out.split_off(head.min(out.len()));
            for i in (1..rest.len()).rev() {
                let j = (xorshift(&mut self.seed) as usize) % (i + 1);
                rest.swap(i, j);
            }
            rest.truncate(cap.saturating_sub(head));
            out.extend(rest);
        }
        let out = Rc::new(out);
        if memo {
            self.memo.insert(key, Rc::clone(&out));
        }
        out
    }
}

/// Sel layak: rasio sel nyata tidak ekstrem & ukurannya tidak terlalu timpang.
fn cells_ok(cells: &[R], aspect: f64, leaves: usize) -> bool {
    if cells.len() <= 1 {
        return true;
    }
    let mut amin = f64::MAX;
    let mut amax: f64 = 0.0;
    for c in cells {
        let ra = c.w * aspect / c.h;
        if !(0.38..=2.7).contains(&ra) {
            return false;
        }
        let area = c.w * c.h;
        if area < 0.22 / leaves as f64 {
            return false;
        }
        amin = amin.min(area);
        amax = amax.max(area);
    }
    amax / amin <= 7.0
}

fn single(n: usize, aspect: f64) -> Vec<Layout> {
    let mut g = Gen::new();
    let mut v = Vec::new();
    let mut seen = HashSet::new();
    let mut push = |cells: Vec<R>, blanks: Vec<R>, kind: &'static str, v: &mut Vec<Layout>| {
        let s = sig(&cells, &blanks);
        if seen.insert(s) {
            v.push(Layout { id: hash_id(s), kind, cells, blanks });
        }
    };
    for l in g.tree(n, aspect, FINAL_CAP, false).iter() {
        if cells_ok(l, aspect, n) {
            push(l.clone(), vec![], "grid", &mut v);
        }
    }
    // magazine: n foto + 1 ruang kosong untuk teks
    if n < MAX_LEAVES {
        let mut mag = 0;
        for l in g.tree(n + 1, aspect, FINAL_CAP / 2, false).iter() {
            let mut per = 0;
            for i in 0..l.len() {
                let bl = l[i];
                if bl.w * bl.h < 0.12 {
                    continue;
                }
                let cells: Vec<R> = l.iter().enumerate().filter(|(j, _)| *j != i).map(|(_, c)| *c).collect();
                if cells_ok(&cells, aspect, n + 1) {
                    push(cells, vec![bl], "magazine", &mut v);
                    per += 1;
                    mag += 1;
                    if per == 2 {
                        break;
                    }
                }
            }
            if mag >= MAG_CAP {
                break;
            }
        }
    }
    v
}

fn fold_ok(cells: &[R]) -> bool {
    cells.iter().all(|c| {
        let l = 0.5 - c.x;
        let r = c.x + c.w - 0.5;
        !(l > 0.01 && r > 0.01) || l.min(r) >= 0.35 * c.w
    })
}

fn pick_spread(v: Vec<Layout>, k: usize) -> Vec<Layout> {
    if v.len() <= k {
        return v;
    }
    let step = v.len() as f64 / k as f64;
    (0..k).map(|i| v[(i as f64 * step) as usize].clone()).collect()
}

fn spread(n: usize, page_aspect: f64) -> Vec<Layout> {
    let mut out = Vec::new();
    let mut seen = HashSet::new();
    for l in single(n, page_aspect * 2.0) {
        if fold_ok(&l.cells) && fold_ok(&l.blanks) && seen.insert(sig(&l.cells, &l.blanks)) {
            out.push(Layout { kind: if l.kind == "grid" { "spread" } else { "spread-mag" }, ..l });
        }
    }
    let full = R { x: 0.0, y: 0.0, w: 1.0, h: 1.0 };
    let side = |k: usize| -> Vec<Layout> {
        if k == 0 {
            vec![Layout { id: String::new(), kind: "blank", cells: vec![], blanks: vec![full] }]
        } else {
            pick_spread(get(k, page_aspect, false), 14)
        }
    };
    let mut seed = 0xA5A5_1234_9876_0001u64 ^ n as u64;
    for nl in 0..=n {
        let (left, right) = (side(nl), side(n - nl));
        let total = left.len() * right.len();
        let take = 26.min(total);
        for t in 0..take {
            let idx = if total <= 26 { t } else { (xorshift(&mut seed) as usize) % total };
            let (a, b) = (&left[idx / right.len()], &right[idx % right.len()]);
            let m = |c: &R, off: f64| R { x: off + c.x * 0.5, w: c.w * 0.5, ..*c };
            let cells: Vec<R> = a.cells.iter().map(|c| m(c, 0.0)).chain(b.cells.iter().map(|c| m(c, 0.5))).collect();
            let blanks: Vec<R> = a.blanks.iter().map(|c| m(c, 0.0)).chain(b.blanks.iter().map(|c| m(c, 0.5))).collect();
            let s = sig(&cells, &blanks);
            if seen.insert(s) {
                out.push(Layout { id: hash_id(s), kind: "split", cells, blanks });
            }
        }
    }
    out
}

fn cache() -> &'static Mutex<HashMap<String, Vec<Layout>>> {
    static C: OnceLock<Mutex<HashMap<String, Vec<Layout>>>> = OnceLock::new();
    C.get_or_init(|| Mutex::new(HashMap::new()))
}

fn get(n: usize, aspect: f64, is_spread: bool) -> Vec<Layout> {
    let n = n.clamp(1, MAX_PHOTOS);
    let key = format!("{n}|{aspect:.3}|{is_spread}");
    if let Some(v) = cache().lock().unwrap().get(&key) {
        return v.clone();
    }
    let v = if is_spread { spread(n, aspect) } else { single(n, aspect) };
    cache().lock().unwrap().insert(key, v.clone());
    v
}

/// aspect = lebar/tinggi area isi SATU halaman; is_spread = album 2 halaman.
#[tauri::command]
pub async fn gen_layouts(n: usize, aspect: f64, spread: bool) -> Vec<Layout> {
    tauri::async_runtime::spawn_blocking(move || get(n, aspect, spread))
        .await
        .unwrap_or_default()
}

#[tauri::command]
pub async fn layout_count(aspect: f64, spread: bool) -> usize {
    tauri::async_runtime::spawn_blocking(move || (1..=MAX_PHOTOS).map(|n| get(n, aspect, spread).len()).sum())
        .await
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn counts() {
        for (a, s) in [(1.0, true), (20.0 / 30.0, true), (40.0 / 30.0, true), (9.0 / 16.0, false), (0.8, false)] {
            let total: usize = (1..=MAX_PHOTOS).map(|n| get(n, a, s).len()).sum();
            let per: Vec<usize> = (1..=MAX_PHOTOS).map(|n| get(n, a, s).len()).collect();
            println!("aspect {a:.2} spread {s}: {total} template {per:?}");
            assert!(total > 1000);
            for n in 1..=MAX_PHOTOS {
                for l in get(n, a, s) {
                    assert_eq!(l.cells.len(), n);
                }
            }
        }
    }
}
