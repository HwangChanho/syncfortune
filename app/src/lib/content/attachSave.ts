// src/lib/content/attachSave.ts — 애착 설문 응답 저장 (동의 기반 · 파생값만 업로드)
// ─────────────────────────────────────────────────────────────────────────
// 왜 저장하나: `attachAxes` 의 항목별 비중이 지금 v0(전부 같은 무게)다.
//   N=300~500 이 모여야 ridge 회귀로 실제 비중을 뽑을 수 있다(전문가 §5). 이 파일이 그 표본을 모은다.
//
// ★★개인정보 — 전문가 §10. 이 파일이 지켜야 하는 가장 중요한 규칙:
//   **생년월일시를 서버로 보내지 않는다.** 생년월일'시'는 사실상 준식별자다.
//   → 지표를 **기기에서** 계산해 **파생값만** 올린다. 원본 생일은 기기를 떠나지 않는다.
//   ⇒ 전문가가 설계한 '연결 테이블 분리 후 파기'가 애초에 필요 없어진다(더 강한 보호).
//   ⚠️대가: 엔진이 바뀌면 과거 행을 **재계산할 수 없다**. 그래서 engine_ver 를 반드시 남기고,
//     분석할 때 버전이 다른 행을 한 회귀에 섞지 않는다(0019 마이그레이션 주석 참조).
//
//   **동의는 분리한다.** 서비스 이용 동의에 연구 이용을 묶을 수 없다 →
//   `consent=false` 면 **아무것도 올리지 않는다**(행 자체를 만들지 않는다). 콘텐츠는 동의와 무관하게 동작한다.
// ─────────────────────────────────────────────────────────────────────────
import { supabase } from '../supabase';
import { computeChart } from '../engine/engine';
import { attachIndicators } from '@engine/attachIndicators';
import { johu2 } from '@engine/johu2';
import { attachAxes } from '@engine/attachAxes';
import { scoreSurvey, type AttachAnswers } from './attachSurvey';
import type { ChartInput } from '@spec/chart';

/** 문항 세트 버전 — `attachSurvey.ts` 의 문항을 고치면 **반드시** 올린다(섞인 표본을 구분하려고). */
export const SURVEY_VER = 1;
/** L1 엔진 버전 — Edge interpret 의 ENGINE_VER 와 같은 의미. 엔진 산출이 바뀌면 올린다. */
export const ENGINE_VER = 1;

/**
 * 가장 가까운 대운 교체까지 남은 연수.
 * ★왜 이 값만 남기나: 전문가가 "가장 좋은 설계"라 한 **대운 경계 ±2년 설계**(§5)에 필요한 건
 *   경계와의 거리 하나뿐이다. 생년월일시를 보내지 않고도 그 분석이 된다.
 *   대운수가 사람마다 달라 **연령 효과와 대운 효과가 분리**되는 것이 이 설계의 핵심이다.
 * @param cycles 대운 목록(startAge 오름차순 가정 — 엔진 출력 그대로)
 * @param age 현재 만 나이 기준 대운 나이
 * @returns 가장 가까운 경계까지의 |연수|. 대운 정보가 없으면 undefined.
 */
function daeunEdgeYears(cycles: { startAge: number }[] | undefined, age: number): number | undefined {
  if (!cycles?.length) return undefined;
  // 경계 = 각 대운의 시작 나이. 그중 현재 나이와 가장 가까운 것과의 거리.
  const d = cycles.map((c) => Math.abs(age - c.startAge)).sort((a, b) => a - b)[0];
  return Number.isFinite(d) ? Math.round(d * 10) / 10 : undefined;
}

export type SaveOutcome =
  | { ok: true }
  | { ok: false; reason: 'no-consent' | 'not-signed-in' | 'incomplete' | 'error'; message?: string };

/**
 * 응답 저장. **동의가 없으면 아무것도 하지 않는다.**
 *
 * @param answers 문항 id → 1~7
 * @param consent 연구 이용 별도 동의. false 면 저장하지 않고 `no-consent` 를 돌려준다(에러가 아니다).
 * @param input 명식 입력(있으면 사주 지표를 함께 남긴다). 없으면 설문만 저장한다.
 *              ★이 값은 **서버로 가지 않는다** — 지표 계산에만 쓰고 버린다.
 * @returns 저장 결과. 화면은 실패해도 결과 표시를 막지 않는다(수집은 부가 기능이다).
 */
export async function saveAttachResponse(
  answers: AttachAnswers,
  consent: boolean,
  input?: ChartInput,
): Promise<SaveOutcome> {
  if (!consent) return { ok: false, reason: 'no-consent' };

  const survey = scoreSurvey(answers);
  // 부분 응답은 축을 왜곡한다 — 표본에 넣지 않는다(화면도 미완이면 비교를 안 보여 준다).
  if (survey.answered !== survey.total) return { ok: false, reason: 'incomplete' };

  const { data: sess } = await supabase.auth.getSession();
  const uid = sess?.session?.user?.id;
  if (!uid) return { ok: false, reason: 'not-signed-in' };

  // ── 사주 파생값 (기기 계산) ──
  let indicators: unknown = null, axes: unknown = null;
  let monthBranch: string | null = null, edgeYrs: number | undefined;
  if (input) {
    try {
      const c = computeChart(input);
      // indicators 와 johu2 를 한 덩어리로 — 회귀 입력이 늘어도 DDL 이 필요 없다(jsonb).
      indicators = { ...attachIndicators(c.saju), johu2: johu2(c.saju) };
      axes = attachAxes(c.saju);
      monthBranch = c.saju.pillars['월'].branch;
      const birthYear = Number(String(input.birthDateTime ?? '').slice(0, 4));
      const age = birthYear ? new Date().getFullYear() - birthYear + 1 : NaN; // 대운은 세는나이 기준(엔진과 동일)
      edgeYrs = Number.isFinite(age) ? daeunEdgeYears(c.saju.luckCycles, age) : undefined;
    } catch {
      // 지표 계산이 실패해도 **설문만이라도** 남긴다 — 표본을 통째로 버리는 게 더 손해다.
      indicators = null; axes = null;
    }
  }

  const { error } = await supabase.from('attach_responses').insert({
    user_id: uid,
    answers,
    survey_anxiety: survey.anxiety,
    survey_avoidance: survey.avoidance,
    survey_solo: survey.avoidSolo,
    survey_close: survey.avoidClose,
    survey_ver: SURVEY_VER,
    indicators,
    axes,
    month_branch: monthBranch,
    daeun_edge_yrs: edgeYrs ?? null,
    engine_ver: ENGINE_VER,
    consent_research: true, // 위에서 consent 를 이미 확인했다. false 면 여기 도달하지 않는다.
  });
  if (error) return { ok: false, reason: 'error', message: error.message };
  return { ok: true };
}
