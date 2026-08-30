// app/src/components/BusyOverlay.tsx — 전체 화면 로딩 오버레이 (긴 콜백용)
// ═══════════════════════════════════════════════════════════════════════════
// 로그인/로그아웃 등 네트워크 콜백이 끝날 때까지 입력을 막고 진행 상태를 보여준다.
//
// ■ ★★2026-08-30 — `Modal` 을 **걷어냈다**. App Store 심사 크래시의 대응이다.
//   크래시 로그(2.1(a) App Completeness · iOS 26.6.1 · 3건 모두 동일)의 스택이 이랬다:
//
//     _runAlongsideCompletions → -[UIViewController _presentViewController:…]
//       → objc_exception_throw → abort
//
//   즉 **어떤 전환(transition)이 끝나는 완료 블록 안에서 또 present 가 일어나** UIKit 이 예외를
//   던졌다. 우리 코드 프레임은 `main` 뿐이라 JS 가 부른 게 아니라 **네이티브 모달 두 개가 겹친 것**이다.
//
//   RN 의 `<Modal>` 은 **하나당 UIViewController 하나를 present** 한다. 루트에는 그런 호스트가
//   넷이나 있었다 — `AppAlert` · `ChartConfirmHost` · `LangPickerHost` · 그리고 여기.
//   시작 직후 `authBusy` 로 이 막이 떴다 사라지는 도중에 알림이 하나 뜨면 정확히 위 스택이 된다
//   (실제 크래시 시각이 실행 후 2.5초·4.2초·15.1초로 흩어진 것도 «네트워크가 끝나는 때» 와 맞는다).
//
// ■ 왜 이 오버레이는 Modal 이 아니어도 되나
//   Modal 이 주는 것은 ①별도 뷰컨트롤러 ②그 위에 그리기 ③터치 차단이다.
//   이 막은 ②③만 필요하다 — ①은 **비용일 뿐 얻는 게 없다**.
//   루트(`GestureHandlerRootView`)가 화면 전체이고 이 컴포넌트는 그 안의 **마지막 형제**라,
//   `absoluteFill` 이면 화면을 전부 덮고 뒤 요소의 터치도 막는다. 뷰컨트롤러는 하나도 안 만든다.
//   ⇒ **이 컴포넌트는 이제 어떤 모달과도 충돌할 수 없다.**
//
// ■ 남는 차이 (의도한 것)
//   · 안드로이드 상태바 영역: 종전 `statusBarTranslucent` 는 상태바까지 덮었다. 지금은 안 덮는다.
//     로딩 막이라 문제되지 않는다(뒤로가기 차단은 아래 `onBack` 으로 유지).
//   · 알림(`AppAlert`)은 네이티브 모달이라 **여전히 이 막 위에** 뜬다 — 그게 맞는 순서다.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect } from 'react';
import { BackHandler, View, Text, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { colors, radius, space, font } from '../lib/theme';

/**
 * 전체 화면 로딩 막.
 *
 * @param visible 떠 있어야 하는가. `false` 면 **아무것도 렌더하지 않는다**(빈 뷰도 남기지 않는다 —
 *   `absoluteFill` 빈 뷰가 남으면 보이지도 않으면서 터치를 먹는다).
 * @param message 스피너 아래 안내문. 없으면 스피너만.
 */
export function BusyOverlay({ visible, message }: { visible: boolean; message?: string }) {
  // 작업 중 안드로이드 뒤로가기 차단 — 종전 `Modal onRequestClose={() => {}}` 가 하던 일을 그대로.
  useEffect(() => {
    if (!visible || Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true); // true = 우리가 삼킨다
    return () => sub.remove();
  }, [visible]);

  if (!visible) return null;
  return (
    // ⚠️`pointerEvents` 를 열어 둔다(기본값) — 이 막이 뒤 화면의 터치를 **먹는 것이 목적**이다.
    <View style={styles.backdrop} accessibilityViewIsModal accessible>
      <View style={styles.card}>
        <ActivityIndicator size="large" color={colors.ju} />
        {message ? <Text style={styles.tx}>{message}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // ★`absoluteFill` + 높은 zIndex — 루트의 마지막 형제라 순서상으로도 위지만,
  //   형제 순서가 바뀌어도 위에 남도록 못 박는다(웹에서는 zIndex 가 실제로 필요하다).
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999, elevation: 9999,
    backgroundColor: colors.overlay, justifyContent: 'center', alignItems: 'center',
  },
  card: { backgroundColor: colors.card, borderRadius: radius.md, paddingVertical: space(7), paddingHorizontal: space(9), alignItems: 'center', borderWidth: 1, borderColor: colors.juLine },
  tx: { ...font.body, color: colors.ink, marginTop: space(4) },
});
