// src/app/(app)/taro.tsx — 타로 78장(RWS): 주제별 하루 1회·고정, 직접 뽑기, 주제 연관 흐름 풀이
// ─────────────────────────────────────────────────────────────────────────
// ① 주제(연애·직장·재물·건강·종합)마다 하루 1회 — 첫 카드부터 그날 결과 고정(tarotStore, 주제별 독립).
//    연애를 봤어도 '주제 변경'으로 직장 등 다른 주제를 따로 볼 수 있다. 자정에 초기화.
// ② 주제 선택 → 그 주제의 오늘 결과가 있으면 복원, 없으면 새로 → 뒷면 덱 탭으로 5장 직접 공개
// ③ 공개 카드 부채꼴+탭 확대 ④ 5장 다 뽑으면 '그 주제에 연관된 하나의 흐름'으로 풀이. 무제한 무료.
// ─────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useRef } from 'react';
import { View, Text, Pressable, ScrollView, Image, StyleSheet, ImageBackground, Modal, Animated } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import {
  drawSpread, cardImage, combineReading, cardMeaning, SPREAD_POSITIONS, TARO_CATEGORIES, type SpreadCard,
} from '../../lib/tarot';
import { loadTodayTaro, saveTodayTaro } from '../../lib/tarotStore';
import { playSound } from '../../lib/sounds';
import { colors, radius, space, shadow, font, gradients } from '../../lib/theme';
import { GlassCard } from '../../components/GlassCard';

// expo-haptics 는 네이티브 모듈 — 현재 dev 빌드 미포함 시 호출하면 크래시. 안전 래퍼로 감싼다(재빌드 후 정상 진동).
const hImpact = (s: Haptics.ImpactFeedbackStyle) => { try { Haptics.impactAsync(s).catch(() => {}); } catch { /* 네이티브 미포함 — 무시 */ } };
const hNotify = (n: Haptics.NotificationFeedbackType) => { try { Haptics.notificationAsync(n).catch(() => {}); } catch { /* 무시 */ } };

