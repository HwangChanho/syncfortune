// app/src/lib/theme.ts — 디자인 토큰 + 다크/라이트 테마(daniel 2026-06-24)
// ─────────────────────────────────────────────────────────────────────────
// 목적: 전 화면 비주얼을 단일 토큰으로 통일(색·라운드·간격·그림자·타이포).
// ★다크/라이트 전환(daniel): 61개 화면의 StyleSheet.create 를 일일이 고치지 않고,
//   *모듈 로드 시점*에 활성 팔레트를 colors 에 채워(아래 buildColors) 전 화면이 자동 반영되게 한다.
//   - 기본 = 디바이스(Appearance) 따라감 / 설정에서 '다크·라이트' 강제 가능(SecureStore 'theme_pref').
//   - SecureStore.getItem(동기)로 로드 시점에 즉시 결정(첫 렌더부터 올바른 테마).
//   - 토글 변경은 *재시작 후 적용*(StyleSheet 캐시 특성 — 설정에서 안내). 시스템 변경도 재시작 시 반영.
// ─────────────────────────────────────────────────────────────────────────
import { DevSettings } from 'react-native'; // ★다크/라이트 제거(daniel 2026-07-15) — Appearance 불필요(소프트 클레이 단일 테마)
import * as SecureStore from 'expo-secure-store';
// ⚠️ expo-updates = 네이티브 모듈. theme.ts 는 거의 모든 화면이 import → *정적 import* 하면 런치 시 로드되어,
//   모듈/설정 이슈 시 JS 로거 설치 전 네이티브 크래시 위험(purchases.ts·ads.ts 와 동일 패턴 위반).
//   → lazy require 가드(setThemePref 호출 시에만 로드). 모듈 없으면 조용히 no-op(테마는 재시작 후 적용).
let Updates: any = null;
try { Updates = require('expo-updates'); } catch { Updates = null; }

export type ThemePref = 'system' | 'dark' | 'light';
export type Scheme = 'dark' | 'light';
const PREF_KEY = 'theme_pref';

// ── 다크 팔레트(미드나잇 — 남색 밤하늘 + 골드, 기존 기본) ──────────
const DARK = {
  bg: '#15132E', card: '#221F44', sunk: '#1A1838',
  glass: 'rgba(34, 31, 68, 0.7)', glassLight: 'rgba(237, 231, 214, 0.1)',
  ink: '#EDE7D6', inkSoft: '#ADA4C8', inkFaint: '#6E6692', line: '#332E58',
  ju: '#C9A14A', juDeep: '#A8843A', juSoft: '#2B2652', juLine: '#6B5A33',
  gold: '#C9A14A', white: '#FFFFFF',
  badgeGold: '#C9A14A', // ★배지 전용 금색 — 라이트/다크 동일(다크 금색). daniel 07-07: 라이트에서 배지 금색은 다크와 동일.
  // ★어두운 히어로 이미지 위 텍스트/스크림 — 스킴 무관 *항상* 밝은 글씨 + 어두운 스크림.
  //   (히어로 배너 이미지는 라이트모드에서도 어둡기 때문에 ink(라이트=어두움)를 쓰면 안 보임 — daniel 가시성 QA)
  onImage: '#F7F1E3', onImageSoft: 'rgba(247,241,227,0.86)', scrimHero: 'rgba(16,14,34,0.5)',
  // 배경 위 스크림(다크=남색 어둡게). 라이트에선 한지 위 옅은 베이지로 전환.
  //   labelScrim = 홈 카드 하단 라벨바(라이트는 거의 불투명 — 어두운 카드 이미지가 비쳐 안 어울리던 것 차단·daniel).
  overlay: 'rgba(21,19,46,0.6)', overlaySoft: 'rgba(21,19,46,0.3)', overlayStrong: 'rgba(21,19,46,0.85)', labelScrim: 'rgba(21,19,46,0.86)',
};
// ── 라이트 팔레트(한지 — 따뜻한 베이지 + 먹 + 깊은 골드) ──────────
const LIGHT = {
  // 전반 채도↓ + 이미지(미드나잇 네이비·골드 #C9A14A)와 조화(daniel 06-28). 노란기·탁함·순백대비 완화.
  // ★Apple 디자인(daniel 2026-07-15): iOS 클린 — 밝은 시스템 배경(systemGroupedBackground) + 순백 카드 + 뉴트럴 라벨.
  //   bg=옅은 시스템 그레이 / card=순백(계층으로 깊이, 그림자 아닌 대비) / line=iOS separator(연한 회색).
  bg: '#F2F2F7', card: '#FFFFFF', sunk: '#EAEAEF',
  glass: 'rgba(255, 255, 255, 0.72)', glassLight: 'rgba(60, 60, 67, 0.05)',
  ink: '#1C1C1E', inkSoft: '#48484A', inkFaint: '#8A8A8F', line: '#E3E3E8', // iOS label/secondaryLabel/tertiaryLabel/separator
  // ★리디자인(daniel 2026-07-14 '심플하면서 조화롭게' → 먹선 미니멀): 액센트 = 뮤트 골드 하나(조화로운 단일 포인트, daniel 선택).
  //   거창한 색 대신 여백·타이포·절제로 승부 — 색은 종이(bg)·먹(ink)·은은한 금(ju) 3톤으로 통일.
  ju: '#A08948', juDeep: '#84703B', juSoft: '#EFEBE0', juLine: '#C9C0A6',
  gold: '#A08948', white: '#FFFFFF',
  badgeGold: '#C9A14A', // ★배지 전용 금색 — 라이트에서도 다크 금색(밝은 #C9A14A) 사용. daniel 07-07(배지만 예외적 채도↑).
  // ★어두운 히어로 이미지 위 텍스트/스크림 — DARK와 동일값(이미지가 어두우므로 라이트모드에서도 밝은 글씨·어두운 스크림이라야 보임).
  onImage: '#F7F1E3', onImageSoft: 'rgba(247,241,227,0.86)', scrimHero: 'rgba(16,14,34,0.5)',
  // 한지 위 옅은 스크림(라이트) — 채도 낮춰 차분하게.
  //   labelScrim = 홈 카드 라벨바 거의 불투명(어두운 카드 이미지가 비치지 않도록 — daniel: 흰 배경에 어두운 그림 안 어울림).
  overlay: 'rgba(242,239,231,0.45)', overlaySoft: 'rgba(242,239,231,0.2)', overlayStrong: 'rgba(251,250,246,0.82)', labelScrim: 'rgba(249,247,241,0.97)',
};

