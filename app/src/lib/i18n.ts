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


const resources = {
  ko: { translation: ko },
  en: { translation: en },
  ja: { translation: ja },
};

const device = Localization.getLocales()[0]?.languageCode ?? 'ko';
const lng = ['ko', 'en', 'ja'].includes(device) ? device : 'en';

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
export async function setAppLang(lng: 'ko' | 'en' | 'ja'): Promise<void> {
  i18n.changeLanguage(lng);
  try {
    if (Platform.OS === 'web') (globalThis as any).localStorage?.setItem(LANG_KEY, lng);
    else await SecureStore.setItemAsync(LANG_KEY, lng);
  } catch { /* persist 실패해도 런타임 반영은 됨 */ }
}
// 시작 시 저장된 선택이 있으면 기기 기본 위에 적용(있을 때만 — 없으면 기기 언어 유지)
getStored().then((saved) => { if (saved && ['ko', 'en', 'ja'].includes(saved) && saved !== i18n.language) i18n.changeLanguage(saved); });

// 현재 앱 언어(ko/en/ja) — 통변 생성/캐시를 언어별로 분기할 때 사용(Edge body.lang).
export function appLang(): 'ko' | 'en' | 'ja' {
  const l = (i18n.language || 'ko').slice(0, 2);
  return l === 'en' || l === 'ja' ? l : 'ko';
}

export default i18n;
