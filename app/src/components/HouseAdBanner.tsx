// app/src/components/HouseAdBanner.tsx — 홈 '오늘의 추천' 회전 배너
// ─────────────────────────────────────────────────────────────────────────
// daniel 2026-07-24: 홈에 배너를 올리되, 외부 광고(AdMob) 대신 *내부 콘텐츠 프로모*를 먼저 노출.
//   "나의 인연은 어디에?" 처럼 궁금증을 자극하는 훅 → 탭하면 해당 콘텐츠로 진입.
//
// ■ 이 파일이 맡는 것 = **여러 장을 어떻게 넘기나**(스와이프·자동회전·점).
//   한 장이 어떻게 생겼나는 `kit/PromoBanner` 가 맡는다. 둘을 갈라 둬야 한쪽만 고칠 수 있다.
//
// ■ 2026-08-18 시안 반영으로 바뀐 것
//   [before] 콘텐츠 타일 사진 + 좌측 다크 그라디언트 + 흰 글자
//   [after ] 오행 계열 파스텔 일러스트 + 밝은 스크림 + 먹 글자 + `ju` 알약
//   ★그림은 **테마 오행**을 따른다 — 시안이 같은 배너 문구를 오행마다 다른 그림으로 그렸다
//     (p04 水=풍선 · p13 土=문 · p21 木=클로버 · p29 火=계단). `bannerArtFor()` 가 그 규칙이다.
//
// ■ ⚠️웹에서 자동회전이 **원래부터 안 돌고 있었다**(2026-08-18 실측)
//   `pagingEnabled` 는 웹에서 `scroll-snap-type: x mandatory` 로 번역되는데,
//   그 위에서 `scrollTo({animated:true})`(= `behavior:'smooth'`) 는 **아무 일도 하지 않는다**.
//   실측: smooth → 1.2초 뒤에도 `scrollLeft` 가 0. instant → 곧바로 677.
//   그런데 점(idx)은 카운터로 따로 돌고 있어서 **점만 넘어가고 화면은 그대로**였다 —
//   살아 있는 것처럼 보여서 아무도 몰랐다.
//   ⇒ ①웹은 애니메이션 없이 민다(그래야 실제로 넘어간다) ②`onScroll` 이 실제 위치로 커서를 교정한다.
//   ★그래서 점이 다시 거짓말을 하려면 '밀기가 조용히 실패'해야 하는데, 그 원인(animated:true)은
//     `check:bannerart` B2 가 막는다.
//
// ■ 지키고 있는 것 (건드리지 말 것)
//   route 가 **카테고리**로 간다 — daniel 2026-08-06 퍼널 재설계.
//   종전엔 유료 화면 직행(/love·/wealth…)이라 첫 화면에서 바로 결제 벽을 만났다.
//   카테고리 안은 무료가 상단(ContentGrid 무료 우선)이라 자연히 '무료 → 유료' 순서가 된다.
// ─────────────────────────────────────────────────────────────────────────
import { useState, useRef, useEffect } from 'react';
import { View, ScrollView, StyleSheet, Platform, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { PromoBanner } from './kit/PromoBanner';
import { bannerArtFor } from '../lib/ui/brandAsset';
import { colors, space } from '../lib/theme';

/** 프로모 한 장 — 문구는 i18n 키로만 갖는다(하드코딩하면 en/ja 에 한국어가 나간다). */
type Promo = { key: string; route: string };

/** ★프로모 목록(문구는 `copy/*.ts` 의 `banner.*`). 순서 = 캐러셀 순서. */
const PROMOS: Promo[] = [
  { key: 'love',  route: '/contents?cat=love' },
  { key: 'money', route: '/contents?cat=money' },
  { key: 'self',  route: '/contents?cat=self' },
  { key: 'flow',  route: '/contents?cat=flow' },
  { key: 'fun',   route: '/contents?cat=fun' },
];

export function HouseAdBanner() {
  const router = useRouter();
  const { t } = useTranslation();
  const [w, setW] = useState(0);         // 컨테이너 폭 = 카드 1장 폭(페이징 단위). onLayout 실측.
  const [idx, setIdx] = useState(0);
  const idxRef = useRef(0);              // 다음 장을 정하는 커서(스와이프하면 onScroll 이 여기로 진실을 써 넣는다)
  const scRef = useRef<ScrollView>(null);

  // 4.5초 자동 회전 — 폭 측정 후 시작. 마지막 장 다음은 첫 장으로 순환.
  useEffect(() => {
    if (!w) return;
    const id = setInterval(() => {
      const next = (idxRef.current + 1) % PROMOS.length;
      idxRef.current = next;
      setIdx(next);
      // 웹은 스냅과 부딪혀 애니메이션이 통째로 무시된다 → 애니메이션 없이 민다(위 ⚠️)
      scRef.current?.scrollTo({ x: next * w, animated: Platform.OS !== 'web' });
    }, 4500);
    return () => clearInterval(id);
  }, [w]);

  // 스와이프하면 **실제 위치**가 커서를 덮어쓴다 — 손으로 넘긴 다음 장부터 이어서 돈다.
  //   ⚠️회전 자체를 이 값에 의존시키지 않는 이유: 웹에서 `onScroll` 은 `scrollEventThrottle` 때문에
  //     rAF 에 묶여 있고, **rAF 는 백그라운드 탭에서 안 돈다**([[web-nested-text-crash]]).
  //     위치를 읽어 다음 장을 정하게 했더니 배경 탭에서 위치가 0 으로 고정돼 **1장에서 멈췄다**(실측).
  //     ⇒ 회전은 커서가 몰고, 위치는 **교정만** 한다.
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!w) return;
    const i = Math.min(PROMOS.length - 1, Math.max(0, Math.round(e.nativeEvent.contentOffset.x / w)));
    idxRef.current = i;
    setIdx((prev) => (prev === i ? prev : i));   // 같은 값이면 렌더를 만들지 않는다
  };

  return (
    <View style={styles.wrap} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      <ScrollView
        ref={scRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {/* 폭 측정 전엔 렌더 보류(카드 폭이 0이면 페이징이 깨진다) */}
        {w > 0 && PROMOS.map((p, i) => (
          <View key={p.key} style={{ width: w }}>
            <PromoBanner
              slide={{
                kicker: t('banner.kicker'),
                title: t(`banner.${p.key}T`),
                sub: t(`banner.${p.key}S`),
                cta: t(`banner.${p.key}C`),
                ...bannerArtFor(i),              // {image, field} — 그림과 **그 그림의 바탕색**을 함께 넘긴다
                onPress: () => router.push(p.route as never),
              }}
            />
          </View>
        ))}
      </ScrollView>
      {/* 점은 캐러셀이 그린다 — PromoBanner 는 한 장만 알고 전체 장수를 모른다 */}
      <View style={styles.dots}>
        {PROMOS.map((p, i) => <View key={p.key} style={[styles.dot, i === idx && styles.dotOn]} />)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: space(5) },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: space(1) },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.juLine },
  dotOn: { width: 18, backgroundColor: colors.ju },
});
