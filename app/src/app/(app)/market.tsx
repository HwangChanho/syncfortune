// app/src/app/(app)/market.tsx — 마켓: 적용할 명식 선택 → 풀이 진입 + 쿠폰 등록
// ─────────────────────────────────────────────────────────────────────────
// daniel: 이용권/풀이는 명식별로 적용된다. 마켓에서 ① 적용할 명식을 드롭다운으로 고르고
//   ② 이용권(사주·자미·궁합·타임라인·추가질문·애정)을 누르면 그 명식의 해당 풀이 화면으로 진입
//   (선택 명식을 대표로 설정 → 캐시·서버차트 연결, 거기서 이용권 use_credit·프리미엄·건당구매로 열림).
//   무료 이용권(쿠폰) 등록도 여기로 이동(설정→마켓). ★1회성 소모 — 보유/미보유로만 표시.
// ─────────────────────────────────────────────────────────────────────────
import { View, Text, ScrollView, Pressable, TextInput, StyleSheet, Modal, Image } from 'react-native';
import { Alert } from '../../lib/ui/alert'; // 커스텀 알림(앱 디자인)
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { CREDIT_KINDS, loadCredits, redeemCoupon, grantCredit, PREMIUM_PRICE, type CreditKind } from '../../lib/billing/coupons';
import { listCharts, getRepresentativeId, setRepresentative, type SavedChart } from '../../lib/engine/myChart';
import { ListSkeleton } from '../../components/Skeleton'; // 첫 진입 로딩 스켈레톤(daniel 07-02: 마켓 즉시 전환+스켈레톤)
import { useDeferredReady } from '../../lib/ui/useDeferredReady'; // 전환 즉시 스켈레톤 → 전환 후 콘텐츠 마운트(멈칫 제거)
import { purchaseCreditRC, purchasesEnabled, priceStringsRC, priceStringRC, CREDIT_PRODUCT, PRODUCT_PREMIUM } from '../../lib/billing/purchases';
import { markPremiumOwnedNow } from '../../lib/billing/premiumStore'; // 구매 즉시 낙관적 반영(바로 적용)
import { useSubscription } from '../../lib/billing/subscription'; // 프리미엄 가입 루트(전체 무제한)
import { useAuth } from '../../lib/useAuth';              // 세션(프리미엄 명식 지정 시 serverChartId 발급)
import { supabase } from '../../lib/supabase';            // set_premium_chart RPC(구매 명식 지정)
import { ensureServerChartIdForSaved } from '../../lib/backend/prewarmReadings'; // 구매 명식 serverChartId 확보
import { colors, radius, space, shadow, font } from '../../lib/theme';

// 이용권 kind → 적용할 풀이 화면(선택 명식을 대표로 둔 뒤 진입 — 대표 기준 캐시)
const ROUTE: Record<CreditKind, { pathname: string; kind?: string }> = {
  reading: { pathname: '/reading' },                  // 사주 원국 풀이
  ziwei: { pathname: '/reading', kind: 'ziwei' },     // 자미두수 풀이
  timeline: { pathname: '/timeline' },                // 인생 타임라인
  compat: { pathname: '/compat' },                    // 궁합
  followup: { pathname: '/reading' },                 // 추가 질문(풀이 안에서)
  love: { pathname: '/love' },                        // 애정흐름
  newyear: { pathname: '/newyear' },                  // 신년운세(스페셜)
  lifegraph: { pathname: '/lifegraph' },              // 인생 그래프(스페셜)
  roots: { pathname: '/roots' },                      // 명식의 뿌리(통근·투출)
  image: { pathname: '/image' },                      // 비치는 나(천간 인상)
  mission: { pathname: '/mission' },                  // 나의 사명(자미 보조)
  career: { pathname: '/career' },                    // 사업가의 나 vs 직장인의 나
  talent: { pathname: '/talent' },                    // 나의 타고난 재능(월지 축)
  astrology: { pathname: '/astrology' },              // 별자리 운세(서양 네이탈)
  dream: { pathname: '/dream' },                       // AI 꿈해몽(자유 텍스트)
  gaeun: { pathname: '/gaeun' },                       // 맞춤 개운법(daniel #18)
  celeb: { pathname: '/celeb' },                       // 세계 인물 매칭(daniel B)
  timeresolve: { pathname: '/timeResolve' },           // 태어난 시 찾기(TPR — daniel 06-28)
};

