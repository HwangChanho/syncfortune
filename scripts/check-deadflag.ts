// scripts/check-deadflag.ts — **폐지된 플래그가 UI 를 가르는 곳**을 막는다
// ═══════════════════════════════════════════════════════════════════════════
// daniel 2026-08-11: *"운으로 더 물어보기는 동작 안하고있어"*
//
// 원인(실측): 프리미엄은 07-28 에 폐지됐고 `useSubscription()` 이 `PREMIUM_ENABLED && …` 를 돌려주므로
//   **`isPremium` 은 항상 false** 다. 그런데 `ReadingScreen`·`CompatScreen` 의 추가질문 영역이
//   `isPremium ? <입력창> : <🔒 버튼>` 이라 **입력창이 영영 안 떴다.** 버튼 문구는 "**운으로** 더
//   물어보기"(코인)인데 게이트는 프리미엄이었다 — 이름과 게이트가 갈려 있었다.
//
// ★같은 사고가 **세 번째**다:
//   ①08-02 광고제거 구매자가 계속 광고를 봤다(`!isPremium` 이 늘 참) → `adFree` 로 교체
//   ②07-30 `purchasePremium` 이 등록도 안 된 상품을 사려 해 항상 실패 → 제거
//   ③08-11 추가질문 입력창이 아무에게도 안 보였다
//   ⇒ [[alert-double-fire-crash]] 교훈 — **기능을 폐지하면 그 플래그를 보던 분기를 전수조사**해야 한다.
//     기억으로는 세 번 다 놓쳤으니 기계가 본다.
//
// ■ 무엇을 잡는가 — **UI 를 가르는 것만**
//   · `isPremium ? …` / `{isPremium && …}` = **화면이 갈린다** → 잡는다
//   · `if (isPremium) { … }` 같은 로직 분기는 제외 — false 면 그냥 건너뛰어 대개 무해하고,
//     전부 잡으면 노이즈에 묻혀 진짜를 못 본다([[error-harness-prebuild-check]] 오탐을 좁혀라).
// 실행: npm run check:deadflag
// ═══════════════════════════════════════════════════════════════════════════
import fs from 'fs';
import path from 'path';

const ROOT = 'app/src';
/** 폐지돼서 **항상 false** 인 플래그들. 새로 폐지하면 여기 추가한다. */
const DEAD = [{ name: 'isPremium', why: '프리미엄 폐지(2026-07-28) — useSubscription 이 PREMIUM_ENABLED=false 로 항상 false' }];

/**
 * UI 가 갈려도 무해한 곳 — **이유 필수**. 이유 없이 추가 금지.
 * ★키를 **줄 번호가 아니라 내용 조각**으로 둔다 — 위아래에 한 줄만 끼어도 줄 번호는 어긋난다.
 */
const ALLOW: { file: string; snippet: string; why: string }[] = [
  { file: 'screens/CompatScreen.tsx', snippet: 'relPriceTag', why: '가격표 — false 면 "N 운" 이 보인다(정상)' },
  { file: 'screens/CompatScreen.tsx', snippet: 'relHint', why: '안내 문구 — false 쪽이 지금 맞는 문구다' },
  { file: 'screens/CompatScreen.tsx', snippet: 'relOwnedTag', why: '가격표 — 위와 동일' },
  { file: 'screens/ReadingScreen.tsx', snippet: 'const banner', why: '배너 문구 — false 면 개별결제 안내(정상)' },
  { file: 'app/(app)/month.tsx', snippet: '보상형 광고 1회로 AI 정밀 풀이', why: '`!isPremium` — 항상 참이라 광고 경로가 늘 열린다(의도)' },
];

const files: string[] = [];
(function walk(dir: string) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.tsx$/.test(e.name)) files.push(p);   // UI 만 본다
  }
})(ROOT);

let bad = 0, allowed = 0, scanned = 0;
console.log('\n🪦 폐지된 플래그가 UI 를 가르는가\n');

for (const f of files) {
  const rel = f.replace(`${ROOT}/`, '');
  const lines = fs.readFileSync(f, 'utf8').split('\n');
  // ★창을 다음 줄까지 넓히면 **같은 삼항이 두 줄에서** 잡힌다(첫 판에서 4건 오탐).
  //   직전 줄에서 이미 잡았으면 같은 표현식으로 보고 건너뛴다([[error-harness-prebuild-check]] 오탐을 좁혀라).
  let lastHit = -2;
  lines.forEach((line, i) => {
    if (/^\s*(\/\/|\*|\{\/\*)/.test(line)) return;              // 주석 줄
    for (const d of DEAD) {
      // UI 분기만 — 삼항(`flag ?`) 또는 조건부 렌더(`{flag &&`). 부정형(`!flag`)도 같은 자리다.
      // ★삼항이 **줄바꿈**돼 있으면 한 줄만 봐서는 못 잡는다(첫 판이 `ReadingScreen:641` 을 놓쳤다).
      //   → 다음 줄까지 창으로 본다.
      const win = `${line} ${lines[i + 1] ?? ''}`;
      const ternary = new RegExp(`!?${d.name}\\s*\\?`).test(win);
      const andRender = new RegExp(`\\{\\s*!?${d.name}\\s*&&`).test(win);
      if (!ternary && !andRender) return;
      if (i === lastHit + 1) return;      // 같은 삼항의 둘째 줄 — 중복 계상 방지
      lastHit = i;
      scanned++;
      // 화이트리스트 조각은 **더 넓게**(±2줄) 찾는다 — 근거가 되는 문구가 검출 줄 바로 옆이 아닐 수 있다
      //   (`month.tsx` 는 판정 줄 아래 **주석**이 근거였다). 화이트리스트는 사람이 고른 것이라 넓혀도 안전하다.
      const around = lines.slice(Math.max(0, i - 2), i + 3).join(' ');
      const wl = ALLOW.find((a) => a.file === rel && around.includes(a.snippet));
      if (wl) { allowed++; console.log(`   ⏭  ${rel}:${i + 1} — ${wl.why}`); return; }
      bad++;
      console.log(`   ❌ ${rel}:${i + 1} — \`${d.name}\` 로 화면이 갈립니다.`);
      console.log(`      ${d.why}`);
      console.log(`      ⇒ **false 쪽만 보입니다.** 반대쪽 UI 는 아무에게도 안 뜹니다.`);
      console.log(`      살아 있는 개념(adFree · 코인 소유 · unlocked)으로 바꾸거나,`);
      console.log(`      무해하다면 scripts/check-deadflag.ts 의 ALLOW 에 **이유와 함께** 추가하세요.`);
    }
  });
}

console.log(`\n   UI 분기 ${scanned}건 · 허용 ${allowed}건 · 미검토 ${bad}건`);
console.log(bad ? '\n❌ check:deadflag 실패\n' : '\n✅ check:deadflag 통과 — 폐지된 플래그가 기능을 숨기는 곳 없음\n');
if (bad) process.exitCode = 1;
