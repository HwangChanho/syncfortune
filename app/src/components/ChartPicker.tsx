// app/src/components/ChartPicker.tsx — 대표 명식 선택/전환 (홈)
// ─────────────────────────────────────────────────────────────────────────
// 홈 상단에서 현재 '대표 명식'을 보여주고, 탭하면 등록된 명식 목록(바텀시트)에서 전환.
//   대표 변경 = setRepresentative → 만세력·풀이·궁합이 그 명식 기준(loadMyChart).
// 명식이 없으면 등록 유도. 화면 복귀 시 useFocusEffect 로 목록 갱신.
// ─────────────────────────────────────────────────────────────────────────
import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { View, Text, Pressable, Modal, StyleSheet, Image, Dimensions } from 'react-native';
import DraggableFlatList, { ScaleDecorator } from 'react-native-draggable-flatlist'; // 이슈20 롱프레스 드래그 reorder
import { Alert } from '../lib/alert'; // 커스텀 알림(삭제 확인)
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { listCharts, setRepresentative, getRepresentativeId, getChartUsage, deleteChart, reorderCharts, subscribeRepChange, type SavedChart } from '../lib/myChart';
import { useSubscription } from '../lib/subscription';
import { useFontScale } from '../lib/fontScale'; // 명식 헤더 글자크기 반영(daniel)
import { computeChart } from '../lib/engine'; // 각 명식 일주 산출(엠블럼)
import { iljuEmblem, iljuImage, type IljuEmblem } from '../lib/dayPillarEmblem'; // 일주 엠블럼(은빛 소 등) + 60갑자 AI 일러스트
import { colors, radius, space, shadow, font } from '../lib/theme';

