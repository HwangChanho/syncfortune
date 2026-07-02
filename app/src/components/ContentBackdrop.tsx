// app/src/components/ContentBackdrop.tsx — 전 콘텐츠 화면 공통 배경 레이어(daniel 07-02)
// ─────────────────────────────────────────────────────────────────────────
// 목적: "모든 콘텐츠 화면 뒤에 단 하나의 전역 배경." 기존엔 화면마다 bgSource ImageBackground(≈23개)
//   또는 불투명 colors.bg(≈53개)가 섞여 배경이 제각각이었음 → 이 컴포넌트를 (app)/_layout 최하단에 한 번 깔고,
//   각 화면의 루트 컨테이너를 투명으로 바꿔 전 화면이 *같은* 배경을 공유하게 한다(daniel).
//   • 다크(달밤): bg-night.png + 홈과 동일한 별 반짝임·유성(TwinklingStars) — 떨어지는 별 애니 재현.
//   • 라이트(한지): bg-paper.jpg + 따뜻한 워시 + 상·하단 옅은 비네트로 '종이 질감'을 강화(뿌옇지 않게 절제).
// ⚠️ expo-linear-gradient 는 네이티브 모듈이라 현재 dev 빌드에서 'Unimplemented component' 로 깨질 수 있음
//   (GlassCard 주석 참고). → 그라데이션 대신 저투명 View 를 겹쳐 비네트를 근사한다(네이티브 의존 0, 안정적).
// 순수 배경: pointerEvents="none" + StyleSheet.absoluteFill 로 터치·레이아웃에 일절 개입하지 않는다.
// ─────────────────────────────────────────────────────────────────────────
import { View, StyleSheet } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { bgSource, activeScheme } from '../lib/theme';
import { TwinklingStars } from './HomeBackdrop'; // 다크 밤하늘 위 별·유성(홈과 동일 애니 재사용)

// 전역 콘텐츠 배경 — 활성 테마에 맞춰 밤하늘(별)/한지(워시+비네트)를 합성한 단일 배경 레이어.
export function ContentBackdrop() {
  const dark = activeScheme === 'dark';
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* ① 베이스 배경 이미지 — expo-image 자동 다운샘플(전 화면이 하나의 이미지를 공유·메모리 절약) */}
      <ExpoImage source={bgSource} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" />
      {dark ? (
        // ② 다크(달밤): 홈과 동일한 별 반짝임 + 유성(밤하늘 이미지 위에 얹음)
        <TwinklingStars />
      ) : (
        // ② 라이트(한지): 종이 질감 강화 — 따뜻한 워시(전면) + 상·하단 비네트(가장자리를 은은히 짙게 = 깊이감)
        <>
          {/* 따뜻한 세피아 워시(전면) — 한지의 온기·결을 살짝 눌러 줌(과하면 탁해지므로 아주 옅게) */}
          <View style={[StyleSheet.absoluteFill, styles.warmWash]} />
          {/* 상단 비네트 — 저투명 2겹을 겹쳐 계단감을 줄이고 위→아래로 부드럽게 옅어지게(그라데이션 근사) */}
          <View style={[styles.edgeTop, styles.edgeTop1]} />
          <View style={[styles.edgeTop, styles.edgeTop2]} />
          {/* 하단 비네트 — 동일 원리(하단이 가장 짙음) */}
          <View style={[styles.edgeBottom, styles.edgeBottom1]} />
          <View style={[styles.edgeBottom, styles.edgeBottom2]} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // 한지 위 따뜻한 세피아 워시 — 전면 저투명(종이 온기). rgba 로 직접 지정(overlaySoft 는 밝은 베이지라 '깊이'가 안 남).
  warmWash: { backgroundColor: 'rgba(150,120,70,0.05)' },
  // 상단 비네트(따뜻한 먹빛) — 겹칠수록 짙어져 최상단이 가장 어둡고 아래로 자연스레 사라진다.
  edgeTop: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: 'rgba(92,74,42,0.05)' },
  edgeTop1: { height: 170 },
  edgeTop2: { height: 84 },
  // 하단 비네트 — 상단보다 살짝 더 짙게(콘텐츠가 아래로 흐르며 자연스러운 무게감).
  edgeBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(92,74,42,0.06)' },
  edgeBottom1: { height: 210 },
  edgeBottom2: { height: 104 },
});
