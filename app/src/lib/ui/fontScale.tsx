// app/src/lib/fontScale.tsx — 앱 글자 크기(통변 가독성) 전역 스케일 (설정에서 조절)
// ─────────────────────────────────────────────────────────────────────────
// daniel: 설정에서 글자 크기 조절. 통변 등 '읽는 본문'에 곱해지는 배율(0.9~1.4)을 전역 보관.
//   SecureStore(native)/localStorage(web)에 저장 → 앱 재시작에도 유지. Context 로 즉시 반영.
//   ※ 본문(읽기) 텍스트에 적용 — `fs(base)` 헬퍼로 fontSize·lineHeight 를 곱한다(버튼/라벨 chrome 은 고정).
// ─────────────────────────────────────────────────────────────────────────
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const KEY = 'font_scale_v1';

// 단계(설정 UI) — 라벨·배율. 4단(작게·중간·크게·아주 크게). 기본 = 크게(1.3) — daniel.
export const FONT_STEPS: { key: string; ko: string; scale: number }[] = [
  { key: 'sm', ko: '작게', scale: 1.0 },
  { key: 'md', ko: '중간', scale: 1.15 },
  { key: 'lg', ko: '크게', scale: 1.3 },
  { key: 'xl', ko: '아주 크게', scale: 1.45 },
];

export const DEFAULT_SCALE = 1.3; // 기본 글자 배율 = 크게

async function getRaw(): Promise<string | null> {
  if (Platform.OS === 'web') return (globalThis as any).localStorage?.getItem(KEY) ?? null;
  return SecureStore.getItemAsync(KEY);
}
async function setRaw(v: string): Promise<void> {
  if (Platform.OS === 'web') (globalThis as any).localStorage?.setItem(KEY, v);
  else await SecureStore.setItemAsync(KEY, v);
}

type Ctx = { scale: number; setScale: (s: number) => void };
const FontScaleContext = createContext<Ctx>({ scale: 1, setScale: () => {} });

/** 앱 루트에 감싸 전역 글자 배율 제공. 저장값을 1회 로드. */
export function FontScaleProvider({ children }: { children: ReactNode }) {
  const [scale, setScaleState] = useState(DEFAULT_SCALE); // 기본 = 아주 크게
  // 저장값이 현재 단계(1.15·1.3) 범위면 적용, 아니면(미설정·구버전 0.9/1.0) 기본 1.3 으로 끌어올림.
  useEffect(() => { getRaw().then((v) => { const n = Number(v); setScaleState(n >= 1.0 && n <= 1.6 ? n : DEFAULT_SCALE); }); }, []);
  const setScale = (s: number) => { setScaleState(s); setRaw(String(s)); };
  return <FontScaleContext.Provider value={{ scale, setScale }}>{children}</FontScaleContext.Provider>;
}

/** 현재 배율 + 본문 크기 헬퍼. fs(15) → 스케일 곱한 px. 읽는 본문에 사용. */
export function useFontScale() {
  const { scale, setScale } = useContext(FontScaleContext);
  const fs = (px: number) => Math.round(px * scale);
  return { scale, setScale, fs };
}
