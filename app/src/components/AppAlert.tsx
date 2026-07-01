// app/src/components/AppAlert.tsx — 앱 디자인 커스텀 알림 모달(시스템 Alert 대체)
// ─────────────────────────────────────────────────────────────────────────
// root 레이아웃에 1개만 마운트 → lib/alert 의 host 로 등록. Alert.alert 호출 시 이 모달이 뜬다.
//   버튼 style: cancel(가라앉은 회색)·destructive(빨강)·default(골드). 2개 이하=가로, 3개+=세로.
// ─────────────────────────────────────────────────────────────────────────
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import { useEffect, useState } from 'react';
import { registerAlertHost, alertDismissed, type AlertOpts } from '../lib/ui/alert';
import { colors, radius, space, shadow, font } from '../lib/theme';

export function AppAlert() {
  const [opts, setOpts] = useState<AlertOpts | null>(null);
  useEffect(() => { registerAlertHost(setOpts); }, []);

  // 닫기 = 모달 내림 + (fade 끝난 뒤) 큐의 다음 알림 표시. 350ms = fade(약 300) 여유.
  //   ★연속/연타 Alert 가 transition 겹쳐 크래시 나는 걸 큐(alert.ts)로 순차화 — 여기서 dismiss 완료를 알린다.
  const close = () => { setOpts(null); setTimeout(alertDismissed, 350); };
  const horizontal = (opts?.buttons.length ?? 0) <= 2;

  // ⚠️ Modal 은 항상 마운트하고 visible 로만 토글한다(이전엔 opts 없으면 return null → Modal unmount).
  //   '확인 → 지급 → 완료'처럼 Alert 가 연속될 때, 닫힘(fade) 애니메이션 도중 Modal 이 재마운트되면
  //   iOS 네이티브 모달이 프리징(앱 멈춤)한다. visible 토글 + 내용은 opts 있을 때만 → 재마운트 없이 내용만 교체.
  return (
    <Modal transparent visible={!!opts} animationType="fade" onRequestClose={close}>
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
                  <Pressable key={i}
                    style={[styles.btn, horizontal && styles.btnFlex, cancel && styles.btnCancel, danger && styles.btnDanger]}
                    onPress={() => { const cb = b.onPress; close(); cb?.(); }}>
                    <Text style={[styles.btnTx, cancel && styles.btnTxCancel, danger && styles.btnTxDanger]}>{b.text}</Text>
                  </Pressable>
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
