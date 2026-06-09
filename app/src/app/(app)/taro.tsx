// src/app/(app)/taro.tsx — 타로 78장(RWS) 카테고리별 켈틱크로스: 부채꼴 덱 + 탭 확대 + 전체 조합 풀이
// ─────────────────────────────────────────────────────────────────────────
// 주제 선택 → 10장 뽑기 → ① 반원 부채꼴로 겹쳐 표시 ② 카드 탭=확대 모달(그 카드 설명)
//   ③ 빈 곳 탭=덱으로 복귀 ④ 아래 '풀이'는 카드 하나하나가 아니라 *전체 조합*(combineReading).
//   카드 이미지=RWS 퍼블릭도메인. 룰·온디바이스(LLM·서버 0). 역방향=이미지 180° 회전.
// ─────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useRef } from 'react';
import { View, Text, Pressable, ScrollView, Image, StyleSheet, ImageBackground, Modal, Animated } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  drawSpread, cardImage, combineReading, CELTIC_POSITIONS, TARO_CATEGORIES, type SpreadCard,
} from '../../lib/tarot';
import { playSound } from '../../lib/sounds';
import { colors, radius, space, shadow, font } from '../../lib/theme';

type Category = (typeof TARO_CATEGORIES)[number];

export default function TaroScreen() {
  const { t } = useTranslation();
  const { cat } = useLocalSearchParams<{ cat?: string }>(); // 딥링크 ?cat=love 등 → 해당 주제 자동 스프레드
  const [category, setCategory] = useState<Category | null>(null);
  const [spread, setSpread] = useState<SpreadCard[] | null>(null);
  const [sel, setSel] = useState<number | null>(null); // 펼쳐 본 카드 인덱스(모달)
  const lift = useRef(new Animated.Value(0)).current;  // 0=덱 안 / 1=떠오름

  // 카드 탭 → 아래에서 위로 떠오름(spring). 닫기 → 내려간 뒤 모달 해제.
  function openCard(i: number) {
    playSound('flip');
    setSel(i);
    lift.setValue(0);
    Animated.spring(lift, { toValue: 1, useNativeDriver: true, friction: 7, tension: 50 }).start();
  }
  function closeCard() {
    Animated.timing(lift, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setSel(null));
  }

  // 딥링크로 주제가 지정되면 자동으로 펼친다(없으면 사용자가 카테고리 선택).
  useEffect(() => {
    if (!cat) return;
    const c = TARO_CATEGORIES.find((x) => x.key === cat);
    if (c) { setCategory(c); setSpread(drawSpread(CELTIC_POSITIONS)); }
  }, [cat]);

  function onPick(cat: Category) {
    playSound('flip');
    setCategory(cat);
    setSpread(drawSpread(CELTIC_POSITIONS));
    setSel(null);
  }
  function reset() {
    playSound('flip');
    setSpread(null); setCategory(null); setSel(null);
  }

  const mid = spread ? (spread.length - 1) / 2 : 0;

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
          <>
            <View style={styles.spreadHead}>
              <Text style={styles.spreadCat}>{category?.emoji} {category?.ko}</Text>
              <Pressable style={styles.resetBtn} onPress={reset}><Text style={styles.resetTx}>다시 뽑기</Text></Pressable>
            </View>

            {/* ① 부채꼴 카드 덱 (반원 겹침) — 카드 탭 = 펼쳐 봄 */}
            <View style={styles.fan}>
              {spread.map((card, i) => {
                const angle = (i - mid) * 7;          // -31.5°~+31.5° 부채꼴
                const offsetX = (i - mid) * 24;       // 옆으로 퍼뜨려 탭 영역 확보
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
            <Text style={styles.fanHint}>카드를 탭하면 펼쳐지고, 빈 곳을 탭하면 덱으로 돌아갑니다.</Text>

            {/* ④ 풀이 — 카드 하나하나가 아니라 전체 조합(흐름) */}
            <Text style={styles.readingH}>풀이 · 전체 흐름</Text>
            {combineReading(spread).map((line, i) => (
              <Text key={i} style={styles.combineLine}>· {line}</Text>
            ))}
            <Text style={styles.note}>※ 재미·자기성찰용. 카드는 무작위로 뽑혀요.</Text>
          </>
        )}
      </ScrollView>

      {/* ②③ 선택 카드 확대 모달 — 빈 곳(backdrop) 탭 시 덱으로 복귀 */}
      <Modal visible={sel != null} transparent animationType="none" onRequestClose={closeCard}>
        <Pressable style={styles.backdrop} onPress={closeCard}>
          {sel != null && spread && (
            <Animated.View
              style={[styles.bigWrap, {
                opacity: lift,
                transform: [
                  { translateY: lift.interpolate({ inputRange: [0, 1], outputRange: [320, 0] }) }, // 아래→중앙
                  { scale: lift.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) },
                ],
              }]}
            >
              {/* 카드 영역 탭은 닫기 전파 차단(빈 곳=backdrop만 닫힘) */}
              <Pressable onPress={() => {}}>
                <Image
                  source={cardImage(spread[sel].id)}
                  style={[styles.bigImg, spread[sel].reversed && styles.revImg]}
                  resizeMode="contain"
                />
                <Text style={styles.bigPos}>{sel + 1}. {spread[sel].position}</Text>
                <Text style={styles.bigName}>{spread[sel].ko}{spread[sel].reversed ? ' (역)' : ''}</Text>
                <Text style={styles.bigKw}>{spread[sel].reversed ? spread[sel].rev : spread[sel].up}</Text>
                <Text style={styles.bigClose}>빈 곳을 탭하면 닫힙니다</Text>
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
  // 카테고리
  cats: { flexDirection: 'row', flexWrap: 'wrap', gap: space(3) },
  catBtn: { width: '47%', alignItems: 'center', paddingVertical: space(6), backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.juLine, ...shadow.card },
  catEmoji: { fontSize: 34, marginBottom: space(2) },
  catKo: { ...font.body, color: colors.ink, fontWeight: '700' },
  // 헤더
  spreadHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space(2) },
  spreadCat: { ...font.heading, color: colors.ju },
  resetBtn: { paddingVertical: space(2), paddingHorizontal: space(4), borderRadius: radius.pill, backgroundColor: colors.ju },
  resetTx: { color: colors.bg, fontSize: 13, fontWeight: '700' },
  // ① 부채꼴
  fan: { height: 280, alignItems: 'center', justifyContent: 'flex-end', marginTop: space(4) },
  fanCard: { position: 'absolute', bottom: space(2), transformOrigin: 'center bottom' },
  fanImg: { width: 104, height: 178, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.juLine, backgroundColor: colors.card },
  revImg: { transform: [{ rotate: '180deg' }] }, // 역방향 = 이미지 180° 뒤집힘
  fanHint: { ...font.caption, color: colors.inkFaint, textAlign: 'center', marginTop: space(4) },
  // ④ 종합 풀이
  readingH: { ...font.heading, color: colors.ink, marginTop: space(7), marginBottom: space(3) },
  combineLine: { ...font.body, color: colors.inkSoft, lineHeight: 23, marginBottom: space(2.5) },
  note: { ...font.caption, color: colors.inkFaint, marginTop: space(3), textAlign: 'center' },
  // ②③ 확대 모달
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.82)', justifyContent: 'center', alignItems: 'center', padding: space(6) },
  bigWrap: { alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.lg, padding: space(6), borderWidth: 1, borderColor: colors.juLine, ...shadow.card },
  bigImg: { width: 200, height: 343, borderRadius: radius.md, marginBottom: space(4) },
  bigPos: { ...font.caption, color: colors.ju, fontWeight: '700' },
  bigName: { ...font.heading, color: colors.ink, marginTop: space(1) },
  bigKw: { ...font.body, color: colors.inkSoft, textAlign: 'center', marginTop: space(2), lineHeight: 21 },
  bigClose: { ...font.caption, color: colors.inkFaint, marginTop: space(4) },
});
