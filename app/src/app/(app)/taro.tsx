// src/app/(app)/taro.tsx — 타로 78장(RWS): 주제 선택 → 덱에서 한 장씩 직접 뽑기 → 전체 조합 풀이
// ─────────────────────────────────────────────────────────────────────────
// ① 주제 선택 → 10장을 미리 섞어두고(숨김) ② 사용자가 뒷면 덱을 탭해 한 장씩 공개(포지션 순서)
//   ③ 공개 카드는 부채꼴로 쌓이고 탭하면 떠올라 확대(설명)·빈곳 탭=내려감 ④ 10장 다 뽑으면 전체 조합 풀이.
//   카드 이미지=RWS 퍼블릭도메인. 룰·온디바이스(LLM·서버 0, 무제한 무료). 역방향=180° 회전.
// ─────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useRef } from 'react';
import { View, Text, Pressable, ScrollView, Image, StyleSheet, ImageBackground, Modal, Animated } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  drawSpread, cardImage, combineReading, SPREAD_POSITIONS, TARO_CATEGORIES, type SpreadCard,
} from '../../lib/tarot';
import { playSound } from '../../lib/sounds';
import { colors, radius, space, shadow, font } from '../../lib/theme';

type Category = (typeof TARO_CATEGORIES)[number];

export default function TaroScreen() {
  const { t } = useTranslation();
  const { cat } = useLocalSearchParams<{ cat?: string }>();
  const [category, setCategory] = useState<Category | null>(null);
  const [spread, setSpread] = useState<SpreadCard[] | null>(null); // 미리 섞인 10장(숨김 순서)
  const [drawn, setDrawn] = useState(0);                            // 지금까지 뽑은 장수
  const [sel, setSel] = useState<number | null>(null);             // 펼쳐 본 카드(모달)
  const lift = useRef(new Animated.Value(0)).current;

  function start(c: Category) {
    playSound('flip');
    setCategory(c);
    setSpread(drawSpread(SPREAD_POSITIONS)); // 결과는 미리 정해지되, 공개는 사용자가 한 장씩
    setDrawn(0);
    setSel(null);
  }
  function reset() { playSound('flip'); setCategory(null); setSpread(null); setDrawn(0); setSel(null); }
  function drawNext() {
    if (spread && drawn < spread.length) { playSound('flip'); setDrawn((n) => n + 1); }
  }
  function openCard(i: number) {
    playSound('flip');
    setSel(i);
    lift.setValue(0);
    Animated.spring(lift, { toValue: 1, useNativeDriver: true, friction: 7, tension: 50 }).start();
  }
  function closeCard() {
    Animated.timing(lift, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setSel(null));
  }

  // 딥링크 ?cat= → 해당 주제로 시작(뽑기는 직접)
  useEffect(() => {
    if (!cat) return;
    const c = TARO_CATEGORIES.find((x) => x.key === cat);
    if (c) { setCategory(c); setSpread(drawSpread(SPREAD_POSITIONS)); setDrawn(0); }
  }, [cat]);

  const cards = spread ? spread.slice(0, drawn) : []; // 공개된 카드
  const done = !!spread && drawn >= spread.length;
  const nextPos = spread && drawn < spread.length ? spread[drawn].position : '';

  return (
    <ImageBackground source={require('../../../assets/icons/bg-night.png')} style={styles.bg} resizeMode="cover">
      <ScrollView style={styles.screen} contentContainerStyle={styles.wrap}>
        <Text style={styles.title}>{t('menu.taro')}</Text>

        {!spread ? (
          // ── 주제 선택 ──
          <>
            <Text style={styles.sub}>질문 주제를 고른 뒤, 덱에서 카드를 한 장씩 직접 뽑아 보세요.</Text>
            <View style={styles.cats}>
              {TARO_CATEGORIES.map((c) => (
                <Pressable key={c.key} style={styles.catBtn} onPress={() => start(c)}>
                  <Text style={styles.catEmoji}>{c.emoji}</Text>
                  <Text style={styles.catKo}>{c.ko}</Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : (
          <>
            <View style={styles.spreadHead}>
              <Text style={styles.spreadCat}>{category?.emoji} {category?.ko} · {drawn}/{spread.length}</Text>
              <Pressable style={styles.resetBtn} onPress={reset}><Text style={styles.resetTx}>다시</Text></Pressable>
            </View>

            {/* 공개된 카드 — 부채꼴로 쌓임(탭하면 떠올라 설명) */}
            {cards.length > 0 && (
              <View style={styles.fan}>
                {cards.map((card, i) => {
                  const mid = (cards.length - 1) / 2;
                  const angle = (i - mid) * 7;
                  const offsetX = (i - mid) * 24;
                  return (
                    <Pressable
                      key={i}
                      style={[styles.fanCard, { zIndex: i, transform: [{ translateX: offsetX }, { rotate: `${angle}deg` }] }]}
                      onPress={() => openCard(i)}
                    >
                      <Image source={cardImage(card.id)} style={[styles.fanImg, card.reversed && styles.revImg]} resizeMode="contain" />
                    </Pressable>
                  );
                })}
              </View>
            )}

            {/* 아직 다 안 뽑았으면: 뒷면 덱(탭해서 한 장 뽑기) */}
            {!done ? (
              <View style={styles.drawArea}>
                <Pressable style={styles.deckBack} onPress={drawNext}>
                  <Text style={styles.deckGlyph}>🔮</Text>
                </Pressable>
                <Text style={styles.drawHint}>덱을 탭해 ‘{nextPos}’ 카드를 뽑으세요 ({drawn}/{spread.length})</Text>
              </View>
            ) : (
              // 다 뽑음 → 전체 조합 풀이
              <>
                <Text style={styles.readingH}>풀이 · 전체 흐름</Text>
                {combineReading(spread).map((line, i) => (
                  <Text key={i} style={styles.combineLine}>· {line}</Text>
                ))}
                <Text style={styles.note}>※ 재미·자기성찰용. 카드는 무작위로 섞여요. 카드를 탭하면 자세히 볼 수 있어요.</Text>
              </>
            )}
          </>
        )}
      </ScrollView>

      {/* 선택 카드 확대 — 탭 시 아래에서 떠오르고, 빈 곳 탭=내려가며 닫힘 */}
      <Modal visible={sel != null} transparent animationType="none" onRequestClose={closeCard}>
        <Pressable style={styles.backdrop} onPress={closeCard}>
          {sel != null && spread && (
            <Animated.View
              style={[styles.bigWrap, {
                opacity: lift,
                transform: [
                  { translateY: lift.interpolate({ inputRange: [0, 1], outputRange: [320, 0] }) },
                  { scale: lift.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) },
                ],
              }]}
            >
              <Pressable onPress={() => {}}>
                <Image source={cardImage(spread[sel].id)} style={[styles.bigImg, spread[sel].reversed && styles.revImg]} resizeMode="contain" />
                <Text style={styles.bigPos}>{sel + 1}. {spread[sel].position}</Text>
                <Text style={styles.bigName}>{spread[sel].ko}{spread[sel].reversed ? ' (뒤집힘)' : ''}</Text>
                <Text style={styles.bigKw}>{spread[sel].reversed ? spread[sel].rev : spread[sel].up}</Text>
                <Text style={styles.bigClose}>빈 곳을 탭하면 닫혀요</Text>
              </Pressable>
            </Animated.View>
          )}
        </Pressable>
      </Modal>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: colors.bg },
  screen: { backgroundColor: 'rgba(21,19,46,0.55)' },
  wrap: { padding: space(5), paddingTop: space(8), paddingBottom: space(10) },
  title: { ...font.title, color: colors.ink, marginBottom: space(2) },
  sub: { ...font.body, color: colors.inkSoft, marginBottom: space(6) },
  cats: { flexDirection: 'row', flexWrap: 'wrap', gap: space(3) },
  catBtn: { width: '47%', alignItems: 'center', paddingVertical: space(6), backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.juLine, ...shadow.card },
  catEmoji: { fontSize: 34, marginBottom: space(2) },
  catKo: { ...font.body, color: colors.ink, fontWeight: '700' },
  spreadHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space(2) },
  spreadCat: { ...font.heading, color: colors.ju },
  resetBtn: { paddingVertical: space(2), paddingHorizontal: space(4), borderRadius: radius.pill, backgroundColor: colors.ju },
  resetTx: { color: colors.bg, fontSize: 13, fontWeight: '700' },
  // 공개 카드 부채꼴
  fan: { height: 250, alignItems: 'center', justifyContent: 'flex-end', marginTop: space(4) },
  fanCard: { position: 'absolute', bottom: space(2), transformOrigin: 'center bottom' },
  fanImg: { width: 100, height: 171, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.juLine, backgroundColor: colors.card },
  revImg: { transform: [{ rotate: '180deg' }] },
  // 뒷면 덱(뽑기)
  drawArea: { alignItems: 'center', marginTop: space(6) },
  deckBack: { width: 120, height: 205, borderRadius: radius.md, backgroundColor: colors.card, borderWidth: 2, borderColor: colors.ju, alignItems: 'center', justifyContent: 'center', ...shadow.card },
  deckGlyph: { fontSize: 54, opacity: 0.85 },
  drawHint: { ...font.body, color: colors.inkSoft, marginTop: space(4), textAlign: 'center' },
  // 풀이
  readingH: { ...font.heading, color: colors.ink, marginTop: space(7), marginBottom: space(3) },
  combineLine: { ...font.body, color: colors.inkSoft, lineHeight: 24, marginBottom: space(2.5) },
  note: { ...font.caption, color: colors.inkFaint, marginTop: space(3), textAlign: 'center', lineHeight: 18 },
  // 확대 모달
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.82)', justifyContent: 'center', alignItems: 'center', padding: space(6) },
  bigWrap: { alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.lg, padding: space(6), borderWidth: 1, borderColor: colors.juLine, ...shadow.card },
  bigImg: { width: 200, height: 343, borderRadius: radius.md, marginBottom: space(4) },
  bigPos: { ...font.caption, color: colors.ju, fontWeight: '700' },
  bigName: { ...font.heading, color: colors.ink, marginTop: space(1) },
  bigKw: { ...font.body, color: colors.inkSoft, textAlign: 'center', marginTop: space(2), lineHeight: 21 },
  bigClose: { ...font.caption, color: colors.inkFaint, marginTop: space(4) },
});
