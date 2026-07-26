// app/src/lib/core/features.ts — 신규 기능 노출 게이트(원격 플래그 + 관리자 오버라이드)
// ─────────────────────────────────────────────────────────────────────────
// 목적(★재제출 안전판): App Store 심사 반려 복구 중, 리스크 큰 신규(속궁합 17+·커뮤니티 UGC·위젯)를
//   리뷰어·일반 유저에겐 '숨기고' 관리자(daniel)에겐 '보이게'. 같은 바이너리 안에서 런타임 판정:
//     · 관리자(profiles.is_admin) = 항상 ON(빌드에 넣고 바로 테스트)
//     · 그 외 = 원격 플래그(app_flags.enabled)가 true 일 때만 ON — 심사 통과 후 daniel 이 플래그를 켜면
//       재빌드 없이 전 유저 공개. 로드 실패/미설정 = 기본 OFF(안전).
//   _layout 에서 세션 변경 시 loadFeatures() 호출. 메뉴/라우트가 useFeatureOn(key) 로 게이트.
// ─────────────────────────────────────────────────────────────────────────
import { useSyncExternalStore } from 'react';
import { supabase } from '../supabase';

export type FeatureKey = 'sokgunghap' | 'community' | 'widget';

// ★전체 공개 확정(daniel 2026-07-26 "속궁합 위젯은 전체공개로, 관리자에서 on off는 빼줘").
//   원격 플래그·관리자 오버라이드와 무관하게 **항상 ON**. 관리자 화면의 해당 토글도 제거했다.
//   · sokgunghap — ContentGrid 카드 필터가 이 키를 본다(전 유저 노출로 전환)
//   · widget — 실제 게이트 소비자가 0개다(iOS 위젯이 prebuild 블로커로 inert 상태). 즉 이 키를 켜도
//     노출되는 UI 가 없어 동작상 변화는 없고, 관리자 화면에서 의미 없는 토글만 사라진다.
//   ⚠️속궁합은 17+ 성격의 콘텐츠다 — 심사 제출 시 연령 등급·설명이 이 노출 상태와 맞는지 확인 필요.
const ALWAYS_ON: ReadonlySet<FeatureKey> = new Set<FeatureKey>(['sokgunghap', 'widget']);

let remoteFlags: Record<string, boolean> = {};
let isAdminCache = false;
const subs = new Set<() => void>();
function emit() { subs.forEach((f) => f()); }

/** 앱 시작/세션 변경 시 1회 — 원격 플래그(app_flags) + 내 관리자 여부 로드. 실패=안전하게 OFF. */
export async function loadFeatures(): Promise<void> {
  try {
    const { data: flags } = await supabase.from('app_flags').select('key, enabled');
    if (flags) remoteFlags = Object.fromEntries(flags.map((f: any) => [f.key, f.enabled === true]));
  } catch { /* 테이블 없음/실패 = 플래그 전부 off 유지 */ }
  try {
    const { data } = await supabase.auth.getUser();
    if (data?.user) {
      const { data: p } = await supabase.from('profiles').select('is_admin').eq('id', data.user.id).maybeSingle();
      isAdminCache = !!p?.is_admin;
    } else isAdminCache = false;
  } catch { isAdminCache = false; }
  emit();
}

/** 동기 판정 — 전체공개 확정 기능은 항상 ON / 그 외는 관리자 오버라이드 또는 원격 플래그(기본 OFF·안전판). */
export function isFeatureOn(key: FeatureKey): boolean {
  if (ALWAYS_ON.has(key)) return true; // 플래그·관리자 무관(daniel 07-26 전체공개 확정)
  return isAdminCache || remoteFlags[key] === true;
}

/** 관리자 UI용 — 현재 원격 플래그 원값(관리자 오버라이드 제외). 공개 전환 상태 표시. */
export function remoteFlagValue(key: FeatureKey): boolean {
  return remoteFlags[key] === true;
}

/** 관리자 토글 — set_app_flag RPC(서버 is_admin 게이트) 호출 후 로컬 캐시 갱신. 심사 통과 후 공개 전환용. */
export async function setAppFlag(key: FeatureKey, enabled: boolean): Promise<void> {
  await supabase.rpc('set_app_flag', { p_key: key, p_enabled: enabled });
  remoteFlags[key] = enabled;
  emit();
}

/** 리액트 구독 훅 — loadFeatures() 완료/세션 변경 시 자동 리렌더. */
export function useFeatureOn(key: FeatureKey): boolean {
  return useSyncExternalStore(
    (cb) => { subs.add(cb); return () => { subs.delete(cb); }; },
    () => isFeatureOn(key),
    () => false, // 서버/초기 스냅샷 = OFF
  );
}
