// app/src/components/ChartPicker.tsx — 대표 명식 선택/전환 (홈)
// ─────────────────────────────────────────────────────────────────────────
// 홈 상단에서 현재 '대표 명식'을 보여주고, 탭하면 등록된 명식 목록(바텀시트)에서 전환.
//   대표 변경 = setRepresentative → 만세력·풀이·궁합이 그 명식 기준(loadMyChart).
// 명식이 없으면 등록 유도. 화면 복귀 시 useFocusEffect 로 목록 갱신.
// ─────────────────────────────────────────────────────────────────────────
import { useState, useCallback } from 'react';
import { View, Text, Pressable, Modal, ScrollView, StyleSheet } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { listCharts, setRepresentative, getRepresentativeId, getChartUsage, type SavedChart } from '../lib/myChart';
import { useSubscription } from '../lib/subscription';
import { colors, radius, space, shadow, font } from '../lib/theme';

export function ChartPicker() {
  const { t } = useTranslation();
  const router = useRouter();
  const { isPremium } = useSubscription(); // 프로 = 무제한(사용량 배지 숨김)
  const [charts, setCharts] = useState<SavedChart[]>([]);
  const [repId, setRepId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [usage, setUsage] = useState<{ count: number; limit: number } | null>(null);

  const reload = useCallback(async () => {
    setCharts(await listCharts());
    setRepId(await getRepresentativeId());
    setUsage(await getChartUsage());
  }, []);
  // 화면 복귀(등록 후 등) 때마다 갱신
  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  const rep = charts.find((c) => c.id === repId) ?? charts[0];

  async function choose(id: string) {
    await setRepresentative(id);
    setRepId(id);
    setOpen(false);
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
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.handle} />
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>{t('manse.myChart')}</Text>
              {/* 무료 사용량 배지 (프로는 무제한 → 숨김). 한도 도달 시 주색 강조. */}
              {!isPremium && usage && (
                <Text style={[styles.usage, usage.count >= usage.limit && styles.usageMax]}>
                  {t('register.usage', { count: usage.count, limit: usage.limit })}
                </Text>
              )}
            </View>
            <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
              {charts.map((c) => {
                const on = c.id === repId;
                return (
                  <Pressable key={c.id} style={styles.row} onPress={() => choose(c.id)}>
                    <Text style={[styles.rowName, on && styles.rowOn]}>{c.label}</Text>
                    <Text style={styles.rowMeta} numberOfLines={1}>
                      {String(c.input.birthDateTime ?? '').split(' ')[0]} · {c.relation === 'self' ? t('register.selfLabel') : c.relation}
                    </Text>
                    {on && <Text style={styles.check}>✓</Text>}
                  </Pressable>
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
  barName: { ...font.heading, color: colors.ju },
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
  rowName: { ...font.body, fontWeight: '600', color: colors.ink },
  rowOn: { color: colors.ju },
  rowMeta: { ...font.caption, flex: 1 },
  check: { fontSize: 18, color: colors.ju, fontWeight: '700' },
  addBtn: { backgroundColor: colors.ju, borderRadius: radius.md, paddingVertical: space(3.5), alignItems: 'center', marginTop: space(4) },
  addBtnText: { color: colors.bg, fontSize: 15, fontWeight: '700' },
});
