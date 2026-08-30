// scripts/check-paychannel.ts — 앱·웹 **동일 가격** 정책을 코드로 강제한다
// ═══════════════════════════════════════════════════════════════════════════
// 왜 만들었나 (daniel 2026-08-17: *"안드로이드랑 웹이랑 병행하면 가격이 차이가 발생할수밖에 없는데"*)
//   안드로이드(Play 약 15%)와 웹(PG 약 3%)은 수수료가 12~14%p 다르다.
//   daniel 결정: **가격은 같게 간다** — 웹의 차익은 할인 재원이 아니라 마진으로 가져간다.
//     ① 사용자 눈에 차이가 없으면 "왜 앱이 비싸?" CS 가 아예 안 생긴다
//     ② 앱 안에서 웹 가격을 알리는 행위(steering)는 스토어 정책 영역 — 리스크를 만들지 않는다
//
// 무엇을 지키나
//   P1. 모든 충전 팩이 **채널과 무관하게 같은 가격**인가 — `packPriceWon` 을 **실행해서** 본다
//       (예외는 `PRICE_DIVERGENCE` 에 **사유와 함께** 적은 것만. 적지 않으면 실패한다)
//   P2. 원화가 붙는 곳이 **충전 팩뿐**인가 — 콘텐츠는 운(`COIN_PRICE`)으로만 매겨져야 채널이 늘어도 안 갈린다
//   P3. 예외를 두더라도 **웹이 앱보다 비싸지는** 일은 없어야 한다(그건 실수다)
//
// ★값을 실행해서 판정한다 — 주석에 "동일 가격"이라고 적는 것은 보증이 아니다
//   (이 저장소에서 주석이 보증인 줄 알았다가 데인 적이 있다 · [[duplicate-ui-single-source]]).
// ★음성 테스트: `npx tsx scripts/check-paychannel.ts --selftest`
// ═══════════════════════════════════════════════════════════════════════════
import { COIN_PACKS, COIN_PRICE, PRICE_DIVERGENCE, packBonusPct, packPriceWon } from '../app/src/lib/billing/coinPrices';

type Finding = { rule: string; msg: string };
const out: Finding[] = [];
const fail = (rule: string, msg: string) => out.push({ rule, msg });

const won = (n: number) => n.toLocaleString('ko-KR') + '원';

// ── P1. 채널 간 동일 가격(실행) ──────────────────────────────────────────────
for (const pack of COIN_PACKS) {
  const store = packPriceWon(pack.id, 'store');
  const web = packPriceWon(pack.id, 'web');
  if (store === web) continue;

  const declared = PRICE_DIVERGENCE[pack.id];
  if (!declared) {
    fail('P1', `${pack.id} — 채널 간 가격이 다르다(앱 ${won(store)} / 웹 ${won(web)}).\n        의도한 것이면 \`PRICE_DIVERGENCE\` 에 **사유와 함께** 적을 것. 안 적혀 있으면 실수로 본다`);
    continue;
  }
  if (!declared.why || declared.why.trim().length < 4) {
    fail('P1', `${pack.id} — 차등은 적혀 있는데 사유(\`why\`)가 비었다. 왜 다른지 못 적으면 두지 않는다`);
  }
  // ── P3. 웹이 더 비싸면 실수다(웹이 수수료가 싼데 비쌀 이유가 없다) ──
  if (web > store) {
    fail('P3', `${pack.id} — 웹이 앱보다 비싸다(앱 ${won(store)} / 웹 ${won(web)}). 수수료가 싼 쪽이 비쌀 이유가 없다`);
  }
}

// ── P2. 원화는 충전 팩에만 ──────────────────────────────────────────────────
{
  // 콘텐츠 가격이 '운'인지 — 값이 원화 단위(수백~수만)로 들어가면 채널마다 갈릴 여지가 생긴다.
  const suspicious = Object.entries(COIN_PRICE).filter(([, v]) => typeof v === 'number' && (v as number) >= 900);
  if (suspicious.length) {
    fail('P2', `콘텐츠 가격이 원화처럼 보인다: ${suspicious.map(([k, v]) => `${k}=${v}`).join(', ')}\n        콘텐츠는 **운**으로만 매겨야 채널이 늘어도 가격표가 안 갈린다`);
  }
  if (!COIN_PACKS.length) fail('P2', '충전 팩 목록이 비었다 — 가격표 파싱이 깨졌을 수 있다');
}

