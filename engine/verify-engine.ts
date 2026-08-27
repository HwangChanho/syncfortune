// engine/verify-engine.ts — 결정론 *정확도* 게이트 (공식 산출 ↔ 알려진 명리 정답)
// ─────────────────────────────────────────────────────────────────────────
// 12운성(양간 순행·음간 역행)·공망(순중공망) 같은 '공식' 산출이 명리 표준값과 일치하는지 교차검증.
//   테이블 오류·역행 방향 실수를 게이트로 차단. (신살 매핑은 고정 테이블이라 부차 — run-sinsal로 확인.)
// 실행: npm run verify:engine
// ─────────────────────────────────────────────────────────────────────────
import _lunar from 'lunar-javascript';
import { twelveStage } from './twelve';
import { gongmang, analyzeSinsal } from './sinsal';
import { detectInteractions, scoreStrength } from './structure';
import { johu2, johuLabel } from './johu2';
import { spouseCapacityAxis } from './attachSpouseAxis';
import { buildSajuChart, validateBirthInput } from './saju';
import { trueSolarOffsetMin, kstMeridianAt, dstOffsetMin } from './solartime';
import type { Stem, Branch, PillarPos, SajuChart, ChartInput } from '../spec/chart';

let ok = true;
const mark = (p: boolean) => (p ? '✅' : '❌');
const check = (desc: string, p: boolean) => { if (!p) ok = false; console.log(`  ${mark(p)} ${desc}`); };

// ── 12운성 (천간 × 지지 → 운성) 알려진 정답 ──
// 양간 순행/음간 역행이 핵심 — 장생지·왕지(건록·제왕) 위주로 검증.
const STAGE_CASES: [Stem, Branch, string][] = [
  ['甲', '亥', '장생'], ['甲', '卯', '제왕'], ['甲', '寅', '건록'],   // 양간 순행
  ['丙', '寅', '장생'], ['丙', '午', '제왕'],
  ['庚', '巳', '장생'], ['庚', '酉', '제왕'], ['庚', '申', '건록'],
  ['壬', '申', '장생'], ['壬', '子', '제왕'],
  ['辛', '子', '장생'], ['辛', '酉', '건록'], ['辛', '申', '제왕'], // 음간 역행 (辛: 子장생→酉건록→申제왕)
  ['乙', '午', '장생'], ['丁', '酉', '장생'], ['癸', '卯', '장생'],
];
console.log('=== 12운성 정확도 (양간 순행·음간 역행) ===');
for (const [s, b, exp] of STAGE_CASES) {
  const got = twelveStage(s, b); const p = got === exp; if (!p) ok = false;
  console.log(`  ${mark(p)} ${s}${b} → ${got}${p ? '' : ` (정답 ${exp})`}`);
}

// ── 공망 (일주 간지 → 순중공망 2지지) 알려진 정답 ──
const GM_CASES: [Stem, Branch, Branch, Branch][] = [
  ['甲', '子', '戌', '亥'],  // 甲子순
  ['甲', '戌', '申', '酉'],  // 甲戌순
  ['甲', '申', '午', '未'],  // 甲申순
  ['甲', '午', '辰', '巳'],  // 甲午순
  ['辛', '丑', '辰', '巳'],  // 辛丑(甲午순)
  ['庚', '申', '子', '丑'],  // 庚申(甲寅순)
  ['癸', '亥', '子', '丑'],  // 癸亥 = 甲寅순 → 공망 子丑
  ['壬', '戌', '子', '丑'],  // 壬戌 = 甲寅순 → 공망 子丑
];
console.log('=== 공망 정확도 (순중공망) ===');
for (const [s, b, e1, e2] of GM_CASES) {
  const got = gongmang(s, b); const p = got[0] === e1 && got[1] === e2; if (!p) ok = false;
  console.log(`  ${mark(p)} ${s}${b}일주 → 공망 ${got.join('·')}${p ? '' : ` (정답 ${e1}·${e2})`}`);
}

