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
import { A } from '../lib/ui/remoteAsset'; // ★이미지 원격화(daniel 08-01) — 번들에서 걷어내고 Storage 에서 받는다
import { ELEMENT_PALETTE, DEFAULT_ELEMENT, type ThemeElement } from './theme/elementPalette'; // ★오행 전면 팔레트 단일 출처(시안 실측색)
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
// ── 라이트 팔레트(라벤더 — 흰 종이 + 보라 강조 + 파스텔) ──────────
// ★★2026-08-10 daniel 확정: 시안(`docs/design/ref-ui-2026-08-09.png`)의 **라벤더·파스텔**로 교체.
//   IA(탭 5개·카테고리 6개)는 그대로 두고 **비주얼만** 시안에 맞춘다(daniel 선택).
//   ⚠️경위 — 직전 팔레트(크림·골드)는 08-08 "이 디자인에 맞게" 지시를 내가 **앱 아이콘**으로 잘못 읽고
//     만든 것이다(시안 첨부가 세션에 들어오지 않았는데 물어보지 않았다). 실제 시안은 처음부터 라벤더였다.
//     ⇒ 교훈: "이 X" 가 가리키는 대상이 대화에 실제로 있는지 확인할 것.
//   ★여기 한 곳만 바꾸면 전 화면이 따라온다 — 화면들은 `colors` 토큰만 쓰고, 배경 이미지는 이미
//     걷어내 `ContentBackdrop` 이 `colors.bg` 를 칠한다(bgSource 는 미사용 잔존).
const LIGHT = {
  // 배경 = 흰색에 라벤더를 아주 옅게 태운 종이 / 카드 = 순백(그림자로 띄운다).
  bg: '#F7F5FD', card: '#FFFFFF', sunk: '#F1EEFA',
  glass: 'rgba(255, 255, 255, 0.80)', glassLight: 'rgba(124, 92, 224, 0.06)',
  // 글자 = 차콜에 남보라를 섞은 톤(시안 제목색). 순흑보다 라벤더 위에서 부드럽다.
  ink: '#2C2743', inkSoft: '#6A6486', inkFaint: '#A49EBE', line: '#E9E4F7',
  // 강조 = 라벤더 보라 하나(시안 주조색). 버튼·활성 탭·링크가 전부 이 색이다.
  ju: '#7C5CE0', juDeep: '#5F44BE', juSoft: '#F0EBFE', juLine: '#DDD3F8',
  gold: '#E0A42B', white: '#FFFFFF',
  badgeGold: '#E0A42B', // ★'운' 잔액·프리미엄 배지 금색 — 시안의 W 동전 톤.
  // ★어두운 히어로 이미지 위 텍스트/스크림 — 이미지가 어두우므로 밝은 글씨 + 어두운 스크림 유지.
  onImage: '#F6F3FF', onImageSoft: 'rgba(246,243,255,0.86)', scrimHero: 'rgba(28,22,58,0.5)',
  // ⚠️★`overlay` 는 이름과 달리 **두 용도**로 쓰인다 — 라이트 팔레트에서는 반드시 **밝은** 값이어야 한다:
  //     ① 칩·버튼 배경(`editBtn`·`orderBtn`·`dayTogChip`·`chipCare`) = 배경 위에 얹는 옅은 면
  //     ② 화면 전체 막(`overlay:{flex:1}` — today·month·healing 등 10여 화면)
  //   2026-08-10 라벤더 전환 때 이걸 '어두운 스크림'으로 잘못 잡았다가 홈 '⚡바로가기' 칩이
  //   **회색 알약**으로 떠서 실물 스크린샷에서 잡혔다. 어두운 스크림이 필요한 곳은 `scrimHero` 가 따로 있다.
  //   labelScrim 은 카드 하단 라벨바(어두운 카드 이미지가 비치지 않게 거의 불투명).
  overlay: 'rgba(240,236,253,0.55)', overlaySoft: 'rgba(240,236,253,0.28)', overlayStrong: 'rgba(255,255,255,0.88)', labelScrim: 'rgba(255,255,255,0.96)',
};

