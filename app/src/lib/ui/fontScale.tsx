// app/src/lib/fontScale.tsx — 앱 글자 크기(통변 가독성) 전역 스케일 (설정에서 조절)
// ─────────────────────────────────────────────────────────────────────────
// daniel: 설정에서 글자 크기 조절. 통변 등 '읽는 본문'에 곱해지는 배율(0.9~1.4)을 전역 보관.
//   SecureStore(native)/localStorage(web)에 저장 → 앱 재시작에도 유지. Context 로 즉시 반영.
//   ※ 본문(읽기) 텍스트에 적용 — `fs(base)` 헬퍼로 fontSize·lineHeight 를 곱한다(버튼/라벨 chrome 은 고정).
// ─────────────────────────────────────────────────────────────────────────
import { createContext, useContext, useEffect, useState, Fragment, type ReactNode } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const KEY = 'font_scale_v1';

// 단계(설정 UI) — 라벨·배율. 기본 = 크게(1.3) — daniel.
// ★2026-07-27(daniel "글자 작게 아주 작게는 없애줘"): **작은 단계를 없앴다.**
//   원래 최소는 '작게'(1.0)였고 '아주 작게'는 존재한 적이 없다 — 작은 쪽 끝을 걷어내라는 뜻으로 읽었다.
//   남은 3단 = 중간·크게·아주 크게. 최소 배율이 1.15 로 올라간다.
export const FONT_STEPS: { key: string; ko: string; scale: number }[] = [
  { key: 'md', ko: '중간', scale: 1.15 },
  { key: 'lg', ko: '크게', scale: 1.3 },
  { key: 'xl', ko: '아주 크게', scale: 1.45 },
];

export const DEFAULT_SCALE = 1.3; // 기본 글자 배율 = 크게
/** 남은 단계의 최소 배율 — 이보다 작게 저장돼 있던 기기(구버전 '작게' 1.0 등)를 끌어올리는 기준. */
export const MIN_SCALE = 1.15;

// ★★전역 배율의 단일 출처(daniel 2026-07-29 "전체 다 자동반영되게 코드구조를 미리 모듈화").
//   Text.render 전역 패치는 **훅을 쓸 수 없다**(React 컴포넌트가 아니다) → 모듈 변수로 현재 배율을 노출한다.
//   Provider 가 값을 바꿀 때 여기도 같이 갱신하므로, 화면이 fs() 를 쓰든 안 쓰든 **한 곳에서 전부 반영**된다.
//   ⇒ 새 화면을 추가할 때 fs() 를 기억할 필요가 없다. 이게 "하나씩 뒤져가며 수정"을 없애는 지점이다.
let currentScale = DEFAULT_SCALE;
/** 현재 글자 배율(훅 밖에서 읽기 — 전역 Text 패치 전용). */
export function getFontScale(): number { return currentScale; }

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
  // 저장값이 남은 단계 범위(1.15~1.45)면 적용. 그보다 작거나(구버전 '작게' 1.0·0.9) 미설정이면 기본(1.3)으로 끌어올린다.
  //   ★이 마이그레이션이 없으면 '작게'를 골라 뒀던 기기는 선택지에서 사라진 값을 계속 쓴다(설정 화면과 실제가 어긋남).
  useEffect(() => {
    getRaw().then((v) => {
      const n = Number(v);
      const next = n >= MIN_SCALE && n <= 1.6 ? n : DEFAULT_SCALE;
      currentScale = next;              // ★렌더 패치가 읽는 값도 함께(순서 중요 — state 보다 먼저 반영돼야 첫 렌더가 맞다)
      setScaleState(next);
    });
  }, []);
  const setScale = (s: number) => { currentScale = s; setScaleState(s); setRaw(String(s)); };
  // ★key={scale} — 배율이 바뀌면 트리를 리마운트한다.
  //   고정 fontSize 를 쓰는 컴포넌트는 이 Context 를 **구독하지 않아** 값이 바뀌어도 리렌더되지 않는다.
  //   설정에서 가끔 바꾸는 값이라 리마운트 비용은 감수할 만하고, 이게 없으면 "설정을 바꿔도 그대로"가 된다.
  return <FontScaleContext.Provider value={{ scale, setScale }}><Fragment key={scale}>{children}</Fragment></FontScaleContext.Provider>;
}

/**
 * 현재 배율 + 본문 크기 헬퍼.
 * ★fs() 는 이제 **항등 함수**다(daniel 2026-07-29 구조 개편).
 *   배율은 전역 Text 패치(installFontScale)가 **모든 텍스트에** 곱한다. 여기서 또 곱하면 이중 적용이다.
 *   시그니처를 남겨 둔 이유: 이미 440곳이 `fontSize: fs(15)` 로 쓰고 있고, 그 호출들은
 *   "이건 본문 글자"라는 **의도 표시**로서 여전히 읽을 가치가 있다(지우면 diff 만 커지고 얻는 게 없다).
 *   ⚠️ fs() 로 계산한 lineHeight 도 그대로 두면 된다 — 전역 패치가 fontSize·lineHeight 를 **같은 비율로** 키운다.
 */
export function useFontScale() {
  const { scale, setScale } = useContext(FontScaleContext);
  const fs = (px: number) => px;   // 항등 — 실제 배율은 전역 패치가 적용
  /**
   * ★레이아웃 치수 스케일(daniel 2026-07-29 "글자크기 중간·큰 사이즈인데 둘다 짤려").
   *   fs() 를 항등으로 바꾼 뒤 **글자만 커지고 그 글자를 담는 상자는 그대로**여서 넘쳤다
   *   (지장간 원: 글자는 전역 패치로 12→17px 인데 원 지름은 fs(12)+8=20 에 고정).
   *   → **fontSize 는 fs(전역 패치가 곱함) · width/height/borderRadius 등 치수는 ls(여기서 곱함)** 로 나눈다.
   *   ⚠️치수에 fs() 를 쓰면 안 커진다. 글자를 담는 상자는 반드시 ls().
   */
  const ls = (px: number) => Math.round(px * scale);
  return { scale, setScale, fs, ls };
}
