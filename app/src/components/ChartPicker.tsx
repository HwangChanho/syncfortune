// app/src/components/ChartPicker.tsx — 대표 명식 선택/전환 (홈)
// ─────────────────────────────────────────────────────────────────────────
// 홈 상단에서 현재 '대표 명식'을 보여주고, 탭하면 등록된 명식 목록(바텀시트)에서 전환.
//   대표 변경 = setRepresentative → 만세력·풀이·궁합이 그 명식 기준(loadMyChart).
// 명식이 없으면 등록 유도. 화면 복귀 시 useFocusEffect 로 목록 갱신.
// ─────────────────────────────────────────────────────────────────────────
import { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, Pressable, Modal, ScrollView, StyleSheet } from 'react-native';
import { Alert } from '../lib/alert'; // 커스텀 알림(삭제 확인)
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { listCharts, setRepresentative, getRepresentativeId, getChartUsage, deleteChart, reorderCharts, subscribeRepChange, type SavedChart } from '../lib/myChart';
import { useSubscription } from '../lib/subscription';
import { colors, radius, space, shadow, font } from '../lib/theme';

export function ChartPicker({ onChange }: { onChange?: () => void }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { isPremium } = useSubscription(); // 프로 = 무제한(사용량 배지 숨김)
  const [charts, setCharts] = useState<SavedChart[]>([]);
  const [repId, setRepId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [usage, setUsage] = useState<{ count: number; limit: number } | null>(null);
  const [reorderMode, setReorderMode] = useState(false); // 명식 길게 눌러 순서변경 모드(daniel)

  const reload = useCallback(async () => {
    setCharts(await listCharts());
    setRepId(await getRepresentativeId());
    setUsage(await getChartUsage());
  }, []);
  // 화면 복귀(등록 후 등) 때마다 갱신
  useFocusEffect(useCallback(() => { reload(); }, [reload]));
  // 전역 명식 변경 구독(daniel: 어디서 바꿔도 자동 동기화) — 다른 화면에서 대표가 바뀌면 이 픽커·호스트도 즉시 갱신.
  const onChangeRef = useRef(onChange); onChangeRef.current = onChange;
  useEffect(() => subscribeRepChange(() => { reload(); onChangeRef.current?.(); }), [reload]);

  const rep = charts.find((c) => c.id === repId) ?? charts[0];

  async function choose(id: string) {
    await setRepresentative(id);
    setRepId(id);
    setOpen(false);
    onChange?.(); // 대표 변경 알림 → 호출처(만세력 등) 즉시 갱신
  }

  // 순서 변경(롱프레스 → 모드 → ▲▼) — 로컬 즉시 반영 + 저장·계정동기화(daniel)
  const move = async (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= charts.length) return;
    const next = [...charts];
    [next[idx], next[j]] = [next[j], next[idx]];
    setCharts(next);
    await reorderCharts(next.map((c) => c.id));
  };

  // 명식 수정 → 등록 폼 편집모드(editId)로 이동. 모달 닫고 진입.
  function edit(id: string) { setOpen(false); router.push({ pathname: '/register', params: { editId: id } }); }

  // 명식 삭제 → 확인 후 deleteChart + 목록 갱신 + 호출처 알림(되돌릴 수 없음).
  function remove(id: string, label: string) {
    Alert.alert(
      t('manse.deleteTitle', '명식 삭제'),
      t('manse.deleteMsg', { label, defaultValue: `'${label}' 명식을 삭제할까요? 되돌릴 수 없어요.` }) as string,
      [
        { text: t('common.cancel', '취소'), style: 'cancel' },
        { text: t('common.delete', '삭제'), style: 'destructive', onPress: async () => { await deleteChart(id); await reload(); onChange?.(); } },
      ],
    );
  }

  // 명식 없음 — 등록 유도
  if (!charts.length) {
    return (
      <Pressable style={styles.bar} onPress={() => router.push('/register')}>
        <Text style={styles.barLabel}>{t('manse.myChart')}</Text>
        <Text style={styles.barAdd}>＋ {t('compat.registerMyChart')}</Text>
      </Pressable>
    );
  }

  return (
    <>
      <Pressable style={styles.bar} onPress={() => setOpen(true)}>
        <Text style={styles.barLabel}>{t('manse.myChart')}</Text>
        <Text style={styles.barName}>{rep?.label} ▾</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => { setOpen(false); setReorderMode(false); }}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.handle} />
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>{t('manse.myChart')}</Text>
              {/* 순서변경 모드면 완료 버튼 / 아니면 무료 사용량 배지(프로는 숨김) */}
              {reorderMode ? (
                <Pressable hitSlop={8} onPress={() => setReorderMode(false)}><Text style={{ color: colors.ju, fontWeight: '700', fontSize: 13 }}>순서 변경 완료</Text></Pressable>
              ) : !isPremium && usage ? (
                <Text style={[styles.usage, usage.count >= usage.limit && styles.usageMax]}>
                  {t('register.usage', { count: usage.count, limit: usage.limit })}
                </Text>
              ) : null}
            </View>
            {!reorderMode && charts.length > 1 && <Text style={{ ...font.caption, color: colors.inkFaint, marginBottom: space(2) }}>명식을 길게 누르면 순서를 바꿀 수 있어요</Text>}
            <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
              {charts.map((c, idx) => {
                const on = c.id === repId;
                return (
                  <View key={c.id} style={styles.row}>
                    <Pressable style={styles.rowMain} onPress={() => (reorderMode ? setReorderMode(false) : choose(c.id))} onLongPress={() => setReorderMode(true)} delayLongPress={300}>
                      <Text style={[styles.rowName, on && styles.rowOn]}>{c.label}</Text>
                      <Text style={styles.rowMeta} numberOfLines={1}>
                        {String(c.input.birthDateTime ?? '').split(' ')[0]} · {c.relation === 'self' ? t('register.selfLabel') : c.relation}
                      </Text>
                    </Pressable>
                    {reorderMode ? (
                      <>
                        <Pressable hitSlop={10} onPress={() => move(idx, -1)} disabled={idx === 0}><Text style={[styles.rowAct, { fontSize: 18 }, idx === 0 && { opacity: 0.25 }]}>▲</Text></Pressable>
                        <Pressable hitSlop={10} onPress={() => move(idx, 1)} disabled={idx === charts.length - 1}><Text style={[styles.rowAct, { fontSize: 18 }, idx === charts.length - 1 && { opacity: 0.25 }]}>▼</Text></Pressable>
                      </>
                    ) : (
                      <>
                        {on && <Text style={styles.check}>✓</Text>}
                        <Pressable hitSlop={8} onPress={() => edit(c.id)}><Text style={styles.rowAct}>{t('common.edit', '수정')}</Text></Pressable>
                        <Pressable hitSlop={8} onPress={() => remove(c.id, c.label)}><Text style={[styles.rowAct, styles.rowActDel]}>{t('common.delete', '삭제')}</Text></Pressable>
                      </>
                    )}
                  </View>
                );
              })}
            </ScrollView>
            <Pressable style={styles.addBtn} onPress={() => { setOpen(false); router.push('/register'); }}>
              <Text style={styles.addBtnText}>＋ {t('compat.registerMyChart')}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line,
    borderRadius: radius.md, paddingVertical: space(3), paddingHorizontal: space(4),
    marginBottom: space(5), ...shadow.soft,
  },
  barLabel: { ...font.caption, color: colors.inkSoft },
  barName: { fontSize: 15, fontWeight: '700', color: colors.ju }, // heading(17)→15: 라벨과 균형(이름 과대 방지)
  barAdd: { ...font.body, color: colors.ju, fontWeight: '700' },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: colors.bg, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg,
    paddingHorizontal: space(5), paddingTop: space(2.5), paddingBottom: space(6), maxHeight: '70%',
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.line, alignSelf: 'center', marginBottom: space(3) },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space(2) },
  sheetTitle: { ...font.heading },
  usage: { ...font.caption, color: colors.inkSoft, fontWeight: '700' },
  usageMax: { color: colors.ju }, // 한도 도달 = 주색(업그레이드 신호)

  list: { flexGrow: 0 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: space(3.5), borderBottomWidth: 1, borderBottomColor: colors.line, gap: space(2) },
  rowMain: { flex: 1 },
  rowAct: { fontSize: 13, fontWeight: '700', color: colors.ju, paddingHorizontal: space(1.5) }, // 수정·삭제 글자
  rowActDel: { color: '#E5484D' }, // 삭제 = 적색 강조
  rowName: { ...font.body, fontWeight: '600', color: colors.ink },
  rowOn: { color: colors.ju },
  rowMeta: { ...font.caption, flex: 1 },
  check: { fontSize: 18, color: colors.ju, fontWeight: '700' },
  addBtn: { backgroundColor: colors.ju, borderRadius: radius.md, paddingVertical: space(3.5), alignItems: 'center', marginTop: space(4) },
  addBtnText: { color: colors.bg, fontSize: 15, fontWeight: '700' },
});
