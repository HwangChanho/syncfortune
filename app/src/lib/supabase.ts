// app/src/lib/supabase.ts — Supabase 클라이언트 (L3 연결)
// ─────────────────────────────────────────────────────────────────────────
// 세션 토큰은 expo-secure-store(기기 하드웨어 암호화)에 — PII·세션 보호(ADR-032).
// ─────────────────────────────────────────────────────────────────────────
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { Platform, AppState } from 'react-native';

// Supabase 연결값 — anon key 자체는 RLS 로 보호되는 *공개* 클라이언트 키이나,
//   퍼블릭 레포에 라이브 백엔드(특히 과금되는 Edge 함수)를 박으면 호출 남용 위험 → 환경변수 주입.
//   우선순위: EXPO_PUBLIC_* (.env, 빌드 시 번들에 자동 인라인) → app.json extra → placeholder.
//   실제 값은 app/.env (gitignore) 에 둔다(app/.env.example 참조). 변경 후 Metro 재시작 필요.
const extra: any =
  Constants.expoConfig?.extra ??
  (Constants as any).manifest?.extra ??
  (Constants as any).manifest2?.extra?.expoClient?.extra ??
  {};
const url =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  (extra.supabaseUrl as string) ||
  'https://YOUR_PROJECT_REF.supabase.co';
/** ★프로젝트 URL 을 **한 곳에서** 내보낸다 — Storage 이미지 URL(remoteAsset)이 사본을 만들지 않게.
 *  사본을 두면 환경(dev/prod)이 갈릴 때 이미지가 조용히 깨진다. */
export const SUPABASE_URL = url;

const anonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  (extra.supabaseAnonKey as string) ||
  'YOUR_SUPABASE_ANON_KEY';

// SecureStore 어댑터 — 토큰을 기기 암호화 저장소에
const SecureStoreAdapter = {
  getItem: (k: string) => SecureStore.getItemAsync(k),
  setItem: (k: string, v: string) => SecureStore.setItemAsync(k, v),
  removeItem: (k: string) => SecureStore.deleteItemAsync(k),
};

export const supabase = createClient(url, anonKey, {
  auth: {
    // web 은 SecureStore(네이티브 전용) 미지원 → undefined 로 두면 supabase-js 가 localStorage 사용.
    // native(iOS/Android)는 기기 하드웨어 암호화 SecureStore(ADR-032).
    storage: Platform.OS === 'web' ? undefined : SecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce', // OAuth(구글) — 리다이렉트 ?code= → exchangeCodeForSession (모바일 권장)
  },
});

// ★★2026-07-27 근본수정 — 토큰 자동 갱신 AppState 배선 (daniel "갑자기 아무것도 동작 안 되고 로그아웃도 안 돼",
//   "네트워크를 불러올 수 없대 다 터지는데")
//
//   증상: 앱을 한동안 두었다 돌아오면 **모든 인증 호출이 실패**한다. 풀이·코치는 물론 **로그아웃까지** 안 되고,
//         잠시 뒤 저절로 회복되기도 한다. 서버는 멀쩡하다(외부에서 호출하면 정상 응답).
//   근인: `autoRefreshToken: true` 만으로는 **React Native 에서 부족하다.** 자동 갱신은 JS 타이머로 도는데
//         앱이 백그라운드로 가면 그 타이머가 멎는다 → 액세스 토큰(기본 1시간)이 만료된 채 복귀 →
//         이후 모든 요청이 401/네트워크 오류처럼 실패한다. `signOut()` 도 호출이라 같이 실패한다.
//         (실측 근거: 사고 구간에 코치 요청이 서버에 **한 건도 도달하지 않았다** — 코치는 LLM 호출 *전에*
//          행을 먼저 남기는데 그 행이 0건이었다. 즉 클라에서 나가지 못한 것. app_logs 가 끊긴 것도
//          log_event 가 인증 RPC 라서 같은 이유로 함께 막힌 것.)
//   해결: Supabase 공식 RN 지침대로 **포그라운드에서만 갱신 타이머를 돌린다.**
//         복귀 즉시 startAutoRefresh() 가 만료 토큰을 갱신하므로 '돌아오면 다 터지는' 구간이 사라진다.
//   ⚠️web 은 브라우저가 타이머를 유지하므로 배선하지 않는다(네이티브 전용).
if (Platform.OS !== 'web') {
  const applyAutoRefresh = (state: string) => {
    try {
      if (state === 'active') supabase.auth.startAutoRefresh();
      else supabase.auth.stopAutoRefresh();
    } catch { /* 갱신 배선 실패가 앱을 막지는 않는다 */ }
  };
  applyAutoRefresh(AppState.currentState ?? 'active'); // 시작 시점 상태 반영(콜드런치=active)
  AppState.addEventListener('change', applyAutoRefresh);
}
