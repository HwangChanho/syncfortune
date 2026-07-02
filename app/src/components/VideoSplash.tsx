// app/src/components/VideoSplash.tsx — 앱 실행 인트로 영상(왕궁 문 → 웅장한 호랑이 등장 → 으르렁, daniel 07-02)
// ─────────────────────────────────────────────────────────────────────────
// expo-video 로 assets/loading.mp4 를 전체화면(cover) 1회 재생 → 끝나면 페이드아웃 → onDone.
//   · 탭하면 즉시 스킵. · 최대 재생시간(타임아웃)으로 이벤트 누락에도 반드시 종료(멈춤 방지).
//   · 로드/재생 실패 시 기존 이미지 인트로(SplashOverlay)로 폴백 → 인트로가 비지 않게.
// ⚠️ 네이티브 모듈(expo-video) — 추가 후 *재빌드* 필요. 으르렁 사운드는 영상 오디오 사용(무음스위치 시엔 안 들릴 수 있음).
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { SplashOverlay } from './SplashOverlay'; // 로드 실패 시 폴백(호랑이 이미지 인트로)

const SRC = require('../../assets/loading.mp4');

export function VideoSplash({ onDone }: { onDone: () => void }) {
  const fade = useRef(new Animated.Value(1)).current;
  const doneRef = useRef(false);            // 종료 1회 보장(타임아웃·이벤트·탭 중복 방지)
  const [failed, setFailed] = useState(false); // 로드/재생 실패 → 이미지 폴백

  // 플레이어 — 루프 없이 1회 재생, 소리 켜서 으르렁 재생.
  const player = useVideoPlayer(SRC, (p) => {
    try { p.loop = false; p.muted = false; p.play(); } catch { setFailed(true); }
  });

  // 페이드아웃 후 종료(1회만).
  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    Animated.timing(fade, { toValue: 0, duration: 350, useNativeDriver: true }).start(() => onDone());
  };

  useEffect(() => {
    // ① 최대 재생시간(영상 ~5s + 여유) — 이벤트 누락/멈춤에도 반드시 종료.
    const timer = setTimeout(finish, 5800);
    // ② 재생 끝 이벤트(있으면) 즉시 종료.
    let endSub: { remove?: () => void } | undefined;
    try { endSub = player.addListener('playToEnd', finish) as any; } catch { /* API 없으면 타임아웃만 */ }
    // ③ 상태 에러 감지 → 이미지 폴백(짧게 보여주고 종료는 SplashOverlay가).
    let statusSub: { remove?: () => void } | undefined;
    try {
      statusSub = player.addListener('statusChange', (s: any) => {
        if (s?.status === 'error' || s?.error) setFailed(true);
      }) as any;
    } catch { /* ignore */ }
    return () => { clearTimeout(timer); endSub?.remove?.(); statusSub?.remove?.(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 로드/재생 실패 → 기존 이미지 인트로로 폴백(자체 onDone 처리).
  if (failed) return <SplashOverlay onDone={onDone} />;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.bg, { opacity: fade }]}>
      {/* 탭하면 스킵 */}
      <Pressable style={StyleSheet.absoluteFill} onPress={finish}>
        <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bg: { backgroundColor: '#0B0A1A' }, // 영상 로드 전/레터박스 시 미드나잇 배경
});
