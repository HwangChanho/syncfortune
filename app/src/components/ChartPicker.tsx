// app/src/components/ChartPicker.tsx — 대표 명식 선택/전환 (홈)
// ─────────────────────────────────────────────────────────────────────────
// 홈 상단에서 현재 '대표 명식'을 보여주고, 탭하면 등록된 명식 목록(바텀시트)에서 전환.
//   대표 변경 = setRepresentative → 만세력·풀이·궁합이 그 명식 기준(loadMyChart).
// 명식이 없으면 등록 유도. 화면 복귀 시 useFocusEffect 로 목록 갱신.
// ─────────────────────────────────────────────────────────────────────────
import { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, Pressable, Modal, StyleSheet, Dimensions, ActivityIndicator, InteractionManager, Animated, LayoutAnimation } from 'react-native';
import { PressableScale } from './PressableScale';
import { Image as ExpoImage } from 'expo-image'; // 자동 다운샘플(메모리) + 엠블럼 탭 풀스크린 뷰어
import DraggableFlatList, { ScaleDecorator } from 'react-native-draggable-flatlist'; // 이슈20 롱프레스 드래그 reorder
import { Alert } from '../lib/ui/alert'; // 커스텀 알림(삭제 확인)
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { listCharts, setRepresentative, getRepresentativeId, deleteChart, reorderCharts, subscribeRepChange, type SavedChart } from '../lib/engine/myChart';
import { useSubscription } from '../lib/billing/subscription';
import { getPremiumChartIdSnapshot, subscribePremium } from '../lib/billing/premiumStore'; // 프리미엄 지정 명식(왕관·삭제경고, daniel 07-01)
import { useFontScale } from '../lib/ui/fontScale'; // 명식 헤더 글자크기 반영(daniel)
import { computeChart } from '../lib/engine/engine'; // 각 명식 일주 산출(엠블럼)
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
  const [premChartId, setPremChartId] = useState<string | null>(getPremiumChartIdSnapshot()); // 프리미엄 지정 명식 serverChartId(👑·삭제경고)

  const reload = useCallback(async () => {
    setCharts(await listCharts());
    setRepId(await getRepresentativeId());
  }, []);
  // 화면 복귀(등록 후 등) 때마다 갱신
  useFocusEffect(useCallback(() => { reload(); }, [reload]));
  // 전역 명식 변경 구독(daniel: 어디서 바꿔도 자동 동기화) — 다른 화면에서 대표가 바뀌면 이 픽커·호스트도 즉시 갱신.
  const onChangeRef = useRef(onChange); onChangeRef.current = onChange;
  useEffect(() => subscribeRepChange(() => { reload(); onChangeRef.current?.(); }), [reload]);
  useEffect(() => subscribePremium(() => setPremChartId(getPremiumChartIdSnapshot())), []); // 프리미엄 지정 변경 시 👑 갱신

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
    let ti: ReturnType<typeof setTimeout>;
    // ★순차 로딩(daniel 07-01): 한 번에 N개를 계산·렌더하면 무거워 이미지 로딩이 느림 →
    //   한 명식씩 계산해 setEmblems 로 *즉시* 반영(엠블럼·이미지가 위에서부터 하나씩 채워짐).
    let i = 0;
    const step = () => {
      if (!alive || i >= charts.length) return;
      const c = charts[i++];
      try { const p = computeChart(c.input).saju.pillars['일']; if (p) setEmblems((prev) => ({ ...prev, [c.id]: iljuEmblem(p.stem, p.branch) })); } catch { /* 계산 실패 무시 */ }
      ti = setTimeout(step, 0);                                  // 다음 명식은 다음 틱에(순차·뷰 즉시 갱신)
    };
    ti = setTimeout(step, 0);                                    // 0ms = 모달 렌더 이후로 미룸
    return () => { alive = false; clearTimeout(ti); };
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
  // 만세력 보기 → 그 명식을 대표로 설정하고 만세력(/charts) 화면으로 진입(daniel 07-01)
  async function viewManse(id: string) { await setRepresentative(id); setOpen(false); onChange?.(); router.push('/charts'); }

  // 명식 삭제 → 확인 후 deleteChart + 목록 갱신 + 호출처 알림(되돌릴 수 없음).
  function remove(id: string, label: string) {
    // ★프리미엄 지정 명식 삭제 = 프리미엄 혜택 사라짐 → 경고 필수(daniel 07-01)
    const isPrem = !!premChartId && charts.find((c) => c.id === id)?.serverChartId === premChartId;
    Alert.alert(
      t('manse.deleteTitle', '명식 삭제'),
      (isPrem ? '⚠️ 이 명식은 프리미엄이 적용된 명식이에요.\n삭제하면 프리미엄 혜택이 사라지니 신중히 결정하세요.\n\n' : '') + (t('manse.deleteMsg', { label, defaultValue: `'${label}' 명식을 삭제할까요? 되돌릴 수 없어요.` }) as string),
      [
        { text: t('common.cancel', '취소'), style: 'cancel' },
        { text: t('common.delete', '삭제'), style: 'destructive', onPress: async () => { await deleteChart(id); await reload(); onChange?.(); } },
      ],
    );
  }

  // 명식 없음 — 등록 유도
  if (!charts.length) {
    return (
      <PressableScale style={styles.bar} onPress={() => router.push('/register')}>
        <Text style={styles.barLabel}>{t('manse.myChart')}</Text>
        <Text style={styles.barAdd}>＋ {t('compat.registerMyChart')}</Text>
      </PressableScale>
    );
  }

  return (
    <>
      <PressableScale style={styles.bar} onPress={() => setOpen(true)}>
        <Text style={[styles.barLabel, { fontSize: fs(12) }]}>{t('manse.myChart')}</Text>
        <Text style={[styles.barName, { fontSize: fs(15) }]}>{rep?.label} ▾</Text>
      </PressableScale>

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
              // 마지막 행 ⋯ 메뉴(수정/삭제)가 하단에 잘리지 않도록 여유(daniel 07-02)
              contentContainerStyle={{ paddingBottom: space(14) }}
              showsVerticalScrollIndicator={false}
              activationDistance={14}
              onDragEnd={({ data }) => onDragEnd(data)}
              renderItem={({ item: c, drag, isActive }) => {
                const on = c.id === repId;
                const em = emblems[c.id];
                const iljuImg = em ? iljuImage(em.stem, em.branch) : null; // 60갑자 AI 일러스트(없으면 색+동물 폴백)
                return (
                  <ScaleDecorator>
                    <View style={[styles.row, isActive && styles.rowActive, actionsFor === c.id && styles.rowMenuOpen]}>
                      {!em ? (
                        <SkeletonDot /> /* 펄스 스켈레톤 — 엠블럼 계산 전(딜레이 가림) */
                      ) : iljuImg ? (
                        <PressableScale onPress={() => setViewImg(iljuImg)} hitSlop={6} style={styles.emblemImg}>
                          <ExpoImage source={iljuImg} style={[StyleSheet.absoluteFill, { borderRadius: 23 }]} contentFit="cover" cachePolicy="memory-disk" transition={250}
                            onLoadEnd={() => setLoadedEmblems((s) => { const n = new Set(s); n.add(c.id); return n; })} />
                          {/* 이미지 디코드 중 로딩 인디케이터(daniel: 명식변경 리스트 이미지 로딩 표시) — 로드되면 사라짐 */}
                          {!loadedEmblems.has(c.id) && <ActivityIndicator size="small" color={colors.ju} style={StyleSheet.absoluteFill} />}
                        </PressableScale>
                      ) : (
                        <View style={[styles.emblem, { backgroundColor: em.color }]}>
                          <Text style={[styles.emblemTx, { color: em.textColor, fontSize: fs(13) }]}>{em.animal}</Text>
                        </View>
                      )}
                      <PressableScale style={styles.rowMain} onPress={() => choose(c.id)} onLongPress={drag} delayLongPress={250}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(1.5) }}>
                          <Text style={[styles.rowName, on && styles.rowOn, { fontSize: fs(15) }]} numberOfLines={1}>{c.label}</Text>
                          {/* ★프리미엄 지정 명식 배지(daniel 07-02: 명식 옆에 프리미엄 여부) — 골드 왕관 배지 */}
                          {!!premChartId && c.serverChartId === premChartId && (
                            <View style={styles.premBadge}><Text style={styles.premBadgeTx}>👑 프리미엄</Text></View>
                          )}
                        </View>
                        {em ? <Text style={[styles.iljuName, { fontSize: fs(12) }]}>{em.name}</Text> : null}
                        <Text style={[styles.rowMeta, { fontSize: fs(12) }]} numberOfLines={1}>
                          {String(c.input.birthDateTime ?? '').replace('T', ' ').slice(0, 16)}{/* 날짜+시간(daniel: 시간도 노출) */}
                        </Text>
                      </PressableScale>
                      {/* 카테고리(관계)를 행 우측에 배지로(daniel: 카테고리도 오른쪽에) */}
                      <Text style={[styles.rowCategory, { fontSize: fs(11) }]} numberOfLines={1}>{c.relation === 'self' ? t('register.selfLabel') : c.relation}</Text>
                      {on && <Text style={styles.check}>✓</Text>}
                      {/* ⋯ 토글 → 작은 세로 메뉴(수정·만세력보기·삭제). 삭제는 항상 재확인 alert(daniel 07-01) */}
                      <View style={styles.actWrap}>
                        <PressableScale hitSlop={10} onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setActionsFor(actionsFor === c.id ? null : c.id); }}>
                          <Text style={[styles.rowAct, { fontSize: 18 }]}>⋯</Text>
                        </PressableScale>
                        {actionsFor === c.id && (
                          <View style={styles.actMenu}>
                            <PressableScale style={styles.actItem} hitSlop={6} onPress={() => { setActionsFor(null); edit(c.id); }}><Text style={styles.rowAct}>{t('common.edit', '수정')}</Text></PressableScale>
                            <PressableScale style={styles.actItem} hitSlop={6} onPress={() => { setActionsFor(null); viewManse(c.id); }}><Text style={styles.rowAct}>{t('manse.viewManse', '만세력보기')}</Text></PressableScale>
                            <PressableScale style={styles.actItem} hitSlop={6} onPress={() => { setActionsFor(null); remove(c.id, c.label); }}><Text style={[styles.rowAct, styles.rowActDel]}>{t('common.delete', '삭제')}</Text></PressableScale>
                          </View>
                        )}
                      </View>
                    </View>
                  </ScaleDecorator>
                );
              }}
            />
            )}
            <PressableScale style={styles.addBtn} onPress={() => { setOpen(false); router.push('/register'); }}>
              <Text style={styles.addBtnText}>＋ {t('compat.registerMyChart')}</Text>
            </PressableScale>
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
  // ⋯ 토글 드롭다운(수정·만세력보기·삭제) — 작은 세로 리스트(daniel 07-01)
  actWrap: { position: 'relative', alignItems: 'flex-end', justifyContent: 'center' },
  // ⋯ 드롭다운 — 완전 불투명(alpha 1)·그림자로 또렷하게 떠보이게(daniel 07-02: 알파값 1). bg=불투명 미드나잇 카드.
  actMenu: { position: 'absolute', top: 26, right: 0, minWidth: 108, backgroundColor: colors.card, opacity: 1, borderRadius: radius.md, borderWidth: 1, borderColor: colors.juLine, paddingVertical: space(1), zIndex: 50, ...shadow.card, elevation: 12 },
  actItem: { paddingVertical: space(2.25), paddingHorizontal: space(3.5) },
  rowMenuOpen: { zIndex: 50 }, // 메뉴 열린 행을 다른 행 위로
  // 프리미엄 지정 명식 배지(골드) — 명식 옆에 프리미엄 여부(daniel 07-02)
  premBadge: { backgroundColor: colors.ju, borderRadius: radius.pill, paddingHorizontal: space(2), paddingVertical: 1, overflow: 'hidden' },
  premBadgeTx: { color: colors.bg, fontSize: 10, fontWeight: '900' },
  rowName: { ...font.body, fontWeight: '600', color: colors.ink },
  rowOn: { color: colors.ju },
  rowMeta: { ...font.caption, flex: 1 },
  rowCategory: { ...font.caption, color: colors.inkFaint, marginHorizontal: space(1.5) }, // 관계 카테고리 우측 배지(daniel)
  check: { fontSize: 18, color: colors.ju, fontWeight: '700' },
  addBtn: { backgroundColor: colors.ju, borderRadius: radius.md, paddingVertical: space(3.5), alignItems: 'center', marginTop: space(4) },
  addBtnText: { color: colors.bg, fontSize: 15, fontWeight: '700' },
});
