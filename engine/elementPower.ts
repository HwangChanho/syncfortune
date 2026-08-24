// engine/elementPower.ts — 오행 세력(강약) 2모드: 합화 반영 · 조후(왕상휴수)+궁성 보정
// ═══════════════════════════════════════════════════════════════════════════
// daniel 2026-08-05: "만세력에서 ①합에 따른 오행 변화 적용 ②조후와 궁성 보정값 적용
//                     두 가지를 선택해서 오행 강약을 두 가지 버전으로 볼 수 있게" + "어떤 오행이 발달했는지도"
//
// ■ 발명 0 원칙(§3.3) — 판정은 기존 엔진 재사용, 새로 들어온 것은 '계수'뿐
//   · 합화 성립 = detectInteractions 의 transformsTo + **transformSupported**(化오행 천간 투출 = R1 1차판정)를
//     그대로 쓴다. ⚠️성립 판정이 없는 합(반합·천간합)은 化 적용하지 **않는다** — 지어내지 않는다.
//   · 궁성 보정 = scoreStrength 의 POS_WEIGHT 와 같은 사상(월령 최대). 값도 동일하게 둔다.
//   · 조후 보정 = 왕상휴수사(旺相休囚死) 통설 표(월지 계절 기준). **계수 값은 ★daniel 조정 슬롯**
//     (GUK_BONUS 관례) — 표 자체는 교과서 통설이라 구조만 싣고, 세기는 검수로 확정한다.
//   · 발달/과다/부재 = 개수 통설(3=발달·4+=과다·0=부재). **임계도 ★daniel 조정 슬롯**.
//
// ■ 재료 범위: 천간 4 + 지지 본기 4 (시각 미상이면 3주 — scoreStrength 와 동일 규칙).
//   지장간 여기·중기까지 섞는 가중은 문파 갈림이 커서 v1 제외(요청 시 daniel 판정으로 확장).
// ═══════════════════════════════════════════════════════════════════════════
import type { SajuChart, Element, Stem, Branch, PillarPos } from '../spec/chart';

const STEM_ELEM: Record<Stem, Element> = { 甲:'木',乙:'木',丙:'火',丁:'火',戊:'土',己:'土',庚:'金',辛:'金',壬:'水',癸:'水' };
const BRANCH_MAIN_S: Record<Branch, Stem> = { 子:'癸',丑:'己',寅:'甲',卯:'乙',辰:'戊',巳:'丙',午:'丁',未:'己',申:'庚',酉:'辛',戌:'戊',亥:'壬' };
/** 궁성(자리) 가중 — scoreStrength 의 POS_WEIGHT 와 동일 값(월령 최대 · ★조정 슬롯 공유) */
const GUNG_WEIGHT: Record<PillarPos, number> = { 월: 3, 일: 2, 시: 2, 년: 1.5 };
/** 천간은 '드러난 기운' — 지지(뿌리)보다 가볍게. scoreStrength 의 간:지 비율 사상과 맞춤(★조정 슬롯) */
const STEM_W = 1;

/** 월지 → 계절(당령 오행). 辰戌丑未 = 土王 절기(통설). */
const SEASON_ELEM: Record<Branch, Element> = {
  寅:'木', 卯:'木', 辰:'土', 巳:'火', 午:'火', 未:'土', 申:'金', 酉:'金', 戌:'土', 亥:'水', 子:'水', 丑:'土',
};
/**
 * 왕상휴수사 계수 — 월지 계절 기준 오행 상태(통설 표).
 *   旺(당령)=계절 그 자체 / 相=계절이 생하는 오행 / 休=계절을 생한 오행 / 囚=계절을 극하는 오행 / 死=계절이 극하는 오행
 * ★계수 '값'은 daniel 검수 슬롯 — 순서(旺>相>休>囚>死)만 통설이고 간격은 문파 조정 영역.
 */
const WANG_COEF = { 旺: 1.4, 相: 1.2, 休: 1.0, 囚: 0.8, 死: 0.6 } as const;
const SHENG_TO: Record<Element, Element> = { 水:'木', 木:'火', 火:'土', 土:'金', 金:'水' };
const KE_TO: Record<Element, Element> = { 木:'土', 土:'水', 水:'火', 火:'金', 金:'木' };

/** 월지 계절 기준 각 오행의 왕상휴수사 상태 */
export function wangStateOf(monthBranch: Branch, el: Element): keyof typeof WANG_COEF {
  const season = SEASON_ELEM[monthBranch];
  if (el === season) return '旺';
  if (SHENG_TO[season] === el) return '相';
  if (SHENG_TO[el] === season) return '休';
  if (KE_TO[el] === season) return '囚';
  return '死';
}

export type ElementPowerOpts = {
  /** 합에 따른 오행 변화(化) 적용 — 성립 판정(transformSupported)된 지지합만 */
  hap: boolean;
  /** 조후(왕상휴수)+궁성(자리 가중) 보정 적용 */
  johuGung: boolean;
  /**
   * ★**운의 간지를 함께 센다**(Boss 2026-08-25 *"대운 세운별로 선택해서 확인"*).
   *
   * 원국 네 자리 뒤에 대운·세운을 **덧붙여** 같은 식으로 센다.
   * ⚠️궁성 가중은 주지 않는다(자리 가중은 년월일시의 것이다) — 운은 **가중 1**로 센다.
   *   조후 계수는 그대로 적용한다(월령은 원국 월지 기준이라 운에도 같이 걸린다).
   * ⚠️합화(`hap`)는 **원국끼리만** 본다 — 운과의 합은 엔진에 성립 판정이 없어 지어내지 않는다.
   * ⚠️발달/과다/부재 라벨은 **원국 글자 수로만** 낸다 — 운은 10년·1년짜리라
   *   "타고난 것"을 말하는 라벨을 흔들면 안 된다.
   */
  extra?: { label: string; stem: Stem; branch: Branch }[];
};