// ── ★일간 오행 강조색(daniel 2026-07-15) ─────────────────────────
// 대표명식 *일간의 오행색*(오방색)을 앱 액센트(ju 계열)로. 설정에서 변경 가능: 자동(일간) / 오행 직접 / 골드.
//   ju·juDeep·juSoft·juLine 만 덮어씀 — gold·badgeGold(프리미엄 배지)는 골드로 유지. 색은 라이트 종이 기준 튜닝.
//   ※theme.ts는 저장된 오행 문자열만 읽음(엔진 의존 X). 대표명식→오행 산출·저장은 ui/themeElement.ts(_layout에서).
// ★배경까지 오행별로(daniel 2026-07-15 '배경색도 오행에 맞춰') — 코어 팔레트 전체를 일간 오행으로.
//   배경=은은한 동색 톤(소프트 클레이) / 강조(ju)=진한 오행색. gold/badgeGold(프리미엄)·overlay·scrim은 베이스 유지.
export type ElTheme = { bg: string; card: string; sunk: string; ink: string; inkSoft: string; inkFaint: string; line: string; ju: string; juDeep: string; juSoft: string; juLine: string };
// ★Apple 디자인 + 일간 오행 tint(daniel 2026-07-15): 배경=iOS 시스템 그레이에 오행 색조 아주 옅게 / 카드=순백 / ink=뉴트럴 라벨 /
//   ju=오행 tint(iOS accent color 개념·vivid). 그림자 대신 배경↔카드 대비로 깊이(Apple HIG).
const EL_THEME: Record<string, ElTheme> = {
  木: { bg: '#EFF3EE', card: '#FFFFFF', sunk: '#E6EBE4', ink: '#1C1C1E', inkSoft: '#48484A', inkFaint: '#8A8A8F', line: '#E0E6DE', ju: '#34A853', juDeep: '#278044', juSoft: '#EAF5EC', juLine: '#CDE7D3' }, // 나무=연한 그린그레이+iOS그린
  火: { bg: '#F5EFEE', card: '#FFFFFF', sunk: '#EDE4E2', ink: '#1C1C1E', inkSoft: '#48484A', inkFaint: '#8A8A8F', line: '#EBE0DE', ju: '#E1483A', juDeep: '#B4372C', juSoft: '#FCEBE9', juLine: '#F3D3CE' }, // 불=옅은 웜그레이+iOS레드
  土: { bg: '#F4F1EA', card: '#FFFFFF', sunk: '#ECE7DC', ink: '#1C1C1E', inkSoft: '#48484A', inkFaint: '#8A8A8F', line: '#E9E3D8', ju: '#C79A2E', juDeep: '#9E7A24', juSoft: '#F7F0DE', juLine: '#E9DCBB' }, // 흙=옅은 샌드그레이+골드
  金: { bg: '#F1F2F4', card: '#FFFFFF', sunk: '#E6E8EC', ink: '#1C1C1E', inkSoft: '#48484A', inkFaint: '#8A8A8F', line: '#E1E4E8', ju: '#5E6B7C', juDeep: '#47525F', juSoft: '#EEF1F4', juLine: '#D6DBE1' }, // 쇠=쿨 라이트그레이+강철빛
  水: { bg: '#EEF1F5', card: '#FFFFFF', sunk: '#E2E7EE', ink: '#1C1C1E', inkSoft: '#48484A', inkFaint: '#8A8A8F', line: '#DEE4EC', ju: '#3B6EC4', juDeep: '#2C5497', juSoft: '#E9F0FA', juLine: '#CDDBF0' }, // 물=옅은 블루그레이+iOS블루
};
// 설정 강조색 픽커 스와치(오행 대표색 + 골드). 'auto'는 activeAccentElement 색으로 표시.
export const ACCENT_SWATCH: Record<string, string> = {
  木: EL_THEME.木.ju, 火: EL_THEME.火.ju, 土: EL_THEME.土.ju, 金: EL_THEME.金.ju, 水: EL_THEME.水.ju, gold: '#A08948',
};
const ACCENT_KEY = 'pref.themeAccent';   // 'auto' | '木'|'火'|'土'|'金'|'水' | 'gold'
const ELEMENT_KEY = 'pref.themeElement'; // 대표명식 일간 오행(자동 액센트 소스) — themeElement.ts가 저장
const ELS = ['木', '火', '土', '金', '水'];

