// app/src/app/(app)/market.tsx — 마켓: 이용권 구매(unlock) + 쿠폰 등록
// ─────────────────────────────────────────────────────────────────────────
// daniel: 하단 네비 '마켓'. 파트별 이용권(사주·자미·궁합·타임라인·추가질문·애정) 구매 → credit 부여(grant_credit).
//   결제 = RevenueCat consumable(키 미설정 시 '준비 중'). 구매 성공 → grantCredit → 게이트에서 use_credit 으로 무료 사용.
//   ★1회성(소모성) 이용권 → '보유/미보유'로만 표시(장수 X, daniel). 쿠폰 등록도 여기로 이동(설정→마켓).
//   ⚠️ 정식은 RevenueCat 웹훅 검증(현재 신뢰기반, daniel 슬롯).
// ─────────────────────────────────────────────────────────────────────────
import { View, Text, ScrollView, Pressable, TextInput, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { CREDIT_KINDS, loadCredits, grantCredit, redeemCoupon, type CreditKind } from '../../lib/coupons';
import { purchaseConsumableRC, PRODUCT_UNLOCK_2500 } from '../../lib/purchases';
import { requireLoginForPurchase } from '../../lib/requireLogin'; // 구매 전 로그인 게이트(계정 귀속)
import { useAuth } from '../../lib/useAuth';
import { colors, radius, space, shadow, font } from '../../lib/theme';

export default function MarketRoute() {
  const { t } = useTranslation();
  const router = useRouter();
  const { session } = useAuth();
  const [credits, setCredits] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [code, setCode] = useState('');           // 쿠폰 코드
  const [redeeming, setRedeeming] = useState(false);

  useEffect(() => { loadCredits().then(setCredits).catch(() => {}); }, []);

  // 이용권 1개 구매 → 결제(consumable) → 성공 시 크레딧 부여 → 보유 갱신.
  async function buy(kind: CreditKind) {
    if (!requireLoginForPurchase(session, () => router.push('/login'), t)) return;
    setBusy(kind);
    try {
      const ok = await purchaseConsumableRC(PRODUCT_UNLOCK_2500); // 키 미설정 시 '준비 중' throw
      if (ok) {
        await grantCredit(kind);
        setCredits(await loadCredits());
        Alert.alert(t('market.doneTitle'), t('market.doneMsg'));
      }
    } catch (e) {
      Alert.alert(t('market.payPending'), (e as Error).message);
    }
    setBusy(null);
  }

  // 쿠폰 등록(설정→마켓 이동) — 서버 검증·부여 → 결과 안내 + 보유 갱신.
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
      <Text style={styles.intro}>{t('market.intro')}</Text>
      {CREDIT_KINDS.map((c) => {
        const owned = (credits[c.key] ?? 0) > 0; // 1회성 이용권 — 보유/미보유로만(장수 미표시)
        return (
          <View key={c.key} style={styles.card}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{c.ko}</Text>
              <Text style={[styles.have, owned && styles.haveOn]}>{owned ? t('market.owned') : t('market.notOwned')}</Text>
            </View>
            <Pressable style={[styles.buyBtn, !!busy && styles.buyOff]} onPress={() => buy(c.key)} disabled={!!busy}>
              {busy === c.key ? <ActivityIndicator color={colors.bg} size="small" /> : <Text style={styles.buyTx}>{t('market.buy')}</Text>}
            </Pressable>
          </View>
        );
      })}

      {/* 쿠폰 등록(무료 이용권) — 설정에서 이동 */}
      <Text style={styles.couponH}>{t('settings.coupon')}</Text>
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

      <Text style={styles.note}>{t('market.note')}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.bg },
  wrap: { padding: space(5), paddingBottom: space(20) },
  intro: { ...font.body, color: colors.inkSoft, marginBottom: space(4) },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: space(4), marginBottom: space(3), ...shadow.card },
  name: { fontSize: 16, fontWeight: '800', color: colors.ink },
  have: { ...font.caption, color: colors.inkFaint, marginTop: 2 },
  haveOn: { color: colors.ju, fontWeight: '800' },
  buyBtn: { backgroundColor: colors.ju, borderRadius: radius.pill, paddingHorizontal: space(5), paddingVertical: space(2.5), minWidth: 84, alignItems: 'center' },
  buyOff: { opacity: 0.5 },
  buyTx: { color: colors.bg, fontWeight: '800', fontSize: 14 },
  // 쿠폰 등록
  couponH: { ...font.heading, marginTop: space(6), marginBottom: space(3) },
  couponRow: { flexDirection: 'row', gap: space(2), alignItems: 'center' },
  couponInput: { flex: 1, ...font.body, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, paddingHorizontal: space(3), paddingVertical: space(2.75), color: colors.ink, letterSpacing: 1 },
  couponBtn: { backgroundColor: colors.ju, borderRadius: radius.sm, paddingHorizontal: space(4), paddingVertical: space(2.75) },
  couponBtnOff: { opacity: 0.45 },
  couponBtnTx: { color: colors.bg, fontWeight: '800', fontSize: 14 },
  note: { ...font.caption, color: colors.inkFaint, marginTop: space(4), lineHeight: 18 },
});
