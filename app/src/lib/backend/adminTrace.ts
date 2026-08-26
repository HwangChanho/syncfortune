// app/src/lib/backend/adminTrace.ts — 관리자 계정 상세 추적(Edge 호출·RPC 자동 로깅)
// ─────────────────────────────────────────────────────────────────────────
// daniel 2026-07-30: "cksgh0316@gmail.com 계정은 따로 로깅을 해두라니깐"
//
// ★왜 필요했나(실측): app_logs 최근 24h 에 남은 건 **앱 생명주기뿐**이었다
//   (app_session 65 · app_inactive 45 · app_background 42 · auth_state 32 …).
//   정작 디버깅에 필요한 **Edge 호출·RPC 실패는 하나도 안 남았다.**
//   그래서 "AI 코치 네트워크 에러"의 원인을 코드만 읽고 추측할 수밖에 없었다(결국 못 찾았다).
//
// ★★설계: 호출 지점 24곳을 하나씩 고치지 않는다(그러면 새로 추가되는 곳이 또 빠진다).
//   `supabase.functions.invoke` / `supabase.rpc` 를 **한 번 감싸서** 전부 자동으로 남긴다.
//   (전역 Text.render 패치로 글자 배율을 해결한 것과 같은 발상 — 단일 지점.)
//
// ⚠️개인정보: body 를 통째로 남기지 않는다. **키 이름과 크기·식별자만**(생년월일·질문 원문 금지).
// ⚠️관리자에게만 상세를 남긴다 — 일반 사용자는 **실패만**(로그 폭증·비용 방지).
// ─────────────────────────────────────────────────────────────────────────
import { supabase } from '../supabase';
import { logEvent } from './logger';

let installed = false;
let detailed = false;   // 관리자면 true — 성공까지 남긴다

/** 관리자 여부를 알려준다(로그인·전환 시 호출). false 면 실패만 남는다. */
export function setAdminTrace(v: boolean): void { detailed = v; }

/** body 에서 **안전한 요약만** 뽑는다(원문·PII 금지). */
function safeSummary(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object') return {};
  const b = body as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  // 식별·분기에 필요한 값만 화이트리스트로 남긴다
  for (const k of ['kind', 'category', 'tier', 'lang', 'refresh', 'preview', 'coach']) {
    if (b[k] !== undefined) out[k] = b[k];
  }
  if (typeof b.chartId === 'string') out.chartId = b.chartId.slice(0, 8);   // 앞 8자만(추적용)
  if (typeof b.question === 'string') out.qLen = b.question.length;          // 원문 금지 · 길이만
  out.keys = Object.keys(b).length;
  return out;
}

/**
 * 설치 — 앱 루트에서 **한 번만**. 재호출은 무시(중첩 래핑 방지).
 * ⚠️여기서 예외가 나면 앱 전체 통신이 죽는다 → 모든 경로를 try 로 감싸고 원본을 그대로 흘린다.
 */
