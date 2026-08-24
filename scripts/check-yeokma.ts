/**
 * scripts/check-yeokma.ts — **역마 3레이어** + 노트의 사후검증을 잠근다
 * ═════════════════════════════════════════════════════════════════════════
 * 출처: 전문가 케이스 노트 v2 (2026-08-24) §0·§3
 *
 * ■ ★이 하네스가 지키는 것 두 가지
 *   ①**사후검증 값** — 노트가 *"검증 대기"* 로 남긴 연도가 실제로 맞았다. 그 사실을 못 박는다.
 *     · A: 32세 `丁亥` 역마 대운(= 현재) ↔ 2024–25 이주 · 역마 세운에 **2025**
 *     · B: 원국 역마 **0** 인데 역마 세운에 **2004**(호주 유학)·**2007**(여수→서울) 둘 다
 *     ⇒ 개수만 세던 판정이 두 차트에서 **반대 방향으로** 틀렸다는 노트의 근거가 이 값들이다.
 *   ②★★**내가 가중치를 발명하지 않았는가**
 *     레이어 가중·「주체형/이벤트형」 임계는 노트가 **Daniel 컨펌 항목**으로 지정했다.
 *     내가 계수를 넣으면 판정이 아니라 **사후 변명 장치**가 된다([[attach-indicators-r-attach]]).
 *     ⇒ 엔진에 점수·유형 분류가 **생기면 실패**시킨다. 판정이 도착하면 그때 이 규칙을 푼다.
 *
 * 실행: npm run check:yeokma   (preflight 에 포함)
 */
import { readFileSync } from 'node:fs';
import { buildSajuChart } from '../engine/saju';
import { yeokmaLayers } from '../engine/yeokma';
import type { ChartInput } from '../spec/chart';

const A: ChartInput = {
  birthDateTime: '1995-08-06 16:00', calendar: '양', sex: '여',
  birthPlace: '밀라노, 롬바르디아, 이탈리아', birthLon: 9.1896346, birthLat: 45.4641943, timeAccuracy: '정확',
} as ChartInput;
const B: ChartInput = {
  birthDateTime: '1994-03-16 17:50', calendar: '양', sex: '남',
  birthPlace: '여수시, 전라남도, 대한민국', birthLon: 127.659859, timeAccuracy: '정확',
} as ChartInput;

let fail = 0, pass = 0;
const bad = (m: string) => { fail++; console.log(`  ❌ ${m}`); };
const ok = (m: string) => { pass++; console.log(`  ✅ ${m}`); };

console.log('\n🐎 역마 3레이어 하네스\n');

const ca = buildSajuChart(A, 2026);
const cb = buildSajuChart(B, 2026);
const ya = yeokmaLayers(ca);
const yb = yeokmaLayers(cb);

// ── ① 차트 A — 개수는 적은데 이동이 최상위 테마였다 ─────────────────────
console.log('=== ① 차트 A — 자리·충·상호구조 ===');
{
  const m = ya.natal.mutual.find((x) => (x.a === '년' && x.b === '일') || (x.a === '일' && x.b === '년'));
  if (m) ok(`년지↔일지 **상호 역마** (${m.branches.join('↔')})`);
  else bad('★년지↔일지 상호 역마를 못 잡는다 — 노트가 A 의 첫 근거로 든 구조다');

  if (ya.natal.hasChungedYeokma) ok('역마봉충 성립(노트: 최상급)');
  else bad('★역마봉충을 못 잡는다 — 巳亥충이 있는데 놓쳤다');

  const cur = ya.luck.find((l) => l.isCurrent);
  if (cur && cur.gz === '丁亥' && cur.startAge === 32) ok(`현재 대운이 역마 대운 ${cur.gz}(${cur.startAge}세) — 2024–25 이주와 정합`);
  else bad(`★현재 역마 대운이 32세 丁亥 가 아니다: ${cur ? `${cur.gz}(${cur.startAge}세)` : '없음'}`);

  if (ya.annual.includes(2025)) ok('역마 세운에 2025 포함(이주 연도)');
  else bad(`★2025 가 역마 세운에 없다 — ${ya.annual.join(',')}`);
}

