// app/src/components/AdFreeSection.tsx — 광고 제거(코인 구매) 블록
// ─────────────────────────────────────────────────────────────────────────
// daniel 2026-07-28: "광고 제거를 코인으로 살수있게 하자"
//
// ★공용 컴포넌트로 만든 이유: 코인 화면(사용처)과 마켓(구매 동선) 두 곳에 필요한데,
//   각자 구현하면 가격·문구·상태 표기가 갈라진다 — 오늘 프리미엄 카드가 화면마다 달랐던 것과 같은 문제.
//   한 곳만 고치면 두 곳이 같이 바뀌게 둔다.
//
// ★이미 구매한 사용자에게는 **구매 버튼을 감추고 남은 기간만** 보여 준다.
//   판 것을 또 파는 화면은 "돈만 더 나가는 건가" 하는 불안을 만든다.
// ⚠️문구 = Claude 초안 → ★daniel 검수 슬롯.
// ─────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { PressableScale } from './PressableScale';
import { Alert } from '../lib/ui/alert';
import { AD_FREE_PLANS } from '../lib/billing/coinPrices';
import { buyAdFree, useAdFree, useAdFreeUntil, isAdFreeForever, type AdFreePlan } from '../lib/billing/adFree';
import { useFontScale } from '../lib/ui/fontScale';
import { withTimeout } from '../lib/core/withTimeout'; // ★잠금 구간 네트워크 상한(멈춤 방지)
import { colors, radius, space, font } from '../lib/theme';

/** 남은 기간 표기 — 영구/n일 남음. 하루 미만은 '오늘까지'. */
function remainLabel(until: number | null): string {
  if (until == null) return '';
  if (isAdFreeForever()) return '영구';
  const days = Math.ceil((until - Date.now()) / 86400000);
  return days <= 1 ? '오늘까지' : `${days}일 남음`;
}

/**
 * 광고 제거 구매 블록.
 * @param onDone 구매 성공 후 호출(호출측이 잔액을 다시 읽게 — 코인이 줄었으므로)
 * @param onNeedCoins 잔액 부족 시 호출(충전 화면으로 보낼 때). 없으면 안내만.
 */
export function AdFreeSection({ onDone, onNeedCoins }: { onDone?: () => void; onNeedCoins?: () => void }) {
  const { fs, ls } = useFontScale();
  const adFree = useAdFree();
  const until = useAdFreeUntil();
  const [busy, setBusy] = useState<string | null>(null);

  async function buy(plan: AdFreePlan, coins: number, days: number | null) {
    if (busy) return;
    const label = days == null ? '영구' : `${days}일`;
    Alert.alert(
      '광고 제거',
      `${coins} 운을 사용해 광고를 ${label} 없앨까요?`,
      [
        { text: '취소', style: 'cancel' },
        { text: '사용', onPress: async () => {
          setBusy(plan);
          try {
            // ⚠️★상한 필수(daniel 2026-08-01 "구매하니깐 멈췄어") — 여기는 setBusy(plan) 으로 버튼을 잠근 뒤다.
            //   buyAdFree 는 안에서 supabase 왕복을 하는데 기본 타임아웃이 없어, 응답이 안 오면
            //   await 가 안 끝나고 finally 도 실행되지 않아 **버튼이 영구히 잠긴다**.
            //   초과 = undefined → '지금은 확인이 어렵다'로 안내하고 잠금을 푼다(사용자를 가두지 않는다).
            const r = await withTimeout(buyAdFree(plan));
            if (!r) { Alert.alert('잠시 후 다시 시도해 주세요', '네트워크 응답이 늦어요. 운은 차감되지 않았어요.'); return; }
            if (r.ok) {
              Alert.alert('광고가 사라졌어요', r.already ? '이미 영구 이용 중이에요.' : `이제 ${days == null ? '영구히' : `${days}일간`} 광고가 보이지 않아요.`);
              onDone?.();
            } else if (r.reason === 'insufficient') {
              // ★부족 = 충전 유도. '조회 실패'와 구분된 서버 판정이라 여기선 안심하고 권할 수 있다.
              Alert.alert('운이 부족해요', `${coins} 운이 필요해요. 지금 ${r.balance} 운 있어요.`, [
                { text: '취소', style: 'cancel' },
                ...(onNeedCoins ? [{ text: '운 충전하기', onPress: onNeedCoins }] : []),
              ]);
            } else {
              Alert.alert('잠시 후 다시 시도해 주세요', '구매를 처리하지 못했어요. 운은 차감되지 않았어요.');
            }
          } finally { setBusy(null); }
        } },
      ],
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={[styles.h, { fontSize: fs(15) }]}>광고 제거</Text>

      {adFree ? (
        // 이미 구매 — 상태만. 영구면 더 팔지 않는다(서버 buy_ad_free 도 already 로 막는다).
        <View style={styles.onCard}>
          <Text style={[styles.onTx, { fontSize: fs(14) }]}>광고 없이 보고 있어요 · {remainLabel(until)}</Text>
        </View>
      ) : null}

      {/* 영구 구매자에겐 버튼 자체를 숨긴다. 기간제 이용 중이면 '연장' 의미로 계속 노출(이어붙는다). */}
      {isAdFreeForever() ? null : (
        <View style={styles.row}>
          {AD_FREE_PLANS.map((p) => (
            // ★칸 축소(daniel 2026-07-28 "칸이 너무 큰거 같아") — 3줄 세로 카드를 **한 줄**로.
            //   기간·가격이 한눈에 붙어 있으면 비교가 오히려 쉽고, 목록 전체가 짧아진다.
            <PressableScale key={p.id} style={styles.btn} onPress={() => void buy(p.id, p.coins, p.days)} disabled={busy !== null}>
              <Text style={[styles.btnTitle, { fontSize: fs(13) }]}>{p.days == null ? '영구' : `${p.days}일`}</Text>
              <Text style={[styles.btnCoins, { fontSize: fs(14) }]}>{busy === p.id ? '…' : `${p.coins} 운`}</Text>
            </PressableScale>
          ))}
        </View>
      )}

      {/* ★안내 2줄 → 1줄(칸 축소). 이어붙기 규칙은 실제로 살 때 알림에서 다시 알려 준다. */}
      <Text style={[styles.note, { fontSize: fs(11.5), lineHeight: 16 }]}>
        하단 배너와 AI 코치 보상형 광고가 함께 사라져요. 기간제는 남은 기간 뒤에 이어붙어요.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: space(4) },
  h: { ...font.caption, color: colors.ju, fontWeight: '800', letterSpacing: 0.5, marginBottom: space(2) },
  onCard: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.juLine, paddingVertical: space(2.5), paddingHorizontal: space(3.5), marginBottom: space(2) },
  onTx: { ...font.body, color: colors.ju, fontWeight: '800' },
  row: { flexDirection: 'row', gap: space(2) },
  btn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space(1.5), backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.juLine, paddingVertical: space(2.5) },
  btnTitle: { ...font.body, color: colors.inkSoft, fontWeight: '700' },
  btnCoins: { ...font.body, color: colors.ju, fontWeight: '900' },
  btnNote: { ...font.caption, color: colors.ju, fontWeight: '700', marginTop: 2 },
  note: { ...font.caption, color: colors.inkFaint, marginTop: space(2) },
});
