// app/src/components/BottomNav.tsx — 하단 탭 네비게이션(홈 / 마켓)
// ─────────────────────────────────────────────────────────────────────────
// daniel: 하단 네비로 홈·마켓 전환. 마켓에서 이용권 구매 → unlock(credit, grant_credit).
//   expo-router Stack 구조 유지 + 커스텀 바(최소 변경). 모든 화면 하단 고정(AdBanner 위).
//   ★이모지 미사용(daniel) — 텍스트 라벨만, active = 골드 글자 + 상단 짧은 골드 바.
//   현재 경로(usePathname)로 active. 탭은 replace 로 전환(스택 누적 방지).
// ─────────────────────────────────────────────────────────────────────────
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { PressableScale } from './PressableScale';
import { useRouter, usePathname } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { colors, space } from '../lib/theme';

const TABS = [
  { key: 'home', route: '/' },
  { key: 'market', route: '/market' },
] as const;

export function BottomNav() {
  const router = useRouter();
  const path = usePathname();
  const { t } = useTranslation();
  return (
    <View style={styles.bar}>
      {TABS.map((tb) => {
        const on = tb.key === 'market' ? path.startsWith('/market') : (path === '/' || path === '/index');
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
