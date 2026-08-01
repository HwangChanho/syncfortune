#!/usr/bin/env tsx
// scripts/check-coinbalance.ts — 보유 '운' 표시가 **모든 화면에서 똑같이 갱신**되는지. daniel 2026-08-01.
// ─────────────────────────────────────────────────────────────────────────
// 왜: daniel 이 같은 날 두 번 신고했다.
//   ① "로그아웃할 때 개인정보 창에서 운이 바로 갱신이 안 돼서 이전 아이디 금액이 남아있어"
//   ② "운 충전했는데 이 화면만 안 바뀌었어"(마켓)
//   → "운 표시하는 모든 항목이 동일하게 갱신돼야 해"
//
// 근인: 잔액을 읽는 화면이 넷인데 **각자 다른 방식**이었다.
//   마켓 `useEffect(…, [])`(최초 1회) · 설정/배지 `useFocusEffect(…, [])`(세션 무시).
//   그래서 화면마다 다른 순간에 멈춘 값이 남았다.
//
// ▶ 불변식: **잔액을 화면에 그리는 곳은 공용 훅 `useCoinBalance(session)` 만 쓴다.**
//   (게이트 판정용 `coinBalanceOrNull()` 직접 호출은 허용 — 그건 표시가 아니라 분기다.)
// ─────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';

// 잔액을 **화면에 그리는** 파일들. 새 표시 화면이 생기면 여기 추가하고 훅을 쓰게 한다.
const DISPLAY = [
  'app/src/app/(app)/market.tsx',
  'app/src/app/(app)/settings.tsx',
  'app/src/components/CoinBadge.tsx',
];
// 충전 화면은 예외 — 충전 직후 즉시 반영이 필요해 직접 reload 한다(사유를 코드 주석에 남겨 둠).
const EXEMPT = new Map([['app/src/app/(app)/coins.tsx', '충전 직후 즉시 갱신(웹훅 적립 폴링과 짝)']]);

const problems: string[] = [];
for (const f of DISPLAY) {
  const s = readFileSync(f, 'utf8');
  if (!/useCoinBalance\s*\(/.test(s)) {
    problems.push(`${f}: 공용 훅 useCoinBalance 를 쓰지 않습니다.\n      → 화면마다 갱신 시점이 갈려 옛 잔액이 남습니다(daniel 신고 2건의 원인).`);
  }
  // 표시 화면이 직접 조회하면 규칙이 다시 갈라진다
  if (/coinBalanceOrNull\s*\(\s*\)/.test(s)) {
    problems.push(`${f}: 표시 화면에서 coinBalanceOrNull() 를 직접 부릅니다.\n      → 훅과 두 갈래가 되어 또 어긋납니다. 표시는 훅으로 통일하십시오.`);
  }
}
console.log('\n💰 보유 운 표시 갱신 규칙');
console.log(`   표시 화면 ${DISPLAY.length}개가 공용 훅 useCoinBalance(session) 사용`);
for (const [f, why] of EXEMPT) console.log(`   · 면제 ${f} — ${why}`);
if (problems.length) {
  console.error(`\n❌ 위반 ${problems.length}건\n`);
  problems.forEach((p) => console.error('   ' + p + '\n'));
  console.error('   ※ 규칙: 잔액 **표시**는 훅 하나로. 포커스마다 재조회 + 세션 변경 시 즉시 비움.\n');
  process.exit(1);
}
console.log('   ✅ 모든 표시 지점이 같은 규칙으로 갱신됩니다.\n');
