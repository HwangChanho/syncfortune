// app/src/components/TextSplash.tsx — 로딩 영상 OFF 시 스플래시(daniel 07-03)
// ─────────────────────────────────────────────────────────────────────────
// 설정에서 로딩 영상을 끄면 인트로 영상 대신 이 화면을 1회 보여준다 — "그냥 八字 한자만"(daniel).
//   미드나잇 배경 + 골드 八字. 페이드 인 → 짧게 유지 → 페이드 아웃 → onDone. 탭하면 즉시 스킵.
//   영상(VideoSplash)과 동일한 배경색(#0B0A1A)이라 전환이 매끄럽다.
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, Platform } from 'react-native';

export function TextSplash({ onDone }: { onDone: () => void }) {
  const fade = useRef(new Animated.Value(0)).current; // 0=투명 → 페이드 인/아웃 공용
  const doneRef = useRef(false);                       // 종료 1회 보장(타임아웃·탭 중복 방지)

  // 페이드 아웃 후 종료(1회만).
  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    Animated.timing(fade, { toValue: 0, duration: 350, useNativeDriver: true }).start(() => onDone());
  };

  useEffect(() => {
    // 페이드 인 → 약 1.6초 뒤 종료(영상보다 짧게 — 단순 텍스트 스플래시).
    Animated.timing(fade, { toValue: 1, duration: 500, easing: undefined, useNativeDriver: true }).start();
    const timer = setTimeout(finish, 1600);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.bg, { opacity: fade }]}>
      {/* 탭하면 스킵 */}
      <Pressable style={[StyleSheet.absoluteFill, styles.center]} onPress={finish}>
        {/* ★웹에서는 **앱 이름 워드마크**를 쓴다(2026-08-15).
            네이티브는 설치 아이콘이 이미 브랜드를 말해 주지만, 웹은 링크로 들어와 **이 화면이 첫 인상**이다.
            여기서 옛 이름(八字)이 뜨면 스토어·랜딩·사이드바가 전부 '니운내운'인데 첫 화면만 다른 앱이 된다.
            ⚠️네이티브 쪽은 daniel 이 "그냥 八字 한자만"이라고 고른 화면이라 건드리지 않았다. */}
        {Platform.OS === 'web'
          ? <Text style={styles.wordmark}>니운내운</Text>
          : <Text style={styles.hanja}>八字</Text>}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bg: { backgroundColor: '#0B0A1A' },                 // 영상과 동일 미드나잇(매끄러운 전환)
  center: { alignItems: 'center', justifyContent: 'center' },
  hanja: { fontSize: 104, fontWeight: '900', color: '#C9A14A', letterSpacing: 10 }, // 골드 八字(브랜드)
  // 한글 4자는 한자 2자보다 길다 — 같은 크기로 두면 좁은 화면에서 넘친다
  wordmark: { fontSize: 54, fontWeight: '900', color: '#C9A14A', letterSpacing: 4 },
});
