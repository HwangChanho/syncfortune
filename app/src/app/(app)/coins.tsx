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
import { TALK_PACK, FREE_TALK_DAILY } from '../../lib/billing/coinPrices';   // 대화 묶음(화면 표기용 — 실제 차감은 서버)
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Image as ExpoImage } from 'expo-image';
import { coinIcon } from '../../lib/ui/brandAsset';
import { PressableScale } from '../../components/PressableScale';
import { AdFreeSection } from '../../components/AdFreeSection';   // ★광고 제거(운 구매) 공용 블록
import { Alert } from '../../lib/ui/alert';
import { COIN_PACKS, coinBalanceOrNull } from '../../lib/billing/coins';
import { listBonusCoupons, claimCoinBonus, claimWelcomeCoupon, type BonusCoupon } from '../../lib/billing/coinBonus';   // ★보너스 쿠폰(정가 결제 + 운 추가)
import { purchaseCoinPack } from '../../lib/billing/purchases';
import { requireLoginForPurchase } from '../../lib/billing/requireLogin';
import { useAuth } from '../../lib/useAuth';
import { notifyNetworkError } from '../../lib/backend/network';
import { useFontScale } from '../../lib/ui/fontScale';
import { colors, radius, space, font, shadow } from '../../lib/theme';
import { useTranslation } from 'react-i18next';