// ── 합충형해 (detectInteractions 로직 — 화성립·반합·형 등) 알려진 정답 ──
function mk(br: [Branch, Branch, Branch, Branch]): SajuChart {
  const P: PillarPos[] = ['년', '월', '일', '시'];
  const pillars = {} as Record<PillarPos, any>;
  P.forEach((p, i) => { pillars[p] = { position: p, stem: '甲', branch: br[i], stemTenGod: '비견', branchMainTenGod: '비견', hiddenStems: [], isRoot: false }; });
  return { pillars, dayMaster: { stem: '甲', element: '木' }, interactions: [], luckCycles: [], currentLuck: {} as any, annual: {} as any } as SajuChart;
}
const INT_CASES: [string, [Branch, Branch, Branch, Branch], string][] = [
  ['子丑 육합', ['子', '丑', '巳', '巳'], '子丑合化土'],
  ['卯戌 육합', ['卯', '戌', '巳', '巳'], '卯戌合化火'],
  ['辰酉 육합', ['辰', '酉', '巳', '巳'], '辰酉合化金'],
  ['卯酉 충', ['卯', '酉', '巳', '巳'], '卯酉冲'],
  ['辰戌 충', ['辰', '戌', '巳', '巳'], '辰戌冲'],
  ['寅午 반합火', ['寅', '午', '巳', '巳'], '寅午半合火'],
  ['申子 반합水', ['申', '子', '巳', '巳'], '申子半合水'],
  ['丑戌 형', ['丑', '戌', '寅', '卯'], '丑戌刑'],
  ['午午 자형(반합 아님)', ['午', '午', '寅', '卯'], '午午自刑'], // 같은 글자=자형, 半合 오검출 회귀 방지
  ['寅午戌 삼합국火 (3자 완전체)', ['寅', '午', '戌', '子'], '寅午戌三合火'],
  ['申子辰 삼합국水', ['申', '子', '辰', '酉'], '申子辰三合水'],
  ['寅卯辰 방합木 (3자 성립)', ['寅', '卯', '辰', '子'], '寅卯辰方合木'],
  ['亥子丑 방합水', ['亥', '子', '丑', '卯'], '亥子丑方合水'],
];
console.log('=== 합충형해 정확도 (detectInteractions 로직) ===');
for (const [desc, br, must] of INT_CASES) {
  const got = detectInteractions(mk(br)).map((i) => i.detail);
  const p = got.some((d) => d.includes(must)); if (!p) ok = false;
  console.log(`  ${mark(p)} ${desc}${p ? ` → ${must} ✓` : ` → ${got.join(', ') || '(없음)'} (기대 ${must})`}`);
}
// 국(局) 회귀 방지 — 부정 케이스(없어야 할 출력)
{
  const guk = detectInteractions(mk(['寅', '午', '戌', '子'])).map((i) => i.detail);
  check('삼합국 성립 시 부분 반합은 국으로 통합(寅午半合 미출력)', !guk.some((d) => d.includes('半合')));
  const two = detectInteractions(mk(['申', '酉', '子', '子'])).map((i) => i.detail);
  check('방합은 2자(申酉)만으론 미성립(3자 전부 필요·통설)', !two.some((d) => d.includes('方合')));
  // ★상담가 판정 2026-08-04 `verify-000-rules#7`(O) — 卯未 는 목극토가 우선이라 반합이 서지 않는다.
  //   대조군을 **같이** 둔다: 같은 亥卯未 국의 亥卯 는 生(水生木)이라 그대로 성립해야 한다
  //   (한쪽만 검사하면 "반합 검출을 통째로 껐다"는 사고를 못 잡는다 — build-artifact-verify-hermes 교훈).
  const myoMi = detectInteractions(mk(['卯', '未', '巳', '巳'])).map((i) => i.detail);
  check('卯未 는 반합 미성립(목극토 우선 · 000-rules#7)', !myoMi.some((d) => d.includes('半合')));
  const haeMyo = detectInteractions(mk(['亥', '卯', '巳', '巳'])).map((i) => i.detail);
  check('대조군: 亥卯 는 반합 성립(생이라 유지 · 반합 검출 자체는 살아 있다)', haeMyo.some((d) => d.includes('亥卯半合木')));

  // ★상담가 판정 2026-08-03 `verify-000c-structure#3`(O) — 지지 합은 **이웃 기둥끼리만**.
  //   세 가지를 같이 검사한다. 하나만 보면 "합 검출을 통째로 껐다"·"거리를 충에도 걸었다"를 못 잡는다.
  const farHap = detectInteractions(mk(['子', '巳', '巳', '丑'])).map((i) => i.detail);
  check('子(년)丑(시) 육합은 미성립(거리 3 · 000c#3)', !farHap.some((d) => d.includes('子丑合')));
  const farBan = detectInteractions(mk(['申', '巳', '巳', '子'])).map((i) => i.detail);
  check('申(년)子(시) 반합도 미성립(거리 조건은 반합에도 걸린다)', !farBan.some((d) => d.includes('半合')));
  // ★2026-08-10 3차 판정으로 **뒤집혔다** — `000d#6`(O) *"떨어진 자리의 충·형·해·파는 아예 작용하지 않는다"* ·
  //   `000d#7`(O) 예시 명식의 卯酉冲(월-시)은 작용하지 않는 것으로 본다(상담가가 직접 확정).
  //   종전 이 자리엔 "충은 거리 무관하게 검출"이 **대조군**으로 있었다 — 판정이 그것을 부정했다.
  const farChung = detectInteractions(mk(['子', '巳', '巳', '午'])).map((i) => i.detail);
  check('子(년)午(시) 충은 미성립(거리 · 000d#6·#7)', !farChung.some((d) => d.includes('子午冲')));
  // 대조군은 **인접 충**으로 옮긴다 — 충 검출 자체를 껐다는 사고를 잡으려면 반드시 하나는 살아 있어야 한다.
  const nearChung = detectInteractions(mk(['子', '午', '巳', '巳'])).map((i) => i.detail);
  check('대조군: 子(년)午(월) 인접 충은 그대로 검출(충 검출이 죽지 않았다)', nearChung.some((d) => d.includes('子午冲')));

  // ★★형(刑)의 **삼형·자형 경로**에 거리 조건이 빠져 있었다 (2026-08-10 실측으로 발견)
  //   상형(子卯)에만 `near` 를 걸고 삼형(丑戌未)·자형(辰午酉亥)을 같이 안 고쳤다.
  //   실제 명식 甲戌 辛未 乙未 癸未 에서 戌未刑 이 **년-일·년-시**까지 잡히고 있었다(강약 score 오염).
  //   ⇒ 자리를 **members 로** 검사한다. detail 문자열만 보면 어느 자리 쌍인지 몰라 이 버그를 못 잡는다.
  const sanxing = detectInteractions(mk(['戌', '未', '未', '未']));
  const xingPairs = sanxing.filter((i) => i.type === '형').map((i) => (i.members as string[]).join('-'));
  // ★★2026-08-27 **판정이 뒤집혔다** — 삼형(서로 다른 글자)은 **거리 무관**하게 성립한다.
  //   ⚠️판정끼리 충돌한다. 무엇이 무엇을 이겼는지 여기 적어 둔다:
  //     · `000d#6`(O · 08-10) *"떨어진 자리의 충·형·해·파는 아예 작용하지 않는다"* → 종전 이 단언
  //     · Boss 본인 차트 재판정(07-14 · ADR-009) *"丑戌刑이 戌·丑 인성 통근을 흔든다"* → **중화**
  //   Boss 차트 戌(년)·丑(일)은 **두 칸**이라 종전 규칙으로는 형이 안 잡혀 `score=+4 신강` 이 됐다.
  //   ⇒ Boss 2026-08-27 *"1로하자"* — 07-14 판정을 살린다. 적용 후 실측 `score=+1 중화` ✅
  //   ★★[[harness-can-enforce-wrong-rule]] — 판정이 뒤집히면 **코드보다 하네스를 먼저** 고친다.
  //     이 단언이 살아 있으면 초록불이 **낡은 판단**을 계속 강제한다.
  //   ⏳**상담가 판정 대기** — `verify-000w-hyeong-distance`. 확정이 오면 `check:stance` 가 여기를 다시 열게 한다.
  //   ★범위는 **서로 다른 글자의 삼형만**이다 — 충·해·파·상형·자형은 거리 조건 그대로(아래 대조군이 지킨다).
  check(`삼형 戌未 는 거리 무관 성립(Boss 2026-08-27 ① · ⏳판정대기 verify-000y) [${xingPairs.join(',')}]`,
    xingPairs.includes('년-월') && xingPairs.includes('년-일') && xingPairs.includes('년-시'));
  check(`자형 未未 는 **삼형과 달리** 인접만 — 월-시(두 칸)는 미성립 [${xingPairs.join(',')}]`, !xingPairs.includes('월-시'));
  check(`대조군: 인접 자형(월-일 · 일-시)은 살아 있다 [${xingPairs.join(',')}]`, xingPairs.includes('월-일') && xingPairs.includes('일-시'));
}

