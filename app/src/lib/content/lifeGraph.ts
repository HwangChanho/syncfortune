// app/src/lib/content/lifeGraph.ts — 인생 그래프(대운별 '용신 부합도' 점수 곡선). 무료·온디바이스·API 0.
// ─────────────────────────────────────────────────────────────────────────
// daniel 확정(2026-06): 점수 = 용신 부합도. 내게 필요한 기운(용신) 오행이 들어오는 대운 = 상승,
//   용신을 극하는 기운(기신) 대운 = 하강. 10년 단위(대운)로 곡선 + 변곡점 표시(시각화·공유).
//
// ★ daniel 스펙 동결(FROZEN) 2026-07-06 — 5분류·페어링·묘고게이트 확정. 재정비(2026-07, 이 모듈 = 핵심 IP — 명리 발명 금지·유저 검수 stance 인코딩):
//   (a) 대운/세운 천간·지지 차등 — 정설: 대운 = 지지 중심(운의 계절·환경), 세운 = 천간이 상대적 두드러짐.
//       · 이 파일이 그리는 곡선 단위 = '대운' → 대운 가중치 천간 0.4 / 지지 0.6 (지지 우위) 적용.
//       · 세운(추후 드릴다운) = 천간 0.55 / 지지 0.45 → GZ_WEIGHTS.세운 (v2 세운 점 산출 시 사용).
//       ※ 과거 '천간 일괄 ×1.5'는 대운의 지지(10년 계절 흐름)를 눌러 방향이 거꾸로였다 → 폐기.
//   (b) R2(용신) 5분류 직접 매핑 — 오행 관계를 다시 계산(옛 3-bucket)하지 않는다. R2가 이미 낸 용신
//       오행을 기준으로 5단(용신/희신/한신/구신/기신)을 세우고, 대운 干支 오행을 그 분류로 점수화.
//       → 설기(한신)와 극아(구신)가 옛날엔 둘 다 0으로 뭉개졌던 문제 해소.
//   (c) 대칭 ±3 — (b)로 이미 점수가 대칭(용신 +3 / 기신 −3). 옛 '+3 vs −2' 우상향 편향 제거.
//       daniel: 곡선 골이 깊어야 '왜 이 시기가 힘든가'가 페이월 뒤 설명 수요를 만든다 —
//       우상향 편향 = '다 좋다는 그래프' = 신뢰도 하락. 정규화 밴드도 중앙선(55) 기준 대칭 유지.
//
// ▷ v2 백로그(주석만 — 이번 미구현):
//   · 용신 羈絆(기반): 용신 글자가 합으로 묶이면 해당 구간 무력화 플래그(합 검출은 엔진 interactions 재사용).
//   · 조후 보정: R4 조후 테이블 재사용, 계절 오프셋(한난 편중 대운을 가감).
//
// 용신(saju.structure.usefulGod.value)이 오행이면 직접, 십신이면 일간 기준 오행으로 변환(R2 재사용 — 발명 X).
// ─────────────────────────────────────────────────────────────────────────
import { stemElement, branchElement } from '../engine/ohaeng';
import { computeYongsinApprox, yongsinToClass5, type HuiGiClass } from './yongsinApprox'; // ★용신=경량 억부(온디바이스 structure.usefulGod 비어있음, daniel 2026-07-06)
import { HIDDEN } from '@engine/saju';        // 지지 지장간(여기·중기·본기) — 페어링 보정(운지 용신 통근)
import { twelveStage } from '@engine/twelve'; // 12운성(장생·건록) — 천간-지지 시너지(용신 투간이 뿌리 위)
import type { SajuChart, Element, Stem, Branch } from '@spec/chart';

const ELEMS = ['木', '火', '土', '金', '水'];
const GEN: Record<string, string> = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' }; // X 가 생하는 오행
const CTRL: Record<string, string> = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' }; // X 가 극하는 오행

