// app/src/components/ChartPicker.tsx — 대표 명식 선택/전환 (홈)
// ─────────────────────────────────────────────────────────────────────────
// 홈 상단에서 현재 '대표 명식'을 보여주고, 탭하면 등록된 명식 목록(바텀시트)에서 전환.
//   대표 변경 = setRepresentative → 만세력·풀이·궁합이 그 명식 기준(loadMyChart).
// 명식이 없으면 등록 유도. 화면 복귀 시 useFocusEffect 로 목록 갱신.
// ─────────────────────────────────────────────────────────────────────────
import { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, Pressable, Modal, StyleSheet, Dimensions, ActivityIndicator, InteractionManager, Animated } from 'react-native';
import { Image as ExpoImage } from 'expo-image'; // 자동 다운샘플(메모리) + 엠블럼 탭 풀스크린 뷰어
import DraggableFlatList, { ScaleDecorator } from 'react-native-draggable-flatlist'; // 이슈20 롱프레스 드래그 reorder
import { Alert } from '../lib/alert'; // 커스텀 알림(삭제 확인)
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { listCharts, setRepresentative, getRepresentativeId, deleteChart, reorderCharts, subscribeRepChange, type SavedChart } from '../lib/myChart';
import { useSubscription } from '../lib/subscription';
import { useFontScale } from '../lib/fontScale'; // 명식 헤더 글자크기 반영(daniel)
import { computeChart } from '../lib/engine'; // 각 명식 일주 산출(엠블럼)
import { iljuEmblem, iljuImage, type IljuEmblem } from '../lib/dayPillarEmblem'; // 일주 엠블럼(은빛 소 등) + 60갑자 AI 일러스트
import { colors, radius, space, shadow, font } from '../lib/theme';

