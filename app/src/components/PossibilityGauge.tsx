// app/src/components/PossibilityGauge.tsx — 가능성 게이지(0~100 애니 미터) 공용 컴포넌트
// ─────────────────────────────────────────────────────────────────────────
// 원래 ReunionRich(재회 무료)에 인라인돼 있던 'ReunionGauge'를 재사용 가능한 공용 컴포넌트로 추출.
//   → 재회(ReunionRich)·애정흐름(love.tsx)이 같은 미터 UI를 공유(단일 책임·중복 제거).
//   순수 표시(presentational): 점수·라벨·톤·문구를 props로 받아 그리기만 한다(점수 산출은 lib/love/inyeonGauge).
//
// ▶ 담는 것: 큰 숫자 카운트업(0→score) · 좌→우 채움 미터 · '열림' 톤일 때 은은한 글로우 펄스 ·
//   3구간 라벨(조용/서서히/열림) · 경향 라벨(§4 경향·단정 금지) · 한 줄 문구(선택).
//   화면 텍스트엔 한자·명리 용어 노출 금지(일상어) — 호출부가 넘기는 label/caption 책임.
//
// ▶ 부모(리스트)와 형제 섹션을 카운트업마다 리렌더시키지 않도록 미터만 별도 컴포넌트로 격리(성능).
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react';
import { View, Text, Animated, Easing, StyleSheet } from 'react-native';
import { colors, radius, space, font } from '../lib/theme';
import type { GaugeTone } from '../lib/love/inyeonGauge'; // 'open' | 'warming' | 'quiet'

/**
 * 가능성 게이지(공용) — 애니 미터 + 숫자 카운트업 + 톤별 색·글로우 + 경향 라벨.
 * @param score   0~100 결정론 점수(호출부에서 산출 — lib/love/inyeonGauge).
 * @param label   경향 라벨(예: 열려 있어요 / 서서히 열려요 / 지금은 조용해요). 화면 노출 = 일상어.
 * @param tone    점수 밴드('open' → 글로우·강조 on / 'warming' · 'quiet' → off). 색·반짝임을 가른다.
 * @param title   카드 제목(선택, 예: '재회의 문이 열린 정도' / '인연이 무르익는 흐름').
 * @param caption 게이지 아래 한 줄 문구(선택, 전향적·처방 동반).
 * @param accent  강조색(선택, 기본 colors.ju). 숫자·채움·강조 라벨 색 — 애정 화면은 핑크(LOVE_PINK) 주입.
 */
export function PossibilityGauge({
  score,
  label,
  tone,
  title,
  caption,
  accent = colors.ju,
}: {
  score: number;
  label: string;
  tone: GaugeTone;
  title?: string;
  caption?: string;
  accent?: string;
}) {
  const bright = tone === 'open';                        // '열림' 톤만 글로우·강조 on(기존 ReunionGauge의 bright와 동일)
  const anim = useRef(new Animated.Value(0)).current;    // 0→1 채움 트윈(마운트 시)
  const glow = useRef(new Animated.Value(0.35)).current; // '열림' 글로우/반짝임 펄스
  const [display, setDisplay] = useState(0);             // 숫자 카운트업(0→score)

  // 마운트(또는 score 변경) 시 게이지 채움 + 숫자 카운트업. 값은 이 컴포넌트에만 국한 → 형제 섹션 리렌더 없음.
  useEffect(() => {
    anim.setValue(0);
    setDisplay(0);
    const id = anim.addListener(({ value }) => setDisplay(Math.round(value * score)));
    Animated.timing(anim, { toValue: 1, duration: 1100, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    return () => anim.removeListener(id);
  }, [anim, score]);

  // '열림' 톤일 때만 은은한 글로우/반짝임 루프(펄스). opacity 왕복(네이티브 드라이버).
  useEffect(() => {
    if (!bright) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(glow, { toValue: 0.9, duration: 900, useNativeDriver: true }),
      Animated.timing(glow, { toValue: 0.35, duration: 900, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [glow, bright]);

  // 채움 폭(0%→score%). 레이아웃(width) 애니라 useNativeDriver:false. score 0이어도 최소 3% 노브 노출.
  const fillW = anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', `${Math.max(3, score)}%`] });

  return (
    <View style={styles.card}>
      {title ? <Text style={[styles.cardTitle, { color: accent }]}>{title}</Text> : null}
      {/* 큰 숫자(카운트업) + 경향 라벨(오른쪽) */}
      <View style={styles.gaugeHead}>
        <Text style={[styles.gaugeNum, { color: accent }]}>{display}</Text>
        <Text style={styles.gaugeUnit}> / 100</Text>
        <View style={{ flex: 1 }} />
        <View style={styles.tendencyWrap}>
          <Text style={[styles.tendency, bright && { color: accent }]}>{label}</Text>
          {bright && <Animated.Text style={[styles.spark, { color: accent, opacity: glow }]}>✦</Animated.Text>}
        </View>
      </View>
      {/* 미터: 트랙 + 채움(좌→우) + 열림 상태 글로우 오버레이 */}
      <View style={styles.track}>
        <Animated.View style={[styles.fill, { width: fillW, backgroundColor: accent }]}>
          {bright && <Animated.View style={[styles.fillGlow, { opacity: glow }]} />}
        </Animated.View>
      </View>
      {/* 3구간 라벨 */}
      <View style={styles.zones}>
        <Text style={styles.zoneTx}>조용</Text>
        <Text style={styles.zoneTx}>서서히</Text>
        <Text style={styles.zoneTx}>열림</Text>
      </View>
      {caption ? <Text style={styles.gaugeCaption}>{caption}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // 공통 카드(ReunionTiming/LoveFlowGraph와 동일 결 — sunk 배경·라운드·여백·하단 간격)
  card: { backgroundColor: colors.sunk, borderRadius: radius.md, padding: space(4), marginBottom: space(4) },
  cardTitle: { ...font.body, fontWeight: '800', marginBottom: space(2.5), fontSize: 14 }, // 색은 accent 주입
  // ── 게이지 ──
  gaugeHead: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: space(2.5) },
  gaugeNum: { fontSize: 34, fontWeight: '900', letterSpacing: 0.5, lineHeight: 36 }, // 색은 accent 주입
  gaugeUnit: { color: colors.inkFaint, fontSize: 13, fontWeight: '700', marginBottom: space(1.5) },
  tendencyWrap: { flexDirection: 'row', alignItems: 'center' },
  tendency: { ...font.caption, color: colors.inkSoft, fontWeight: '800', fontSize: 13 }, // bright 시 accent로 덮음
  spark: { fontSize: 13, marginLeft: space(1), fontWeight: '900' }, // 색은 accent 주입
  // 트랙 + 채움
  track: { height: 12, borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill, minWidth: 6 }, // 색은 accent 주입
  fillGlow: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.5)', borderRadius: radius.pill }, // 열림 글로우(펄스) — 반투명 흰빛
  zones: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space(1.5) },
  zoneTx: { ...font.caption, color: colors.inkFaint, fontSize: 10 },
  gaugeCaption: { ...font.caption, color: colors.inkSoft, lineHeight: 18, marginTop: space(2.5), fontSize: 12 },
});
