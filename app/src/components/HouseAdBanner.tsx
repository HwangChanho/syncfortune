// app/src/components/HouseAdBanner.tsx — 홈 상단 '내부 광고'(하우스 광고) 회전 배너
// ─────────────────────────────────────────────────────────────────────────
// daniel 2026-07-24: 홈에 배너를 올리되, 지금은 외부 광고(AdMob) 대신 *내부 콘텐츠 프로모*를 먼저 노출.
//   "나의 인연은 어디에?" 처럼 궁금증을 자극하는 훅 → 탭하면 해당 콘텐츠로 진입(자연스러운 발견·전환).
//   ★이미지 기반(daniel 07-24 '기존 이미지로·실제 배너처럼·조잡하지 않게'): 각 콘텐츠의 기존 타일 이미지를
//     가로 배너 배경(cover)으로 쓰고, 좌측 다크 그라디언트 위에 훅/부제를 얹어 '진짜 배너'처럼. ContentGrid 카드와 같은 결.
//   · 가로 페이징 캐러셀(스와이프) + 4.5초 자동 회전 + 하단 도트.
//   · 문구(hook/sub)는 마케팅 카피라 daniel 검수 슬롯(★). i18n 은 추후(현재 ko 단일 스토어).
// ─────────────────────────────────────────────────────────────────────────
import { useState, useRef, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native';
import { Image as ExpoImage } from 'expo-image'; // 자동 다운샘플·디스크캐시(콘텐츠 카드와 동일)
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { PressableScale } from './PressableScale';
import { useFontScale } from '../lib/ui/fontScale';
import { colors, radius, space, shadow } from '../lib/theme';

// ★프로모 목록(daniel 검수 슬롯) — 인기 콘텐츠를 궁금증 훅으로. image = 그 콘텐츠의 기존 타일(단일 출처: contentSections 와 동일 파일).
type Promo = { key: string; hook: string; sub: string; route: string; accent: string; image: any };
const PROMOS: Promo[] = [
  { key: 'love',     hook: '나의 인연은 어디에?',        sub: '애정 흐름과 인연이 무르익는 시기를 사주로', route: '/love',     accent: '#F4A6B8', image: require('../../assets/icons/love.jpg') },
  { key: 'wealth',   hook: '내 재물 그릇은 얼마나 클까?', sub: '타고난 재물과 크게 들어오는 시기',          route: '/wealth',   accent: '#EBCF8A', image: require('../../assets/icons/wealth.jpg') },
  { key: 'jobfit',   hook: '나에게 딱 맞는 직업은?',      sub: '타고난 적성으로 찾는 나의 天職',            route: '/jobfit',   accent: '#8FBEEC', image: require('../../assets/icons/jobfit.jpg') },
  { key: 'future10', hook: '10년 뒤, 나는 어떤 모습일까?', sub: '대운·세운으로 보는 나의 미래',              route: '/future10', accent: '#8FD8BA', image: require('../../assets/icons/future10.jpg') },
  { key: 'crush',    hook: '그 사람도 내 마음 같을까?',   sub: '짝사랑이 이뤄질 시기와 다가가는 법',        route: '/crushAsk', accent: '#CBA6E6', image: require('../../assets/icons/crush.jpg') },
];

export function HouseAdBanner() {
  const router = useRouter();
  const { fs } = useFontScale();
  const [w, setW] = useState(0);         // 컨테이너 폭 = 카드 1장 폭(페이징 단위). onLayout 실측.
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
            <View style={styles.card}>
              {/* 배경 = 콘텐츠 기존 타일 이미지(cover). 우측이 보이게 좌측을 어둡게 덮는다. */}
              <ExpoImage source={p.image} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="center" cachePolicy="memory-disk" transition={150} />
              {/* 좌→우 다크 그라디언트(좌측 텍스트 가독·우측 이미지 노출) — '진짜 배너' 결 */}
              <LinearGradient
                colors={['rgba(9,9,20,0.94)', 'rgba(9,9,20,0.72)', 'rgba(9,9,20,0.12)']}
                locations={[0, 0.5, 1]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.body}>
                <Text style={[styles.eyebrow, { color: p.accent }]}>✨ 이런 건 어때요?</Text>
                <Text style={[styles.hook, { fontSize: fs(24) }]} numberOfLines={2}>{p.hook}</Text>
                <Text style={[styles.sub, { fontSize: fs(13) }]} numberOfLines={1}>{p.sub}</Text>
                <View style={styles.ctaRow}>
                  <Text style={[styles.cta, { color: p.accent }]}>보러 가기</Text>
                  <Text style={[styles.cta, { color: p.accent }]}> ›</Text>
                </View>
              </View>
            </View>
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
  // 이미지 배너 — 와이드(가로 3.0:1 근처), 큼직하게(daniel 07-24 '더 크게'). 이미지 cover + 좌측 다크 오버레이.
  card: { width: '100%', height: 250, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(20,19,46,0.12)', ...shadow.card }, // ★아래로 더 크게(daniel 2026-07-25 150→200 → 07-26 200→250)
  body: { flex: 1, justifyContent: 'center', paddingLeft: space(6), paddingRight: space(5), maxWidth: '78%' },
  eyebrow: { fontSize: 13, fontWeight: '800', letterSpacing: 0.3, marginBottom: 6 },
  hook: { color: colors.white, fontWeight: '900', letterSpacing: -0.3, lineHeight: 30 },
  sub: { color: 'rgba(255,255,255,0.9)', marginTop: 5, fontWeight: '500' },
  ctaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  cta: { fontSize: 13.5, fontWeight: '800' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: space(3) },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.line },
  dotOn: { backgroundColor: colors.ju, width: 18 },
});