// ── 충의 세력 = **제 계절을 만났는지** (`verify-000h-magnitude#14` O · `#15` X · 2026-08-11) ──
//   #14(O) *"어느 쪽이 이기는지는 그 오행이 **제 계절을 만났는지**로 먼저 가른다"*
//   #15(X) *"**갯수는 강함을 증명하지 않는다**"* → 종전 자리 가중(월3·일2·시2·년1.5) 비교는 **폐기**.
//   ★세 갈래를 다 본다: 계절이 가를 때 · 둘 다 제 철일 때 · 둘 다 아닐 때.
//     한 갈래만 두면 "늘 한쪽만 손상" 같은 상수 동작을 못 잡는다.
{
  // 월지 午(火). 년子(水)는 제 철이 아니고 월午(火)는 제 철 ⇒ 午가 이긴다
  const seasonWins = mk(['子', '午', '巳', '巳']);
  seasonWins.interactions = detectInteractions(seasonWins);
  const bd = scoreStrength(seasonWins).breakdown.join(' ');
  check('제 철을 만난 午(월)는 子(년)에게 충 맞아도 안 깨진다(000h#14)', !bd.includes('월午(충)'));
  check('대조군: 진 쪽 子(년)는 그대로 손상(충 처리 자체는 살아 있다)', bd.includes('년子(충)'));

  // 월지 巳(火). 일子(水)는 아니고 시午(火)는 제 철 ⇒ **자리가 같아도(일·시) 계절이 가른다**
  //   ★종전엔 여기가 '세력 동률 → 양쪽 손상'이었다. 자리 가중을 버렸으므로 결과가 바뀐다.
  const seasonSplits = mk(['巳', '巳', '子', '午']);
  seasonSplits.interactions = detectInteractions(seasonSplits);
  const bdSplit = scoreStrength(seasonSplits).breakdown.join(' ');
  check('자리가 같아도(일·시) 계절이 가른다 — 午(시)는 안 깨지고 子(일)만 손상',
    !bdSplit.includes('시午(충)') && bdSplit.includes('일子(충)'));

  // 둘 다 제 철이 아니면 **판정이 없다** → 보수적으로 양쪽 손상
  //   월지 寅(木). 일子(水)·시午(火) 둘 다 木이 아니다.
  const neither = mk(['卯', '寅', '子', '午']);
  neither.interactions = detectInteractions(neither);
  const bdNo = scoreStrength(neither).breakdown.join(' ');
  check('둘 다 제 철이 아니면 판정이 없어 양쪽 손상(보수 유지)',
    bdNo.includes('일子(충)') && bdNo.includes('시午(충)'));
}

// ── 반합 = **더하기가 아니라 버티기** (`verify-000h-magnitude#7` · O · 2026-08-11) ──────
//   상담가: *"'유지되는 힘'이란 午 가 홀로 있을 때보다 **더 세지지는 않지만**,
//            다른 글자에 극을 당해도 **덜 흔들린다**는 뜻이다."* → **O**
//   ⇒ ①세력 가산 0 (종전 ×0.6 폐기 · 극/생 구분도 이 판정에 흡수됨) ②충 손상 **면제**
//   ★검출과 세력을 가르는 것은 그대로 — 합이 있다는 사실은 통변에 쓰이고, 힘은 안 늘어난다.
{
  const sa = mk(['巳', '酉', '寅', '卯']);   // 년巳 ↔ 월酉 (인접)
  sa.interactions = detectInteractions(sa);
  check('반합은 **검출된다**(성립은 한다)', sa.interactions.some((i) => (i.detail ?? '').includes('半合')));
  check('반합은 강약 세력에 **안 보탠다**(000h#7 — 더 세지지 않는다)',
    scoreStrength(sa).breakdown.join(' ').includes('세력 0 · 버팀'));
  // 생 관계 반합(亥卯)도 마찬가지 — 종전엔 여기만 세력이 붙었다. 판정이 그것을 없앴다.
  const sb = mk(['亥', '卯', '寅', '寅']);
  sb.interactions = detectInteractions(sb);
  check('생 관계 반합(亥卯)도 세력이 안 붙는다(극/생 구분은 이 판정에 흡수)',
    !/반합:亥卯半合木[+-]\d/.test(scoreStrength(sb).breakdown.join(' ')));

  // ★후반부 — "극을 당해도 덜 흔들린다". 반합에 묶인 자리는 **충 손상이 면제**된다.
  //   ⚠️대조군을 짤 때 **계절 규칙(#14)에 먼저 걸리지 않게** 골라야 한다 — 첫 판이 그래서 무효였다.
  //     충하는 두 자리가 **둘 다 제 철이 아닌** 배치라야 "원래는 양쪽 손상"이 성립한다.
  //   배치: 월지 申(金) · 일子(水) ↔ 시午(火) 충 → 둘 다 金 이 아니므로 원래는 양쪽 손상.
  //         여기에 월申-일子 반합(水)을 얹으면 **일子 만 면제**되어야 한다.
  const held = mk(['寅', '申', '子', '午']);
  held.interactions = detectInteractions(held);
  const bdHeld = scoreStrength(held).breakdown.join(' ');
  check('반합에 묶인 일子 는 충 손상을 면제받는다(000h#7 후반부)', !bdHeld.includes('일子(충)'));
  check('대조군: 같은 충의 시午 는 반합에 안 묶여 그대로 손상(면제가 통째로 켜진 게 아니다)', bdHeld.includes('시午(충)'));
  // 대조군 ② — 반합 자체가 없으면 **양쪽 다** 손상(원래 동작이 살아 있다)
  const bare = mk(['寅', '寅', '子', '午']);
  bare.interactions = detectInteractions(bare);
  const bdBare = scoreStrength(bare).breakdown.join(' ');
  check('대조군: 반합이 없으면 양쪽 다 손상', bdBare.includes('일子(충)') && bdBare.includes('시午(충)'));
}

