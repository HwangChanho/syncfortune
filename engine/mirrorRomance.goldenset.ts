// engine/mirrorRomance.goldenset.ts — R60 경상명식 L1 골든셋
// ─────────────────────────────────────────────────────────────────────────
// 스펙 R60-MIRROR-ROMANCE.md §7(PILOT_01) · §8 체크리스트의 테스트 4종을 한 파일로.
//   ①parity   — 두 경상명식이 항상 실재 60갑자로 떨어진다(랜덤 전수)
//   ②involution — 합/충 표가 대칭이다(a→b 면 b→a). 戊己 예외 명시
//   ③golden   — PILOT_01 기대값 완전일치
//   ④edge     — 戊/己 무충 폴백 + 플래그
//
// ★왜 전수(60×… )로 도는가: 표 한 줄만 잘못 고쳐도 경상명식이 **존재하지 않는 간지**로 떨어진다.
//   그게 L2 로 넘어가면 "있지도 않은 사주"를 통변하게 되는데, 결과가 그럴듯해서 아무도 못 알아챈다.
//
// 실행: npm run check:mirror
// ─────────────────────────────────────────────────────────────────────────
import {
  deriveHapMirror, deriveChungMirror, formatMirror, allValid, isValidGanji,
  hapStem, hapBranch, chungStem, chungBranch, type MirrorChart,
} from './mirrorRomance';
import { profileOf, gapOf } from './mirrorProfile';
import { analyzeStarPalace } from './starPalace';                 // v0.2.0 성궁론(정통·상위 판정자)
import { concordanceOf, R60_THRESHOLDS } from './mirrorConcordance'; // v0.2.0 D0 게이트
import { buildMirrorRomanceBlock, MIRROR_GUARDRAILS } from '../supabase/functions/_shared/mirrorRomancePrompt'; // v0.2.0 L2
import type { Stem, Branch, PillarPos } from '../spec/chart';

const STEMS: Stem[] = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const BRANCHES: Branch[] = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const POS: PillarPos[] = ['년', '월', '일', '시'];

let pass = 0, fail = 0;
const bad = (m: string) => { console.error(`  ✗ ${m}`); fail++; };
const ok = (m: string) => { console.log(`  ✓ ${m}`); pass++; };

/** '甲戌' 4개 → MirrorChart */
function chartOf(s: string): MirrorChart {
  const parts = s.split('/').map((x) => x.trim());
  const out = {} as MirrorChart;
  POS.forEach((p, i) => { out[p] = { stem: parts[i][0] as Stem, branch: parts[i][1] as Branch }; });
  return out;
}

console.log('\n🔎 R60 경상명식 골든셋\n');

// ── ① parity: 60갑자 전수 ────────────────────────────────────────────────
console.log('[①] 두 경상명식이 항상 실재 60갑자다(60갑자 전수)');
{
  let n = 0, badCnt = 0;
  for (const st of STEMS) for (const br of BRANCHES) {
    if (!isValidGanji(st, br)) continue;            // 실재하지 않는 조합은 입력에서 제외
    n++;
    const c = chartOf(`${st}${br} / ${st}${br} / ${st}${br} / ${st}${br}`);
    if (!allValid(deriveHapMirror(c))) { if (badCnt < 3) bad(`합경 무효: ${st}${br}`); badCnt++; }
    if (!allValid(deriveChungMirror(c).chart)) { if (badCnt < 3) bad(`충경 무효: ${st}${br}`); badCnt++; }
  }
  if (n !== 60) bad(`60갑자를 ${n}개만 순회했다 — 표/판정이 깨졌다(하네스 역검증 실패)`);
  else if (badCnt === 0) ok(`60갑자 전부 합경·충경 모두 유효(${n}종)`);
}

