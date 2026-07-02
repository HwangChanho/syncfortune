// app/src/app/(app)/shared/[id].tsx — 이슈17: 공유받은 풀이 뷰어
// ─────────────────────────────────────────────────────────────────────────
// 딥링크 syncfortune://shared/<id> (또는 스마트링크 → 앱) 로 진입. get_shared_reading RPC(id 단건)로
//   풀이 스냅샷을 받아 표시한다. 앱에서만 열람(웹 랜딩 없음·daniel). 비로그인도 열람 가능(RPC anon 허용).
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { PressableScale } from '../../../components/PressableScale';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { fetchSharedReading, type ShareReadingInput } from '../../../lib/ui/share';
import { colors, radius, space, font, shadow } from '../../../lib/theme';

// content(스냅샷)를 사람이 읽을 블록[{label?, text}]으로 평탄화 — 문자열/배열/{label,text}/중첩객체 모두 처리.
//   모든 콘텐츠(풀이·가볍게보기·온디바이스)가 형태가 달라도 공유 뷰어에서 읽히도록(daniel: 모든 콘텐츠 공유).
function flattenContent(node: any, out: { label?: string; text: string }[] = []): { label?: string; text: string }[] {
  if (node == null) return out;
  if (typeof node === 'string') { if (node.trim()) out.push({ text: node }); return out; }
  if (Array.isArray(node)) { node.forEach((it) => flattenContent(it, out)); return out; }
  if (typeof node === 'object') {
    if (typeof node.label === 'string' && typeof node.text === 'string') { out.push({ label: node.label, text: node.text }); return out; } // {label,text} 섹션
    const SKIP = new Set(['emoji', 'hex', 'error', 'headline', 'score', 'date', 'code', 'name', 'title']); // 표시 부적합/제목 중복 키
    for (const [k, v] of Object.entries(node)) { if (!SKIP.has(k)) flattenContent(v, out); }
    return out;
  }
  return out; // 숫자 등은 스킵
}

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

  // content(스냅샷) → 헤드라인 + 블록들(문자열/배열/섹션/중첩 모두 평탄화).
  const content = reading?.content as any;
  const headline = content && typeof content === 'object' && typeof content.headline === 'string' ? content.headline : '';
  const blocks = flattenContent(content);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.wrap}>
      <Stack.Screen options={{ title: '공유받은 풀이' }} />
      {state === 'loading' ? (
        <View style={styles.center}><ActivityIndicator color={colors.ju} /><Text style={styles.dim}>풀이 불러오는 중…</Text></View>
      ) : state === 'err' ? (
        <View style={styles.card}>
          <Text style={styles.err}>이 공유 링크의 풀이를 찾을 수 없어요.</Text>
          <PressableScale style={styles.cta} onPress={() => router.replace('/')}><Text style={styles.ctaTx}>내 운세 보러 가기 ›</Text></PressableScale>
        </View>
      ) : (
        <>
          <View style={styles.badge}><Text style={styles.badgeTx}>🔗 공유받은 풀이</Text></View>
          {reading?.title ? <Text style={styles.title}>{reading.title}</Text> : null}
          {headline ? <Text style={styles.headline}>{headline}</Text> : null}
          {blocks.map((b, i) => (
            <View key={i} style={styles.card}>
              {b.label ? <Text style={styles.secLabel}>{b.label}</Text> : null}
              <Text style={styles.body}>{b.text}</Text>
            </View>
          ))}
          {/* 앱 유도 — 받은 사람이 자기 운세도 보게 */}
          <PressableScale style={styles.cta} onPress={() => router.replace('/')}><Text style={styles.ctaTx}>나도 내 운세 보기 ›</Text></PressableScale>
          <Text style={styles.note}>팔자(八字) — 사주·자미두수·타로 운세</Text>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: 'transparent' }, // 전역 배경 투과(ContentBackdrop)
  wrap: { padding: space(6), paddingBottom: space(12) },
  center: { paddingVertical: space(20), alignItems: 'center', gap: space(3) },
  dim: { ...font.caption, color: colors.inkSoft },
  badge: { alignSelf: 'flex-start', backgroundColor: colors.juSoft, borderColor: colors.ju, borderWidth: 1, borderRadius: radius.sm, paddingVertical: space(1.5), paddingHorizontal: space(3), marginBottom: space(3) },
  badgeTx: { ...font.caption, color: colors.ju, fontWeight: '700' },
  title: { ...font.title, color: colors.ink, marginBottom: space(2) },
  headline: { fontSize: 18, fontWeight: '800', color: colors.ju, marginBottom: space(4), lineHeight: 26 },
  card: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.juLine, padding: space(5), marginBottom: space(3), ...shadow.card },
  secLabel: { fontSize: 14, fontWeight: '800', color: colors.ju, marginBottom: space(1.5) },
  body: { ...font.body, color: colors.ink, lineHeight: 24 },
  err: { ...font.body, color: colors.inkSoft, marginBottom: space(4) },
  cta: { backgroundColor: colors.ju, borderRadius: radius.md, paddingVertical: space(3.5), alignItems: 'center', marginTop: space(2) },
  ctaTx: { color: colors.bg, fontWeight: '800', fontSize: 16 },
  note: { ...font.caption, color: colors.inkFaint, textAlign: 'center', marginTop: space(5) },
});
