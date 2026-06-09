// src/app/(app)/taro.tsx — 타로 78장(RWS) 카테고리별 켈틱크로스 10장 스프레드 (무료, 온디바이스)
// ─────────────────────────────────────────────────────────────────────────
// 질문 주제(연애·직업…) 선택 → 켈틱크로스 10장(중복 없이, 정/역 랜덤) → 카드 이미지 + 포지션 의미.
//   카드 이미지 = RWS 퍼블릭도메인(assets/tarot). 룰·온디바이스(LLM·서버 0). 역방향 = 이미지 180° 회전.
// ─────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { View, Text, Pressable, ScrollView, Image, StyleSheet, ImageBackground } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  drawSpread, cardImage, SUIT_META, CELTIC_POSITIONS, TARO_CATEGORIES, type SpreadCard,
} from '../../lib/tarot';
import { playSound } from '../../lib/sounds';
import { colors, radius, space, shadow, font } from '../../lib/theme';

type Category = (typeof TARO_CATEGORIES)[number];

export default function TaroScreen() {
  const { t } = useTranslation();
  const [category, setCategory] = useState<Category | null>(null);
  const [spread, setSpread] = useState<SpreadCard[] | null>(null);

  // 카테고리 선택 = 즉시 10장 스프레드. (질문 주제는 해석 컨텍스트 — 카드는 동일 덱에서 무작위)
  function onPick(cat: Category) {
    playSound('flip');
    setCategory(cat);
    setSpread(drawSpread(CELTIC_POSITIONS));
  }
  function reset() {
    playSound('flip');
    setSpread(null);
    setCategory(null);
  }

  return (
    <ImageBackground source={require('../../../assets/icons/bg-night.png')} style={styles.bg} resizeMode="cover">
      <ScrollView style={styles.screen} contentContainerStyle={styles.wrap}>
        <Text style={styles.title}>{t('menu.taro')}</Text>

        {!spread ? (
          // ── 카테고리 선택 ──
          <>
            <Text style={styles.sub}>질문 주제를 고르면 10장(켈틱 크로스)으로 펼칩니다.</Text>
            <View style={styles.cats}>
              {TARO_CATEGORIES.map((c) => (
                <Pressable key={c.key} style={styles.catBtn} onPress={() => onPick(c)}>
                  <Text style={styles.catEmoji}>{c.emoji}</Text>
                  <Text style={styles.catKo}>{c.ko}</Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : (
          // ── 10장 스프레드 ──
          <>
            <View style={styles.spreadHead}>
              <Text style={styles.spreadCat}>{category?.emoji} {category?.ko}</Text>
              <Pressable style={styles.resetBtn} onPress={reset}>
                <Text style={styles.resetTx}>다시 뽑기</Text>
              </Pressable>
            </View>
            {/* ① 카드 나열 (가로 스크롤 — 번호순) */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
              {spread.map((card, i) => (
                <View key={i} style={styles.cardCol}>
                  <Image
                    source={cardImage(card.id)}
                    style={[styles.cardImg, card.reversed && styles.reversedImg]}
                    resizeMode="contain"
                  />
                  <Text style={styles.cardNum}>{i + 1}</Text>
                </View>
              ))}
            </ScrollView>

            {/* ② 풀이 (카드 나열 밑 — 포지션별) */}
            <Text style={styles.readingH}>풀이</Text>
            {spread.map((card, i) => (
              <View key={i} style={styles.readRow}>
                <Text style={styles.pos}>{i + 1}. {card.position}</Text>
                <Text style={styles.cardName}>
                  <Text style={{ color: SUIT_META[card.suit].color }}>● </Text>{card.ko}
                  {card.reversed && <Text style={styles.revLabel}>  역(逆)</Text>}
                </Text>
                <Text style={styles.kw}>{card.reversed ? card.rev : card.up}</Text>
              </View>
            ))}
            <Text style={styles.note}>※ 재미·자기성찰용. 카드는 무작위로 뽑혀요.</Text>
          </>
        )}
      </ScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: colors.bg },
  screen: { backgroundColor: 'rgba(21,19,46,0.55)' },
  wrap: { padding: space(5), paddingTop: space(8), paddingBottom: space(10) },
  title: { ...font.title, color: colors.ink, marginBottom: space(2) },
  sub: { ...font.body, color: colors.inkSoft, marginBottom: space(6) },
  // 카테고리 그리드
  cats: { flexDirection: 'row', flexWrap: 'wrap', gap: space(3) },
  catBtn: {
    width: '47%', alignItems: 'center', paddingVertical: space(6),
    backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.juLine, ...shadow.card,
  },
  catEmoji: { fontSize: 34, marginBottom: space(2) },
  catKo: { ...font.body, color: colors.ink, fontWeight: '700' },
  // 스프레드
  spreadHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space(4) },
  spreadCat: { ...font.heading, color: colors.ju },
  resetBtn: { paddingVertical: space(2), paddingHorizontal: space(4), borderRadius: radius.pill, backgroundColor: colors.ju },
  resetTx: { color: colors.bg, fontSize: 13, fontWeight: '700' },
  // ① 카드 나열(가로 스트립)
  strip: { gap: space(3), paddingVertical: space(2), paddingRight: space(4) },
  cardCol: { alignItems: 'center', gap: space(1) },
  cardImg: { width: 96, height: 165, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.juLine, backgroundColor: colors.card },
  reversedImg: { transform: [{ rotate: '180deg' }] }, // 역방향 = 카드 180° 뒤집힘
  cardNum: { ...font.caption, color: colors.ju, fontWeight: '800' },
  // ② 풀이(세로 리스트)
  readingH: { ...font.heading, color: colors.ink, marginTop: space(6), marginBottom: space(3) },
  readRow: { marginBottom: space(3.5), paddingBottom: space(3), borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  pos: { ...font.caption, color: colors.ju, fontWeight: '700' },
  cardName: { ...font.body, color: colors.ink, fontWeight: '700', marginTop: space(1) },
  revLabel: { ...font.caption, color: colors.juDeep },
  kw: { ...font.body, color: colors.inkSoft, marginTop: space(1), lineHeight: 20 },
  note: { ...font.caption, color: colors.inkFaint, marginTop: space(3), textAlign: 'center' },
});