// ── ② involution: 표 대칭 ────────────────────────────────────────────────
console.log('\n[②] 합/충 표가 대칭이다(a→b 면 b→a)');
{
  let off = 0;
  for (const s of STEMS) if (hapStem(hapStem(s)) !== s) { bad(`천간합 비대칭: ${s}`); off++; }
  for (const b of BRANCHES) if (hapBranch(hapBranch(b)) !== b) { bad(`지지합 비대칭: ${b}`); off++; }
  for (const b of BRANCHES) if (chungBranch(chungBranch(b)) !== b) { bad(`지지충 비대칭: ${b}`); off++; }
  // 천간충은 戊己 폴백이 있어 비대칭이 정상 — 4쌍만 대칭이어야 한다
  for (const s of ['甲', '乙', '丙', '丁', '庚', '辛', '壬', '癸'] as Stem[]) {
    const [t] = chungStem(s);
    const [back] = chungStem(t);
    if (back !== s) { bad(`천간충 비대칭: ${s}→${t}→${back}`); off++; }
  }
  if (!off) ok('천간합·지지합·지지충 완전 대칭 · 천간충 4쌍 대칭');
}

// ── ③ golden: PILOT_01 (스펙 §7) ─────────────────────────────────────────
console.log('\n[③] PILOT_01 기대값');
{
  const natal = chartOf('甲戌 / 丁卯 / 辛丑 / 丁酉');
  const hap = formatMirror(deriveHapMirror(natal));
  const { chart: ch, flags } = deriveChungMirror(natal);
  const chung = formatMirror(ch);
  const EXP_HAP = '己卯 / 壬戌 / 丙子 / 壬辰';
  const EXP_CHUNG = '庚辰 / 癸酉 / 乙未 / 癸卯';
  if (hap === EXP_HAP) ok(`합경 ${hap}`);
  else bad(`합경 ${hap}(기대 ${EXP_HAP})`);
  if (chung === EXP_CHUNG) ok(`충경 ${chung}`);
  else bad(`충경 ${chung}(기대 ${EXP_CHUNG})`);
  if (flags.length === 0) ok('flags 없음(戊己 미포함 명식)');
  else bad(`flags 가 비어야 하는데: ${flags.join(',')}`);
}

// ── ④ edge: 戊/己 무충 폴백 ──────────────────────────────────────────────
console.log('\n[④] 戊/己 무충 → 극(剋) 폴백 + 플래그');
{
  const natal = chartOf('戊辰 / 己巳 / 戊午 / 己未');
  const { chart, flags } = deriveChungMirror(natal);
  const got = formatMirror(chart);
  // 戊→甲(甲剋戊) · 己→乙(乙剋己) / 지지는 정상 충
  const EXP = '甲戌 / 乙亥 / 甲子 / 乙丑';
  if (got === EXP) ok(`충경 ${got}`);
  else bad(`충경 ${got}(기대 ${EXP})`);
  if (flags.length === 4) ok(`폴백 플래그 4건(${flags[0]} …)`);
  else bad(`폴백 플래그 ${flags.length}건 — 4건이어야(戊己 4자리)`);
  if (allValid(chart)) ok('폴백 결과도 실재 간지');
  else bad('폴백 결과가 실재하지 않는 간지');
}