// ── 신살 일반화 (타 일간 차트 — 자기차트 n=1 넘어 규칙이 임의 차트에 일반 적용되는지) ──
function mkSaju(st: [Stem, Stem, Stem, Stem], br: [Branch, Branch, Branch, Branch]): SajuChart {
  const P: PillarPos[] = ['년', '월', '일', '시'];
  const pillars = {} as Record<PillarPos, any>;
  P.forEach((p, i) => { pillars[p] = { position: p, stem: st[i], branch: br[i], stemTenGod: '비견', branchMainTenGod: '비견', hiddenStems: [], isRoot: false }; });
  return { pillars, dayMaster: { stem: st[2], element: '木' }, interactions: [], luckCycles: [], currentLuck: {} as any, annual: {} as any } as SajuChart;
}
// ── 쟁합·쟁재 (`verify-000c-structure#7` · O) — verify-110 재현 ──
//   상담가: "같은 천간 2개가 하나의 천간과 동시에 합하면 쟁합으로 따로 판정 — 대상이 재성이면 쟁재"
//   명식 戊午 癸亥 戊戌 甲寅: 년간 戊·일간 戊 가 월간 癸(정재)를 동시에 합한다.
{
  const s = mkSaju(['戊', '癸', '戊', '甲'], ['午', '亥', '戌', '寅']);
  s.pillars['월'].stemTenGod = '정재';                        // 戊 일간에게 癸 = 정재
  const det = detectInteractions(s).map((i) => i.detail ?? '');
  check('쟁합 검출: 戊戊爭合癸 (000c#7)', det.some((d) => d.startsWith('戊戊爭合癸')));
  check('대상이 재성이면 쟁재 태깅', det.some((d) => d.includes('爭財(정재)')));
  // ★대조군 — 쟁합은 쌍 합 **위에 얹는 이름**이지 대체가 아니다(둘 다 남아야 한다)
  check('대조군: 쌍 단위 戊癸合 도 그대로 남는다', det.some((d) => d.includes('戊癸合化')));
  // ★음성 — 다투는 글자가 하나뿐이면 쟁합이 아니다
  const solo = mkSaju(['甲', '癸', '戊', '乙'], ['午', '亥', '戌', '寅']);
  check('음성: 戊 가 하나뿐이면 쟁합 아님', !detectInteractions(solo).some((i) => (i.detail ?? '').includes('爭合')));
}

console.log('=== 신살 일반화 (타 일간 차트 — n=1 넘어 규칙 일반화) ===');
{
  const rA = analyzeSinsal(mkSaju(['庚', '丙', '甲', '壬'], ['子', '午', '寅', '戌'])); // 일간 甲, 년지 子·일지 寅
  const rok = rA.sinsal.find((s) => s.name === '정록');
  check('甲 일간 정록=寅 (일지 적중)', rok?.glyphs[0] === '寅' && !!rok.hits.some((h) => h.pos === '일'));
  check('일지 寅 → 지살(일지 기준)', rA.twelve['일'].find((t) => t.bases.includes('일'))?.name === '지살');
  check('일지 寅 → 역마(년지 子 기준 ≠ 일지기준 = 전부 산출)', rA.twelve['일'].find((t) => t.bases.includes('년'))?.name === '역마');

  const rB = analyzeSinsal(mkSaju(['丙', '戊', '庚', '甲'], ['申', '子', '辰', '未'])); // 일간 庚
  const rokB = rB.sinsal.find((s) => s.name === '정록');
  check('庚 일간 정록=申 (년지 적중)', rokB?.glyphs[0] === '申' && !!rokB.hits.some((h) => h.pos === '년'));
  check('庚 천을귀인 未 적중(시지)', !!rB.sinsal.find((s) => s.name === '천을귀인')?.hits.some((h) => h.pos === '시'));
  check('일지 辰 → 화개(일지 기준)', rB.twelve['일'].find((t) => t.bases.includes('일'))?.name === '화개');
}

// ── 진태양시 보정 (경도차 + 균시차) — 시주가 보정으로 바뀌는지 ──
//   ※ 가공 인물 케이스(임의 날짜·시각·도시) — 공개 레포에 실존 출생정보(PII) 금지.
console.log('=== 진태양시 보정 (시계시 → 출생지 태양시) ===');
{
  const busan = (h: number, mi: number): ChartInput => ({ birthDateTime: `2001-06-15 ${h}:${mi}`, calendar: '양', timeAccuracy: '정확', sex: '여', birthPlace: '부산', birthLon: 129.08 });
  const off = trueSolarOffsetMin(busan(17, 30), 2001, 6, 15);
  check(`부산 2001-06-15 보정 ≈ -24분 (실측 ${off.toFixed(1)}분, 17:30→17:06)`, off < -21 && off > -27);
  check('17:30 부산 → 시지 酉 (보정 17:06, 酉시 유지)', buildSajuChart(busan(17, 30)).pillars['시'].branch === '酉');
  check('17:10 부산 → 시지 申 (보정 16:46 — 미보정이면 酉)', buildSajuChart(busan(17, 10)).pillars['시'].branch === '申');
}