// 이용권 kind → 카드 이미지 + 설명키(홈 카드와 동일 재사용, daniel: 마켓 리스트에도 작게+설명).
//   followup(추가질문)은 standalone 카드가 아니라(풀이 내부) 생략 — 없으면 이미지·설명 미표시(graceful).
const CARD: Partial<Record<CreditKind, { img: any; desc: string }>> = {
  reading: { img: require('../../../assets/icons/premium.jpg'), desc: 'menu.sajuDesc' },
  ziwei: { img: require('../../../assets/icons/ziwei.jpg'), desc: 'menu.ziweiHubDesc' },
  compat: { img: require('../../../assets/icons/compat.jpg'), desc: 'menu.compatDesc' },
  timeline: { img: require('../../../assets/icons/timeline.jpg'), desc: 'menu.timelineDesc' },
  love: { img: require('../../../assets/icons/love.jpg'), desc: 'menu.loveDesc' },
  newyear: { img: require('../../../assets/icons/newyear.jpg'), desc: 'menu.newyearTileDesc' },
  lifegraph: { img: require('../../../assets/icons/lifegraph.jpg'), desc: 'menu.lifegraphDesc' },
  roots: { img: require('../../../assets/icons/roots.jpg'), desc: 'menu.rootsDesc' },
  image: { img: require('../../../assets/icons/image.jpg'), desc: 'menu.imageDesc' },
  mission: { img: require('../../../assets/icons/mission.jpg'), desc: 'menu.missionDesc' },
  career: { img: require('../../../assets/icons/career.jpg'), desc: 'menu.careerDesc' },
  talent: { img: require('../../../assets/icons/talent.jpg'), desc: 'menu.talentDesc' },
  astrology: { img: require('../../../assets/icons/astrology.jpg'), desc: 'menu.astrologyDesc' },
  dream: { img: require('../../../assets/icons/dream.jpg'), desc: 'menu.dreamDesc' },
  gaeun: { img: require('../../../assets/icons/gaeun.jpg'), desc: 'menu.gaeunDesc' }, // 맞춤 개운법(daniel #18)
  celeb: { img: require('../../../assets/icons/celeb.jpg'), desc: 'menu.celebDesc' }, // 세계 인물 매칭(daniel B)
  timeresolve: { img: require('../../../assets/icons/timeResolve.jpg'), desc: 'menu.timeResolveDesc' }, // 태어난 시 찾기(TPR — daniel 06-28)
  followup: { img: require('../../../assets/icons/followup.jpg'), desc: 'menu.followupDesc' }, // 추가 질문(daniel: 마켓에도 이미지)
};

