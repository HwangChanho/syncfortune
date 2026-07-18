// engine/saju.ts — WS1 사주 L1 엔진: ChartInput → SajuChart (결정론)
// ─────────────────────────────────────────────────────────────────────────
// 분업:
//   · 팔자·대운·세운 간지   = lunar-javascript (실검증으로 골든 일치 확인, ADR-008)
//   · 지장간·십신·통근       = 우리 결정론 로직(골든 학설 표준표) — lunar-js 지장간은 卯/酉 여기 누락
//   · 합충형해·structure_dx  = WS3(Encoded Expert Layer) 영역 → 여기선 비움([]/미설정)
// ─────────────────────────────────────────────────────────────────────────
import _lunar from 'lunar-javascript';
import type {
  ChartInput, SajuChart, PillarData, PillarPos, Stem, Branch, TenGod, HiddenStem, Element, LuckCycle, AnnualPillar, MonthPillar,
} from '../spec/chart';
import { trueSolarOffsetMin } from './solartime';

const Lunar: any = _lunar;
const Solar = Lunar.Solar;

// ── 명리 상수 ──
const STEM_ELEM: Record<Stem, Element> = { 甲:'木',乙:'木',丙:'火',丁:'火',戊:'土',己:'土',庚:'金',辛:'金',壬:'水',癸:'水' };
const STEM_YANG: Record<Stem, boolean> = { 甲:true,乙:false,丙:true,丁:false,戊:true,己:false,庚:true,辛:false,壬:true,癸:false };
const BRANCH_MAIN: Record<Branch, Stem> = { 子:'癸',丑:'己',寅:'甲',卯:'乙',辰:'戊',巳:'丙',午:'丁',未:'己',申:'庚',酉:'辛',戌:'戊',亥:'壬' };

// 지장간 표준표 (여기 → 중기 → 본기). 골든 학설 기준(卯=甲乙, 酉=庚辛 포함).
export const HIDDEN: Record<Branch, { stem: Stem; role: HiddenStem['role'] }[]> = {
  子: [{ stem:'癸', role:'본기' }],
  丑: [{ stem:'癸', role:'여기' }, { stem:'辛', role:'중기' }, { stem:'己', role:'본기' }],
  寅: [{ stem:'戊', role:'여기' }, { stem:'丙', role:'중기' }, { stem:'甲', role:'본기' }],
  卯: [{ stem:'甲', role:'여기' }, { stem:'乙', role:'본기' }],
  辰: [{ stem:'乙', role:'여기' }, { stem:'癸', role:'중기' }, { stem:'戊', role:'본기' }],
  巳: [{ stem:'戊', role:'여기' }, { stem:'庚', role:'중기' }, { stem:'丙', role:'본기' }],
  午: [{ stem:'丙', role:'여기' }, { stem:'己', role:'중기' }, { stem:'丁', role:'본기' }],
  未: [{ stem:'丁', role:'여기' }, { stem:'乙', role:'중기' }, { stem:'己', role:'본기' }],
  申: [{ stem:'戊', role:'여기' }, { stem:'壬', role:'중기' }, { stem:'庚', role:'본기' }],
  酉: [{ stem:'庚', role:'여기' }, { stem:'辛', role:'본기' }],
  戌: [{ stem:'辛', role:'여기' }, { stem:'丁', role:'중기' }, { stem:'戊', role:'본기' }],
  亥: [{ stem:'戊', role:'여기' }, { stem:'甲', role:'중기' }, { stem:'壬', role:'본기' }],
};

const ELEM_ORDER: Element[] = ['木','火','土','金','水']; // 상생 순

/**
 * 대운 순행/역행 판정 — 명식당 하나(첫 입운 방향). 년간(年干) 음양 × 성별로 결정.
 *   · 양년생 남자 · 음년생 여자 = 순행(順行) — 대운 간지가 월주 다음부터 순서대로 진행
 *   · 음년생 남자 · 양년생 여자 = 역행(逆行) — 월주 이전으로 거슬러 진행
 *   lunar-javascript `getYun().isForward()`와 동일 공식 `(yang&&man)||(!yang&&!man)`이며,
 *   chart.ts(동결 계약) 변경을 피하려 순수 함수로 분리해 UI에서 직접 호출한다.
 * @param yearStem 년주(年柱) 천간
 * @param sex 성별 '남' | '여'
 * @returns true=순행, false=역행
 */
export function daeunForward(yearStem: Stem, sex: '남' | '여'): boolean {
  const yang = STEM_YANG[yearStem];   // 년간이 양간(甲丙戊庚壬)인가
  const man = sex === '남';
  return (yang && man) || (!yang && !man);
}

