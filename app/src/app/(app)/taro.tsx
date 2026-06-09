// src/app/(app)/taro.tsx — 타로 78장(RWS): 하루 1회, 첫 카드부터 고정, 5장 직접 뽑기 → 하나의 흐름 풀이
// ─────────────────────────────────────────────────────────────────────────
// ① 하루 1회 — 첫 카드를 뽑는 순간부터 그날 결과 고정(뽑다 나가도 이어서 같은 카드, tarotStore).
//    날짜(로컬 'YYYY-M-D')가 자정에 바뀌면 새로 뽑을 수 있다.
// ② 주제 선택 → 뒷면 덱을 탭해 5장 한 장씩 직접 공개(고민을 떠올리며) ③ 공개 카드 부채꼴+탭 확대
// ④ 5장 다 뽑으면 전체를 '하나의 흐름'으로 풀이. 룰·온디바이스(LLM·서버 0, 무제한 무료).
// ─────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useRef } from 'react';
import { View, Text, Pressable, ScrollView, Image, StyleSheet, ImageBackground, Modal, Animated } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  drawSpread, cardImage, combineReading, SPREAD_POSITIONS, TARO_CATEGORIES, type SpreadCard,
} from '../../lib/tarot';
import { loadTodayTaro, saveTodayTaro } from '../../lib/tarotStore';
import { playSound } from '../../lib/sounds';
import { colors, radius, space, shadow, font } from '../../lib/theme';

type Category = (typeof TARO_CATEGORIES)[number];

