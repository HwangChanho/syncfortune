// app/src/lib/theme.ts — 디자인 토큰 + 다크/라이트 테마(daniel 2026-06-24)
// ─────────────────────────────────────────────────────────────────────────
// 목적: 전 화면 비주얼을 단일 토큰으로 통일(색·라운드·간격·그림자·타이포).
// ★다크/라이트 전환(daniel): 61개 화면의 StyleSheet.create 를 일일이 고치지 않고,
//   *모듈 로드 시점*에 활성 팔레트를 colors 에 채워(아래 buildColors) 전 화면이 자동 반영되게 한다.
//   - 기본 = 디바이스(Appearance) 따라감 / 설정에서 '다크·라이트' 강제 가능(SecureStore 'theme_pref').
//   - SecureStore.getItem(동기)로 로드 시점에 즉시 결정(첫 렌더부터 올바른 테마).
//   - 토글 변경은 *재시작 후 적용*(StyleSheet 캐시 특성 — 설정에서 안내). 시스템 변경도 재시작 시 반영.
// ─────────────────────────────────────────────────────────────────────────
import { Appearance } from 'react-native';
import * as SecureStore from 'expo-secure-store';

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
  // 배경 위 스크림(다크=남색 어둡게). 라이트에선 한지 위 옅은 베이지로 전환.
  overlay: 'rgba(21,19,46,0.6)', overlaySoft: 'rgba(21,19,46,0.3)', overlayStrong: 'rgba(21,19,46,0.85)',
};
// ── 라이트 팔레트(한지 — 따뜻한 베이지 + 먹 + 깊은 골드) ──────────
const LIGHT = {
  bg: '#F4EEDE', card: '#FFFFFF', sunk: '#ECE4D2',
  glass: 'rgba(255, 255, 255, 0.72)', glassLight: 'rgba(43, 38, 32, 0.05)',
  ink: '#2A2620', inkSoft: '#6B6356', inkFaint: '#9B9080', line: '#DED4BF',
  ju: '#9A7A2C', juDeep: '#7C611F', juSoft: '#F5ECD2', juLine: '#CBB983',
  gold: '#9A7A2C', white: '#FFFFFF',
  // 한지 위 옅은 베이지 스크림(라이트) — 다크의 남색 스크림 대체.
  overlay: 'rgba(244,238,222,0.45)', overlaySoft: 'rgba(244,238,222,0.2)', overlayStrong: 'rgba(255,255,255,0.82)',
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
  ? require('../../../assets/icons/bg-paper.jpg')
  : require('../../../assets/icons/bg-night.png');

// 설정 토글 — 저장(재시작 후 적용). 동기/비동기 모두 시도.
export function setThemePref(p: ThemePref) {
  try { (SecureStore as any).setItem?.(PREF_KEY, p); } catch { /* noop */ }
  SecureStore.setItemAsync(PREF_KEY, p).catch(() => {});
}
export function getThemePref(): ThemePref {
  try { return ((SecureStore as any).getItem?.(PREF_KEY) as ThemePref) || 'system'; } catch { return 'system'; }
}

// ── 그라데이션 (프리미엄 질감) — 라이트에선 톤 조정 ─────────────
export const gradients = activeScheme === 'light'
  ? {
      gold: ['#D9BE78', '#9A7A2C', '#7C611F'],
      midnight: ['#FFFFFF', '#F4EEDE'],
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
  card: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
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
