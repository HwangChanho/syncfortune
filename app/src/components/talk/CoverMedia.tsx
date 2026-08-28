/**
 * app/src/components/talk/CoverMedia.tsx — 배경 한 장: **사진이든 영상이든**
 * ═════════════════════════════════════════════════════════════════════════
 * Boss 2026-08-26 *"배경화면은 5초 이하의 영상도 올릴수 있게하고
 *   선생님들은 배경화면은 영상으로 놓자"*
 *
 * ■ 판정은 **확장자**로 한다
 *   DB `consultants.cover` 는 경로 하나뿐이다. 컬럼을 더 만들면 «사진인가 영상인가» 가
 *   두 곳에서 갈린다 — 경로가 이미 답을 갖고 있으니 그걸 쓴다.
 *
 * ■ ⚠️★RN `Modal` 안에서는 쓰면 안 된다
 *   iOS 에서 `VideoView` 가 Modal 안에 있으면 **소리만 남고 화면이 안 뜬다**
 *   (2026-07-15 실물 사고 · `UnlockOverlay` 주석). 배경 영상을 쓰려면 부모가 Modal 이면 안 된다.
 *
 * ■ 자동재생 조건
 *   **무음 + 반복**이어야 브라우저·OS 가 막지 않는다. 소리 있는 배경은 애초에 잘못이다.
 */
import { createElement, useEffect, useMemo, useRef } from 'react';
import { View, StyleSheet, Platform, type StyleProp, type ViewStyle } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';

/** 이 주소가 영상인가 — 확장자로 본다(쿼리스트링은 떼고). */
export function isVideoUri(uri?: string | null): boolean {
  if (!uri) return false;
  const path = String(uri).split('?')[0].toLowerCase();
  return /\.(mp4|webm|mov|m4v)$/.test(path);
}

/**
 * @param uri   사진 또는 영상 주소. 없으면 아무것도 그리지 않는다(부모의 색면이 보인다)
 * @param style 채울 자리
 */
export function CoverMedia({ uri, style, fit = 'cover' }: {
  uri?: string | null;
  style?: StyleProp<ViewStyle>;
  /**
   * ★배경으로 깔 때는 `cover`(칸을 채우고 넘치는 쪽을 자른다), **전체 보기**에서는 `contain`
   *   (자르지 않고 다 보여 준다 — 거기는 «전부를 보러 온 자리» 다 · `PhotoViewer` 와 같은 규칙).
   */
  fit?: 'cover' | 'contain';
}) {
  const video = isVideoUri(uri);
  // ★훅은 **조건부로 부르면 안 된다** — 영상이 아니어도 만들어 두고 쓰지 않는다.
  //   (조건부로 부르면 사진↔영상이 바뀔 때 훅 개수가 달라져 화면이 통째로 죽는다 · React #310)
  const source = useMemo(() => (video && uri ? { uri } : null), [video, uri]);
  const player = useVideoPlayer(source, (p) => {
    p.loop = true;
    p.muted = true;        // ★무음이어야 자동재생이 막히지 않는다
    if (source) p.play();
  });

  /**
   * ★★웹은 **브라우저 `<video>` 로 직접** 그린다 (Boss 2026-08-28
   *   *"프로필 사진이랑 프로필 영상이 안나오고 검은 배경만 나와"*).
   *
   * ■ ⚠️실측(브라우저에서 직접 잼): `VideoView` 가 만든 `<video>` 가
   *   **300×150**(브라우저 기본 크기) · `readyState: 0` · `paused: true` 였다.
   *   = 스타일도 안 먹고 로드도 안 됐다 ⇒ 화면에는 **검은 기본 박스**만 남는다.
   * ■ ★웹에서는 `<video>` 하나면 충분하다 — 자동재생 조건(muted·playsInline)만 맞추면 된다.
   *   ⚠️`muted` 는 **속성으로 주면 브라우저가 무시한다**(React 의 알려진 함정) → ref 로 프로퍼티를 켠다.
   *     안 켜면 자동재생이 정책에 막혀 **첫 프레임도 안 뜬다**(= 검은 화면).
   * ■ ★네이티브는 그대로 `VideoView` 다 — iOS 의 Modal 안 재생 문제 때문에 손대지 않는다.
   */
  const webVideo = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    const v = webVideo.current;
    if (!v) return;
    v.muted = true;                       // ⚠️속성이 아니라 **프로퍼티**여야 먹는다
    v.playsInline = true;
    v.play?.().catch(() => { /* 정책에 막히면 첫 프레임만 보인다 — 검은 화면보다는 낫다 */ });
  }, [uri]);

  if (!uri) return null;
  if (video) {
    if (Platform.OS === 'web') {
      return (
        <View style={[styles.fill, style]} pointerEvents="none">
          {createElement('video', {
            ref: webVideo,
            src: uri,
            autoPlay: true, loop: true, muted: true, playsInline: true, preload: 'auto',
            // ⚠️`position:absolute` 를 직접 준다 — RN 스타일이 안 먹는 태그라 여기서 채운다
            style: {
              position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
              objectFit: fit === 'contain' ? 'contain' : 'cover',
            },
          })}
        </View>
      );
    }
    return (
      <View style={[styles.fill, style]} pointerEvents="none">
        <VideoView
          style={StyleSheet.absoluteFill}
          player={player}
          contentFit={fit}
          nativeControls={false}
          allowsPictureInPicture={false}
        />
      </View>
    );
  }
  // ⚠️ExpoImage 는 ImageStyle 을 받는다 — ViewStyle 을 그대로 넘기면 타입이 안 맞는다.
  //   자리 잡기는 바깥 View 가 하고, 이미지는 그 안을 채우게 둔다.
  return (
    <View style={[styles.fill, style]} pointerEvents="none">
      <ExpoImage source={{ uri }} style={StyleSheet.absoluteFill} contentFit={fit} transition={160} />
    </View>
  );
}

const styles = StyleSheet.create({ fill: { ...StyleSheet.absoluteFillObject } });
