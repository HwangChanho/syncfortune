// app/src/lib/logger.ts — DB 로그(app_logs) 기록 헬퍼 + 전역 크래시 로거
// ─────────────────────────────────────────────────────────────────────────
// daniel: "DB에 로그 구축해 확인 가능하게(30일 보관)." 서버 app_logs + log_event RPC 를 클라에서 호출.
//   · logEvent(event, detail?, level?) = fire-and-forget(실패해도 앱 흐름 안 막음).
//   · installCrashLogger() = RN ErrorUtils 전역 핸들러 → JS 치명 에러를 app_logs 에 남김.
//   ⚠️ 네이티브 크래시(예: 모달 present transition terminate)는 JS 핸들러로 못 잡는다 →
//      그런 경우는 *단계별 이벤트 로깅*(직전 지점 기록)으로 추적한다. 마지막 로그 = 크래시 직전 지점.
//   조회는 관리자만(RLS). detail 은 jsonb — 에러/맥락(chartId·kind·message)을 자유롭게.
// ─────────────────────────────────────────────────────────────────────────
import { Platform } from 'react-native';
import { supabase } from '../supabase';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// ★테스트/배포 로그 분리(daniel 07-02): 모든 로그에 env(dev/prod 빌드) + test(관리자·테스트모드 계정) 태그를 붙여
//   관리자 조회 시 실제 사용자 로그와 테스트 노이즈를 구분(detail->>'env' / detail->>'test'로 필터).
//   test 플래그 = 로그인 시 setLogTestContext(isAdmin || test_mode || admin_mode)로 설정(ads 테스트모드와 동일 신호).
let logTest = false;
export function setLogTestContext(v: boolean): void { logTest = v; }

/**
 * app_logs 에 1줄 기록(log_event RPC). fire-and-forget — 로깅 실패가 앱을 막지 않는다.
 * @param event 짧은 이벤트 키(예: 'love_generate_start', 'credit_use', 'edge_error')
 * @param detail 자유 컨텍스트(객체면 그대로 jsonb, 원시값이면 { msg })
 * @param level 'debug'|'info'|'warn'|'error' (기본 info)
 */
export function logEvent(event: string, detail?: unknown, level: LogLevel = 'info'): void {
  try {
    // 모든 로그에 env/test 태그(테스트↔배포 분리). 원본 detail 은 그대로 병합.
    const meta: Record<string, unknown> = { env: __DEV__ ? 'dev' : 'prod', ...(logTest ? { test: true } : {}) };
    const p_detail =
      detail == null ? meta : typeof detail === 'object' ? { ...meta, ...detail } : { ...meta, msg: String(detail) };
    // then(noop, noop) 으로 reject 도 삼킴(미처리 rejection 방지)
    supabase
      .rpc('log_event', { p_event: event, p_level: level, p_detail, p_platform: Platform.OS })
      .then(() => {}, () => {});
  } catch {
    /* 로깅은 best-effort — 어떤 실패도 무시 */
  }
}

let installed = false;
/**
 * 전역 JS 에러 핸들러 등록(앱 시작 시 1회). RN ErrorUtils 치명 에러를 app_logs('js_crash')에 남기고,
 * 기존 핸들러(개발 레드박스 등)는 그대로 호출해 동작을 바꾸지 않는다.
 *   ※ 네이티브 abort(예: UIViewController present 충돌)는 여기서 못 잡힘 → 단계 로깅으로 보완.
 */
export function installCrashLogger(): void {
  if (installed) return;
  installed = true;
  const g = global as any;
  try {
    const prev = g.ErrorUtils?.getGlobalHandler?.();
    g.ErrorUtils?.setGlobalHandler?.((error: any, isFatal?: boolean) => {
      logEvent(
        'js_crash',
        {
          message: error?.message ?? String(error),
          stack: String(error?.stack ?? '').slice(0, 4000),
          isFatal: !!isFatal,
        },
        'error',
      );
      prev?.(error, isFatal); // 기존 핸들러 유지(레드박스·재던짐)
    });
  } catch {
    /* ErrorUtils 없거나 실패 — 무시 */
  }
}
