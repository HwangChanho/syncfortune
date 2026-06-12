// app/src/app/(app)/market.tsx — 마켓: 이용권 구매(unlock)
// ─────────────────────────────────────────────────────────────────────────
// daniel: 하단 네비 '마켓'. 파트별 이용권(사주·자미·궁합·타임라인·추가질문·애정) 구매 → credit 부여(grant_credit).
//   결제 = RevenueCat consumable(키 미설정 시 '준비 중'). 구매 성공 → grantCredit → 게이트에서 use_credit 으로 무료 사용.
//   ⚠️ 정식은 RevenueCat 웹훅 검증(현재 신뢰기반, daniel 슬롯).
// ─────────────────────────────────────────────────────────────────────────
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { CREDIT_KINDS, loadCredits, grantCredit, type CreditKind } from '../../lib/coupons';
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

  useEffect(() => { loadCredits().then(setCredits).catch(() => {}); }, []);

  // 이용권 1개 구매 → 결제(consumable) → 성공 시 크레딧 부여 → 잔여 갱신.
  async function buy(kind: CreditKind) {
    if (!requireLoginForPurchase(session, () => router.push('/login'), t)) return; // 미로그인 → 안내 후 중단
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

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.wrap}>
      <Text style={styles.intro}>{t('market.intro')}</Text>
      {CREDIT_KINDS.map((c) => (
        <View key={c.key} style={styles.card}>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{c.ko}</Text>
            <Text style={styles.have}>{t('market.have', { n: credits[c.key] ?? 0 })}</Text>
          </View>
          <Pressable style={[styles.buyBtn, !!busy && styles.buyOff]} onPress={() => buy(c.key)} disabled={!!busy}>
            {busy === c.key ? <ActivityIndicator color={colors.bg} size="small" /> : <Text style={styles.buyTx}>{t('market.buy')}</Text>}
          </Pressable>
        </View>
      ))}
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
  have: { ...font.caption, color: colors.inkSoft, marginTop: 2 },
  buyBtn: { backgroundColor: colors.ju, borderRadius: radius.pill, paddingHorizontal: space(5), paddingVertical: space(2.5), minWidth: 84, alignItems: 'center' },
  buyOff: { opacity: 0.5 },
  buyTx: { color: colors.bg, fontWeight: '800', fontSize: 14 },
  note: { ...font.caption, color: colors.inkFaint, marginTop: space(4), lineHeight: 18 },
});
