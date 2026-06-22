// app/src/app/(app)/shared/[id].tsx — 이슈17: 공유받은 풀이 뷰어
// ─────────────────────────────────────────────────────────────────────────
// 딥링크 syncfortune://shared/<id> (또는 스마트링크 → 앱) 로 진입. get_shared_reading RPC(id 단건)로
//   풀이 스냅샷을 받아 표시한다. 앱에서만 열람(웹 랜딩 없음·daniel). 비로그인도 열람 가능(RPC anon 허용).
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { fetchSharedReading, type ShareReadingInput } from '../../../lib/share';
import { colors, radius, space, font, shadow } from '../../../lib/theme';

export default function SharedReadingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [state, setState] = useState<'loading' | 'ok' | 'err'>('loading');
  const [reading, setReading] = useState<ShareReadingInput | null>(null);

  useEffect(() => {
    let alive = true;
    fetchSharedReading(String(id))
      .then((r) => { if (!alive) return; if (r) { setReading(r); setState('ok'); } else setState('err'); })
      .catch(() => { if (alive) setState('err'); });
    return () => { alive = false; };
  }, [id]);

  // content(스냅샷)를 사람이 읽을 문단으로. 문자열 값만 추출(내부 키는 라벨로 안 보여줌 — 깔끔하게).
  const { headline, paragraphs } = (() => {
    const c = reading?.content as any;
    if (!c) return { headline: '', paragraphs: [] as string[] };
    if (typeof c === 'string') return { headline: '', paragraphs: [c] };
    const headline = typeof c.headline === 'string' ? c.headline : '';
    const skip = new Set(['headline', 'error']);
    const paragraphs = Object.entries(c)
      .filter(([k, v]) => !skip.has(k) && typeof v === 'string' && (v as string).trim())
      .map(([, v]) => v as string);
    return { headline, paragraphs };
  })();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.wrap}>
      <Stack.Screen options={{ title: '공유받은 풀이' }} />
      {state === 'loading' ? (
        <View style={styles.center}><ActivityIndicator color={colors.ju} /><Text style={styles.dim}>풀이 불러오는 중…</Text></View>
      ) : state === 'err' ? (
        <View style={styles.card}>
          <Text style={styles.err}>이 공유 링크의 풀이를 찾을 수 없어요.</Text>
          <Pressable style={styles.cta} onPress={() => router.replace('/')}><Text style={styles.ctaTx}>내 운세 보러 가기 ›</Text></Pressable>
        </View>
      ) : (
        <>
          <View style={styles.badge}><Text style={styles.badgeTx}>🔗 공유받은 풀이</Text></View>
          {reading?.title ? <Text style={styles.title}>{reading.title}</Text> : null}
          {headline ? <Text style={styles.headline}>{headline}</Text> : null}
          {paragraphs.map((p, i) => (
            <View key={i} style={styles.card}><Text style={styles.body}>{p}</Text></View>
          ))}
          {/* 앱 유도 — 받은 사람이 자기 운세도 보게 */}
          <Pressable style={styles.cta} onPress={() => router.replace('/')}><Text style={styles.ctaTx}>나도 내 운세 보기 ›</Text></Pressable>
          <Text style={styles.note}>SyncFortune — 사주·자미두수·타로 운세</Text>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.bg },
  wrap: { padding: space(6), paddingBottom: space(12) },
  center: { paddingVertical: space(20), alignItems: 'center', gap: space(3) },
  dim: { ...font.caption, color: colors.inkSoft },
  badge: { alignSelf: 'flex-start', backgroundColor: colors.juSoft, borderColor: colors.ju, borderWidth: 1, borderRadius: radius.sm, paddingVertical: space(1.5), paddingHorizontal: space(3), marginBottom: space(3) },
  badgeTx: { ...font.caption, color: colors.ju, fontWeight: '700' },
  title: { ...font.title, color: colors.ink, marginBottom: space(2) },
  headline: { fontSize: 18, fontWeight: '800', color: colors.ju, marginBottom: space(4), lineHeight: 26 },
  card: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.juLine, padding: space(5), marginBottom: space(3), ...shadow.card },
  body: { ...font.body, color: colors.ink, lineHeight: 24 },
  err: { ...font.body, color: colors.inkSoft, marginBottom: space(4) },
  cta: { backgroundColor: colors.ju, borderRadius: radius.md, paddingVertical: space(3.5), alignItems: 'center', marginTop: space(2) },
  ctaTx: { color: colors.bg, fontWeight: '800', fontSize: 16 },
  note: { ...font.caption, color: colors.inkFaint, textAlign: 'center', marginTop: space(5) },
});
