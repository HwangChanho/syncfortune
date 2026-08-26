// app/src/components/AppErrorBoundary.tsx — 렌더 오류를 **화면과 로그로** 드러내는 전역 바운더리
// ═══════════════════════════════════════════════════════════════════════════
// 왜 생겼나 (2026-08-17)
//   이 앱엔 에러 바운더리가 **하나도 없었다.** 그래서 어느 화면 한 곳에서 렌더 오류가 나면
//   React 가 트리를 통째로 버려 **앱 전체가 백지**가 되고, 원인은 콘솔에만 남는다.
//   웹 사용자는 콘솔을 못 본다 ⇒ "그냥 안 돼요" 말고는 아무 정보도 안 남는 실패였다
//   (로그인 콜백이 `catch {}` 로 실패를 삼키던 것과 **같은 병** · [[no-fabrication-honesty]] 계열).
//   실제로 만세력 웹 크래시를 쫓는 데 이것 때문에 오래 걸렸다.
//
// 무엇을 하나
//   · 백지 대신 **복구 가능한 화면**을 보여준다(다시 시도 → 상태를 비우고 재마운트)
//   · `app_logs` 에 `render_crash` 로 남긴다 — 사용자가 말해 주지 않아도 우리가 안다
//   · 개발 빌드에서는 **메시지 + 컴포넌트 스택**을 그대로 띄운다(범인 컴포넌트가 바로 보인다)
//
// ⚠️바운더리는 **자기 아래**만 잡는다. 루트에 달아야 어느 화면이 죽어도 앱이 남는다.
// ⚠️`componentDidCatch` 안에서 다시 던지면 안 된다 — 그러면 백지로 되돌아간다(모두 try 로 감쌌다).
// ═══════════════════════════════════════════════════════════════════════════
import React from 'react';
import { View, Text, ScrollView, StyleSheet, Platform } from 'react-native';
import { PressableScale } from './PressableScale';
import { logEvent } from '../lib/backend/logger';
import { lastRoute } from '../lib/backend/screenTrace';   // ★크래시 때 «어느 화면인지» — 네이티브는 스택이 압축돼 이것 없이는 못 짚는다
import { colors, space, radius, font } from '../lib/theme';

type Props = {
  children: React.ReactNode;
  /** 어느 자리에서 터졌는지 로그에 남길 이름(예: 'root'). */
  where?: string;
};
type State = { err: Error | null; stack: string };