// 오행 역방향 헬퍼: X 를 '생하는' 오행(생 X, GEN 역) / X 를 '극하는' 오행(극 X, CTRL 역). 5분류·십신변환 공용.
const genOf = (x: string): string => Object.keys(GEN).find((k) => GEN[k] === x) ?? x;   // 생 X (X 를 생하는 오행)
const ctrlOf = (x: string): string => Object.keys(CTRL).find((k) => CTRL[k] === x) ?? x; // 극 X (X 를 극하는 오행)

// 십신 → 오행(일간 기준). value 가 십신(TenGod)일 때 용신 오행으로 환산.
function tenGodToElement(tg: string, dayEl: string): string {
  if (tg.includes('비') || tg.includes('겁')) return dayEl;         // 비겁 = 일간
  if (tg.includes('식') || tg.includes('상')) return GEN[dayEl];    // 식상 = 일간이 생
  if (tg.includes('재')) return CTRL[dayEl];                        // 재성 = 일간이 극
  if (tg.includes('관') || tg.includes('살')) return ctrlOf(dayEl); // 관성 = 일간을 극(= 극 일간)
  if (tg.includes('인')) return genOf(dayEl);                       // 인성 = 일간을 생(= 생 일간)
  return dayEl;
}

// ── (b) R2 5단 희기신 ──────────────────────────────────────────────────────
// daniel stance: 용신 = usefulGod 오행 · 희신 = 용신을 생하는 오행 · 기신 = 용신을 극하는 오행 ·
//   구신 = 기신을 생하는 오행 · 한신 = 나머지(= 용신이 생하는 설기 오행). 오행 5개라 정확히 1:1 분배(충돌 없음).
type HuiGi = '용신' | '희신' | '한신' | '구신' | '기신';
// (b)+(c) 대칭 점수표: 용신 +3 / 희신 +1.5 / 한신 0 / 구신 −1.5 / 기신 −3 → 한신(0) 기준 완전 대칭.
const HUIGI_SCORE: Record<HuiGi, number> = { 용신: 3, 희신: 1.5, 한신: 0, 구신: -1.5, 기신: -3 };

// 용신 오행 → 5개 오행 각각의 희기신 분류표(오행→HuiGi). '용신 상대' 분류라 명식(용신)마다 재산출.
function huiGiClasses(useEl: string): Record<string, HuiGi> {
  const yong = useEl;       // 용신
  const hui = genOf(yong);  // 희신 = 용신을 생하는 오행
  const gi = ctrlOf(yong);  // 기신 = 용신을 극하는 오행
  const gu = genOf(gi);     // 구신 = 기신을 생하는 오행
  const map: Record<string, HuiGi> = { [yong]: '용신', [hui]: '희신', [gi]: '기신', [gu]: '구신' };
  for (const e of ELEMS) if (!(e in map)) map[e] = '한신'; // 남은 하나(= 용신이 생하는 설기 오행) = 한신
  return map;
}

// ── (a) 대운/세운 천간·지지 가중치 ─────────────────────────────────────────
// 각 가중치 합 = 1.0 → 干支 결합 점수가 [−3,+3] 대칭 유지((c)). 대운 = 지지 우위 / 세운 = 천간 소폭 우위.
export const GZ_WEIGHTS = {
  대운: { stem: 0.4, branch: 0.6 },   // 대운 = 운의 계절·환경(지지 중심) → 지지 0.6
  세운: { stem: 0.55, branch: 0.45 }, // 세운 = 그해 천간이 상대적으로 두드러짐 → 천간 0.55 (v2 세운 드릴다운용)
} as const;
type GzWeight = { stem: number; branch: number };