/**
 * 십신 계산 — 일간(day) 기준으로 상대 천간(other)의 십신을 결정한다.
 * 오행 관계(상생순): 0 동일(비겁) / 1 일간이 생(식상) / 2 일간이 극(재) / 3 극일간(관) / 4 생일간(인).
 * 정/편: 비겁·식상은 같은 음양=비견/식신, 재·관·인은 다른 음양=정(正).
 */
export function tenGod(day: Stem, other: Stem): TenGod {
  const rel = (ELEM_ORDER.indexOf(STEM_ELEM[other]) - ELEM_ORDER.indexOf(STEM_ELEM[day]) + 5) % 5;
  const same = STEM_YANG[day] === STEM_YANG[other];
  switch (rel) {
    case 0: return same ? '비견' : '겁재';
    case 1: return same ? '식신' : '상관';
    case 2: return same ? '편재' : '정재';
    case 3: return same ? '편관' : '정관';
    default: return same ? '편인' : '정인'; // case 4
  }
}

/** 일간 기준, 임의 지지의 *지지십신*(본기 기준). 대운·세운·월운 등 시간층 지지의 십신 산출용(UI 타임라인). */
export function branchTenGod(day: Stem, branch: Branch): TenGod {
  return tenGod(day, BRANCH_MAIN[branch]);
}

/** 간지 문자열(예 "甲戌") → 한 기둥(PillarData). 지장간·십신·통근은 우리 로직.
 *  @throws Error 간지 문자열이 2자 미만(라이브러리 경계값·범위 외 날짜)이면 에러를 던진다.
 *          buildSajuChart 전체가 실패하게 해 silent 오류를 방지한다.
 */
function buildPillar(position: PillarPos, ganZhi: string, dayStem: Stem): PillarData {
  // 라이브러리가 범위 밖 날짜에서 빈 문자열·1자 문자열을 반환하면 stem/branch가 undefined가 됨.
  // 이를 막기 위해 길이를 먼저 검사한다.
  if (!ganZhi || ganZhi.length < 2) {
    throw new Error(`[saju] buildPillar(${position}): 간지 문자열이 유효하지 않습니다 → "${ganZhi}". 지원 범위 밖 날짜일 수 있습니다.`);
  }
  const stem = ganZhi[0] as Stem;
  const branch = ganZhi[1] as Branch;
  const hiddenStems: HiddenStem[] = HIDDEN[branch].map((h) => ({
    stem: h.stem, role: h.role, tenGod: tenGod(dayStem, h.stem),
  }));
  return {
    position, stem, branch,
    stemTenGod: position === '일' ? '비견' : tenGod(dayStem, stem), // 일간=비견 기준점
    branchMainTenGod: tenGod(dayStem, BRANCH_MAIN[branch]),
    hiddenStems,
    isRoot: HIDDEN[branch].some((h) => STEM_ELEM[h.stem] === STEM_ELEM[dayStem]), // 일간과 동일오행 장간 = 통근
  };
}

/**
 * ChartInput → SajuChart (결정론).
 * @param input  엔진 입력(PII). birthDateTime "YYYY-MM-DD HH:mm" 시계시 — 진태양시 보정(서머타임·시대별 자오선·균시차)은 내부 적용(ADR-008 해소).
 * @param nowYear 세운 기준 연도(기본 2026).
 */
// 음력 입력이면 양력 [y,mo,d] 로 변환(lunar-javascript). 양력이면 그대로.
//   ※ 만세력 음력 생일 오류 수정 — 기존엔 calendar='음'을 무시하고 양력처럼 계산했음.
//   ※ ⑧ 윤달(daniel): isLeap=true면 음수 month로 변환한다(lunar-javascript 윤달 규약 — 윤4월=fromYmd(y,-4,d)). 입력 폼 윤달 토글에서 isLeap 전달.
export function solarYmd(input: ChartInput): [number, number, number] {
  const [datePart] = input.birthDateTime.split(' ');
  const [y, mo, d] = datePart.split('-').map(Number);
  if ((input as any).calendar === '음') {
    // ⚠️ Lunar 는 모듈(Lunar.Solar 로도 씀) → 음력 변환은 Lunar.Lunar.fromYmd (Lunar.fromYmd 는 undefined).
    try { const lm = (input as any).isLeap ? -mo : mo; const s = Lunar.Lunar.fromYmd(y, lm, d).getSolar(); return [s.getYear(), s.getMonth(), s.getDay()]; }
    catch (e) {
      // ⚠️ 음력→양력 변환 실패: 라이브러리가 지원하지 않는 날짜(범위 외·윤달 오류 등)일 수 있음.
      // 입력 날짜를 양력으로 간주하고 계속하지만, 사주가 틀릴 수 있으므로 경고 로그를 남긴다.
      // 호출처(buildSajuChart)는 이 폴백을 인지하기 어려우므로 최소한 콘솔로 기록.
      console.warn('[saju] 음력→양력 변환 실패, 입력 날짜를 양력으로 폴백합니다. 결과가 부정확할 수 있습니다.', { y, mo: (input as any).isLeap ? -mo : mo, d, err: e });
    }
  }
  return [y, mo, d];
}

