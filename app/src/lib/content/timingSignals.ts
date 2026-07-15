// app/src/lib/content/timingSignals.ts — 무료 티저 '시기(timing)' 결정론 산출 **단일 출처**
// ─────────────────────────────────────────────────────────────────────────
// 왜 lib 로 모으나(daniel 2026-07-16 "홈이 나열만 되어 가시성이 떨어진다"):
//   같은 산출이 CrushTiming/ReunionTiming/JobTiming *컴포넌트 파일 안*에 각각 박혀 있어, 홈 카드 티저(homeTeaser)가
//   재사용할 수 없었다(= 홈에 올리려면 3중 복제가 되어 드리프트). 로직을 여기로 모아 **화면과 홈이 같은 값**을 쓰게 한다.
//
// ★이동만 했고 스탠스·로직은 한 줄도 바꾸지 않았다(CLAUDE.md §3.2 명리 발명 금지).
//   → 기존 화면(CrushTiming 등) 산출과 **동일해야 정상**이다. 달라지면 그건 회귀다.
//
// ▶ 스탠스 출처(daniel 인코딩 · 표준 통설):
//   · **재회** = 원국 도화(왕지 子午卯酉)의 **충 짝** 월(흔들어 깨움).
//   · **짝사랑** = **부처궁(일지) ↔ 월지 육합/반합(맺힘) · 충이 끼면 제외** (daniel 2026-07-16 재판정).
//     구 로직('4지지 도화 자체+충+합')은 실측 12달 중 10달 발동 = 변별력 0 이라 폐기 — 상세는 crushTiming JSDoc.
//     판정 함수는 `inyeonGauge.gungState` 재사용(재회·애정 게이지와 단일 기준).
//   · 취업 = 세운 천간 십신이 관성(일자리가 열림) 또는 인성(자격·시험·합격).
// ▶ 전부 결정론·동기·API 0. **한자·십신 용어는 이 모듈 밖으로 나가지 않는다**(문구는 호출부·i18n 소유).
// ─────────────────────────────────────────────────────────────────────────
import type { SajuChart, Branch, PillarPos, TenGod } from '@spec/chart';
// ★배우자궁(일지) 개폐 판정은 **재회·애정 게이지와 같은 함수**를 재사용한다(daniel 2026-07-16 일관성 지시:
//   "별도 로직으로 새로 짜면 재회/짝사랑 기준이 미묘하게 어긋나 유저가 두 기능을 비교했을 때 모순으로 보인다").
//   gungState = 충(열림)/육합·반합(맺힘)/형(마찰). 반합 컨벤션(같은 삼합국 + 한쪽이 왕지)도 그 모듈 것을 그대로 따른다.
import { gungState } from '../love/inyeonGauge';

// ── 표준 통설 테이블(engine·Edge 프롬프트와 동일 값) ──────────────────────────
const DOHWA: Branch[] = ['子', '午', '卯', '酉']; // 도화 = 왕지. 원국 지지에 깔린 것이 타고난 끌림의 기운.
const CHONG: [Branch, Branch][] = [['子', '午'], ['丑', '未'], ['寅', '申'], ['卯', '酉'], ['辰', '戌'], ['巳', '亥']]; // 6충 — 재회(도화의 충 짝)용
// ※ 육합·삼합 테이블은 여기서 보유하지 않는다 — 짝사랑 판정이 inyeonGauge.gungState(육합/반합 = 맺힘)로 이관됐다(단일 출처).
// 지지 → 월건(節氣) 월 번호: 寅월=1월 … 丑월=12월.
const BRANCH_MONTH: Record<Branch, number> = { 寅: 1, 卯: 2, 辰: 3, 巳: 4, 午: 5, 未: 6, 申: 7, 酉: 8, 戌: 9, 亥: 10, 子: 11, 丑: 12 };

/** 이 지지가 충하는 짝(없으면 null). */
const chongPartner = (b: Branch): Branch | null => {
  const p = CHONG.find(([x, y]) => x === b || y === b);
  return p ? (p[0] === b ? p[1] : p[0]) : null;
};
/**
 * 원국 도화 탐지 — 4지지(시각 미상이면 시주 제외) 중 왕지.
 * @param saju 본인 사주. timeUnknown 은 관례상 saju 에 병합돼 온다(SpecialContentScreen).
 */
