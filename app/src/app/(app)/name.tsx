// src/app/(app)/name.tsx — 이름풀이 (가볍게·무료·온디바이스)
// ─────────────────────────────────────────────────────────────────────────
// 한글 이름 입력 → 글자별 발음오행(lib/nameReading) + 상생/상극 흐름 + 결 풀이.
//   규칙5: 무료=온디바이스(API 0). §4: 가벼운 재미·전향적.
// ─────────────────────────────────────────────────────────────────────────
import { useMemo, useState } from 'react';
import { View, Text, ScrollView, TextInput, StyleSheet, ImageBackground } from 'react-native';
import { useTranslation } from 'react-i18next';
import { analyzeName } from '../../lib/content/nameReading';
import { bgSource, colors, radius, space, shadow, font } from '../../lib/theme';
import { useFontScale } from '../../lib/ui/fontScale';
import { ContentHero } from '../../components/SpecialContentScreen'; // 이미지 히어로(보는 맛)
import { ShareReadingButton } from '../../components/ShareReadingButton'; // 이슈17: 풀이 결과 공유(앱게이트)
import { useContentGate } from '../../components/ContentAdGate'; // 무료 콘텐츠 광고 게이트(진입 후 광고 보고 보기)

export default function NameScreen() {
  const { t } = useTranslation();
  const { fs } = useFontScale();
  const [name, setName] = useState('');
  const result = useMemo(() => (name.trim() ? analyzeName(name) : null), [name]);
  const gate = useContentGate('name', { title: t('menu.name', '이름 운세') }); // 진입 후 광고 보고 보기(프리미엄/광고없음=통과)

  if (gate) return gate; // 미시청(무료) = 광고 게이트 화면 / null = 열림(아래 내용)

  return (
    <ImageBackground source={bgSource} style={styles.bg} resizeMode="cover">
      <ScrollView style={styles.overlay} contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
        <ContentHero image={require('../../../assets/icons/name.jpg')} title={t('name.title', '이름풀이')} sub={t('name.sub', '이름 속 소리의 기운(오행)으로 결을 봐요.')} />

        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder={t('name.placeholder', '한글 이름을 입력하세요')}
          placeholderTextColor={colors.inkFaint}
          maxLength={10}
        />

        {result ? (
          <>
            {/* 글자별 오행 칩 */}
            <View style={styles.chars}>
              {result.chars.map((c, i) => (
                <View key={i} style={styles.charBox}>
                  <View style={[styles.charSwatch, { backgroundColor: c.hex }]}>
                    <Text style={styles.charCh}>{c.ch}</Text>
                  </View>
                  <Text style={styles.charElem}>{c.elemLabel}</Text>
                </View>
              ))}
            </View>
            <View style={styles.card}>
              <Text style={[styles.summary, { fontSize: fs(15), lineHeight: fs(25) }]}>{result.summary}</Text>
            </View>
            {/* 이슈17: 이름풀이 결과 공유(앱게이트) */}
            <ShareReadingButton kind="name" title={`${name} 이름풀이`} content={{ summary: result.summary }} />
          </>
        ) : name.trim() ? (
          <View style={styles.card}><Text style={styles.empty}>{t('name.noHangul', '한글 이름을 입력해 주세요.')}</Text></View>
        ) : null}

        <Text style={styles.note}>{t('name.note', '※ 소리의 오행으로 보는 가벼운 풀이예요. 한자·획수까지 보는 정식 작명과는 달라요.')}</Text>
      </ScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: colors.bg },
  overlay: { flex: 1, backgroundColor: colors.overlay },
  wrap: { padding: space(6), paddingBottom: space(12) },
  h: { ...font.title, color: colors.ink, marginBottom: space(1) },
  sub: { ...font.caption, color: colors.inkSoft, marginBottom: space(5) },
  input: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.juLine, paddingHorizontal: space(4), paddingVertical: space(3.5), fontSize: 18, fontWeight: '700', color: colors.ink, marginBottom: space(5) },
  chars: { flexDirection: 'row', flexWrap: 'wrap', gap: space(3), justifyContent: 'center', marginBottom: space(4) },
  charBox: { alignItems: 'center' },
  charSwatch: { width: 56, height: 56, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', marginBottom: space(1.5) },
  charCh: { fontSize: 28, fontWeight: '900', color: '#fff' },
  charElem: { ...font.caption, color: colors.inkSoft, fontWeight: '700' },
  card: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.juLine, padding: space(5), ...shadow.card },
  summary: { ...font.body, color: colors.ink },
  empty: { ...font.body, color: colors.inkSoft, textAlign: 'center' },
  note: { ...font.caption, color: colors.inkFaint, textAlign: 'center', marginTop: space(4), lineHeight: 18 },
});
