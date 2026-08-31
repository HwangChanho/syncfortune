// scripts/check-chatimage.ts — 대화 그림이 **돈을 새게 하지 않도록**
// ═══════════════════════════════════════════════════════════════════════════
// 왜 만들었나 (Boss 2026-09-01 *"이미지도 유저가 보낼수 있어야해 … 보내기전에 안내로
//   운 소모된다하고 운 갯수는 api비용에 맞춰서 마진률 90이상으로 잡아"*)
//
// ■ ★이미지는 **글보다 비싸고, 크기가 곧 돈이다**
//   클로드는 이미지를 `(가로×세로)/750` 토큰으로 읽는다. 실측:
//     원본 4032×3024 → 16,258토큰(₩17.9 Haiku · ₩71.5 Opus)
//     1568 로 줄이면 →  2,459토큰(₩2.7        · ₩10.8)   ⇒ **6배 차이**
//   ⚠️1568 위로 보내도 클로드가 어차피 줄여 읽는다 — **돈만 더 낸다.**
//   ⇒ 「줄여서 보내기」가 풀리면 **조용히 6배**가 된다. 화면은 똑같아 보인다.
//
// 무엇을 지키나
//   I1 업로드 긴 변이 **1568 이하**다
//   I2 값이 **마진 90% 이상**이다 — 실측 원가로 **계산해서** 확인한다(숫자를 믿지 않는다)
//   I3 깊은 모델(Opus)은 **더 받는다** — 원가가 4배인데 같은 값이면 그 상담가만 마진이 깨진다
//   I4 그림 목록이 **정해진 것에서만** 골라진다(모델이 이름을 지어내지 못하게)
//
// ★음성 테스트: `npx tsx scripts/check-chatimage.ts --selftest`
// ═══════════════════════════════════════════════════════════════════════════
import { UPLOAD_MAX_EDGE, IMAGE_COST, imageCostFor, CHAT_IMAGES, isKnownImage } from '../app/src/lib/talk/chatImages';

type Finding = { rule: string; msg: string };
const out: Finding[] = [];
const fail = (rule: string, msg: string) => out.push({ rule, msg });

/** 운당 실수령(가장 불리한 팩 · coin_1200 스토어) — `check:packturns` 와 같은 근거. */
export const WON_PER_COIN = 52.44;
/** 글 쪽 턴 원가(2026-08-30 실측 평균). */
export const TEXT_TURN_WON = 20.7;
/** 입력 단가(원/1M 토큰). */
export const IN_PRICE = { haiku: 1100, opus: 4400 };

/** 긴 변 `edge` 인 4:3 이미지를 읽는 토큰 수. */
export function imageTokens(edge: number): number {
  return Math.ceil((edge * (edge * 3 / 4)) / 750);
}

/** 그 턴 전체 원가(원). */
export function turnCost(edge: number, model: 'haiku' | 'opus'): number {
  return imageTokens(edge) / 1_000_000 * IN_PRICE[model] + TEXT_TURN_WON;
}

/** 마진. */
export function marginOf(coins: number, edge: number, model: 'haiku' | 'opus'): number {
  return 1 - turnCost(edge, model) / (coins * WON_PER_COIN);
}

