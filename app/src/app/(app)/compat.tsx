// src/app/(app)/compat.tsx — 1:1 궁합 라우트 (내 차트 로드 → 주입, 다국어, 한지·먹 테마)
// ─────────────────────────────────────────────────────────────────────────
// 저장된 내 차트(self)를 로드해 CompatScreen 에 me 로 주입. 없으면 명식 등록 유도.
// 상대는 화면 내 직접 입력(동의 게이트 — 규칙8). 결정론 궁합은 온디바이스.
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useState, useRef } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { PressableScale } from '../../components/PressableScale';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { CompatScreen } from '../../screens/CompatScreen';
import { loadMyChart, listCharts, setRepresentative, getRepresentativeId } from '../../lib/engine/myChart';
import { colors, radius, space, font } from '../../lib/theme';
import type { ChartInput } from '@spec/chart';
import { useLogContentVisit } from '../../lib/backend/contentVisit'; // 콘텐츠 방문 집계(daniel 2026-07-06) — 진입 1회 기록

export default function CompatRoute() {
  useLogContentVisit('compat'); // 진입 1회 방문 기록(daniel 2026-07-06)
  const router = useRouter();
  const { t } = useTranslation();
  const { chartId } = useLocalSearchParams<{ chartId?: string }>(); // ★M1 재진입 바인딩(배너/푸시 route 의 chartId)
  const [me, setMe] = useState<ChartInput | null>(null);
  const [loading, setLoading] = useState(true);
  const lastAppliedChartId = useRef<string | null>(null); // ★M1 적용한 chartId param 추적(재진입 중복 setRepresentative 방지·reading.tsx 38-43)

  useEffect(() => {
    let alive = true;
    (async () => {
      // ★M1(재진입 바인딩): 배너/푸시 route 의 chartId → 그 명식을 대표로 1회 전환 → CompatScreen 이 '나' 슬롯(기본=대표)으로 채택(reading.tsx 38-43 패턴).
      //   콜드런치 preferSelfAsRep 로 대표가 self 로 리셋돼도 결제한 명식이 뜨게. 중복가드(ref)+이미 대표면 skip.
      if (chartId && chartId !== lastAppliedChartId.current) {
        lastAppliedChartId.current = chartId;
        const cs = await listCharts();
        const target = cs.find((sc) => sc.id === chartId) ?? null;
        if (target && (await getRepresentativeId()) !== target.id) await setRepresentative(target.id);
      }
      const c = await loadMyChart();
      if (!alive) return;
      setMe(c);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [chartId]);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.ju} /></View>;
  }

  // 내 차트 없음 — 명식 먼저 등록 유도
  if (!me) {
    return (
      <View style={styles.center}>
        <Text style={styles.msg}>{t('compat.needChart')}</Text>
        <PressableScale style={styles.btn} onPress={() => router.push('/register')}>
          <Text style={styles.btnText}>{t('compat.registerMyChart')}</Text>
        </PressableScale>
      </View>
    );
  }

  return <CompatScreen me={me} />;
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: space(7), backgroundColor: 'transparent' }, // 전역 배경 투과(ContentBackdrop)
  msg: { ...font.body, textAlign: 'center', marginBottom: space(5), lineHeight: 22 },
  btn: { backgroundColor: colors.ju, borderRadius: radius.md, paddingVertical: space(3.25), paddingHorizontal: space(6) },
  btnText: { color: colors.white, fontSize: 15, fontWeight: '700' },
});
