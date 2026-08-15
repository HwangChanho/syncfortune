// app/src/components/BottomNav.tsx — 하단 탭 네비게이션(홈 / 풀이 / 커뮤니티 / 도우미 / 마켓)
// ─────────────────────────────────────────────────────────────────────────
// daniel: 하단 네비로 전환. 마켓=운 충전·콘텐츠 구매. 도우미=팔자 도우미(콘텐츠 안내).
//   expo-router Stack 구조 유지 + 커스텀 바(최소 변경). 모든 화면 하단 고정(AdBanner 위).
//   ★현재 경로(usePathname)로 active. 탭은 replace 로 전환(스택 누적 방지).
//   ★네비바 실측 높이 export(getNavBarHeight) — 코치 등 키보드 입력바가 네비바 위에 정확히 붙게 하는 데 사용(전역 바라 KAV가 못 잡음).
//   ★커뮤니티 탭 = 원격 플래그(features.community) ON 일 때만 노출(현재 OFF=관리자 전용).
//
// ★★아이콘(daniel 2026-08-01 "하단 탭바는 아이콘으로 바꾸자")
//   · **이모지가 아니라 벡터 아이콘**이다. 이모지는 OS/폰트마다 모양·크기가 제각각이고 톤이 앱과 안 맞는다
//     (daniel 이 이전부터 이모지를 빼 온 이유). 여기서는 react-native-svg 로 **직접 그린 선 아이콘**을 쓴다.
//   · 새 아이콘 패키지를 넣지 않았다 — 의존성을 추가하면 네이티브 재빌드가 필요해서
//     지금의 '안정화 우선' 기조와 어긋난다. react-native-svg 는 이미 앱에 있고 여러 화면이 쓰고 있다.
//   · 라벨은 남긴다(아이콘만 두면 '풀이'와 '도우미'처럼 뜻이 겹치는 탭을 구분하기 어렵다). 라벨은 작게.
//   · active = 골드(colors.ju) 선·글자 + 상단 짧은 골드 바, inactive = 흐린 잉크.
// ─────────────────────────────────────────────────────────────────────────
import { useMemo } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { PressableScale } from './PressableScale';
import { useRouter, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useFeatureOn } from '../lib/core/features'; // 원격 플래그 + 관리자 오버라이드 게이트(커뮤니티 탭 노출용)
import { colors, space } from '../lib/theme';

// 탭 전체 정의(순서 = 홈 → 풀이 → 커뮤니티 → 도우미 → 마켓). 커뮤니티는 렌더 시 플래그로 필터링.
//   ★'풀이'(daniel 2026-07-18) = 홈에 쌓여 있던 콘텐츠 카드 그리드를 옮긴 탭.
//     라우트가 /contents 인 이유는 기존 /reading(사주 원국풀이)과 혼동을 피하려는 것.
export const ALL_TABS = [
  { key: 'home', route: '/' },
  { key: 'contents', route: '/contents' },
  { key: 'community', route: '/community' },
  { key: 'coach', route: '/coach' },
  { key: 'market', route: '/market' },
] as const;

type TabKey = (typeof ALL_TABS)[number]['key'];

/** 아이콘 공통 — 24 그리드 · 선(stroke)만 · 채움 없음. 색은 부모가 정한다(active=골드). */
const ICON = { size: 23, viewBox: '0 0 24 24', width: 1.7 } as const;

/**
 * 탭 아이콘 — 뜻이 한눈에 읽히는 최소 형태로 직접 그렸다.
 *   home=집 · contents=문서(풀이 글) · community=사람 둘 · coach=나침반(길 안내) · market=쇼핑백
 * ★도우미를 말풍선이 아니라 **나침반**으로 둔 이유: 팔자 도우미는 대화형 챗이 아니라
 *   '무엇을 볼지 안내'하는 기능으로 바뀌었다(API 0원 전환). 말풍선은 채팅을 기대하게 만든다.
 */
export function TabIcon({ name, color }: { name: TabKey; color: string }) {
  const p = { stroke: color, strokeWidth: ICON.width, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <Svg width={ICON.size} height={ICON.size} viewBox={ICON.viewBox}>
      {name === 'home' && (<>
        <Path d="M3.4 11.2 12 4.2l8.6 7" {...p} />
        <Path d="M5.9 10.3V19.8h12.2V10.3" {...p} />
        <Path d="M10.1 19.8v-4.6h3.8v4.6" {...p} />
      </>)}
      {name === 'contents' && (<>
        <Path d="M6.7 3.9h7.6l3.6 3.6v12.6H6.7z" {...p} />
        <Path d="M14.3 3.9v3.6h3.6" {...p} />
        <Path d="M9.4 12h5.6M9.4 15.2h5.6M9.4 18.4h3.6" {...p} />
      </>)}
      {name === 'community' && (<>
        <Circle cx="9.2" cy="8.6" r="2.9" {...p} />
        <Path d="M3.9 19.6c0-3 2.3-4.8 5.3-4.8s5.3 1.8 5.3 4.8" {...p} />
        <Circle cx="16.8" cy="9.6" r="2.1" {...p} />
        <Path d="M15.4 14.9c2.9-.5 5.2 1.1 5.2 4.1" {...p} />
      </>)}
      {name === 'coach' && (<>
        <Circle cx="12" cy="12" r="8.2" {...p} />
        <Path d="m15.4 8.6-2.3 4.8-4.8 2.3 2.3-4.8z" {...p} />
      </>)}
      {name === 'market' && (<>
        <Path d="M5.4 7.9h13.2l-1.1 11.9H6.5z" {...p} />
        <Path d="M9.1 7.9V6.6a2.9 2.9 0 0 1 5.8 0v1.3" {...p} />
      </>)}
    </Svg>
  );
}