// ── 실제 검사 ───────────────────────────────────────────────────────────────
if (!process.argv.includes('--selftest')) {
  if (UPLOAD_MAX_EDGE > 1568) {
    fail('I1', `업로드 긴 변이 ${UPLOAD_MAX_EDGE} 다 — **1568 을 넘으면 돈만 더 낸다**.\n        `
      + '클로드가 어차피 줄여 읽는다. 원본(4032)을 보내면 읽기 원가가 **6배**가 되고\n        '
      + '화면은 **똑같아 보인다** — 청구서로만 드러나는 종류다');
  }
  for (const [label, model, coins] of [
    ['보통 상담가', 'haiku', IMAGE_COST.normal],
    ['깊은 상담가', 'opus', IMAGE_COST.deep],
  ] as Array<[string, 'haiku' | 'opus', number]>) {
    const m = marginOf(coins, UPLOAD_MAX_EDGE, model);
    if (m < 0.90) {
      fail('I2', `${label}: ${coins}운이면 마진 **${(m * 100).toFixed(1)}%** — 기준 90% 미달.\n        `
        + `(원가 ₩${turnCost(UPLOAD_MAX_EDGE, model).toFixed(1)} / 매출 ₩${(coins * WON_PER_COIN).toFixed(0)})\n        `
        + 'Boss 2026-09-01 *"마진률 90이상으로 잡아"*');
    }
  }
  if (IMAGE_COST.deep <= IMAGE_COST.normal) {
    fail('I3', `깊은 모델이 **더 받지 않는다**(${IMAGE_COST.deep} ≤ ${IMAGE_COST.normal}).\n        `
      + 'Opus 입력 단가는 Haiku 의 4배다 — 같은 값이면 그 상담가만 마진이 깨진다');
  }
  if (imageCostFor('claude-opus-5') !== IMAGE_COST.deep) {
    fail('I3', '`imageCostFor` 가 Opus 를 못 알아본다 — 값이 모델을 따라가지 않는다');
  }
  if (!CHAT_IMAGES.length) fail('I4', '그림 목록이 비었다');
}

// ── 음성 테스트 ─────────────────────────────────────────────────────────────
if (process.argv.includes('--selftest')) {
  const cases: Array<{ name: string; run: () => boolean }> = [
    { name: 'I1 1568 은 통과', run: () => UPLOAD_MAX_EDGE <= 1568 },
    { name: 'I1 ★원본(4032)은 토큰이 6배 넘는다',
      run: () => imageTokens(4032) > imageTokens(1568) * 6 },
    { name: 'I2 5운·Haiku 는 90% 이상', run: () => marginOf(5, 1568, 'haiku') >= 0.90 },
    { name: 'I2 3운·Haiku 는 미달(실제로 문다)', run: () => marginOf(3, 1568, 'haiku') < 0.90 },
    { name: 'I2 8운·Opus 는 90% 이상', run: () => marginOf(8, 1568, 'opus') >= 0.90 },
    { name: 'I2 ★5운·Opus 는 미달 — 그래서 값을 갈랐다', run: () => marginOf(5, 1568, 'opus') < 0.90 },
    { name: 'I2 ★원본을 보내면 5운으로는 무너진다', run: () => marginOf(5, 4032, 'opus') < 0.90 },
    { name: 'I3 깊은 쪽이 더 비싸다', run: () => IMAGE_COST.deep > IMAGE_COST.normal },
    { name: 'I3 Opus 를 알아본다', run: () => imageCostFor('claude-opus-5') === IMAGE_COST.deep },
    { name: 'I3 그 외는 보통값', run: () => imageCostFor('claude-haiku-4-5') === IMAGE_COST.normal },
    { name: 'I3 비어 있어도 보통값(안전한 쪽)', run: () => imageCostFor(null) === IMAGE_COST.normal },
    { name: 'I4 ★준비 안 된 그림은 못 고른다', run: () => isKnownImage('greet') === false },
    { name: 'I4 없는 이름도 못 고른다', run: () => isKnownImage('없는것') === false },
  ];
  let bad = 0;
  console.log('── 음성 테스트(깨뜨린 입력을 실제로 무는가) ──');
  for (const c of cases) { let ok = false; try { ok = c.run(); } catch { ok = false; } console.log(`  ${ok ? '✅' : '❌'} ${c.name}`); if (!ok) bad++; }
  if (bad) { console.error(`\n❌ 음성 테스트 ${bad}건 실패`); process.exit(1); }
  console.log('  → 전부 통과: 이 하네스는 실제로 문다\n');
}

if (out.length) {
  console.error(`❌ check:chatimage — ${out.length}건`);
  for (const f of out) console.error(`  [${f.rule}] ${f.msg}`);
  process.exit(1);
}
console.log(`✅ check:chatimage — 긴 변 ${UPLOAD_MAX_EDGE} · 보통 ${IMAGE_COST.normal}운(${(marginOf(IMAGE_COST.normal, UPLOAD_MAX_EDGE, 'haiku') * 100).toFixed(1)}%) · 깊은 ${IMAGE_COST.deep}운(${(marginOf(IMAGE_COST.deep, UPLOAD_MAX_EDGE, 'opus') * 100).toFixed(1)}%)`);