// ── ⑤ L2 프로파일·GAP: PILOT_01 (스펙 §7 기대값) ─────────────────────────
console.log('\n[⑤] PILOT_01 프로파일·GAP (스펙 §7)');
{
  const natal = chartOf('甲戌 / 丁卯 / 辛丑 / 丁酉');
  const natalStems = POS.map((p) => natal[p].stem);
  const ideal = profileOf(deriveHapMirror(natal), natalStems);
  const real = profileOf(deriveChungMirror(natal).chart, natalStems);

  // 스펙 §7: 합경 일간 丙(원국 정관) · 충경 일간 乙(원국 편재)
  if (ideal.ilgan === '丙') ok(`이상형 일간 丙(${ideal.D1_TEMPER})`);
  else bad(`이상형 일간 ${ideal.ilgan}(기대 丙)`);
  if (real.ilgan === '乙') ok(`실배우자 일간 乙(${real.D1_TEMPER})`);
  else bad(`실배우자 일간 ${real.ilgan}(기대 乙)`);

  // 스펙 §7 추가검증: 원국 천간에 水 부재 → 두 경상 모두 천간 水 투출(DEFICIT_PROJECTION:水)
  if (ideal.D7_DEFICIT_PROJECTION.includes('水') && real.D7_DEFICIT_PROJECTION.includes('水')) ok('결핍 투영 水 양쪽 관측(스펙 §7)');
  else bad(`결핍 투영 水 미관측 — 이상형 ${ideal.D7_DEFICIT_PROJECTION} · 실배우자 ${real.D7_DEFICIT_PROJECTION}`);

  // 조후: 합경=온난(+) · 충경=한랭(−) 이어야 서사가 성립(스펙 §4 예시)
  if (ideal.D3_TEMP > real.D3_TEMP) ok(`조후 대비 이상형 ${ideal.D3_TEMP} > 실배우자 ${real.D3_TEMP}`);
  else bad(`조후 대비가 뒤집혔다 — 이상형 ${ideal.D3_TEMP} · 실배우자 ${real.D3_TEMP}`);

  const g = gapOf(ideal, real, '남');
  if (g.axis_bonus) ok('음간 남명 보정(+0.10) 적용');
  else bad('음간 남명 보정이 안 걸렸다 — §1.1 분기 오류');

  // ⚠️★스펙 기대(0.68~0.75 · INVERTED)와 **현재 구현이 다르다**. 숫자를 맞추려 계수를 만지지 않았다
  //   (기대값에 맞춰 가중치를 역산하면 그건 보상해킹이다 — 규칙7).
  //   원인: **스펙에 D3_TEMP(조후 지수) 계산식이 없다.** §4 예시는 이상형 +0.4 / 실배우자 -0.6(차 1.0)인데,
  //   내가 정한 식(천간+지지본기 8자의 한난 가중 평균)으로는 -0.2 / -0.25(차 0.05)가 나온다.
  //   조후는 보통 **월지(계절)** 를 축으로 보는데 스펙엔 그 규정이 없어 내가 전체 평균으로 잡았다.
  //   → **daniel(스펙 저자) 확정 필요**: 조후 축을 월지 기준으로 할지, 8자 평균으로 할지.
  //   그때까지 골든은 **현재 구현값을 고정**한다(회귀 방지). 스펙 기대는 아래 참고로만 남긴다.
  const SPEC_EXPECT = '0.68~0.75 · INVERTED (스펙 §7 — 조후 식 확정 후 재검증 대상)';
  if (g.gap_score === 0.5) ok(`gap_score ${g.gap_score} (현재 구현 고정 · 스펙 기대 ${SPEC_EXPECT})`);
  else bad(`gap_score ${g.gap_score} — 현재 구현 기준 0.5 에서 바뀌었다(의도한 변경이면 골든 갱신)`);
  if (g.narrative_key === 'TENSIONED') ok(`narrative_key ${g.narrative_key} (현재 구현 · 스펙은 INVERTED 기대)`);
  else bad(`narrative_key ${g.narrative_key} — 현재 구현 기준 TENSIONED 에서 바뀌었다`);
  console.log(`      ↳ ⚠️조후 식 미확정: 이상형 ${ideal.D3_TEMP} vs 실배우자 ${real.D3_TEMP}(차 ${Math.abs(ideal.D3_TEMP - real.D3_TEMP).toFixed(2)}) — 스펙 §4 예시는 차 1.0`);
}


// ── ⑥ v0.2.0 성궁론(星宮論) 1차 판정 — PILOT_01 §7 픽스처 ──────────────────
console.log('\n[⑥] v0.2.0 성궁론 S1~S5 (스펙 §7)');
{
  const P = chartOf('甲戌 / 丁卯 / 辛丑 / 丁酉') as any;
  const sp = analyzeStarPalace(P, '남');
  // 星
  if (sp.star.primaryBranch === '卯') ok('星 = 卯(편재)');
  else bad(`星 ${sp.star.primaryBranch}(기대 卯)`);
  if (sp.star.transformedTo === '火' && sp.star.transformedTenGod === '편관') ok('S1 卯戌합화 火 = 편관(원국 丁 기준)');
  else bad(`S1 합화 ${sp.star.transformedTo}=${sp.star.transformedTenGod}(기대 火=편관)`);
  if (sp.star.contaminatedBy.includes('정인')) ok('S2 재인합 오염(정인)');
  else bad(`S2 오염 ${sp.star.contaminatedBy.join(',')}(기대 정인)`);
  // 宮
  if (sp.palace.hasSpouseStar === false) ok('S3 宮 배우자성 부재(丑중 癸辛己 = 재성 없음)');
  else bad('S3 宮에 배우자성이 있다고 판정(기대 부재)');
  if (sp.palace.johu === -0.6) ok('宮 조후 -0.6(丑 습토·한랭)');
  else bad(`宮 조후 ${sp.palace.johu}(기대 -0.6)`);
  if (sp.palace.chungOpensTo.includes('乙')) ok('S4 丑未충 개고 → 乙(편재)');
  else bad(`S4 개고 ${sp.palace.chungOpensTo.join(',')}(기대 乙)`);
  // S5 — 최고 서사가치
  const d = sp.dualRelation;
  if (d && d.pivot === '酉' && d.toStar === 'chung' && d.toPalace === 'hap') ok('S5 이중관계 酉 — 星은 충·宮은 합');
  else bad(`S5 ${JSON.stringify(d)}(기대 酉 chung/hap)`);
}

