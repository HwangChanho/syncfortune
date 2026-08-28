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

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * base64 → 바이트.
 * ★`atob` 에 기대지 않는다 — Hermes 에 있다는 보장이 없고, 없으면 **조용히** 실패한다.
 * @param b64 순수 base64(데이터 URL 접두사는 붙어 있지 않다고 본다)
 */
function bytesOf(b64: string): Uint8Array {
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, '');
  const pad = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4) - pad);
  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const n = (B64.indexOf(clean[i]) << 18) | (B64.indexOf(clean[i + 1]) << 12)
      | ((B64.indexOf(clean[i + 2]) & 63) << 6) | (B64.indexOf(clean[i + 3]) & 63);
    if (o < out.length) out[o++] = (n >> 16) & 255;
    if (o < out.length) out[o++] = (n >> 8) & 255;
    if (o < out.length) out[o++] = n & 255;
  }
  return out;
}

/**
 * 앨범에서 사진 한 장을 고른다(폰 전용).
 *
 * @param opts.square true 면 정사각 잘라내기(프로필 사진). 배경은 자유 비율.
 * @returns 고른 사진 · 취소하거나 권한이 없으면 `null`
 *
 * ★용량은 **부르는 쪽이 판정**한다 — 화면마다 상한이 다르고(사진 2MB), 문구도 화면 몫이다.
 * ⚠️`quality` 를 낮춰 **미리 줄인다** — 요즘 폰 원본은 5~10MB라 그대로 올리면 상한에 걸린다.
 */
export async function pickImage(opts?: { square?: boolean }): Promise<PickedImage | null> {
  if (Platform.OS === 'web' || !Picker) return null;   // 웹은 <input type="file"> 을 그대로 쓴다
  try {
    const perm = await Picker.requestMediaLibraryPermissionsAsync();
    if (!perm?.granted) return null;                   // 거부 = 조용히 접는다(부르는 쪽이 안내)
    const r = await Picker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: opts?.square ? [1, 1] : undefined,
      quality: 0.7,          // 원본 그대로면 상한(2MB)에 자주 걸린다
      base64: true,          // ★바이트를 직접 받는다(위 주석 참고)
      exif: false,           // ⚠️위치 정보가 사진에 붙어 나가지 않게
    });
    if (r?.canceled) return null;
    const a = r?.assets?.[0];
    if (!a?.base64) return null;
    const data = bytesOf(String(a.base64));
    const type = String(a.mimeType || 'image/jpeg');
    return { data, type, size: data.byteLength };
  } catch {
    return null;   // 권한 창을 닫았거나 모듈이 없는 빌드 — 화면을 막지 않는다
  }
}

/** 이 빌드에서 폰 사진 고르기가 되는가(버튼을 보일지 정할 때). */
export const canPickImage = Platform.OS !== 'web' && !!Picker;