let _navBarHeight = 82; // 실측 전 근사값. onLayout 으로 갱신(아이콘 추가로 높이가 바뀌어도 자동 반영).
const NAV_MARGIN_BOTTOM = space(4); // ★styles.bar 의 marginBottom — onLayout 높이에 안 잡힌다(아래 getNavBarHeight 주석)
// ★Android 시스템 내비 회피(daniel 2026-08-04 "안드로이드/iOS 다를 수 있는 부분 찾아서 고쳐").
//   iOS 는 marginBottom 16 고정 모양을 daniel 이 승인했지만, Android 는 edge-to-edge 라
//   3버튼 내비(인셋 ~48)가 고정 16 여백을 **덮는다**(배너 틈과 같은 뿌리 — 인셋을 아무도 안 받던 문제).
//   Android 만 max(16, 인셋)로 띄우고, getNavBarHeight() 도 같은 값을 쓰게 모듈 변수로 공유한다.
let _navMarginBottom = NAV_MARGIN_BOTTOM;
/** 하단 네비바 실측 높이(px) — 키보드 입력바 위치 계산용(코치 등). 마운트 후 정확값. */
/**
 * 네비바가 **실제로 차지하는 세로 공간**(pt).
 * ⚠️`onLayout` 높이는 **margin 을 포함하지 않는다** — bar 에 `marginBottom: space(4)` 가 있어
 *   그만큼이 빠져 있었다. 이 값을 '키보드 위 입력바' 위치 계산에 쓰는 화면(coach)이 있어,
 *   16pt 가 빠지면 입력바가 그만큼 **떠 보인다**(daniel 2026-08-04 IMG_8351).
 *   ⇒ 레이아웃 높이에 margin 을 더해 '점유 높이'를 돌려준다.
 */
export function getNavBarHeight(): number { return _navBarHeight + _navMarginBottom; }

export function BottomNav() {
  const router = useRouter();
  const path = usePathname();
  const insets = useSafeAreaInsets();
  // Android 만 시스템 내비 인셋 반영(iOS 는 승인된 고정 여백 유지). 렌더마다 모듈 변수 동기화.
  const marginBottom = Platform.OS === 'android' ? Math.max(NAV_MARGIN_BOTTOM, insets.bottom) : NAV_MARGIN_BOTTOM;
  _navMarginBottom = marginBottom;
  const { t } = useTranslation();
  // 커뮤니티는 원격 플래그(features.community) ON 일 때만 노출 = 관리자 전용, 심사 통과 후 공개.
  const commOn = useFeatureOn('community');
  const tabs = useMemo(() => ALL_TABS.filter((tb) => tb.key !== 'community' || commOn), [commOn]);
  return (
    <View style={[styles.bar, { marginBottom }]} onLayout={(e) => { _navBarHeight = e.nativeEvent.layout.height; }}>
      {tabs.map((tb) => {
        const on = tb.key === 'market' ? path.startsWith('/market')
          : tb.key === 'coach' ? path.startsWith('/coach')
          : tb.key === 'community' ? path.startsWith('/community')
          : tb.key === 'contents' ? path.startsWith('/contents')
          : (path === '/' || path === '/index');
        return (
          <PressableScale key={tb.key} style={styles.tab} onPress={() => { if (!on) router.replace(tb.route); }} hitSlop={6}>
            {on && <View style={styles.activeBar} />}
            <TabIcon name={tb.key} color={on ? colors.ju : colors.inkFaint} />
            <Text style={[styles.label, on && styles.labelOn]} numberOfLines={1}>{t(`nav.${tb.key}`)}</Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  // 네비바 배경 = 카드 서피스(라이트=연베이지, 다크=#221F44) — 배경(한지/달밤) 위에서 바로 도드라지게(daniel 07-03)
  bar: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, backgroundColor: colors.card, paddingBottom: space(6), paddingTop: space(4) }, // marginBottom 은 렌더에서(Android 인셋 반영)

  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  // active 상단 짧은 골드 바
  activeBar: { position: 'absolute', top: -space(4), width: 30, height: 2.5, borderRadius: 2, backgroundColor: colors.ju }, // paddingTop 과 일치

  // ★아이콘이 뜻을 지고 라벨은 보조 — 그래서 15 → 11.5 로 낮췄다. lineHeight 를 짝으로 두지 않으면 잘린다.
  label: { fontSize: 11.5, lineHeight: 15, fontWeight: '700', color: colors.inkFaint },
  labelOn: { color: colors.ju, fontWeight: '800' },
});
