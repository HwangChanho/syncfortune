// app/src/lib/ui/globalFont.ts — 전역 Pretendard 폰트 적용(트렌디·가독성 — daniel 기획서 UX 2026-07-14)
// ─────────────────────────────────────────────────────────────────────────
// RN은 '전역 기본 폰트'가 없어(각 Text가 시스템 폰트) Text·TextInput의 render를 1회 패치해
//   그 텍스트의 fontWeight → 해당 Pretendard 웨이트 패밀리를 자동 주입한다.
//   웨이트 매핑(3웨이트로 계층 유지, 앱 용량 절약): 100~500=Regular · 600=SemiBold · 700~900/bold=Bold.
//   폰트 자체는 expo-font useFonts 로 로드(_layout). 로드 전엔 시스템 폰트로 우아하게 폴백.
//   ※ 명시적으로 fontFamily를 지정한 텍스트는 그 값을 존중(우리 주입값을 style 배열 '앞'에 둠 → 명시값이 이김).
// ─────────────────────────────────────────────────────────────────────────
import React from 'react';
import { Text, TextInput, StyleSheet } from 'react-native';

// fontWeight(문자열/숫자) → Pretendard 웨이트 패밀리 키(useFonts 로드 키와 일치).
const FAMILY: Record<string, string> = {
  '100': 'Pretendard-Regular', '200': 'Pretendard-Regular', '300': 'Pretendard-Regular',
  '400': 'Pretendard-Regular', normal: 'Pretendard-Regular', '500': 'Pretendard-Regular',
  '600': 'Pretendard-SemiBold',
  '700': 'Pretendard-Bold', '800': 'Pretendard-Bold', '900': 'Pretendard-Bold', bold: 'Pretendard-Bold',
};

function familyFor(style: any): string {
  const flat = (StyleSheet.flatten(style) || {}) as { fontWeight?: unknown };
  const w = flat.fontWeight != null ? String(flat.fontWeight) : '400';
  return FAMILY[w] ?? 'Pretendard-Regular';
}

let patched = false;
/** Text·TextInput 에 fontWeight별 Pretendard 패밀리를 전역 주입(멱등·1회). _layout 최상단에서 호출. */
export function applyGlobalFont(): void {
  if (patched) return;
  patched = true;
  for (const Comp of [Text, TextInput] as any[]) {
    const orig = Comp?.render;
    if (typeof orig !== 'function') continue;              // forwardRef render 없으면 스킵(안전)
    Comp.render = function patchedRender(props: any, ref: any) {
      const el = orig.call(this, props, ref);
      // ★방어: 폰트 주입이 어떤 이유로든 실패해도 절대 크래시하지 않고 원본 엘리먼트로 폴백(최악=시스템 폰트).
      try {
        if (!el || !el.props) return el;
        const fam = familyFor(el.props.style);
        // 우리 fontFamily를 '앞'에 → 명시 fontFamily가 있으면 뒤 스타일이 이겨 존중됨.
        return React.cloneElement(el, { style: [{ fontFamily: fam }, el.props.style] });
      } catch {
        return el;
      }
    };
  }
}
