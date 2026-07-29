// app/src/lib/ui/textLineHeight.ts — 전역 최소 줄간격 보정(Text 렌더 훅)
// ─────────────────────────────────────────────────────────────────────────
// daniel 2026-07-28: "전반적으로 글자가 클때 줄간 간격이 너무 좁아"
//
// ★왜 전역인가(432곳을 고치지 않는 이유):
//   실측 — 앱에 `fontSize: fs(...)` 가 **432곳**, 그중 같은 스타일에 lineHeight 가 없는 곳이 **291곳**.
//   게다가 테마 프리셋(font.body/caption/title…)에도 lineHeight 가 **아예 없다**.
//   → 대부분의 텍스트가 RN 기본 줄높이(대략 1.2배)로 그려진다. 한글은 이 배율이면
//     글자가 커질수록 줄이 서로 붙어 읽기 어려워진다(daniel 체감 그대로).
//   291곳을 일일이 고치면 ①오늘 고쳐도 내일 새로 추가되는 화면이 또 좁고
//   ②사람이 짝(fontSize↔lineHeight)을 매번 기억해야 한다. **한 곳에서 바닥을 깔아 두는 편이 낫다.**
//
// ★같은 유형의 사고를 이미 겪었다: '오늘의 기운' 카드에서 fontSize 는 fs() 로 키우고
//   lineHeight 는 17 로 고정해 둬서 큰 글자에서 위아래가 잘렸다. 그건 짝이 어긋난 경우고,
//   여기는 짝이 아예 없는 경우다. 둘 다 이 보정이 덮는다.
//
// 동작(보수적):
//   · **줄이 감기는 텍스트에만** 적용 — numberOfLines === 1 이면 건드리지 않는다.
//     한 줄짜리 배지·칩·버튼 라벨은 줄간격과 무관한데 높이만 늘어나 레이아웃이 틀어질 수 있다.
//   · 이미 넉넉한 lineHeight 가 지정돼 있으면 **그대로 존중**한다(디자인 의도 보존).
//     명백히 좁을 때(비율 < 1.15)와 아예 없을 때만 바닥값을 깐다.
//   · 글자 크기대별 비율 — 큰 제목까지 1.5 를 주면 오히려 떠 보인다.
//       ~18px: 1.5  /  19~23px: 1.38  /  24px~: 1.25
// ─────────────────────────────────────────────────────────────────────────
import { Text, StyleSheet } from 'react-native';
import { resolveLineHeight } from './lineHeightRule';   // ★판정은 순수 모듈에(하네스가 런타임 없이 검증)
import { getFontScale } from './fontScale';             // ★전역 글자 배율(단일 출처 · 훅 밖에서 읽는다)

let installed = false;

/**
 * 전역 최소 줄간격 보정을 설치한다. 앱 루트에서 **한 번만** 호출.
 * ⚠️RN 내부 `Text.render` 를 감싸는 방식이라 재호출 시 중첩되면 안 된다(installed 가드).
 */
export function installMinLineHeight(): void {
  if (installed) return;
  installed = true;

  const TextAny = Text as any;
  const original = TextAny.render;
  if (typeof original !== 'function') return;   // RN 내부 구조 변경 시 조용히 무시(크래시 방지)

  TextAny.render = function patchedRender(props: any, ref: any) {
    const scale = getFontScale();
    const flat = StyleSheet.flatten(props?.style) as { fontSize?: number; lineHeight?: number } | undefined;

    // ★★글자 배율을 **모든 텍스트에** 적용한다(daniel 2026-07-29
    //   "글씨크기가 ui랑 전부다 반영돼야해" · "전체 다 자동반영되게 코드구조를 미리 모듈화").
    //   실측: 앱에 고정 `fontSize: 13` 같은 곳이 **670건**, `fs()` 를 쓰는 곳이 440건이었다.
    //   즉 60% 가 설정을 무시했다 — 그래서 "최대인데도 작다"가 나온다.
    //   670건을 일일이 고치는 대신 **여기 한 곳**에서 곱한다. 새 화면이 생겨도 자동으로 따라온다.
    //   ⚠️fs() 는 같은 개편에서 **항등 함수**가 됐다(이중 적용 방지).
    //   ⚠️fontSize 가 없는 텍스트(RN 기본 14)는 건드리지 않는다 — 기본값을 임의로 키우면
    //     서드파티/시스템 컴포넌트 레이아웃까지 흔든다. 명시된 크기만 존중해 키운다.
    const size = typeof flat?.fontSize === 'number' ? flat.fontSize : undefined;
    const scaled = size != null && scale !== 1 ? Math.round(size * scale) : undefined;

    // 줄간격은 **스케일된 크기 기준**으로 판정해야 정합이 맞는다(키운 글자에 옛 줄높이면 잘린다).
    const baseLh = typeof flat?.lineHeight === 'number' && scale !== 1
      ? Math.round(flat.lineHeight * scale)      // 지정돼 있으면 같은 비율로 함께 키운다
      : flat?.lineHeight;
    const nextLh = resolveLineHeight(scaled ?? size, baseLh, props?.numberOfLines);

    if (scaled == null && nextLh == null) return original.call(this, props, ref);
    const patch: { fontSize?: number; lineHeight?: number } = {};
    if (scaled != null) patch.fontSize = scaled;
    if (nextLh != null) patch.lineHeight = nextLh;
    else if (baseLh != null && baseLh !== flat?.lineHeight) patch.lineHeight = baseLh;
    return original.call(this, { ...props, style: [props?.style, patch] }, ref);
  };
}
