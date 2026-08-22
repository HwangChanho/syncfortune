// app/src/lib/fontScale.tsx — 앱 글자 크기(통변 가독성) 전역 스케일 (설정에서 조절)
// ─────────────────────────────────────────────────────────────────────────
// daniel: 설정에서 글자 크기 조절. 통변 등 '읽는 본문'에 곱해지는 배율(0.9~1.4)을 전역 보관.
//   SecureStore(native)/localStorage(web)에 저장 → 앱 재시작에도 유지. Context 로 즉시 반영.
//   ※ 본문(읽기) 텍스트에 적용 — `fs(base)` 헬퍼로 fontSize·lineHeight 를 곱한다(버튼/라벨 chrome 은 고정).
// ─────────────────────────────────────────────────────────────────────────
import { createContext, useContext, useEffect, useState, Fragment, type ReactNode } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import { webFontFactor } from './webFontFactor';   // ★웹: 뷰포트 폭 → 배율 보정(네이티브는 항상 1)
import * as SecureStore from 'expo-secure-store';

// ★★키를 v2 로 올렸다(2026-08-23). 기본 배율이 1.3 → **1.0** 으로 바뀌었는데,
//   키를 그대로 두면 이미 1.3 이 저장된 기기(=지금 테스터 전원)는 **계속 1.3 을 쓴다** —
//   "고쳤는데 그대로네"가 된다. 새 키로 시작해 전원이 새 기본값을 받는다.
//   ⚠️사용자가 일부러 고른 값을 한 번 버리는 셈이다. 출시 전이고, 시안 크기로 되돌리는 게
//     지금 목적이라 감수한다(설정에서 다시 키울 수 있다).
const KEY = 'font_scale_v2';

// 단계(설정 UI) — 라벨·배율.
// ★★2026-08-23 Boss *"1로 해줘 시안 그대로"* — **기본 = 1.0**.
//   ⚠️왜 바꿨나: 실측해 보니 화면 글자가 시안보다 **일관되게 1.33배**였다(12→16 · 15→20).
//     브라우저 설정이 아니라 이 값 때문이었고, 30% 커진 만큼 줄바꿈·여백·비율이 전부 어긋났다.
//     (Boss *"디자인이 시안이랑 다른거 같아"* 의 큰 원인 하나.)
// ★2026-07-27 에 '작게'를 없앴던 이력이 있다("글자 작게 아주 작게는 없애줘").
//   그때는 기본이 1.3 이라 1.0 이 '작게'였다. 지금은 1.0 이 **기본(시안 크기)** 이라 뜻이 다르다.
//   ⇒ 없애라던 그 단계를 되살린 게 아니라, 기준선 자체가 내려온 것이다.
export const FONT_STEPS: { key: string; ko: string; scale: number }[] = [
  { key: 'base', ko: '기본', scale: 1.0 },
  { key: 'md', ko: '중간', scale: 1.15 },
  { key: 'lg', ko: '크게', scale: 1.3 },
  { key: 'xl', ko: '아주 크게', scale: 1.45 },
];

export const DEFAULT_SCALE = 1.0; // 기본 글자 배율 = 시안 그대로
/** 남은 단계의 최소 배율 — 이보다 작게 저장돼 있던 기기(구버전 '작게' 1.0 등)를 끌어올리는 기준. */
/** 남은 단계의 최소 배율. ★`DEFAULT_SCALE` 과 함께 내려왔다 — 이게 1.15 로 남아 있으면
 *  마이그레이션이 1.0 저장값을 "범위 밖"으로 보고 기본값으로 되돌려 **1.0 을 고를 수 없다**. */
export const MIN_SCALE = 1.0;

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

/** `scale` = 실제 적용 배율(설정 × 폭 보정) · `rawScale` = 사용자가 고른 설정값(설정 화면용). */
type Ctx = { scale: number; rawScale: number; setScale: (s: number) => void };
const FontScaleContext = createContext<Ctx>({ scale: 1, rawScale: 1, setScale: () => {} });