// ── P4. 적어 둔 보너스 % 가 가격과 어긋나지 않는가 ───────────────────────────
//   `bonusPct` 는 «운당 단가가 기준 팩보다 얼마나 싼가» 를 손으로 적어 둔 값이다.
//   가격을 고치고 이 숫자를 안 고치면 **화면이 조용히 거짓말을 한다**(할인율만 옛날 값).
//   ⇒ 저장값 ↔ 스토어 가격에서 계산한 값을 대조한다. 화면은 `packBonusPct` 를 쓰면 애초에 안 갈린다.
for (const pack of COIN_PACKS) {
  const derived = packBonusPct(pack.id, 'store');
  if (pack.bonusPct !== derived) {
    fail('P4', `${pack.id} — 적어 둔 보너스 ${pack.bonusPct}% 인데 스토어 가격으로 계산하면 ${derived}% 다.\n        가격을 고쳤으면 이 숫자도 같이 고치거나, 화면에서 \`packBonusPct()\` 를 쓸 것`);
  }
}

// ── 음성 테스트 ─────────────────────────────────────────────────────────────
if (process.argv.includes('--selftest')) {
  /** 하네스 본문과 같은 판정을 떼어 낸 것(입력을 바꿔 가며 검사). */
  const judge = (store: number, web: number, declared?: { web: number; why: string }) => {
    if (store === web) return 'ok';
    if (!declared) return 'P1-미신고';
    if (!declared.why || declared.why.trim().length < 4) return 'P1-사유없음';
    if (web > store) return 'P3-웹이비쌈';
    return 'ok';
  };
  const cases: Array<{ name: string; run: () => boolean }> = [
    { name: 'P1: 같으면 통과', run: () => judge(9900, 9900) === 'ok' },
    { name: 'P1: 신고 없이 다르면 문다', run: () => judge(9900, 8900) === 'P1-미신고' },
    { name: 'P1: 사유가 비면 문다', run: () => judge(9900, 8900, { web: 8900, why: '' }) === 'P1-사유없음' },
    { name: 'P1: 사유를 적으면 통과', run: () => judge(9900, 8900, { web: 8900, why: '웹 전환 캠페인' }) === 'ok' },
    { name: 'P3: 웹이 더 비싸면 문다', run: () => judge(8900, 9900, { web: 9900, why: '사유를 충분히 적은 경우' }) === 'P3-웹이비쌈' },
    // ★2026-08-30 갈아끼움 — 예전엔 「전 팩 동일가」를 기대했다. 웹 전용 전환으로 **차등이 정책이 됐다**.
    //   낡은 기대를 그대로 두면 하네스가 «반려된 규칙» 을 초록불로 강제한다(이 저장소가 세 번 당한 함정).
    { name: '실제 표: 차등은 전부 신고돼 있다', run: () => COIN_PACKS.every((p) => packPriceWon(p.id, 'store') === packPriceWon(p.id, 'web') || (PRICE_DIVERGENCE[p.id]?.why ?? '').trim().length >= 4) },
    { name: '실제 표: 웹이 앱보다 비싼 팩은 없다', run: () => COIN_PACKS.every((p) => packPriceWon(p.id, 'web') <= packPriceWon(p.id, 'store')) },
    { name: '실제 표: 콘텐츠는 전부 운(원화 아님)', run: () => Object.values(COIN_PRICE).every((v) => typeof v !== 'number' || (v as number) < 900) },
    // P4 — 계산으로 판정한다(적어 둔 숫자를 그대로 믿지 않는다)
    { name: 'P4: 저장 bonusPct = 스토어 가격에서 계산한 값', run: () => COIN_PACKS.every((p) => p.bonusPct === packBonusPct(p.id, 'store')) },
    { name: 'P4: 웹은 값이 싸므로 보너스가 더 크거나 같다', run: () => COIN_PACKS.every((p) => packBonusPct(p.id, 'web') >= packBonusPct(p.id, 'store')) },
  ];
  let bad = 0;
  console.log('── 음성 테스트(깨뜨린 입력을 실제로 무는가) ──');
  for (const c of cases) { const ok = c.run(); console.log(`  ${ok ? '✅' : '❌'} ${c.name}`); if (!ok) bad++; }
  if (bad) { console.error(`\n❌ 음성 테스트 ${bad}건 실패`); process.exit(1); }
  console.log('  → 전부 통과: 이 하네스는 실제로 문다\n');
}

if (out.length) {
  console.error(`❌ check:paychannel — ${out.length}건`);
  for (const f of out) console.error(`  [${f.rule}] ${f.msg}`);
  process.exit(1);
}
const n = Object.keys(PRICE_DIVERGENCE).length;
console.log(
  `✅ check:paychannel — 충전 팩 ${COIN_PACKS.length}개 · ` +
  (n ? `채널 차등 ${n}건 전부 사유와 함께 신고됨(웹이 더 비싼 팩 0)` : '앱·웹 동일 가격') +
  ` · 보너스 %가 가격과 일치 · 콘텐츠는 운으로만`);
