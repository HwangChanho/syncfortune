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
import { Alert } from './alert'; // 커스텀 알림(앱 디자인)

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

/** Edge/API 호출 전 게이트 — 오프라인이면 경고 후 false(=호출 막음). */
export function assertOnline(t: (k: string) => string): boolean {
  if (isOnline()) return true;
  Alert.alert(t('offline.title'), t('offline.msg'));
  return false;
}