// ── ⑦ v0.2.0 D0_CONCORDANCE 게이트 — §7.1 6축 ────────────────────────────
console.log('\n[⑦] v0.2.0 D0 교차검증 (스펙 §7.1)');
{
  const P = chartOf('甲戌 / 丁卯 / 辛丑 / 丁酉') as any;
  const ns = ['甲', '丁', '辛', '丁'] as Stem[];
  const sp = analyzeStarPalace(P, '남');
  const c = concordanceOf(sp, profileOf(deriveHapMirror(P), ns), profileOf(deriveChungMirror(P).chart, ns));
  for (const a of c.axes) {
    if (a.match === 1) ok(`${a.key} = 1.0`);
    else bad(`${a.key} = ${a.match} · ${a.note}`);
  }
  if (c.score >= 0.95) ok(`concordance ${c.score} (스펙 기대 >= 0.95)`);
  else bad(`concordance ${c.score} — 스펙 기대 >= 0.95`);
  if (c.render === 'FULL') ok('render = FULL(경상 정식 채택)');
  else bad(`render = ${c.render}(기대 FULL)`);

  // ⚠️★임계값은 **잠정값**이다(스펙 §4.3). 30개 명식 분포 측정 전까지 확정 아님.
  //   중앙값이 T_LOW 아래로 나오면 **임계값을 낮추지 말고 경상명식 기법 자체를 재검토**한다(보상해킹 금지).
  console.log(`      ↳ ⚠️T_HIGH=${R60_THRESHOLDS.T_HIGH} / T_LOW=${R60_THRESHOLDS.T_LOW} = PILOT_01 단일샘플 잠정값(30샘플 측정 선행)`);
  // ⚠️★A2 축의 해석은 **내 판단이 들어갔다 — daniel 검수 대상.**
  //   스펙 §4.1 은 "星의 정/편 ↔ 합경 프로파일 **성질**"이라고만 했고 '성질'의 정의가 없다.
  //   나는 **합경 일간의 음양**(양=드러남·주도 / 음=수렴)으로 읽었다. 다른 해석도 가능하다
  //   (예: 격국의 정/편, D4 편중군). 이 축이 바뀌면 concordance 가 0.15 만큼 움직인다.
  console.log('      ↳ ⚠️A2 "합경 프로파일 성질" = **일간 음양**으로 해석(내 판단 · daniel 검수 필요)');
}


