/**
 * app/src/components/kit/CellBoundary.tsx — **목록 한 줄**만 감싸는 작은 바운더리
 * ═════════════════════════════════════════════════════════════════════════
 * Boss 2026-08-27 *"이건 왜 이러는거야 자꾸 대화 탭 누르면"* (「화면을 그리다 문제가 생겼어요」)
 *
 * ■ ★왜 필요한가 — **한 줄 때문에 탭이 통째로 죽는다**
 *   `AppErrorBoundary` 는 루트에 있어서, 목록의 어느 한 줄이 터져도 **화면 전체**를 폴백으로 바꾼다.
 *   사용자 눈에는 «대화 탭이 안 열린다» 로 보인다. 실제로는 **줄 하나**가 문제일 수 있다.
 *
 * ■ ★★그리고 **범인을 적어 둔다**
 *   `Text strings must be rendered within a <Text> component.` 는 네이티브에서만 터지고
 *   컴포넌트 이름이 압축돼 `in Unknown` 뿐이라, 정적 분석(`check:rawtext`)으로도 못 찾았다.
 *   ⇒ 터진 **그 줄의 데이터**를 남기면 다음 발생에서 바로 좁혀진다.
 *   ⚠️개인정보를 통째로 넣지 않는다 — **id 와 값의 «생김새»**(타입·길이)만 적는다.
 *
 * ■ ⚠️폴백은 **자리를 차지해야** 한다 — null 을 그리면 줄이 사라져 «목록이 잘렸다» 로 보인다.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { logEvent } from '../../lib/backend/logger';
import { APP_BUILD } from '../../lib/core/buildInfo';
import { colors, space, font } from '../../lib/theme';

type Props = {
  children: React.ReactNode;
  /** 어느 목록인지 — 로그에서 가른다(예: 'chats.row'). */
  where: string;
  /** ★범인을 좁힐 단서. 원본이 아니라 **생김새**만 넘긴다(아래 `shapeOf` 를 쓰면 편하다). */
  probe?: Record<string, unknown>;
};

/**
 * 값의 **생김새**만 뽑는다 — 내용은 안 남긴다.
 * @param v 아무 값
 * @returns 예: `string(12)` · `array(3)` · `number` · `null`
 */
export function shapeOf(v: unknown): string {
  if (v === null) return 'null';
  if (v === undefined) return 'undefined';
  if (Array.isArray(v)) return `array(${v.length})`;
  if (typeof v === 'string') return `string(${v.length})`;
  return typeof v;
}

export class CellBoundary extends React.Component<Props, { dead: boolean }> {
  state = { dead: false };
  static getDerivedStateFromError() { return { dead: true }; }

  componentDidCatch(err: Error) {
    try {
      logEvent('cell_crash', {
        where: this.props.where,
        msg: String(err?.message ?? err).slice(0, 200),
        probe: this.props.probe ?? {},
        build: APP_BUILD,
      }, 'error');
    } catch { /* 로깅 실패가 목록을 막지 않게 */ }
  }

  render() {
    if (!this.state.dead) return this.props.children;
    // ★자리를 남긴다 — 사라지면 «없는 줄» 이 되어 사용자가 더 헷갈린다
    return (
      <View style={styles.dead}>
        <Text style={styles.deadTx} numberOfLines={1}>이 줄을 표시할 수 없어요</Text>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  dead: { paddingVertical: space(4), paddingHorizontal: space(4), justifyContent: 'center' },
  deadTx: { ...font.caption, color: colors.inkFaint },
});