export default function MarketRoute() {
  const { t } = useTranslation();
  const router = useRouter();
  const { session } = useAuth();                          // 프리미엄 명식 지정(serverChartId 발급)에 필요
  const [saved, setSaved] = useState<SavedChart[]>([]);
  const [sel, setSel] = useState<SavedChart | null>(null);   // 적용할 명식(기본=대표)
  const [pick, setPick] = useState(false);                   // 명식 선택 모달
  const [credits, setCredits] = useState<Record<string, number>>({});
  const [code, setCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [busy, setBusy] = useState<CreditKind | null>(null); // 구매 진행 중 kind
  const [prices, setPrices] = useState<Record<string, string>>({}); // 현지통화 가격(RC) — 미설정 시 ₩ 폴백
  const { isPremium, purchasePremium, refresh } = useSubscription(); // 프리미엄 상태·구매
  const [premPrice, setPremPrice] = useState(''); // 프리미엄 현지통화 가격(RC)
  const [buyingPrem, setBuyingPrem] = useState(false);
  const ready = useDeferredReady(); // 네비 전환 완료 후 콘텐츠 마운트 — 그 전엔 스켈레톤(첫 진입 즉시 전환·멈칫 제거)

  useEffect(() => {
    (async () => {
      const list = await listCharts(); setSaved(list);
      const repId = await getRepresentativeId();
      setSel(list.find((c) => c.id === repId) ?? list[0] ?? null);
      loadCredits().then(setCredits).catch(() => {});
      // 현지 통화 가격(RC) 일괄 로드 — USD 기준 등록 시 사용자 지역 통화로 자동 표시. 미설정/실패 시 ₩ 폴백.
      priceStringsRC(CREDIT_KINDS.map((c) => CREDIT_PRODUCT[c.key])).then((m) => {
        setPrices(Object.fromEntries(CREDIT_KINDS.map((c) => [c.key, m[CREDIT_PRODUCT[c.key]] ?? `₩${c.price.toLocaleString()}`])));
      }).catch(() => {});
    })();
  }, []);

  // 프리미엄 현지통화 가격(RC) — 미설정 시 ₩ 폴백
  useEffect(() => { priceStringRC(PRODUCT_PREMIUM, `₩${PREMIUM_PRICE.toLocaleString()}`).then(setPremPrice).catch(() => {}); }, []);

  // 프리미엄 가입(평생·전체 무제한) — 결제 미연동 시 '준비 중'. 성공 시 상태 갱신. 취소는 조용히.
  //   daniel: 결제 진행 전 '적용 명식'을 확인 Alert 로 한 번 더 보여준다(오결제 방지). 실제 구매 로직은 내부 함수로 분리.
  async function buyPremium() {
    // 실제 프리미엄 구매(확인 Alert 통과 후 호출) — 기존 로직 그대로 이동.
    async function doBuyPremium() {
      if (buyingPrem) return;
      if (!purchasesEnabled()) { Alert.alert(t('market.payPending')); return; }
      setBuyingPrem(true);
      try {
        await purchasePremium();
        // 프리미엄 = 지정 명식 1개에 적용(daniel 07-01) — 구매한 명식(sel)을 서버 지정(최초 1회, 변경은 재결제).
        let scid: string | null = null;
        try {
          if (sel && session) {
            scid = await ensureServerChartIdForSaved(sel, session);
            if (scid) await supabase.rpc('set_premium_chart', { p_chart_id: scid });
          }
        } catch { /* 지정 실패해도 구매는 성공(유예=전 명식, 추후 재시도) */ }
        markPremiumOwnedNow(scid ?? undefined); // ★구매 즉시 반영(RC 캐시 지연 무관, daniel 07-02: 바로 적용)
        await refresh();                        // 서버 재확인(웹훅·지정 명식 반영)
        Alert.alert(t('settings.premiumOkTitle'), t('settings.premiumOk'));
      } catch (e: any) {
        if (e?.message === 'cancelled') return;
        Alert.alert(t('settings.premiumTitle'), e?.message ?? '');
      } finally { setBuyingPrem(false); }
    }
    // 명식이 하나도 없으면(=등록 0개) 먼저 등록 안내 — 명식 기준으로 적용·진입하므로.
    if (!sel) { Alert.alert(t('market.noChart'), t('market.registerChartFirst', '명식을 먼저 등록해 주세요')); return; }
    // 진행 전 적용 명식 확인(daniel) — 확인 시에만 실제 구매.
    Alert.alert(
      t('market.confirmChartTitle', '명식 확인'),
      t('market.confirmChartMsg', `'${sel?.label ?? '대표 명식'}' 명식으로 프리미엄을 진행할까요?`),
      [
        { text: t('common.cancel', '취소'), style: 'cancel' },
        { text: t('common.confirm', '확인'), onPress: () => void doBuyPremium() },
      ],
    );
  }

  // 이용권 적용 — 선택 명식을 대표로 설정 후 해당 풀이 화면으로(거기서 이용권/프리미엄/구매로 열림).
  async function apply(kind: CreditKind) {
    if (sel) await setRepresentative(sel.id);
    const r = ROUTE[kind];
    router.navigate({ pathname: r.pathname, params: r.kind ? { kind: r.kind } : {} }); // navigate=정적 /reading 중복 스택 dedup(daniel 07-01)
  }

  // 이용권 구매(결제) — RevenueCat 소비성 결제 성공 → 크레딧 +1(웹훅 전 클라 반영) → 보유 갱신.
  //   RC 미설정(키/네이티브 미포함) 시 '준비 중' 안내. 사용자 취소는 조용히 무시.
  async function buy(kind: CreditKind) {
    if (busy) return;
    if (!purchasesEnabled()) { Alert.alert(t('market.payPending')); return; }
    setBusy(kind);
    try {
      const ok = await purchaseCreditRC(kind);   // 결제 성공 시 true(취소=false)
      if (ok) {
        await grantCredit(kind);                  // 크레딧 +1 (RC 웹훅 도입 전 MVP)
        setCredits(await loadCredits());
        Alert.alert(t('market.doneTitle'), t('market.doneMsg'));
      }
    } catch (e: any) {
      Alert.alert(t('market.buyFailTitle'), e?.message ?? '');
    } finally {
      setBusy(null);
    }
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

  // 개별 구매 전용(프리미엄 미포함) kind — 섹션 B. 그 외 전부는 프리미엄에 포함(섹션 A).
  //   ※ timeline(인생 타임라인)도 프리미엄에 포함(섹션 A) — 사주+자미 종합이라 프리미엄 콘텐츠(daniel 2026-07-01). 개별가 ₩1,990.
  const INDIVIDUAL = new Set<CreditKind>(['dream', 'followup', 'timeresolve']);

  // 마켓 카드 한 장 렌더(섹션 A·B 공유 헬퍼) — premInc=프리미엄 포함 섹션 여부.
  //   • premInc && isPremium → 가격·구매 버튼 숨기고 '무제한 이용 중' 배지 + 카드 누르면 열기(apply).
  //   • 그 외(비프리미엄 또는 개별전용 섹션) → 기존 동작: 보유 시 열기 / 미보유 시 개별 구매.
  //   ※ 결제·적용 로직(buy/apply/grantCredit)은 미변경 — 표시 분기만 추가(UI 전용).
  function renderCard(c: (typeof CREDIT_KINDS)[number], premInc: boolean) {
    const owned = (credits[c.key] ?? 0) > 0; // 1회성 소모 — 보유/미보유로만
    const card = CARD[c.key];                // 카드 이미지+설명(홈과 동일·daniel: 마켓 리스트에도)

    // 프리미엄 포함 섹션 + 프리미엄 가입 = 무제한(가격/구매 숨김, 카드 전체가 열기 버튼)
    if (premInc && isPremium) {
      return (
        <Pressable key={c.key} style={styles.card} onPress={() => apply(c.key)} disabled={!sel}>
          {card && <Image source={card.img} style={styles.thumb} />}
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{c.ko}</Text>
            {card && <Text style={styles.desc} numberOfLines={2}>{t(card.desc)}</Text>}
          </View>
          <View style={styles.unlimitedBadge}>
            <Text style={styles.unlimitedTx}>{t('market.unlimited', '무제한 이용 중')}</Text>
          </View>
        </Pressable>
      );
    }

    // 기존 동작(현행 그대로): 보유 시 열기(apply) / 미보유 시 개별 구매(buy)
    return (
      <View key={c.key} style={styles.card}>
        {card && <Image source={card.img} style={styles.thumb} />}
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{c.ko}</Text>
          {card && <Text style={styles.desc} numberOfLines={2}>{t(card.desc)}</Text>}
          <Text style={styles.price}>{prices[c.key] ?? `₩${c.price.toLocaleString()}`}</Text>
          <Text style={[styles.have, owned && styles.haveOn]}>{owned ? `${t('market.owned')} ×${credits[c.key]}` : t('market.notOwned')}</Text>
        </View>
        {owned ? (
          <Pressable style={styles.buyBtn} onPress={() => apply(c.key)} disabled={!sel}>
            <Text style={styles.buyTx}>{t('market.openApply')}</Text>
          </Pressable>
        ) : (
          <Pressable style={[styles.buyBtn, busy === c.key && styles.buyBtnBusy]} onPress={() => buy(c.key)} disabled={busy !== null}>
            <Text style={styles.buyTx}>{busy === c.key ? '…' : t('market.buy')}</Text>
          </Pressable>
        )}
      </View>
    );
  }

  // ★첫 진입 즉시 마켓뷰 전환 + 로딩까지 스켈레톤(daniel 07-02) — 전환 애니 끝난 뒤 무거운 카드·RC 가격 마운트.
  if (!ready) return <ScrollView style={styles.screen} contentContainerStyle={styles.wrap}><ListSkeleton rows={6} /></ScrollView>;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      <Text style={styles.intro}>{t('market.intro')}</Text>
      {/* ★보유기한 1년 명시(daniel: 법적 — 약관 제4조 3항과 일치) — 비프리미엄에게만(프리미엄=무제한 보유라 불필요) */}
      {!isPremium && <Text style={styles.retention}>{t('market.retentionNote', '구매한 풀이는 구매일로부터 1년간 보유되며, 1년이 지나면 자동 삭제됩니다. 이후 다시 보려면 재구매가 필요해요.')}</Text>}

      {/* 프리미엄 — 명식 무관(전체 무제한). 비프리미엄=가입 카드 / 프리미엄=이용 중 표시(항상 노출) */}
      {isPremium ? (
        <View style={styles.premCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.premTitle}>{t('market.premiumActive', '프리미엄 이용 중')}</Text>
            <Text style={styles.premSub}>{t('market.premiumActiveSub', '모든 콘텐츠 무제한 · 광고 제거 적용 중')}</Text>
          </View>
          <Text style={styles.premPrice}>✓</Text>
        </View>
      ) : (
        <Pressable style={styles.premCard} onPress={buyPremium} disabled={buyingPrem}>
          <View style={{ flex: 1 }}>
            <Text style={styles.premTitle}>{t('settings.premiumBuy', '평생 프리미엄')}</Text>
            <Text style={styles.premSub}>{t('settings.premiumDesc', '모든 콘텐츠 무제한 · 광고 제거')}</Text>
            {/* 적용 명식 안내(daniel) — 결제 전 어느 명식으로 진행되는지 작은 글씨로 노출 */}
            <Text style={styles.premChart}>{t('market.appliedChart', '적용 명식')}: {sel?.label ?? t('market.noChart')}</Text>
          </View>
          <Text style={styles.premPrice}>{buyingPrem ? '…' : (premPrice || `₩${PREMIUM_PRICE.toLocaleString()}`)}</Text>
        </Pressable>
      )}

      {/* 적용할 명식 선택(드롭다운) — 이용권은 이 명식에 적용된다 */}
      <Pressable style={styles.chartSel} onPress={() => setPick(true)}>
        <View style={{ flex: 1 }}>
          <Text style={styles.chartSelLabel}>{t('market.applyTo')}</Text>
          <Text style={styles.chartSelVal}>{sel?.label ?? t('market.noChart')}</Text>
        </View>
        <Text style={styles.chartSelChevron}>▾</Text>
      </Pressable>

      {/* ── 섹션 A: 프리미엄에 포함 ── 프리미엄=무제한 이용 중 배지 / 비프리미엄=가격+개별구매(기존). 타임라인도 여기 포함(daniel 2026-07-01, 사주+자미 종합). */}
      <Text style={styles.sectionH}>{t('market.sectionIncluded', '✦ 프리미엄에 포함')}</Text>
      <Text style={styles.sectionSub}>{t('market.sectionIncludedSub', '프리미엄 가입 시 아래 풀이를 명식 수 제한 없이 무제한 이용해요(개별 구매도 가능).')}</Text>
      {CREDIT_KINDS.filter((c) => !INDIVIDUAL.has(c.key)).map((c) => renderCard(c, true))}

      {/* ── 섹션 B: 개별 구매 전용(프리미엄 미포함) ── isPremium 무관 항상 개별 구매(기존) */}
      <Text style={styles.sectionH}>{t('market.sectionIndividual', '◆ 개별 구매 전용 · 프리미엄 미포함')}</Text>
      <Text style={styles.sectionSub}>{t('market.sectionIndividualSub', '아래 항목은 프리미엄에 포함되지 않아 따로 구매해요.')}</Text>
      {CREDIT_KINDS.filter((c) => INDIVIDUAL.has(c.key)).map((c) => renderCard(c, false))}

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

      {/* 명식 선택 모달 */}
      <Modal visible={pick} transparent animationType="slide" onRequestClose={() => setPick(false)}>
        <Pressable style={styles.backdrop} onPress={() => setPick(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{t('market.applyTo')}</Text>
            <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false}>
              {saved.length === 0 ? <Text style={styles.note}>{t('market.noChart')}</Text> : saved.map((s) => {
                const on = sel?.id === s.id;
                return (
                  <Pressable key={s.id} style={styles.pickRow} onPress={() => { setSel(s); setPick(false); }}>
                    <Text style={[styles.pickTx, on && styles.pickTxOn]}>{s.label}</Text>
                    {on && <Text style={styles.pickChk}>✓</Text>}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.bg },
  wrap: { padding: space(5), paddingBottom: space(20) },
  intro: { ...font.body, color: colors.inkSoft, marginBottom: space(2) },
  retention: { ...font.caption, color: colors.inkFaint, marginBottom: space(4), lineHeight: 18 }, // 보유기한 1년 안내(daniel 법적)
  // 프리미엄 가입 카드(골드 강조)
  premCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.ju, borderRadius: radius.md, padding: space(4), marginBottom: space(4), ...shadow.card },
  premTitle: { fontSize: 16, fontWeight: '900', color: colors.bg },
  premSub: { fontSize: 12, color: colors.bg, opacity: 0.85, marginTop: 2 },
  premChart: { fontSize: 11, fontWeight: '700', color: colors.bg, opacity: 0.75, marginTop: 4 }, // 적용 명식 안내(비프리미엄 카드)
  premPrice: { fontSize: 16, fontWeight: '900', color: colors.bg, marginLeft: space(2) },
  // 인생 타임라인 독립 강조 카드(골드 강조 테두리 — 명식 선택 아래 단독 노출, daniel)
  timelineCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.ju, padding: space(4), marginBottom: space(4), ...shadow.card },
  timelineThumb: { width: 56, height: 78, borderRadius: radius.md, marginRight: space(3), backgroundColor: colors.sunk }, // 강조 카드라 일반 thumb(46×64)보다 크게
  timelineTitle: { fontSize: 17, fontWeight: '900', color: colors.ink },
  timelineDesc: { ...font.caption, color: colors.inkSoft, marginTop: 2, marginBottom: 1, lineHeight: 16 },
  // 적용할 명식 선택
  chartSel: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.ju, borderRadius: radius.md, padding: space(4), marginBottom: space(4), ...shadow.card },
  chartSelLabel: { ...font.caption, color: colors.ju, fontWeight: '800' },
  chartSelVal: { fontSize: 16, fontWeight: '800', color: colors.ink, marginTop: 2 },
  chartSelChevron: { fontSize: 16, color: colors.ju, marginLeft: space(2) },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: space(4), marginBottom: space(3), ...shadow.card },
  name: { fontSize: 16, fontWeight: '800', color: colors.ink },
  thumb: { width: 46, height: 64, borderRadius: radius.md, marginRight: space(3), backgroundColor: colors.sunk }, // 마켓 리스트 카드 썸네일(작게·daniel)
  desc: { ...font.caption, color: colors.inkSoft, marginTop: 2, marginBottom: 1, lineHeight: 16 }, // 설명 아랫줄(홈과 동일)
  price: { ...font.caption, color: colors.ju, fontWeight: '800', marginTop: 2 },
  have: { ...font.caption, color: colors.inkFaint, marginTop: 2 },
  haveOn: { color: colors.ju, fontWeight: '800' },
  buyBtn: { backgroundColor: colors.ju, borderRadius: radius.pill, paddingHorizontal: space(5), paddingVertical: space(2.5), minWidth: 84, alignItems: 'center' },
  buyBtnBusy: { opacity: 0.5 },
  buyTx: { color: colors.bg, fontWeight: '800', fontSize: 14 },
  // 마켓 섹션 제목·설명(프리미엄 포함 / 개별 구매 전용 구분 — daniel) — 골드 톤 heading + 보조 caption
  sectionH: { ...font.heading, color: colors.ju, marginTop: space(5), marginBottom: space(1) },
  sectionSub: { ...font.caption, color: colors.inkSoft, marginBottom: space(3), lineHeight: 16 },
  // 프리미엄 무제한 배지(섹션 A · 프리미엄 가입 시 가격·구매 버튼 대체) — 골드 외곽선 상태 배지
  unlimitedBadge: { backgroundColor: colors.juSoft, borderWidth: 1, borderColor: colors.juLine, borderRadius: radius.pill, paddingHorizontal: space(4), paddingVertical: space(2), marginLeft: space(2), alignItems: 'center' },
  unlimitedTx: { color: colors.ju, fontWeight: '800', fontSize: 13 },
  // 쿠폰 등록
  couponH: { ...font.heading, marginTop: space(6), marginBottom: space(3) },
  couponRow: { flexDirection: 'row', gap: space(2), alignItems: 'center' },
  couponInput: { flex: 1, ...font.body, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, paddingHorizontal: space(3), paddingVertical: space(2.75), color: colors.ink, letterSpacing: 1 },
  couponBtn: { backgroundColor: colors.ju, borderRadius: radius.sm, paddingHorizontal: space(4), paddingVertical: space(2.75) },
  couponBtnOff: { opacity: 0.45 },
  couponBtnTx: { color: colors.bg, fontWeight: '800', fontSize: 14 },
  note: { ...font.caption, color: colors.inkFaint, marginTop: space(4), lineHeight: 18 },
  // 명식 선택 모달
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { backgroundColor: colors.bg, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, paddingHorizontal: space(5), paddingTop: space(2.5), paddingBottom: space(8) },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.line, alignSelf: 'center', marginBottom: space(3) },
  sheetTitle: { ...font.heading, marginBottom: space(2) },
  pickRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: space(3.5), borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  pickTx: { ...font.body, color: colors.inkSoft },
  pickTxOn: { color: colors.ju, fontWeight: '800' },
  pickChk: { fontSize: 16, color: colors.ju, fontWeight: '800' },
});
