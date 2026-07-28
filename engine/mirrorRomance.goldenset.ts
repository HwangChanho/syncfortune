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

console.log(fail
  ? `\n❌ R60 골든  PASS ${pass} / FAIL ${fail}`
  : `\n✅ R60 골든  PASS ${pass} / FAIL 0 — 60갑자 유효·표 대칭·PILOT_01·무충 폴백`);
process.exit(fail ? 1 : 0);