export class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { err: null, stack: '' };

  /** 렌더 단계 오류 → 폴백으로 전환(여기서는 부작용 금지). */
  static getDerivedStateFromError(err: Error): Partial<State> {
    return { err };
  }

  /**
   * 잡은 오류를 기록한다.
   * @param err  던져진 오류
   * @param info `componentStack` 포함 — 개발 번들에서는 실제 컴포넌트 이름이 담긴다.
   */
  componentDidCatch(err: Error, info: React.ErrorInfo): void {
    const stack = String(info?.componentStack ?? '');
    this.setState({ stack });
    try {
      logEvent('render_crash', {
        where: this.props.where ?? 'unknown',
        msg: String(err?.message ?? err).slice(0, 300),
        // ★★2026-08-27 — **어느 화면인지**를 함께 남긴다.
        //   iOS 에서 「Text strings must be rendered within a <Text> component.」 가 났는데
        //   컴포넌트 스택이 압축돼 `in Unknown` 뿐이라 **범인을 못 짚었다**(정적 추적도 실패).
        //   경로 하나만 있으면 다음 발생에서 바로 좁혀진다.
        //   ⚠️`location` 은 웹에만 있다 — 네이티브에서는 조용히 건너뛴다.
        route: (() => {
          try { return Platform.OS === 'web' ? String((globalThis as any).location?.pathname ?? '') : lastRoute(); }
          catch { return ''; }
        })(),
        // 컴포넌트 스택 앞부분만 — 범인은 거의 항상 맨 위에 있다
        comp: stack.split('\n').filter(Boolean).slice(0, 6).join(' < ').slice(0, 400),
        // ★스택 **전문**도 넣는다(400자로 자르면 압축된 이름만 남아 쓸모가 없었다)
        compFull: stack.slice(0, 1200),
        platform: Platform.OS,
      }, 'error');
    } catch { /* 로깅 실패가 폴백 화면을 막지 않게 */ }
  }

  /** 다시 시도 — 상태를 비우면 children 이 새로 마운트된다. */
  private retry = () => this.setState({ err: null, stack: '' });

  /**
   * 웹 전용 — **번들을 새로 받아** 앱을 다시 연다.
   *
   * ⚠️★2026-08-26 이게 없어서 Boss 가 «계속 깨진다» 를 겪었다.
   *   고친 판을 배포했는데 **열려 있던 탭이 옛 번들을 그대로 돌리고** 있었다
   *   (SPA 는 화면을 옮겨도 index.html 을 다시 받지 않는다). 크래시 로그의 **번들 해시**로 확인했다.
   *   그때 「다시 시도」는 **같은 코드를 다시 그릴 뿐**이라 영원히 같은 자리에서 깨진다.
   * ★`location.reload()` 대신 **주소에 값을 붙여** 문서를 새로 받는다 —
   *   reload 는 캐시된 문서를 그대로 줄 수 있고, 그러면 낡은 번들이 또 뜬다.
   */
  private hardReload = (): void => {
    try {
      const w = globalThis as any;
      const loc = w?.location;
      if (!loc) return;
      const u = new URL(String(loc.href));
      u.searchParams.set('_r', String(Math.floor(w.Date.now() / 1000)));
      loc.replace(u.toString());
    } catch { /* 새로고침이 안 되어도 「다시 시도」는 남아 있다 */ }
  };

  render(): React.ReactNode {
    const { err, stack } = this.state;
    if (!err) return this.props.children;

    return (
      <ScrollView style={styles.wrap} contentContainerStyle={styles.inner}>
        <Text style={styles.title}>화면을 그리다 문제가 생겼어요</Text>
        <Text style={styles.body}>
          이 화면만 멈춘 거예요. 다시 시도하거나, 다른 메뉴로 이동하면 계속 쓸 수 있어요.
        </Text>
        <PressableScale style={styles.btn} onPress={this.retry}>
          <Text style={styles.btnTx}>다시 시도</Text>
        </PressableScale>
        {/* ★웹에서는 «앱이 낡아서» 깨지는 경우가 있다 — 그때 「다시 시도」로는 절대 안 낫는다.
            네이티브에는 없는 버튼이다(번들을 주소로 다시 받는 개념이 없다). */}
        {Platform.OS === 'web' ? (
          <>
            <PressableScale style={styles.btn2} onPress={this.hardReload}>
              <Text style={styles.btn2Tx}>새로 불러오기</Text>
            </PressableScale>
            <Text style={styles.hint}>
              고쳐진 판이 나왔는데 화면이 옛것을 붙들고 있을 수 있어요. 그럴 땐 이걸 누르면 돼요.
            </Text>
          </>
        ) : null}

        {/* 개발 빌드에서만 원인 노출 — 사용자에게 스택을 보여주지 않는다 */}
        {__DEV__ ? (
          <View style={styles.diag}>
            <Text selectable style={styles.diagHead}>DIAG-ERR: {String(err?.message ?? err)}</Text>
            <Text selectable style={styles.diagBody}>DIAG-STACK:{stack}</Text>
          </View>
        ) : null}
      </ScrollView>
    );
  }
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  inner: { padding: space(7), gap: space(3), justifyContent: 'center', flexGrow: 1 },
  title: { ...font.title, color: colors.ink, textAlign: 'center' },
  body: { ...font.body, color: colors.inkSoft, textAlign: 'center', lineHeight: 22 },
  btn: {
    alignSelf: 'center', marginTop: space(2), backgroundColor: colors.ju,
    paddingHorizontal: space(7), paddingVertical: space(3.5), borderRadius: radius.md,
  },
  btnTx: { color: colors.white, fontSize: 16, fontWeight: '700' },
  // ★보조 동작이라 **테두리만** — 주 동작(다시 시도)과 무게를 나눈다
  btn2: {
    alignSelf: 'center', marginTop: space(1), paddingHorizontal: space(7), paddingVertical: space(3.5),
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.line,
  },
  btn2Tx: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  hint: { ...font.caption, color: colors.inkFaint, textAlign: 'center', lineHeight: 17 },
  diag: { marginTop: space(6), padding: space(3), backgroundColor: colors.sunk, borderRadius: radius.sm, gap: space(2) },
  diagHead: { color: '#B00020', fontWeight: '800', fontSize: 13 },
  diagBody: { color: colors.inkSoft, fontSize: 11, lineHeight: 15 },
});