// ── 표준자오선 시대보정 + 서머타임 (한국 표준시 변천 — 국가기록원·위키·IANA tzdata 교차확인) ──
console.log('=== 표준자오선 시대보정 · 서머타임 ===');
{
  check('자오선: 1954-03-20=135° → 03-21=127.5° (복귀일)', kstMeridianAt(1954, 3, 20) === 135 && kstMeridianAt(1954, 3, 21) === 127.5);
  check('자오선: 1961-08-09=127.5° → 08-10=135° (재변경일)', kstMeridianAt(1961, 8, 9) === 127.5 && kstMeridianAt(1961, 8, 10) === 135);
  check('자오선: 1908-04-01~1911=127.5° → 1912-01-01=135°', kstMeridianAt(1910, 6, 1) === 127.5 && kstMeridianAt(1912, 1, 1) === 135);
  check('DST 시각경계(1987): 5/10 01:59 OFF→02:00 ON / 10/11 02:59 ON→03:00 OFF',
    dstOffsetMin(1987, 5, 10, 1, 59) === 0 && dstOffsetMin(1987, 5, 10, 2, 0) === -60
    && dstOffsetMin(1987, 10, 11, 2, 59) === -60 && dstOffsetMin(1987, 10, 11, 3, 0) === 0);
  check('DST 자정경계(1955): 5/4 OFF→5/5 ON / 9/8 ON→9/9 OFF',
    dstOffsetMin(1955, 5, 4, 23, 59) === 0 && dstOffsetMin(1955, 5, 5, 0, 0) === -60
    && dstOffsetMin(1955, 9, 8, 23, 59) === -60 && dstOffsetMin(1955, 9, 9, 0, 0) === 0);
  const seoul = (dt: string): ChartInput => ({ birthDateTime: dt, calendar: '양', timeAccuracy: '정확', sex: '남', birthPlace: '서울', birthLon: 126.98 });
  // 같은 날짜(균시차 동일)의 1955 vs 1994 보정 차 = 자오선 30분 차이가 그대로 드러나야
  const off55 = trueSolarOffsetMin(seoul('1955-01-20 12:00'), 1955, 1, 20, 12, 0);
  const off94 = trueSolarOffsetMin(seoul('1994-01-20 12:00'), 1994, 1, 20, 12, 0);
  check(`127.5° 시대(1955) 서울 보정 ${off55.toFixed(1)}분 ↔ 135° 시대(1994) ${off94.toFixed(1)}분 = 정확히 30분 차`, Math.abs(off94 + 30 - off55) < 0.001);
  // 시주 영향: 1987-07-15 13:20 서울(DST 중) → −60(DST) −32(경도) −6(균시차) ≈ 11:42 → 午시
  check('1987-07-15 13:20 서울(DST) → 시지 午 (보정 ≈11:42 — DST 미반영이면 未)', buildSajuChart(seoul('1987-07-15 13:20')).pillars['시'].branch === '午');
}

// ── 야자시 = 자시일수설(감사 C2 · daniel 문파 확정 2026-07-26) ──────────────
// 확정 stance: **야자시/조자시를 구분하지 않는다** → 子시(23~01시)는 통째로 다음날.
// 고쳤던 모순: 라이브러리가 시주 천간은 다음날 일간 기준으로 내면서 일주는 자정 기준이라,
//   진태양시 23:22 출생이 `일주 庚申 + 시주 戊子` 로 나왔다(庚일 子시는 丙子, 戊子는 辛일 것).
// 불변식 ①(강함): **모든 시각에서 시주 천간은 일간의 오자둔법(五鼠遁) 값과 일치**한다.
//   → 일주와 시주가 서로 다른 날을 가리키면 반드시 깨진다.
// 불변식 ②: 23시 이후와 그 다음날 새벽 子시가 **같은 일주**를 가리킨다(자시일수설).
console.log('\n=== 야자시 = 자시일수설 (감사 C2 · 오자둔법 정합) ===');
{
  const STEMS10: Stem[] = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
  const BR12: Branch[] = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  // 오자둔 — 일간 → 子시 천간(甲己=甲 / 乙庚=丙 / 丙辛=戊 / 丁壬=庚 / 戊癸=壬)
  const ZI: Record<string, Stem> = { 甲: '甲', 己: '甲', 乙: '丙', 庚: '丙', 丙: '戊', 辛: '戊', 丁: '庚', 壬: '庚', 戊: '壬', 癸: '壬' };
  const at = (dt: string) => buildSajuChart({ birthDateTime: dt, calendar: '양', timeAccuracy: '정확', sex: '남', birthPlace: '서울', birthLon: 126.98 } as ChartInput, 2026);
  let mismatch = 0, tested = 0;
  // 여러 날짜 × 0~23시 전 시각에서 오자둔 정합 확인(야자시 경계가 어긋나면 여기서 깨진다)
  for (const day of ['1991-12-16', '1992-02-29', '2020-06-21', '1987-07-15']) {
    for (let hh = 0; hh <= 23; hh++) {
      const c = at(`${day} ${hh}:30`);
      const ilgan = c.pillars['일'].stem, sBranch = c.pillars['시'].branch, sStem = c.pillars['시'].stem;
      const want = STEMS10[(STEMS10.indexOf(ZI[ilgan]) + BR12.indexOf(sBranch)) % 10];
      tested++;
      if (want !== sStem) { mismatch++; if (mismatch <= 3) console.log(`     ↳ ${day} ${hh}:30 일간 ${ilgan} · 시지 ${sBranch} → 시주천간 ${sStem}(기대 ${want})`); }
    }
  }
  check(`오자둔법 정합 — ${tested}개 시각 전부 일간↔시주천간 일치(어긋나면 일주·시주가 다른 날을 가리킴)`, mismatch === 0);
  // 자시일수설: 23시대와 다음날 00시대가 같은 일주
  const a = at('1991-12-16 23:50'), b = at('1991-12-17 00:30');
  check('자시일수설 — 23시대와 다음날 00시대가 같은 일주(子시를 나누지 않음)',
    `${a.pillars['일'].stem}${a.pillars['일'].branch}` === `${b.pillars['일'].stem}${b.pillars['일'].branch}`);
  // 22시대(亥시)는 아직 당일이어야 한다(경계가 23시임을 고정)
  const p = at('1991-12-16 22:00');
  check('22시대(亥시)는 아직 당일 일주 — 경계는 23시', `${p.pillars['일'].stem}${p.pillars['일'].branch}` !== `${a.pillars['일'].stem}${a.pillars['일'].branch}`);
}