function natalDohwaOf(saju: SajuChart): Branch[] {
  const timeUnknown = (saju as any)?.timeUnknown === true;
  const posList: PillarPos[] = timeUnknown ? ['년', '월', '일'] : ['년', '월', '일', '시']; // 시 미상 → 잘못된 timing 방지
  const natal = posList.map((p) => saju.pillars?.[p]?.branch).filter(Boolean) as Branch[];
  return DOHWA.filter((d) => natal.includes(d));
}

/**
 * 올해(현재 세운) 12 월운(流月) 배열을 안전 탐색.
 *   월운은 top-level saju.annual 엔 없을 수 있어(엔진), 현재 대운의 annuals[올해].months 에 들어있다.
 * @returns MonthPillar 유사 배열([]이면 월운 자료 없음)
 */
function currentYearMonths(saju: SajuChart): { stem?: string; branch?: Branch }[] {
  const annual: any = (saju as any).annual;
  if (Array.isArray(annual?.months) && annual.months.length) return annual.months;
  const curYear: number | undefined = annual?.year;
  for (const lc of ((saju as any).luckCycles ?? [])) {
    const a = (lc.annuals ?? []).find((x: any) => x.year === curYear);
    if (a?.months?.length) return a.months;
  }
  return [];
}

/** 월 단위 시기 산출 결과 — 문구 없이 사실만(호출부가 서술). */
export interface MonthTiming {
  year?: number;          // 올해(현재 세운) 연도. 엔진이 안 채웠으면 undefined(연도 발명 금지 → 표기 생략)
  months: number[];       // 발동 월(1~12·오름차순·중복 제거)
  hasNatalDohwa: boolean; // 원국에 도화가 있는가(리드 문구 분기용)
}

/**
 * 짝사랑 '매력·인연이 도는 달' — ★**부처궁(일지) 고정 앵커**(daniel 2026-07-16 재판정).
 *
 * **조건**: 월지 ↔ 일지(배우자궁)가 **육합 또는 반합(= 맺힘)** · **충이 끼면 제외**.
 *   판정은 `inyeonGauge.gungState` 를 **그대로 재사용**(재회·애정 게이지와 동일 함수 = 기준이 어긋날 수 없다).
 *   반합 컨벤션도 그 모듈의 기존 것(같은 삼합국 + 한쪽이 왕지 · ★daniel 검수)을 따른다.
 *
 * ▶ **구 로직 폐기 사유**(daniel 판정): 종전엔 **년·월·일·시 4지지 중 아무 데나** 도화가 있으면 그것의 자체/충/합을
 *   전부 발동으로 봤다 → daniel 차트 실측 **12달 중 10달 = 변별력 0**. 분해해 보니 원인은 셋이었다:
 *     ① 감정의 자리(부처궁)를 특정하지 않음 → "어떤 관계든 하나쯤은 항상 걸린다"(daniel)
 *     ② '월지 자체가 도화'는 원국과 무관하게 **누구에게나 같은 4달**(개인화가 아님)
 *     ③ 삼합이 도화 하나당 2달씩 확대
 *   또한 **충 배제만으로는 효과가 0**이었다(실측: 10달→10달). 충 짝이 이미 다른 경로로 걸리기 때문.
 *   daniel 스탠스: "짝사랑은 상호 균형이 아니라 한쪽만 상대를 향하는 구조 · 충이 끼면 밀당·갈등형이지 짝사랑형이 아니다".
 */
export function crushTiming(saju: SajuChart): MonthTiming {
  const dayB = saju.pillars?.['일']?.branch as Branch | undefined; // 일지 = 배우자궁(감정의 자리) = 고정 앵커
  const natalDohwa = natalDohwaOf(saju); // 발동 판정엔 쓰지 않는다 — 화면 리드 문구 분기용으로만 유지
  if (!dayB) return { year: (saju as any)?.annual?.year, months: [], hasNatalDohwa: !!natalDohwa.length };
  const monthSet = new Set<number>();
  currentYearMonths(saju).forEach((m) => {
    const b = m.branch;
    if (!b) return;
    const st = gungState(dayB, b);                          // 재회·애정과 동일 판정(단일 출처)
    if (st.bond && !st.open) monthSet.add(BRANCH_MONTH[b]); // 맺힘(육합/반합)만 · 충이 끼면 제외
  });
  return { year: (saju as any)?.annual?.year, months: [...monthSet].sort((a, b) => a - b), hasNatalDohwa: !!natalDohwa.length };
}

