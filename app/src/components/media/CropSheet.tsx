// app/src/components/media/CropSheet.tsx — 사진을 **정해진 칸에 맞춰 잘라 낸다**
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-08-31: *"내가 등록한 프로필 사진이 너무 확대돼서 나와 … 사진 축소 확대해서
//                    그 칸에 맞춰두면 그대로 나와야해 배경사진도 동일"*
//
// ■ 왜 필요했나 — **고르는 화면과 그리는 화면의 비율이 달랐다**
//   ⚠️`expo-image-picker` 의 `allowsEditing` 은 **iOS 에서 언제나 정사각형**이다
//     (`aspect` 는 안드로이드에서만 먹는다). 그래서 9:16 배경 칸에 정사각형 사진이 들어가
//     가로가 잘리며 **확대돼** 보였다. «너무 확대돼서 나와» 의 정체가 이것이다.
//   ⇒ 자르기를 **우리가** 한다. 그리는 칸과 **같은 비율**로 미리 잘라 두면 어디서도 안 흔들린다.
//
// ■ 조작 — **끌어서 옮기고, − ＋ 로 키우고 줄인다**
//   ★핀치(두 손가락)를 쓰지 않는다. 웹에는 핀치가 없어 **한 면에서만 되는 UI** 가 되고,
//     그건 이 저장소가 오늘 여러 번 데인 «면마다 다르게 도는 것» 을 또 만드는 일이다.
//     버튼은 폰·웹에서 똑같이 돈다.
//
// ■ 좌표 셈 — 화면의 변형을 **원본 픽셀**로 되돌린다
//   칸(FW×FH)을 채우는 기본 배율 `base = max(FW/iw, FH/ih)`(cover)에 사용자 배율 `s` 를 곱한다.
//   그 위에서 칸의 좌상단이 원본의 어디인지 역산해 잘라 낸다. 마지막에 상한을 넘지 않게 **가둔다**.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, PanResponder, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import { PressableScale } from '../PressableScale';
import { colors, radius, space, font } from '../../lib/theme';
import { coverBase, panLimits, cropRect } from '../../lib/media/cropMath';

/** 확대 한계 — 1 = 칸을 꼭 채운 상태. 그 아래로는 빈 곳이 생기므로 못 내려간다. */
const MIN_SCALE = 1;
const MAX_SCALE = 4;
const STEP = 0.2;

export type CropResult = { uri: string; width: number; height: number };

/**
 * @param uri     자를 사진(앨범에서 고른 것)
 * @param aspect  칸의 가로/세로 비. 프로필 1, 배경 9/16
 * @param outWidth 잘라 낸 뒤 저장할 가로 픽셀(세로는 비율로 따라온다)
 * @param onDone  잘라 낸 결과 · @param onCancel 취소
 */
