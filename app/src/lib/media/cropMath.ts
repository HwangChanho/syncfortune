// app/src/lib/media/cropMath.ts — 화면의 변형을 **원본 픽셀**로 되돌리는 셈
// ═══════════════════════════════════════════════════════════════════════════
// ★UI 에서 **떼어 냈다.** 이 셈이 틀리면 저장된 사진이 엉뚱하게 잘리는데
//   **아무 오류도 안 난다** — 사람이 눈으로 보고 «이상한데?» 할 때까지 조용하다.
//   ⇒ react-native 를 안 물리는 순수 함수로 두어 **하네스가 숫자로 검증**하게 한다
//     (`npx tsx scripts/check-crop.ts --selftest`).
// ═══════════════════════════════════════════════════════════════════════════

/** 자를 때 필요한 값 한 벌. 길이는 전부 **화면 픽셀**, `iw/ih` 만 원본 픽셀이다. */
export type CropInput = {
  iw: number; ih: number;   // 원본 크기
  fw: number; fh: number;   // 칸 크기(화면)
  base: number;             // 칸을 꼭 채우는 기본 배율(cover)
  scale: number;            // 사용자가 더 키운 배율
  tx: number; ty: number;   // 사용자가 끌어 옮긴 양(화면)
};

export type CropRect = { originX: number; originY: number; width: number; height: number };

/** 칸을 꼭 채우는 기본 배율 — `cover` 와 같은 규칙(둘 중 **큰** 쪽). */
export function coverBase(iw: number, ih: number, fw: number, fh: number): number {
  if (!iw || !ih) return 1;
  return Math.max(fw / iw, fh / ih);
}

/** 사진이 칸 밖으로 밀려 **빈 곳이 보이지 않는** 이동 한계. */
export function panLimits(i: Omit<CropInput, 'tx' | 'ty'>): { maxX: number; maxY: number } {
  const e = i.base * i.scale;
  return {
    maxX: Math.max(0, (i.iw * e - i.fw) / 2),
    maxY: Math.max(0, (i.ih * e - i.fh) / 2),
  };
}

/**
 * **칸 안에 보이는 만큼**을 원본 픽셀 사각형으로 되돌린다.
 *
 * 셈의 뼈대 — 사진은 칸 **가운데**를 기준으로 그려지고 `tx/ty` 만큼 밀린다.
 *   1. 실제 배율 `e = base × scale`
 *   2. 그려진 크기 `dispW = iw × e`
 *   3. 칸의 좌상단이 그림 안에서 어디인가: `left = (dispW − fw)/2 − tx`
 *   4. 원본 픽셀로: `originX = left / e`, `width = fw / e`
 *   5. ★마지막에 **원본 밖으로 못 나가게 가둔다** — 넘치면 네이티브가 던진다
 *
 * @returns 정수 픽셀 사각형(`ImageManipulator.crop` 에 그대로 넣는다)
 */
export function cropRect(i: CropInput): CropRect {
  const e = i.base * i.scale;
  if (!i.iw || !i.ih || !e) return { originX: 0, originY: 0, width: 0, height: 0 };

  const width = Math.min(i.iw, Math.max(1, Math.round(i.fw / e)));
  const height = Math.min(i.ih, Math.max(1, Math.round(i.fh / e)));
  const left = (i.iw * e - i.fw) / 2 - i.tx;
  const top = (i.ih * e - i.fh) / 2 - i.ty;

  return {
    originX: Math.max(0, Math.min(i.iw - width, Math.round(left / e))),
    originY: Math.max(0, Math.min(i.ih - height, Math.round(top / e))),
    width,
    height,
  };
}