export function installAdminTrace(): void {
  if (installed) return;
  installed = true;

  // ── Edge Functions ──
  try {
    const fns = (supabase as any).functions;
    const origInvoke = fns.invoke.bind(fns);
    fns.invoke = async (name: string, opts?: any) => {
      const t0 = Date.now();
      try {
        const res = await origInvoke(name, opts);
        const ms = Date.now() - t0;
        const err = (res as any)?.error;
        const data = (res as any)?.data;
        // 실패 신호 = error 또는 계약상 실패 플래그(needPayment/unavailable 등)
        const flag = data && typeof data === 'object'
          ? (['needPayment', 'needCredit', 'unavailable', 'error'] as const).find((k) => (data as any)[k])
          : undefined;
        if (err || flag) {
          logEvent('edge_fail', {
            fn: name, ms, flag: flag ?? null,
            msg: String(err?.message ?? (data as any)?.error ?? '').slice(0, 200),
            ...safeSummary(opts?.body),
          }, 'warn');
        } else if (detailed) {
          logEvent('edge_ok', { fn: name, ms, ...safeSummary(opts?.body) });
        }
        return res;
      } catch (e) {
        logEvent('edge_throw', { fn: name, ms: Date.now() - t0, msg: String((e as Error)?.message ?? e).slice(0, 200), ...safeSummary(opts?.body) }, 'error');
        throw e;
      }
    };
  } catch { /* 래핑 실패해도 앱은 정상 동작해야 한다 */ }

  // ── RPC (insert_chart_enc 등 — 코치 실패의 의심 지점이었다) ──
  try {
    const origRpc = (supabase as any).rpc.bind(supabase);
    (supabase as any).rpc = (fn: string, params?: any, opts?: any) => {
      const t0 = Date.now();
      const p = origRpc(fn, params, opts);

      // ★★★2026-08-26 실측 사고 — 이 래퍼가 **모든 RPC 를 두 번 실행시키고 있었다.**
      //   종전 코드는 `p.then(로깅)` 을 걸어 두고 `return p` 했다. 주석엔 *"then 을 걸어도 체이닝을
      //   깨지 않는다"* 라고만 적혀 있었는데, 깨지지 않는 것과 **한 번만 나가는 것은 다른 이야기**였다.
      //   `PostgrestBuilder.then()` 은 Promise 의 then 이 아니라 **호출될 때마다 새로 fetch 를 실행**한다
      //   (postgrest-js `PostgrestBuilder.ts` — then 본문에서 매번 `executeWithRetry()`. 결과 캐시 없음).
      //   ⇒ 래퍼가 ①번, 호출측 `await` 가 ②번 = **요청 2회**.
      //
      //   ★어떻게 드러났나: `app_logs` 의 **정확히 50%가 같은 lid 중복**이었다(8/10~8/26 내내, 웹·안드·iOS 모두 50%).
      //     같은 lid 두 행 = 「전송이 두 번」이라고 logger.ts 가 미리 적어 둔 덕에 방향을 안 헤맸다.
      //     두 행의 시간차가 97% 가 100ms 이내라 **재전송이 아니라 동시 2발**이라는 것도 값으로 갈렸다.
      //   ★실제 피해: `content_visits.visits` 가 **2배로 부풀었다**(`visits + 1` 이 두 번). 나머지 RPC 는
      //     운 좋게 전부 멱등이라(`insert_chart_enc` 는 지문 조회, `set_*` 은 upsert) 데이터는 살아남았다.
      //     — 멱등이라서 *안 터진 것*이지, 앞으로 비멱등 RPC 를 하나만 추가해도 바로 터진다.
      //
      //   처방: `then` 을 **한 번만 흘려보내고 그 결과를 재사용**하게 덮어쓴다.
      //     · 요청은 누가 처음 소비할 때 1회 (원래의 lazy 동작 유지 — 아무도 안 기다리면 안 나간다)
      //     · 체이닝(`.single()` 등)은 `p` 를 그대로 돌려주므로 그대로 산다
      //     · 로깅은 그 1회 결과에 얹는다 — 계측이 **관측 대상을 바꾸지 않는다**
      if (fn === 'log_event') return p;   // ★로거 자신은 감싸지 않는다(아래 §무한증폭) — 원본 그대로 흘린다
      try {
        const origThen = (p as any).then.bind(p);
        let once: Promise<any> | null = null;
        (p as any).then = (onF: any, onR: any) => {
          // ★지역 변수로 받는다 — 클로저 안이라 `once` 만으로는 타입이 좁혀지지 않는다
          let run = once;
          if (!run) {
            // ★실제 요청은 여기 딱 한 번. 이후 몇 번을 더 `.then` 해도 이 결과를 나눠 쓴다.
            run = origThen((res: any) => {
              const ms = Date.now() - t0;
              // ★★로거 자신은 로깅하지 않는다(2026-08-11 실측 사고).
              //   `logEvent` 는 내부에서 `supabase.rpc('log_event', …)` 를 부른다 → 그 호출이 이 래퍼를 다시 타고
              //   성공하면 또 `rpc_ok` 를 남긴다 = **무한 증폭**. 실측: `app_logs` **1,605,671행 중
              //   1,594,634행(99.3%)이 `rpc_ok`**(detail.fn = 'log_event')였고, `log_queue_overflow` 까지 났다.
              //   ⇒ 진짜 로그가 노이즈에 묻혀 **버그를 진단할 수 없었다**(궁합 생성 로그를 하나도 못 찾았다).
              //   지금은 위에서 `fn === 'log_event'` 를 아예 되돌려 보내므로 여기까지 오지 않는다.
              if (res?.error) {
                logEvent('rpc_fail', { fn, ms, code: res.error.code ?? null, msg: String(res.error.message ?? '').slice(0, 200) }, 'warn');
              } else if (detailed) {
                logEvent('rpc_ok', { fn, ms });
              }
              return res;   // ★반드시 그대로 흘린다 — 호출측이 받는 값이다
            });
            once = run;
          }
          return run!.then(onF, onR);
        };
      } catch { /* thenable 이 아니면 로깅만 건너뛴다(원본 동작은 그대로) */ }
      return p;
    };
  } catch { /* 무시 */ }
}