// ── 시각 미상 플래그(감사 H5 · 2026-07-26) ─────────────────────────────────
// 문제: 시각을 모르면 birthDateTime 이 '0:0' 으로 들어와 엔진이 **유령 子시 시주**를 만든다.
//   예전엔 엔진이 `timeAccuracy === '미상'` 을 알고도 버려서, 소비자들이 호출처마다
//   `{...c.saju, timeUnknown}` 로 다시 병합해야 했고 빠뜨린 곳은 가짜 시주를 실재처럼 계산했다.
// 불변식: 미상이면 SajuChart 가 **스스로** timeUnknown=true 를 들고 다닌다(소비자 병합 불필요).
console.log('\n=== 시각 미상 플래그 (감사 H5) ===');
{
  const mkc = (acc: '정확' | '미상') => buildSajuChart({ birthDateTime: '1991-12-16 0:0', calendar: '양', timeAccuracy: acc, sex: '남', birthPlace: '서울', birthLon: 126.98 } as ChartInput, 2026);
  check('시각 미상 → saju.timeUnknown === true (엔진이 정보를 버리지 않음)', mkc('미상').timeUnknown === true);
  check('시각 정확 → timeUnknown 없음(기존 소비자·저장본 하위호환)', !mkc('정확').timeUnknown);
}

// ── 생년월일 유효성(감사 H3/H4/H6 회귀 방지 · 2026-07-26) ───────────────────
// 버그였던 것: 입력 검증이 전혀 없어 **조용히 틀린 사주**가 나왔다 — 없는 날짜(2/30·월13)는 JS Date 가
//   롤오버해 그대로 팔자를 만들고, 없는 윤달은 음력→양력 변환 실패 후 *양력으로 폴백*했다.
// 불변식: 실재하는 날짜는 통과하고, 실재하지 않는 날짜는 반드시 문제로 잡힌다(윤년·실제 윤달 오탐 없이).
console.log('\n=== 생년월일 유효성 (감사 H3/H4/H6) ===');
{
  const v = (dt: string, extra: Record<string, unknown> = {}) =>
    validateBirthInput({ birthDateTime: dt, calendar: '양', timeAccuracy: '정확', sex: '남', birthPlace: '서울', ...extra } as ChartInput);
  // 통과해야 하는 것(오탐 금지 — 여기서 걸리면 정상 유저가 저장을 못 한다)
  check('정상 양력 1991-12-16 23:00 통과', v('1991-12-16 23:00').length === 0);
  check('시각 생략 허용(0시로 간주)', v('1991-12-16').length === 0);
  check('윤년 1992-02-29 통과', v('1992-02-29 10:00').length === 0);
  check('음력 정상 통과', v('1991-11-11 10:00', { calendar: '음' }).length === 0);
  check('실제 윤달(2020 윤4월) 통과', v('2020-04-11 10:00', { calendar: '음', isLeap: true }).length === 0);
  // 잡아야 하는 것
  check('없는 날 1991-02-30 차단(예전: 3/2 로 롤오버해 팔자 산출)', v('1991-02-30 10:00').length > 0);
  check('비윤년 1991-02-29 차단', v('1991-02-29 10:00').length > 0);
  check('월 13 차단(예전: 다음 해로 롤오버)', v('1991-13-05 10:00').length > 0);
  check('형식 불량 차단', v('abc').length > 0);
  check('시각 25시 차단', v('1991-12-16 25:00').length > 0);
  check('지원 범위 밖 연도(1800) 차단', v('1800-01-01 10:00').length > 0);
  check('없는 윤달(1991 윤11월) 차단(예전: 양력으로 조용히 폴백)', v('1991-11-11 10:00', { calendar: '음', isLeap: true }).length > 0);
}

// ── 절기 경계 = 북경시 기준(감사 C1 회귀 방지 · 2026-07-26) ─────────────────
// 버그였던 것: lunar-javascript 의 절입 시각은 **북경시(UTC+8)** 기준인데(lunar.js 절기 계산의
//   `ONE_THIRD = 8/24`), 엔진은 진태양시 보정한 한국 시계시를 그대로 넣어 비교 축이 어긋났다
//   → 월주가 절입 표기시각 +35~47분에 바뀜(정답 +60분) = **13~25분 일찍 전환**.
// 불변식: **월주는 "절입 표기시각 + 60분"(=KST 환산) 을 지나야 바뀐다.**
//   ※ 절입 초(秒)가 0이 아니면 그 분에는 아직 안 넘어가므로 +61분에 바뀐다(입춘 04:02:08 사례) — 둘 다 정답.
console.log('\n=== 절기 경계 타임존 (감사 C1 — 절입은 북경시 기준) ===');
{
  const Solar = (_lunar as any).Solar ?? (_lunar as any).default?.Solar;
  const table = Solar.fromYmd(2026, 6, 1).getLunar().getJieQiTable();
  for (const [term, city, lon] of [['立春', '서울', 126.98], ['立春', '부산', 129.08], ['清明', '서울', 126.98]] as const) {
    const jq = table[term];
    if (!jq) continue;
    const [Y, M, D, H, Mi, S] = [jq.getYear(), jq.getMonth(), jq.getDay(), jq.getHour(), jq.getMinute(), jq.getSecond?.() ?? 0];
    const monthGz = (min: number) => {
      const t = new Date(Y, M - 1, D, H, Mi + min, 0);
      const dt = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')} ${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
      const c = buildSajuChart({ birthDateTime: dt, calendar: '양', timeAccuracy: '정확', sex: '남', birthPlace: city, birthLon: lon } as ChartInput, 2026);
      return `${c.pillars['월'].stem}${c.pillars['월'].branch}`;
    };
    const flipAt = S > 0 ? 61 : 60;          // 절입 초가 남아 있으면 그 다음 분에 넘어간다
    check(`${term}/${city} — 절입표기+${flipAt - 1}분엔 아직 이전 월주, +${flipAt}분에 전환(북경시→KST 60분)`,
      monthGz(flipAt - 1) === monthGz(0) && monthGz(flipAt) !== monthGz(0));
    // 일찍 전환하던 예전 동작(+35~47분)이 되살아나면 잡힌다
    check(`${term}/${city} — 절입표기+45분엔 아직 안 바뀜(예전 버그: 13~25분 일찍 전환)`, monthGz(45) === monthGz(0));
  }
}