// ── ② 차트 B — 원국 0 인데 이동 이력이 있었다 ───────────────────────────
console.log('\n=== ② 차트 B — 원국 0 · 세운 백테스트 ===');
{
  if (ya.natal.hits.length === 0) bad('A 의 원국 역마가 0 이다 — 픽스처가 틀렸다');
  if (yb.natal.hits.length === 0) ok('원국 역마 **0**(노트대로 — 개수만 보면 "이동 없음")');
  else bad(`원국 역마가 ${yb.natal.hits.length}건 잡힌다 — 노트는 0 이다`);

  // ★노트가 "검증 대기" 로 남긴 두 해 — 실제 이동 이력과 대조된 값이다
  for (const [y, why] of [[2004, '호주 유학'], [2007, '여수→서울']] as const) {
    if (yb.annual.includes(y)) ok(`역마 세운에 ${y} 포함 (${why}) — 노트의 예측 적중`);
    else bad(`★${y}(${why})가 역마 세운에 없다 — 백테스트가 깨졌다`);
  }

  const p = yb.luck.find((l) => l.startAge === 47);
  if (p && p.gz === '壬申') ok('47세 壬申 = 지지 역마 대운(노트: 본발동 · 재물 피크와 동일 구간)');
  else bad(`★47세 역마 대운이 壬申 이 아니다: ${p?.gz ?? '없음'}`);

  if (yb.annual.includes(2028)) ok('역마 세운에 2028 포함(노트: 시동 · 매듭 적기와 같은 해)');
  else bad('★2028 이 역마 세운에 없다');
}

// ── ③ ★★가중치를 발명하지 않았는가 (컨펌 대기 가드) ────────────────────
console.log('\n=== ③ 판정 전에 내가 점수를 만들지 않았는가 ===');
{
  const src = readFileSync('engine/yeokma.ts', 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter((l) => !/^\s*(\/\/|\*)/.test(l)).join('\n');
  // 점수·가중·임계·유형분류가 코드에 생기면 실패. 판정이 오면 이 규칙을 푼다.
  const smells = [
    [/\bscore\b/i, '점수(score)'],
    [/\bweight\b/i, '가중치(weight)'],
    [/주체형|이벤트형/, '유형 분류(주체형/이벤트형)'],
    [/\*\s*0?\.\d/, '계수 곱셈'],
  ] as const;
  const found = smells.filter(([re]) => re.test(src)).map(([, n]) => n);
  if (found.length) bad(`★엔진이 판정을 만들고 있다: ${found.join(' · ')} — 이건 **Daniel 컨펌 항목**이다(노트 컨펌 1번)`);
  else ok('날것만 내보낸다 — 가중·유형분류 없음');

  // 날것이 실제로 쓸 만한가(빈 껍데기면 위 검사는 공짜로 통과한다)
  const rich = ya.natal.hits.every((h) => 'chunged' in h && 'base' in h && 'at' in h);
  if (rich && ya.natal.hits.length && yb.annual.length) ok('날것에 자리·충·기준지가 실려 있다(해석이 굳지 않게)');
  else bad('날것이 비어 있다 — 판정만 뺀 게 아니라 재료도 없다');
}

console.log(`\n   통과 ${pass} · 실패 ${fail}`);
if (fail) {
  console.log('\n   ⚠️ 역마 레이어가 어긋났다. `engine/yeokma.ts` · `engine/sinsal.ts`(twelveSinsalAt) 를 본다.');
  console.log('      ★A·B 의 연도는 **실제 이동 이력과 대조된 값**이다 — 가볍게 바꾸지 말 것.\n');
  process.exit(1);
}
console.log('   🎯 통과 — 상호역마·봉충·대운·세운 백테스트(2004·2007) · 판정 미발명\n');
