// app/src/lib/backend/contentVisit.ts — 콘텐츠별 방문 로깅(로그인 유저 전용)
// ─────────────────────────────────────────────────────────────────────────
// daniel(2026-07-06): "콘텐츠마다 방문을 집계해 어떤 콘텐츠를 얼마나 보는지 알고 싶다."
//   서버 content_visits 테이블 + log_content_visit(p_kind) RPC(upsert +1, 로그인 전용) 를 클라에서 호출한다.
//   설계 원칙(logger.ts 의 logEvent 패턴을 따름):
//     · fire-and-forget — 로깅 실패/네트워크 오류가 UI·앱 흐름을 절대 막지 않는다(throw 안 함).
//     · 세션(로그인) 없으면 no-op — 서버 RPC 도 로그인 전용이지만, 비로그인 시 불필요한 네트워크도 아낀다.
//     · 디바운스(같은 kind 짧은 창 내 재호출 무시) — 한 화면 진입 = 1콜 보장(리렌더·포커스 재진입·StrictMode 이중호출 방어).
//   사용처: 콘텐츠 화면 진입 시 useLogContentVisit(kind) 한 줄(대부분) 또는 logContentVisit(kind) 직접 호출.
// ─────────────────────────────────────────────────────────────────────────
import { useEffect } from 'react';
import { supabase } from '../supabase';

// 같은 kind 재호출 디바운스 창(ms). 화면 진입 '1회'만 방문으로 세는 게 목적 —
//   리렌더·포커스 재진입·개발 StrictMode 이중 마운트로 인한 중복 +1(방문 횟수 왜곡)을 막는다.
//   창을 넘겨 다시 들어오면(예: 다른 콘텐츠 보고 돌아옴) 새 방문으로 정상 집계.
const DEBOUNCE_MS = 1500;
// kind → 마지막 기록 시각(ms). 모듈 스코프 = 앱 세션 전체에서 공유(distinct kind ≈ 44개, 메모리 무시 가능).
const lastLoggedAt: Record<string, number> = {};

/**
 * 콘텐츠 방문 1회를 서버에 기록한다(log_content_visit RPC · upsert +1). fire-and-forget.
 *   · 빈 kind 또는 세션 없음 → 조용히 no-op.
 *   · 같은 kind 를 DEBOUNCE_MS 내 다시 부르면 무시(한 화면 진입 = 1콜).
 * @param kind 콘텐츠 식별자 — 앱이 이미 쓰는 kind/route 문자열('saju'·'love'·'daily'·'monthly'·'taro' 등)을 그대로 사용.
 */
export function logContentVisit(kind: string): void {
  try {
    if (!kind) return;
    const now = Date.now();
    // 디바운스: 최근 동일 kind 기록이 창 안이면 스킵. (기록 성공 여부와 무관하게 창을 소비 — 중복 억제 우선)
    if (now - (lastLoggedAt[kind] ?? 0) < DEBOUNCE_MS) return;
    lastLoggedAt[kind] = now;
    // 세션 확인(비로그인 no-op) → 로그인 시에만 RPC. getSession 은 메모리/스토어 조회라 가볍다.
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) return; // 비로그인 → 서버도 집계 안 함, 네트워크 스킵
      // then(noop, noop) 으로 reject 도 삼킴(미처리 rejection 방지). 로깅은 best-effort.
      supabase.rpc('log_content_visit', { p_kind: kind }).then(() => {}, () => {});
    }, () => {});
  } catch {
    /* 로깅은 best-effort — 어떤 실패도 무시(UI 안 막음) */
  }
}

/**
 * 콘텐츠 화면 진입(마운트) 시 방문을 1회 기록하는 훅.
 *   함수형 콘텐츠 화면 최상단에 `useLogContentVisit('love')` 처럼 두면 진입 1회 집계된다.
 *   · kind 가 바뀌면(같은 화면에서 콘텐츠 전환) 다시 기록. falsy(undefined/'')면 대기 — no-op.
 *   · 실제 중복 억제는 logContentVisit 내부 디바운스가 담당(마운트 1회 + 방어).
 * @param kind 콘텐츠 식별자. 아직 확정 전이면 undefined/null 을 넘겨 로깅을 미룬다.
 */
export function useLogContentVisit(kind: string | undefined | null): void {
  useEffect(() => {
    if (kind) logContentVisit(kind);
  }, [kind]);
}
