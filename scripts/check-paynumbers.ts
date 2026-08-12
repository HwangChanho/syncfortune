// scripts/check-paynumbers.ts — **유료 안내에는 숫자가 있어야 한다**
// ═══════════════════════════════════════════════════════════════════════════
// daniel 2026-08-12: *"다른 유료 콘텐츠도 사용후 남은운이 얼마가 되는지 나와야해
//                      없을경우 충전창으로 이동시켜야하고"*
//
// ■ 실측된 원인
//   결제 게이트(`ensureCoinsFor`)는 **이미** 셋을 다 하고 있었다 —
//     ①`{cost} 운을 사용해…  보유 {have} 운 → 사용 후 {after} 운`
//     ②부족하면 '운 충전하기' → 충전 화면   ③조회 실패를 '부족'과 구분(재결제 유도 방지)
//   문제는 **그 앞에 숫자가 하나도 없는 알림을 하나 더 띄우던 화면들**이었다:
//     "운이 필요해요. 지금 운으로 열거나, 마켓에서 충전할 수 있어요."  ← 가격도·잔액도·남는 운도 없음
//   사용자는 **얼마인지 모르는 채 '운 사용'을 눌러야** 비로소 숫자를 봤다.
//   `SpecialContentScreen` 은 **유료 18종**을 담당하므로 이 한 곳이 대량으로 증상을 만들었다.
//   (다른 하나는 `timeResolve`.)
//
// ■ 규칙
//   유료 결제를 **유도하는** 알림이라면, 같은 알림 안에 **금액/잔액 숫자**가 있어야 한다.
//   숫자를 못 보여줄 상황이면 알림을 띄우지 말고 **게이트(ensureCoinsFor)를 바로 부른다** —
//   게이트가 숫자와 충전 이동을 모두 책임진다.
//
// ■ 판정 (이름이 아니라 **표현식**으로 — [[harness-judge-expression-not-name]])
//   `Alert.alert(...)` 인자 안에
//     · 결제를 유도하는 **버튼**이 있고(`coins.spend`·'운 사용'·'바로 구매'…)
//     · 그런데 **숫자 자리표시자/변수가 하나도 없으면**(`{{cost}}`·`${...}`·coinPriceOf 등)
//   실패로 본다. 부족 안내(needTitle)는 게이트가 숫자와 함께 띄우므로 대상이 아니다.
//
// 실행: npm run check:paynumbers
// ═══════════════════════════════════════════════════════════════════════════
import fs from 'fs';
import path from 'path';

const ROOT = 'app/src';

/** 결제를 유도하는 버튼 문구/키 — 이게 있으면 "돈 쓰라는 알림"이다. */
const PAY_BTN = /coins\.spend|special\.buyNow|'운 사용'|"운 사용"|'바로 구매'|"바로 구매"/;
/** 숫자를 보여 주는 흔적 — i18n 자리표시자·템플릿 변수·가격 조회 */
const HAS_NUM = /\{\{\s*(cost|have|after|need|price|balance)\s*\}\}|\$\{[^}]*\}|coinPriceOf|won\(|\bcost\b|\bbalance\b/;

/** 예외 — **이유 필수**. 이유 없이 추가 금지. */
const ALLOW: { file: string; snippet: string; why: string }[] = [
  { file: 'lib/billing/coinGate.ts', snippet: 'coins.spendMsg', why: '게이트 본체 — 여기가 바로 숫자를 보여 주는 주체다' },
];

const files: string[] = [];
(function walk(dir: string) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.tsx?$/.test(e.name)) files.push(p);
  }
})(ROOT);

let bad = 0, scanned = 0, allowed = 0;
console.log('\n💰 유료 결제 알림에 금액이 보이는가\n');

for (const f of files) {
  const code = fs.readFileSync(f, 'utf8');
  const rel = f.replace(`${ROOT}/`, '');
  // Alert.alert( … ) 를 괄호 균형으로 잘라낸다 — 정규식으로는 중첩 콜백을 못 자른다
  let i = 0;
  while ((i = code.indexOf('Alert.alert(', i)) >= 0) {
    let depth = 0, j = i + 'Alert.alert'.length;
    for (; j < code.length; j++) {
      if (code[j] === '(') depth++;
      else if (code[j] === ')') { depth--; if (depth === 0) { j++; break; } }
    }
    const block = code.slice(i, j);
    i = j;
    if (!PAY_BTN.test(block)) continue;            // 결제 유도 알림이 아니면 대상 아님
    scanned++;
    const wl = ALLOW.find((a) => a.file === rel && block.includes(a.snippet));
    if (wl) { allowed++; continue; }
    if (HAS_NUM.test(block)) continue;             // 숫자가 보인다 — 통과
    bad++;
    const line = code.slice(0, i - block.length).split('\n').length;
    console.log(`   ❌ ${rel}:${line} — 결제를 권하는데 **금액이 없습니다**.`);
    console.log(`      사용자는 얼마인지 모르는 채 눌러야 하고, 남는 운도 알 수 없습니다.`);
    console.log(`      ⇒ 이 알림을 없애고 \`ensureCoinsFor(...)\` 를 바로 부르세요 —`);
    console.log(`         게이트가 '보유 N 운 → 사용 후 M 운' 과 충전 화면 이동을 모두 합니다.`);
  }
}

console.log(`\n   결제 유도 알림 ${scanned}곳 · 허용 ${allowed} · 위반 ${bad}`);
console.log(bad ? '\n❌ check:paynumbers 실패\n' : '\n✅ check:paynumbers 통과 — 결제 유도에 금액이 함께 보임\n');
if (bad) process.exitCode = 1;