// ── ★파스텔 4색 + 딥 톤 (시안의 카테고리 카드·타로 배너) ────────────────────
//   화면마다 각자 하드코딩하지 말 것 — 같은 것을 여러 곳이 그리면 색이 갈린다(duplicate-ui-single-source).
//   쓰임: 카테고리 2×2 카드 배경/제목색 · 딥(진남색) = 타로처럼 밤하늘 톤이 필요한 배너.
export const pastel = {
  pink: { bg: '#FDEBF1', ink: '#C9436F' },   // 연애와 결혼
  blue: { bg: '#E7F0FD', ink: '#3568B8' },   // 취업과 커리어
  green: { bg: '#E6F4EC', ink: '#358457' },  // 재물과 사업
  amber: { bg: '#FDF3DF', ink: '#B5822A' },  // 건강과 가족
  deep: { bg: '#2B2456', ink: '#EDE9FF' },   // 진남색 배너(오늘의 타로)
} as const;

// ── ★일간 오행 강조색(daniel 2026-07-15) ─────────────────────────
// 대표명식 *일간의 오행색*(오방색)을 앱 액센트(ju 계열)로. 설정에서 변경 가능: 자동(일간) / 오행 직접 / 골드.
//   ju·juDeep·juSoft·juLine 만 덮어씀 — gold·badgeGold(프리미엄 배지)는 골드로 유지. 색은 라이트 종이 기준 튜닝.
//   ※theme.ts는 저장된 오행 문자열만 읽음(엔진 의존 X). 대표명식→오행 산출·저장은 ui/themeElement.ts(_layout에서).
// ★배경까지 오행별로(daniel 2026-07-15 '배경색도 오행에 맞춰') — 코어 팔레트 전체를 일간 오행으로.
//   배경=은은한 동색 톤(소프트 클레이) / 강조(ju)=진한 오행색. gold/badgeGold(프리미엄)·overlay·scrim은 베이스 유지.
// ★옛 `ElTheme`·`EL_BG` 는 **삭제**했다(2026-08-18 전면 틴트 전환).
//   오행 색의 단일 출처는 `lib/theme/elementPalette.ts` 다 — 남겨 두면 어느 쪽이 진짜인지 모르게 된다.
// 설정 픽커 스와치 — ★**실제 적용되는 배경색**을 보여준다.
//   전면 틴트로 바뀌면서(2026-08-18) 오행별 배경 차이가 뚜렷해져 픽커에서도 바로 구분된다.
export const ACCENT_SWATCH: Record<string, string> = {
  木: ELEMENT_PALETTE.木.bg, 火: ELEMENT_PALETTE.火.bg, 土: ELEMENT_PALETTE.土.bg,
  金: ELEMENT_PALETTE.金.bg, 水: ELEMENT_PALETTE.水.bg,
  gold: ELEMENT_PALETTE[DEFAULT_ELEMENT].bg,   // '기본' = 중립(무채) — 오행에서 金 이 곧 백색이다
};
const ACCENT_KEY = 'pref.themeAccent';   // 'auto' | '木'|'火'|'土'|'金'|'水' | 'gold'
const ELEMENT_KEY = 'pref.themeElement'; // 대표명식 일간 오행(자동 액센트 소스) — themeElement.ts가 저장
const ELS: ThemeElement[] = ['木', '火', '土', '金', '水'];

/**
 * 적용할 오행 결정 — 설정 모드 + 저장된 대표명식 일간 오행.
 *
 * @returns 적용할 오행. 'gold'(기본) 이거나 오행 미결정이면 `DEFAULT_ELEMENT`(중립).
 *
 * ★**2026-08-18 전면 틴트로 되돌림**(daniel: 시안 `니운내운.pdf` 대로).
 *   2026-08-07 에 "배경 한 값만"으로 좁혔던 것을 되돌린다 — 그때는 아이콘 톤(종이·먹·금)이
 *   정체성이라 화면 전체가 변하면 안 된다는 판단이었고, 지금은 **시안 자체가 전면 틴트**다.
 *   ⇒ 배경뿐 아니라 카드·글자·선·강조까지 그 오행 세트로 간다(`ELEMENT_PALETTE`).
 */
