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
  // ★소프트 클레이(daniel 2026-07-15): 따뜻한 점토 톤. bg=클레이 그라운드 / card=살짝 떠 보이는 밝은 클레이(부드러운 그림자로 리프트).
  bg: '#EAE2D2', card: '#F6EFDF', sunk: '#E0D7C3',
  glass: 'rgba(251, 245, 232, 0.78)', glassLight: 'rgba(43, 38, 32, 0.05)',
  ink: '#2B2722', inkSoft: '#6A645B', inkFaint: '#9A938A', line: '#CDC3AF', // 카드 테두리 더 또렷(한지 배경 위 필드 분리, daniel 07-03)
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
export type Accent = { ju: string; juDeep: string; juSoft: string; juLine: string };
const EL_ACCENT: Record<string, Accent> = {
  木: { ju: '#3E8E5A', juDeep: '#2F6E46', juSoft: '#E7F0EA', juLine: '#BFD9C9' }, // 청록(목)
  火: { ju: '#C0392B', juDeep: '#9A2D22', juSoft: '#F7E8E5', juLine: '#E4C2BC' }, // 적(화)
  土: { ju: '#A8862F', juDeep: '#846A28', juSoft: '#F1EBDB', juLine: '#D9CCA2' }, // 황·금(토)
  金: { ju: '#7E8C9E', juDeep: '#5E6B7C', juSoft: '#ECEEF2', juLine: '#C9CED7' }, // 백·강철(금)
  水: { ju: '#3A4E7A', juDeep: '#2A3A5E', juSoft: '#E8EBF2', juLine: '#C1C9DB' }, // 청흑·남(수)
};
// 설정 강조색 픽커 스와치(오행 대표색 + 골드). 'auto'는 activeAccentElement 색으로 표시.
export const ACCENT_SWATCH: Record<string, string> = {
  木: EL_ACCENT.木.ju, 火: EL_ACCENT.火.ju, 土: EL_ACCENT.土.ju, 金: EL_ACCENT.金.ju, 水: EL_ACCENT.水.ju, gold: '#A08948',
};
const ACCENT_KEY = 'pref.themeAccent';   // 'auto' | '木'|'火'|'土'|'金'|'水' | 'gold'
const ELEMENT_KEY = 'pref.themeElement'; // 대표명식 일간 오행(자동 액센트 소스) — themeElement.ts가 저장
const ELS = ['木', '火', '土', '金', '水'];

/** 강조색 결정 — 설정 모드 + 저장된 일간 오행. null = 골드(현행 팔레트 유지). */
function resolveAccent(): Accent | null {
  let mode = 'auto';
  try { mode = ((SecureStore as any).getItem?.(ACCENT_KEY) as string) || 'auto'; } catch { /* → auto */ }
  if (mode === 'gold') return null;                          // 골드 고정(오행 강조 끔)
  let el = '';
  if (ELS.includes(mode)) el = mode;                         // 오행 직접 선택
  else { try { el = ((SecureStore as any).getItem?.(ELEMENT_KEY) as string) || ''; } catch { /* 미저장 */ } } // auto=일간
  return (el && EL_ACCENT[el]) ? EL_ACCENT[el] : null;       // 오행 미결정 시 골드 폴백
}

// 로드 시점 동기 결정: 저장 오버라이드(다크/라이트) > 시스템(Appearance). 실패 시 다크.
// ★다크/라이트 테마 제거(daniel 2026-07-15) — 소프트 클레이 단일 테마. 항상 light(클레이) 팔레트.
//   (DARK 팔레트/setThemePref는 미사용으로 남겨둠 — 제거 시 churn만 큼. 설정 토글은 UI에서 삭제.)
function resolveScheme(): Scheme { return 'light'; }

export const activeScheme: Scheme = resolveScheme();

// 전 화면이 import 하는 색 토큰 — 활성 팔레트로 채움(첫 렌더부터 올바른 테마).
export const colors = { ...(activeScheme === 'light' ? LIGHT : DARK) };

