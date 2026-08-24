/**
 * scripts/check-gaeun.ts — **개운 방향**이 명리 오류로 되돌아가지 않게
 * ═════════════════════════════════════════════════════════════════════════
 * Boss 2026-08-24 *"약한 기운을 보완하는 개운법 · 십성별 세분화 · 어떤 부분을 보완하면
 *   가장 좋을지 알맞게 판단해야"*.
 *
 * ■ ★이 기능이 틀리는 방식은 **하나**다
 *   *"약한 기운을 보완한다"* 를 글자 그대로 구현하는 것 — **제일 적은 오행을 채우는 것**.
 *   그건 이 프로젝트가 이미 **명리 오류로 판정한 것**이다:
 *     `healingMethod.ts` 머리말(daniel B7 2026-07-06) —
 *       *"과거 '충전=일간오행·채움=최소오행'은 **명리 오류**였다"*
 *     `spouse_reading_methodology.md` §7 — *"**용신 보강이 곧 개운**"*  · R59 — *"개운=억부"*
 *   ⇒ 축은 **용신**이다. 최소 오행은 참고 한 줄로만 내려가 있어야 한다.
 *   ⚠️화면은 어느 쪽이든 멀쩡히 뜬다. 그래서 눈으로 못 잡는다 — 구조로 잡는다.
 *
 * ■ 무엇을 보나
 *   ①오행→십신 표가 옳은가 (**실행해서** 검증 — 순수 함수라 node 로 돈다)
 *   ②1순위가 **용신**에서 오는가 (최소 오행이 아니라)
 *   ③**채우면 안 되는 기운(기신)**을 반드시 같이 말하는가
 *   ④표가 **한 곳에만** 있는가(용신 카드와 개운 블록이 갈리면 한 화면에서 모순)
 *
 * 실행: npm run check:gaeun   (preflight 에 포함)
 */
import { readFileSync } from 'node:fs';
import { sipsinGroupOf, type Elem5 } from '../engine/sipsinGroup';

const GAEUN = 'app/src/lib/content/gaeun.ts';
const CARD = 'app/src/components/GaeunCard.tsx';
const YCARD = 'app/src/components/YongsinCard.tsx';

let fail = 0, pass = 0;
const bad = (m: string) => { fail++; console.log(`  ❌ ${m}`); };
const ok = (m: string) => { pass++; console.log(`  ✅ ${m}`); };
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter((l) => !/^\s*(\/\/|\*)/.test(l)).join('\n');

console.log('\n🌱 개운 방향 하네스\n');

// ── ① 오행 → 십신 (실행 검증) ────────────────────────────────────────────
console.log('=== ① 오행 → 십신 표 ===');
{
  const ELS: Elem5[] = ['木', '火', '土', '金', '水'];
  // daniel 辛丑(金 일간) 실측값 — [[yongsin-app-engine-drift]] 에 기록된 canonical 결과
  const known: [Elem5, string][] = [['土', '인성'], ['金', '비겁'], ['火', '관성'], ['水', '식상'], ['木', '재성']];
  const wrong = known.filter(([e, w]) => sipsinGroupOf('金', e) !== w);
  if (wrong.length) bad(`辛(金) 일간 매핑이 틀렸다: ${wrong.map(([e, w]) => `${e}→${sipsinGroupOf('金', e)}(기대 ${w})`).join(' · ')}`);
  else ok('辛(金) 일간 다섯 오행이 전부 실측값과 일치');

  // 어떤 일간에서도 다섯 그룹이 **정확히 한 번씩** 나와야 한다(빠지거나 겹치면 표가 깨진 것)
  const broken = ELS.filter((d) => new Set(ELS.map((t) => sipsinGroupOf(d, t))).size !== 5);
  if (broken.length) bad(`${broken.join('·')} 일간에서 5그룹 완전분할이 깨졌다`);
  else ok('다섯 일간 전부 5그룹 완전분할');

  // ★음성 테스트 — 표가 실제로 구분을 하는가(전부 같은 값을 뱉으면 위 검사는 통과할 수도 있다)
  if (new Set(ELS.map((t) => sipsinGroupOf('木', t))).size === 5 && sipsinGroupOf('木', '木') === '비겁') ok('음성 테스트 — 표가 상수를 뱉지 않는다');
  else bad('음성 테스트 실패 — 표가 구분을 못 한다');
}

