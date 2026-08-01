#!/usr/bin/env tsx
// scripts/check-accentcopy.ts — 사용자 문구가 **강조색을 이름으로 지칭하지 않는지**. daniel 2026-08-01.
// ─────────────────────────────────────────────────────────────────────────
// 왜: daniel 신고 "금색점 이라는데 금색점이 안 보여".
//   앱 강조색(colors.ju)은 **일간 오행별로 사람마다 다르다**(07-15 Apple 리디자인).
//   그런데 문구엔 "금색 점"이 박혀 있었다 — 파란 강조색 사용자에겐 **거짓말**이 된다.
//   실제로 4곳(신년·타임라인×2·인생그래프)이 전부 틀려 있었다.
//
// ▶ 불변식: 사용자에게 보이는 문구는 강조색을 **색 이름으로 부르지 않는다.**
//   대신 형태로 지칭한다 — "진하게 찬 점" · "테두리만 있는 점" 처럼.
//   (설정의 색상 선택 라벨은 예외 — 거긴 색 자체가 선택지다.)
// ─────────────────────────────────────────────────────────────────────────
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// ★오탐을 좁힌다(첫 판은 5건 전부 오탐이었다):
//   개운법의 '흰색·금색'(오행 金 의 행운색 추천)은 **정당한 콘텐츠**다 — 그건 UI 색이 아니라 내용이다.
//   진짜 문제는 **UI 요소를 색 이름으로 가리킬 때**뿐이다("금색 점", "점 = 금색").
//   그래서 색 이름 단독이 아니라 **색 + UI 요소** 조합만 잡는다.
const UI_EL = '점|칸|셀|바|막대|표시|테두리|동그라미';
const BANNED: RegExp[] = [
  new RegExp(`(금|골드|노란|파란|푸른|빨간|붉은)색?\\s*(${UI_EL})`),   // "금색 점"
  new RegExp(`(${UI_EL})\\s*=\\s*(금|골드|노란|파란|푸른)색?`),      // "점 = 금색"
];
const EXEMPT_FILE = new Set(['settings.tsx']);   // 강조색 **선택** 화면 — 색 이름이 곧 선택지다

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (e.endsWith('.tsx') || e.endsWith('.ts')) out.push(p);
  }
  return out;
}

const problems: string[] = [];
let scanned = 0;
for (const f of walk('app/src')) {
  if (EXEMPT_FILE.has(f.split('/').pop()!)) continue;
  scanned++;
  readFileSync(f, 'utf8').split('\n').forEach((ln, i) => {
    const t = ln.trim();
    // 주석은 대상 아님(설계 설명에 색을 쓰는 건 괜찮다) — 사용자에게 나가는 문자열만 본다
    if (t.startsWith('//') || t.startsWith('*') || t.startsWith('{/*')) return;
    if (!/['"`]/.test(ln)) return;                 // 문자열 리터럴이 있는 줄만
    if (/\/\//.test(ln) && ln.indexOf('//') < ln.search(/['"`]/)) return; // 줄 전체가 주석
    for (const re of BANNED) {
      const m = ln.match(re);
      if (!m) continue;
      problems.push(`${f}:${i + 1}  "${m[0]}" — ${t.slice(0, 90)}`);
    }
  });
}

console.log(`\n🎨 사용자 문구가 강조색을 이름으로 부르지 않는가 (${scanned}파일)`);
if (problems.length) {
  console.error(`\n❌ 위반 ${problems.length}건\n`);
  problems.forEach((p) => console.error('   ' + p));
  console.error('\n   ※ 강조색은 **일간 오행별로 사람마다 다르다**. 색 이름을 쓰면 다른 색 사용자에겐 거짓말이 된다.');
  console.error('     형태로 지칭할 것 — "진하게 찬 점" · "테두리만 있는 점".\n');
  process.exit(1);
}
console.log('   ✅ 색 이름으로 지칭하는 문구 없음.\n');
