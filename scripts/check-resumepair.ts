// scripts/check-resumepair.ts — **배너가 남으면 그 화면도 복원돼야 한다**(수명 불일치 금지)
// ═══════════════════════════════════════════════════════════════════════════
// daniel 2026-08-13: *"홈에는 궁합은 완성됐다고 뜨는데 탭해서 들어가면 상대명식부터 다시 지정해야해"*
//
// ■ 원인(실측)
//   홈 배너(`genProgress`)는 **SecureStore 에 저장**돼 앱을 껐다 켜도 남는다.
//   그런데 궁합 화면이 "어느 쌍이었는지"를 기억하던 `_lastCompat` 은 **모듈 전역 변수**라 함께 죽었다.
//   ⇒ "완성됐다"는 배너만 남고, 눌러 들어가면 **앱이 그 쌍을 잊은 상태**가 된다.
//   두 값의 **수명이 달라서** 생긴 어긋남이지, 어느 쪽도 그 자체로는 버그가 아니었다.
//
// ■ 이 하네스가 지키는 것
//   이 종류는 **증상이 조용하다** — 크래시도 없고 로그도 안 남는다. 사용자는 그냥 "또 골라야 하네"
//   하고 넘어간다. 그래서 기계가 본다.
//   판정: **영구 저장되는 진행도(genProgress)를 쓰는 화면**이 재진입에 필요한 선택값을
//   모듈 변수(let)에만 두고 있지 않은가.
//
// ⚠️판정은 이름이 아니라 **저장소로** 한다([[harness-judge-expression-not-name]]) —
//   변수명이 `_last*` 라서가 아니라, **SecureStore 에 쓰는지**로 본다.
//
// 실행: npm run check:resumepair
// ═══════════════════════════════════════════════════════════════════════════
import fs from 'fs';
import path from 'path';

const ROOTS = ['app/src/screens', 'app/src/app/(app)'];

/**
 * 검사 대상 = **영구 저장되는 진행도를 쓰는 화면**.
 * `setGenProgress` 를 부르면 그 화면의 배너는 앱 재실행 후에도 뜬다 ⇒ 화면도 그때를 복원해야 한다.
 */
const PROGRESS = 'setGenProgress';

/** 재진입 복원을 **명식 id 로** 하는 화면은 면제 — route 파라미터(chartId)로 이미 복원된다. */
const ALLOW: { file: string; why: string }[] = [
  { file: 'ReadingScreen.tsx', why: '명식 1개로 복원(route chartId) — 쌍이 아니다' },
  { file: 'TimelineScreen.tsx', why: '명식 1개로 복원(route chartId)' },
  { file: 'SpecialContentScreen.tsx', why: '명식 1개로 복원(route chartId)' },
  { file: 'love.tsx', why: '명식 1개로 복원' },
  { file: 'gaeun.tsx', why: '명식 1개로 복원' },
  { file: 'newyear.tsx', why: '명식 1개로 복원' },
  { file: 'lifegraph.tsx', why: '명식 1개로 복원' },
  { file: 'career.tsx', why: '명식 1개로 복원' },
  { file: 'dream.tsx', why: '명식 무관(chartless) — 복원할 선택값 없음' },
  { file: 'taemong.tsx', why: '명식 무관(chartless)' },
];

const files: string[] = [];
for (const root of ROOTS) {
  if (!fs.existsSync(root)) continue;
  (function walk(d: string) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.tsx')) files.push(p);
    }
  })(root);
}

let bad = 0, ok = 0, skipped = 0;
console.log('\n🔗 배너가 남는 화면은 그 선택도 복원되는가\n');

for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  if (!src.includes(PROGRESS)) continue;                    // 영구 배너를 안 쓰면 대상 아님
  const base = path.basename(f);
  const wl = ALLOW.find((a) => a.file === base);
  if (wl) { skipped++; continue; }

  // 이 화면이 모듈 전역(let)에 선택 상태를 두는가 — 그렇다면 앱 재실행에 사라진다
  const modLet = /^let\s+_\w+[^=]*=\s*\{/m.test(src);
  // 그리고 그 값을 영구 저장하는가
  const persists = /SecureStore\.setItemAsync/.test(src);

  if (!modLet) { ok++; console.log(`   ✅ ${base} — 모듈 전역 상태 없음`); continue; }
  if (persists) { ok++; console.log(`   ✅ ${base} — 모듈 전역이 있으나 SecureStore 로 영구 저장`); continue; }

  bad++;
  console.log(`   ❌ ${base} — 재진입에 필요한 값이 **모듈 전역 변수에만** 있습니다.`);
  console.log(`      이 화면은 setGenProgress 로 **영구 저장되는 배너**를 띄웁니다.`);
  console.log(`      앱을 껐다 켜면 배너는 남는데 화면은 그 선택을 잊습니다 — 사용자는 처음부터 다시 고릅니다.`);
  console.log(`      SecureStore 로 저장하거나, 복원이 필요 없다면 ALLOW 에 **사유와 함께** 등록하세요.`);
}

console.log(`\n   진행도 사용 화면 ${ok + bad + skipped}곳 · 정상 ${ok} · 면제 ${skipped} · 위반 ${bad}`);
console.log(bad ? '\n❌ check:resumepair 실패\n' : '\n✅ check:resumepair 통과 — 배너와 화면 상태의 수명이 일치\n');
if (bad) process.exitCode = 1;
