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
import { trueSolarOffsetMin, kstMeridianAt, dstOffsetMin } from './solartime'; // kstMeridianAt·dstOffsetMin = 절기용 북경시 변환(감사 C1)

const Lunar: any = _lunar;
const Solar = Lunar.Solar;

// ── 명리 상수 ──
const STEM_ELEM: Record<Stem, Element> = { 甲:'木',乙:'木',丙:'火',丁:'火',戊:'土',己:'土',庚:'金',辛:'金',壬:'水',癸:'水' };
/** 천간 음양(甲丙戊庚壬=양). ★단일 출처 — 격국(비겁 월지 이름)·대운 순역이 함께 쓴다. */
export const STEM_YANG: Record<Stem, boolean> = { 甲:true,乙:false,丙:true,丁:false,戊:true,己:false,庚:true,辛:false,壬:true,癸:false };
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
/**
 * 생년월일시 입력 유효성 검증 (감사 H3/H4/H6 · 2026-07-26) — **순수 함수, 아무것도 던지지 않는다.**
 *
 * 왜 필요한가(실측): 엔진은 지금까지 입력을 전혀 검증하지 않아 **조용히 틀린 사주**를 냈다.
 *   · `1991-02-30`(없는 날) → 에러 없이 팔자 산출(JS Date 가 3월 2일로 롤오버)
 *   · `1991-13-05`(월 13)   → 에러 없이 팔자 산출(다음 해로 롤오버)
 *   · 음력 *없는 윤달*      → 라이브러리 throw → catch → **양력으로 조용히 폴백**(음력 입력인데 양력 사주)
 *   사주는 하루만 어긋나도 일주가 통째로 달라진다 → 입구에서 막는 것이 근본이다.
 *
 * 설계: 던지지 않고 **문제 목록을 돌려준다**. 이유 = 이미 저장된 명식 중 이런 입력이 있을 수 있어
 *   엔진이 throw 로 바뀌면 앱이 깨진다. 등록 폼이 이 함수로 *저장 전에* 걸러 주면 새 오염은 0이 되고,
 *   기존 데이터는 그대로 열람된다(회귀 0).
 *
 * @param input 엔진 입력. birthDateTime = "YYYY-MM-DD HH:mm"(시각 생략 허용).
 * @returns 사람이 읽을 수 있는 문제 설명 배열. **빈 배열이면 유효**.
 */
