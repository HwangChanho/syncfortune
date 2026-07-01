// app/src/components/OfflineBanner.tsx — 오프라인 경고 배너 (상단 고정)
// ─────────────────────────────────────────────────────────────────────────
// 인터넷 끊김 시 표시 → 저장/온디바이스는 열람 가능, 신규 API는 차단됨을 알림(daniel).
// ─────────────────────────────────────────────────────────────────────────
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useOnline } from '../lib/backend/network';
import { colors, space } from '../lib/theme';

export function OfflineBanner() {
  const online = useOnline();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  if (online) return null;
  return (
    <View style={[styles.bar, { paddingTop: insets.top + space(1.5) }]}>
      <Text style={styles.tx}>{t('offline.banner')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { backgroundColor: '#5A3A1E', paddingBottom: space(1.5), paddingHorizontal: space(4), alignItems: 'center' },
  tx: { color: '#FFE2B8', fontSize: 12, fontWeight: '700' },
});