// 주제별 생성 이미지(이모지 대체) — key→png. 미드나잇·골드 테마 통일(Recraft 생성).
const TARO_IMAGES: Record<string, any> = {
  love: require('../../../assets/icons/taro-love.jpg'),
  work: require('../../../assets/icons/taro-work.jpg'),
  money: require('../../../assets/icons/taro-money.jpg'),
  health: require('../../../assets/icons/taro-health.jpg'),
  general: require('../../../assets/icons/taro-general.jpg'),
};

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
  const lift = useRef(new Animated.Value(0)).current;
  const today = todayStr();

  // 주제 선택: 그 주제의 오늘 결과가 있으면 복원(고정), 없으면 새로 섞는다.
  async function start(c: Category) {
    hNotify(Haptics.NotificationFeedbackType.Success);
    playSound('flip');
    setCategory(c);
    setSel(null);
    const saved = await loadTodayTaro(today, c.key);
    if (saved) { setSpread(saved.cards); setDrawn(saved.drawn); }
    else { setSpread(drawSpread(SPREAD_POSITIONS)); setDrawn(0); }
  }
  // 다른 주제 보기 (현재 주제 결과는 저장돼 있어 다시 고르면 복원)
  function changeTopic() { 
    hImpact(Haptics.ImpactFeedbackStyle.Medium);
    playSound('flip'); 
    setCategory(null); setSpread(null); setDrawn(0); setSel(null); 
  }
  // 첫 카드부터 그 주제 결과로 저장(고정) → 나갔다 와도 이어서 같은 카드
  function drawNext() {
    if (!spread || !category || drawn >= spread.length) return;
    hImpact(Haptics.ImpactFeedbackStyle.Light);
    playSound('flip');
    const nd = drawn + 1;
    setDrawn(nd);
    saveTodayTaro(today, category.key, spread, nd);
  }
  function openCard(i: number) {
    hImpact(Haptics.ImpactFeedbackStyle.Medium);
    playSound('flip');
    setSel(i);
    lift.setValue(0);
    Animated.spring(lift, { toValue: 1, useNativeDriver: true, friction: 7, tension: 50 }).start();
  }
  function closeCard() {
    Animated.timing(lift, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setSel(null));
  }

  // 딥링크 ?cat= → 아직 주제 안 골랐을 때만 시작
  useEffect(() => {
    if (!cat || category) return;
    const c = TARO_CATEGORIES.find((x) => x.key === cat);
    if (c) start(c);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cat]);

  const cards = spread ? spread.slice(0, drawn) : [];
  const done = !!spread && drawn >= spread.length;

  return (
    <ImageBackground source={require('../../../assets/icons/bg-night.png')} style={styles.bg} resizeMode="cover">
      <ScrollView style={styles.screen} contentContainerStyle={styles.wrap}>
        <View style={styles.headerArea}>
          <Text style={styles.title}>{t('menu.taro')}</Text>
          {category && (
            <Pressable style={styles.resetBtnNew} onPress={changeTopic}>
              <Text style={styles.resetTxNew}>주제 변경</Text>
            </Pressable>
          )}
        </View>

        {!spread ? (
          // ── 주제 선택 ──
          <>
            <Text style={styles.sub}>주제마다 하루 한 번. 보고 싶은 주제를 골라 카드를 직접 뽑아 보세요.</Text>
            <View style={styles.cats}>
              {TARO_CATEGORIES.map((c) => (
                <Pressable key={c.key} style={styles.catBtnNew} onPress={() => start(c)}>
                  <GlassCard style={styles.catGlass} intensity={20}>
                    <Image source={TARO_IMAGES[c.key]} style={styles.catImgNew} resizeMode="contain" />
                    <Text style={styles.catKoNew}>{c.ko}</Text>
                  </GlassCard>
                </Pressable>
              ))}
            </View>
          </>
        ) : (
          <>
            <View style={styles.spreadHeadNew}>
              <GlassCard style={styles.spreadTitleNew} intensity={30}>
                <Image source={TARO_IMAGES[category?.key ?? 'general']} style={styles.spreadThumb} />
                <Text style={styles.spreadCat}>{category?.ko} · {drawn}/{spread.length}</Text>
              </GlassCard>
            </View>

            {/* 공개된 카드 — 부채꼴(탭하면 떠올라 설명) */}
            {cards.length > 0 && (
              <View style={styles.fan}>
                {cards.map((card, i) => {
                  const mid = (cards.length - 1) / 2;
                  const angle = (i - mid) * 7;
                  const offsetX = (i - mid) * 26;
                  return (
                    <Animated.View
                      key={i}
                      style={[
                        styles.fanCard, 
                        { zIndex: i, transform: [{ translateX: offsetX }, { rotate: `${angle}deg` }] }
                      ]}
                    >
                      <Pressable onPress={() => openCard(i)}>
                        <Image source={cardImage(card.id)} style={[styles.fanImg, card.reversed && styles.revImg]} resizeMode="contain" />
                      </Pressable>
                    </Animated.View>
                  );
                })}
              </View>
            )}

            {!done ? (
              // 뒷면 덱(탭해서 한 장씩)
              <View style={styles.drawArea}>
                <Pressable onPress={drawNext}>
                  <GlassCard style={styles.deckBackNew} intensity={50}>
                    <ImageBackground source={TARO_IMAGES[category?.key ?? 'general']} style={styles.deckImg} resizeMode="contain">
                      <View style={styles.deckTapBarNew}>
                        <Text style={styles.deckTapTx}>탭해서 뽑기</Text>
                      </View>
                    </ImageBackground>
                  </GlassCard>
                </Pressable>
                <Text style={styles.drawHint}>지금 고민 중인 문제를 떠올리며, 카드를 한 장씩 탭해 주세요 ({drawn}/{spread.length})</Text>
              </View>
            ) : (
              // 완료 → 그 주제에 연관된 하나의 흐름 풀이
              <View style={styles.readingSection}>
                <GlassCard intensity={40} style={styles.readingGlass}>
                  <Text style={styles.readingH}>풀이 · {category?.ko}의 흐름</Text>
                  {combineReading(spread, category ?? { key: 'general', ko: '종합 운세' }).map((line, i) => (
                    <Text key={i} style={styles.combineLine}>{line}</Text>
                  ))}
                  <View style={styles.readingDivider} />
                  <Text style={styles.lockNote}>🌙 오늘의 {category?.ko} 카드예요. 자정이 지나면 다시 뽑을 수 있어요.</Text>
                </GlassCard>
                <Text style={styles.note}>※ 재미·자기성찰용. 카드를 탭하면 자세히 볼 수 있어요.</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* 선택 카드 확대 — 탭 시 떠오르고, 빈 곳 탭=내려가며 닫힘 */}
      <Modal visible={sel != null} transparent animationType="none" onRequestClose={closeCard}>
        <Pressable style={styles.backdrop} onPress={closeCard}>
          {sel != null && spread && (
            <Animated.View
              style={[styles.bigWrapNew, {
                opacity: lift,
                transform: [
                  { translateY: lift.interpolate({ inputRange: [0, 1], outputRange: [320, 0] }) },
                  { scale: lift.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) },
                ],
              }]}
            >
              <GlassCard intensity={60} style={styles.bigGlass}>
                <Image source={cardImage(spread[sel].id)} style={[styles.bigImgNew, spread[sel].reversed && styles.revImg]} resizeMode="contain" />
                <View style={styles.bigInfo}>
                  <Text style={styles.bigPos}>{sel + 1}. {spread[sel].position}</Text>
                  <Text style={styles.bigName}>{spread[sel].ko}{spread[sel].reversed ? ' (뒤집힘)' : ''}</Text>
                  {/* 선택한 주제의 언어로 카드 의미 표시(주제 미선택 시 general 폴백) — combineReading 과 동일 진실원 */}
                  <Text style={styles.bigKw}>{cardMeaning(spread[sel], spread[sel].reversed, category?.key)}</Text>
                </View>
                <Text style={styles.bigClose}>빈 곳을 탭하면 닫혀요</Text>
              </GlassCard>
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
  headerArea: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space(4) },
  title: { ...font.title, color: colors.ink, marginBottom: 0 },
  sub: { ...font.body, color: colors.inkSoft, marginBottom: space(6) },
  cats: { flexDirection: 'row', flexWrap: 'wrap', gap: space(3) },
  catBtnNew: { width: '47%', aspectRatio: 1 },
  catGlass: { flex: 1, padding: space(4), alignItems: 'center', justifyContent: 'center' },
  catImgNew: { width: '80%', height: '80%', marginBottom: space(2) },
  catKoNew: { ...font.body, color: colors.ink, fontWeight: '700' },
  spreadHeadNew: { marginBottom: space(4) },
  spreadTitleNew: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingVertical: space(2), paddingHorizontal: space(4), alignSelf: 'flex-start' },
  spreadThumb: { width: 32, height: 32, borderRadius: radius.sm },
  spreadCat: { ...font.heading, color: colors.ju },
  resetBtnNew: { paddingVertical: space(1.5), paddingHorizontal: space(3), borderRadius: radius.sm, backgroundColor: colors.sunk },
  resetTxNew: { color: colors.ju, fontSize: 12, fontWeight: '700' },
  fan: { height: 260, alignItems: 'center', justifyContent: 'flex-end', marginTop: space(2) },
  fanCard: { position: 'absolute', bottom: space(2) },
  fanImg: { width: 110, height: 188, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.juLine, backgroundColor: colors.card },
  revImg: { transform: [{ rotate: '180deg' }] },
  drawArea: { alignItems: 'center', marginTop: space(4) },
  deckBackNew: { width: 140, height: 240, padding: 0, overflow: 'hidden', borderWidth: 2, borderColor: colors.ju },
  deckImg: { flex: 1, padding: space(6), justifyContent: 'center', alignItems: 'center' },
  deckTapBarNew: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(21,19,46,0.8)', paddingVertical: space(2), alignItems: 'center' },
  deckTapTx: { color: colors.ju, fontSize: 12, fontWeight: '800' },
  drawHint: { ...font.body, color: colors.inkSoft, marginTop: space(6), textAlign: 'center', lineHeight: 22 },
  readingSection: { marginTop: space(4) },
  readingGlass: { padding: space(6) },
  readingH: { ...font.heading, color: colors.ju, marginBottom: space(4) },
  combineLine: { ...font.body, color: colors.ink, lineHeight: 26, marginBottom: space(3) },
  readingDivider: { height: 1, backgroundColor: colors.line, marginVertical: space(4) },
  lockNote: { ...font.body, color: colors.ju, textAlign: 'center', fontWeight: '700' },
  note: { ...font.caption, color: colors.inkFaint, marginTop: space(4), textAlign: 'center' },
  backdrop: { flex: 1, backgroundColor: 'rgba(10, 9, 23, 0.9)', justifyContent: 'center', alignItems: 'center', padding: space(6) },
  bigWrapNew: { width: '100%', alignItems: 'center' },
  bigGlass: { width: '100%', padding: space(6), alignItems: 'center' },
  bigImgNew: { width: '100%', aspectRatio: 0.58, borderRadius: radius.md, marginBottom: space(6) },
  bigInfo: { alignItems: 'center', gap: space(1) },
  bigPos: { ...font.caption, color: colors.ju, fontWeight: '700', letterSpacing: 1 },
  bigName: { ...font.heading, color: colors.ink, textAlign: 'center' },
  bigKw: { ...font.body, color: colors.inkSoft, textAlign: 'center', marginTop: space(2), lineHeight: 22 },
  bigClose: { ...font.caption, color: colors.inkFaint, marginTop: space(6) },
});