// ── PATCH2 페어링 보정(신규·전 차트 일반규칙, daniel 2026-07-06) ───────────────
// 운 干支의 '용신 통근/시너지'를 반영 — 오행 라벨만으론 안 보이는 지장간 통근을 가산한다.
//   ① 운 지지의 지장간에 용신 오행 포함 → 본기 +1.5 / 중기 +1.0 / 여기 +0.5 (통근 깊이. HIDDEN[branch] 역할별).
//   ② 천간이 용신이고 지지가 그 천간의 장생·건록지면 시너지 +0.5 (용신 투간이 제 뿌리 위 = twelveStage∈{장생,건록}).
// ★왜 壬申이 복귀하나: 申 오행=金(비겁·감점 라벨)이라 낮아 보이지만, 申 중기 壬水=용신(+1.0) +
//   壬 장생지=申(+0.5) → 페어링 +1.5로 상단 복귀. 세운(v2 드릴다운)도 이 헬퍼 그대로 재사용.
const HIDDEN_ROLE_BONUS: Record<'본기' | '중기' | '여기', number> = { 본기: 1.5, 중기: 1.0, 여기: 0.5 };
// ★묘고(墓庫) 게이트(daniel 2026-07-06): 辰戌丑未 지지의 지장간 중기·여기(갇힌 기운)는 **곡선 통근 크레딧에서 항상 불인정**.
//   개고(충/형)는 "창고가 열리는 방출 이벤트"지 "10년 내내 뿌리 서는 상태"가 아니므로 곡선(연속함수)엔 안 세고,
//   개고 성립은 R43/R44 이벤트 레이어로만 라우팅(정보손실 없음). → 辰戌충 상시개고 원국에서도 곡선 골 유지.
//   (R43 입묘개고 + 곡선/이벤트 분리 원칙 재확인. 범위=辰戌丑未 4개, 본기는 정상 인정. 申=생지라 무관.)
const MYOGO: Branch[] = ['辰', '戌', '丑', '未'];
function pairingBonus(stem: string, branch: string, useEl: string): number {
  let bonus = 0;
  const isMyogo = MYOGO.includes(branch as Branch);
  // ① 지장간 통근: 지지 지장간 중 용신 오행이면 역할(본기/중기/여기)별 가산(같은 오행 중복 역할이면 합산)
  for (const h of (HIDDEN[branch as Branch] ?? [])) {
    if (isMyogo && h.role !== '본기') continue; // ★묘고 중기·여기 = 곡선 불인정(개고 무관·이벤트 레이어로만)
    if (stemElement(h.stem) === useEl) bonus += HIDDEN_ROLE_BONUS[h.role];
  }
  // ② 천간=용신 & 지지=그 천간의 장생/건록 → 시너지(용신 투간이 뿌리 위에 앉음)
  if (stemElement(stem) === useEl) {
    const stage = twelveStage(stem as Stem, branch as Branch);
    if (stage === '장생' || stage === '건록') bonus += 0.5;
  }
  return bonus;
}

// 干支 한 쌍(천간·지지)의 용신 부합 점수 = (천간 5분류 × 0.4 + 지지 5분류 × 0.6)  − 비겁 과다감점  + 페어링 보정.
//   · base   = 대칭 5분류 점수를 (a) 가중치로 결합 → [−3,+3] 대칭.
//   · 비겁감점 = 비겁(일간 오행)이 놓인 자리 가중(천간 0.4 / 지지 0.6) × bigyeopPenalty(음수). 설기·비겁과다 분기에서만(else penalty=0).
//   · pairing = PATCH2 페어링 보정(지장간 통근 + 장생/건록 시너지).
function gzUsefulScore(
  stem: string, branch: string, cls: Record<string, HuiGi>, w: GzWeight,
  useEl: string, bigyeopEl: string, bigyeopPenalty: number,
): number {
  const s = HUIGI_SCORE[cls[stemElement(stem)]];     // 천간 오행 → 희기신 → 점수
  const b = HUIGI_SCORE[cls[branchElement(branch)]]; // 지지 오행 → 희기신 → 점수
  let raw = s * w.stem + b * w.branch;
  // 비겁 과다 감점(bigyeopPenalty<0): 비겁 오행이 천간/지지에 놓인 자리 가중만큼 감점 → 비겁 대운 하강.
  //   ※ penalty 는 음수(−1.25)라 그대로 '더한다'(= 크기만큼 빼는 것과 동일). 설기·비겁과다 분기 외엔 0이라 무영향.
  if (bigyeopPenalty !== 0) {
    let bw = 0;
    if (stemElement(stem) === bigyeopEl) bw += w.stem;     // 천간이 비겁 → 0.4
    if (branchElement(branch) === bigyeopEl) bw += w.branch; // 지지가 비겁 → 0.6
    raw += bw * bigyeopPenalty;
  }
  raw += pairingBonus(stem, branch, useEl);          // PATCH2 페어링 보정(±0 ~ +2.0)
  return raw;
}