export type ElementPowerResult = {
  /** 오행별 세력치(옵션 반영). 옵션 둘 다 꺼지면 = 글자 가중 1·계수 1(사실상 개수와 같은 비율) */
  power: Record<Element, number>;
  /** 합계(% 환산용) */
  total: number;
  /** 발달 판정 — 개수 통설 기준(글자 수·옵션 무관): 4+=과다 · 3=발달 · 0=부재 (★임계 = daniel 조정 슬롯) */
  labels: Partial<Record<Element, '과다' | '발달' | '부재'>>;
  /** 무엇이 어떻게 보정됐는지(투명성 — UI 가 그대로 보여줄 수 있게) */
  notes: string[];
};

/**
 * 오행 세력 산출(2모드 토글).
 * @param saju 원국(시각 미상이면 3주만 — scoreStrength 와 동일)
 * @param opts hap=합화 반영 / johuGung=조후·궁성 보정
 */
export function elementPower(saju: SajuChart, opts: ElementPowerOpts): ElementPowerResult {
  const noHour = (saju as { timeUnknown?: boolean }).timeUnknown === true;
  const POS: PillarPos[] = noHour ? ['년', '월', '일'] : ['년', '월', '일', '시'];
  const notes: string[] = [];

  // ── 합화 재배정 맵: 자리별 지지 오행을 化오행으로 교체(성립분만) ──────────
  //   대상 = 지지 레벨 합 && transformsTo && transformSupported(化오행 천간 투출).
  //   반합(성립판정 없음)·천간합(성립판정 없음)은 제외 — 엔진에 없는 판정을 지어내지 않는다.
  const hapTo = new Map<PillarPos, Element>();
  if (opts.hap) {
    for (const it of saju.interactions ?? []) {
      if (it.type !== '합' || it.level === '천간') continue;
      if (!it.transformsTo || !(it as { transformSupported?: boolean }).transformSupported) continue;
      if (!it.members.every((m: string) => (POS as string[]).includes(m))) continue; // 원국끼리만
      for (const m of it.members) hapTo.set(m as PillarPos, it.transformsTo);
      notes.push(`합화: ${it.detail} → ${it.members.join('·')} 지지를 ${it.transformsTo}로`);
    }
    if (!hapTo.size) notes.push('합화: 성립(화기 투출)된 합 없음 — 변화 없음');
  }

  const power: Record<Element, number> = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
  const counts: Record<Element, number> = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
  const monthBranch = saju.pillars['월'].branch;

  for (const p of POS) {
    const stemEl = STEM_ELEM[saju.pillars[p].stem];
    const rawBranchEl = STEM_ELEM[BRANCH_MAIN_S[saju.pillars[p].branch]];
    const branchEl = hapTo.get(p) ?? rawBranchEl;                     // 합화 재배정(성립분만)
    counts[stemEl] += 1; counts[rawBranchEl] += 1;                    // 발달 판정은 '타고난 글자 수' 기준(보정 무관)

    // 궁성 가중(자리) — 꺼져 있으면 1
    const gw = opts.johuGung ? GUNG_WEIGHT[p] : 1;
    // 조후(왕상휴수) — 꺼져 있으면 1
    const sCoef = opts.johuGung ? WANG_COEF[wangStateOf(monthBranch, stemEl)] : 1;
    const bCoef = opts.johuGung ? WANG_COEF[wangStateOf(monthBranch, branchEl)] : 1;

    power[stemEl] += STEM_W * sCoef * (opts.johuGung ? Math.min(gw, 2) : 1); // 천간엔 궁성 절반 사상(지지=뿌리가 주역 · ★조정 슬롯)
    power[branchEl] += gw * bCoef;
  }

  // ── 운(대운·세운) 덧붙이기 — 위와 **같은 식**을 쓴다(따로 계산하지 않는다) ──
  for (const e of opts.extra ?? []) {
    const stemEl = STEM_ELEM[e.stem];
    const branchEl = STEM_ELEM[BRANCH_MAIN_S[e.branch]];
    // ⚠️`counts` 에는 **안 넣는다** — 발달/과다/부재는 타고난 글자 수로만 판정한다
    const sCoef = opts.johuGung ? WANG_COEF[wangStateOf(monthBranch, stemEl)] : 1;
    const bCoef = opts.johuGung ? WANG_COEF[wangStateOf(monthBranch, branchEl)] : 1;
    power[stemEl] += STEM_W * sCoef;   // 궁성 가중 없음(자리 가중은 년월일시의 것)
    power[branchEl] += bCoef;
    notes.push(`${e.label} ${e.stem}${e.branch} 포함 — 궁성 가중 없이 1로 셈`);
  }
  if (opts.johuGung) notes.push(`조후: 월지 ${monthBranch}(${SEASON_ELEM[monthBranch]}령) 왕상휴수 계수 · 궁성: 월${GUNG_WEIGHT['월']}·일${GUNG_WEIGHT['일']}·시${GUNG_WEIGHT['시']}·년${GUNG_WEIGHT['년']}`);

  const total = (Object.values(power) as number[]).reduce((a, b) => a + b, 0) || 1;

  // 발달/과다/부재 — 글자 개수 통설(★임계 조정 슬롯: 4+/3/0)
  const labels: ElementPowerResult['labels'] = {};
  (Object.keys(counts) as Element[]).forEach((el) => {
    if (counts[el] >= 4) labels[el] = '과다';
    else if (counts[el] === 3) labels[el] = '발달';
    else if (counts[el] === 0) labels[el] = '부재';
  });

  return { power, total, labels, notes };
}
