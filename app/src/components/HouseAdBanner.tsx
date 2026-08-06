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
import { A } from '../lib/ui/remoteAsset'; // ★이미지 원격화(daniel 08-01) — 번들에서 걷어내고 Storage 에서 받는다
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
  // ★2026-08-06 daniel 퍼널 재설계: "배너에서 연애쪽을 선택하면 풀이탭 연애 카테고리로 넘어가고,
  //   무료 컨텐츠가 상단에 노출되고, 궁금해질 때쯤 유료 상세로".
  //   [바뀐 것] route 가 **유료 화면 직행**(/love·/wealth·/jobfit·/future10 = 결제 벽)이었다.
  //     첫 화면에서 바로 결제를 만나면 무료 사용자는 되돌아간다 → 주제 **카테고리**로 보낸다.
  //     카테고리 안은 무료가 상단(ContentGrid 무료 우선 정렬)이라 자연히 '무료 → 유료' 순서가 된다.
  { key: 'love',  hook: '나의 인연은 어디에?',        sub: '연애·궁합 — 무료로 먼저 보고 더 깊이',      route: '/contents?cat=love',  accent: '#F4A6B8', image: A('icons/love.jpg') },
  { key: 'money', hook: '내 재물 그릇은 얼마나 클까?', sub: '돈·일·진로 — 타고난 그릇과 풀리는 때',      route: '/contents?cat=money', accent: '#EBCF8A', image: A('icons/wealth.jpg') },
  { key: 'self',  hook: '나는 어떤 사람일까?',         sub: '성격·기질 — 무료 분석부터',                 route: '/contents?cat=self',  accent: '#8FBEEC', image: A('icons/selfAnalysis.jpg') },
  { key: 'flow',  hook: '10년 뒤, 나는 어떤 모습일까?', sub: '시기와 흐름 — 오늘부터 십 년 뒤까지',       route: '/contents?cat=flow',  accent: '#8FD8BA', image: A('icons/future10.jpg') },
  { key: 'fun',   hook: '가볍게 오늘 하나 볼까?',       sub: '타로·전생·복 — 심각하지 않게',              route: '/contents?cat=fun',   accent: '#CBA6E6', image: A('icons/taro.jpg') },
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
