// app/src/lib/ui/remoteAsset.ts — 콘텐츠 이미지를 **서버에서 받아온다**(daniel 2026-08-01)
// ─────────────────────────────────────────────────────────────────────────
// 왜: 앱이 무겁고 느리다(갤럭시). 실측 결과 AAB 113MB 중 이미지가 37MB였고,
//   더 큰 문제는 용량이 아니라 **디코딩**이었다 — RN `Image` 는 뷰 크기와 무관하게 원본을 통째로
//   비트맵으로 만든다. 832×1216 한 장이 고밀도 기기에서 수십 MB 를 먹는다.
//   → 이미지를 번들에서 걷어내 Storage 로 옮기고, 그리는 쪽은 `expo-image` 로 통일한다
//     (뷰 크기에 맞춰 다운샘플 + 디스크 캐시).
//
// 동작:
//   · 첫 로드만 네트워크. 이후는 expo-image 가 **디스크에 캐시**해 로컬과 동일하다.
//   · 경로는 번들에 있던 상대경로 그대로 쓴다 — `A('icons/love-hero.jpg')`.
//     즉 `A('icons/love-hero.jpg')` 를 `A('icons/love-hero.jpg')` 로 바꾸면 끝이다.
//
// ⚠️번들에 남겨야 하는 것(네트워크 전에 떠야 한다):
//   · `assets/icon.png` — 앱 아이콘(app.json 이 참조·require 아님)
//   · `assets/splash-bg.png` — 스플래시(첫 프레임)
//   · `assets/contentvideos/*.mp4` — 로딩 영상(스트리밍 캐시가 이미지만큼 단순하지 않다)
//   이 셋은 `require()` 를 그대로 둔다.
// ─────────────────────────────────────────────────────────────────────────
import { Image as ExpoImage } from 'expo-image'; // 프리페치·디스크 캐시(정적 import — 동적 import 는 이 tsconfig 에서 불가)
import { SUPABASE_URL } from '../supabase';

/** Storage 공개 버킷의 이미지 루트. 버킷 `assets`, 접두사 `img/`. */
const BASE = `${SUPABASE_URL}/storage/v1/object/public/assets/img/`;

/** expo-image / RN Image 가 그대로 받는 source 객체 타입. */
export type RemoteSource = { uri: string };

/**
 * 번들 상대경로 → 원격 이미지 source.
 * @param path `assets/` 아래의 경로. 예) `'icons/love-hero.jpg'` · `'tarot/m03.jpg'`
 * @returns `{ uri }` — `<Image source={A('...')} />` 로 바로 쓴다.
 *
 * ★왜 문자열 키가 아니라 경로인가: 번들 시절 `A('icons/x.jpg')` 와
 *   **1:1로 대응**시켜 기계적으로 치환·검증할 수 있게 하려고. 새 키 체계를 만들면 그 표가 또 어긋난다.
 */
export function A(path: string): RemoteSource {
  return { uri: BASE + path.replace(/^\/+/, '') };
}

/** 프리페치용 — 화면 진입 전에 미리 받아 둘 때(옵션). 실패는 무시(다음 렌더에서 다시 받는다). */
export async function prefetchRemote(paths: string[]): Promise<void> {
  await Promise.all(paths.map((p) => ExpoImage.prefetch(BASE + p).catch(() => {})));
}
