// scripts/dump-ko.ts — 남은 한국어를 **자리까지** 찍는다 (`npm run dump:ko [파일조각]`)
// ═══════════════════════════════════════════════════════════════════════════
// `check:langpicker` 는 **수**만 말한다. 고치려면 «어디의 무슨 글자» 인지가 필요하다.
// ★같은 식(`scripts/lib/ko-scan.ts`)을 쓴다 — 그래서 여기 나온 줄을 다 없애면 수가 정확히 준다.
//
//   npm run dump:ko                 → 파일별 개수(많은 순)
//   npm run dump:ko Myeongsik       → 그 파일의 자리 전부(줄 번호 + 글자)
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, readdirSync } from 'node:fs';
import { scanFile } from './lib/ko-scan.ts';

const ROOT = new URL('..', import.meta.url).pathname;
const read = (p: string) => { try { return readFileSync(`${ROOT}${p}`, 'utf8'); } catch { return ''; } };

function screens(dir = 'app/src'): string[] {
  const out: string[] = [];
  const rec = (d: string) => {
    let ents; try { ents = readdirSync(`${ROOT}${d}`, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      const p = `${d}/${e.name}`;
      if (e.isDirectory()) rec(p); else if (e.name.endsWith('.tsx')) out.push(p);
    }
  };
  rec(dir); return out;
}

const needle = process.argv[2] ?? '';
const files = screens().filter((p) => !needle || p.includes(needle));

if (!needle) {
  const rows = files
    .map((p) => ({ p, n: scanFile(read(p)).length }))
    .filter((r) => r.n > 0)
    .sort((a, b) => b.n - a.n);
  const total = rows.reduce((a, r) => a + r.n, 0);
  for (const r of rows) console.log(`${String(r.n).padStart(4)}  ${r.p.replace('app/src/', '')}`);
  console.log(`\n합계 ${total}곳 · 파일 ${rows.length}개`);
} else {
  for (const p of files) {
    const spots = scanFile(read(p));
    if (!spots.length) continue;
    console.log(`\n── ${p} (${spots.length}곳) ──`);
    for (const s of spots) console.log(`${String(s.line).padStart(5)}  ${s.kind}  ${s.text}`);
  }
}