// ⚠️ nowYear 기본값(2026-07-18 수정): 예전엔 리터럴 `2026` 이 박혀 있어, **호출부가 연도를 안 넘기면
//   해가 바뀌어도 영원히 2026 기준**으로 현재 대운(isCurrent)·세운(annual)을 잡았다.
//   실제로 홈(`app/(app)/index.tsx` 오늘 점수 흐름)·펫이 인자 없이 호출해 2027년이면 틀린 세운이 될 상태였다.
//   → 기본값을 '오늘'로 바꿔 호출부 누락이 곧 버그가 되지 않게 한다(명시 인자는 그대로 우선).
//   ※ 특정 연도 재현이 필요한 검증·골든은 nowYear 를 **명시적으로** 넘길 것.
export function buildSajuChart(input: ChartInput, nowYear = new Date().getFullYear()): SajuChart {
  const [y, mo, d] = solarYmd(input);                          // 음력 생일이면 양력으로 변환(만세력 음력 오류 수정)
  const timePart = input.birthDateTime.split(' ')[1] ?? '0:0';
  const [h, mi = 0] = timePart.split(':').map(Number);
  // 진태양시 보정 — 시계시 → 출생지 실제 태양시(서머타임 환원+시대별 경도차+균시차)로 이동 후 팔자 산출.
  //   시각 미상은 시주가 어차피 마스킹되고 자정 경계 오류(일주 변동) 위험이 있어 보정 생략.
  let cy = y, cmo = mo, cd = d, ch = h, cmi = mi;
  if (input.timeAccuracy !== '미상') {
    const corr = new Date(y, mo - 1, d, h, mi, 0);
    corr.setMinutes(corr.getMinutes() + Math.round(trueSolarOffsetMin(input, y, mo, d, h, mi)));
    cy = corr.getFullYear(); cmo = corr.getMonth() + 1; cd = corr.getDate(); ch = corr.getHours(); cmi = corr.getMinutes();
  }
  const ec = Solar.fromYmdHms(cy, cmo, cd, ch, cmi, 0).getLunar().getEightChar();
  const dayStem = ec.getDayGan() as Stem;

  const pillars = {
    '년': buildPillar('년', ec.getYear(), dayStem),
    '월': buildPillar('월', ec.getMonth(), dayStem),
    '일': buildPillar('일', ec.getDay(), dayStem),
    '시': buildPillar('시', ec.getTime(), dayStem),
  } as Record<PillarPos, PillarData>;

  // 대운 (gender: 남=1, 여=0). getDaYun()[0]은 미입운(빈 간지)이라 제외.
  const daYunRaw: any[] = ec.getYun(input.sex === '남' ? 1 : 0).getDaYun(13); // 13개(미입운 [0] 제외 12) → 대운 110세+까지(daniel: 만세력 대운 110세까지)
  const age = nowYear - y; // 근사 나이(세운 연도 − 출생 연도)
  const luckCycles: LuckCycle[] = daYunRaw
    .filter((dy) => dy.getGanZhi && dy.getGanZhi())
    .map((dy) => {
      const gz: string = dy.getGanZhi();
      // 이 대운의 세운(流年) 10년 — 클릭 시 드릴다운에 쓸 간지·십신
      const annuals: AnnualPillar[] = (dy.getLiuNian?.() ?? []).map((ln: any) => {
        const agz: string = ln.getGanZhi();
        // 이 세운의 월운(流月) 12 — 세운 탭 시 드릴다운에 사용
        const months: MonthPillar[] = (ln.getLiuYue?.() ?? []).map((ly: any) => {
          const mgz: string = ly.getGanZhi();
          // 라이브러리 경계: 2자 미만이면 해당 월운만 스킵(대운/세운 전체는 유지)
          if (!mgz || mgz.length < 2) {
            console.warn('[saju] 월운 간지 이상, 스킵:', mgz);
            return null;
          }
          return { stem: mgz[0] as Stem, branch: mgz[1] as Branch, stemTenGod: tenGod(dayStem, mgz[0] as Stem), label: ly.getMonthInChinese?.() ?? '' };
        }).filter(Boolean) as MonthPillar[];
        // 세운 간지 이상이면 해당 세운 스킵
        if (!agz || agz.length < 2) {
          console.warn('[saju] 세운 간지 이상, 스킵:', agz);
          return null;
        }
        return {
          year: ln.getYear(),
          stem: agz[0] as Stem, branch: agz[1] as Branch,
          stemTenGod: tenGod(dayStem, agz[0] as Stem),
          interactionsWithLuck: [],   // WS3(원국×대운×세운 합충) 영역
          months,
        };
      }).filter(Boolean) as AnnualPillar[];
      // 대운 간지 이상이면 이 대운을 건너뜀 — 위 filter 전에도 gz 검사 실행됨
      return {
        startAge: dy.getStartAge(),
        stem: gz[0] as Stem, branch: gz[1] as Branch,
        stemTenGod: tenGod(dayStem, gz[0] as Stem),
        isCurrent: false,
        annuals,
      };
    });
  luckCycles.forEach((cur, i) => {
    const nxt = luckCycles[i + 1];
    if (age >= cur.startAge && (!nxt || age < nxt.startAge)) cur.isCurrent = true;
  });
  // luckCycles가 빈 배열(라이브러리가 대운을 전혀 계산 못한 경우)에도 크래시 방지.
  // · find → luckCycles[0] → 최후 폴백(더미 대운) 순으로 안전하게 처리.
  // · SajuChart 타입(currentLuck: LuckCycle, non-null) 유지를 위해 더미 대운 삽입.
  const FALLBACK_LUCK: LuckCycle = {
    startAge: 0, stem: '甲' as Stem, branch: '子' as Branch,
    stemTenGod: tenGod(dayStem, '甲' as Stem),
    isCurrent: true, annuals: [],
  };
  if (luckCycles.length === 0) {
    console.warn('[saju] luckCycles 빈 배열 — 라이브러리가 대운을 반환하지 않았습니다. 더미 대운으로 폴백합니다.');
  }
  const currentLuck: LuckCycle = luckCycles.find((l) => l.isCurrent) ?? luckCycles[0] ?? FALLBACK_LUCK;

  // 세운: 현재 대운의 流年에서 nowYear 찾기 (없으면 연간지 직접 계산 폴백)
  // luckCycles가 빈 배열 폴백 케이스에서는 daYunRaw에 매칭이 없으므로 undefined → 폴백으로 이어짐.
  const curDaYun = daYunRaw.find((dy) => {
    const gz = dy.getGanZhi && dy.getGanZhi();
    return gz && gz[0] === currentLuck.stem && gz[1] === currentLuck.branch;
  });
  const liu = curDaYun?.getLiuNian?.()?.find((ln: any) => ln.getYear() === nowYear);
  const annGz: string = liu
    ? liu.getGanZhi()
    : Solar.fromYmdHms(nowYear, 6, 1, 12, 0, 0).getLunar().getYearInGanZhi();
  const annual: AnnualPillar = {
    year: nowYear,
    stem: annGz[0] as Stem, branch: annGz[1] as Branch,
    stemTenGod: tenGod(dayStem, annGz[0] as Stem),
    interactionsWithLuck: [], // WS3(합충 검출) 영역
  };

  return {
    pillars,
    dayMaster: { stem: dayStem, element: STEM_ELEM[dayStem] },
    interactions: [],  // WS3 영역
    luckCycles,
    currentLuck,
    annual,
    // structure: WS3/골든 영역 — 엔진은 채우지 않음
  };
}

