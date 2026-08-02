// app/src/components/AppAlert.tsx — 앱 디자인 커스텀 알림 모달(시스템 Alert 대체)
// ─────────────────────────────────────────────────────────────────────────
// root 레이아웃에 1개만 마운트 → lib/alert 의 host 로 등록. Alert.alert 호출 시 이 모달이 뜬다.
//   버튼 style: cancel(가라앉은 회색)·destructive(빨강)·default(골드). 2개 이하=가로, 3개+=세로.
// ─────────────────────────────────────────────────────────────────────────
import { Modal, View, Text, StyleSheet } from 'react-native';
import { PressableScale } from './PressableScale';
import { useEffect, useRef, useState } from 'react';
import { registerAlertHost, alertDismissed, type AlertOpts } from '../lib/ui/alert';
import { colors, radius, space, shadow, font } from '../lib/theme';

export function AppAlert() {
  const [opts, setOpts] = useState<AlertOpts | null>(null);
  useEffect(() => { registerAlertHost(setOpts); }, []);

  // ★★한 번 뜬 알림은 **정확히 한 번만** 닫힌다(daniel 2026-08-02 "광고제거 구매하면 앱 크래시").
  // ─────────────────────────────────────────────────────────────────────
  // 무엇이 문제였나: close() 는 setOpts(null) 만 한다. 상태 반영은 다음 렌더라
  //   그 사이(같은 프레임) 모달 버튼은 **여전히 화면에 있고 눌린다.** 빠르게 두 번 닿으면
  //     ① `cb()` 가 두 번 → 구매 RPC 가 두 번 = **중복 차감**
  //        (실측: coin_ledger 에 adfree_30 −30 이 **0.653ms 간격**으로 2건 · 2026-08-02 02:05)
  //     ② `setTimeout(alertDismissed, 350)` 이 두 번 → pump() 가 두 번 →
  //        **다음 알림을 연달아 present** → 앞 모달 transition 중 present = iOS terminate.
  //   즉 큐(alert.ts)가 막으려던 바로 그 크래시를, 닫기가 두 번 불리면서 되살렸다.
  //
  // 왜 여기서 막는가(길목): 확인 알림은 결제·삭제 등 **모든 위험한 동작의 공통 관문**이다.
  //   호출처마다 busy 플래그를 다는 방식은 이번처럼 한 곳만 빠져도 돈이 샌다.
  // 왜 boolean 이 아니라 opts 객체 동일성인가: 다음 알림이 뜨면 opts 가 새 객체라 자동으로
  //   다시 열린다 — 리셋 타이밍(useEffect)에 기대지 않아 경합이 없다.
  const handledRef = useRef<AlertOpts | null>(null);
  const close = () => {
    if (handledRef.current === opts) return;   // 이 알림은 이미 처리됐다 — 두 번째 탭은 버린다
    handledRef.current = opts;
    setOpts(null);
    setTimeout(alertDismissed, 350);           // 350ms = fade(약 300) 여유
  };
  // ★버튼을 누르지 않고 닫힘(안드로이드 뒤로가기) — 기다리는 Promise 를 반드시 풀어 준다.
  //   이게 없으면 결제 게이트가 영원히 대기하고 화면 잠금이 남아 버튼이 죽는다(daniel 2026-08-01).
  const dismiss = () => { const d = opts?.onDismiss; close(); d?.(); };
  const horizontal = (opts?.buttons.length ?? 0) <= 2;

  // ⚠️ Modal 은 항상 마운트하고 visible 로만 토글한다(이전엔 opts 없으면 return null → Modal unmount).
  //   '확인 → 지급 → 완료'처럼 Alert 가 연속될 때, 닫힘(fade) 애니메이션 도중 Modal 이 재마운트되면
  //   iOS 네이티브 모달이 프리징(앱 멈춤)한다. visible 토글 + 내용은 opts 있을 때만 → 재마운트 없이 내용만 교체.
  return (
    <Modal transparent visible={!!opts} animationType="fade" onRequestClose={dismiss}>
      {opts && (
        <View style={styles.backdrop}>
          <View style={styles.card}>
            <Text style={styles.title}>{opts.title}</Text>
            {opts.message ? <Text style={styles.msg}>{opts.message}</Text> : null}
            <View style={[styles.btns, horizontal ? styles.btnsRow : styles.btnsCol]}>
              {opts.buttons.map((b, i) => {
                const danger = b.style === 'destructive';
                const cancel = b.style === 'cancel';
                return (
                  <PressableScale key={i}
                    style={[styles.btn, horizontal && styles.btnFlex, cancel && styles.btnCancel, danger && styles.btnDanger]}
                    onPress={() => { const cb = b.onPress; close(); cb?.(); }}>
                    <Text style={[styles.btnTx, cancel && styles.btnTxCancel, danger && styles.btnTxDanger]}>{b.text}</Text>
                  </PressableScale>
                );
              })}
            </View>
          </View>
        </View>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: space(7) },
  card: { width: '100%', maxWidth: 340, backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.juLine, padding: space(5), ...shadow.card },
  title: { ...font.heading, color: colors.ink, textAlign: 'center' },
  msg: { ...font.body, color: colors.inkSoft, textAlign: 'center', marginTop: space(2.5), lineHeight: 22 },
  btns: { marginTop: space(5), gap: space(2) },
  btnsRow: { flexDirection: 'row' },
  btnsCol: { flexDirection: 'column' },
  btn: { paddingVertical: space(3), paddingHorizontal: space(4), borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ju },
  btnFlex: { flex: 1 },
  btnCancel: { backgroundColor: colors.sunk },
  btnDanger: { backgroundColor: '#C0392B' },
  btnTx: { color: colors.bg, fontWeight: '800', fontSize: 15 },
  btnTxCancel: { color: colors.inkSoft },
  btnTxDanger: { color: '#fff' },
});
