// src/app/(app)/reading.tsx — 풀이 라우트 (명식 게이트 + 대표 SavedChart 연결)
// ─────────────────────────────────────────────────────────────────────────
// '프리미엄 풀이'(딥 통변) 진입점. 풀이할 명식을 2경로로 결정한다:
//   ① input param 전달(만세력·특징·자미두수의 '풀이 보기') → 그 명식(캐시 매핑 없음 — 1회용)
//   ② param 없이 직접 진입(홈 '프리미엄 풀이' 타일) → 대표 SavedChart 로드 → serverChartId 캐시 연결(ADR-052)
// 대표 명식조차 없을 때만 등록을 유도(이미 등록한 사용자에게 '다시 등록' 요구 안 함).
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useState, useRef } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ReadingScreen } from '../../screens/ReadingScreen';
import { ChartPicker } from '../../components/ChartPicker'; // 풀이 상단 명식 전환 헤더(전환 시 게이트 재평가)
import { loadRepChart, listCharts, setRepresentative, getRepresentativeId, type SavedChart } from '../../lib/myChart';
import { colors, radius, space, font } from '../../lib/theme';
import type { ChartInput } from '@spec/chart';

export default function ReadingRoute() {
  const router = useRouter();
  const { t } = useTranslation();
  const { input, kind, chartId } = useLocalSearchParams<{ input?: string; kind?: string; chartId?: string }>();
  const [me, setMe] = useState<ChartInput | null>(null);
  const [savedChart, setSavedChart] = useState<SavedChart | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0); // 명식 전환(ChartPicker) → 대표 재로드 + ReadingScreen 리마운트(게이트 재평가)
  const didApplyChartId = useRef(false); // chartId param(풀이 명식) 대표 전환을 최초 1회만 — ChartPicker 수동 전환 존중·무한루프 방지

  useEffect(() => {
    // input param(특정 명식 지정 경로) 우선 → 캐시 매핑 없는 1회용.
    if (input) { setMe(JSON.parse(input)); setSavedChart(null); setLoading(false); return; }
    let alive = true;
    (async () => {
      // ★chartId param(홈 배너/푸시 = 그 풀이를 적용한 명식) → 최초 1회 *대표로 전환*(daniel #31: 풀이 명식으로 넘어가고
      //   헤더·전 화면이 그 명식으로 동기화). 이후엔 ChartPicker 수동 전환을 존중(didApply 가드 + 이미 대표면 skip → 무한루프 방지).
      if (chartId && !didApplyChartId.current) {
        didApplyChartId.current = true;
        const cs = await listCharts();
        const target = cs.find((c) => c.id === chartId) ?? null;
        if (target && (await getRepresentativeId()) !== target.id) await setRepresentative(target.id);
      }
      const ch = await loadRepChart(); // 대표(위 전환 반영) 로드 → savedChart·ChartPicker 헤더 일치
      if (!alive) return;
      setSavedChart(ch);
      setMe(ch?.input ?? null);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [input, chartId, reloadKey]);

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.ju} /></View>;

  // 대표 명식조차 없으면(신규 사용자)만 등록 유도. 명식이 있으면 이 분기를 타지 않는다.
  if (!me) {
    return (
      <View style={styles.center}>
        <Text style={styles.msg}>{t('manse.empty')}</Text>
        <Pressable style={styles.btn} onPress={() => router.push('/register')}>
          <Text style={styles.btnText}>{t('compat.registerMyChart')}</Text>
        </Pressable>
      </View>
    );
  }

  // kind=ziwei → 자미두수 12궁 풀이(별도 제목/항목). 기본 = 사주 16영역.
  const isZiwei = kind === 'ziwei';
  return (
    <ReadingScreen
      // 대표 명식이 바뀌면 key 변경 → 리마운트 → unlock/광고/결제 게이트가 새 명식 기준으로 재평가(daniel: 전환 시 결제 재확인)
      key={savedChart?.id ?? 'input'}
      input={me}
      savedChart={savedChart}
      kind={kind ?? 'saju'}
      titleKey={isZiwei ? 'reading.ziweiTitle' : 'reading.title'}
      subKey={isZiwei ? 'reading.ziweiSub' : 'reading.sub'}
      // 1회용 특정 명식(input)이 아니면 상단 명식 전환 헤더(전환 시 reloadKey→재로드→리마운트)
      header={!input ? <ChartPicker onChange={() => setReloadKey((k) => k + 1)} /> : undefined}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: space(7), backgroundColor: colors.bg },
  msg: { ...font.body, textAlign: 'center', marginBottom: space(5) },
  btn: { backgroundColor: colors.ju, borderRadius: radius.md, paddingVertical: space(3.25), paddingHorizontal: space(6) },
  btnText: { color: colors.white, fontSize: 15, fontWeight: '700' },
});
