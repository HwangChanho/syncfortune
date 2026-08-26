// app/src/lib/i18n.ts — 다국어 (한·영·일). expo-localization 디바이스 언어 자동 + react-i18next.
// ─────────────────────────────────────────────────────────────────────────
// 화면은 useTranslation().t('key') 로 문자열을 가져온다. 키 누락 시 fallbackLng(en)로.
// ※ 통변(LLM 출력) 언어는 별도 — Edge 프롬프트에 locale 전달해 해당 언어로 생성(추후).
// ─────────────────────────────────────────────────────────────────────────
import 'intl-pluralrules'; // Hermes에 Intl.PluralRules 제공 — i18next init 전 로드(경고 조건 제거)
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// ★문구는 app/src/copy/*.ts 로 분리했다(daniel 2026-08-03) — 기획자가 한 파일만 열어 고칠 수 있게.
//   이 파일은 **배선만** 담당한다(초기화·언어감지·저장). 문구를 고치려면 copy/ko.ts 를 여십시오.
import { ko } from '../copy/ko';
import { en } from '../copy/en';
import { ja } from '../copy/ja';


/**
 * ★★앱 언어 — **여기가 단일 출처다.** (Boss 2026-08-26
 *   *"기본적으로 우리 서비스는 해외를 타게팅 할꺼야"* · *"중화권과 동남아도 타겟팅 해야해"*)
 *
 * ⚠️종전엔 `'ko' | 'en' | 'ja'` 가 **12개 파일에 하드코딩**돼 있었다.
 *   언어 하나를 붙이려면 열두 곳을 찾아 고쳐야 했고, 하나만 빠뜨려도 **그 화면만 조용히 옛 언어**로 남는다.
 *   ⇒ 목록과 타입을 여기서만 정하고, 나머지는 전부 이걸 가져다 쓴다.
 *
 * ★언어를 추가하는 법 (예: 중국어)
 *   ①`copy/zh.ts` 를 만든다 ②아래 `APP_LANGS` 에 한 줄 더한다 ③`resources` 에 등록한다
 *   ④`npm run typecheck:app` — **컴파일러가 손봐야 할 곳을 전부 짚어 준다**
 *     (`relationMapPhrases`·`taemongDict`·`joseonJob`·`nameReading` 등 언어별 사전)
 *   ⑤`npm run check:copy` — 키 누락·번역 안 된 값을 잡는다(C1·C5)
 */
export const APP_LANGS = ['ko', 'en', 'ja'] as const;
export type AppLang = (typeof APP_LANGS)[number];
/** 설정 화면에 뜨는 이름 — 언어를 더하면 여기도 같이 채운다(컴파일러가 강제한다). */
export const APP_LANG_LABEL: Record<AppLang, string> = { ko: '한국어', en: 'English', ja: '日本語' };

const resources = {
  ko: { translation: ko },
  en: { translation: en },
  ja: { translation: ja },
};

const device = Localization.getLocales()[0]?.languageCode ?? 'ko';
const lng = (APP_LANGS as readonly string[]).includes(device) ? device : 'en';

i18n.use(initReactI18next).init({
  resources,
  lng,
  fallbackLng: 'en',
  // Hermes(RN)는 Intl.PluralRules 미탑재 → i18next 경고 발생. 운세 앱 문자열은
  // 복수형 규칙이 단순(한·영·일)하므로 v3 호환 모드로 처리해 경고 제거(폴리필 불요).
  // 타입 정의는 'v4'만 허용하나, Hermes(Intl.PluralRules 미탑재) 안전을 위해 런타임은 'v3' 유지 → 캐스트로 우회.
  compatibilityJSON: 'v3' as 'v4',
  interpolation: { escapeValue: false },
});

// 언어 저장/복원 — 기본은 기기 언어(위 lng), 사용자가 설정에서 바꾸면 persist 해 재시작 후에도 유지(daniel).
const LANG_KEY = 'app_lang_v1';
async function getStored(): Promise<string | null> {
  try { return Platform.OS === 'web' ? ((globalThis as any).localStorage?.getItem(LANG_KEY) ?? null) : await SecureStore.getItemAsync(LANG_KEY); }
  catch { return null; }
}
/** 앱 언어 변경 + persist(설정 화면에서 호출). 기기 기본을 덮어쓴다. */
export async function setAppLang(lng: AppLang): Promise<void> {
  i18n.changeLanguage(lng);
  try {
    if (Platform.OS === 'web') (globalThis as any).localStorage?.setItem(LANG_KEY, lng);
    else await SecureStore.setItemAsync(LANG_KEY, lng);
  } catch { /* persist 실패해도 런타임 반영은 됨 */ }
}
// 시작 시 저장된 선택이 있으면 기기 기본 위에 적용(있을 때만 — 없으면 기기 언어 유지)
getStored().then((saved) => { if (saved && (APP_LANGS as readonly string[]).includes(saved) && saved !== i18n.language) i18n.changeLanguage(saved); });

// 현재 앱 언어(ko/en/ja) — 통변 생성/캐시를 언어별로 분기할 때 사용(Edge body.lang).
export function appLang(): AppLang {
  const l = (i18n.language || 'ko').slice(0, 2);
  return l === 'en' || l === 'ja' ? l : 'ko';
}

export default i18n;
