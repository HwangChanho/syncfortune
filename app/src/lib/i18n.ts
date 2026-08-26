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

// ═══════════════════════════════════════════════════════════════════════════
// ★★풀이 언어 — **앱 UI 언어와 일부러 갈라 둔다** (Boss 2026-08-26
//   *"풀이 결과들을 각국의 다른 언어로도 볼 수 있으면 좋겠어"*)
//
// ■ 왜 가르나
//   UI 문구(위 `APP_LANGS`)는 낱말 1,800개를 **사람이 번역**해야 한 언어가 는다.
//   그런데 **풀이 본문은 LLM 이 그 자리에서 쓴다** — 번역 파일이 필요 없다.
//   ⇒ 하나로 묶어 두면 UI 번역이 끝날 때까지 풀이 언어도 못 늘린다. 그래서 갈랐다.
//   (한국어 UI 를 쓰면서 풀이만 영어로 받아 보는 것도 이 구조라서 된다.)
//
// ■ ★★명리 판단은 언어를 타지 않는다
//   언어를 바꿔도 서버는 **이미 나온 분석(L2)을 그대로 쓰고 표현(L3)만 그 언어로 다시 쓴다.**
//   같은 사람의 사주 해석이 언어마다 달라지면 그건 틀린 것이다.
//   덤으로 **언락은 언어를 안 가려서**(owner_id·chart_id·kind) 언어를 바꿔도 다시 결제하지 않는다.
//
// ⚠️서버(`supabase/functions/_shared/langs.ts`)에 **같은 목록**이 있다. 둘이 갈리면
//   앱은 보내는데 서버가 모르는 코드가 되어 조용히 한국어로 떨어진다 → `npm run check:readinglang` 이 지킨다.
// ═══════════════════════════════════════════════════════════════════════════
export const READING_LANGS = ['ko', 'en', 'ja', 'zh-Hans', 'zh-Hant', 'th', 'vi', 'id', 'es'] as const;
export type ReadingLang = (typeof READING_LANGS)[number];
/** 고르는 화면에 뜨는 이름 — **그 언어 쓰는 사람이 읽는 이름**으로 적는다(자국어 표기). */
export const READING_LANG_LABEL: Record<ReadingLang, string> = {
  ko: '한국어', en: 'English', ja: '日本語',
  'zh-Hans': '简体中文', 'zh-Hant': '繁體中文',
  th: 'ไทย', vi: 'Tiếng Việt', id: 'Bahasa Indonesia', es: 'Español',
};

const RLANG_KEY = 'reading_lang_v1';
/** null = **앱 언어를 따라간다**(기본). 값이 있으면 그것만 풀이에 쓴다. */
let rlangOverride: ReadingLang | null = null;
const rlangSubs = new Set<() => void>();

/** 풀이 언어가 바뀌면 알려 준다(화면이 다시 그리게). 해제 함수를 돌려준다. */
export function onReadingLangChange(fn: () => void): () => void {
  rlangSubs.add(fn);
  return () => rlangSubs.delete(fn);
}

/**
 * 지금 풀이를 어느 말로 받을지. **동기**다(`appLang()` 과 같은 자리에서 쓰이므로).
 * @returns 사용자가 고른 언어, 없으면 앱 언어
 */
export function readingLang(): ReadingLang { return rlangOverride ?? (appLang() as ReadingLang); }

/** 사용자가 «앱 언어를 따라간다»를 고른 상태인지 — 설정 화면의 표시용. */
export function isReadingLangAuto(): boolean { return rlangOverride == null; }

/**
 * 풀이 언어 변경 + 저장.
 * @param l 언어 코드, 또는 `null` = 앱 언어를 따라간다
 * ⚠️바꿔도 **이미 만든 풀이는 지우지 않는다** — 언어별로 따로 쌓이고, 되돌리면 즉시 예전 것이 보인다.
 */
export async function setReadingLang(l: ReadingLang | null): Promise<void> {
  rlangOverride = l;
  try {
    if (Platform.OS === 'web') {
      if (l) (globalThis as any).localStorage?.setItem(RLANG_KEY, l);
      else (globalThis as any).localStorage?.removeItem(RLANG_KEY);
    } else if (l) await SecureStore.setItemAsync(RLANG_KEY, l);
    else await SecureStore.deleteItemAsync(RLANG_KEY);
  } catch { /* 저장 실패해도 이번 실행에는 반영된다 */ }
  rlangSubs.forEach((f) => { try { f(); } catch { /* 구독자 하나가 죽어도 나머지는 알린다 */ } });
}

// 시작 시 저장된 선택 복원(있을 때만 — 없으면 앱 언어를 따라간다)
(async () => {
  try {
    const saved = Platform.OS === 'web'
      ? ((globalThis as any).localStorage?.getItem(RLANG_KEY) ?? null)
      : await SecureStore.getItemAsync(RLANG_KEY);
    if (saved && (READING_LANGS as readonly string[]).includes(saved)) {
      rlangOverride = saved as ReadingLang;
      rlangSubs.forEach((f) => { try { f(); } catch { /* 무시 */ } });
    }
  } catch { /* 못 읽으면 앱 언어를 따라간다 */ }
})();

export default i18n;
