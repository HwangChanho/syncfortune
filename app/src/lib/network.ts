// app/src/lib/network.ts — 네트워크 상태 (오프라인 감지·게이트)
// ─────────────────────────────────────────────────────────────────────────
// daniel: 오프라인이면 경고 + 캐시/온디바이스는 열람 가능, 신규 API(Edge) 호출은 차단.
//   온디바이스(명식·오늘운세·타로·펫·이달운세)는 네트워크 불요 → 무탈. Edge 호출만 게이트.
//   ※ 불확실(undefined)은 online 취급 — 멀쩡한 사용자 오탐 차단. 명시적 끊김만 offline.
// ─────────────────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import * as Network from 'expo-network';

function computeOnline(s: Network.NetworkState | null | undefined): boolean {
  if (s?.isInternetReachable === false) return false;
  if (s?.isConnected === false) return false;
  return true; // true 또는 불확실 → online
}

let _online = true; // 모듈 레벨(비컴포넌트 게이트용)
Network.getNetworkStateAsync().then((s) => { _online = computeOnline(s); }).catch(() => {});
try { Network.addNetworkStateListener((s) => { _online = computeOnline(s); }); } catch { /* 리스너 미지원 시 무시 */ }

/** 동기 온라인 여부(비컴포넌트 — Edge 호출 직전 게이트). */
export function isOnline(): boolean { return _online; }

/** 컴포넌트용 실시간 온라인 여부(오프라인 배너 등). */
export function useOnline(): boolean {
  const [online, setOnline] = useState(_online);
  useEffect(() => {
    let alive = true;
    Network.getNetworkStateAsync().then((s) => { _online = computeOnline(s); if (alive) setOnline(_online); }).catch(() => {});
    const sub = Network.addNetworkStateListener((s) => { _online = computeOnline(s); if (alive) setOnline(_online); });
    return () => { alive = false; (sub as any)?.remove?.(); };
  }, []);
  return online;
}

/** Edge/API 호출 전 게이트 — 오프라인이면 경고 후 false(=호출 막음). */
export function assertOnline(t: (k: string) => string): boolean {
  if (isOnline()) return true;
  Alert.alert(t('offline.title'), t('offline.msg'));
  return false;
}