/**
 * 저장값 **동기** 읽기.
 *
 * ⚠️2026-08-18 실측 버그 — `expo-secure-store` 는 **웹에서 `getItem`(동기)을 주지 않는다.**
 *   그래서 웹에서는 설정에 무엇을 골라도 `resolveElement()` 가 늘 기본값으로 떨어졌다
 *   (`pref.themeAccent = 火` 가 localStorage 에 **있는데도** 화면은 金 그대로였다).
 *   Boss 가 "색상은 대표명식 오행에 따라 변하게" 라고 못박은 요구가 **웹에서 통째로 죽어 있었다.**
 *   ⇒ 웹에서는 localStorage 를 직접 본다(SecureStore 웹 구현이 쓰는 저장소와 같은 곳).
 * ★팔레트는 모듈 로드 시 1회 결정되므로 **동기 읽기여야 한다** — 비동기로는 이미 늦는다.
 */
function readPref(key: string): string {
  try {
    const f = (SecureStore as any).getItem;
    if (typeof f === 'function') { const v = f.call(SecureStore, key); if (v != null) return String(v); }
  } catch { /* 아래 폴백 */ }
  try { return (globalThis as any).localStorage?.getItem(key) ?? ''; } catch { return ''; }
}

function resolveElement(): ThemeElement {
  const mode = readPref(ACCENT_KEY) || 'auto';
  if (mode === 'gold') return DEFAULT_ELEMENT;                       // '기본' = 중립 세트
  if ((ELS as string[]).includes(mode)) return mode as ThemeElement; // 오행 직접 선택
  const el = readPref(ELEMENT_KEY);
  return (ELS as string[]).includes(el) ? (el as ThemeElement) : DEFAULT_ELEMENT;  // auto = 일간 오행
}

/** `#RRGGBB` + 알파 → `rgba(...)`. 오행마다 달라지는 면(overlay·glass)을 팔레트에서 파생시킨다. */
function rgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// 로드 시점 동기 결정: 저장 오버라이드(다크/라이트) > 시스템(Appearance). 실패 시 다크.
// ★다크/라이트 테마 제거(daniel 2026-07-15) — 소프트 클레이 단일 테마. 항상 light(클레이) 팔레트.
//   (DARK 팔레트/setThemePref는 미사용으로 남겨둠 — 제거 시 churn만 큼. 설정 토글은 UI에서 삭제.)
function resolveScheme(): Scheme { return 'light'; }

export const activeScheme: Scheme = resolveScheme();

/** 지금 적용된 오행(전면 팔레트 소스). 설정 UI·하네스가 읽는다. */
export const activeElement: ThemeElement = resolveElement();
const EP = ELEMENT_PALETTE[activeElement];

/**
 * 전 화면이 import 하는 색 토큰.
 *
 * ★구성 = **베이스(LIGHT) 위에 오행 세트(EP)를 얹고, 면 색은 그 오행에서 파생**한다.
 *   · `LIGHT` 가 먼저 오는 이유: gold·badgeGold·onImage·scrimHero 처럼 **오행과 무관한 브랜드 값**을
 *     빠뜨리지 않기 위해서다(키가 하나라도 사라지면 168개 파일 중 어딘가가 undefined 색을 쓴다).
 *   · `overlay` 계열은 LIGHT 의 라벤더 rgba 를 그대로 두면 **오행 배경 위에서 보라 얼룩**이 된다
 *     → 그 오행의 `juSoft`·`card` 에서 다시 만든다.
 *   ⚠️`overlay` 는 이름과 달리 **칩 배경 + 전체 막** 두 용도라 반드시 **밝은** 값이어야 한다
 *     (어두운 스크림이 필요한 곳은 `scrimHero` 가 따로 있다 — 2026-08-10 회색 알약 사고).
 */