export function validateBirthInput(input: ChartInput): string[] {
  const problems: string[] = [];
  const raw = (input?.birthDateTime ?? '').trim();
  if (!raw) return ['생년월일이 없어요.'];

  const [datePart, timePart] = raw.split(' ');
  const dm = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(datePart ?? '');
  if (!dm) return [`생년월일 형식이 올바르지 않아요(YYYY-MM-DD): "${datePart ?? raw}"`];
  const [y, mo, d] = [Number(dm[1]), Number(dm[2]), Number(dm[3])];

  // 시각 — 생략은 허용(0시로 간주)하되, 있으면 범위를 지킨다.
  if (timePart) {
    const tm = /^(\d{1,2}):(\d{1,2})$/.exec(timePart);
    if (!tm) problems.push(`시각 형식이 올바르지 않아요(HH:mm): "${timePart}"`);
    else {
      const [hh, mi] = [Number(tm[1]), Number(tm[2])];
      if (hh < 0 || hh > 23) problems.push(`시(hour)는 0~23 이어야 해요: ${hh}`);
      if (mi < 0 || mi > 59) problems.push(`분(minute)은 0~59 이어야 해요: ${mi}`);
    }
  }

  // 연도 범위 — lunar-javascript 지원 범위를 크게 벗어나면 계산이 무의미하다.
  if (y < 1900 || y > 2100) problems.push(`연도가 지원 범위(1900~2100)를 벗어났어요: ${y}`);
  if (mo < 1 || mo > 12) problems.push(`월은 1~12 여야 해요: ${mo}`);
  if (d < 1 || d > 31) problems.push(`일은 1~31 이어야 해요: ${d}`);
  if (problems.length) return problems;

  if ((input as any).calendar === '음') {
    // 음력: **round-trip 으로 실재 여부를 검증**한다. 없는 윤달·그 달에 없는 날짜(예: 30일 없는 달의 30일)는
    //   변환이 실패하거나 다른 날짜로 흡수되는데, 되돌려 비교하면 둘 다 잡힌다.
    const lm = (input as any).isLeap ? -mo : mo;
    try {
      const solar = Lunar.Lunar.fromYmd(y, lm, d).getSolar();
      const back = solar.getLunar();
      if (back.getYear() !== y || back.getMonth() !== lm || back.getDay() !== d) {
        problems.push((input as any).isLeap
          ? `${y}년에는 윤${mo}월 ${d}일이 없어요. 윤달 여부와 날짜를 확인해 주세요.`
          : `${y}년 음력 ${mo}월 ${d}일은 없는 날짜예요.`);
      }
    } catch {
      problems.push((input as any).isLeap
        ? `${y}년에는 윤${mo}월이 없어요. 윤달 표시를 해제하거나 날짜를 확인해 주세요.`
        : `${y}년 음력 ${mo}월 ${d}일로 변환할 수 없어요. 날짜를 확인해 주세요.`);
    }
  } else {
    // 양력: JS Date 는 없는 날짜를 조용히 롤오버(2/30 → 3/2)하므로 되돌려 같은지 본다.
    const dt = new Date(y, mo - 1, d);
    if (dt.getFullYear() !== y || dt.getMonth() + 1 !== mo || dt.getDate() !== d) {
      problems.push(`${y}년 ${mo}월 ${d}일은 없는 날짜예요.`);
    }
  }
  return problems;
}

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

  // ★야자시 처리 = **자시일수설**(daniel 문파 확정 2026-07-26: "야자시·조자시 구분 안 한다" · 감사 C2).
  //   즉 子시(23:00~01:00)는 나누지 않고 **통째로 다음날**로 본다.
  //
  //   고치는 것(실측한 내부 모순): 라이브러리는 **시주 천간을 이미 다음날 일간 기준**으로 내면서
  //   **일주는 자정 기준**으로 둔다 → 진태양시 23:22 출생이 `일주 庚申 + 시주 戊子` 로 나왔다.
  //   오자둔법상 庚일의 子시는 丙子이고 戊子는 **辛일(다음날)** 의 子시다 → 두 기둥이 서로 다른 날을
  //   가리키는 모순. 어느 문파를 택하든 이 상태는 틀렸다.
  //   → 자시일수설로 일관화: 23시 이후면 **일주(와 일간)도 다음날**로 옮긴다. 그러면 시주(戊子)와
  //     일간(辛)이 오자둔법상 맞아떨어진다(辛일 子시 = 戊子). 시주 계산은 손대지 않는다(이미 A안과 동일).
  //   ※ 날짜만 옮기고 시각은 정오로 두는 이유 = 일주는 시각과 무관한 연속 60갑자라, 정오로 두면
  //     경계(자정·절입) 흔들림 없이 '그 날의 일주'만 안전하게 얻는다.
  //   ※ 시각 미상은 보정 자체를 생략해 ch=0 이므로 이 분기에 걸리지 않는다.
  let dayEc = ec;
  if (ch >= 23) {
    const nx = new Date(cy, cmo - 1, cd, 12, 0, 0);
    nx.setDate(nx.getDate() + 1);
    dayEc = Solar.fromYmdHms(nx.getFullYear(), nx.getMonth() + 1, nx.getDate(), 12, 0, 0).getLunar().getEightChar();
  }
  // 일간 = 십신·시주천간·신살의 기준축 → 자시일수설을 적용한 일주에서 뽑는다.
  const dayStem = dayEc.getDayGan() as Stem;

  // ★절기 판정용 팔자 = **북경시(UTC+8)** 기준 (2026-07-26 감사 C1 수정).
  //   왜 따로 계산하나: lunar-javascript 의 절입 시각은 **북경시 기준**이다(lunar.js 절기 계산에
  //   `ONE_THIRD = 1/3` = 8/24 가 들어감 — 소스 확인). 그런데 엔진은 *진태양시 보정한 한국 시계시*를
  //   그대로 넣어 왔다 → 비교 축이 어긋나, 월주가 라이브러리 절입 표기시각 +35~47분에 바뀌었다.
  //   물리적으로 옳은 시점은 +60분(=북경시→KST)이므로 **13~25분 일찍** 전환되고 있었다
  //   (실측: 입춘/서울 13분·입춘/부산 21분·청명/서울 25분 → 그 창에 태어나면 년주·월주가 한 칸 앞섬).
  //   ※ 문파 문제가 아니다: 절입·출생 양쪽에 같은 경도·균시차 보정이 들어가 상쇄되므로, 진태양시 기준으로
  //     따져도 정답은 동일하게 "시계시 ≥ 절입표기 + 60분"이다. 즉 순수한 타임존 축 불일치.
  //   ※ 한 번의 입력으로 두 기준을 동시에 만족시킬 수 없어(시주는 지방 진태양시, 절기는 물리적 순간)
  //     라이브러리를 두 번 호출한다 — **년·월주·대운 = 이 ecTerm / 일·시주 = 위 ec(진태양시)**.
  //   보정량 = (표준자오선 − 120°)×4분 + 서머타임분. 시대별 자오선(135°/127.5°)·DST 를 그대로 반영하므로
  //     1954~61 127.5° 시대는 −30분, 서머타임 기간은 60분이 더 빠진다.
  const meridian = kstMeridianAt(y, mo, d);
  const toBeijingMin = -Math.round((meridian - 120) * 4) + dstOffsetMin(y, mo, d, h, mi);
  const bj = new Date(y, mo - 1, d, h, mi, 0);
  bj.setMinutes(bj.getMinutes() + toBeijingMin);
  const ecTerm = Solar.fromYmdHms(bj.getFullYear(), bj.getMonth() + 1, bj.getDate(), bj.getHours(), bj.getMinutes(), 0).getLunar().getEightChar();

  const pillars = {
    // 년·월주 = 절기 경계에 의존 → 북경시 기준(ecTerm). 십신은 그대로 일간(dayStem) 기준.
    '년': buildPillar('년', ecTerm.getYear(), dayStem),
    '월': buildPillar('월', ecTerm.getMonth(), dayStem),
    // 일·시주 = 지방시(진태양시) 기준. 일주는 자시일수설 적용본(dayEc — 23시 이후면 다음날),
    //   시주는 라이브러리 값 그대로(이미 다음날 일간 기준이라 자시일수설과 일치).
    '일': buildPillar('일', dayEc.getDay(), dayStem),
    '시': buildPillar('시', ec.getTime(), dayStem),
  } as Record<PillarPos, PillarData>;

  // 대운 (gender: 남=1, 여=0). getDaYun()[0]은 미입운(빈 간지)이라 제외.
  //   ★대운도 **절기 의존**(월주에서 순역 + 절입까지의 일수로 시작 나이 산출) → ecTerm 기준이라야 정확.
  const daYunRaw: any[] = ecTerm.getYun(input.sex === '남' ? 1 : 0).getDaYun(13); // 13개(미입운 [0] 제외 12) → 대운 110세+까지(daniel: 만세력 대운 110세까지)
  // ★현재 대운 판정은 **나이가 아니라 연도**로 한다(2026-07-26 감사 H1 off-by-one 수정).
  //   버그: 예전엔 `age = nowYear - y`(연도차)를 `dy.getStartAge()` 와 비교했는데, lunar-javascript 의
  //   startAge 는 **세는나이(虛歲)** 라 항상 `startYear - birthYear + 1` 이다(실측 확인: 1991년생 己亥 대운
  //   startAge=4 / startYear=1994 → 차이 정확히 1, 전 케이스 동일). 두 규약을 맞비교하니 전환 조건이
  //   `nowYear >= startYear + 1` 이 되어 **현재 대운이 정확히 1년 늦게 전환**됐다(대운 전환 해 1년 동안
  //   직전 대운으로 통변 = '지금의 흐름' 오답). 라이브러리가 주는 startYear 를 그대로 쓰면 나이 규약 문제
  //   자체가 사라진다. ※ 표시용 startAge 값은 건드리지 않는다(만세력 UI 세는나이 표기 유지 = 회귀 0).
  const startYears: number[] = []; // luckCycles 와 같은 인덱스(아래 map 에서 함께 채움)
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
      // 이 대운이 시작하는 *연도*(현재 대운 판정용). 구버전 라이브러리 대비 폴백 = 세는나이 → 연도 역산.
      startYears.push(dy.getStartYear?.() ?? (y + dy.getStartAge() - 1));
      return {
        startAge: dy.getStartAge(),
        stem: gz[0] as Stem, branch: gz[1] as Branch,
        stemTenGod: tenGod(dayStem, gz[0] as Stem),
        isCurrent: false,
        annuals,
      };
    });
  luckCycles.forEach((cur, i) => {
    const nxtStart = startYears[i + 1];
    // 이 대운이 시작한 해 이상 && 다음 대운 시작 전 = 지금 흐르는 대운(연도 기준 — 나이 규약 무관)
    if (nowYear >= startYears[i] && (nxtStart == null || nowYear < nxtStart)) cur.isCurrent = true;
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
    // ★시각 미상 플래그(감사 H5) — 엔진이 아는 사실을 버리지 않고 계약에 실어 보낸다.
    //   true 면 pillars['시'] 는 '0:0' 에서 만들어진 **유령 子시**라 실재 시주가 아니다.
    //   (예전엔 소비자들이 호출처마다 `{...c.saju, timeUnknown}` 로 다시 병합해야 했고, 빠뜨린 곳은
    //    가짜 시주를 실재처럼 계산에 넣는 사각지대였다.)
    ...(input.timeAccuracy === '미상' ? { timeUnknown: true } : {}),
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
