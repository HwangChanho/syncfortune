// app/src/components/DoorReveal.tsx — 풀이 진입(공개) 연출: 골드 명조 문이 열리는 영상
// ─────────────────────────────────────────────────────────────────────────
// daniel 2026-07-06/07: 풀이를 '공개(revealed)'하는 순간, 골드 명조 문이 열리며 → 달빛 왕궁에 엎드린
//   백호(白虎)가 꼬리를 천천히 흔들며 지켜보다 가볍게 어흥 한 번 하는 영상(door-open.mp4·6.5초)을 전체화면
//   1회 재생 → 끝나면 부드럽게 페이드아웃하며 풀이가 드러난다. (문 열림=골드 명조 문 합성 리드인 +
//   Runway Gen-4 Turbo image-to-video[엎드린 백호·무줌·워터마크 delogo]. UnlockOverlay/VideoSplash 와 동일 expo-video.)
//   ★expo-video 패턴 = UnlockOverlay/VideoSplash 와 동일(신규 네이티브 의존 없음).
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useRef } from 'react';
import { Modal, Animated, StyleSheet } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { getReadingVideoEnabled } from '../lib/theme'; // 풀이영상 설정 — OFF면 문열림 연출도 생략(07-19/20 수정이 UnlockOverlay만 배선·여기 누락했던 근본버그·daniel 07-21)

const DOOR_VIDEO = require('../../assets/content-videos/door-open.mp4'); // 골드 문 열림→엎드린 백호 꼬리흔들며 지켜보다 어흥(6.5초)

// visible=true 로 켜지면 문 영상을 1회 재생, 끝(playToEnd)나면 onDone() 호출(부모가 visible=false 로 내림).
export function DoorReveal({ visible, onDone }: { visible: boolean; onDone: () => void }) {
  const fade = useRef(new Animated.Value(1)).current; // 영상 끝 → 페이드아웃
  const enabled = getReadingVideoEnabled(); // ★'풀이 영상' OFF면 이 문열림 연출도 재생 안 함(재발 근본버그 배선)

  // 훅 규칙상 항상 호출 — visible+enabled 일 때만 소스를 넘겨 그때만 재생(꺼지면 null=정지·릴리스). 비루프(1회).
  const source = (visible && enabled) ? DOOR_VIDEO : null;
  const player = useVideoPlayer(source, (p) => {
    try { p.loop = false; p.muted = false; p.play(); } catch { /* 소스 없음/재생 불가 — onDone 가드로 진행 */ }
  });

  useEffect(() => {
    if (!visible || !enabled) return;
    fade.setValue(1);
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      // 문이 다 열린 뒤 짧게 골드 페이드아웃 → 풀이 공개
      Animated.timing(fade, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => onDone());
    };
    const sub = player.addListener('playToEnd', finish);        // 영상 끝나면 종료
    const guard = setTimeout(finish, 7500);                     // 안전장치: 이벤트 누락/재생 실패 시 강제 종료(영상 6.5초 + 여유)
    return () => { try { sub.remove(); } catch { /* noop */ } clearTimeout(guard); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // ★풀이영상 OFF → 문열림 연출 생략하고 즉시 공개(부모 doorPlaying 정리 → 풀이 바로 드러남·기능 영향 0).
  useEffect(() => { if (visible && !enabled) onDone(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [visible, enabled]);

  if (!visible || !enabled) return null;
  return (
    <Modal visible transparent statusBarTranslucent>
      {/* 미드나잇 배경(영상 로드 전 밝은 플래시 방지) + 문 영상(cover) */}
      <Animated.View style={[styles.overlay, { opacity: fade }]}>
        <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#0B0A1A' }, // 미드나잇(영상 톤과 동일 — 레터박스/로드 전 플래시 방지)
});
