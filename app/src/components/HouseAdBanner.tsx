// app/src/components/HouseAdBanner.tsx — 홈 상단 '내부 광고'(하우스 광고) 회전 배너
// ─────────────────────────────────────────────────────────────────────────
// daniel 2026-07-24: 홈에 배너를 올리되, 지금은 외부 광고(AdMob) 대신 *내부 콘텐츠 프로모*를 먼저 노출한다.
//   "나의 인연은 어디에?" 처럼 궁금증을 자극하는 훅 → 탭하면 해당 유료/무료 콘텐츠로 진입(자연스러운 발견·전환).
//   · 가로 페이징 캐러셀(스와이프) + 4.5초 자동 회전 + 하단 도트. 카드마다 콘텐츠별 그라디언트 액센트.
//   · 문구(hook/sub)는 마케팅 카피라 daniel 검수 슬롯(★) — 우선 초안. i18n 은 추후(현재 ko 단일 스토어).
//   · 노출 대상 = 전원(콘텐츠 발견 목적). 외부광고처럼 프리미엄 숨김이 필요하면 isPremium 가드 추가.
// ─────────────────────────────────────────────────────────────────────────
import { useState, useRef, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { PressableScale } from './PressableScale';
import { useFontScale } from '../lib/ui/fontScale';
import { colors, radius, space, shadow } from '../lib/theme';

// ★프로모 목록(daniel 검수 슬롯) — 인기 유료 콘텐츠를 궁금증 훅으로. route 는 실제 콘텐츠 라우트(contentSections 와 일치).
type Promo = { key: string; hook: string; sub: string; route: string; accent: [string, string]; emoji: string };
const PROMOS: Promo[] = [
  { key: 'love',     hook: '나의 인연은 어디에?',        sub: '애정 흐름과 인연이 무르익는 시기를 사주로', route: '/love',      accent: ['#E8718F', '#C64B6E'], emoji: '💘' },
  { key: 'wealth',   hook: '내 재물 그릇은 얼마나 클까?', sub: '타고난 재물과 크게 들어오는 시기',          route: '/wealth',    accent: ['#E8C878', '#B4892F'], emoji: '💰' },
  { key: 'jobfit',   hook: '나에게 딱 맞는 직업은?',      sub: '타고난 적성으로 찾는 나의 天職',            route: '/jobfit',    accent: ['#5E9BD6', '#3B6EC4'], emoji: '🎯' },
  { key: 'future10', hook: '10년 뒤, 나는 어떤 모습일까?', sub: '대운·세운으로 보는 나의 미래',              route: '/future10',  accent: ['#5FB89A', '#3E9B6E'], emoji: '🔮' },
  { key: 'crush',    hook: '그 사람도 내 마음 같을까?',   sub: '짝사랑이 이뤄질 시기와 다가가는 법',        route: '/crushAsk',  accent: ['#B98CD9', '#8A5FB8'], emoji: '💓' },
];

export function HouseAdBanner() {
  const router = useRouter();
  const { fs } = useFontScale();
  const [w, setW] = useState(0);         // 컨테이너 폭 = 카드 1장 폭(페이징 단위). onLayout 으로 실측(홈 패딩 무관 정확).
  const [idx, setIdx] = useState(0);
  const idxRef = useRef(0);              // 자동 회전용 최신 인덱스(setInterval 클로저 stale 방지)
  const scRef = useRef<ScrollView>(null);

  // 4.5초 자동 회전 — 폭 측정 후 시작. 마지막 장 다음은 첫 장으로 순환.
  useEffect(() => {
    if (!w) return;
    const id = setInterval(() => {
      const next = (idxRef.current + 1) % PROMOS.length;
      scRef.current?.scrollTo({ x: next * w, animated: true });
      idxRef.current = next;
      setIdx(next);
    }, 4500);
    return () => clearInterval(id);
  }, [w]);

  // 스와이프 종료 → 현재 인덱스 동기화(도트·자동회전 기준).
  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!w) return;
    const i = Math.round(e.nativeEvent.contentOffset.x / w);
    idxRef.current = i;
    setIdx(i);
  };

  return (
    <View style={styles.wrap} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      <ScrollView
        ref={scRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
      >
        {/* 폭 측정 전엔 렌더 보류(카드 폭이 0이면 페이징이 깨짐) */}
        {w > 0 && PROMOS.map((p) => (
          <PressableScale key={p.key} onPress={() => router.push(p.route as any)} style={{ width: w }}>
            <LinearGradient colors={p.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
              <View style={{ flex: 1 }}>
                <Text style={styles.eyebrow}>✨ 이런 건 어때요?</Text>
                <Text style={[styles.hook, { fontSize: fs(18) }]} numberOfLines={1}>{p.hook}</Text>
                <Text style={[styles.sub, { fontSize: fs(12) }]} numberOfLines={1}>{p.sub}</Text>
              </View>
              <Text style={styles.emoji}>{p.emoji}</Text>
              <Text style={styles.arrow}>›</Text>
            </LinearGradient>
          </PressableScale>
        ))}
      </ScrollView>
      {/* 페이지 도트 */}
      <View style={styles.dots}>
        {PROMOS.map((_, i) => <View key={i} style={[styles.dot, i === idx && styles.dotOn]} />)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: space(5) },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: space(2),
    borderRadius: radius.md, paddingVertical: space(4), paddingHorizontal: space(5),
    minHeight: 92, ...shadow.card,
  },
  eyebrow: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '700', letterSpacing: 0.3, marginBottom: 3 },
  hook: { color: colors.white, fontWeight: '800', letterSpacing: -0.2 },
  sub: { color: 'rgba(255,255,255,0.9)', marginTop: 3, fontWeight: '500' },
  emoji: { fontSize: 30 },
  arrow: { color: 'rgba(255,255,255,0.9)', fontSize: 26, fontWeight: '300', marginLeft: 2 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: space(2.5) },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.line },
  dotOn: { backgroundColor: colors.ju, width: 18 },
});