export type LifePoint = { startAge: number; endAge: number; gz: string; score: number; turning: boolean; current: boolean };

/**
 * 대운별 용신 부합 점수(0~100) 곡선 + 변곡점.
 * @returns points(대운별) · usefulElement(쓴 용신 오행) · hasUseful(용신 산출 여부 — 없으면 폴백 사용)
 */
export function lifeGraph(saju: SajuChart): { points: LifePoint[]; usefulElement: string; hasUseful: boolean } {
  // ★용신 = 경량 억부(온디바이스 structure.usefulGod 비어있음, daniel 2026-07-06). 방향(부호) 뒤집힘 방지 = R2 부분집합 억부.
  const ya = computeYongsinApprox(saju);
  const useEl = ya.yongsin as string;
  const hasUseful = !ya.jonggyeokHold; // 종격 후보(판정 보류)면 곡선 신뢰도 낮음(Edge 위임)

  // (b) 5단 희기신 = 억부 결과(용신/희신/한신/기신/구신) 직접 매핑. 재생살 등 억부가 반영(희신 공란→한신 처리).
  const cls = Object.fromEntries((['木', '火', '土', '金', '水'] as Element[]).map((el) => [el, yongsinToClass5(el, ya)])) as Record<string, HuiGiClass>;

  const cur = saju.currentLuck?.startAge;
  const dmEl = saju.dayMaster.element as string; // 비겁 오행(일간) — 비겁 과다감점 대상
  // (a) 대운 곡선 = 대운 가중치(천간 0.4 / 지지 0.6) + 비겁 과다감점(설기분기) + 페어링 보정. 세운(GZ_WEIGHTS.세운)은 v2 드릴다운.
  const raw = (saju.luckCycles ?? []).map((lc) => ({
    lc,
    raw: gzUsefulScore(lc.stem, lc.branch, cls, GZ_WEIGHTS.대운, useEl, dmEl, ya.bigyeopExcessPenalty) * ya.amplitudeScale, // 중화=×0.5(진폭 절반·곡선 밋밋=정직)
  }));
  if (!raw.length) return { points: [], usefulElement: useEl, hasUseful };

  // (c) 0~100 정규화(min~max → 20~90, 밴드는 중앙선 55 기준 대칭). raw 가 [−3,+3] 대칭이라 우상향 편향 없음.
  //     min-max 상대 스트레치 유지 = 명식마다 최저 대운을 확실히 '골'로 보이게(daniel: 골이 깊어야 설명 수요).
  //     전 대운 점수 동일(평탄)하면 중앙(55).
  const vals = raw.map((r) => r.raw);
  const min = Math.min(...vals), max = Math.max(...vals);
  const norm = (v: number) => (max === min ? 55 : Math.round(20 + ((v - min) / (max - min)) * 70));

  return {
    points: raw.map((r, i) => {
      const score = norm(r.raw);
      const prev = i > 0 ? norm(raw[i - 1].raw) : score;
      return {
        startAge: r.lc.startAge,
        endAge: r.lc.startAge + 9,
        gz: `${r.lc.stem}${r.lc.branch}`,
        score,
        turning: i > 0 && Math.abs(score - prev) >= 25, // 인접 대운 대비 25점↑ 급변 = 변곡점
        current: r.lc.startAge === cur,
      };
    }),
    usefulElement: useEl,
    hasUseful,
  };
}
