// app/src/lib/content/homeTeaser.ts — 홈 카드 개인화 티저(대표 명식 → '내 얘기' 한 줄)
// ─────────────────────────────────────────────────────────────────────────
// daniel(2026-07-16): "콘텐츠가 많은데 너무 나열만 되어 있어 가시성이 떨어진다 — 무료를 접근하기 쉽게 해서 유료로 유도하고 싶다."
//   진단 = 홈 카드 53장이 전부 '그림 + 모두에게 똑같은 정적 설명(descKey) + 가격 배지'라, 유저는 자기 얘기를 하나도
//          못 본 채 가격표부터 본다. 정작 결정론 티저(*Teaser/*Timing 15종)는 유료 화면 *안*에 있어, 53장 중 그 카드를
//          정확히 골라 눌러야만 처음 보인다 = 가장 강한 설득 자산이 가장 깊은 곳에 잠겨 있다.
//   해법 = 카드의 정적 설명 자리에 '대표 명식으로 계산한 한 줄'을 얹는다. 티저가 없으면 기존 설명으로 폴백(무해).
//
// ★설계 원칙 (CLAUDE.md §3.3 역할 경계 · daniel 2026-07-16 결정 "검수된 것만 먼저")
//   1) **미검수 문구 금지** — jobfit 적성 카피·child 신호는 아직 코드 주석에 "★daniel 검수 슬롯 / 후보 초안"으로
//      표시된 *미검수 초안*이라 홈(첫 화면)에 올리지 않는다. 지금까진 유료 화면 깊숙이 있어 노출이 제한적이었으나,
//      홈은 전 유저의 첫 화면이라 성격이 다르다. → Boss 검수 확정 후 이 파일에 추가한다.
//      ✅ EL_IMAGE(image)·EL_TALENT(talent)·YONG_MISSION(mission)은 2026-07-16 daniel 검수 확정 → 반영함
//         (문구는 lib/content/elementPhrases.ts 단일 출처 — 화면 티저 ImageTeaser/TalentTeaser/MissionTeaser와 동일 문구).
//   2) **명리 발명 금지**(§3.2) — Boss가 검수한 lib/engine 산출값(숫자·neutral key)만 쓴다. 이 파일은 그 값을
//      *서술*할 뿐, 새 판정(오행→성향 매핑 같은 stance)을 만들지 않는다.
//   3) **온디바이스·동기·API 0** — 전부 결정론(절대규칙 1·5). 홈은 명식당 1회만 계산(useMemo/effect).
//   4) **실패는 null** — 명식 없음·시주 미상·예외 등 어떤 경우도 throw 금지. null이면 카드가 기존 descKey로 폴백한다.
//   5) **i18n 분리** — 문구를 여기서 만들지 않고 {키, 변수}만 반환한다. 렌더(t)는 홈 담당 = ko/en/ja 동시 지원.
// ─────────────────────────────────────────────────────────────────────────
import type { SajuChart } from '@spec/chart';
import { computeCareerSignals } from './careerGauge'; // ★daniel 검수본(기여 행렬·golden) — bizPct/orgPct
import { lifeGraph } from './lifeGraph';               // ★daniel 검수 stance(대운 지지 우위·R2 ±3) — 대운 흐름 points
import { newyearSinsu } from './newyearGauge';         // 세운 3층 산출 — keyword(일상어)를 lib이 직접 준다
import { crushTiming, reunionTiming, jobTiming } from './timingSignals'; // 도화 발동 월·관성/인성 해 — 화면 티저와 동일 산출(단일 출처)
import { EL_IMAGE, EL_TALENT, YONG_MISSION, dominantElement } from './elementPhrases'; // ★daniel 검수 확정(2026-07-16) 오행 문구 — 화면 티저(Image/Talent/Mission)와 단일 출처
import { computeYongsinApprox } from './yongsinApprox'; // 용신(억부근사) — mission 티저 신호

