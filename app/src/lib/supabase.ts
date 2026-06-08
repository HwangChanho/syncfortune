// app/src/lib/supabase.ts — Supabase 클라이언트 (L3 연결)
// ─────────────────────────────────────────────────────────────────────────
// 세션 토큰은 expo-secure-store(기기 하드웨어 암호화)에 — PII·세션 보호(ADR-032).
// ─────────────────────────────────────────────────────────────────────────
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

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
  },
});
