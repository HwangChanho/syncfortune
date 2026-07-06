// app/src/components/DoorReveal.tsx — 풀이 진입(공개) 연출: 골드 명조 문이 열리는 영상
// ─────────────────────────────────────────────────────────────────────────
// daniel 2026-07-06: 풀이를 '공개(revealed)'하는 순간, 팔자 골드 명조 문이 좌우로 갈라지며
//   로딩화면(splash-bg)의 백두산 호랑이 장면이 드러나고 → 호랑이가 어흥(포효 펀치) → 한 발 물러나며
//   → 카메라가 호랑이를 따라 쭈욱 들어가(push-in) 골드로 밝아지는 영상(door-open.mp4·4.7초·
//   DrawThings 문 + 로딩 원본 켄번스 + ffmpeg 합성)을 전체화면 1회 재생 → 끝나면 페이드아웃하며 풀이 공개.
//   ★expo-video 패턴 = UnlockOverlay/VideoSplash 와 동일(신규 네이티브 의존 없음).
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useRef } from 'react';
import { Modal, Animated, StyleSheet } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';

const DOOR_VIDEO = require('../../assets/content-videos/door-open.mp4'); // 문 열림→백두산 호랑이 어흥→카메라 push-in(4.7초)

// visible=true 로 켜지면 문 영상을 1회 재생, 끝(playToEnd)나면 onDone() 호출(부모가 visible=false 로 내림).
export function DoorReveal({ visible, onDone }: { visible: boolean; onDone: () => void }) {
  const fade = useRef(new Animated.Value(1)).current; // 영상 끝 → 페이드아웃

  // 훅 규칙상 항상 호출 — visible 일 때만 소스를 넘겨 그때만 재생(꺼지면 null=정지·릴리스). 비루프(1회).
  const source = visible ? DOOR_VIDEO : null;
  const player = useVideoPlayer(source, (p) => {
    try { p.loop = false; p.muted = false; p.play(); } catch { /* 소스 없음/재생 불가 — onDone 가드로 진행 */ }
  });

  useEffect(() => {
    if (!visible) return;
    fade.setValue(1);
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      // 문이 다 열린 뒤 짧게 골드 페이드아웃 → 풀이 공개
      Animated.timing(fade, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => onDone());
    };
    const sub = player.addListener('playToEnd', finish);        // 영상 끝나면 종료
    const guard = setTimeout(finish, 5600);                     // 안전장치: 이벤트 누락/재생 실패 시 강제 종료(영상 4.7초 + 여유)
    return () => { try { sub.remove(); } catch { /* noop */ } clearTimeout(guard); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!visible) return null;
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