// 로컬 날짜 키 'YYYY-M-D' (자정 지나면 바뀜 → 새 타로 가능)
function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export default function TaroScreen() {
  const { t } = useTranslation();
  const { cat } = useLocalSearchParams<{ cat?: string }>();
  const [category, setCategory] = useState<Category | null>(null);
  const [spread, setSpread] = useState<SpreadCard[] | null>(null);
  const [drawn, setDrawn] = useState(0);
  const [sel, setSel] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false); // 오늘 저장분 로드 완료
  const lift = useRef(new Animated.Value(0)).current;
  const today = todayStr();

  // 진입: 오늘 진행/완료분이 있으면 그대로 복원(첫 카드부터 저장되므로 이어서 같은 카드)
  useEffect(() => {
    loadTodayTaro(today).then((saved) => {
      if (saved) {
        setCategory(TARO_CATEGORIES.find((x) => x.key === saved.categoryKey) ?? null);
        setSpread(saved.cards);
        setDrawn(saved.drawn);
      }
      setLoaded(true);
    });
  }, [today]);

  function start(c: Category) {
    playSound('flip');
    setCategory(c);
    setSpread(drawSpread(SPREAD_POSITIONS)); // 5장 미리 섞되, 공개는 한 장씩
    setDrawn(0);
    setSel(null);
  }
  // 첫 카드를 뽑는 순간부터 저장(고정) → 뽑다 나가도 이어서 같은 카드로 복원
  function drawNext() {
    if (!spread || !category || drawn >= spread.length) return;
    playSound('flip');
    const nd = drawn + 1;
    setDrawn(nd);
    saveTodayTaro({ date: today, categoryKey: category.key, cards: spread, drawn: nd });
  }
  function cancel() { playSound('flip'); setCategory(null); setSpread(null); setDrawn(0); setSel(null); } // 첫 카드 전에만(미저장)
  function openCard(i: number) {
    playSound('flip');
    setSel(i);
    lift.setValue(0);
    Animated.spring(lift, { toValue: 1, useNativeDriver: true, friction: 7, tension: 50 }).start();
  }
  function closeCard() {
    Animated.timing(lift, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setSel(null));
  }

  // 딥링크 ?cat= → 오늘 아직 시작 안 했을 때만
  useEffect(() => {
    if (!cat || !loaded || spread) return;
    const c = TARO_CATEGORIES.find((x) => x.key === cat);
    if (c) start(c);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cat, loaded, spread]);

  const cards = spread ? spread.slice(0, drawn) : [];
  const done = !!spread && drawn >= spread.length;

  if (!loaded) {
    return <ImageBackground source={require('../../../assets/icons/bg-night.png')} style={styles.bg} resizeMode="cover"><View /></ImageBackground>;
  }

  return (
    <ImageBackground source={require('../../../assets/icons/bg-night.png')} style={styles.bg} resizeMode="cover">
      <ScrollView style={styles.screen} contentContainerStyle={styles.wrap}>
        <Text style={styles.title}>{t('menu.taro')}</Text>

        {!spread ? (
          // ── 주제 선택 (오늘 아직 안 뽑음) ──
          <>
            <Text style={styles.sub}>오늘의 타로는 하루 한 번. 주제를 고른 뒤 카드를 직접 뽑아 보세요.</Text>
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
              {drawn === 0 && <Pressable style={styles.resetBtn} onPress={cancel}><Text style={styles.resetTx}>취소</Text></Pressable>}
            </View>

            {/* 공개된 카드 — 부채꼴(탭하면 떠올라 설명) */}
            {cards.length > 0 && (
              <View style={styles.fan}>
                {cards.map((card, i) => {
                  const mid = (cards.length - 1) / 2;
                  const angle = (i - mid) * 7;
                  const offsetX = (i - mid) * 26;
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

            {!done ? (
              // 뒷면 덱(탭해서 한 장씩)
              <View style={styles.drawArea}>
                <Pressable style={styles.deckBack} onPress={drawNext}>
                  <Text style={styles.deckGlyph}>🔮</Text>
                </Pressable>
                <Text style={styles.drawHint}>지금 고민 중인 문제를 떠올리며, 카드를 한 장씩 탭해 주세요 ({drawn}/{spread.length})</Text>
              </View>
            ) : (
              // 완료 → 하나의 흐름 풀이 (오늘 고정)
              <>
                <Text style={styles.readingH}>풀이 · 하나의 흐름</Text>
                {combineReading(spread).map((line, i) => (
                  <Text key={i} style={styles.combineLine}>{line}</Text>
                ))}
                <Text style={styles.lockNote}>🌙 오늘의 카드예요. 자정이 지나면 다시 뽑을 수 있어요.</Text>
                <Text style={styles.note}>※ 재미·자기성찰용. 카드를 탭하면 자세히 볼 수 있어요.</Text>
              </>
            )}
          </>
        )}
      </ScrollView>

      {/* 선택 카드 확대 — 탭 시 떠오르고, 빈 곳 탭=내려가며 닫힘 */}
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
  resetBtn: { paddingVertical: space(2), paddingHorizontal: space(4), borderRadius: radius.pill, backgroundColor: colors.line },
  resetTx: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  fan: { height: 250, alignItems: 'center', justifyContent: 'flex-end', marginTop: space(4) },
  fanCard: { position: 'absolute', bottom: space(2), transformOrigin: 'center bottom' },
  fanImg: { width: 100, height: 171, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.juLine, backgroundColor: colors.card },
  revImg: { transform: [{ rotate: '180deg' }] },
  drawArea: { alignItems: 'center', marginTop: space(6) },
  deckBack: { width: 120, height: 205, borderRadius: radius.md, backgroundColor: colors.card, borderWidth: 2, borderColor: colors.ju, alignItems: 'center', justifyContent: 'center', ...shadow.card },
  deckGlyph: { fontSize: 54, opacity: 0.85 },
  drawHint: { ...font.body, color: colors.inkSoft, marginTop: space(4), textAlign: 'center', lineHeight: 22 },
  readingH: { ...font.heading, color: colors.ink, marginTop: space(7), marginBottom: space(3) },
  combineLine: { ...font.body, color: colors.inkSoft, lineHeight: 24, marginBottom: space(3) },
  lockNote: { ...font.body, color: colors.ju, textAlign: 'center', marginTop: space(2), fontWeight: '700' },
  note: { ...font.caption, color: colors.inkFaint, marginTop: space(3), textAlign: 'center', lineHeight: 18 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.82)', justifyContent: 'center', alignItems: 'center', padding: space(6) },
  bigWrap: { alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.lg, padding: space(6), borderWidth: 1, borderColor: colors.juLine, ...shadow.card },
  bigImg: { width: 200, height: 343, borderRadius: radius.md, marginBottom: space(4) },
  bigPos: { ...font.caption, color: colors.ju, fontWeight: '700' },
  bigName: { ...font.heading, color: colors.ink, marginTop: space(1) },
  bigKw: { ...font.body, color: colors.inkSoft, textAlign: 'center', marginTop: space(2), lineHeight: 21 },
  bigClose: { ...font.caption, color: colors.inkFaint, marginTop: space(4) },
});
