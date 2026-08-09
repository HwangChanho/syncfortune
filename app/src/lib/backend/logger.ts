// app/src/lib/logger.ts — DB 로그(app_logs) 기록 헬퍼 + 전역 크래시 로거
// ─────────────────────────────────────────────────────────────────────────
// daniel: "DB에 로그 구축해 확인 가능하게(30일 보관)." 서버 app_logs + log_event RPC 를 클라에서 호출.
//   · logEvent(event, detail?, level?) = fire-and-forget(실패해도 앱 흐름 안 막음).
//   · installCrashLogger() = RN ErrorUtils 전역 핸들러 → JS 치명 에러를 app_logs 에 남김.
//   ⚠️ 네이티브 크래시(예: 모달 present transition terminate)는 JS 핸들러로 못 잡는다 →
//      그런 경우는 *단계별 이벤트 로깅*(직전 지점 기록)으로 추적한다. 마지막 로그 = 크래시 직전 지점.
//   조회는 관리자만(RLS). detail 은 jsonb — 에러/맥락(chartId·kind·message)을 자유롭게.
//
// ★★2026-07-27 오프라인 큐 + 멈춤 감지 (daniel "이전에는 안 돼… 로깅을 다 담아둬", "앱이 중간중간 멈춰")
//   실제 사고: 07-27 16:14(KST) 이후 앱이 한동안 아무것도 동작하지 않았는데(로그아웃도 안 됨),
//   **app_logs 에 그 구간 기록이 하나도 없다.** 원인이 구조적이다 —
//   기존 logEvent 는 `supabase.rpc(...).then(noop, noop)` 이라 **전송 실패를 그냥 버렸다.**
//   즉 로그를 서버로 보내는데, 정작 기록이 필요한 구간은 그 서버에 못 닿는 구간이다(사각지대).
//   ⇒ ①모든 로그를 **먼저 로컬 큐에 적재**하고 전송 성공분만 지운다(복구 시 순서대로 올라감)
//     ②**JS 스레드 멈춤을 직접 측정**한다(하트비트 지연) — '중간중간 멈춘다'는 체감을 수치로 바꾼다
//     ③미처리 rejection·AppState·인증상태 변화를 남긴다(로그아웃이 안 되던 증상의 근거)
//   저장소 = expo-secure-store(이 앱 공통 스토리지 — AsyncStorage 미설치, genProgress 와 같은 선택).
// ─────────────────────────────────────────────────────────────────────────
import { Platform, AppState } from 'react-native';
import { withTimeout } from '../core/withTimeout'; // ★로그 플러시가 매달려 잠기는 것 방지(2026-08-09)
import * as SecureStore from 'expo-secure-store';
import { supabase } from '../supabase';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// ★테스트/배포 로그 분리(daniel 07-02): 모든 로그에 env(dev/prod 빌드) + test(관리자·테스트모드 계정) 태그를 붙여
//   관리자 조회 시 실제 사용자 로그와 테스트 노이즈를 구분(detail->>'env' / detail->>'test'로 필터).
//   test 플래그 = 로그인 시 setLogTestContext(isAdmin || test_mode || admin_mode)로 설정(ads 테스트모드와 동일 신호).
let logTest = false;
export function setLogTestContext(v: boolean): void { logTest = v; }

// ── 오프라인 큐 ───────────────────────────────────────────────────────────
const QKEY = 'log_queue_v1';
const QUEUE_MAX = 400;          // 이 이상은 오래된 것부터 버린다(용량·업로드 시간 방어)
const FLUSH_BATCH = 40;         // 한 번에 올릴 최대 건수

type Entry = { t: string; event: string; level: LogLevel; detail: Record<string, unknown> };
let queue: Entry[] = [];
let loaded = false;
let flushing = false;
let dropped = 0;                // 상한 초과로 버린 건수(다음 플러시에 함께 보고)

/** 큐를 디스크에서 한 번 읽어 온다. 실패는 무시 — 로깅이 앱을 막지 않는다. */
async function ensureLoaded(): Promise<void> {
  if (loaded) return;
  loaded = true;
  try { const raw = await SecureStore.getItemAsync(QKEY); if (raw) queue = JSON.parse(raw) as Entry[]; }
  catch { queue = []; }
}
/** 큐를 디스크에 쓴다. 자주 불리므로 실패해도 조용히 넘어간다. */
async function persist(): Promise<void> {
  try { await SecureStore.setItemAsync(QKEY, JSON.stringify(queue)); } catch { /* 무시 */ }
}

/**
 * 밀린 로그를 서버로 올린다. **성공한 것만** 큐에서 제거 → 실패 구간이 보존된다.
 * 동시 실행 방지(flushing) — 포그라운드 복귀와 신규 로그가 겹칠 수 있다.
 */
