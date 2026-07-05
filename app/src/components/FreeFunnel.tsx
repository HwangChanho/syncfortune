// app/src/components/FreeFunnel.tsx — 무료(온디바이스) → 유료(깊은 풀이) 전환 퍼널 공통 셸
// ─────────────────────────────────────────────────────────────────────────
// 재회/짝사랑/취업 무료 콘텐츠의 공통 골격(단일 책임): 대표 명식을 온디바이스로 산출해
//   결정론 타이밍(무료 미리보기)을 보여주고, 곧바로 '깊은 풀이(유료)'로 유도하는 CTA를 붙인다.
//   ★규칙5(무료=온디바이스·API 0): 여기서는 supabase/Edge를 절대 부르지 않는다 — computeChart 결정론만.
//   각 화면(reunionAsk/crushAsk/jobAsk)은 heroImage·질문 문구·유료 라우트·render(타이밍 컴포넌트)만 주입.
//   미드나잇-골드 톤 + 넉넉한 여백(SpecialContentScreen 히어로 결을 가볍게 미러링).
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useState, type ReactNode } from 'react';
import { View, Text, ScrollView, ActivityIndicator, ImageBackground, StyleSheet } from 'react-native';
import { PressableScale } from './PressableScale';
import { useRouter } from 'expo-router';
import { loadRepChart } from '../lib/engine/myChart';   // 대표 명식(SavedChart) — 온디바이스, 로그인 불필요
import { computeChart } from '../lib/engine/engine';      // 만세력 결정론 산출(엔진) — API 0
import { colors, radius, space, shadow, font } from '../lib/theme';

/**
 * 무료→유료 퍼널 공통 셸.
 * @param heroImage 상단 히어로 배경 이미지(require) — 콘텐츠 정체성.
 * @param question  히어로에 크게 얹는 질문 헤드라인(퍼널 훅).
 * @param sub       질문 아래 보조 설명(선택).
 * @param paidRoute 'CTA' 로 이동할 유료 풀이 라우트(예: '/reunion').
 * @param paidCta   골드 CTA 버튼 라벨(예: '깊은 재회 풀이 보기').
 * @param render    대표 명식의 saju 로 렌더할 결정론 타이밍(예: <ReunionTiming saju={saju} />). saju=any(엔진 산출물).
 */