/**
 * 홈 카드에 얹을 티저 한 줄 — 문구 자체가 아니라 i18n 키 + 보간 변수.
 *   문구 소유는 i18n(ko/en/ja), 계산 소유는 이 모듈 = 다국어와 명리 로직을 섞지 않는다.
 */
export type HomeTeaser = { key: string; vars?: Record<string, string | number> };

/**
 * 대표 명식으로 홈 카드 한 줄을 계산한다. **결정론·온디바이스·API 0.**
 *
 * @param menuKey 홈 SECTIONS 의 MenuItem.key(예: 'career'·'newyear'·'lifegraph'·'timeline').
 *                여기 없는 키는 티저 미지원 → null(카드는 기존 정적 설명 유지).
 * @param saju    대표 명식의 사주 차트(buildSajuChart 산출). null 이면 티저 없음.
 * @param timeUnknown 태어난 시 미상 여부. 시주에 기대는 산출의 정확도 힌트로 하위 함수에 전달한다.
 * @returns 티저 {키, 변수} 또는 null(미지원·명식없음·산출불가·예외).
 *
 * ⚠️ 주의: 이 함수는 절대 throw 하지 않는다(홈 렌더를 막으면 안 됨). 모든 실패는 조용히 null.
 */
export function homeTeaser(menuKey: string, saju: SajuChart | null, timeUnknown?: boolean): HomeTeaser | null {
  if (!saju?.pillars) return null; // 명식 미등록·차트 불완전 → 기존 설명 유지
  try {
    switch (menuKey) {
      // ── 사업가의 나 — 저울 %(사업가↔직장인). 검수본이 준 숫자 그대로 = 사실 서술, 라벨(BAND_LABEL) 미사용(표현 계층).
      case 'career': {
        const s = computeCareerSignals(saju);
        if (typeof s?.bizPct !== 'number' || typeof s?.orgPct !== 'number') return null;
        return { key: 'teaser.career', vars: { biz: s.bizPct, org: s.orgPct } };
      }
      // ── 신년운세 — 올해의 키워드. newyearGauge 가 애초에 '미리보기용 일상어'로 산출하는 필드(§4·한자/십신 없음).
      case 'newyear': {
        const d = newyearSinsu(saju, { timeUnknown });
        if (!d?.keyword) return null;
        return { key: 'teaser.newyear', vars: { keyword: d.keyword } };
      }
      // ── 인생 그래프 / 타임라인 — 같은 lifeGraph 산출을 공유(둘 다 대운 흐름 콘텐츠).
      //    ★점수(score)를 홈에 노출하지 않는다: 낮은 점수가 첫 화면에 박히면 '부정 증폭'(§4 안전 가드)이 된다.
      //      대신 완전 중립 사실 = 지금 몇 번째 구간인지 + 전환점이 몇 번인지만 서술한다.
      case 'lifegraph':
      case 'timeline': {
        const pts = lifeGraph(saju)?.points;
        if (!pts?.length) return null;
        const idx = pts.findIndex((p) => p.current);
        if (idx < 0) return null; // 현재 구간 판정 불가(대운 산출 실패) → 폴백
        const turns = pts.filter((p) => p.turning).length;
        return { key: 'teaser.flow', vars: { n: idx + 1, turns } };
      }
      // ── 짝사랑·재회 — 올해 '그 달'(도화 발동). 화면(CrushTiming/ReunionTiming)과 **같은 lib 산출**이라 값이 어긋날 수 없다.
      //    ★무료 질문형(*Ask)에도 같은 티저를 건다: 홈에서 시기를 먼저 보여줘 무료 진입 → 화면 CTA로 유료 유도(daniel 퍼널).
      //    ★연도를 모르면(엔진 미채움) 티저를 내지 않는다 — '올해'를 지어내지 않는다(기존 화면과 동일 스탠스).
      case 'crush': case 'crushAsk': case 'hotCrushAsk':
      case 'reunion': case 'reunionAsk': case 'hotReunionAsk': {
        const isCrush = menuKey.toLowerCase().includes('crush');
        const d = isCrush ? crushTiming(saju) : reunionTiming(saju);
        if (!d.months.length || d.year == null) return null; // 무발동·연도불명 → 정적 설명 폴백
        // ★변별력 가드(홈 전용) — 발동 달이 너무 많으면 홈에 내지 않는다.
        //   이유: 홈 티저는 '콕 집는 시기'라야 후크다. 12달 중 8달이 뜨면 카드 줄이 넘칠 뿐 아니라
        //         "아무 달이나 다 된다"로 읽혀 신뢰를 깎는다(daniel 본인 차트 = 짝사랑 10달로 실측됨).
        //   ⚠️ 산출·화면(CrushTiming 12칸 달력)은 건드리지 않는다 — 여기서 명리 판정을 바꾸는 게 아니라,
        //      좁은 홈 카드에 '무엇을 실을지'만 절제하는 표현 결정이다. (넓은 발동 자체의 타당성 = daniel 검수 슬롯)
        if (d.months.length > 4) return null;
        return { key: isCrush ? 'teaser.crush' : 'teaser.reunion', vars: { year: d.year, months: d.months.join('·') } };
      }
      // ── 취업·이직 — 가까운 유리한 해. 결(kind: 일자리/자격)은 홈에서 생략하고 '해'만 = 사실 서술.
      //    ※ 'jobfit'(나에게 어울리는 직업)은 여기 걸리지 않는다(별 콘텐츠 + 적성 카피가 미검수 슬롯).
      case 'job': case 'jobAsk': case 'hotJobAsk': {
        const d = jobTiming(saju);
        if (!d.years.length) return null;
        // 홈은 2줄 제약 — 가까운 2개만 싣는다(화면 JobTiming 은 최대 4개 전부 유지). 사실의 절제이지 판정 변경이 아니다.
        return { key: 'teaser.job', vars: { years: d.years.slice(0, 2).map((y) => y.year).join('·') } };
      }
      // ── 비치는 나 — 일간 오행 → 첫인상 결. ImageTeaser 화면과 같은 신호(dayMaster.element)·같은 문구(EL_IMAGE).
      case 'image': {
        const el = saju.dayMaster?.element;
        if (!el || !EL_IMAGE[el]) return null; // 일간 미상·매핑 없음 → 정적 설명 폴백
        return { key: 'teaser.raw', vars: { text: EL_IMAGE[el] } };
      }
      // ── 나의 타고난 재능 — 팔자 8글자 최강 오행 → 재능 결. TalentTeaser 화면과 같은 산출(dominantElement)·같은 문구(EL_TALENT).
      case 'talent': {
        const dom = dominantElement(saju);
        if (!dom || !EL_TALENT[dom]) return null;
        return { key: 'teaser.raw', vars: { text: EL_TALENT[dom] } };
      }
      // ── 나의 사명 — 용신 오행 → 나아갈 방향. MissionTeaser 화면과 같은 산출(computeYongsinApprox)·같은 문구(YONG_MISSION).
      //    ※ 예외는 함수 바깥 try/catch가 받는다(이 파일의 기존 케이스들과 동일 패턴 — 케이스마다 try/catch 중복 안 함).
      case 'mission': {
        const yong = computeYongsinApprox(saju, { timeUnknown }).yongsin;
        if (!yong || !YONG_MISSION[yong]) return null; // 용신 산출 불가·매핑 없음 → 정적 설명 폴백
        return { key: 'teaser.raw', vars: { text: YONG_MISSION[yong] } };
      }
      default:
        return null; // 티저 미지원 카드(대다수) — 기존 정적 설명 유지
    }
  } catch {
    return null; // 산출 실패는 홈을 막지 않는다(로그도 남기지 않음 — 렌더 경로라 조용히)
  }
}
