// app/src/components/talk/ProfileSheet.tsx — 카카오톡식 **프로필 창**
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-08-26 *"사진 클릭하면 배경이미지 사진이미지 있는창 나오고 …"* ·
//   *"기본 프로필이 프로필 클릭하면 나오게 하자"* ·
//   *"배경화면은 5초 이하의 영상도 올릴수 있게하고 선생님들은 배경화면은 영상으로 놓자"*
//
// ■ ⚠️★**RN `Modal` 을 쓰지 않는다**(2026-08-26 전환)
//   iOS 에서 `VideoView` 가 Modal 안에 있으면 **소리만 남고 화면이 안 뜬다**
//   (2026-07-15 실물 사고 · `UnlockOverlay` 주석에 남아 있다).
//   배경을 영상으로 두려면 Modal 밖이어야 한다 ⇒ **전체를 덮는 View** 로 그린다.
//   그래서 이 컴포넌트는 **화면 루트에서만** 그려야 한다 — 칸(pane) 안에서 그리면
//   `absoluteFill` 이 그 칸을 채우고 창이 갇힌다([[overlay-absolutefill-parent]]).
//
// ■ ⚠️★배경이 **거의 전체 화면**인 이유
//   Boss 지시로 배경은 **전신(발끝까지) 9:16** 이다. 종전처럼 «폭의 52%» 짜리 띠에 넣으면
//   위아래가 잘려 **발이 날아간다** — 맨발로 찍은 뜻이 통째로 사라진다.
//   ⇒ 카카오톡처럼 배경이 화면을 채우고, 이름·버튼이 **그 위에** 앉는다.
//   ★넓은 웹에서는 폭을 묶는다(420) — 안 묶으면 9:16 이 가로로 늘어나 또 잘린다.
//
// ■ 두 겹은 그대로
//   ①프로필 창(여기) ②전체 보기(`PhotoViewer`) — 사진을 누르면 한 장만 크게.
//   ⚠️영상 배경은 전체 보기로 넘기지 않는다(이미 화면을 채우고 있다).
// ═══════════════════════════════════════════════════════════════════════════
import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Linking, useWindowDimensions } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { PressableScale } from '../PressableScale';
import { PhotoViewer } from './PhotoViewer';
import { CoverMedia, isVideoUri } from './CoverMedia';
import { colors, space, radius, font } from '../../lib/theme';
import { elementColor, elementText } from '../../lib/engine/ohaeng';

export type ProfileTarget = {
  name: string;
  tagline?: string | null;
  avatar?: string | null;
  /** 배경 — **사진 또는 5초 이하 영상**(확장자로 가른다) */
  cover?: string | null;
  linkUrl?: string | null;
  linkLabel?: string | null;
  /** 사진이 없을 때 채울 오행(목록이 쓰던 값과 같아야 얼굴색이 안 바뀐다) */
  element?: string;
  /** ★기본 프로필 — 나이(Boss 2026-08-26). 없으면 그 줄을 안 그린다 */
  age?: number | null;
  /** 선생님 AI / 함께하면 좋은 친구 */
  group?: 'teacher' | 'friend';
  /** 「대화하기」를 눌렀을 때. 없으면 그 버튼을 안 그린다(이미 그 방에 있는 경우) */
  onTalk?: () => void;
  /** 「꾸미기」 — 내 프로필일 때만 준다(설정으로 보낸다) */
  onEdit?: () => void;
};

/**
 * @param target 보여 줄 사람. null 이면 닫힘
 * @param onClose 닫기
 */
