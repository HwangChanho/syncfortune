// app/src/lib/theme.ts — 디자인 토큰 + 다크/라이트 테마(daniel 2026-06-24)
// ─────────────────────────────────────────────────────────────────────────
// 목적: 전 화면 비주얼을 단일 토큰으로 통일(색·라운드·간격·그림자·타이포).
// ★다크/라이트 전환(daniel): 61개 화면의 StyleSheet.create 를 일일이 고치지 않고,
//   *모듈 로드 시점*에 활성 팔레트를 colors 에 채워(아래 buildColors) 전 화면이 자동 반영되게 한다.
//   - 기본 = 디바이스(Appearance) 따라감 / 설정에서 '다크·라이트' 강제 가능(SecureStore 'theme_pref').
//   - SecureStore.getItem(동기)로 로드 시점에 즉시 결정(첫 렌더부터 올바른 테마).
//   - 토글 변경은 *재시작 후 적용*(StyleSheet 캐시 특성 — 설정에서 안내). 시스템 변경도 재시작 시 반영.
// ─────────────────────────────────────────────────────────────────────────
import { Appearance, DevSettings } from 'react-native';
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
  bg: '#F2EFE7', card: '#FBF5E8', sunk: '#EFE7D6', // 카드=흰색(#FBFAF6)→따뜻한 연베이지(daniel 07-02: 글 적힌 부분 베이지)
  glass: 'rgba(251, 245, 232, 0.78)', glassLight: 'rgba(43, 38, 32, 0.05)',
  ink: '#2B2722', inkSoft: '#6A645B', inkFaint: '#9A938A', line: '#CDC3AF', // 카드 테두리 더 또렷(한지 배경 위 필드 분리, daniel 07-03)
  ju: '#A08948', juDeep: '#84703B', juSoft: '#EFEBE0', juLine: '#C9C0A6',
  gold: '#A08948', white: '#FFFFFF',
  // ★어두운 히어로 이미지 위 텍스트/스크림 — DARK와 동일값(이미지가 어두우므로 라이트모드에서도 밝은 글씨·어두운 스크림이라야 보임).
  onImage: '#F7F1E3', onImageSoft: 'rgba(247,241,227,0.86)', scrimHero: 'rgba(16,14,34,0.5)',
  // 한지 위 옅은 스크림(라이트) — 채도 낮춰 차분하게.
  //   labelScrim = 홈 카드 라벨바 거의 불투명(어두운 카드 이미지가 비치지 않도록 — daniel: 흰 배경에 어두운 그림 안 어울림).
  overlay: 'rgba(242,239,231,0.45)', overlaySoft: 'rgba(242,239,231,0.2)', overlayStrong: 'rgba(251,250,246,0.82)', labelScrim: 'rgba(249,247,241,0.97)',
};

// 로드 시점 동기 결정: 저장 오버라이드(다크/라이트) > 시스템(Appearance). 실패 시 다크.
function resolveScheme(): Scheme {
  let pref: ThemePref = 'system';
  try { pref = ((SecureStore as any).getItem?.(PREF_KEY) as ThemePref) || 'system'; } catch { /* 동기 미지원/오류 → system */ }
  if (pref === 'dark') return 'dark';
  if (pref === 'light') return 'light';
  try { return Appearance.getColorScheme() === 'light' ? 'light' : 'dark'; } catch { return 'dark'; }
}

export const activeScheme: Scheme = resolveScheme();

// 전 화면이 import 하는 색 토큰 — 활성 팔레트로 채움(첫 렌더부터 올바른 테마).
export const colors = { ...(activeScheme === 'light' ? LIGHT : DARK) };

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
  try { return ((SecureStore as any).getItem?.(PREF_KEY) as ThemePref) || 'system'; } catch { return 'system'; }
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

// ── 라운드(모서리) ───────────────────────────────────────────
export const radius = { sm: 10, md: 16, lg: 22, pill: 999 } as const;

// ── 간격(4pt 그리드) ─────────────────────────────────────────
export const space = (n: number) => n * 4;

// ── 그림자 ───────────────────────────────────────────────────
export const shadow = {
  card: { shadowColor: '#000', shadowOpacity: 0.11, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 }, // 라이트=한지 배경 위 카드 리프트 강화(muddy 필드 분리, daniel 07-03)
  soft: { shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
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