// ── ② 1순위가 용신에서 오는가 ────────────────────────────────────────────
console.log('\n=== ② 1순위 = 용신인가 (최소 오행이 아니라) ===');
{
  const src = strip(readFileSync(GAEUN, 'utf8'));
  // `targets[0]` 을 만드는 식이 무엇을 넣는가
  const first = /const targets:[^=]*=\s*\[\s*mk\(([^,]+),\s*1\)/.exec(src)?.[1] ?? '';
  if (!first) bad('1순위를 만드는 자리를 못 찾았다 — 하네스가 헛돈다');
  else if (/scarce|min|least|weak/i.test(first)) bad(`★1순위가 **최소 오행**에서 온다: ${first.trim()} — 명리 오류다(daniel B7 2026-07-06)`);
  else if (!/yongsin/i.test(first)) bad(`1순위가 용신에서 오지 않는다: ${first.trim()}`);
  else ok(`1순위 = 용신 (${first.trim()})`);

  // 최소 오행은 **참고 칸**에만 있어야 한다 — targets 에 들어가면 안 된다
  const scarceInTargets = /targets\.push\(mk\(\s*scarce/i.test(src);
  if (scarceInTargets) bad('★최소 오행이 보완 대상에 들어간다 — 참고여야 한다');
  else ok('최소 오행은 `scarcest`(참고)에만 있다');

  // 판단 근거(method)를 내보내는가 — 근거 없는 처방이면 안 된다
  if (/method:\s*ys\.method/.test(src)) ok('판단 축(억부/병약/조후…)을 함께 내보낸다');
  else bad('무엇을 근거로 골랐는지 안 내보낸다');
}

// ── ③ 채우면 안 되는 기운을 말하는가 ────────────────────────────────────
console.log('\n=== ③ 기신을 반드시 같이 말하는가 ===');
{
  const src = strip(readFileSync(GAEUN, 'utf8'));
  if (/avoid:\s*\{[^}]*element:\s*gi\b/.test(src)) ok('`avoid` = 기신');
  else bad('★기신을 안 내보낸다 — "약한 건 다 채우면 된다"는 오해를 못 끊는다');

  const card = strip(readFileSync(CARD, 'utf8'));
  if (/g\.avoid/.test(card)) ok('화면이 기신을 그린다');
  else bad('★화면이 기신을 안 그린다 — 데이터만 있고 안 보이면 없는 것과 같다');

  // 최소 오행을 **처방처럼** 적으면 안 된다 — 참고 문구가 붙어 있는가
  if (/scarcest/.test(card) && /참고|아니라|꼭/.test(card)) ok('최소 오행에 "참고만" 단서가 붙어 있다');
  else bad('최소 오행을 처방처럼 적고 있다');
}

// ── ④ 표가 한 곳에만 있는가 ─────────────────────────────────────────────
console.log('\n=== ④ 오행→십신 표가 단일 원본인가 ===');
{
  for (const [f, label] of [[GAEUN, '개운 모듈'], [YCARD, '용신 카드']] as const) {
    const src = strip(readFileSync(f, 'utf8'));
    const hasOwn = /GEN\[D\]\s*===\s*T|GEN\[day\]\s*===\s*target/.test(src);
    const delegates = /@engine\/sipsinGroup/.test(readFileSync(f, 'utf8'));
    if (hasOwn) bad(`${label}(${f}) 가 표를 **직접** 갖고 있다 — 한쪽만 고치면 한 화면에서 갈린다`);
    else if (!delegates) bad(`${label} 가 엔진 표를 안 쓴다`);
    else ok(`${label} — 엔진 단일 원본에 위임`);
  }
}

console.log(`\n   통과 ${pass} · 실패 ${fail}`);
if (fail) {
  console.log('\n   ⚠️ 개운 방향이 어긋나 있다.');
  console.log('      ★"약한 오행을 채운다" 가 아니라 **용신을 보강한다** 가 이 기능의 축이다');
  console.log('        (R59 · 배우자 방법론 §7 · healingMethod B7 판정).\n');
  process.exit(1);
}
console.log('   🎯 통과 — 용신 축 · 기신 명시 · 최소오행은 참고 · 표 단일 원본\n');