/** 일간 오행 테마 결정 — 설정 모드 + 저장된 일간 오행. null = 기본(土/클레이 팔레트 유지). */
function resolveAccent(): ElTheme | null {
  let mode = 'auto';
  try { mode = ((SecureStore as any).getItem?.(ACCENT_KEY) as string) || 'auto'; } catch { /* → auto */ }
  if (mode === 'gold') return null;                          // 기본(土 클레이) 고정 — 오행 강조 끔
  let el = '';
  if (ELS.includes(mode)) el = mode;                         // 오행 직접 선택
  else { try { el = ((SecureStore as any).getItem?.(ELEMENT_KEY) as string) || ''; } catch { /* 미저장 */ } } // auto=일간
  return (el && EL_THEME[el]) ? EL_THEME[el] : null;         // 오행 미결정 시 기본 폴백
}

// 로드 시점 동기 결정: 저장 오버라이드(다크/라이트) > 시스템(Appearance). 실패 시 다크.
// ★다크/라이트 테마 제거(daniel 2026-07-15) — 소프트 클레이 단일 테마. 항상 light(클레이) 팔레트.
//   (DARK 팔레트/setThemePref는 미사용으로 남겨둠 — 제거 시 churn만 큼. 설정 토글은 UI에서 삭제.)
function resolveScheme(): Scheme { return 'light'; }

export const activeScheme: Scheme = resolveScheme();

// 전 화면이 import 하는 색 토큰 — 활성 팔레트로 채움(첫 렌더부터 올바른 테마).
export const colors = { ...(activeScheme === 'light' ? LIGHT : DARK) };

