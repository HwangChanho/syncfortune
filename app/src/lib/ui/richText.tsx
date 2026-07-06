// app/src/lib/ui/richText.tsx — 온디바이스 콘텐츠 문자열의 *별표 강조* → bold 렌더 헬퍼 (daniel 2026-07-07)
// ─────────────────────────────────────────────────────────────────────────
// 문제: 온디바이스 콘텐츠 문자열이 `*강조*`(마크다운식 별표 강조)를 담고 있는데,
//   RN <Text>는 마크다운을 모르므로 별표가 화면에 '리터럴'로 그대로 노출됐다
//   (예: "*서늘하고 물이 가까운 곳*"). 원저자(daniel)의 강조 의도는 살리되, 별표는
//   화면에서 사라지고 '굵게(bold)'로만 강조되어야 한다.
//
// 해결: 소스 문자열의 별표는 그대로 두고(= 원저자 강조 의도 보존·프롬프트 겸용 안전),
//   '렌더 시점'에만 `*...*` 쌍을 파싱해 감싼 부분을 bold <Text> 스팬으로 바꾼다.
//   별표는 출력에서 제거된다.
//
// 안전 규칙(daniel):
//   · '*한글로 시작하는' 쌍만 강조로 인식한다 — 각주(`* 경향 안내…`, 별표+공백)·
//     리스트 불릿·곱셈 등 '강조 아닌 별표'의 오변환을 원천 차단.
//   · 홀수 별표·짝이 안 맞는 별표·중첩 등은 매칭에서 제외 → 원문 그대로 남긴다.
//   · 매칭이 하나도 없으면 문자열을 손대지 않고 그대로 렌더(방어적).
//
// RN 텍스트 상속 주의(중요):
//   · 스팬 중첩은 반드시 <Text> 안에서만(뷰 아님). 부모 <Text>의 fontSize·color·
//     lineHeight·fontFamily 는 자식 <Text>로 자동 상속된다.
//   · 따라서 bold 스팬에는 baseStyle 을 '다시 얹지 않는다'. baseStyle 에 margin/padding
//     같은 레이아웃 값이 섞여 있을 수 있어(예: styles.note 의 marginTop), 인라인 스팬에
//     재적용하면 이중 여백이 생긴다. → baseStyle 은 '바깥 래퍼'에만, bold 스팬은
//     굵기(+선택적 색)만 더한다. 타이포는 상속으로 그대로 이어진다.
// ─────────────────────────────────────────────────────────────────────────
import React, { type ReactNode } from 'react';
import { StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';

// 강조 패턴: '*' + 한글로 시작 + (별표 아닌 문자들) + '*'.
//   · 여는 별표 바로 뒤가 한글([가-힣])일 때만 강조로 본다(각주/불릿/곱셈 오변환 방지).
//   · 안쪽은 [^*]* 라 다음 별표 전까지만 → 짝이 맞는 최단 쌍만 잡는다.
//   · g 플래그: 한 문자열에 여러 강조 쌍(예: 조후 설명의 2곳)을 모두 처리.
const EMPH_RE = /\*([가-힣][^*]*)\*/g;

// 문자열을 '일반/강조' 세그먼트 배열로 분해.
//   반환: { bold: boolean; text: string }[]  — 강조 세그먼트에서 별표는 이미 제거됨.
//   강조 쌍이 하나도 없으면 [{ bold:false, text: 원문 }] (호출부에서 원문 그대로 렌더).
type Seg = { bold: boolean; text: string };
function splitEmphasis(input: string): Seg[] {
  const segs: Seg[] = [];
  let last = 0; // 직전 매칭 이후의 커서(일반 텍스트 시작 위치)
  // exec 루프로 모든 강조 쌍을 순회하며 [일반][강조][일반]… 순서로 쌓는다.
  EMPH_RE.lastIndex = 0; // g 정규식은 상태(lastIndex)를 가지므로 매 호출 초기화(재진입 안전)
  let m: RegExpExecArray | null;
  while ((m = EMPH_RE.exec(input)) !== null) {
    if (m.index > last) segs.push({ bold: false, text: input.slice(last, m.index) }); // 강조 앞의 일반부
    segs.push({ bold: true, text: m[1] }); // 강조부(별표 제거된 안쪽 캡처)
    last = m.index + m[0].length; // 커서를 닫는 별표 다음으로 이동
    if (m[0].length === 0) EMPH_RE.lastIndex++; // 이론상 0길이 매칭 방지(무한루프 가드)
  }
  if (last < input.length) segs.push({ bold: false, text: input.slice(last) }); // 마지막 꼬리 일반부
  return segs;
}

// bold 스팬 기본 스타일 — 굵기만. 색/크기/줄간격은 부모 <Text> 에서 상속.
const styles = StyleSheet.create({
  bold: { fontWeight: '800' },
});

/**
 * emph — 콘텐츠 문자열의 `*...*` 강조를 bold <Text> 스팬으로 렌더.
 *
 * 사용:
 *   기존:  <Text style={styles.x}>{str}</Text>
 *   변경:  {emph(str, styles.x)}
 *   (기존 <Text> 를 통째로 대체 — emph 가 baseStyle 을 얹은 바깥 <Text> 를 반환한다.)
 *
 * @param text      렌더할 문자열(소스의 별표는 유지, 여기서 강조만 변환).
 * @param baseStyle 바깥 <Text> 스타일 — 기존 그 자리의 style 을 그대로 넘긴다
 *                  (배열·객체 모두 가능. fontSize/color/lineHeight/margin 등 전부 유지).
 * @param boldStyle 강조 스팬에 '추가'할 스타일(선택). 기본은 굵게만. 필요 시 예:
 *                  { color: colors.badgeGold } 로 살짝 금색 강조도 가능(색 상속을 덮음).
 * @returns 강조가 bold 로 반영된 단일 <Text> 노드. 강조 쌍이 없으면 원문을 그대로 담은 <Text>.
 *
 * 주의: 매칭 실패(홀수/비한글 시작 별표 등)면 별표를 건드리지 않고 원문을 렌더(방어적).
 */
export function emph(
  text: string,
  baseStyle?: StyleProp<TextStyle>,
  boldStyle?: StyleProp<TextStyle>,
): ReactNode {
  // 방어: 문자열이 아니면(예: undefined) 안전하게 문자열화해 그대로 렌더.
  const str = typeof text === 'string' ? text : String(text ?? '');
  const segs = splitEmphasis(str);

  // 강조 세그먼트가 없으면(=원문에 강조 쌍 없음) 원문 그대로 — 불필요한 스팬 중첩 회피.
  if (!segs.some((s) => s.bold)) {
    return <Text style={baseStyle}>{str}</Text>;
  }

  // 바깥 <Text> 에 baseStyle(타이포·레이아웃) 을 얹고, 자식으로 세그먼트를 나열.
  //   · 일반부 = 원시 문자열(부모 <Text> 스타일을 그대로 상속).
  //   · 강조부 = <Text style={[styles.bold, boldStyle]}> — 굵기(+선택 색)만 더함(타이포는 상속).
  return (
    <Text style={baseStyle}>
      {segs.map((s, i) =>
        s.bold ? (
          <Text key={i} style={[styles.bold, boldStyle]}>
            {s.text}
          </Text>
        ) : (
          // 일반부는 raw string — <Text> 자식으로 그대로 두면 부모 스타일을 상속한다.
          s.text
        ),
      )}
    </Text>
  );
}