export function ChartPicker({ onChange }: { onChange?: () => void }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { isPremium } = useSubscription(); // 프로 = 무제한(사용량 배지 숨김)
  const { fs } = useFontScale();           // 명식 헤더 글자크기(설정 반영)
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
  // 전역 명식 변경 구독(daniel: 어디서 바꿔도 자동 동기화) — 다른 화면에서 대표가 바뀌면 이 픽커·호스트도 즉시 갱신.
  const onChangeRef = useRef(onChange); onChangeRef.current = onChange;
  useEffect(() => subscribeRepChange(() => { reload(); onChangeRef.current?.(); }), [reload]);

  const rep = charts.find((c) => c.id === repId) ?? charts[0];
  // 각 명식의 일주 엠블럼(일간 오행색 + 일지 동물 = "은빛 소" 등) — 명식 리스트 시각 정체성(daniel)
  const emblems = useMemo(() => {
    const m: Record<string, IljuEmblem> = {};
    charts.forEach((c) => { try { const p = computeChart(c.input).saju.pillars['일']; if (p) m[c.id] = iljuEmblem(p.stem, p.branch); } catch { /* 계산 실패 무시 */ } });
    return m;
  }, [charts]);

  async function choose(id: string) {
    await setRepresentative(id);
    setRepId(id);
    setOpen(false);
    onChange?.(); // 대표 변경 알림 → 호출처(만세력 등) 즉시 갱신
  }

  // 순서 변경 — 롱프레스 드래그(이슈20): 끌어 놓으면 즉시 반영 + 저장·계정동기화(별도 저장 버튼 X, daniel).
  const onDragEnd = async (data: SavedChart[]) => {
    setCharts(data);                          // 로컬 즉시 반영(애니메이션은 DraggableFlatList가 처리)
    await reorderCharts(data.map((c) => c.id)); // 영속 + 계정동기화(ADR-056)
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
        <Text style={[styles.barLabel, { fontSize: fs(12) }]}>{t('manse.myChart')}</Text>
        <Text style={[styles.barName, { fontSize: fs(15) }]}>{rep?.label} ▾</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.handle} />
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>{t('manse.myChart')}</Text>
              {/* 무료 사용량 배지(프로는 숨김) */}
              {!isPremium && usage ? (
                <Text style={[styles.usage, usage.count >= usage.limit && styles.usageMax]}>
                  {t('register.usage', { count: usage.count, limit: usage.limit })}
                </Text>
              ) : null}
            </View>
            {charts.length > 1 && <Text style={{ ...font.caption, color: colors.inkFaint, marginBottom: space(2) }}>명식을 길게 눌러 끌면 순서가 바뀌어요</Text>}
            {/* 이슈20: 롱프레스→드래그 reorder. 끌어 놓으면 onDragEnd가 저장·계정동기화(별도 모드/저장버튼 없음). */}
            <DraggableFlatList
              data={charts}
              keyExtractor={(c) => c.id}
              style={styles.list}
              showsVerticalScrollIndicator={false}
              activationDistance={14}
              onDragEnd={({ data }) => onDragEnd(data)}
              renderItem={({ item: c, drag, isActive }) => {
                const on = c.id === repId;
                const em = emblems[c.id];
                const iljuImg = em ? iljuImage(em.stem, em.branch) : null; // 60갑자 AI 일러스트(없으면 색+동물 폴백)
                return (
                  <ScaleDecorator>
                    <View style={[styles.row, isActive && styles.rowActive]}>
                      {iljuImg ? (
                        <Image source={iljuImg} style={styles.emblemImg} />
                      ) : (
                        <View style={[styles.emblem, { backgroundColor: em?.color ?? colors.sunk }]}>
                          <Text style={[styles.emblemTx, { color: em?.textColor ?? colors.inkSoft, fontSize: fs(13) }]}>{em?.animal ?? '?'}</Text>
                        </View>
                      )}
                      <Pressable style={styles.rowMain} onPress={() => choose(c.id)} onLongPress={drag} delayLongPress={250}>
                        <Text style={[styles.rowName, on && styles.rowOn, { fontSize: fs(15) }]}>{c.label}</Text>
                        {em ? <Text style={[styles.iljuName, { fontSize: fs(12) }]}>{em.name}</Text> : null}
                        <Text style={[styles.rowMeta, { fontSize: fs(12) }]} numberOfLines={1}>
                          {String(c.input.birthDateTime ?? '').split(' ')[0]} · {c.relation === 'self' ? t('register.selfLabel') : c.relation}
                        </Text>
                      </Pressable>
                      {on && <Text style={styles.check}>✓</Text>}
                      <Pressable hitSlop={8} onPress={() => edit(c.id)}><Text style={styles.rowAct}>{t('common.edit', '수정')}</Text></Pressable>
                      <Pressable hitSlop={8} onPress={() => remove(c.id, c.label)}><Text style={[styles.rowAct, styles.rowActDel]}>{t('common.delete', '삭제')}</Text></Pressable>
                    </View>
                  </ScaleDecorator>
                );
              }}
            />
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

  list: { maxHeight: Dimensions.get('window').height * 0.5 }, // 드래그 리스트(FlatList) 바운드 높이 — 시트 내 스크롤
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: space(3.5), borderBottomWidth: 1, borderBottomColor: colors.line, gap: space(2) },
  rowActive: { backgroundColor: colors.card, borderRadius: radius.md, borderBottomColor: 'transparent' }, // 드래그 중 행 강조(들어올림)
  rowMain: { flex: 1 },
  emblem: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', marginRight: space(3) }, // 색+동물 폴백(일러스트 없을 때)
  emblemImg: { width: 46, height: 46, borderRadius: 23, marginRight: space(3), backgroundColor: colors.sunk }, // 60갑자 AI 일러스트(원형 크롭)
  emblemTx: { fontWeight: '800' },
  iljuName: { color: colors.ju, fontWeight: '700', marginTop: 1 }, // 일주 이름 "은빛 소"
  rowAct: { fontSize: 13, fontWeight: '700', color: colors.ju, paddingHorizontal: space(1.5) }, // 수정·삭제 글자
  rowActDel: { color: '#E5484D' }, // 삭제 = 적색 강조
  rowName: { ...font.body, fontWeight: '600', color: colors.ink },
  rowOn: { color: colors.ju },
  rowMeta: { ...font.caption, flex: 1 },
  check: { fontSize: 18, color: colors.ju, fontWeight: '700' },
  addBtn: { backgroundColor: colors.ju, borderRadius: radius.md, paddingVertical: space(3.5), alignItems: 'center', marginTop: space(4) },
  addBtnText: { color: colors.bg, fontSize: 15, fontWeight: '700' },
});
