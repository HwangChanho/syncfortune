// src/app/(app)/settings.tsx — 설정 (글자 크기·언어)
// ─────────────────────────────────────────────────────────────────────────
// daniel: 설정에서 글자 크기 조절. 통변 등 본문 가독성을 위한 전역 배율(fontScale) 선택 + 언어.
//   글자 크기는 즉시 반영(미리보기 문장으로 확인). 언어는 i18n.changeLanguage.
// ─────────────────────────────────────────────────────────────────────────
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFontScale, FONT_STEPS } from '../../lib/fontScale';
import { colors, radius, space, shadow, font } from '../../lib/theme';

const LANGS: { key: string; label: string }[] = [
  { key: 'ko', label: '한국어' }, { key: 'en', label: 'English' }, { key: 'ja', label: '日本語' },
];

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const { scale, setScale, fs } = useFontScale();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.wrap}>
      {/* ── 글자 크기 ── */}
      <Text style={styles.h}>{t('settings.fontSize')}</Text>
      <View style={styles.row}>
        {FONT_STEPS.map((s) => {
          const on = Math.abs(scale - s.scale) < 0.001;
          return (
            <Pressable key={s.key} style={[styles.opt, on && styles.optOn]} onPress={() => setScale(s.scale)}>
              <Text style={[styles.optTx, on && styles.optTxOn, { fontSize: 13 * s.scale }]}>{t(`settings.size_${s.key}`)}</Text>
            </Pressable>
          );
        })}
      </View>
      {/* 미리보기 — 현재 배율이 통변 본문에 어떻게 보이는지 */}
      <View style={styles.preview}>
        <Text style={[styles.previewBody, { fontSize: fs(15), lineHeight: fs(25) }]}>{t('settings.preview')}</Text>
      </View>

      {/* ── 언어 ── */}
      <Text style={[styles.h, { marginTop: space(7) }]}>{t('settings.language')}</Text>
      <View style={styles.row}>
        {LANGS.map((l) => {
          const on = i18n.language?.startsWith(l.key);
          return (
            <Pressable key={l.key} style={[styles.opt, on && styles.optOn]} onPress={() => i18n.changeLanguage(l.key)}>
              <Text style={[styles.optTx, on && styles.optTxOn]}>{l.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.note}>{t('settings.note')}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.bg },
  wrap: { padding: space(5), paddingBottom: space(12) },
  h: { ...font.heading, marginBottom: space(3) },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  opt: { paddingHorizontal: space(4), paddingVertical: space(2.75), borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  optOn: { backgroundColor: colors.ju, borderColor: colors.ju },
  optTx: { fontSize: 14, fontWeight: '700', color: colors.inkSoft },
  optTxOn: { color: colors.bg },
  preview: { marginTop: space(4), padding: space(4), borderRadius: radius.md, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.juLine, ...shadow.card },
  previewBody: { color: colors.ink },
  note: { ...font.caption, color: colors.inkFaint, marginTop: space(6), lineHeight: 18 },
});
