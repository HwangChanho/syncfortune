// app/src/app/(app)/coins.tsx — 코인 충전 화면
// ─────────────────────────────────────────────────────────────────────────
// daniel 2026-07-28: "모든 풀이는 코인으로 구매하고 코인 충전해서 하는 식으로"
// 기획서 = docs/PLAN_coin_system.md
//
// ★이 화면이 결제 왕복을 **모아 주는** 자리다. 종전엔 콘텐츠를 볼 때마다 스토어 결제가 나갔고,
//   그 왕복이 반복해서 깨졌다(결제창 지연·무표시 / 결제 후 백그라운드 시 적립 폴링 실패 /
//   조회 실패를 '없음'으로 오해한 재결제 유도). 충전은 드물게, 소비는 서버 원자적 차감으로.
//
// ★잔액은 **조회 실패와 0을 구분**해서 다룬다 — 실패를 0으로 읽고 충전을 권하면
//   이미 충전한 사용자에게 재결제를 유도하게 된다(오늘 사고와 같은 유형).
// ⚠️문구·가격 = ★daniel 검수 슬롯. 상품 등록(ASC)은 daniel 몫.
// ─────────────────────────────────────────────────────────────────────────
import { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { PressableScale } from '../../components/PressableScale';
import { AdFreeSection } from '../../components/AdFreeSection';   // ★광고 제거(운 구매) 공용 블록
import { Alert } from '../../lib/ui/alert';
import { COIN_PACKS, coinBalanceOrNull } from '../../lib/billing/coins';
import { purchaseCoinPack } from '../../lib/billing/purchases';
import { requireLoginForPurchase } from '../../lib/billing/requireLogin';
import { useAuth } from '../../lib/useAuth';
import { notifyNetworkError } from '../../lib/backend/network';
import { useFontScale } from '../../lib/ui/fontScale';
import { colors, radius, space, font, shadow } from '../../lib/theme';
import { useTranslation } from 'react-i18next';

export default function CoinsScreen() {
  const { fs, ls } = useFontScale();
  const { t } = useTranslation();
  const router = useRouter();
  const { session } = useAuth();
  const [balance, setBalance] = useState<number | null | undefined>(undefined); // undefined=로딩 / null=조회실패
  const [busy, setBusy] = useState<string | null>(null);

  // ★충전 화면은 **충전 직후 즉시** 갱신이 필요해 직접 reload 를 유지한다(웹훅 적립 폴링과 짝).
  //   그 외 표시 화면(마켓·설정·배지)은 공용 훅 useCoinBalance 로 통일했다 — 규칙이 갈리지 않게.
  const reload = useCallback(async () => { setBalance(await coinBalanceOrNull()); }, []);
  useFocusEffect(useCallback(() => { void reload(); }, [reload]));

  async function buy(packId: string, coins: number) {
    if (!requireLoginForPurchase(session, () => router.push('/login'), t)) return;
    if (busy) return;
    setBusy(packId);
    try {
      const ok = await purchaseCoinPack(packId);
      if (!ok) return;                       // 사용자가 취소 — 조용히
      // 적립은 웹훅이 한다(클라 적립 불가) → 잠깐 뒤 잔액을 다시 읽는다.
      await new Promise((r) => setTimeout(r, 1500));
      const after = await coinBalanceOrNull();
      setBalance(after);
      Alert.alert(
        t('coins.doneTitle', '충전됐어요'),
        after == null
          ? t('coins.donePending', '결제가 완료됐어요. 잔액 반영이 잠시 걸릴 수 있어요.')
          : t('coins.doneMsg', { coins, defaultValue: '{{coins}} 운이 충전됐어요.' }),
      );
    } catch (e) {
      notifyNetworkError('coins.purchase', e, t);
    } finally { setBusy(null); }
  }

  // ★★로그아웃이면 **충전 화면을 보여주기 전에** 로그인부터 받는다(daniel 2026-08-01).
  //   왜 여기 한 곳인가: 충전 진입점이 여러 개다(설정·마켓 카드·홈 배지·잔액부족 알림의 '운 충전하기').
  //   진입점마다 로그인 검사를 붙이면 반드시 하나를 빠뜨린다 — 모두 이 화면으로 오므로 여기서 막는다.
  //   ★왜 로그인이 필요한가: 적립은 RevenueCat 웹훅이 **계정에 귀속**해서 넣는다(C1). 비로그인으로 사면
  //   돈은 나가고 운은 어디에도 안 쌓인다. 그래서 '살 수 있게 두고 나중에 묻기'가 아니라 **먼저 막는다**.
  if (!session) {
    return (
      <View style={styles.bg}>
        <View style={[styles.screen, { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space(7) }]}>
          <Text style={[styles.balLabel, { fontSize: fs(15), textAlign: 'center' }]}>
            {t('coins.needLoginTitle', '로그인이 필요해요')}
          </Text>
          <Text style={[styles.note, { fontSize: fs(14), textAlign: 'center', marginTop: space(3) }]}>
            {t('coins.needLoginDesc', '충전한 운은 계정에 보관돼요. 로그인해야 기기를 바꿔도 그대로 남습니다.')}
          </Text>
          <PressableScale style={[styles.retry, { marginTop: space(6) }]} onPress={() => router.push('/login')}>
            <Text style={[styles.retryTx, { fontSize: fs(15) }]}>{t('common.login', '로그인')}</Text>
          </PressableScale>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.bg}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.wrap}>
        {/* 잔액 — 로딩/실패/정상 3상태를 분명히 구분해 보여 준다 */}
        <View style={styles.balCard}>
          <Text style={[styles.balLabel, { fontSize: fs(12) }]}>{t('coins.balance', '보유 운')}</Text>
          {balance === undefined ? (
            <ActivityIndicator color={colors.ju} style={{ marginTop: space(2) }} />
          ) : balance === null ? (
            <>
              <Text style={[styles.balErr, { fontSize: fs(14) }]}>{t('coins.balFail', '잔액을 불러오지 못했어요')}</Text>
              <PressableScale style={styles.retry} onPress={() => void reload()}>
                <Text style={[styles.retryTx, { fontSize: fs(13) }]}>{t('common.retry', '다시 시도')}</Text>
              </PressableScale>
            </>
          ) : (
            <Text style={[styles.balNum, { fontSize: fs(34) }]}>{balance.toLocaleString('ko-KR')}</Text>
          )}
        </View>

        <Text style={[styles.h, { fontSize: fs(15) }]}>{t('coins.packs', '운 충전하기')}</Text>
        {COIN_PACKS.map((p) => (
          <PressableScale key={p.id} style={[styles.pack, busy === p.id && styles.packBusy]} onPress={() => void buy(p.id, p.coins)} disabled={!!busy}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.packCoins, { fontSize: fs(19) }]}>{p.coins.toLocaleString('ko-KR')} 운</Text>
              {p.bonusPct > 0 ? (
                <Text style={[styles.packBonus, { fontSize: fs(12) }]}>
                  {t('coins.bonus', { pct: p.bonusPct, defaultValue: '운당 {{pct}}% 더' })}
                </Text>
              ) : null}
            </View>
            <Text style={[styles.packWon, { fontSize: fs(16) }]}>
              {busy === p.id ? '…' : `₩${p.won.toLocaleString('ko-KR')}`}
            </Text>
          </PressableScale>
        ))}

        {/* ★광고 제거(daniel 2026-07-28) — 코인의 '사용처'라 잔액 바로 아래가 자연스럽다.
            공용 컴포넌트(AdFreeSection)라 마켓과 문구·가격이 갈라지지 않는다. */}
        <View style={{ marginTop: space(6) }}>
          <AdFreeSection onDone={() => void reload()} />
        </View>

        <Text style={[styles.note, { fontSize: fs(12), lineHeight: 19 }]}>
          {t('coins.note', '· 운은 모든 유료 풀이에 쓸 수 있어요.\n· 충전한 운은 계정에 보관돼요 — 기기를 바꿔도 그대로예요.\n· 운은 사용 기한이 없어요.')}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: 'transparent' },
  screen: { backgroundColor: 'transparent' },
  wrap: { padding: space(5), paddingBottom: space(10) },
  balCard: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.juLine, padding: space(5), alignItems: 'center', marginBottom: space(5), ...shadow.card },
  balLabel: { ...font.caption, color: colors.inkSoft, fontWeight: '800', letterSpacing: 0.5 },
  balNum: { ...font.display, color: colors.ju, fontWeight: '900', marginTop: space(1) },
  balErr: { ...font.body, color: colors.inkSoft, marginTop: space(2) },
  retry: { marginTop: space(2.5), borderWidth: 1, borderColor: colors.juLine, borderRadius: radius.pill, paddingVertical: space(2), paddingHorizontal: space(4) },
  retryTx: { ...font.caption, color: colors.ju, fontWeight: '800' },
  h: { ...font.caption, color: colors.ju, fontWeight: '800', letterSpacing: 0.5, marginBottom: space(3) },
  pack: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.juLine, paddingVertical: space(4), paddingHorizontal: space(4.5), marginBottom: space(3), ...shadow.card },
  packBusy: { opacity: 0.6 },
  packCoins: { ...font.title, color: colors.ink, fontWeight: '900' },
  packBonus: { ...font.caption, color: colors.ju, fontWeight: '800', marginTop: 2 },
  packWon: { ...font.body, color: colors.ink, fontWeight: '800' },
  note: { ...font.caption, color: colors.inkFaint, marginTop: space(3) },
});
