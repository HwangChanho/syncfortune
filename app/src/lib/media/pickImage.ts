// app/src/lib/media/pickImage.ts — **폰에서 사진 고르기** (Boss 2026-08-28 *"ios는 왜 사진 바꾸기가 안되지"*)
// ═══════════════════════════════════════════════════════════════════════════
// ■ 왜 없었나 — 버그가 아니라 **없는 기능**이었다
//   프로필·배경·커뮤니티·대화방 사진이 전부 `<input type="file">`(웹 전용)이었고,
//   코드 주석에도 *"모바일은 expo-image-picker 가 붙은 뒤에 지원한다"* 라고 적혀 있었다.
//   ⇒ 이번에 `expo-image-picker` 를 넣고, 고르는 길을 **한 곳**으로 만든다.
//
// ■ ★왜 Blob 이 아니라 **바이트**를 돌려주나
//   React Native 의 `fetch(file://…).blob()` 은 런타임·버전마다 되기도 하고 안 되기도 한다
//   (Hermes 에서 `arrayBuffer()` 가 없던 시기도 있다). 조용히 빈 파일이 올라가는 사고가 나기 쉽다.
//   picker 가 주는 **base64** 를 직접 바이트로 바꿔 올린다 — 런타임에 기대지 않는 길이다.
//   Supabase Storage 는 `Uint8Array` 업로드를 그대로 받는다.
//
// ■ ⚠️네이티브 모듈이다 — **재빌드 전 빌드에는 없다.** lazy require 로 감싸고, 없으면 null.
//   (프로젝트 관용: ads.ts·notifications.ts 와 같은 방식)
// ═══════════════════════════════════════════════════════════════════════════
import { Platform } from 'react-native';

// 네이티브 모듈 lazy require — 미포함 빌드에서 import-time 크래시 방지.
let Picker: any = null;
try { Picker = require('expo-image-picker'); } catch { Picker = null; }

/** 고른 사진 한 장. `data` 는 Storage 가 그대로 받는 형태다. */
export type PickedImage = { data: Uint8Array; type: string; size: number };

export const canPickImage = Platform.OS !== 'web' && !!Picker;


/**
 * 앨범에서 **자르기 전 원본**의 경로만 받아 온다 — 자르기는 우리 `CropSheet` 가 한다.
 *
 * ⚠️★`allowsEditing` 을 **끈다.** iOS 의 그 편집기는 **언제나 정사각형**이라
 *   9:16 배경 칸과 맞지 않는다(`aspect` 는 안드로이드에서만 먹는다).
 *   그래서 배경 사진이 «너무 확대돼» 보였다(Boss 2026-08-31).
 * ⚠️여기서는 `quality` 를 낮추지 않는다 — **자른 뒤에** 줄인다. 미리 줄이면
 *   확대했을 때 뭉개진 그림을 저장하게 된다.
 *
 * @returns 원본 경로 · 취소는 `null`
 * ⚠️★**실패는 던진다**(2026-09-03) — 종전엔 무엇이 잘못돼도 `null` 이라
 *   화면에서는 «취소했다» 와 «모듈이 없다» 와 «권한을 거부했다» 가 **전부 똑같아 보였다.**
 *   Boss 가 *"모바일 아직도 사진 누르면 안보여"* 라고 했을 때 원인을 못 갈랐던 이유가 이것이다.
 *   ⇒ 취소만 `null`, 나머지는 **사유를 담아 던진다.** 호출부가 그 말을 사람에게 보여 준다.
 */
export class PickError extends Error {
  constructor(public reason: 'no_module' | 'no_permission' | 'failed', message: string) {
    super(message);
    this.name = 'PickError';
  }
}

export async function pickImageUri(): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  // ★모듈이 없다 — «버튼은 있는데 아무 일도 안 나는» 상태의 진짜 이유다
  if (!Picker) throw new PickError('no_module', '이 버전에는 사진 고르기가 아직 없어요. 앱을 업데이트해 주세요.');
  let perm: { granted?: boolean } | null = null;
  try {
    perm = await Picker.requestMediaLibraryPermissionsAsync();
  } catch (e) {
    // 네이티브가 안 붙어 있으면 여기서 터진다 — 그것도 «모듈 없음» 이다
    throw new PickError('no_module', '이 버전에는 사진 고르기가 아직 없어요. 앱을 업데이트해 주세요.');
  }
  if (!perm?.granted) throw new PickError('no_permission', '사진 접근이 꺼져 있어요. 설정에서 사진 권한을 켜 주세요.');
  try {
    const r = await Picker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,   // ★자르기는 우리가 한다(위 주석)
      quality: 1,
      exif: false,            // ⚠️위치 정보가 사진에 붙어 나가지 않게
    });
    if (r?.canceled) return null;              // ★취소만 조용하다
    const uri = r?.assets?.[0]?.uri;
    if (!uri) throw new PickError('failed', '사진을 불러오지 못했어요. 다시 시도해 주세요.');
    return uri;
  } catch (e) {
    if (e instanceof PickError) throw e;
    throw new PickError('failed', '사진을 불러오지 못했어요. 다시 시도해 주세요.');
  }
}

/** 잘라 낸 파일(`file://…`)을 바이트로 읽는다 — 업로드는 바이트를 받는다. */
export async function bytesOfUri(uri: string): Promise<PickedImage | null> {
  try {
    const res = await fetch(uri);
    const buf = await res.arrayBuffer();
    const data = new Uint8Array(buf);
    return { data, type: 'image/jpeg', size: data.byteLength };
  } catch {
    return null;
  }
}
