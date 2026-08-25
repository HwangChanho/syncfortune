// app/src/app/(app)/coinhistory.tsx — 「결제/충전 내역」 (시안 p06 마이페이지의 보조 버튼)
// ═══════════════════════════════════════════════════════════════════════════
// ■ 무엇을 보여주나
//   `coin_ledger`(owner_id·delta·reason·kind·ref·created_at) 를 최신순으로 그대로 보여준다.
//   충전(+)과 사용(−)이 **한 줄기**로 섞여 있어야 "내 운이 어디로 갔나"가 설명된다 —
//   충전만 따로 보여주면 잔액이 줄어든 이유를 알 수 없다.
//
// ■ 왜 서버 원장을 그대로 쓰나
//   잔액은 서버가 원자적으로 계산한다([[double-charge-unlock-claim]]). 앱이 내역을 다시 합산해
//   보여주면 **같은 화면에서 두 숫자가 갈릴** 수 있다. 여기서는 원장을 나열만 하고 합계를 내지 않는다.
//
// ⚠️조회 실패와 '내역 없음'을 구분한다([[coin-system]]) — 실패를 빈 목록으로 그리면
//   사용자는 "결제가 사라졌다"고 읽는다. 실패는 실패라고 적고 다시 시도할 길을 준다.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { withTimeout } from '../../lib/core/withTimeout';   // ★supabase 는 기본 타임아웃이 없다(멈춤 근절)
import { PressableScale } from '../../components/PressableScale';
import { coinLedgerLabel } from '../../lib/content/coinLedgerLabel';   // 내역 한 줄을 그 나라 말로(Boss 08-25)
import { colors, radius, space, font, shadow } from '../../lib/theme';

/** 원장 한 줄. delta 가 +면 충전·보상, −면 사용. */
type Entry = { id: string; delta: number; reason: string | null; kind: string | null; created_at: string };

/** 조회 결과 — 실패(null)와 빈 목록([])을 타입에서부터 구분한다. */
type Result = { rows: Entry[] } | { error: true } | null;   // null = 아직 로딩 중

export default function CoinHistoryScreen() {
  const { t } = useTranslation();
  const [res, setRes] = useState<Result>(null);

  const load = useCallback(async () => {
    setRes(null);
    try {
      // ★타임아웃이면 `undefined` 가 온다 — 그것도 실패다(빈 목록으로 흘리지 않는다).
      const r = await withTimeout(
        supabase.from('coin_ledger').select('id, delta, reason, kind, created_at').order('created_at', { ascending: false }).limit(200),
        8000,
      );
      if (!r || r.error || !r.data) { setRes({ error: true }); return; }
      setRes({ rows: r.data as Entry[] });
    } catch { setRes({ error: true }); }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={styles.body}>
      {res === null ? (
        <View style={styles.center}><ActivityIndicator color={colors.ju} /></View>
      ) : 'error' in res ? (
        // 실패 — 빈 목록으로 위장하지 않는다
        <View style={styles.center}>
          <Text style={styles.emptyTx}>{t('coinHistory.failed', '내역을 불러오지 못했어요.')}</Text>
          <PressableScale style={styles.retry} onPress={() => void load()}>
            <Text style={styles.retryTx}>{t('common.retry', '다시 시도')}</Text>
          </PressableScale>
        </View>
      ) : res.rows.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyTx}>{t('coinHistory.empty', '아직 충전·사용 내역이 없어요.')}</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {res.rows.map((e, i, arr) => {
            const plus = e.delta > 0;
            return (
              <View key={e.id} style={[styles.row, i < arr.length - 1 && styles.rowLine]}>
                <View style={styles.rowL}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {/* ★서버 원문(`spend`·`purchase` 같은 **코드**)을 그대로 찍지 않는다 —
                        한국 사용자에겐 영어 코드가, 영어·일본어 사용자에겐 번역 안 된 값이 떴다.
                        `reason`(무슨 일이) × `kind`(무엇에) 를 둘 다 읽어 그 나라 말로 적는다. */}
                    {coinLedgerLabel(e.reason, e.kind, e.delta, t)}
                  </Text>
                  <Text style={styles.rowDate}>{e.created_at.slice(0, 10)}</Text>
                </View>
                {/* 부호는 색이 아니라 **글자**로도 드러낸다 — 색만으로 구분하면 색각 차이에서 사라진다 */}
                <Text style={[styles.delta, plus ? styles.deltaPlus : styles.deltaMinus]}>
                  {plus ? '+' : ''}{e.delta.toLocaleString()}
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  // 하단 여백 170 = 광고 배너 50 + 하단 내비 86 + 홈 인디케이터 34(check:bottominset 기준)
  body: { paddingHorizontal: space(4), paddingTop: space(4), paddingBottom: 170 },
  center: { alignItems: 'center', paddingVertical: space(12), gap: space(3) },
  emptyTx: { ...font.body, color: colors.inkSoft, textAlign: 'center' },
  retry: { backgroundColor: colors.ju, borderRadius: radius.pill, paddingHorizontal: space(5), paddingVertical: space(2.5) },
  retryTx: { ...font.label, color: colors.onJu, fontWeight: '800' },

  list: { backgroundColor: colors.card, borderRadius: radius.lg, paddingHorizontal: space(4), ...shadow.soft },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingVertical: space(3.5) },
  rowLine: { borderBottomWidth: 1, borderBottomColor: colors.line },
  rowL: { flex: 1, gap: 2 },
  rowTitle: { ...font.body, color: colors.ink },
  rowDate: { ...font.caption, color: colors.inkFaint },
  delta: { ...font.heading, fontWeight: '900', letterSpacing: -0.3 },
  deltaPlus: { color: colors.ju },
  deltaMinus: { color: colors.inkSoft },
});
