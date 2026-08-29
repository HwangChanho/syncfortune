// app/src/lib/media/imageUrl.ts — **쓸 크기만큼만 받는다** (Boss 2026-08-29 *"프로필 사진 누르면 반응이 너무 느려"*)
// ═══════════════════════════════════════════════════════════════════════════
// ■ 실측이 말한 것
//   프로필 창 한 번 여는 데 **4.1MB** 를 받고 있었다 — avatar.jpg **1.4MB** + cover.jpg **2.7MB**.
//   그리는 크기는 각각 **30~100px** 과 **폭 460** 이다. 즉 폰 카메라 원본을 그대로 내려받아
//   손톱만 하게 줄여 그리고 있었다. «느리다» 의 실체가 이것이다.
//
// ■ 고치는 방법 — Supabase Storage **이미지 변환**
//   `/storage/v1/object/public/…`  →  `/storage/v1/render/image/public/…?width=…&quality=…`
//   실측: avatar 1.4MB → **2.3KB**(120px) · **124KB**(480px) / cover 2.7MB → **517KB**(1080px).
//   ⚠️추측이 아니라 이 프로젝트에서 **실제로 200 을 받아 확인**했다(무료 플랜이면 404 가 난다).
//
// ■ ★원본이 필요한 자리도 있다
//   「전체 보기」로 사진을 크게 볼 때는 줄인 것을 보여 주면 뭉개진다.
//   그래서 **되돌리는 함수**를 함께 둔다 — 별도 필드를 들고 다니면 두 값이 언젠가 갈린다.
// ═══════════════════════════════════════════════════════════════════════════

/** 공개 URL 의 «원본» 경로 조각과 «변환» 경로 조각. 한 글자만 달라 헷갈리기 쉬워 상수로 둔다. */
const OBJECT = '/storage/v1/object/public/';
const RENDER = '/storage/v1/render/image/public/';

/**
 * 그 URL 을 **그리는 크기에 맞춰** 줄여 받는다.
 *
 * @param url 공개 URL(`/object/public/…`). 이미 변환 URL 이거나 빈 값이면 그대로 돌려준다.
 * @param width 화면에 그릴 **CSS 폭의 2배**를 넣는다(레티나). 30px 썸네일이면 60~96.
 * @param quality 1~100. 사진은 70~75 면 눈으로 구분이 안 된다.
 *
 * ⚠️쿼리가 이미 있을 수 있다(`?v=` 캐시버전) — 그때는 `&` 로 잇는다.
 */
export function sizedImage(url: string | null | undefined, width: number, quality = 75): string | null {
  if (!url) return null;
  if (url.includes(RENDER)) return url;              // 이미 변환된 것
  if (!url.includes(OBJECT)) return url;             // 우리 스토리지가 아니다(원격 자산 등)
  const [base, query] = url.split('?');
  const q = `width=${Math.max(1, Math.round(width))}&quality=${quality}`;
  return base.replace(OBJECT, RENDER) + '?' + q + (query ? `&${query}` : '');
}

/**
 * 줄여 받던 URL 을 **원본**으로 되돌린다(「전체 보기」용).
 * ★줄인 URL 과 원본 URL 을 **따로 들고 다니지 않기 위해** 있다 — 두 값을 나르면 언젠가 갈린다.
 */
export function originalImage(url: string | null | undefined): string | null {
  if (!url) return null;
  if (!url.includes(RENDER)) return url;
  const [base, query] = url.split('?');
  // 캐시 버전(`v=`)만 남기고 변환 파라미터는 버린다
  const v = (query ?? '').split('&').find((p) => p.startsWith('v='));
  return base.replace(RENDER, OBJECT) + (v ? `?${v}` : '');
}
