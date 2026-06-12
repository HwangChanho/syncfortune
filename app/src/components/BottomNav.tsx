// app/src/components/BottomNav.tsx — 하단 탭 네비게이션(홈 / 마켓)
// ─────────────────────────────────────────────────────────────────────────
// daniel: 하단 네비로 홈·마켓 전환. 마켓에서 이용권 구매 → unlock(credit, grant_credit).
//   expo-router Stack 구조 유지 + 커스텀 바(탭 그룹 재구조 없이 최소 변경). 모든 화면 하단 고정(AdBanner 위).
//   현재 경로(usePathname)로 active 표시. 탭은 replace 로 전환(스택 누적 방지).
// ─────────────────────────────────────────────────────────────────────────
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { colors, space, font } from '../lib/theme';

const TABS = [
  { key: 'home', route: '/', icon: '🏠' },
  { key: 'market', route: '/market', icon: '🎟️' },
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
          <Pressable key={tb.key} style={styles.tab} onPress={() => router.replace(tb.route)} hitSlop={6}>
            <Text style={[styles.icon, on && styles.iconOn]}>{tb.icon}</Text>
            <Text style={[styles.label, on && styles.labelOn]}>{t(`nav.${tb.key}`)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, backgroundColor: colors.bg, paddingBottom: space(5), paddingTop: space(2) },
  tab: { flex: 1, alignItems: 'center', gap: 2 },
  icon: { fontSize: 20, opacity: 0.45 },
  iconOn: { opacity: 1 },
  label: { ...font.caption, color: colors.inkFaint },
  labelOn: { color: colors.ju, fontWeight: '800' },
});