/** 특정 세운(年)·월(1~12)의 일운(日辰) 달력 — 월운 탭 시 동적 생성(전체 미리계산 회피).
 *  일간지는 절기 무관 연속 60갑자라 양력 날짜로 직접 산출(정확). 월 라벨은 양력월 기준. */
export function computeMonthDays(dayStem: Stem, anYear: number, solarMonth: number): { day: number; stem: Stem; branch: Branch; stemTenGod: TenGod }[] {
  // ★일간(dayStem)을 직접 인자로 받는다(daniel 2026-07-07 일운 빈칸 버그): 기존엔 input→solarYmd 로 일간을 구했는데,
  //   저장/대표 명식 로드 시 input=null 이면 호출부가 빈배열로 폴백 → *일운(流日) 컬럼이 통째로 사라졌다*
  //   (월운은 an.months 라 떠서 "월운은 뜨는데 일운만 안 뜸"). 일간은 c.saju.dayMaster 로 항상 가용 → input 의존 제거.
  const last = new Date(anYear, solarMonth, 0).getDate();   // 그 양력월 말일
  const days: { day: number; stem: Stem; branch: Branch; stemTenGod: TenGod }[] = [];
  for (let d = 1; d <= last; d++) {
    const gz: string = Solar.fromYmd(anYear, solarMonth, d).getLunar().getDayInGanZhi();
    days.push({ day: d, stem: gz[0] as Stem, branch: gz[1] as Branch, stemTenGod: tenGod(dayStem, gz[0] as Stem) });
  }
  return days;
}