// ★일간 오행 테마 적용 — 코어 팔레트 전체 덮어씀(bg·card·sunk·ink·line + 강조 ju계열). auto=일간 / 오행 / gold(기본).
//   gold·badgeGold(프리미엄)·onImage·scrim·overlay는 베이스 유지(EL_THEME에 없어 미덮음). font는 아래에서 갱신된 colors.ink 참조.
const _accent = resolveAccent();
if (_accent) Object.assign(colors, _accent);
// 활성 강조 오행(설정 UI 표시용) — auto면 저장된 일간 오행, 직접선택이면 그 오행, gold면 ''.
export const activeAccentElement: string = (() => {
  try {
    const m = ((SecureStore as any).getItem?.(ACCENT_KEY) as string) || 'auto';
    if (m === 'gold') return '';
    if (ELS.includes(m)) return m;
    return ((SecureStore as any).getItem?.(ELEMENT_KEY) as string) || '';
  } catch { return ''; }
})();

// 전 화면 배경 이미지 — 다크=밤하늘, 라이트=한지(daniel #다크모드). 둘 다 번들에 포함.
export const bgSource = activeScheme === 'light'
  ? require('../../assets/icons/bg-paper.jpg')
  : require('../../assets/icons/bg-night.png');

// 설정 토글 — 저장(재시작 후 적용). 동기/비동기 모두 시도.
export function setThemePref(p: ThemePref) {
  try { (SecureStore as any).setItem?.(PREF_KEY, p); } catch { /* noop */ } // 동기 저장(리로드 직후 로드 시 반영)
  SecureStore.setItemAsync(PREF_KEY, p).catch(() => {});
  // ★즉시 적용(daniel) — StyleSheet 캐시 특성상 JS 리로드로 새 팔레트를 앱 안 끄고 바로 반영.
  //   개발(dev client)=DevSettings.reload / 프로덕션=expo-updates reloadAsync(네이티브 → 다음 빌드부터 동작).
  if (__DEV__) { try { DevSettings.reload(); } catch { /* noop */ } }
  else { try { Updates?.reloadAsync?.().catch(() => {}); } catch { /* 모듈/설정 없으면 재시작 후 적용 */ } }
}
export function getThemePref(): ThemePref {
  try { return ((SecureStore as any).getItem?.(PREF_KEY) as ThemePref) || 'light'; } catch { return 'light'; } // 기본 = 한지 라이트(리디자인 C)
}

// ── ★일간 오행 강조색 설정 ──────────────────────────────────────
export type AccentMode = 'auto' | '木' | '火' | '土' | '金' | '水' | 'gold';
export function getThemeAccent(): AccentMode {
  try { return ((SecureStore as any).getItem?.(ACCENT_KEY) as AccentMode) || 'auto'; } catch { return 'auto'; }
}
/** 강조색 모드 변경(자동=일간 / 오행 직접 / 골드). 저장 후 즉시 반영(재시작). */
export function setThemeAccent(mode: AccentMode) {
  try { (SecureStore as any).setItem?.(ACCENT_KEY, mode); } catch { /* noop */ }
  SecureStore.setItemAsync(ACCENT_KEY, mode).catch(() => {});
  if (__DEV__) { try { DevSettings.reload(); } catch { /* noop */ } }
  else { try { Updates?.reloadAsync?.().catch(() => {}); } catch { /* 재시작 후 적용 */ } }
}
/** 대표명식 일간 오행 저장(themeElement.ts가 rep 변경/시작 시 호출). reload=true(대표명식 *변경*)일 때만 auto 모드 즉시 리로드. */
export function storeChartElement(el: string, reload = false) {
  if (!ELS.includes(el)) return;
  let prev = '';
  try { prev = ((SecureStore as any).getItem?.(ELEMENT_KEY) as string) || ''; } catch { /* noop */ }
  if (prev === el) return;
  try { (SecureStore as any).setItem?.(ELEMENT_KEY, el); } catch { /* noop */ }
  SecureStore.setItemAsync(ELEMENT_KEY, el).catch(() => {});
  // ★리로드는 reload=true(대표명식을 실제로 *변경*했을 때)만. 앱 시작·포그라운드 복귀(reload=false)는 저장만 한다.
  //   daniel 2026-07-18: 포그라운드 복귀마다 _layout 이 syncThemeElement 를 불러 여기 도달하는데, SecureStore 동기
  //   getItem 이 실패하면 prev='' 가 되어 prev!==el 로 오판 → **매 복귀 리로드**("백그라운드 갔다오면 새로고침")됐다.
  //   colors 는 모듈 로드 시 ELEMENT_KEY 를 읽으므로 저장만 해두면 *다음 실행*엔 자동 반영(리로드 불필요). 즉시 반영이
  //   필요한 대표명식 변경만 reload=true 로 리로드. 수동 오행선택(ACCENT_KEY≠auto)은 존중(리로드 안 함).
  if (reload) {
    let mode = 'auto';
    try { mode = ((SecureStore as any).getItem?.(ACCENT_KEY) as string) || 'auto'; } catch { /* noop */ }
    if (mode === 'auto') {
      if (__DEV__) { try { DevSettings.reload(); } catch { /* noop */ } }
      else { try { Updates?.reloadAsync?.().catch(() => {}); } catch { /* 재시작 후 반영 */ } }
    }
  }
}