// ── 대운 전환 시점(감사 H1 off-by-one 회귀 방지 · 2026-07-26) ───────────────
// 버그였던 것: lunar-javascript 의 `getStartAge()` 는 **세는나이**(= startYear − birthYear + 1)인데
//   엔진은 연도차(`nowYear − birthYear`)와 비교해, 현재 대운이 **정확히 1년 늦게** 전환됐다.
//   → 대운이 바뀌는 해 1년 내내 직전 대운으로 통변('지금의 흐름' 오답). 연도 기준 판정으로 수정.
// 이 테스트가 지키는 불변식: **대운은 자기 startYear 가 되는 해에 즉시 전환된다**(그 전해엔 아직 이전 대운).
console.log('\n=== 대운 전환 시점 (감사 H1 — 나이 규약 off-by-one) ===');
{
  const subj = (dt: string, sex: '남' | '여'): ChartInput => ({ birthDateTime: dt, calendar: '양', timeAccuracy: '정확', sex, birthPlace: '서울', birthLon: 126.98 });
  // 케이스별로 '전환 연도'와 그 전해의 현재 대운을 비교 — 같으면 전환이 밀린 것(=버그 재발).
  for (const [dt, sex] of [['1991-12-16 23:00', '남'], ['2000-01-05 10:00', '여'], ['1987-07-15 13:20', '남']] as const) {
    const base = buildSajuChart(subj(dt, sex), 2026);
    const birthYear = Number(dt.slice(0, 4));
    // 표시용 startAge(세는나이)로부터 이 대운의 시작 연도를 역산 = startYear
    // ⚠️ 첫 대운(index 0)은 제외 — 입운 전에는 어떤 대운도 current 가 아니라 `luckCycles[0]` 로 폴백하는
    //    의도된 동작이라, '전해엔 아직 아님' 불변식이 성립하지 않는다(버그 아님).
    for (const lc of base.luckCycles.slice(1, 4)) {
      const startYear = birthYear + lc.startAge - 1;
      if (startYear <= birthYear) continue;
      const at = buildSajuChart(subj(dt, sex), startYear);       // 전환 해
      const before = buildSajuChart(subj(dt, sex), startYear - 1); // 그 전해
      const gz = (c: any) => `${c.currentLuck.stem}${c.currentLuck.branch}`;
      const want = `${lc.stem}${lc.branch}`;
      check(`${dt.slice(0, 10)} — ${startYear}년(${lc.startAge}세)에 ${want} 로 전환, ${startYear - 1}년엔 아직 아님`,
        gz(at) === want && gz(before) !== want);
    }
  }
}

// ── 조후 2축 조작화 (`verify-000d-johu#2`·`#3` · 2026-08-10) ────────────────
//   #3(X) *"지장간은 보지 않는다"* / #2(O) 주변=원국 여덟 글자 전부 + 코멘트 *"★대운도 봐야 한다"*
//   ★이 두 검사는 **서로 반대 방향**이다 — 하나는 "세면 안 되는 것"(지장간), 하나는 "세야 하는 것"(대운).
//     한쪽만 두면 "전부 0을 낸다"는 사고를 못 잡는다.
console.log('\n=== 조후 2축 조작화 (verify-000d-johu #2·#3) ===');
{
  // ① 지장간 제외 — 寅 의 지장간에는 丙(火)이 있지만 **드러난 글자로는** 조습에 아무 기여가 없어야 한다.
  //    (寅·卯 는 HUMID 표에 없고 천간 甲은 木이라 STEM_HUMID 에도 없다 ⇒ 정답은 정확히 0)
  const dry = mk(['寅', '寅', '卯', '寅']);
  check('지장간은 조습에 안 들어간다(寅 속 丙火 무시 · surround=0)', johu2(dry).joSeup.surround === 0);
  // 대조군 — 드러난 글자가 습하면 값이 **실제로 움직여야** 한다(위 0 이 '늘 0'이 아님을 보장)
  const wet = mk(['子', '子', '卯', '子']);
  check('대조군: 드러난 子(水) 셋은 조습을 민다(surround=3)', johu2(wet).joSeup.surround === 3);

  // ② 대운 포함 — 현재 대운 丙午(火·더움)는 한난에 +2(천간 火 +1 · 지지 午 +1)로 잡혀야 한다.
  const withLuck = mk(['寅', '寅', '卯', '寅']);
  const noLuck = johu2(withLuck).hanNan.surround;            // 대운 넣기 **전** surround 값
  (withLuck as any).currentLuck = { stem: '丙', branch: '午' };
  const j = johu2(withLuck);
  check('현재 대운 丙午 가 한난에 잡힌다(daeun=+2)', j.hanNan.daeun === 2);
  // 대조군 — 대운은 **surround 에 섞이지 않는다**(무게 미판정이라 따로 내기로 한 설계가 지켜지는지)
  check('대조군: 대운은 surround 에 섞이지 않는다(원국 값 불변)', j.hanNan.surround === noLuck);
  // 대운이 없는 차트는 0 — NaN 오염 회귀 방지
  check('대운이 비면 daeun=0 (NaN 오염 없음)', johu2(mk(['寅', '寅', '卯', '寅'])).hanNan.daeun === 0);
}