// ★일간 오행 강조색 적용 — ju 계열만 덮어씀(auto=일간 / 오행 / gold). 미결정 시 골드 유지.
const _accent = resolveAccent();
if (_accent) { colors.ju = _accent.ju; colors.juDeep = _accent.juDeep; colors.juSoft = _accent.juSoft; colors.juLine = _accent.juLine; }
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
/** 대표명식 일간 오행 저장(themeElement.ts가 rep 변경/시작 시 호출). auto 모드면 색 반영. */
export function storeChartElement(el: string) {
  if (!ELS.includes(el)) return;
  let prev = '';
  try { prev = ((SecureStore as any).getItem?.(ELEMENT_KEY) as string) || ''; } catch { /* noop */ }
  if (prev === el) return;
  try { (SecureStore as any).setItem?.(ELEMENT_KEY, el); } catch { /* noop */ }
  SecureStore.setItemAsync(ELEMENT_KEY, el).catch(() => {});
  // ★첫 결정(이전 값 없음) + auto 모드 → 일간 색을 *즉시* 반영(1회 리로드). 이후 명식 전환은 다음 로드에(잦은 리로드 방지).
  //   activeScheme/colors 는 모듈 로드 시점 결정이라, 첫 실행에 이 리로드가 있어야 일간 색이 바로 보인다(daniel 2026-07-15).
  if (!prev) {
    let mode = 'auto';
    try { mode = ((SecureStore as any).getItem?.(ACCENT_KEY) as string) || 'auto'; } catch { /* noop */ }
    if (mode === 'auto') {
      if (__DEV__) { try { DevSettings.reload(); } catch { /* noop */ } }
      else { try { Updates?.reloadAsync?.().catch(() => {}); } catch { /* 재시작 후 반영 */ } }
    }
  }
}

// 로딩(인트로) 영상 on/off — daniel 07-03. 끄면 八字 한자 스플래시만. 기본 on. 다음 실행부터 반영(스플래시는 실행 시 1회).
const LOADING_VIDEO_KEY = 'pref.loadingVideo';
export function getLoadingVideoEnabled(): boolean {
  try { const v = (SecureStore as any).getItem?.(LOADING_VIDEO_KEY); return v == null ? true : v === '1'; } catch { return true; }
}
export function setLoadingVideoEnabled(on: boolean) {
  try { (SecureStore as any).setItem?.(LOADING_VIDEO_KEY, on ? '1' : '0'); } catch { /* noop */ }
  SecureStore.setItemAsync(LOADING_VIDEO_KEY, on ? '1' : '0').catch(() => {});
}

// 풀이 로딩(생성 중 자물쇠 화면) 테마 영상 on/off — daniel 07-13. 끄면 영상 대신 링+자물쇠 애니만(즉시 반영·인트로와 별개 축). 기본 on.
const READING_VIDEO_KEY = 'pref.readingVideo';
export function getReadingVideoEnabled(): boolean {
  try { const v = (SecureStore as any).getItem?.(READING_VIDEO_KEY); return v == null ? true : v === '1'; } catch { return true; }
}
export function setReadingVideoEnabled(on: boolean) {
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

// ── 라운드(모서리) — ★소프트 클레이(daniel 2026-07-15): 더 푹신하게 ──
export const radius = { sm: 12, md: 20, lg: 28, pill: 999 } as const;

// ── 간격(4pt 그리드) ─────────────────────────────────────────
export const space = (n: number) => n * 4;

// ── 그림자 ───────────────────────────────────────────────────
// ★소프트 클레이(daniel 2026-07-15): 따뜻한 색 + 크고 부드러운 그림자로 말랑하게 떠 보이는 리프트.
export const shadow = {
  card: { shadowColor: '#7A6644', shadowOpacity: 0.22, shadowRadius: 16, shadowOffset: { width: 0, height: 7 }, elevation: 6 },
  soft: { shadowColor: '#7A6644', shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
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
