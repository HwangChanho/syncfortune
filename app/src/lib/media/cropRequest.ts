// app/src/lib/media/cropRequest.ts — 자르기 창을 **화면 뿌리에서** 띄우기 위한 작은 창구
// ═══════════════════════════════════════════════════════════════════════════
// ■ 왜 필요했나 — **`absoluteFill` 은 부모를 채운다**(2026-08-31 웹 실측)
//   자르기 창을 `MyProfileCard` 안에서 그렸더니 **화면을 안 덮었다**:
//   뒤 폼이 비치고, 제목이 위로 잘려 나가고, 버튼이 칸 위에 겹쳤다.
//   `settings.tsx` 의 뿌리는 `ScrollView` 이고 카드는 그 **안**에 있다 —
//   ⇒ 폰에서는 더 나쁘다. 오버레이 높이가 **스크롤 내용 전체 높이**가 된다
//     (이 저장소가 이미 겪은 일 · `check:overlayroot` 가 그때 생겼다).
//
// ■ 왜 `Modal` 이 아닌가
//   ★App Store 2.1(a) 크래시가 **네이티브 모달이 겹쳐서** 났다(iOS 26.6.1 · 3건 동일).
//     이번 세션에 `BusyOverlay` 를 모달에서 빼낸 이유가 그것이다. 하나 더 들이지 않는다.
//
// ■ 어떻게 — 저장소 관용대로 **모듈 pub/sub**(`subscribeRepChange`·`premiumStore` 와 같은 결)
//   부르는 쪽은 `await requestCrop(...)` 한 줄. 그리는 쪽은 뿌리에 `<CropHost/>` 하나.
//   ⇒ 앞으로 어느 픽커가 생겨도 **자리 걱정 없이** 자르기를 얻는다.
// ═══════════════════════════════════════════════════════════════════════════

/** 자르기 한 건의 요청. */
export type CropRequest = {
  uri: string;
  /** 칸의 가로/세로 비. 프로필 1 · 배경 9/16 */
  aspect: number;
  /** 저장할 가로 픽셀 */
  outWidth: number;
};

/** 자른 결과(취소는 `null`). */
export type CropDone = { uri: string; width: number; height: number } | null;

type Pending = { req: CropRequest; resolve: (r: CropDone) => void };
type Listener = (p: Pending | null) => void;

let current: Pending | null = null;
const listeners = new Set<Listener>();

/** 호스트가 구독한다. @returns 구독 해지 함수 */
export function subscribeCrop(cb: Listener): () => void {
  listeners.add(cb);
  cb(current);              // ★늦게 붙어도 지금 열려 있는 것을 본다
  return () => { listeners.delete(cb); };
}

function emit(): void { for (const cb of [...listeners]) { try { cb(current); } catch { /* 구독자 하나가 죽어도 나머지는 산다 */ } } }

/**
 * 자르기 창을 띄우고 **결과를 기다린다.**
 *
 * ⚠️이미 열려 있으면 **새 요청을 무시하고 `null`** 을 준다 — 창을 겹쳐 띄우지 않는다
 *   (겹친 오버레이는 «취소했는데 하나가 남는» 종류의 버그를 만든다).
 *
 * @param req 자를 사진과 칸 규격
 * @returns 자른 결과. 사용자가 취소했거나 이미 열려 있으면 `null`
 */
export function requestCrop(req: CropRequest): Promise<CropDone> {
  if (current) return Promise.resolve(null);
  return new Promise<CropDone>((resolve) => {
    current = { req, resolve };
    emit();
  });
}

/** 호스트가 결과를 돌려준다(취소는 `null`). */
export function finishCrop(result: CropDone): void {
  const p = current;
  current = null;
  emit();
  p?.resolve(result);       // ★비운 **뒤에** 깨운다 — 깨어난 쪽이 곧바로 또 열 수 있게
}