// ── 조후를 한 문장으로 (`verify-000h-magnitude#8`·`#9` · 둘 다 O · 2026-08-11) ────
//   `#8`(O) 두 축이 어긋나면 **월지(한난) 쪽을 따라** 부른다 · `#9`(O) 중화 = 기준도 주변도 안 치우침
//   ★임계값이 없는 구현인지도 함께 본다 — 기준(base)이 먼저, 없을 때만 주변(surround).
console.log('\n=== 조후 한 문장 (000h#8·#9) ===');
{
  // 월지 子(가장 참) · 일지 戌(마름) = `#8` 이 든 바로 그 예시(子月 戌日)
  const crossed = mk(['寅', '子', '戌', '寅']);
  const L1 = johuLabel(johu2(crossed));
  check(`子월 戌일 = 寒 + 燥 로 읽는다(#8 예시) [${L1.hanNan}${L1.joSeup}]`, L1.hanNan === '寒' && L1.joSeup === '燥');
  check('두 축이 서로 다른 쪽을 가리키면 crossed', L1.crossed);

  // 대조군 — 寒 + 濕 은 같은 결이라 crossed 가 아니다(늘 true 를 내지 않는다)
  const aligned = mk(['寅', '子', '子', '寅']);
  const L2 = johuLabel(johu2(aligned));
  check(`대조군: 子월 子일 = 寒 + 濕 은 어긋남이 아니다 [${L2.hanNan}${L2.joSeup}]`, !L2.crossed);

  // 중화 — 월지·일지가 치우치지 않은 자리(卯·酉)이고 주변도 한쪽으로 안 쏠릴 때
  //   ★`#9` 정의 그대로: 기준이 0 이면 주변이 정하고, 주변도 0 이면 중화.
  const neutral = mk(['卯', '卯', '酉', '酉']);
  const L3 = johuLabel(johu2(neutral));
  check(`치우치지 않은 자리 + 쏠리지 않은 주변 = 중화 [${L3.hanNan}${L3.joSeup}]`, L3.joSeup === '중화');
  check('중화가 끼면 어긋남으로 세지 않는다', !L3.crossed);

  // ★기준(월지)이 먼저다 — 주변이 반대로 쏠려 있어도 기준이 치우쳐 있으면 기준이 이름을 정한다(#8)
  const baseWins = mk(['午', '子', '午', '午']);   // 월지 子(寒) · 주변은 午 셋(暖)
  const L4 = johuLabel(johu2(baseWins));
  check(`기준(월지 子)이 주변(午 셋)을 이긴다 — 여전히 寒 [${L4.hanNan}]`, L4.hanNan === '寒');
}

// ── 애착 배우자성 **균형** 축 (`000e` 원문 + `000h#10·#11·#12·#13` · 2026-08-11) ──
//   `#11`(O) 감당 = **뿌리와 통관**(신강약 아님 — `#10` X)
//   `#10` 원문 *"일간의 힘과 재성의 힘이 **비슷해야 한다**. 한쪽이라도 강해지면 **강해진 만큼 문제**"*
//   `#12`(X) 갯수로 안 본다 · `#13`(O) 상대가 없어도 판정은 선다
console.log('\n=== 애착 배우자성 균형 축 (000e 원문 + 000h D) ===');
{
  const male = buildSajuChart({ birthDateTime: '1994-07-08 14:20', calendar: '양', timeAccuracy: '정확', sex: '남', birthPlace: '부산', birthLon: 129.03 } as ChartInput, 2026);
  const female = buildSajuChart({ birthDateTime: '2000-01-05 10:00', calendar: '양', timeAccuracy: '정확', sex: '여', birthPlace: '서울', birthLon: 126.98 } as ChartInput, 2026);
  const m = spouseCapacityAxis(male, '남');
  const f = spouseCapacityAxis(female, '여');
  check('남자 명식은 **정재**를 본다', m.target === '정재');
  check('여자 명식은 **정관**을 본다', f.target === '정관');
  // ★균형이 축이다 — 강약이 아니다
  check('감당 = 1 − |치우침| (균형이 축 · 000h#10 원문)',
    m.capacity === Math.round((1 - Math.abs(m.tilt)) * 100) / 100);
  check('치우침 = 일간 쪽 − 상대 쪽', m.tilt === Math.round((m.selfStand - m.objectLoad) * 100) / 100);
  check('범위: 균형 0~1 · 치우침 −1~+1', [m, f].every((a) =>
    a.capacity >= 0 && a.capacity <= 1 && a.tilt >= -1 && a.tilt <= 1));
  // ★신강약을 쓰지 않는다(`#10` X) — 득령·득지·득세 이름이 근거에 남아 있으면 실패
  check('★신강약(득령·득지·득세)을 근거로 쓰지 않는다(000h#10 X)', !/득령|득지|득세/.test(JSON.stringify(m.contributions)));
  check('근거는 뿌리·통관·상대 셋(000h#11 O)', m.contributions.length === 3
    && m.contributions.some((c) => c.key === 'root') && m.contributions.some((c) => c.key === 'bridge'));
  // ★유형을 선언하지 않는다 — '비슷하다'의 폭이 판정에 없다
  check('★유형(안정/회피/불안정)을 선언하지 않는다', ![m, f].some((a) =>
    Object.keys(a).some((k) => /type|verdict|label|유형/i.test(k))));
  check('★상대 자리 유무는 점수가 아니라 플래그로(000h#13)', typeof m.objectPresent === 'boolean');
  // 통관은 성별로 갈린다 — 남=식상 / 여=재성(상생 순서라 정의상 고정)
  check('통관이 성별로 갈린다(남=식상 · 여=재성)',
    /식상/.test(m.contributions.find((c) => c.key === 'bridge')!.label)
    && /재성/.test(f.contributions.find((c) => c.key === 'bridge')!.label));
  // 대조군 — 같은 명식도 성별이 바뀌면 보는 자리가 바뀐다
  const mAsF = spouseCapacityAxis(male, '여');
  check('대조군: 같은 명식도 성별이 바뀌면 값이 갈린다', mAsF.target === '정관' && mAsF.capacity !== m.capacity);
}

if (!ok) { console.log('\n❌ 정확도 게이트 실패 — 공식/테이블 점검'); process.exitCode = 1; }
else console.log('\n🎯 결정론 정확도 통과 — 12운성·공망·합충·신살·진태양시 일반화 확인');
