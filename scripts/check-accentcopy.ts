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
// ★2026-08-18 오탐 수정 — 「지금 바로 볼 수 있는」이 걸렸다('지금'의 **금** + 공백 + '바'로).
//   두 가지를 고쳤다.
//     ① 앞에 한글이 붙어 있으면 색 이름이 아니다(지금·요금·현금·황금기…) → `(?<![가-힣])`
//     ② '금·골드'는 **'색'이 붙을 때만** 잡는다. 「금 점」이라고 쓰는 사람은 없고,
//        '금' 한 글자는 오행 金·요금·상금과 겹쳐 오탐만 낸다.
//        반대로 '노란·파란'은 그 자체가 색 형용사라 '색' 없이도 잡아야 한다("노란 점").
//   ⚠️여기서 배운 것: 색 이름 검사는 **글자 조각이 아니라 낱말**로 판정해야 한다([[harness-judge-expression-not-name]]).
const BANNED: RegExp[] = [
  new RegExp(`(?<![가-힣])(금|골드)색\\s*(${UI_EL})`),                    // "금색 점"
  new RegExp(`(?<![가-힣])(노란|파란|푸른|빨간|붉은)색?\\s*(${UI_EL})`),   // "노란 점" · "파란색 막대"
  new RegExp(`(${UI_EL})\\s*=\\s*(금|골드|노란|파란|푸른)색`),      // "점 = 금색"
];
const EXEMPT_FILE = new Set(['settings.tsx']);   // 강조색 **선택** 화면 — 색 이름이 곧 선택지다

// ── 자가 테스트(`--selftest`) ─────────────────────────────────────────────
//   ★규칙을 고칠 때마다 여기부터 돌린다. **음성**(잡으면 안 되는 것)이 핵심이다 —
//     08-18 에 실제로 「지금 바로」를 잡았고, 그건 규칙이 아니라 **글자 조각**을 본 탓이었다.
const SELFTEST: Array<[string, boolean]> = [
  // [문구, 잡혀야 하는가]
  ['금색 점이 오늘 자리예요', true],
  ['금색점', true],
  ['노란 점이 켜지면', true],
  ['파란색 막대가 길수록', true],
  ['점 = 금색', true],
  ['가입 없이 지금 바로 볼 수 있는 것들', false],   // ← 실제 오탐(지금+바로)
  ['요금 바로 확인', false],
  ['상금 표시가 뜹니다', false],
  ['황금기 막대', false],
  ['오행 금 기운이 강해요', false],                  // 오행 이름은 콘텐츠지 UI 색이 아니다
  ['흰색·금색 소품이 좋아요', false],                // 개운법 = 정당한 콘텐츠
];
if (process.argv.includes('--selftest')) {
  let bad = 0;
  for (const [text, want] of SELFTEST) {
    const got = BANNED.some((re) => re.test(text));
    if (got !== want) { bad++; console.error(`   ✗ "${text}" — 기대 ${want ? '적발' : '통과'} / 실제 ${got ? '적발' : '통과'}`); }
  }
  console.log(bad ? `\n❌ 자가 테스트 ${bad}건 실패\n` : `\n✅ 자가 테스트 ${SELFTEST.length}건 통과\n`);
  process.exit(bad ? 1 : 0);
}

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
