// app/src/lib/network.ts — 네트워크 상태 (오프라인 감지·게이트)
// ─────────────────────────────────────────────────────────────────────────
// daniel: 오프라인이면 경고 + 캐시/온디바이스는 열람 가능, 신규 API(Edge) 호출은 차단.
//   온디바이스(명식·오늘운세·타로·펫·이달운세)는 네트워크 불요 → 무탈. Edge 호출만 게이트.
//   ※ 불확실(undefined)은 online 취급 — 멀쩡한 사용자 오탐 차단. 명시적 끊김만 offline.
// ─────────────────────────────────────────────────────────────────────────
// ⚠️ expo-network 는 *네이티브 모듈* — 미포함 빌드(네이티브 추가 전 dev client)엔 없으므로
//   ads.ts 와 동일한 lazy require 가드: 모듈 없으면 항상 online 취급(흐름 안 막음).
//   정적 import + 모듈 top-level 네이티브 호출은 모듈 평가를 통째로 깨뜨려(→ import 하는 화면들이
//   "missing default export" 로 죽음) 절대 금지. 반드시 require 가드로 감싼다.
import { useState, useEffect } from 'react';
import { Alert } from '../ui/alert'; // 커스텀 알림(앱 디자인)

// 네이티브 모듈 lazy require — 미포함 빌드에서 import-time 크래시 방지.
let Network: any = null;
try { Network = require('expo-network'); } catch { Network = null; }

// NetworkState 형태(부분) — 모듈 유무와 무관하게 평가 가능하도록 any 로 받는다.
function computeOnline(s: any): boolean {
  if (s?.isInternetReachable === false) return false;
  if (s?.isConnected === false) return false;
  return true; // true 또는 불확실 → online
}

let _online = true; // 모듈 레벨(비컴포넌트 게이트용)
// 모듈 없거나 호출 실패해도 online 유지(오탐 차단).
try { Network?.getNetworkStateAsync?.().then((s: any) => { _online = computeOnline(s); }).catch(() => {}); } catch { /* 미지원 무시 */ }
try { Network?.addNetworkStateListener?.((s: any) => { _online = computeOnline(s); }); } catch { /* 리스너 미지원 시 무시 */ }

/** 동기 온라인 여부(비컴포넌트 — Edge 호출 직전 게이트). */
export function isOnline(): boolean { return _online; }

/** 컴포넌트용 실시간 온라인 여부(오프라인 배너 등). */
export function useOnline(): boolean {
  const [online, setOnline] = useState(_online);
  useEffect(() => {
    if (!Network) return; // 모듈 없으면 항상 online 폴백(리스너 미설치)
    let alive = true;
    let sub: any;
    try {
      Network.getNetworkStateAsync?.().then((s: any) => { _online = computeOnline(s); if (alive) setOnline(_online); }).catch(() => {});
      sub = Network.addNetworkStateListener?.((s: any) => { _online = computeOnline(s); if (alive) setOnline(_online); });
    } catch { /* 미지원 무시 */ }
    return () => { alive = false; sub?.remove?.(); };
  }, []);
  return online;
}

// ★네트워크 '오류' 알림(daniel 2026-07-27 "네트워크 오류가 발생했으면 얼럿을 띄워야지")
//   기존 assertOnline 은 **호출 전 오프라인**만 잡는다. 정작 사용자가 겪는 건
//   *호출은 나갔는데 실패/타임아웃* 인 경우이고, 그건 지금까지 catch 안에서 조용히 삼켜졌다
//   (풀이 생성 서버위임 실패 → 말없이 로컬 폴백, 폴백도 실패하면 아무 일도 안 일어남).
//   ⇒ 실패 지점에서 이걸 부르면 ①app_logs 에 남고 ②사용자에게 한 번 알린다.
//   ★같은 오류가 연달아 나도 얼럿은 THROTTLE_MS 에 한 번만 — 배치 실패 때 얼럿 폭탄을 막는다.
const ERR_THROTTLE_MS = 10_000;
let lastErrAt = 0;

/**
 * 네트워크/서버 호출 실패를 사용자에게 알리고 로그에 남긴다.
 * @param where 어디서 났는지(로그 식별자 — 예: 'reading.generate', 'coach.ask')
 * @param err 원인(Error·PostgrestError·문자열 무엇이든)
 * @param t i18n
 * @param opts silent=true 면 얼럿 없이 로깅만(폴백이 아직 남아 있을 때)
 */
export function notifyNetworkError(where: string, err: unknown, t: (k: any, d?: any) => string, opts?: { silent?: boolean }): void {
  const message = (err as any)?.message ?? String(err ?? '');
  try { require('./logger').logEvent('net_error', { where, message: String(message).slice(0, 500), online: _online }, 'error'); } catch { /* 로깅 실패 무시 */ }
  if (opts?.silent) return;
  const now = Date.now();
  if (now - lastErrAt < ERR_THROTTLE_MS) return;   // 연속 실패 시 얼럿 1회만
  lastErrAt = now;
  Alert.alert(
    t('net.errTitle', '연결에 문제가 있어요'),
    _online
      ? t('net.errMsg', '잠시 후 다시 시도해 주세요. 계속되면 잠시 뒤에 다시 열어 주세요.')
      : t('offline.msg'),
  );
}

/** Edge/API 호출 전 게이트 — 오프라인이면 경고 후 false(=호출 막음). */
export function assertOnline(t: (k: string) => string): boolean {
  if (isOnline()) return true;
  Alert.alert(t('offline.title'), t('offline.msg'));
  return false;
}