// 로딩(인트로) 영상 on/off — daniel 07-03. 끄면 八字 한자 스플래시만. 기본 on. 다음 실행부터 반영(스플래시는 실행 시 1회).
// 로딩(인트로) 화면 모드 — 'video'(호랑이 영상) | 'text'(八字 한자) | 'off'(없음·바로 앱). 기본 video. daniel 07-03 / 07-15(off 추가).
const LOADING_MODE_KEY = 'pref.loadingMode';
const LOADING_VIDEO_KEY = 'pref.loadingVideo'; // 하위호환(옛 boolean '1'/'0')
// 풀이 로딩(생성 중 자물쇠 화면) 테마 영상 on/off — daniel 07-13. 아래 부팅 캐시 로더가 참조하므로 여기서 선언한다.
const READING_VIDEO_KEY = 'pref.readingVideo';
export type LoadingMode = 'video' | 'text' | 'off';
// ★★SecureStore 동기 읽기 함정(daniel 2026-07-19 "설정에서 풀이영상 온오프가 적용 안되는거 같아"):
//   `(SecureStore as any).getItem?.(k)` 는 **동기 API 자체가 없어서 undefined** 인 경우와
//   **값이 저장 안 돼서 null** 인 경우를 구분하지 못한다. 둘 다 기본값으로 떨어지므로,
//   유저가 끈 설정이 매번 '켜짐'으로 되살아났다(저장은 되는데 읽기가 안 되는 형태라 더 헷갈림).
//   → ①동기 API 유무를 먼저 판별하고 ②없으면 부팅 시 비동기로 채운 캐시를 쓰고 ③설정 변경 시 캐시를 즉시 갱신한다.
//   ※같은 뿌리의 사고 전례: 포그라운드 복귀마다 앱이 새로고침되던 건(check:reload 하네스).
/** 동기 읽기 결과: string=값 / null=값 없음(정상) / undefined=동기 API 불가(캐시로 폴백해야 함). */
function _syncGet(key: string): string | null | undefined {
  const f = (SecureStore as any).getItem;
  if (typeof f !== 'function') return undefined;
  try { return f.call(SecureStore, key); } catch { return undefined; }
}
let _loadingMode: LoadingMode | null = null; // 비동기 부팅 캐시
let _readingVideo: boolean | null = null;
// 부팅 시 1회 비동기 복원 — 동기 API 가 없는 환경에서도 다음 접근부터는 실제 저장값이 쓰인다.
SecureStore.getItemAsync(LOADING_MODE_KEY).then((v) => {
  if (v === 'video' || v === 'text' || v === 'off') { _loadingMode = v; return; }
  return SecureStore.getItemAsync(LOADING_VIDEO_KEY).then((old) => { if (old != null) _loadingMode = old === '0' ? 'text' : 'video'; });
}).catch(() => { /* 실패 시 기본값 유지 */ });
SecureStore.getItemAsync(READING_VIDEO_KEY).then((v) => { if (v != null) _readingVideo = v === '1'; }).catch(() => {});

export function getLoadingMode(): LoadingMode {
  const v = _syncGet(LOADING_MODE_KEY);
  if (v !== undefined) {                                    // 동기 읽기 가능한 환경
    if (v === 'video' || v === 'text' || v === 'off') return v;
    const old = _syncGet(LOADING_VIDEO_KEY);                // 옛 '0'=text(八字) 하위호환
    if (old !== undefined) return old === '0' ? 'text' : 'video';
  }
  return _loadingMode ?? 'video';                           // 비동기 캐시 → 아직 미로드면 기본값
}
export function setLoadingMode(m: LoadingMode) {
  _loadingMode = m;                                         // ★즉시 반영(같은 세션에서 바로 적용)
  try { (SecureStore as any).setItem?.(LOADING_MODE_KEY, m); } catch { /* noop */ }
  SecureStore.setItemAsync(LOADING_MODE_KEY, m).catch(() => {});
}