// 엠블럼 로딩 스켈레톤 — 펄스(opacity 0.4↔0.85) 애니(daniel: 스켈레톤도 살아있게).
function SkeletonDot() {
  const a = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(a, { toValue: 0.85, duration: 700, useNativeDriver: true }),
      Animated.timing(a, { toValue: 0.4, duration: 700, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [a]);
  return <Animated.View style={[styles.emblem, styles.emblemSkel, { opacity: a }]} />;
}

export function ChartPicker({ onChange }: { onChange?: () => void }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { isPremium } = useSubscription(); // 프로 = 무제한(사용량 배지 숨김)
  const { fs } = useFontScale();           // 명식 헤더 글자크기(설정 반영)
  const [charts, setCharts] = useState<SavedChart[]>([]);
  const [repId, setRepId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [listReady, setListReady] = useState(false); // 모달 열림 직후 스피너 → 리스트는 인터랙션 후 마운트(daniel: 명식 버튼 로딩 표시)
  const [viewImg, setViewImg] = useState<any>(null); // 엠블럼 탭 → 풀스크린 이미지 뷰어(daniel)
  const [loadedEmblems, setLoadedEmblems] = useState<Set<string>>(new Set()); // 엠블럼 이미지 디코드 완료 — 로딩 인디케이터용(daniel: 명식변경 리스트 이미지 로딩 표시)
  const [actionsFor, setActionsFor] = useState<string | null>(null); // 수정/삭제 펼친 행(daniel: 한 버튼 ⋯ 탭 → 수정·삭제 분리)

  const reload = useCallback(async () => {
    setCharts(await listCharts());
    setRepId(await getRepresentativeId());
  }, []);
  // 화면 복귀(등록 후 등) 때마다 갱신
  useFocusEffect(useCallback(() => { reload(); }, [reload]));
  // 전역 명식 변경 구독(daniel: 어디서 바꿔도 자동 동기화) — 다른 화면에서 대표가 바뀌면 이 픽커·호스트도 즉시 갱신.
  const onChangeRef = useRef(onChange); onChangeRef.current = onChange;
  useEffect(() => subscribeRepChange(() => { reload(); onChangeRef.current?.(); }), [reload]);

  const rep = charts.find((c) => c.id === repId) ?? charts[0];
  // 각 명식의 일주 엠블럼(일간 오행색 + 일지 동물 = "은빛 소" 등) — 명식 리스트 시각 정체성(daniel)
  // ⚡성능(daniel "모든 로딩 느려"): 엠블럼은 명식 목록 모달 열 때만 보임(접힌 바엔 없음). 매 화면 마운트마다
  //   명식 N개를 풀 엔진(사주+자미)으로 계산하던 것을 open=true 일 때만으로 → 매 화면 비용 제거.(computeChart도 메모됨)
  // ⚡스켈레톤(daniel): 모달 열 때 N명식 엠블럼을 *동기*로 계산하면 모달 슬라이드/리스트 렌더가 지연됨(딜레이).
  //   → setTimeout(0)으로 다음 틱에 계산 → 리스트는 즉시 올라오고(엠블럼은 스켈레톤 원), 계산 끝나면 채워짐.
  const [emblems, setEmblems] = useState<Record<string, IljuEmblem>>({});
  useEffect(() => {
    if (!open) { setEmblems({}); return; }                       // 닫히면 초기화(다음 열 때 다시 스켈레톤→계산)
    let alive = true;
    const tid = setTimeout(() => {
      const m: Record<string, IljuEmblem> = {};
      charts.forEach((c) => { try { const p = computeChart(c.input).saju.pillars['일']; if (p) m[c.id] = iljuEmblem(p.stem, p.branch); } catch { /* 계산 실패 무시 */ } });
      if (alive) setEmblems(m);
    }, 0);                                                        // 0ms = 모달 렌더 이후로 무거운 계산을 미룸
    return () => { alive = false; clearTimeout(tid); };
  }, [charts, open]);
  // daniel: 명식 버튼 누를 때 로딩 표시 — 모달은 즉시 열려 스피너를 보이고, 무거운 리스트(DraggableFlatList)는 슬라이드가 끝난 뒤 마운트.
  useEffect(() => {
    if (!open) { setListReady(false); return; }
    const h = InteractionManager.runAfterInteractions(() => setListReady(true));
    return () => h.cancel();
  }, [open]);

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
              {/* 디바이스 명식 무제한(daniel 2026-06-23) — 사용량/한도(15/10) 배지 제거 */}
            </View>
            {charts.length > 1 && <Text style={{ ...font.caption, color: colors.inkFaint, marginBottom: space(2) }}>명식을 길게 눌러 끌면 순서가 바뀌어요</Text>}
            {/* 이슈20: 롱프레스→드래그 reorder. 끌어 놓으면 onDragEnd가 저장·계정동기화(별도 모드/저장버튼 없음). */}
            {/* daniel: 무거운 리스트 마운트 전까지 스피너 — 명식 버튼 누르면 모달 즉시 열려 로딩 표시 */}
            {!listReady ? (
              <View style={{ height: 200, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={colors.ju} /></View>
            ) : (
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
                      {!em ? (
                        <SkeletonDot /> /* 펄스 스켈레톤 — 엠블럼 계산 전(딜레이 가림) */
                      ) : iljuImg ? (
                        <Pressable onPress={() => setViewImg(iljuImg)} hitSlop={6} style={styles.emblemImg}>
                          <ExpoImage source={iljuImg} style={[StyleSheet.absoluteFill, { borderRadius: 23 }]} contentFit="cover" cachePolicy="memory-disk" transition={250}
                            onLoadEnd={() => setLoadedEmblems((s) => { const n = new Set(s); n.add(c.id); return n; })} />
                          {/* 이미지 디코드 중 로딩 인디케이터(daniel: 명식변경 리스트 이미지 로딩 표시) — 로드되면 사라짐 */}
                          {!loadedEmblems.has(c.id) && <ActivityIndicator size="small" color={colors.ju} style={StyleSheet.absoluteFill} />}
                        </Pressable>
                      ) : (
                        <View style={[styles.emblem, { backgroundColor: em.color }]}>
                          <Text style={[styles.emblemTx, { color: em.textColor, fontSize: fs(13) }]}>{em.animal}</Text>
                        </View>
                      )}
                      <Pressable style={styles.rowMain} onPress={() => choose(c.id)} onLongPress={drag} delayLongPress={250}>
                        <Text style={[styles.rowName, on && styles.rowOn, { fontSize: fs(15) }]}>{c.label}</Text>
                        {em ? <Text style={[styles.iljuName, { fontSize: fs(12) }]}>{em.name}</Text> : null}
                        <Text style={[styles.rowMeta, { fontSize: fs(12) }]} numberOfLines={1}>
                          {String(c.input.birthDateTime ?? '').replace('T', ' ').slice(0, 16)}{/* 날짜+시간(daniel: 시간도 노출) */}
                        </Text>
                      </Pressable>
                      {/* 카테고리(관계)를 행 우측에 배지로(daniel: 카테고리도 오른쪽에) */}
                      <Text style={[styles.rowCategory, { fontSize: fs(11) }]} numberOfLines={1}>{c.relation === 'self' ? t('register.selfLabel') : c.relation}</Text>
                      {on && <Text style={styles.check}>✓</Text>}
                      {/* 한 버튼(⋯) → 탭하면 수정·삭제로 분리(daniel) */}
                      {actionsFor === c.id ? (
                        <>
                          <Pressable hitSlop={8} onPress={() => { setActionsFor(null); edit(c.id); }}><Text style={styles.rowAct}>{t('common.edit', '수정')}</Text></Pressable>
                          <Pressable hitSlop={8} onPress={() => { setActionsFor(null); remove(c.id, c.label); }}><Text style={[styles.rowAct, styles.rowActDel]}>{t('common.delete', '삭제')}</Text></Pressable>
                        </>
                      ) : (
                        <Pressable hitSlop={10} onPress={() => setActionsFor(c.id)}><Text style={[styles.rowAct, { fontSize: 18 }]}>⋯</Text></Pressable>
                      )}
                    </View>
                  </ScaleDecorator>
                );
              }}
            />
            )}
            <Pressable style={styles.addBtn} onPress={() => { setOpen(false); router.push('/register'); }}>
              <Text style={styles.addBtnText}>＋ {t('compat.registerMyChart')}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* 엠블럼 풀스크린 뷰어(daniel) — 일주 일러스트 탭 → 큰 화면, 다시 탭하면 닫힘 */}
      <Modal visible={!!viewImg} transparent animationType="fade" onRequestClose={() => setViewImg(null)}>
        <Pressable style={styles.imgViewerBackdrop} onPress={() => setViewImg(null)}>
          {viewImg ? <ExpoImage source={viewImg} style={styles.imgViewerImg} contentFit="contain" cachePolicy="memory-disk" transition={150} /> : null}
          <Text style={styles.imgViewerHint}>{t('common.tapToClose', '탭하여 닫기')}</Text>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  // 엠블럼 풀스크린 뷰어(daniel) — 탭하면 큰 화면으로 일주 일러스트 감상
  imgViewerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
  imgViewerImg: { width: Dimensions.get('window').width, height: Dimensions.get('window').height * 0.8 },
  imgViewerHint: { position: 'absolute', bottom: space(10), color: 'rgba(255,255,255,0.55)', fontSize: 13 },
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
  emblemSkel: { backgroundColor: colors.sunk, opacity: 0.55 }, // 스켈레톤(엠블럼 계산 전 — 리스트는 즉시 표시, 딜레이 가림)
  emblemImg: { width: 46, height: 46, borderRadius: 23, marginRight: space(3), backgroundColor: colors.sunk }, // 60갑자 AI 일러스트(원형 크롭)
  emblemTx: { fontWeight: '800' },
  iljuName: { color: colors.ju, fontWeight: '700', marginTop: 1 }, // 일주 이름 "은빛 소"
  rowAct: { fontSize: 13, fontWeight: '700', color: colors.ju, paddingHorizontal: space(1.5) }, // 수정·삭제 글자
  rowActDel: { color: '#E5484D' }, // 삭제 = 적색 강조
  rowName: { ...font.body, fontWeight: '600', color: colors.ink },
  rowOn: { color: colors.ju },
  rowMeta: { ...font.caption, flex: 1 },
  rowCategory: { ...font.caption, color: colors.inkFaint, marginHorizontal: space(1.5) }, // 관계 카테고리 우측 배지(daniel)
  check: { fontSize: 18, color: colors.ju, fontWeight: '700' },
  addBtn: { backgroundColor: colors.ju, borderRadius: radius.md, paddingVertical: space(3.5), alignItems: 'center', marginTop: space(4) },
  addBtnText: { color: colors.bg, fontSize: 15, fontWeight: '700' },
});
