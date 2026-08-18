// app/src/components/home/BonusStrip.tsx — 홈 「도착한 혜택」 쿠폰 스트립 (시안 p13 하단)
// ═══════════════════════════════════════════════════════════════════════════
// ■ 시안 실측
//   · 「이번주 ○○님께 도착한 혜택」(섹션 제목) → 카드 안에 「무료 쿠폰 받아가세요!」 + 장수 배지
//   · 「8월 18일까지 사용할 수 있어요.」 → 티켓 3장(10% / 30% / 60%)
//
// ■ 우리 데이터로 정직하게 옮긴 것
//   시안은 '할인 쿠폰'이지만 우리 것은 **보너스 운**이다 — 스토어 가격을 앱이 바꿀 수 없어서다
//   (`0025_coin_bonus_coupons.sql` 머리말). 그래서 문구를 「+30% 더」로 적는다.
//   ⚠️'할인'이라고 쓰면 결제창 금액과 어긋나고, 그건 그 자체로 거짓말이 된다.
//
// ★쿠폰이 없으면 **블록 자체를 그리지 않는다.** 빈 카드로 자리를 잡아 두면
//   "받을 게 있나?" 하고 눌러 보게 만들고, 그건 없는 혜택을 광고하는 것과 같다.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { listBonusCoupons, type BonusCoupon } from '../../lib/billing/coinBonus';
import { SectionTitle } from '../kit/SectionTitle';
import { PressableScale } from '../PressableScale';
import { colors, radius, space, font, shadow } from '../../lib/theme';

/** 티켓은 세 장까지만 — 그 이상은 어차피 큰 것부터 자동으로 쓰인다(coins 화면과 같은 규칙). */
const MAX = 3;

/**
 * 홈 혜택 스트립.
 * @param name 인사에 쓸 이름(대표 명식 라벨). 없으면 이름 없이 적는다
 */
export function BonusStrip({ name }: { name?: string | null }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [coupons, setCoupons] = useState<BonusCoupon[] | null>(null);

  useEffect(() => { void listBonusCoupons().then(setCoupons); }, []);

  if (!coupons || coupons.length === 0) return null;   // 없는 혜택을 광고하지 않는다

  // 가장 가까운 만료일 — 시안의 「8월 18일까지 사용할 수 있어요」
  const soonest = coupons
    .map((c) => c.expiresAt)
    .filter((x): x is string => !!x)
    .sort()[0];

  return (
    <>
      <SectionTitle>
        {name ? t('home.bonusTitleName', { name, defaultValue: '{{name}}님께 도착한 혜택' })
              : t('home.bonusTitle', '도착한 혜택')}
      </SectionTitle>

      <PressableScale style={styles.card} onPress={() => router.push('/coins')}>
        <View style={styles.head}>
          <Text style={styles.headTx}>{t('home.bonusLead', '충전할 때 자동으로 쓰여요')}</Text>
          <View style={styles.count}><Text style={styles.countTx}>{coupons.length}장</Text></View>
        </View>
        {soonest ? (
          <Text style={styles.until}>
            {t('home.bonusUntil', { date: soonest.slice(0, 10), defaultValue: '{{date}}까지 쓸 수 있어요.' })}
          </Text>
        ) : null}

        <View style={styles.row}>
          {coupons.slice(0, MAX).map((c) => (
            <View key={c.id} style={styles.ticket}>
              {/* ★'할인'이 아니라 '더' — 결제 금액은 그대로다(시안 문구를 그대로 쓰면 거짓이 된다) */}
              <Text style={styles.pct}>+{c.bonusPct}%</Text>
              <Text style={styles.pctSub} numberOfLines={1}>{c.label ?? t('coins.bonusAny', '충전 시 자동 적용')}</Text>
            </View>
          ))}
        </View>
      </PressableScale>
    </>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: space(4.5), marginBottom: space(3), ...shadow.soft },
  head: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  headTx: { ...font.heading, color: colors.ju, fontWeight: '900', flex: 1 },
  count: { backgroundColor: colors.juSoft, borderRadius: radius.pill, paddingHorizontal: space(2.5), paddingVertical: space(1) },
  countTx: { ...font.caption, color: colors.ju, fontWeight: '800' },
  until: { ...font.caption, color: colors.inkFaint, marginTop: space(1.5) },
  row: { flexDirection: 'row', gap: space(2), marginTop: space(3.5) },
  // 시안의 티켓 — 점선 테두리로 '쿠폰'임을 형태로 알린다
  ticket: {
    flex: 1, alignItems: 'center', backgroundColor: colors.juSoft,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.juLine, borderStyle: 'dashed',
    paddingVertical: space(3), paddingHorizontal: space(1.5),
  },
  pct: { fontSize: 19, lineHeight: 26, fontWeight: '900', color: colors.ju, letterSpacing: -0.5 },
  pctSub: { ...font.caption, color: colors.inkSoft, fontSize: 10.5, marginTop: 2 },
});