export function CropSheet({ uri, aspect, outWidth, onDone, onCancel }: {
  uri: string;
  aspect: number;
  outWidth: number;
  onDone: (r: CropResult) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const { width: winW, height: winH } = useWindowDimensions();
  const [img, setImg] = useState<{ w: number; h: number } | null>(null);
  const [busy, setBusy] = useState(false);

  // 칸 — 화면 안에 들어오는 가장 큰 크기
  const FW = Math.min(winW - space(10), 420);
  const FH = Math.min(FW / aspect, winH * 0.62);
  const frameW = FH * aspect;   // 세로에 걸렸으면 가로를 줄인다(비율은 지킨다)

  // 원본 크기를 읽는다 — 이걸 모르면 좌표를 되돌릴 수 없다
  useEffect(() => {
    let alive = true;
    Image.getSize(uri, (w, h) => { if (alive) setImg({ w, h }); }, () => { if (alive) setImg(null); });
    return () => { alive = false; };
  }, [uri]);

  const base = useMemo(() => (img ? coverBase(img.w, img.h, frameW, FH) : 1), [img, frameW, FH]);

  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const start = useRef({ x: 0, y: 0 });

  /** 사진이 칸 밖으로 밀려 **빈 곳이 보이지 않게** 가둔다. */
  const clamp = (x: number, y: number, s: number) => {
    if (!img) return { x: 0, y: 0 };
    const { maxX, maxY } = panLimits({ iw: img.w, ih: img.h, fw: frameW, fh: FH, base, scale: s });
    return { x: Math.max(-maxX, Math.min(maxX, x)), y: Math.max(-maxY, Math.min(maxY, y)) };
  };

  /**
   * ⚠️★`PanResponder` 는 **만들 때의 값을 가둔다**(클로저). `tx`·`scale` 을 직접 읽으면
   *   첫 렌더의 0·1 을 영원히 본다 — 끌면 매번 처음 자리로 튄다.
   *   ⇒ 최신 값을 **ref** 에 담아 그것만 읽는다. 그래야 responder 를 다시 만들지 않아도 된다
   *     (다시 만들면 끌던 도중에 제스처가 끊긴다).
   */
  const live = useRef({ tx: 0, ty: 0, scale: 1, base: 1, iw: 0, ih: 0, fw: 0, fh: 0 });
  live.current = { tx, ty, scale, base, iw: img?.w ?? 0, ih: img?.h ?? 0, fw: frameW, fh: FH };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => { start.current = { x: live.current.tx, y: live.current.ty }; },
      onPanResponderMove: (_e, g) => {
        const L = live.current;
        if (!L.iw) return;
        const { maxX, maxY } = panLimits({ iw: L.iw, ih: L.ih, fw: L.fw, fh: L.fh, base: L.base, scale: L.scale });
        setTx(Math.max(-maxX, Math.min(maxX, start.current.x + g.dx)));
        setTy(Math.max(-maxY, Math.min(maxY, start.current.y + g.dy)));
      },
    }),
  ).current;

  const zoom = (dir: 1 | -1) => {
    const s = Math.max(MIN_SCALE, Math.min(MAX_SCALE, +(scale + dir * STEP).toFixed(2)));
    const c = clamp(tx, ty, s);
    setScale(s); setTx(c.x); setTy(c.y);
  };

  const crop = async () => {
    if (!img || busy) return;
    setBusy(true);
    try {
      // ★셈은 `cropMath` 가 한다 — 순수 함수라 **하네스가 숫자로 검증**한다
      const r = cropRect({ iw: img.w, ih: img.h, fw: frameW, fh: FH, base, scale, tx, ty });

      const out = await ImageManipulator.manipulateAsync(
        uri,
        [{ crop: r },
         { resize: { width: Math.min(outWidth, r.width) } }],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
      );
      onDone({ uri: out.uri, width: out.width, height: out.height });
    } catch {
      onCancel();   // 자르지 못하면 조용히 접는다 — 반쯤 잘린 것을 올리지 않는다
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <Text style={styles.title}>{t('crop.title', '사진을 칸에 맞춰 주세요')}</Text>
      <Text style={styles.sub}>{t('crop.sub', '끌어서 옮기고 − ＋ 로 크기를 맞춰요. 보이는 그대로 저장돼요.')}</Text>

      {/* 칸 — 여기 보이는 만큼이 그대로 저장된다 */}
      <View style={[styles.frame, { width: frameW, height: FH }]} {...pan.panHandlers}>
        {img ? (
          <Image
            source={{ uri }}
            style={{
              width: img.w * base * scale,
              height: img.h * base * scale,
              transform: [{ translateX: tx }, { translateY: ty }],
            }}
          />
        ) : null}
      </View>

      <View style={styles.zoomRow}>
        <PressableScale style={styles.zoomBtn} onPress={() => zoom(-1)} disabled={scale <= MIN_SCALE}>
          <Text style={styles.zoomTx}>−</Text>
        </PressableScale>
        <PressableScale style={styles.zoomBtn} onPress={() => zoom(1)} disabled={scale >= MAX_SCALE}>
          <Text style={styles.zoomTx}>＋</Text>
        </PressableScale>
      </View>

      <View style={styles.actions}>
        <PressableScale style={[styles.btn, styles.btnAlt]} onPress={onCancel}>
          <Text style={[styles.btnTx, styles.btnTxAlt]}>{t('common.cancel', '취소')}</Text>
        </PressableScale>
        <PressableScale style={styles.btn} onPress={crop} disabled={!img || busy}>
          <Text style={styles.btnTx}>{busy ? t('crop.working', '자르는 중…') : t('crop.use', '이대로 쓰기')}</Text>
        </PressableScale>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', gap: space(3), zIndex: 80, padding: space(5) },
  title: { ...font.heading, color: colors.ink },
  sub: { ...font.caption, color: colors.inkFaint, textAlign: 'center' },
  // ★`overflow: hidden` 이 곧 «칸» 이다 — 밖으로 나간 부분은 안 보이고, 안 보이는 건 안 저장된다
  frame: { overflow: 'hidden', borderRadius: radius.md, backgroundColor: colors.sunk, alignItems: 'center', justifyContent: 'center' },
  zoomRow: { flexDirection: 'row', gap: space(3) },
  zoomBtn: { width: 48, height: 40, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  zoomTx: { fontSize: 20, color: colors.ink, fontWeight: '800', lineHeight: 24 },
  actions: { flexDirection: 'row', gap: space(2.5), marginTop: space(2) },
  btn: { flex: 1.4, paddingVertical: space(3.5), borderRadius: radius.md, backgroundColor: colors.ju, alignItems: 'center' },
  btnAlt: { flex: 1, backgroundColor: colors.sunk, borderWidth: 1, borderColor: colors.line },
  btnTx: { ...font.body, color: colors.onJu, fontWeight: '800' },
  btnTxAlt: { color: colors.inkSoft },
});
