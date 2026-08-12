// scripts/check-todaydefault.ts — **만세력 시간층은 열 때 '오늘'이어야 한다**
// ═══════════════════════════════════════════════════════════════════════════
// daniel 2026-08-12: *"만세력 대운세운월운일운이 오늘기준으로 안나와 처음에 킬때"*
//
// ■ 원인(실측)
//   엔진은 정상이었다 — `isCurrent=true` 인덱스 3 · 올해 세운 인덱스 2 · currentLuck/annual 모두 정상.
//   문제는 화면이다. 선택값 넷(selLuck·selSeun·selMonth·selDay)이 `useState(...)` 라
//   **첫 렌더의 값으로 굳는데**, 이 화면은 명식(input)이 나중에 채워지거나 바뀌어도 **언마운트되지 않는다.**
//   ⇒ luckCycles 가 아직 비었을 때 계산된 `Math.max(0, findIndex(...))` = **0(첫 대운 = 어린 시절)** 이 남는다.
//   ★"⊙ 오늘 기준 현재운세 보기" 버튼이 **처음부터 있었다** — 어긋나는 경우를 알고도 수동으로 둔 것이다.
//     그 버튼이 하던 리셋을 명식이 바뀔 때 **자동으로** 하게 고쳤다.
//
// ■ 이 하네스가 지키는 것
//   자동 리셋은 **조용히 사라지기 쉽다**(리팩터링 중 useEffect 하나 지우면 끝). 그러면 증상은
//   "가끔 옛날 대운이 뜬다"라서 아무도 버그로 신고하지 않는다 — 기계가 본다.
//   판정은 이름이 아니라 **구성요소**로: 넷을 모두 되잡는가([[harness-judge-expression-not-name]]).
//
// 실행: npm run check:todaydefault
// ═══════════════════════════════════════════════════════════════════════════
import fs from 'fs';

const F = 'app/src/screens/MyeongsikScreen.tsx';
const src = fs.existsSync(F) ? fs.readFileSync(F, 'utf8') : null;
if (!src) { console.log(`\n❌ ${F} 이 없습니다\n`); process.exit(1); }

// 주석을 걷어낸 코드만 본다 — 주석에 setter 이름만 적혀 있어도 통과되면 안 된다
const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

let bad = 0;
console.log('\n📅 만세력 시간층이 열 때 오늘 기준인가\n');

// ① 자동 리셋 useEffect 가 있는가 — 네 setter 를 **한 블록 안에서** 부르는가
const SETTERS = ['setSelLuck', 'setSelSeun', 'setSelMonth', 'setSelDay'];
let found = false;
for (const m of code.matchAll(/useEffect\(\(\)\s*=>\s*\{/g)) {
  // 블록을 중괄호 균형으로 잘라낸다(콜백 안에 또 중괄호가 있다)
  let depth = 0, i = m.index! + m[0].length - 1;
  for (; i < code.length; i++) {
    if (code[i] === '{') depth++;
    else if (code[i] === '}') { depth--; if (depth === 0) break; }
  }
  const block = code.slice(m.index!, i + 1);
  if (SETTERS.every((s) => block.includes(s))) { found = true; break; }
}
if (found) console.log('   ✅ 명식이 바뀌면 네 층(대운·세운·월운·일운)을 모두 오늘로 되잡는다');
else {
  bad++;
  console.log('   ❌ 네 층을 함께 되잡는 useEffect 가 없습니다.');
  console.log('      selLuck·selSeun·selMonth·selDay 는 useState 라 **첫 렌더 값으로 굳습니다.**');
  console.log('      명식이 나중에 채워지면 옛 값(0=첫 대운=어린 시절)이 그대로 남습니다.');
}

// ② 월·일은 렌더 시점 변수(now)가 아니라 **호출 시점**을 읽어야 한다
//    앱을 켜 둔 채 자정을 넘기면 렌더 때 만든 now 는 어제다.
if (found) {
  const eff = code.slice(code.indexOf('setSelLuck('), code.indexOf('setSelDay(') + 40);
  if (/setSelMonth\(\s*new Date\(\)\.getMonth\(\)/.test(eff) && /setSelDay\(\s*new Date\(\)\.getDate\(\)/.test(eff)) {
    console.log('   ✅ 월·일을 호출 시점에 다시 읽는다(자정 넘김 대응)');
  } else {
    bad++;
    console.log('   ❌ 월·일이 렌더 시점 변수(now)를 씁니다 — 앱을 켜 둔 채 자정을 넘기면 어제가 됩니다.');
    console.log('      `new Date().getMonth()` / `new Date().getDate()` 로 그 자리에서 읽으세요.');
  }
}

// ③ 수동 버튼(오늘 기준 보기)은 남아 있어야 한다 — 사용자가 둘러본 뒤 돌아올 길
if (/setSelLuck\(curLuckIdx\)/.test(code)) console.log('   ✅ 수동 "오늘 기준" 버튼 유지(둘러본 뒤 돌아올 길)');
else { bad++; console.log('   ❌ 수동 "오늘 기준 현재운세 보기" 버튼이 사라졌습니다.'); }

console.log(bad ? '\n❌ check:todaydefault 실패\n' : '\n✅ check:todaydefault 통과 — 열면 오늘 기준\n');
if (bad) process.exitCode = 1;
