// src/app/(app)/settings.tsx — 설정 (글자 크기·언어)
// ─────────────────────────────────────────────────────────────────────────
// daniel: 설정에서 글자 크기 조절. 통변 등 본문 가독성을 위한 전역 배율(fontScale) 선택 + 언어.
//   글자 크기는 즉시 반영(미리보기 문장으로 확인). 언어는 i18n.changeLanguage.
// ─────────────────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, TextInput, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFontScale, FONT_STEPS } from '../../lib/fontScale';
import { redeemCoupon, loadCredits, CREDIT_KINDS } from '../../lib/coupons';
import { colors, radius, space, shadow, font } from '../../lib/theme';

const LANGS: { key: string; label: string }[] = [
  { key: 'ko', label: '한국어' }, { key: 'en', label: 'English' }, { key: 'ja', label: '日本語' },
];

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const { scale, setScale, fs } = useFontScale();
  const [code, setCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [credits, setCredits] = useState<Record<string, number>>({});

  useEffect(() => { loadCredits().then(setCredits); }, []);

  // 쿠폰 등록 — 서버 검증·부여 → 결과 안내 + 크레딧 갱신
  async function onRedeem() {
    const c = code.trim();
    if (!c || redeeming) return;
    setRedeeming(true);
    const res = await redeemCoupon(c);
    setRedeeming(false);
    if (res.ok) {
      setCode('');
      setCredits(await loadCredits());
      Alert.alert(t('settings.couponOkTitle'), t('settings.couponOk'));
    } else {
      Alert.alert(t('settings.couponFailTitle'), t(`settings.couponErr_${res.error}`, t('settings.couponErr_invalid')));
    }
  }

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

      {/* ── 무료 이용권(쿠폰) ── */}
      <Text style={[styles.h, { marginTop: space(7) }]}>{t('settings.coupon')}</Text>
      <View style={styles.couponRow}>
        <TextInput
          style={styles.couponInput}
          value={code}
          onChangeText={(v) => setCode(v.toUpperCase())}
          placeholder={t('settings.couponPh')}
          placeholderTextColor={colors.inkFaint}
          autoCapitalize="characters"
          autoCorrect={false}
          editable={!redeeming}
        />
        <Pressable style={[styles.couponBtn, (!code.trim() || redeeming) && styles.couponBtnOff]} onPress={onRedeem} disabled={!code.trim() || redeeming}>
          <Text style={styles.couponBtnTx}>{t('settings.couponRedeem')}</Text>
        </Pressable>
      </View>
      {/* 보유 크레딧 */}
      {CREDIT_KINDS.some((k) => credits[k.key] > 0) && (
        <View style={styles.creditBox}>
          <Text style={styles.creditH}>{t('settings.couponHave')}</Text>
          {CREDIT_KINDS.filter((k) => credits[k.key] > 0).map((k) => (
            <Text key={k.key} style={styles.creditLine}>{k.ko} · <Text style={{ color: colors.ju, fontWeight: '800' }}>{credits[k.key]}회</Text></Text>
          ))}
        </View>
      )}

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
  // 쿠폰
  couponRow: { flexDirection: 'row', gap: space(2), alignItems: 'center' },
  couponInput: { flex: 1, ...font.body, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, paddingHorizontal: space(3), paddingVertical: space(2.75), color: colors.ink, letterSpacing: 1 },
  couponBtn: { backgroundColor: colors.ju, borderRadius: radius.sm, paddingHorizontal: space(4), paddingVertical: space(2.75) },
  couponBtnOff: { opacity: 0.45 },
  couponBtnTx: { color: colors.bg, fontWeight: '800', fontSize: 14 },
  creditBox: { marginTop: space(3), padding: space(4), borderRadius: radius.md, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.juLine },
  creditH: { ...font.caption, color: colors.ju, fontWeight: '800', marginBottom: space(2) },
  creditLine: { ...font.body, color: colors.ink, marginTop: space(1) },
});