export function FreeFunnel({ heroImage, question, sub, paidRoute, paidCta, render }: {
  heroImage: any;
  question: string;
  sub?: string;
  paidRoute: string;
  paidCta: string;
  render: (saju: any) => ReactNode;
}) {
  const router = useRouter();
  const [saju, setSaju] = useState<any>(null); // 대표 명식의 사주(결정론). null=아직 로드 전 or 명식 없음.
  const [loaded, setLoaded] = useState(false);  // 비동기 로드 완료 여부(스피너 종료 신호).

  // 마운트 시 대표 명식 → 온디바이스 saju 산출(서버·로그인·광고 불요). 실패해도 앱이 죽지 않게 try/catch.
  useEffect(() => {
    let alive = true; // 언마운트 후 setState 방지 가드
    (async () => {
      try {
        const c = await loadRepChart();
        if (!alive) return;
        if (c) {
          // 시각 미상(timeAccuracy='미상')이면 timeUnknown 을 saju 에 병합 — 타이밍 컴포넌트가 시주(時支)를
          //   도화 탐지에서 제외하도록(코드베이스 관례: SpecialContentScreen/pet 과 동일). 엔진 산출물엔 이 플래그가 없음.
          const computed = computeChart(c.input).saju;
          setSaju({ ...computed, timeUnknown: c.input?.timeAccuracy === '미상' });
        }
      } catch {
        // 산출 실패 = saju null 유지 → 아래에서 '명식 등록 유도' 폴백(무한 스피너 방지).
      } finally {
        if (alive) setLoaded(true);
      }
    })();
    return () => { alive = false; };
  }, []);

  // 명식 없음(또는 산출 실패) — 유료 CTA 를 노출하기 전에 먼저 명식 등록을 부드럽게 유도.
  //   (명식이 없으면 타이밍도 유료 풀이도 의미가 없으므로 히어로/CTA 대신 등록 안내 전면 노출.)
  if (loaded && !saju) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyMsg}>명식을 먼저 등록해 주세요</Text>
        <PressableScale style={styles.registerBtn} onPress={() => router.push('/register')}>
          <Text style={styles.registerTx}>명식 등록하기</Text>
        </PressableScale>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.wrap}>
      {/* 히어로 — 이미지 배경 + 어둡게 스크림 위에 질문 헤드라인(밝은 글씨). 퍼널의 첫 훅. */}
      <ImageBackground source={heroImage} style={styles.hero} imageStyle={styles.heroImg} resizeMode="cover">
        <View style={styles.heroScrim} />
        <View style={styles.heroInner}>
          <Text style={styles.heroTitle}>{question}</Text>
          {sub ? <Text style={styles.heroSub}>{sub}</Text> : null}
        </View>
      </ImageBackground>

      {/* 결정론 타이밍(무료 미리보기) — 로드 전엔 스피너, 완료되면 주입된 타이밍 컴포넌트. */}
      {saju ? render(saju) : (
        <View style={styles.timingLoading}>
          <ActivityIndicator color={colors.ju} />
        </View>
      )}

      {/* ★골드 CTA — 유료 깊은 풀이로 유도(퍼널 전환점). 눌림 피드백(PressableScale) + 화살표.
          네비는 앱 관례(router.navigate·홈/joseonjob과 동일 틀) — router.push 로 무반응하던 것 수정(daniel 07-05). */}
      <PressableScale style={styles.cta} onPress={() => router.navigate(paidRoute as any)}>
        <Text style={styles.ctaTx}>{paidCta}</Text>
        <Text style={styles.ctaArrow}>→</Text>
      </PressableScale>

      {/* 은은한 힌트 — 무료는 '언제', 유료는 '왜·상대 마음·개운법'까지임을 살짝 안내. */}
      <Text style={styles.hint}>더 깊은 이유·상대 마음·개운법은 깊은 풀이에서 볼 수 있어요</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  wrap: { padding: space(6), paddingBottom: space(12) }, // 넉넉한 여백(콘텐츠 좌우 space(6) 통일)
  // 명식 없음 — 전면 중앙 안내
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: space(7), backgroundColor: colors.bg },
  emptyMsg: { ...font.body, color: colors.ink, textAlign: 'center', marginBottom: space(5) },
  registerBtn: { backgroundColor: colors.ju, borderRadius: radius.md, paddingVertical: space(3.25), paddingHorizontal: space(6), ...shadow.card },
  registerTx: { color: colors.bg, fontSize: 15, fontWeight: '800' },
  // 히어로(이미지 배경 + 스크림 + 질문). 세로 카드아트(832×1216)를 가로 박스에 cover-crop 시 중앙 띠가 꽉 참.
  hero: { aspectRatio: 1.5, borderRadius: radius.lg, overflow: 'hidden', marginBottom: space(6), backgroundColor: colors.sunk, justifyContent: 'center' },
  heroImg: { borderRadius: radius.lg },
  heroScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.scrimHero }, // 이미지 위 가독 스크림(밝은 글씨 대비)
  heroInner: { alignItems: 'center', paddingHorizontal: space(6), paddingVertical: space(7) },
  heroTitle: { fontSize: 26, fontWeight: '900', color: colors.onImage, textAlign: 'center', lineHeight: 34 }, // 큰 질문 헤드라인(이미지 위=밝게)
  heroSub: { fontSize: 14, color: colors.onImageSoft, textAlign: 'center', marginTop: space(3), lineHeight: 21 },
  // 타이밍 로드 중 스피너 슬롯
  timingLoading: { paddingVertical: space(8), alignItems: 'center', marginBottom: space(4) },
  // ★골드 CTA(가장 눈에 띄게) — 금색 채움 + 그림자 + 화살표
  cta: { backgroundColor: colors.ju, borderRadius: radius.md, paddingVertical: space(4), paddingHorizontal: space(6), flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: space(2), ...shadow.card },
  ctaTx: { color: colors.bg, fontSize: 16, fontWeight: '900' },
  ctaArrow: { color: colors.bg, fontSize: 18, fontWeight: '900', marginLeft: space(2) },
  // 은은한 힌트
  hint: { ...font.caption, color: colors.inkFaint, textAlign: 'center', marginTop: space(4), lineHeight: 18 },
});
