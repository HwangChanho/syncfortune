// app/src/components/BottomNav.tsx — 하단 탭 네비게이션(홈 / 커뮤니티 / 코치 / 마켓)
// ─────────────────────────────────────────────────────────────────────────
// daniel: 하단 네비로 홈·커뮤니티·코치·마켓 전환. 마켓=이용권 구매·unlock. 코치=AI 자기이해 코치(질문 중 다른 탭 갔다 와도 답 확인, daniel 07-12).
//   expo-router Stack 구조 유지 + 커스텀 바(최소 변경). 모든 화면 하단 고정(AdBanner 위).
//   ★이모지 미사용(daniel) — 텍스트 라벨만, active = 골드 글자 + 상단 짧은 골드 바.
//   현재 경로(usePathname)로 active. 탭은 replace 로 전환(스택 누적 방지).
//   ★네비바 실측 높이 export(getNavBarHeight) — 코치 등 키보드 입력바가 네비바 위에 정확히 붙게 하는 데 사용(전역 바라 KAV가 못 잡음).
//   ★커뮤니티 탭 = 원격 플래그(features.community) ON 일 때만 노출(관리자 전용) — 심사 통과 후 daniel 이 플래그를 켜면
//     전 유저 공개. OFF(일반 유저)면 기존과 동일한 3탭(홈/코치/마켓) — App Store 재제출 안전판.
// ─────────────────────────────────────────────────────────────────────────
import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { PressableScale } from './PressableScale';
import { useRouter, usePathname } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useFeatureOn } from '../lib/core/features'; // 원격 플래그 + 관리자 오버라이드 게이트(커뮤니티 탭 노출용)
import { colors, space } from '../lib/theme';

// 탭 전체 정의(순서 = 홈 → 풀이 → 커뮤니티 → 코치 → 마켓). 커뮤니티는 렌더 시 플래그로 필터링(아래 BottomNav 참고).
//   ★'풀이'(daniel 2026-07-18) = 홈에 쌓여 있던 콘텐츠 카드 그리드 35장을 옮긴 탭.
//     라우트가 /contents 인 이유는 기존 /reading(사주 원국풀이)과 혼동을 피하려는 것(contents.tsx 주석 참고).
const ALL_TABS = [
  { key: 'home', route: '/' },
  { key: 'contents', route: '/contents' },
  { key: 'community', route: '/community' },
  { key: 'coach', route: '/coach' },
  { key: 'market', route: '/market' },
] as const;

let _navBarHeight = 82; // 실측 전 근사값. onLayout 으로 갱신.
/** 하단 네비바 실측 높이(px) — 키보드 입력바 위치 계산용(코치 등). 마운트 후 정확값. */
export function getNavBarHeight(): number { return _navBarHeight; }

export function BottomNav() {
  const router = useRouter();
  const path = usePathname();
  const { t } = useTranslation();
  // 커뮤니티는 원격 플래그(features.community) ON 일 때만 노출 = 관리자 전용, 심사 통과 후 공개.
  const commOn = useFeatureOn('community');
  const tabs = useMemo(() => ALL_TABS.filter((tb) => tb.key !== 'community' || commOn), [commOn]);
  return (
    <View style={styles.bar} onLayout={(e) => { _navBarHeight = e.nativeEvent.layout.height; }}>
      {tabs.map((tb) => {
        const on = tb.key === 'market' ? path.startsWith('/market')
          : tb.key === 'coach' ? path.startsWith('/coach')
          : tb.key === 'community' ? path.startsWith('/community')
          : tb.key === 'contents' ? path.startsWith('/contents')
          : (path === '/' || path === '/index');
        return (
          <PressableScale key={tb.key} style={styles.tab} onPress={() => { if (!on) router.replace(tb.route); }} hitSlop={6}>
            {on && <View style={styles.activeBar} />}
            <Text style={[styles.label, on && styles.labelOn]}>{t(`nav.${tb.key}`)}</Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, backgroundColor: colors.card, paddingBottom: space(6), paddingTop: space(5), marginBottom: space(4) }, // 네비바 배경 = 카드 서피스(라이트=연베이지 #FBF5E8, 다크=#221F44) — 배경(한지/달밤) 위에서 바로 도드라지게(daniel 07-03)

  tab: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // active 상단 짧은 골드 바(이모지 대신 시각 표시)
  activeBar: { position: 'absolute', top: -space(5), width: 30, height: 2.5, borderRadius: 2, backgroundColor: colors.ju }, // paddingTop 과 일치

  label: { fontSize: 15, fontWeight: '700', color: colors.inkFaint },
  labelOn: { color: colors.ju, fontWeight: '800' },
});