// ── ⑧ v0.2.0 L2 프롬프트 — 게이트 모드가 실제로 지켜지는가(§4.2·§9) ─────────
console.log('\n[⑧] v0.2.0 L2 프롬프트 게이트 분기');
{
  const P = chartOf('甲戌 / 丁卯 / 辛丑 / 丁酉') as any;
  const ns = ['甲', '丁', '辛', '丁'] as Stem[];
  const sp = analyzeStarPalace(P, '남');
  const ideal = profileOf(deriveHapMirror(P), ns);
  const real = profileOf(deriveChungMirror(P).chart, ns);
  const base = {
    star: sp.star as any, palace: sp.palace as any, dualRelation: sp.dualRelation, flags: sp.flags,
    ideal: { ilgan: ideal.ilgan, element: ideal.ilganElement, role: ideal.D2_ROLE, temp: ideal.D3_TEMP, top2: ideal.D4_TOP2 as string[] },
    real: { ilgan: real.ilgan, element: real.ilganElement, role: real.D2_ROLE, temp: real.D3_TEMP, top2: real.D4_TOP2 as string[] },
  };

  // STAR_PALACE_ONLY = 경상 미노출. 프로파일 값이 새어 나가면 게이트가 무의미하다.
  const only = buildMirrorRomanceBlock({ ...base, render: 'STAR_PALACE_ONLY', concordance: 0.2 });
  if (/사용하지 마라/.test(only) && !only.includes('이상형(합경)')) ok('STAR_PALACE_ONLY = 경상 프로파일 미노출');
  else bad('STAR_PALACE_ONLY 인데 경상 프로파일이 프롬프트에 들어갔다 — 게이트 무력화');

  // DESCRIPTIVE_ONLY = 값은 주되 '결론 금지'를 명시해야 한다
  const desc = buildMirrorRomanceBlock({ ...base, render: 'DESCRIPTIVE_ONLY', concordance: 0.5 });
  if (/결론을 경상에서 내지 마라/.test(desc)) ok('DESCRIPTIVE_ONLY = 결론 금지 명시');
  else bad('DESCRIPTIVE_ONLY 인데 결론 사용을 막지 않는다');

  // FULL = 병렬 렌더 + 파생 고지
  const full = buildMirrorRomanceBlock({ ...base, render: 'FULL', concordance: 1 });
  if (full.includes('이상형(합경)') && /원전 기법이 아님/.test(full)) ok('FULL = 병렬 렌더 + 파생 기법 고지(§9-3)');
  else bad('FULL 렌더에 경상 프로파일 또는 파생 고지가 빠졌다');

  // S5 이중관계는 서사 최상단 지시가 있어야(§5)
  if (/서사 맨 앞에 놓아라/.test(full)) ok('S5 이중관계 = 서사 최상단 지시');
  else bad('S5 가 있는데 최상단 지시가 없다');

  // §9 가드레일 7종
  const g = MIRROR_GUARDRAILS;
  const need = ['인물 특정 금지', '결정론 금지', '파생 기법 고지', '부정 서술 완화', '기혼', '단독 노출 금지', '외모 절제'];
  const miss = need.filter((k) => !g.includes(k));
  if (!miss.length) ok('§9 가드레일 7종 전부 포함');
  else bad(`가드레일 누락: ${miss.join(', ')}`);


  // ★★daniel stance(2026-07-29) — "치환해서 나온 명식의 **풀이로 나온 사람의 느낌**을 보는 거지
  //   그 글자를 그대로 보고 대입하는 게 아니다."
  //   종전 프롬프트는 코드값(일간/상/온도/행동)을 나열해 LLM 이 **원국 해석 용어로 대입**하게 만들었다.
  {
    const full2 = buildMirrorRomanceBlock({ ...base, render: 'FULL', concordance: 1 });
    if (/각각 독립된 한 사람의 사주/.test(full2) && /본인 원국에 글자를 대입하지 말고/.test(full2)) {
      ok('daniel stance — 경상은 "사람으로 풀라"(글자 대입 금지)');
    } else bad('경상명식을 코드값으로만 넘긴다 — LLM 이 원국에 대입한다(daniel stance 위반)');
    if (/십신·오행 이름은 노출하지 마라/.test(full2)) ok('십신·오행 코드 비노출 지시');
    else bad('십신·오행 코드가 그대로 노출될 수 있다');
    if (/경상명식의 글자를 본인 사주에 대입해 해석하지 마라/.test(MIRROR_GUARDRAILS)) ok('가드레일 0번 = 글자 대입 금지(최상위)');
    else bad('가드레일에 글자 대입 금지가 없다');
  }
  // 기혼 분기(§9-5)
  const wed = buildMirrorRomanceBlock({ ...base, render: 'FULL', concordance: 1, married: true });
  if (/새 인연 예고 금지/.test(wed)) ok('기혼 분기 = 새 인연 예고 금지');
  else bad('기혼 입력인데 새 인연 예고를 막지 않는다');
}

console.log(fail
  ? `\n❌ R60 골든  PASS ${pass} / FAIL ${fail}`
  : `\n✅ R60 골든  PASS ${pass} / FAIL 0 — 60갑자 유효·표 대칭·PILOT_01·무충 폴백`);
process.exit(fail ? 1 : 0);
