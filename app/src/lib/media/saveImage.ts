// app/src/lib/media/saveImage.ts — 만든 이미지를 **기기에 남긴다** (웹=파일 / 앱=사진첩)
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-08-31: *"캡쳐해서 이미지로 만들어서 웹은 따로 파일저장 앱은 사진첩에 넣을수 있게"*
//
// ■ ★두 면의 «남긴다» 가 다른 일이다
//   · 웹  = 브라우저 다운로드(파일). 사진첩이라는 개념이 없다.
//   · 앱  = 사진첩(MediaLibrary). 파일로 떨구면 사용자가 찾지 못한다.
//   같은 함수 하나로 감싸되 **안에서 갈라 준다** — 부르는 쪽이 플랫폼을 몰라도 되게.
//
// ■ ⚠️앱은 **권한**이 필요하다. 거부하면 조용히 실패하지 않고 «왜 안 됐는지» 를 돌려준다 —
//   저장이 안 됐는데 «저장했어요» 라고 말하는 것이 가장 나쁘다.
//
// ■ ⚠️네이티브 모듈이라 **빌드에 들어가야** 동작한다(vc131 이 `ExpoImagePicker` 없이 나간 적이 있다).
//   `check:nativedeps` 가 Podfile.lock 과 대조해 그 사고를 막는다.
// ═══════════════════════════════════════════════════════════════════════════
import { Platform } from 'react-native';

/** 저장 결과 — 실패는 **이유와 함께** 돌려준다(조용한 실패 금지). */
export type SaveResult =
  | { ok: true }
  | { ok: false; reason: 'permission' | 'unsupported' | 'failed'; message: string };

/**
 * 캡처한 이미지를 기기에 남긴다.
 *
 * @param uri  `captureRef` 가 준 것 — 네이티브는 파일 경로(`file://…`), 웹은 data URI
 * @param name 파일 이름(확장자 없이). 웹 다운로드 이름에 쓰인다
 */
export async function saveImageToDevice(uri: string, name: string): Promise<SaveResult> {
  if (!uri) return { ok: false, reason: 'failed', message: '이미지를 만들지 못했어요.' };

  // ── 웹 — 브라우저 다운로드 ───────────────────────────────────────────────
  if (Platform.OS === 'web') {
    try {
      const doc = (globalThis as any).document;
      if (!doc) return { ok: false, reason: 'unsupported', message: '이 브라우저에서는 저장할 수 없어요.' };
      // ★data URI 를 그대로 href 에 걸지 않고 **Blob 으로** 바꾼다 —
      //   긴 data URI 는 일부 브라우저에서 잘리거나 막힌다.
      const blob = await (await fetch(uri)).blob();
      const url = URL.createObjectURL(blob);
      const a = doc.createElement('a');
      a.href = url;
      a.download = `${name}.jpg`;
      doc.body.appendChild(a);
      a.click();
      a.remove();
      // ⚠️바로 지우면 다운로드가 시작되기 전에 사라질 수 있다 — 한 박자 뒤에 회수한다
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      return { ok: true };
    } catch (e) {
      return { ok: false, reason: 'failed', message: '파일로 저장하지 못했어요.' };
    }
  }

  // ── 앱 — 사진첩 ─────────────────────────────────────────────────────────
  try {
    // ★지연 로드 — 웹 번들에 네이티브 모듈이 섞이지 않게(웹에서는 위에서 이미 돌아왔다)
    const MediaLibrary = require('expo-media-library');
    /**
     * ⚠️★**쓰기 전용**으로 요청한다(2026-08-31).
     *
     * ■ 우리는 앨범을 **읽지 않는다** — 고르기는 시스템 포토피커(`expo-image-picker`)가 하고,
     *   여기서는 만든 이미지를 **넣기만** 한다.
     * ■ ★이 인자 하나가 매니페스트를 바꾼다: 라이브러리는 요청 목록을 만들 때
     *   `hasManifestPermission` 으로 **매니페스트를 먼저 본다**(`MediaLibraryModule.getManifestPermissions`).
     *   `writeOnly=true` + Android 13+ 면 요청 목록이 **비고**, 저장은 MediaStore 라 권한이 필요 없다.
     *   ⇒ 그래서 `READ_MEDIA_*` 를 매니페스트에서 뺄 수 있다 —
     *     그 권한이 Play 의 **「사진 및 동영상」 선언**을 강제해 커밋이 403 으로 막혔다.
     * ■ Android 12 이하는 `WRITE_EXTERNAL_STORAGE`(maxSdk 28)로 종전대로 동작한다.
     */
    const perm = await MediaLibrary.requestPermissionsAsync(true);
    if (!perm?.granted) {
      return { ok: false, reason: 'permission', message: '사진첩에 저장하려면 권한이 필요해요.' };
    }
    await MediaLibrary.saveToLibraryAsync(uri);
    return { ok: true };
  } catch (e) {
    // 모듈이 빌드에 없을 때도 여기로 온다 — «준비 중» 이 아니라 실패로 알린다
    return { ok: false, reason: 'failed', message: '사진첩에 저장하지 못했어요.' };
  }
}