// 풀이 로딩 영상 — 끄면 영상 대신 링+자물쇠 애니만(즉시 반영·인트로와 별개 축). 기본 on. (키 선언은 위 부팅 캐시 블록 참고)
export function getReadingVideoEnabled(): boolean {
  // ★07-20 재수정(daniel "끔 했는데 자꾸 떠"): 07-19 수정이 _syncGet(동기 읽기) 값을 우선했는데, iOS SecureStore 의
  //   동기 getItem 이 setItemAsync 로 저장한 값을 곧바로/일관되게 못 읽는 경우(동기 setItem 부재 등)가 있어
  //   *끈 뒤에도 옛 값('켜짐')* 을 돌려줬다. → setter 가 즉시 갱신 + 부팅 async 캐시로 채우는 _readingVideo 를
  //   **신뢰 소스로 우선**하고, 동기 읽기는 부팅 캐시 미로드 초기 순간의 폴백으로만 쓴다.
  if (_readingVideo != null) return _readingVideo;            // 설정 저장·부팅 캐시(신뢰) 우선
  const v = _syncGet(READING_VIDEO_KEY);                      // 부팅 캐시 미로드 초기 순간만
  if (v !== undefined && v != null) return v === '1';
  return true;                                               // 아직 미로드 → 기본 on
}
export function setReadingVideoEnabled(on: boolean) {
  _readingVideo = on;                                        // ★즉시 반영(끄면 바로 다음 풀이부터 영상 없음)
  try { (SecureStore as any).setItem?.(READING_VIDEO_KEY, on ? '1' : '0'); } catch { /* noop */ }
  SecureStore.setItemAsync(READING_VIDEO_KEY, on ? '1' : '0').catch(() => {});
}

// ── 그라데이션 (프리미엄 질감) — 라이트에선 톤 조정 ─────────────
export const gradients = activeScheme === 'light'
  ? {
      gold: ['#CDB87C', '#A08948', '#84703B'], // 채도↓ 골드(LIGHT.ju 동기화)
      midnight: ['#FBFAF6', '#F2EFE7'],         // card·bg 채도↓
      glass: ['rgba(43,38,32,0.06)', 'rgba(43,38,32,0.02)'],
    }
  : {
      gold: ['#EBCF8A', '#C9A14A', '#A8843A'],
      midnight: ['#221F44', '#15132E'],
      glass: ['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.03)'],
    };

// ── 라운드(모서리) — ★Apple 디자인(daniel 2026-07-15): iOS continuous corner 감성(과하지 않게) ──
export const radius = { sm: 10, md: 14, lg: 20, pill: 999 } as const;

// ── 간격(4pt 그리드) ─────────────────────────────────────────
export const space = (n: number) => n * 4;

// ── 그림자 ───────────────────────────────────────────────────
// ★Apple 디자인(daniel 2026-07-15): 그림자 절제 — 순백 카드 vs 시스템 그레이 배경의 '대비'로 깊이(iOS HIG). 아주 미묘한 그림자만.
export const shadow = {
  card: { shadowColor: '#000', shadowOpacity: 0.20, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 8 }, // 음영 재강화(daniel 07-20 '여전히 입체감 없음') — 라이트 배경에 카드가 확실히 떠 보이게 오프셋·불투명·반경 상향(07-18 0.13/12/4 → 0.20/18/8)
  soft: { shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
} as const;

// ── 타이포 (colors 결정 후라 활성 테마 색 반영) ───────────────
export const font = {
  display: { fontSize: 30, fontWeight: '800' as const, color: colors.ink, letterSpacing: 0.3 },
  title: { fontSize: 22, fontWeight: '700' as const, color: colors.ink, letterSpacing: 0.2 },
  heading: { fontSize: 17, fontWeight: '700' as const, color: colors.ink },
  body: { fontSize: 15, fontWeight: '400' as const, color: colors.ink },
  label: { fontSize: 13, fontWeight: '600' as const, color: colors.inkSoft },
  caption: { fontSize: 12, fontWeight: '400' as const, color: colors.inkFaint },
} as const;