export function ProfileSheet({ target, onClose }: { target: ProfileTarget | null; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  const [photo, setPhoto] = useState<{ uri: string; cap: string } | null>(null);
  if (!target) return null;
  const el = target.element ?? '木';
  // ★9:16 을 지키려고 폭을 묶는다. 넓은 웹에서 가로로 늘리면 전신이 또 잘린다.
  const panelW = Math.min(width, Math.round(height * 0.62), 460);
  const av = Math.round(panelW * 0.22);
  const videoCover = isVideoUri(target.cover);

  return (
    <View style={styles.root}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={[styles.panel, { width: panelW }]}>
        {/* ── 배경 ── 화면을 채운다. 사진이면 눌러서 전체 보기 */}
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: elementColor[el] }]}
          onPress={() => { if (target.cover && !videoCover) setPhoto({ uri: target.cover, cap: target.name }); }}
        >
          <CoverMedia uri={target.cover} />
          {/* 아래를 어둡게 — 흰 글자가 밝은 배경 위에서 묻히지 않게 */}
          <View style={styles.scrim} pointerEvents="none" />
        </Pressable>

        {/* ── 닫기 ── 배경을 눌러도 닫히지만, 보이는 길이 하나 있어야 한다 */}
        <PressableScale style={styles.x} onPress={onClose} hitSlop={12}>
          <Text style={styles.xTx}>✕</Text>
        </PressableScale>

        {/* ── 아래에 얹히는 정보 ── */}
        <View style={styles.bottom} pointerEvents="box-none">
          <PressableScale onPress={() => target.avatar && setPhoto({ uri: target.avatar, cap: target.name })}>
            {target.avatar
              ? <ExpoImage source={{ uri: target.avatar }} style={[styles.av, { width: av, height: av, borderRadius: av * 0.32 }]} contentFit="cover" transition={160} />
              : (
                <View style={[styles.av, styles.center, { width: av, height: av, borderRadius: av * 0.32, backgroundColor: elementColor[el] }]}>
                  <Text style={{ color: elementText[el], fontWeight: '900', fontSize: av * 0.4 }}>{target.name.slice(0, 1)}</Text>
                </View>
              )}
          </PressableScale>

          <Text style={styles.name} numberOfLines={1}>{target.name}</Text>

          {/* ★기본 프로필 — 나이·분야·묶음을 한 줄로(Boss 2026-08-26).
              ⚠️없는 칸은 **그리지 않는다** — «— » 같은 빈 표시는 정보가 아니라 잡음이다. */}
          {(() => {
            const bits = [
              target.age != null ? `${target.age}세` : null,
              target.tagline?.trim() || null,
              target.group === 'teacher' ? '선생님 AI' : target.group === 'friend' ? '무료 친구' : null,
            ].filter(Boolean);
            return bits.length ? <Text style={styles.meta} numberOfLines={2}>{bits.join(' · ')}</Text> : null;
          })()}

          <View style={styles.actions}>
            {target.onTalk ? (
              <PressableScale style={styles.btn} onPress={() => { onClose(); target.onTalk!(); }}>
                <Text style={styles.btnTx}>대화하기</Text>
              </PressableScale>
            ) : null}
            {target.linkUrl ? (
              <PressableScale style={[styles.btn, styles.btnAlt]} onPress={() => { void Linking.openURL(target.linkUrl!); }}>
                <Text style={[styles.btnTx, styles.btnTxAlt]}>{target.linkLabel?.trim() || '채널'} ↗</Text>
              </PressableScale>
            ) : null}
            {target.onEdit ? (
              <PressableScale style={[styles.btn, styles.btnAlt]} onPress={() => { onClose(); target.onEdit!(); }}>
                <Text style={[styles.btnTx, styles.btnTxAlt]}>꾸미기</Text>
              </PressableScale>
            ) : null}
          </View>
        </View>
      </View>

      {/* ★두 번째 겹 — 사진 한 장만 크게 */}
      <PhotoViewer uri={photo?.uri ?? null} caption={photo?.cap} onClose={() => setPhoto(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  // ★Modal 이 아니라 **덮는 View** — 부모가 화면 루트여야 한다(위 머리말)
  root: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.72)', alignItems: 'center', justifyContent: 'center', zIndex: 60 },
  panel: { flex: 1, alignSelf: 'center', overflow: 'hidden' },
  // 아래 절반만 어둡게 — 배경 사진은 살리고 글자는 읽히게
  scrim: { ...StyleSheet.absoluteFillObject, top: '45%', backgroundColor: 'rgba(0,0,0,0.45)' },
  x: { position: 'absolute', top: space(5), right: space(4), width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
  xTx: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: space(7), alignItems: 'center', paddingHorizontal: space(5) },
  av: { borderWidth: 3, borderColor: 'rgba(255,255,255,0.9)' },
  center: { alignItems: 'center', justifyContent: 'center' },
  name: { ...font.title, color: '#FFFFFF', fontWeight: '900', marginTop: space(2) },
  meta: { ...font.caption, color: 'rgba(255,255,255,0.86)', textAlign: 'center', marginTop: space(1), lineHeight: 18 },
  actions: { flexDirection: 'row', gap: space(2), marginTop: space(4), flexWrap: 'wrap', justifyContent: 'center' },
  btn: { paddingVertical: space(2.5), paddingHorizontal: space(5), borderRadius: radius.pill, backgroundColor: colors.ju },
  btnAlt: { backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)' },
  btnTx: { ...font.label, color: colors.onJu, fontWeight: '800' },
  btnTxAlt: { color: '#FFFFFF' },
});
