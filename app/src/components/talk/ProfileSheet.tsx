// app/src/components/talk/ProfileSheet.tsx — 카카오톡식 **프로필 창**
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-08-26 *"실제 카카오톡 처럼 사진 클릭하면 배경이미지 사진이미지 있는창 나오고
//   거기서 사진 각각 클릭하면 전체 이미지로 나오게 하고 … 유저도 등록 가능하게 하고
//   각 선생님 또는 유져별로 개성있게 꾸밀수 있게"*.
//
// ■ 구조 — 카톡이 그렇듯 **두 겹**이다
//   ①프로필 창(여기) : 배경 사진 위에 프로필 사진이 걸친다. 이름·소개·채널.
//   ②전체 보기       : 배경이든 프로필이든 **누르면** `PhotoViewer` 로 한 장만 크게.
//   ⇒ 두 겹을 한 화면에 합치면 «사진을 보는 것»과 «사람을 보는 것»이 섞인다.
//
// ■ 사진이 없으면
//   배경은 그 사람의 **오행 색면**으로 채운다(빈 회색보다 그 사람 같다).
//   ★비어 있어도 창은 뜬다 — 사진이 없다고 프로필이 없는 게 아니다.
// ═══════════════════════════════════════════════════════════════════════════
import { useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, Linking, useWindowDimensions } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { PressableScale } from '../PressableScale';
import { PhotoViewer } from './PhotoViewer';
import { colors, space, radius, font } from '../../lib/theme';
import { elementColor, elementText } from '../../lib/engine/ohaeng';

export type ProfileTarget = {
  name: string;
  tagline?: string | null;
  avatar?: string | null;
  cover?: string | null;
  linkUrl?: string | null;
  linkLabel?: string | null;
  /** 사진이 없을 때 채울 오행(목록이 쓰던 값과 같아야 얼굴색이 안 바뀐다) */
  element?: string;
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
  const { width } = useWindowDimensions();
  const [photo, setPhoto] = useState<{ uri: string; cap: string } | null>(null);
  if (!target) return null;
  const el = target.element ?? '木';
  const coverH = Math.round(Math.min(width, 560) * 0.52);
  const av = Math.round(Math.min(width, 560) * 0.24);

  return (
    <Modal visible transparent statusBarTranslucent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          {/* ── 배경 사진 ── 눌러서 전체 보기 */}
          <PressableScale
            onPress={() => target.cover && setPhoto({ uri: target.cover, cap: target.name })}
            style={[styles.cover, { height: coverH, backgroundColor: elementColor[el] }]}
          >
            {target.cover ? <ExpoImage source={{ uri: target.cover }} style={StyleSheet.absoluteFill} contentFit="cover" transition={160} /> : null}
            {/* 아래를 살짝 어둡게 — 흰 이름이 밝은 사진 위에서 묻히지 않게 */}
            <View style={styles.scrim} pointerEvents="none" />
          </PressableScale>

          {/* ── 프로필 사진 ── 배경에 걸친다(카톡 배치) */}
          <View style={[styles.avWrap, { marginTop: -av / 2 }]}>
            <PressableScale onPress={() => target.avatar && setPhoto({ uri: target.avatar, cap: target.name })}>
              {target.avatar
                ? <ExpoImage source={{ uri: target.avatar }} style={[styles.av, { width: av, height: av, borderRadius: av * 0.32 }]} contentFit="cover" transition={160} />
                : (
                  <View style={[styles.av, styles.center, { width: av, height: av, borderRadius: av * 0.32, backgroundColor: elementColor[el] }]}>
                    <Text style={{ color: elementText[el], fontWeight: '900', fontSize: av * 0.4 }}>{target.name.slice(0, 1)}</Text>
                  </View>
                )}
            </PressableScale>
          </View>

          <Text style={styles.name} numberOfLines={1}>{target.name}</Text>
          {target.tagline ? <Text style={styles.tagline} numberOfLines={2}>{target.tagline}</Text> : null}

          <View style={styles.actions}>
            {target.onTalk ? (
              <PressableScale style={styles.btn} onPress={() => { onClose(); target.onTalk!(); }}>
                <Text style={styles.btnTx}>대화하기</Text>
              </PressableScale>
            ) : null}
            {/* ★채널이 있는 사람만 — 없는 사람에게 빈 버튼을 두지 않는다 */}
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

          <PressableScale style={styles.close} onPress={onClose} hitSlop={10}>
            <Text style={styles.closeTx}>닫기</Text>
          </PressableScale>
        </Pressable>
      </Pressable>

      {/* ★두 번째 겹 — 사진 한 장만 크게. 프로필 창 위에 얹힌다 */}
      <PhotoViewer uri={photo?.uri ?? null} caption={photo?.cap} onClose={() => setPhoto(null)} />
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.bg, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, overflow: 'hidden', paddingBottom: space(6), alignItems: 'center' },
  cover: { width: '100%', justifyContent: 'flex-end' },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.12)' },
  avWrap: { alignItems: 'center' },
  // 흰 테두리로 배경에서 띄운다(카톡과 같은 처리) — 어두운 배경 사진에서도 윤곽이 산다
  av: { borderWidth: 3, borderColor: colors.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  name: { ...font.title, color: colors.ink, fontWeight: '900', marginTop: space(2) },
  tagline: { ...font.caption, color: colors.inkSoft, textAlign: 'center', marginTop: space(1), paddingHorizontal: space(6), lineHeight: 18 },
  actions: { flexDirection: 'row', gap: space(2), marginTop: space(4), paddingHorizontal: space(5) },
  btn: { paddingVertical: space(2.5), paddingHorizontal: space(5), borderRadius: radius.pill, backgroundColor: colors.ju },
  btnAlt: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.juLine },
  btnTx: { ...font.label, color: colors.onJu, fontWeight: '800' },
  btnTxAlt: { color: colors.juDeep },
  close: { marginTop: space(3), paddingVertical: space(2), paddingHorizontal: space(5) },
  closeTx: { ...font.caption, color: colors.inkFaint, fontWeight: '700' },
});