/**
 * 재회 '연락이 닿기 좋은 달' — 각 원국 도화의 **충 짝** 월지(그 달에 도화 발동).
 *   ★짝사랑과 달리 합은 쓰지 않는다(재회 스탠스 = 흔들어 깨우는 충).
 */
export function reunionTiming(saju: SajuChart): MonthTiming {
  const natalDohwa = natalDohwaOf(saju);
  const monthSet = new Set<number>();
  natalDohwa.forEach((d) => { const p = chongPartner(d); if (p) monthSet.add(BRANCH_MONTH[p]); });
  return { year: (saju as any)?.annual?.year, months: [...monthSet].sort((a, b) => a - b), hasNatalDohwa: !!natalDohwa.length };
}

// ── 취업·이직 ────────────────────────────────────────────────────────────
const GWAN: TenGod[] = ['정관', '편관'];   // 관성 = 일·자리(직장·취업·합격)의 기운
const INSEONG: TenGod[] = ['정인', '편인']; // 인성 = 자격·문서·시험·합격의 기운
const isGwan = (t?: TenGod): boolean => !!t && GWAN.includes(t);
const isIn = (t?: TenGod): boolean => !!t && INSEONG.includes(t);
const isGwanIn = (t?: TenGod): boolean => isGwan(t) || isIn(t);

/** 취업 유리 해의 결 — 'job'=일자리(관성) / 'cert'=자격·시험(인성). neutral key(문구는 호출부). */
export type JobKind = 'job' | 'cert';
export interface JobYear { year: number; kind: JobKind; }
export interface JobTimingResult {
  year?: number;           // 기준 '올해'(현재 세운 연도). 없으면 근미래 특정 불가 → years=[]
  years: JobYear[];        // 올해~+15년 중 유리한 해(가까운 순 최대 4개)
  luckIsGwanIn: boolean;   // 지금 대운 자체가 관성/인성인가(유리한 해가 없을 때 보조 안내)
}

/**
 * 취업·이직 '문이 열리는 해' — 모든 대운의 세운 중 **천간 십신이 관성/인성**인 해.
 *   엔진(engine/saju.ts)이 12대운 각각의 annuals 를 채우므로 연 단위 forward 스캔이 안정적이다.
 */
export function jobTiming(saju: SajuChart): JobTimingResult {
  const annual: any = (saju as any).annual;
  const curYear: number | undefined = annual?.year;
  const HORIZON = 15; // 너무 먼 미래(노년)까지 보여주지 않도록 근미래로 제한
  const yearMap = new Map<number, JobKind>(); // 연도 → 결(중복 연도는 첫 판정 유지)
  for (const lc of ((saju as any).luckCycles ?? [])) {
    for (const a of (lc.annuals ?? [])) {
      const yr: number | undefined = a?.year;
      if (yr == null) continue;
      // 기준 연도를 모르면 근미래를 특정할 수 없으니 비워서 폴백(엉뚱한 과거 연도 방지)
      if (curYear == null || yr < curYear || yr > curYear + HORIZON) continue;
      if (!isGwanIn(a.stemTenGod)) continue;
      if (!yearMap.has(yr)) yearMap.set(yr, isGwan(a.stemTenGod) ? 'job' : 'cert');
    }
  }
  const years = [...yearMap.entries()]
    .sort((x, y) => x[0] - y[0])
    .slice(0, 4) // 가까운 유리한 해 최대 4개(콕 집어)
    .map(([year, kind]) => ({ year, kind }));
  return { year: curYear, years, luckIsGwanIn: isGwanIn((saju as any)?.currentLuck?.stemTenGod) };
}