/** 앱 루트에 감싸 전역 글자 배율 제공. 저장값을 1회 로드. */
export function FontScaleProvider({ children }: { children: ReactNode }) {
  const [scale, setScaleState] = useState(DEFAULT_SCALE); // 기본 = 1.0(시안 크기) — 사용자가 고른 값이 있으면 아래 effect 가 덮는다
  const { width } = useWindowDimensions();                // 창 크기·브라우저 확대에 따라 바뀐다
  const factor = webFontFactor(width, Platform.OS === 'web');
  const factorRef = factor;                               // setScale 안에서 최신 보정치를 쓰기 위한 별칭
  const effective = Math.round(scale * factor * 1000) / 1000;   // 설정값 × 폭 보정 = 실제 배율
  // ★★뷰포트 반응(daniel 2026-08-17 *"브라우저의 확대 축소 사이즈에 따라서 글씨크기를 반응하게"*).
  //   설정값 하나로 고정하면 창을 줄이거나 브라우저를 확대했을 때 글자만 남아 줄바꿈·잘림이 난다.
  //   ⇒ 폭에서 보정치를 뽑아 **설정값에 곱한다**. 브라우저 확대는 CSS 픽셀 폭을 줄이므로
  //     이 보정이 있으면 확대해도 레이아웃이 유지된다.
  //   ⚠️보정은 `currentScale`(글자를 키우는 전역 패치)과 context 의 `scale`(상자를 키우는 ls) **양쪽에**
  //     같이 들어가야 한다. 한쪽만 넣으면 '글자만 커지고 상자는 그대로' 라는 옛 함정이 그대로 재현된다.
  // 저장값이 단계 범위(1.0~1.45)면 적용. 범위 밖이거나 미설정이면 기본(1.0 = 시안 크기).
  //   ★이 마이그레이션이 없으면 '작게'를 골라 뒀던 기기는 선택지에서 사라진 값을 계속 쓴다(설정 화면과 실제가 어긋남).
  useEffect(() => {
    getRaw().then((v) => {
      const n = Number(v);
      const next = n >= MIN_SCALE && n <= 1.6 ? n : DEFAULT_SCALE;
      setScaleState(next);   // ★currentScale 은 아래 effect 가 보정까지 얹어 한 곳에서 갱신한다
    });
  }, []);
  // ★전역 Text 패치가 읽는 값 = **보정까지 얹은 실제 배율**. 설정이 바뀌든 창이 바뀌든 여기 한 곳에서 갱신한다.
  useEffect(() => { currentScale = effective; }, [effective]);
  const setScale = (s: number) => { currentScale = s * factorRef; setScaleState(s); setRaw(String(s)); };
  // ★key={scale} — 배율이 바뀌면 트리를 리마운트한다.
  //   고정 fontSize 를 쓰는 컴포넌트는 이 Context 를 **구독하지 않아** 값이 바뀌어도 리렌더되지 않는다.
  //   설정에서 가끔 바꾸는 값이라 리마운트 비용은 감수할 만하고, 이게 없으면 "설정을 바꿔도 그대로"가 된다.
  // ⚠️context 에 내려보내는 것도 **보정된 값**이다 — `ls()`(상자 치수)가 글자와 같은 비율로 커져야 한다.
  //   설정 화면은 사용자가 고른 원본이 필요하므로 `rawScale` 로 따로 준다.
  return (
    <FontScaleContext.Provider value={{ scale: effective, rawScale: scale, setScale }}>
      <Fragment key={effective}>{children}</Fragment>
    </FontScaleContext.Provider>
  );
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
  const { scale, rawScale, setScale } = useContext(FontScaleContext);
  const fs = (px: number) => px;   // 항등 — 실제 배율은 전역 패치가 적용
  /**
   * ★레이아웃 치수 스케일(daniel 2026-07-29 "글자크기 중간·큰 사이즈인데 둘다 짤려").
   *   fs() 를 항등으로 바꾼 뒤 **글자만 커지고 그 글자를 담는 상자는 그대로**여서 넘쳤다
   *   (지장간 원: 글자는 전역 패치로 12→17px 인데 원 지름은 fs(12)+8=20 에 고정).
   *   → **fontSize 는 fs(전역 패치가 곱함) · width/height/borderRadius 등 치수는 ls(여기서 곱함)** 로 나눈다.
   *   ⚠️치수에 fs() 를 쓰면 안 커진다. 글자를 담는 상자는 반드시 ls().
   */
  const ls = (px: number) => Math.round(px * scale);
  return { scale, rawScale, setScale, fs, ls };
}