export const colors = {
  ...(activeScheme === 'light' ? LIGHT : DARK),
  ...EP,
  glass: rgba(EP.card, 0.8),
  glassLight: rgba(EP.ju, 0.06),
  overlay: rgba(EP.juSoft, 0.55),
  overlaySoft: rgba(EP.juSoft, 0.28),
  overlayStrong: rgba(EP.card, 0.88),
  labelScrim: rgba(EP.card, 0.96),
};

// 활성 강조 오행(설정 UI 표시용) — 'gold'(기본)면 빈 문자열(픽커가 '기본' 칩을 켠다).
export const activeAccentElement: string = (() => {
  try {
    const m = ((SecureStore as any).getItem?.(ACCENT_KEY) as string) || 'auto';
    if (m === 'gold') return '';
    if ((ELS as string[]).includes(m)) return m;
    return ((SecureStore as any).getItem?.(ELEMENT_KEY) as string) || '';
  } catch { return ''; }
})();

// 전 화면 배경 이미지 — 다크=밤하늘, 라이트=한지(daniel #다크모드). 둘 다 번들에 포함.
export const bgSource = activeScheme === 'light'
  ? A('icons/bg-paper.jpg')
  : A('icons/bg-night.png');

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
  if (!(ELS as string[]).includes(el)) return;   // el 은 엔진에서 온 문자열 — 오행 5자 중 하나인지만 본다
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
  // ★`readPref` 와 같은 경로 — 웹에서 동기 읽기가 죽어 있던 것을 함께 고친다(로딩 모드도 같은 증상이었다).
  //   빈 문자열은 '없음'으로 본다(종전 undefined 와 같은 취급).
  const v = readPref(key);
  return v === '' ? undefined : v;
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

// ⛔`gradients` 삭제(2026-08-10) — **소비처 0건인 죽은 export** 였다(앱 전역 전수 확인 후 제거).
//   ★지운 이유가 '안 쓰여서'만은 아니다: 값이 **옛 크림·골드 팔레트**로 굳어 있는데 주석에는
//   "LIGHT.ju 동기화"라 적혀 있었다. ju 를 라벤더로 바꾼 뒤에도 그 문장이 그대로라,
//   다음 사람이 읽으면 **"강조색 그라디언트는 여기 있다"고 믿고 쓰게 된다** — 색이 갈리는 길이다.
//   죽은 코드는 안 돌아서 위험한 게 아니라 **살아 있는 척하며 판단을 오염시켜서** 위험하다.
//   그라디언트가 다시 필요하면 `colors.ju`/`colors.juDeep` 에서 **파생시켜** 쓸 것(값을 새로 적지 말 것).

// ── 라운드(모서리) — ★Apple 디자인(daniel 2026-07-15): iOS continuous corner 감성(과하지 않게) ──
export const radius = { sm: 10, md: 14, lg: 20, pill: 999 } as const;

// ── 간격(4pt 그리드) ─────────────────────────────────────────
export const space = (n: number) => n * 4;

// ── 그림자 ───────────────────────────────────────────────────
// ★Apple 디자인(daniel 2026-07-15): 그림자 절제 — 순백 카드 vs 시스템 그레이 배경의 '대비'로 깊이(iOS HIG). 아주 미묘한 그림자만.
// ★2026-08-10 라벤더 전환: 그림자 **색을 보라**로 바꿨다(검정 그림자는 라벤더 배경 위에서 회색으로 탁해진다).
//   세기(입체감)는 daniel 07-20 "여전히 입체감 없음" 지적 이후 값을 유지한다 — 색만 톤에 맞춘 것이다.
//   ⚠️Android 는 shadowColor 를 무시하고 elevation 만 쓴다(iOS 에서만 색이 반영됨).
export const shadow = {
  card: { shadowColor: '#4A3A8F', shadowOpacity: 0.18, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  soft: { shadowColor: '#4A3A8F', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
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
