// engine/verify-engine.ts — 결정론 *정확도* 게이트 (공식 산출 ↔ 알려진 명리 정답)
// ─────────────────────────────────────────────────────────────────────────
// 12운성(양간 순행·음간 역행)·공망(순중공망) 같은 '공식' 산출이 명리 표준값과 일치하는지 교차검증.
//   테이블 오류·역행 방향 실수를 게이트로 차단. (신살 매핑은 고정 테이블이라 부차 — run-sinsal로 확인.)
// 실행: npm run verify:engine
// ─────────────────────────────────────────────────────────────────────────
import _lunar from 'lunar-javascript';
import { twelveStage } from './twelve';
import { gongmang, analyzeSinsal } from './sinsal';
import { detectInteractions } from './structure';
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
  // ⚠️대조군 — 거리 조건은 **합에만**. 충·형·해·파는 `#4`(△)라 확정이 아니고,
  //   실측상 확대하면 daniel 차트 판정이 정답에서 멀어진다(structure.ts adjacentPair 주석).
  const farChung = detectInteractions(mk(['子', '巳', '巳', '午'])).map((i) => i.detail);
  check('대조군: 子(년)午(시) 충은 거리 무관하게 그대로 검출(#4 는 미적용)', farChung.some((d) => d.includes('子午冲')));
}

// ── 신살 일반화 (타 일간 차트 — 자기차트 n=1 넘어 규칙이 임의 차트에 일반 적용되는지) ──
function mkSaju(st: [Stem, Stem, Stem, Stem], br: [Branch, Branch, Branch, Branch]): SajuChart {
  const P: PillarPos[] = ['년', '월', '일', '시'];
  const pillars = {} as Record<PillarPos, any>;
  P.forEach((p, i) => { pillars[p] = { position: p, stem: st[i], branch: br[i], stemTenGod: '비견', branchMainTenGod: '비견', hiddenStems: [], isRoot: false }; });
  return { pillars, dayMaster: { stem: st[2], element: '木' }, interactions: [], luckCycles: [], currentLuck: {} as any, annual: {} as any } as SajuChart;
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

if (!ok) { console.log('\n❌ 정확도 게이트 실패 — 공식/테이블 점검'); process.exitCode = 1; }
else console.log('\n🎯 결정론 정확도 통과 — 12운성·공망·합충·신살·진태양시 일반화 확인');
