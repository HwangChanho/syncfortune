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
import { johu2 } from './johu2';
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
}

// ── 충의 세력 비교 (`verify-000c-structure#14` · O) — verify-103 재현 ──
//   상담가: "자수가 오화를 건들긴 하지만, **깨지못한다**" (子=년지 · 午=월지)
//   ⇒ 강한 쪽(월)은 뿌리 손상 없음 · 약한 쪽(년)만 손상. 동률(일·시)은 판정이 없어 양쪽 손상.
{
  const strong = mk(['子', '午', '巳', '巳']);          // 년子 ↔ 월午 (세력 1.5 vs 3.0)
  strong.interactions = detectInteractions(strong);
  const bd = scoreStrength(strong).breakdown.join(' ');
  check('충 세력: 午(월)는 子(년)에게 충 맞아도 안 깨진다(000c#14)', !bd.includes('월午(충)'));
  check('대조군: 약한 쪽 子(년)는 그대로 손상(충 처리 자체는 살아 있다)', bd.includes('년子(충)'));

  const tie = mk(['巳', '巳', '子', '午']);              // 일子 ↔ 시午 (세력 2.0 동률)
  tie.interactions = detectInteractions(tie);
  const bdTie = scoreStrength(tie).breakdown.join(' ');
  check('세력 동률(일·시)이면 판정이 없어 양쪽 손상(보수 유지)', bdTie.includes('일子(충)') && bdTie.includes('시午(충)'));
}

// ── 극 관계 반합은 성립하되 세력 0 (`verify-000g-power#4` · X) ──────────────
//   상담가: "반합은 **되는데**, 극의 에너지이므로 **커진다는 게 아님**"
//   ★검출과 세력을 가른다 — 합이 있다는 사실은 통변에 쓰이고, 힘은 안 늘어난다.
{
  const sa = mk(['巳', '酉', '寅', '卯']);   // 년巳 ↔ 월酉 (인접 · 火剋金)
  sa.interactions = detectInteractions(sa);
  const det = sa.interactions.map((i) => i.detail ?? '');
  check('巳酉 반합은 **검출된다**(성립은 한다)', det.some((d) => d.includes('半合')));
  const bd = scoreStrength(sa).breakdown.join(' ');
  check('巳酉 반합은 강약 세력에 **안 보탠다**(극이라 세력 0)', bd.includes('극이라 세력 0'));
  // 대조군 — 생 관계 반합(亥卯)은 세력이 그대로 붙어야 한다(둘 다 껐다는 사고 방지)
  const sb = mk(['亥', '卯', '寅', '寅']);
  sb.interactions = detectInteractions(sb);
  const bdB = scoreStrength(sb).breakdown.join(' ');
  check('대조군: 亥卯(생) 반합은 세력이 붙는다', /반합:亥卯半合木[+-]/.test(bdB));
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

// ── 애착 배우자성 감당 축 (`verify-000e-attach#13·14·15` 원문 반영 · 2026-08-10) ──
//   상담가: "남자는 **정재** 입장(여자는 **정관**), 일간이 **감당 가능하면 안정 / 어려우면 회피**,
//            안정이나 회피가 **극단으로 가면 불안정**"
//   ★이 검사가 지키는 것 = **판정에 있는 것만 구현했는가**. 특히 마지막 두 건이 핵심이다:
//     경계(임계값)를 안 만들었는가 · 무재/무관을 점수에 안 섞었는가.
console.log('\n=== 애착 배우자성 감당 축 (verify-000e-attach 원문) ===');
{
  const male = buildSajuChart({ birthDateTime: '1991-12-16 23:00', calendar: '양', timeAccuracy: '정확', sex: '남', birthPlace: '서울', birthLon: 126.98 }, 2026);
  const female = buildSajuChart({ birthDateTime: '2000-01-05 10:00', calendar: '양', timeAccuracy: '정확', sex: '여', birthPlace: '서울', birthLon: 126.98 }, 2026);
  const m = spouseCapacityAxis(male, '남');
  const f = spouseCapacityAxis(female, '여');
  check('남자 명식은 **정재**를 본다', m.target === '정재');
  check('여자 명식은 **정관**을 본다', f.target === '정관');
  // 감당 = 자립 − 부담. 두 성분이 실제로 축을 만드는지(상수를 반환하고 있지 않은지)
  check('감당 = 자립 − 부담 으로 계산된다', m.capacity === Math.round((m.selfStand - m.objectLoad) * 100) / 100);
  check('자립·부담 모두 0~1 · 감당은 −1~+1', [m, f].every((a) =>
    a.selfStand >= 0 && a.selfStand <= 1 && a.objectLoad >= 0 && a.objectLoad <= 1 && a.capacity >= -1 && a.capacity <= 1));
  // ★유형을 선언하지 않는다 — '극단'의 경계가 판정에 없다(000h D#12). 필드가 생기면 이 검사가 문다.
  check('★유형(안정/회피/불안정)을 선언하지 않는다(경계 미판정)', ![m, f].some((a) =>
    Object.keys(a).some((k) => /type|verdict|label|유형/i.test(k))));
  // ★무재/무관은 점수에 섞지 않고 **사실만** 낸다(000h D#13)
  check('★상대 자리 유무는 점수가 아니라 플래그로 낸다', typeof m.objectPresent === 'boolean');
  // 근거를 항상 함께 낸다(반증가능성) — 자립 3 + 부담 1
  check('근거 4항목(자립 3 · 부담 1)을 함께 낸다',
    m.contributions.filter((c) => c.side === '자립').length === 3 && m.contributions.filter((c) => c.side === '부담').length === 1);
  // 대조군 — 같은 명식이라도 성별이 바뀌면 **보는 자리가 바뀌므로** 값이 갈려야 한다(성별을 무시하고 있지 않은지)
  const mAsF = spouseCapacityAxis(male, '여');
  check('대조군: 같은 명식도 성별이 바뀌면 보는 자리가 바뀐다',
    mAsF.target === '정관' && (mAsF.objectLoad !== m.objectLoad || mAsF.target !== m.target));
}

if (!ok) { console.log('\n❌ 정확도 게이트 실패 — 공식/테이블 점검'); process.exitCode = 1; }
else console.log('\n🎯 결정론 정확도 통과 — 12운성·공망·합충·신살·진태양시 일반화 확인');
