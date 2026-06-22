// src/app/(app)/charts.tsx — 만세력·차트 관리 (무료, 광고 진입, 한지·먹 테마). 내 명식(myChart) 표시.
// ─────────────────────────────────────────────────────────────────────────
// 저장된 내 차트(self) 로드 → MyeongsikScreen 재사용. 없으면 등록 유도. (추후 N명 목록 확장)
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useState, useMemo } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet, InteractionManager } from 'react-native';
import { useFontScale } from '../../lib/fontScale';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { MyeongsikScreen } from '../../screens/MyeongsikScreen';
import { loadMyChart } from '../../lib/myChart';
import { ChartPicker } from '../../components/ChartPicker';
import { colors, radius, space, font } from '../../lib/theme';
import type { ChartInput } from '@spec/chart';

export default function ChartsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [me, setMe] = useState<ChartInput | null>(null);
  const [loading, setLoading] = useState(true);
  // 만세력 첫 진입 시 computeChart(사주 엔진)가 동기 블록 → 화면 전환이 멈칫(daniel). 네비 애니 끝난 뒤
  //   (InteractionManager) 계산하도록 미루고 그동안 로딩 인디케이터 유지 → 멈칫 없이 매끄럽게. 이후 전환은 메모됨이라 즉시.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    loadMyChart().then((c) => { setMe(c); setLoading(false); });
    const task = InteractionManager.runAfterInteractions(() => setReady(true));
    return () => task.cancel();
  }, []);
  const { fs } = useFontScale();
  const styles = useMemo(() => makeStyles(fs), [fs]);

  if (loading || (me && !ready)) return <View style={styles.center}><ActivityIndicator color={colors.ju} /><Text style={[styles.msg, { marginTop: space(4) }]}>{t('manse.loading', '명식 불러오는 중…')}</Text></View>;

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

  // 명식 변경(ChartPicker, 대표 전환 시 me 갱신 → 만세력 즉시 전환) + 내 명식 표시 + 풀이 진입.
  return (
    <MyeongsikScreen
      input={me}
      header={<ChartPicker onChange={() => loadMyChart().then(setMe)} />}
      onReading={() => router.push({ pathname: '/reading', params: { input: JSON.stringify(me) } })}
    />
  );
}

const scaledFont = (fs: (n: number) => number) => ({
  title: { ...font.title, fontSize: fs(22) },
  heading: { ...font.heading, fontSize: fs(17) },
  body: { ...font.body, fontSize: fs(15) },
  label: { ...font.label, fontSize: fs(13) },
  caption: { ...font.caption, fontSize: fs(12) },
});
const makeStyles = (fs: (n: number) => number) => { const f = scaledFont(fs); return StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: space(7), backgroundColor: colors.bg },
  msg: { ...f.body, textAlign: 'center', marginBottom: space(5) },
  btn: { backgroundColor: colors.ju, borderRadius: radius.md, paddingVertical: space(3.25), paddingHorizontal: space(6) },
  btnText: { color: colors.white, fontSize: fs(15), fontWeight: '700' },
}); };