export default function CoinsScreen() {
  const { fs } = useFontScale();
  const { t } = useTranslation();
  const router = useRouter();
  const { session } = useAuth();
  const [balance, setBalance] = useState<number | null | undefined>(undefined); // undefined=로딩 / null=조회실패
  const [busy, setBusy] = useState<string | null>(null);
  const [coupons, setCoupons] = useState<BonusCoupon[]>([]);   // 쓸 수 있는 보너스 쿠폰(큰 것부터)

  // ★충전 화면은 **충전 직후 즉시** 갱신이 필요해 직접 reload 를 유지한다(웹훅 적립 폴링과 짝).
  //   그 외 표시 화면(마켓·설정·배지)은 공용 훅 useCoinBalance 로 통일했다 — 규칙이 갈리지 않게.
  const reload = useCallback(async () => { setBalance(await coinBalanceOrNull()); }, []);

  // ★진입할 때마다 보너스를 청구한다 — 결제 직후 앱이 죽어 못 받은 것이 있으면 여기서 붙는다.
  //   멱등이라(서버 `ref` 유니크) 몇 번을 불러도 이중 지급이 없다.
  const syncBonus = useCallback(async () => {
    // ★첫 충전 쿠폰을 **먼저** 받아 둔다 — 받자마자 이번 충전에 쓸 수 있어야 한다.
    //   자격 판정은 서버가 한다(충전 이력 있으면 안 준다). 몇 번을 불러도 한 장뿐.
    await claimWelcomeCoupon();
    const granted = await claimCoinBonus();
    if (granted > 0) setBalance(await coinBalanceOrNull());   // 붙었으면 잔액을 다시 읽는다
    setCoupons(await listBonusCoupons());
  }, []);
  useFocusEffect(useCallback(() => { void reload(); void syncBonus(); }, [reload, syncBonus]));

  async function buy(packId: string, coins: number) {
    if (!requireLoginForPurchase(session, () => router.push('/login'), t)) return;
    if (busy) return;
    setBusy(packId);
    try {
      const ok = await purchaseCoinPack(packId);
      if (!ok) return;                       // 사용자가 취소 — 조용히
      // 적립은 웹훅이 한다(클라 적립 불가) → 잠깐 뒤 잔액을 다시 읽는다.
      await new Promise((r) => setTimeout(r, 1500));
      // ★웹훅이 적립을 끝낸 뒤에 보너스를 붙인다(붙일 충전이 원장에 있어야 한다).
      //   실패해도 그냥 둔다 — 다음 진입에서 `syncBonus` 가 다시 시도한다(멱등).
      const bonus = await claimCoinBonus();
      const after = await coinBalanceOrNull();
      setBalance(after);
      if (bonus > 0) setCoupons(await listBonusCoupons());
      Alert.alert(
        t('coins.doneTitle', '충전됐어요'),
        after == null
          ? t('coins.donePending', '결제가 완료됐어요. 잔액 반영이 잠시 걸릴 수 있어요.')
          : t('coins.doneMsg', { coins, defaultValue: '{{coins}} 운이 충전됐어요.' }),
      );
    } catch (e) {
      // ★2026-08-09 (daniel "600이랑 1200운 눌러도 반응없음") — 결제 실패를 **네트워크 에러 경로로 보내면 안 된다**:
      //   ① `notifyNetworkError` 에는 **연속 실패 얼럿 1회 스로틀**이 있다. 100운에서 한 번 뜨고 나면
      //      뒤이어 누른 300·600·1200 은 **아무 반응 없이** 삼켜진다(실측: 로그엔 5건 다 찍혔는데 화면엔 1회).
      //   ② 문구를 "연결에 문제가 있어요"로 덮어써 **진짜 원인을 감춘다**(실제는 상품 조회 실패).
      //   → 로깅은 그대로 하되(silent), 사용자에겐 **발생한 에러 그대로** 보여준다.
      notifyNetworkError('coins.purchase', e, t, { silent: true });   // 기록만
      Alert.alert(
        t('coins.failTitle', '충전하지 못했어요'),
        String((e as any)?.message ?? '') || t('net.errMsg', '잠시 후 다시 시도해 주세요. 계속되면 잠시 뒤에 다시 열어 주세요.'),
      );
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
        {/* ★시안 p07 머리말 — 종전엔 잔액 카드가 곧바로 나와 '여기가 어디인지'가 없었다.
              충전은 돈을 쓰는 화면이라, 무엇을 하는 자리인지 먼저 적는다. */}
        <Text style={styles.pageTitle}>{t('coins.title', '운 충전')}</Text>
        <Text style={styles.pageSub}>{t('coins.titleSub', '운을 충전하고 원하는 풀이를 열어 보세요.')}</Text>

        {/* ★운으로 **무엇을 할 수 있는지** 적는다(Boss 2026-08-26 *"운 구매할때 설명 명시 돼야하고"*).
            종전엔 «원하는 풀이를 열어 보세요» 한 줄뿐이라, 10운이 얼마만큼인지 알 수 없었다.
            ⚠️숫자를 여기 **직접 적지 않는다** — `TALK_PACK` 하나만 고치면 문구가 따라온다.
              두 곳에 적으면 가격을 바꿨을 때 화면만 옛 숫자로 남는다. */}
        <View style={styles.useCard}>
          <Text style={styles.useHead}>{t('coins.useHead', '운으로 할 수 있는 것')}</Text>
          <Text style={styles.useRow}>
            {t('coins.useTalk', '· 상담가와 대화 — {{cost}}운이면 {{turns}}턴')
              .replace('{{cost}}', String(TALK_PACK.cost)).replace('{{turns}}', String(TALK_PACK.turns))}
          </Text>
          <Text style={styles.useRow}>{t('coins.useReading', '· 사주·궁합·타로 풀이 — 콘텐츠마다 값이 다르고, 열기 전에 보여 드려요')}</Text>
          <Text style={styles.useNote}>
            {t('coins.useNote', '무료 대화 {{free}}턴은 매일 다시 채워져요. 운은 사라지지 않아요.')
              .replace('{{free}}', String(FREE_TALK_DAILY))}
          </Text>
        </View>

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
            <View style={styles.balRow}>
              <Text style={[styles.balNum, { fontSize: fs(34) }]}>{balance.toLocaleString('ko-KR')}</Text>
              <Text style={[styles.balUnit, { fontSize: fs(15) }]}>{t('my.woon', '운')}</Text>
              {/* ★금화(Boss 제공) — 시안 p07 잔액 카드 우측 */}
              <ExpoImage source={coinIcon()} style={styles.coin} contentFit="contain" transition={160} />
            </View>
          )}
        </View>

        {/* ★보너스 쿠폰 — 시안 홈의 '할인 티켓'에 해당한다.
              스토어 가격은 앱이 바꿀 수 없어 **정가 결제 + 운 추가**로 구현했다(0025 마이그레이션 머리말).
              그래서 문구도 '할인'이 아니라 '더 드려요'로 정확히 적는다 — 결제창 금액과 어긋나면 그게 거짓말이 된다. */}
        {coupons.length > 0 ? (
          <>
            <Text style={[styles.h, { fontSize: fs(15) }]}>{t('coins.bonusTitle', '가진 보너스')}</Text>
            <View style={styles.ticketRow}>
              {coupons.slice(0, 3).map((c) => (
                <View key={c.id} style={styles.ticket}>
                  <Text style={[styles.ticketPct, { fontSize: fs(20) }]}>+{c.bonusPct}%</Text>
                  <Text style={[styles.ticketTx, { fontSize: fs(11) }]} numberOfLines={1}>{c.label ?? t('coins.bonusAny', '충전 시 자동 적용')}</Text>
                </View>
              ))}
            </View>
            <Text style={[styles.ticketNote, { fontSize: fs(12) }]}>
              {t('coins.bonusNote', '충전하면 큰 쿠폰부터 자동으로 쓰여요. 결제 금액은 그대로예요.')}
            </Text>
          </>
        ) : null}

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

</ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: 'transparent' },
  screen: { backgroundColor: 'transparent' },
  wrap: { padding: space(5), paddingBottom: space(10) },
  // 시안 p07 머리말
  pageTitle: { fontSize: 22, lineHeight: 30, fontWeight: '900', color: colors.ink, letterSpacing: -0.3, textAlign: 'center' },
  pageSub: { ...font.caption, color: colors.inkSoft, textAlign: 'center', marginTop: space(1.5), marginBottom: space(4) },
  balRow: { flexDirection: 'row', alignItems: 'center', gap: space(1.5) },
  coin: { width: 46, height: 46, marginLeft: 'auto' },
  balUnit: { color: colors.inkSoft, fontWeight: '800' },
  // 보너스 티켓 — 시안의 쿠폰 스트립. 세 장까지만 보여 준다(그 이상은 어차피 큰 것부터 쓰인다)
  ticketRow: { flexDirection: 'row', gap: space(2), marginBottom: space(2) },
  ticket: {
    flex: 1, alignItems: 'center', backgroundColor: colors.juSoft,
    borderRadius: radius.md, paddingVertical: space(3), paddingHorizontal: space(2),
    borderWidth: 1, borderColor: colors.juLine, borderStyle: 'dashed',
  },
  ticketPct: { fontWeight: '900', color: colors.ju, letterSpacing: -0.5 },
  ticketTx: { color: colors.inkSoft, marginTop: 2 },
  ticketNote: { color: colors.inkFaint, marginBottom: space(4) },
  // 운으로 할 수 있는 것 — 돈을 쓰기 전에 «무엇을 사는지» 를 먼저 본다
  useCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: space(4), marginBottom: space(3), gap: space(1) },
  useHead: { ...font.label, color: colors.ink, fontWeight: '800', marginBottom: space(1) },
  useRow: { ...font.caption, color: colors.inkSoft, lineHeight: 19 },
  useNote: { ...font.caption, color: colors.inkFaint, marginTop: space(1.5), lineHeight: 17 },
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
