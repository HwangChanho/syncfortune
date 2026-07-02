// app/src/lib/ui/chartConfirm.tsx
// ─────────────────────────────────────────────────────────────────────────
// 풀이/구매 전 '적용 명식 확인' 전역 모달(daniel 07-02).
//   ★Alert로는 드롭다운(명식 변경)이 안 돼 커스텀 모달로 — 확인창에서 명식 목록을 띄워 *다른 명식으로 변경*까지 가능하게.
//   AppAlert 패턴(전역 호스트 1개 + 명령형 트리거). requestChartConfirm(opts)가 Promise<boolean> 반환.
//   명식 선택 시 setRepresentative(대표 전환) → 각 화면이 그 명식으로 재로드(생성은 확인 후 현재 대표 기준).
//   ChartConfirmHost 는 앱 루트(_layout)에 1회 렌더. 보유 이용권 개수도 함께 표시(쿠폰 있으면).
// ─────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useSyncExternalStore } from 'react';
import { View, Text, Pressable, Modal, ScrollView, StyleSheet } from 'react-native';
import { PressableScale } from '../../components/PressableScale';
import { listCharts, setRepresentative, getRepresentativeId, type SavedChart } from '../engine/myChart';
import { loadCredits, type CreditKind } from '../billing/coupons';
import { colors, radius, space, shadow, font } from '../theme';

type Opts = { creditKind?: CreditKind; chartless?: boolean };
type State = { opts: Opts; resolve: (v: boolean) => void } | null;

let _state: State = null;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
function subscribe(cb: () => void): () => void { subs.add(cb); return () => { subs.delete(cb); }; }
function getState(): State { return _state; }

/** 명식 확인 모달을 띄우고, 확인=true / 취소=false 로 resolve. 명식 변경 시 대표를 그 명식으로 전환한다. */
export function requestChartConfirm(opts: Opts): Promise<boolean> {
  return new Promise<boolean>((resolve) => { _state = { opts, resolve }; emit(); });
}

/** 앱 루트(_layout)에 1회 렌더 — 전역 명식 확인 모달 호스트. */
export function ChartConfirmHost() {
  const state = useSyncExternalStore(subscribe, getState);
  const [charts, setCharts] = useState<SavedChart[]>([]);
  const [repId, setRepId] = useState<string | null>(null);
  const [credits, setCredits] = useState(0);

  useEffect(() => {
    if (!state) return;
    let alive = true;
    (async () => {
      const [cs, rid] = await Promise.all([listCharts(), getRepresentativeId()]);
      if (!alive) return;
      setCharts(cs); setRepId(rid ?? cs[0]?.id ?? null);
      if (state.opts.creditKind) {
        try { const c = await loadCredits(); if (alive) setCredits(c[state.opts.creditKind!] ?? 0); } catch { /* 개수 조회 실패=0 */ }
      } else setCredits(0);
    })();
    return () => { alive = false; };
  }, [state]);

  if (!state) return null;
  const chartless = !!state.opts.chartless;
  const close = (v: boolean) => { const r = state.resolve; _state = null; emit(); r(v); };
  const pick = async (id: string) => { setRepId(id); try { await setRepresentative(id); } catch { /* 전환 실패 무시 */ } }; // 대표 전환 → 화면 재로드

  return (
    <Modal transparent animationType="fade" visible onRequestClose={() => close(false)}>
      <Pressable style={styles.backdrop} onPress={() => close(false)}>
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={styles.title}>{chartless ? '풀이 확인' : '이 명식으로 풀이할까요?'}</Text>
          {!chartless && (
            <>
              <Text style={styles.sub}>명식을 눌러 변경할 수 있어요</Text>
              <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
                {charts.map((c) => {
                  const on = c.id === repId;
                  return (
                    <PressableScale key={c.id} style={[styles.item, on && styles.itemOn]} onPress={() => pick(c.id)}>
                      <Text style={[styles.itemTx, on && styles.itemTxOn]} numberOfLines={1}>{on ? '✓ ' : ''}{c.label}</Text>
                      <Text style={[styles.itemMeta, on && styles.itemTxOn]} numberOfLines={1}>{c.relation === 'self' ? '본인' : c.relation}</Text>
                    </PressableScale>
                  );
                })}
              </ScrollView>
            </>
          )}
          {credits > 0 && <Text style={styles.credit}>보유 이용권 {credits}개</Text>}
          <View style={styles.btns}>
            <PressableScale style={styles.btnCancel} onPress={() => close(false)}><Text style={styles.btnCancelTx}>취소</Text></PressableScale>
            <PressableScale style={styles.btnOk} onPress={() => close(true)}><Text style={styles.btnOkTx}>네, 볼게요</Text></PressableScale>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: space(6) },
  card: { width: '100%', maxWidth: 380, backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.juLine, padding: space(5), ...shadow.card },
  title: { ...font.heading, color: colors.ink, textAlign: 'center' },
  sub: { ...font.caption, color: colors.inkFaint, textAlign: 'center', marginTop: space(1), marginBottom: space(3) },
  list: { maxHeight: 220, marginBottom: space(2) },
  item: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space(2), paddingVertical: space(2.75), paddingHorizontal: space(3.5), borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, marginBottom: space(1.5) },
  itemOn: { backgroundColor: colors.juSoft, borderColor: colors.ju },
  itemTx: { ...font.body, color: colors.ink, fontWeight: '700', flexShrink: 1 },
  itemMeta: { ...font.caption, color: colors.inkFaint },
  itemTxOn: { color: colors.ju },
  credit: { ...font.caption, color: colors.ju, textAlign: 'center', marginBottom: space(2), fontWeight: '700' },
  btns: { flexDirection: 'row', gap: space(2.5), marginTop: space(2) },
  btnCancel: { flex: 1, paddingVertical: space(3.25), borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, alignItems: 'center' },
  btnCancelTx: { ...font.body, color: colors.inkSoft, fontWeight: '700' },
  btnOk: { flex: 1.4, paddingVertical: space(3.25), borderRadius: radius.md, backgroundColor: colors.ju, alignItems: 'center' },
  btnOkTx: { ...font.body, color: colors.bg, fontWeight: '900' },
});
