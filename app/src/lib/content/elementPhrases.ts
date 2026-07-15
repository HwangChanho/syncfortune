// app/src/lib/content/elementPhrases.ts — 오행/용신 → 일상어 매핑 (홈 티저 + 화면 티저 공용 사전)
// ─────────────────────────────────────────────────────────────────────────
// 왜 lib인가: 홈 카드 티저(homeTeaser.ts)와 화면 티저(ImageTeaser/TalentTeaser/MissionTeaser)가
//   같은 신호(일간 오행·최강 오행·용신 오행)를 서로 다른 곳에서 문구로 보여준다. 문구가 컴포넌트 안에
//   갇혀 있으면 두 곳이 각자 베끼거나 어긋나기 쉽다 — 홈에서 본 문장과 화면에서 본 문장이 다르면
//   "같은 걸 다르게 말한다"는 신뢰 훼손이 생긴다. 그래서 여기 lib로 옮겨 **단일 출처**로 삼는다.
//   (원래 위치: EL_IMAGE=ImageTeaser.tsx / EL_TALENT=TalentTeaser.tsx / YONG_MISSION=MissionTeaser.tsx)
//
// ⚠️ 아래 값은 daniel 검수 **확정본**(2026-07-16)이다 — 임의로 문구를 수정하지 말 것. 수정이 필요하면
//   daniel 재검수를 거쳐야 한다(CLAUDE.md §3.3 "사주: 유저가 ground truth" — 문구 stance 판정은 유저 몫).
// ─────────────────────────────────────────────────────────────────────────
import type { SajuChart } from '@spec/chart';
import { stemElement, branchElement } from '../engine/ohaeng';

// ★daniel 검수 **확정**(2026-07-16) — 일간 오행 → 남에게 비치는 첫인상 결(일상어). 표준 물상 기반.
//   검수 의견: "과몰입 없이 안전 · 무난". 5종 전부 그대로 확정.
//   ⚠️daniel 미결 질문: 5종이 **전부 긍정 일변도**(약점 뉘앙스 0)인 게 의도인지 — "장점만 나열"은 오히려 신뢰를
//     깎을 수 있다. 유료 본문(kind=image)이 약점을 커버한다면 이 티저는 순수 이미지용으로 놔둬도 무방(daniel).
export const EL_IMAGE: Record<string, string> = {
  木: '부드럽게 뻗어가는·성장하는 인상',
  火: '밝고 표현이 살아있는 인상',
  土: '듬직하고 신뢰가 가는 인상',
  金: '단정하고 명료한 인상',
  水: '유연하고 깊이가 느껴지는 인상',
};

// ★daniel 검수 **확정**(2026-07-16) — 오행 → 재능 결(일상어). 표준 물상 기반.
//   검수 의견: "~재능"은 단정이 아니라 성향 서술이라 확정성 수위 안전. 5종 전부 그대로 확정.
export const EL_TALENT: Record<string, string> = {
  木: '기획하고 키워내는 재능',
  火: '표현하고 밝히는 재능',
  土: '중재하고 안정시키는 재능',
  金: '분석하고 매듭짓는 재능',
  水: '통찰하고 유연하게 흐르는 재능',
};

// ★daniel 검수 **확정**(2026-07-16) — 용신 오행 → 사명(나아갈 방향) 일상어. daniel stance(용신=필요기운) 기반.
//   검수 의견: "~방향"은 단정이 아니라 성향 서술이라 확정성 수위 안전. 단 **木·水는 동사 교체**(daniel 지정) —
//   EL_TALENT(재능)의 木'키워내는'·水'통찰하고'와 동사가 겹쳐, 세 카드가 한 리포트에 연속으로 뜨면
//   "생성기가 단어를 재활용한다"는 인상을 준다. → 木 '넓혀가는' · 水 '받아들이고 흐름을 읽는'.
export const YONG_MISSION: Record<string, string> = {
  木: '새로 시작하고 넓혀가는 방향',
  火: '드러내고 이끄는 방향',
  土: '품고 이어주는 방향',
  金: '다듬고 완성하는 방향',
  水: '받아들이고 흐름을 읽는 방향',
};

/**
 * 팔자 8글자(천간4+지지4) 오행 분포의 최강 오행을 구한다.
 *   원래 TalentTeaser.tsx의 useMemo 안에 있던 오행 카운트 로직을 그대로 옮긴 것(순수 이동 — 로직·순서 불변).
 * @param saju 사주 차트(SajuChart). pillars.year/month/day/hour 각 { stem, branch }를 읽는다.
 * @returns 최강 오행 한 글자('木'|'火'|'土'|'金'|'水').
 * @주의 시주 미상이면 pillars.hour가 없어 8글자 중 6글자(년·월·일 각 2글자)로만 산출한다(가능한 글자로만 계산 — throw 없음).
 */
/**
 * 팔자 8글자 오행 분포의 최강 오행. **산출 불가·판정 불가면 null**(호출부는 표시를 생략한다).
 *
 * ⚠️**2026-07-16 버그 수정 2건**:
 *   1) **키 오류(치명)** — 기존 코드가 `[p.year, p.month, p.day, p.hour]` 로 **영문 키**를 읽었다.
 *      `SajuChart.pillars` 의 키는 **한글**(`'년'|'월'|'일'|'시'` = PillarPos)이라 전부 undefined → 전 글자 스킵 →
 *      counts 가 **전부 0** → `sort()[0]` 이 객체 선언 순서 첫 키인 **木을 항상 반환**했다.
 *      = 오행 카운트가 **작동한 적이 없고 모든 유저에게 木("기획하고 키워내는 재능")이 표시**됨.
 *   2) **동률 가드**(daniel 2026-07-16: "**명식의 강한 기운은 단순 글자의 수로 보는 게 아니야**") —
 *      1·2위가 같으면 카운트로 최강을 정할 수 없다(정렬 순서로 집는 건 명리 판정이 아니라 코드 부산물).
 *      daniel 차트(`甲戌 丁卯 辛丑 丁酉`)가 실제로 木2·火2·土2·金2 **동률**이다. → **null(표시 생략)**.
 *   ★근본 재설계(카운트 → **통근·간여지동 기반**)는 daniel 스탠스 대기 = 노션 Q107. 그때까지 '틀린 답을 내느니
 *     안 내는' 안전측으로 둔다.
 */
export function dominantElement(saju: SajuChart): string | null {
  const counts: Record<string, number> = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
  const p: any = saju?.pillars ?? {};
  for (const pos of ['년', '월', '일', '시']) {
    const pl = p[pos];
    if (!pl) continue; // 시주 미상이면 '시' 없음 — 스킵(가능한 글자로만 산출)
    const se = stemElement(pl.stem);
    const be = branchElement(pl.branch);
    if (se in counts) counts[se]++;
    if (be in counts) counts[be]++;
  }
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (!sorted[0][1]) return null;                  // 전부 0 = 산출 실패(차트 불완전) → 생략
  if (sorted[0][1] === sorted[1][1]) return null;  // 1·2위 동률 → 카운트로 판정 불가 → 생략(위 ②)
  return sorted[0][0];
}