export async function flushLogQueue(): Promise<void> {
  if (flushing) return;
  flushing = true;
  try {
    await ensureLoaded();
    if (dropped > 0) {
      // 버린 사실 자체를 남긴다 — '로그가 없다'와 '버려서 없다'는 완전히 다른 진단이다.
      queue.unshift({ t: new Date().toISOString(), event: 'log_queue_overflow', level: 'warn', detail: { dropped } });
      dropped = 0;
    }
    while (queue.length > 0) {
      const batch = queue.slice(0, FLUSH_BATCH);
      let sent = 0;
      for (const e of batch) {
        // ★★타임아웃 필수(2026-08-09 실측 사고). 종전엔 `await supabase.rpc(...)` 를 맨몸으로 걸었다.
        //   네트워크가 끊기지 않고 **매달리면** 이 await 가 영영 안 끝나고 `finally` 도 실행되지 않아
        //   `flushing` 이 true 로 **잠긴다** → 이후 모든 로그가 큐에만 쌓이고 안 올라간다.
        //   실측 증상: `log_queue_overflow` 다수 + 로그 도착이 **20~27분** 지연(발생 13:49 → 도착 14:16).
        //   결제 원인 조사가 이 지연 때문에 사이클마다 30분씩 늘어졌다.
        //   → 응답이 없으면 undefined 로 끊고 **남은 큐는 보존**한다(다음 기회에 재시도).
        //   [[session-2026-07-31-handoff]] "supabase/fetch 는 기본 타임아웃이 없다"의 재발.
        const res = await withTimeout(supabase.rpc('log_event', {
          p_event: e.event, p_level: e.level,
          // 실제 발생 시각을 detail 에 실어 보낸다 — created_at 은 '전송 시각'이라 사고 구간이 뭉개진다.
          p_detail: { ...e.detail, at: e.t, queued: true }, p_platform: Platform.OS,
        }), 8000);
        if (!res || res.error) break;     // 타임아웃이거나 못 닿는다 → 남은 건 보존
        sent++;
      }
      queue = queue.slice(sent);
      await persist();
      if (sent < batch.length) break;
    }
  } catch { /* 무시 */ } finally { flushing = false; }
}

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
    // ★먼저 로컬 큐에 넣고 곧바로 플러시 시도 — 네트워크가 죽어 있어도 기록은 남는다(위 §사각지대).
    void (async () => {
      await ensureLoaded();
      queue.push({ t: new Date().toISOString(), event, level, detail: p_detail as Record<string, unknown> });
      if (queue.length > QUEUE_MAX) { dropped += queue.length - QUEUE_MAX; queue = queue.slice(-QUEUE_MAX); }
      await persist();
      await flushLogQueue();
    })();
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

  // ① 미처리 Promise rejection — 조용히 죽는 비동기 실패(기존엔 흔적이 전혀 없었다).
  try {
    const tracking = require('promise/setimmediate/rejection-tracking');
    tracking.enable({
      allRejections: true,
      onUnhandled: (_id: number, error: any) => {
        logEvent('unhandled_rejection', {
          message: error?.message ?? String(error),
          stack: String(error?.stack ?? '').slice(0, 2000),
        }, 'error');
      },
      onHandled: () => {},
    });
  } catch { /* 모듈 없으면 건너뜀 */ }

  // ② AppState — 포그라운드 복귀는 네트워크가 살아났을 가능성이 가장 큰 시점이라 밀린 로그를 밀어 올린다.
  try {
    AppState.addEventListener('change', (st) => {
      if (st === 'active') { logEvent('app_active'); void flushLogQueue(); }
      else logEvent('app_' + String(st));
    });
  } catch { /* 무시 */ }

  // ③ 인증 상태 변화 — "로그아웃도 안 돼"의 근거를 남긴다(토큰 갱신 실패·세션 소실 추적).
  try {
    supabase.auth.onAuthStateChange((event, session) => {
      logEvent('auth_state', { event, hasSession: !!session, expiresAt: session?.expires_at ?? null });
    });
  } catch { /* 무시 */ }

  installStallDetector();
}

// ── JS 스레드 멈춤 감지 ────────────────────────────────────────────────────
// daniel "앱이 중간중간 멈춰" — 체감을 **수치**로 바꾼다.
//   1초마다 깨어나는 타이머의 실제 지연(drift)을 잰다. JS 스레드가 막히면 타이머가 늦게 깨어나므로
//   그 지연폭이 곧 '멈춘 시간'이다. 임계값을 넘을 때만 기록해 로그 폭주를 막는다.
//   ★한계(정직하게): 네이티브 쪽 멈춤(메인 스레드 블로킹·네트워크 대기)은 JS 타이머가 정상이면 안 잡힌다.
//     그래도 RN 앱의 '멈춤' 대부분은 JS 스레드 블로킹이라 1차 진단으로 충분하다.
const STALL_TICK_MS = 1000;
const STALL_MIN_MS = 2500;     // 이 이상 늦게 깨어나면 '멈춤'으로 본다(GC·전환 지터는 걸러진다)
let stallInstalled = false;
export function installStallDetector(): void {
  if (stallInstalled) return;
  stallInstalled = true;
  let last = Date.now();
  setInterval(() => {
    const now = Date.now();
    const drift = now - last - STALL_TICK_MS;
    last = now;
    // 백그라운드에서는 타이머가 원래 늦게 깨어난다 → 활성 상태일 때만 '멈춤'으로 센다(오탐 제거).
    if (drift >= STALL_MIN_MS && AppState.currentState === 'active') {
      logEvent('js_stall', { ms: drift }, 'warn');
    }
  }, STALL_TICK_MS);
}
