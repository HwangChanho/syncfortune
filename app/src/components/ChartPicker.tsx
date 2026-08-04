// app/src/components/ChartPicker.tsx — 대표 명식 선택/전환 (홈)
// ─────────────────────────────────────────────────────────────────────────
// 홈 상단에서 현재 '대표 명식'을 보여주고, 탭하면 등록된 명식 목록(바텀시트)에서 전환.
//   대표 변경 = setRepresentative → 만세력·풀이·궁합이 그 명식 기준(loadMyChart).
// 명식이 없으면 등록 유도. 화면 복귀 시 useFocusEffect 로 목록 갱신.
// ─────────────────────────────────────────────────────────────────────────
import { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, Pressable, Modal, StyleSheet, Dimensions, ActivityIndicator, InteractionManager, Animated, ScrollView, TextInput } from 'react-native';
import { CoinBadge } from './CoinBadge';   // 보유 운 배지(단일 구현 재사용)
import { PressableScale } from './PressableScale';
import { Image as ExpoImage } from 'expo-image'; // 자동 다운샘플(메모리) + 엠블럼 탭 풀스크린 뷰어
import DraggableFlatList, { ScaleDecorator } from 'react-native-draggable-flatlist'; // 이슈20 롱프레스 드래그 reorder
import type { FlatList as GHFlatList } from 'react-native-gesture-handler'; // DraggableFlatList 가 넘겨주는 ref 실체(scrollToOffset)
import { Alert } from '../lib/ui/alert'; // 커스텀 알림(삭제 확인)
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { listCharts, setRepresentative, getRepresentativeId, deleteChart, reorderCharts, subscribeRepChange, type SavedChart } from '../lib/engine/myChart';
import { getPremiumChartIdSnapshot, subscribePremium } from '../lib/billing/premiumStore'; // 프리미엄 지정 명식(왕관·삭제경고, daniel 07-01)
import { useFontScale } from '../lib/ui/fontScale'; // 명식 헤더 글자크기 반영(daniel)
import { computeChart } from '../lib/engine/engine'; // 각 명식 일주 산출(엠블럼)
import { iljuEmblem, iljuImage, type IljuEmblem } from '../lib/dayPillarEmblem'; // 일주 엠블럼(은빛 소 등) + 60갑자 AI 일러스트
import { colors, radius, space, shadow, font } from '../lib/theme';

// 엠블럼 로딩 스켈레톤 — 펄스(opacity 0.4↔0.85) 애니(daniel: 스켈레톤도 살아있게).
/** 엠블럼 지름 — 글자 배율에 비례(최소 46 · 상한 72). 행 높이와 텍스트 칸이 함께 커지도록. */
function embSize(fs: (n: number) => number): number {
  return Math.max(46, Math.min(72, Math.round(fs(46))));
}

function SkeletonDot({ d }: { d: number }) {
  const a = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(a, { toValue: 0.85, duration: 700, useNativeDriver: true }),
      Animated.timing(a, { toValue: 0.4, duration: 700, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [a]);
  return <Animated.View style={[styles.emblem, styles.emblemSkel, { width: d, height: d, borderRadius: d / 2, opacity: a }]} />;
}

// ★일주 엠블럼 캐시(daniel 2026-07-29 "명식 리스트 이미지 로딩 너무 오래걸리는데").
//   원인: 모달을 **닫을 때마다 setEmblems({}) 로 전부 버려서**, 다시 열면 N개 명식을
//   computeChart 로 처음부터 순차 재계산했다(명식 29개면 29틱 + 엔진 29회).
//   → 컴포넌트 **밖**(모듈 레벨)에 캐시를 두면 언마운트·재열기에도 살아남아 두 번째부터 즉시 뜬다.
//   ⚠️키에 input 을 포함한다 — 명식을 **수정하면 id 는 같고 내용만 바뀌므로**, id 만 쓰면 옛 엠블럼이 굳는다.
const emblemCache = new Map<string, IljuEmblem>();
const emblemKey = (c: { id: string; input: unknown }) => `${c.id}:${JSON.stringify(c.input)}`;

// ★리스트 이미지 **선(先)적재**(daniel 2026-08-02 "이미지 로드할 때 너무 오래 걸려").
//   무엇이 달라졌나: 08-01 에 일러스트를 번들에서 Storage 로 옮겼다(앱 용량·디코딩 때문).
//   그 대가로 **처음 여는 순간 N장을 네트워크로 받게** 됐다 — 캐시가 비어 있으니 스켈레톤이 오래 남는다.
//   → 목록을 여는 건 사용자가 정하지만, *받아 두는 건 미리 할 수 있다*. 바가 떠 있는 동안
//     한가한 틈에 엠블럼을 계산하고 이미지를 디스크 캐시에 밀어 넣는다. 그러면 열 때는 캐시 히트다.
//   왜 모듈 레벨 플래그인가: ChartPicker 는 화면마다 마운트된다. 앱 세션당 **한 번만** 데우면 된다.
//   ⚠️계산은 반드시 **틱을 나눠서** — 명식 29개를 한 루프에 돌리면 그게 곧 렉이다(고치려던 문제를 재현).
let warmedOnce = false;

export function ChartPicker({ onChange }: { onChange?: () => void }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { fs } = useFontScale();
  const EMB = embSize(fs);   // 엠블럼 지름 — 글자 배율 연동(행 높이와 어긋나지 않게)           // 명식 헤더 글자크기(설정 반영)
  const [charts, setCharts] = useState<SavedChart[]>([]);
  const [repId, setRepId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [listReady, setListReady] = useState(false); // 모달 열림 직후 스피너 → 리스트는 인터랙션 후 마운트(daniel: 명식 버튼 로딩 표시)
  const [viewImg, setViewImg] = useState<any>(null); // 엠블럼 탭 → 풀스크린 이미지 뷰어(daniel)
  const [loadedEmblems, setLoadedEmblems] = useState<Set<string>>(new Set()); // 엠블럼 이미지 디코드 완료 — 로딩 인디케이터용(daniel: 명식변경 리스트 이미지 로딩 표시)
  const [actionsFor, setActionsFor] = useState<string | null>(null); // 수정/삭제 펼친 행(daniel: 한 버튼 ⋯ 탭 → 수정·삭제 분리)
  const [premChartId, setPremChartId] = useState<string | null>(getPremiumChartIdSnapshot()); // 프리미엄 지정 명식 serverChartId(👑·삭제경고)
  const [catFilter, setCatFilter] = useState<string | null>(null); // 카테고리(관계) 필터 — null=전체보기(daniel: 전체보기+카테고리별 보기)
  const [query, setQuery] = useState(''); // ★이름 검색(daniel 2026-08-04 "명식 리스트에서 검색으로도 찾을 수 있게") — 이름(label)만 대조

  const reload = useCallback(async () => {
    // ★둘을 **함께** 세팅한다(daniel 2026-08-03 "몇 번을 말해도 그대로여").
    //   종전엔 setCharts 뒤에 await 가 있어 **목록은 있는데 대표 id 는 아직 없는 프레임**이 생겼다.
    //   그 프레임에서 첫 행 onLayout 이 돌아 '대표를 못 찾음'으로 판정하고, 아래 scrolledRef 가
    //   이미 켜져 다시는 시도하지 않았다 — 그래서 늘 맨 위에서 열렸다.
    const [cs, rid] = await Promise.all([listCharts(), getRepresentativeId()]);
    setCharts(cs);
    setRepId(rid);
  }, []);
  // 화면 복귀(등록 후 등) 때마다 갱신 + 화면 이탈 시 열린 시트·액션시트 강제 닫힘(daniel 07-05: 뷰 바뀌면 자동으로 사라져야).
  useFocusEffect(useCallback(() => { reload(); return () => { setOpen(false); setActionsFor(null); }; }, [reload]));
  // ★토글형 뷰 auto-dismiss(daniel 07-05): 시트가 닫히면 열려있던 ⋯ 액션시트도 반드시 함께 닫는다(stale 열림 방지).
  useEffect(() => { if (!open) setActionsFor(null); }, [open]);
  // 전역 명식 변경 구독(daniel: 어디서 바꿔도 자동 동기화) — 다른 화면에서 대표가 바뀌면 이 픽커·호스트도 즉시 갱신.
  const onChangeRef = useRef(onChange); onChangeRef.current = onChange;
  useEffect(() => subscribeRepChange(() => { reload(); onChangeRef.current?.(); }), [reload]);
  useEffect(() => subscribePremium(() => setPremChartId(getPremiumChartIdSnapshot())), []); // 프리미엄 지정 변경 시 👑 갱신

  const rep = charts.find((c) => c.id === repId) ?? charts[0];
  // ── 카테고리(관계)별 보기 ──────────────────────────────────────────────
  //   relation 은 자유 문자열('self'·'가족'·'연인'·'기타'…)이라 고정 목록 대신 *저장된 명식에서 동적 추출*.
  //   → 관계 옵션이 나중에 바뀌어도 자동 반영. 등장 순서 보존(첫 등장 순).
  const relOf = (c: SavedChart) => c.relation || 'self';
  const relLabel = useCallback((r: string) => (r === 'self' ? t('register.selfLabel', '본인') : r), [t]);
  const categories = charts.reduce<string[]>((acc, c) => { const r = relOf(c); if (!acc.includes(r)) acc.push(r); return acc; }, []);
  // 필터 바는 카테고리가 2종 이상일 때만(전부 같은 관계면 필터가 무의미 — 예: 본인 명식만 있는 경우).
  const showFilter = categories.length >= 2;
  // 선택된 필터로 표시 목록을 좁힌다(null=전체). 필터 중이면 드래그 순서변경은 막는다(부분집합 드래그가 전체 순서를 꼬이게 함).
  // 검색은 공백·대소문자 무시(한글엔 대소문자가 없지만 영문 이름 등록도 있다).
  const q = query.trim().toLowerCase();
  const byCat = catFilter ? charts.filter((c) => relOf(c) === catFilter) : charts;
  const shown = q ? byCat.filter((c) => (c.label ?? '').toLowerCase().includes(q)) : byCat;
  // ★검색 중에도 '부분집합' — 드래그 저장이 전체 순서를 꼬이게 하는 건 카테고리 필터와 동일하므로 같은 게이트를 탄다.
  const filtering = catFilter != null || q.length > 0;
  // 필터한 카테고리의 명식이 모두 삭제되면(유령 필터) 전체로 되돌린다. 모달 닫히면 필터도 초기화.
  useEffect(() => { if (catFilter && !categories.includes(catFilter)) setCatFilter(null); }, [charts, catFilter, categories]);
  useEffect(() => { if (!open) setQuery(''); }, [open]); // 닫으면 검색 초기화 — 다음에 열 때 '명식이 줄어든' 것처럼 보이는 오인 방지
  useEffect(() => { if (!open) setCatFilter(null); }, [open]);
  // 각 명식의 일주 엠블럼(일간 오행색 + 일지 동물 = "은빛 소" 등) — 명식 리스트 시각 정체성(daniel)
  // ⚡성능(daniel "모든 로딩 느려"): 엠블럼은 명식 목록 모달 열 때만 보임(접힌 바엔 없음). 매 화면 마운트마다
  //   명식 N개를 풀 엔진(사주+자미)으로 계산하던 것을 open=true 일 때만으로 → 매 화면 비용 제거.(computeChart도 메모됨)
  // ⚡스켈레톤(daniel): 모달 열 때 N명식 엠블럼을 *동기*로 계산하면 모달 슬라이드/리스트 렌더가 지연됨(딜레이).
  //   → setTimeout(0)으로 다음 틱에 계산 → 리스트는 즉시 올라오고(엠블럼은 스켈레톤 원), 계산 끝나면 채워짐.
  const [emblems, setEmblems] = useState<Record<string, IljuEmblem>>({});
  useEffect(() => {
    if (!open) return;              // ★닫아도 계산 결과를 **버리지 않는다**(아래 캐시) — 다시 열면 즉시 뜬다
    // ① 캐시에 있는 건 **한 번에** 반영(스켈레톤 없이 즉시). 두 번째 열기부터는 여기서 끝난다.
    const cached: Record<string, IljuEmblem> = {};
    const todo: typeof charts = [];
    for (const c of charts) {
      const hit = emblemCache.get(emblemKey(c));
      if (hit) cached[c.id] = hit; else todo.push(c);
    }
    if (Object.keys(cached).length) setEmblems((prev) => ({ ...prev, ...cached }));
    if (!todo.length) return;

    let alive = true;
    let ti: ReturnType<typeof setTimeout>;
    // ② 아직 없는 것만 순차 계산(daniel 07-01): 한 번에 N개를 계산·렌더하면 무거워 로딩이 느리다 →
    //    한 명식씩 계산해 setEmblems 로 *즉시* 반영(위에서부터 하나씩 채워짐).
    let i = 0;
    const step = () => {
      if (!alive || i >= todo.length) return;
      const c = todo[i++];
      try {
        const p = computeChart(c.input).saju.pillars['일'];
        if (p) {
          const em = iljuEmblem(p.stem, p.branch);
          emblemCache.set(emblemKey(c), em);                     // ★캐시에 적재 — 다음 열기부터 계산 0
          setEmblems((prev) => ({ ...prev, [c.id]: em }));
        }
      } catch { /* 계산 실패 무시 */ }
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

  // ★엠블럼 이미지 선적재 — 위 warmedOnce 주석 참조. 모달을 열기 *전*에 디스크 캐시를 채운다.
  //   순서: 인터랙션이 끝난 뒤 시작 → 명식 하나씩(틱 분리) 계산 → 이미지 URL 이 나오는 즉시 프리페치.
  //   실패는 전부 무시한다(다음에 리스트에서 정상 경로로 다시 받는다) — 데우기는 **최적화지 정확성이 아니다**.
  useEffect(() => {
    if (warmedOnce || !charts.length) return;
    warmedOnce = true;
    const snapshot = charts;
    let alive = true;
    let ti: ReturnType<typeof setTimeout>;
    const h = InteractionManager.runAfterInteractions(() => {
      let i = 0;
      const step = () => {
        if (!alive || i >= snapshot.length) return;
        const c = snapshot[i++];
        try {
          let em = emblemCache.get(emblemKey(c));
          if (!em) {
            const p = computeChart(c.input).saju.pillars['일'];
            if (p) { em = iljuEmblem(p.stem, p.branch); emblemCache.set(emblemKey(c), em); }
          }
          // 원격 이미지면 `{ uri }` — 그 URL 만 디스크 캐시에 미리 받아 둔다(번들 require 면 uri 가 없어 건너뜀).
          const img = em ? iljuImage(em.stem, em.branch) : null;
          if (img?.uri) void ExpoImage.prefetch(img.uri as string).catch(() => {});
        } catch { /* 계산·네트워크 실패는 무시 — 리스트에서 정상 경로로 다시 시도한다 */ }
        ti = setTimeout(step, 0); // ★한 명식 = 한 틱. 한 루프에 몰면 그게 렉이다.
      };
      ti = setTimeout(step, 0);
    });
    return () => { alive = false; h.cancel(); clearTimeout(ti); };
  }, [charts]);

  // ★목록을 열면 **지금 보고 있는 명식 자리에서** 시작한다(daniel 2026-08-02
  //   "명식창 들어가면 현재 설정된 명식 위치에서 시작해야 해, 좌표가 처음부터 아니고").
  //   명식이 많으면 맨 위에서 열려 매번 찾아 내려가야 했다.
  //   행 높이는 글자 배율·엠블럼 크기에 따라 달라져 **상수로 추정하면 어긋난다** → 첫 행의 실제
  //   onLayout 높이를 재서 offset 을 계산한다(추정이 아니라 실측).
  const listRef = useRef<GHFlatList<SavedChart> | null>(null);
  const rowHRef = useRef(0);     // 실측 행 높이(첫 행 onLayout)
  const scrolledRef = useRef(false); // 열림 1회당 한 번만 이동(사용자가 스크롤한 뒤 끌어올리지 않도록)
  useEffect(() => { if (!open) { scrolledRef.current = false; } }, [open]);
  const scrollToRep = useCallback(() => {
    if (scrolledRef.current) return;
    // ★아직 판단할 재료가 없으면 **표시하지 않고 물러난다**(다음 기회에 다시 불린다).
    //   종전엔 재료가 없어도 scrolledRef 를 켜 버려서, 첫 시도가 헛돌면 영영 안 움직였다.
    if (!rowHRef.current || !repId || !shown.length) return;
    const idx = shown.findIndex((c) => c.id === repId);
    if (idx < 0) return;                 // 필터 중이라 목록에 없다 — 이것도 '판단 못 함'이다
    scrolledRef.current = true;          // 여기서부터가 진짜 '한 번 판단했다'
    if (idx < 3) return; // 위쪽 3개는 이미 화면에 있다 — 굳이 움직이면 오히려 어색하다
    // 선택한 행 바로 위 한 줄을 남겨 "여기서 이어진다"는 맥락을 준다.
    try { listRef.current?.scrollToOffset({ offset: (idx - 1) * rowHRef.current, animated: false }); } catch { /* 리스트가 아직 준비 전이면 무시 */ }
  }, [shown, repId]);
  // ★두 번째 열기부터의 경로 — 행 높이는 이미 재 뒀으니 onLayout 의 `!rowHRef.current` 가 막아 스크롤이 안 걸린다.
  //   리스트가 마운트되는 시점에 한 번 더 시도한다(첫 열기 땐 높이가 0이라 여기선 그냥 빠지고 onLayout 이 처리).
  //   rAF = FlatList 가 내용을 붙인 다음 프레임에 이동(붙기 전에 부르면 offset 이 먹지 않는다).
  useEffect(() => {
    if (!open || !listReady) return;
    const r = requestAnimationFrame(() => scrollToRep());
    return () => cancelAnimationFrame(r);
  }, [open, listReady, scrollToRep]);

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
      (isPrem ? '⚠️ 이 명식에는 열어 둔 풀이가 있어요.\n삭제하면 그 풀이도 함께 사라지니 신중히 결정하세요.\n\n' : '') + (t('manse.deleteMsg', { label, defaultValue: `'${label}' 명식을 삭제할까요? 되돌릴 수 없어요.` }) as string),
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
        {/* ★이름 왼쪽 보유코인(daniel 2026-07-29) — 풀이는 **명식마다** 따로 결제된다(reading_unlocks 가
            chart_id 단위). 그래서 명식을 바꾸는 바로 그 자리에서 잔액이 보여야 "다른 명식은 또 내야 하나"를
            누르기 전에 안다. CoinBadge 재사용(신규 발명 아님) — 탭하면 충전으로 간다. */}
        <View style={styles.barRight}>
          <CoinBadge />
          <Text style={[styles.barName, { fontSize: fs(15) }]}>{rep?.label} ▾</Text>
        </View>
      </PressableScale>

      <Modal statusBarTranslucent visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.handle} />
            <View style={styles.sheetHead}>
              {/* ★'명식' 옆에 등록 수(daniel 07-21) — 필터 무관 총 등록 명식 개수 */}
              <Text style={styles.sheetTitle}>{t('manse.myChart')} <Text style={{ color: colors.inkFaint, fontWeight: '700' }}>{charts.length}</Text></Text>
              {/* 디바이스 명식 무제한(daniel 2026-06-23) — 사용량/한도(15/10) 배지 제거 */}
            </View>
            {/* ★이름 검색(daniel 2026-08-04) — 명식이 6개 이상일 때만 노출(적을 땐 눈으로 찾는 게 빠르다). */}
            {charts.length >= 6 && (
              <View style={styles.searchWrap}>
                <Text style={styles.searchIcon}>🔍</Text>
                {/* keyboard-safe: 검색창은 바텀시트 '상단'(제목 바로 아래)에 고정 — 키보드는 화면 하단을
                    덮으므로 입력창 자체는 가려질 수 없다(가려지는 건 리스트 하부 행뿐·스크롤로 접근 가능). */}
                <TextInput
                  style={styles.searchInput}
                  value={query}
                  onChangeText={setQuery}
                  placeholder={t('manse.searchChart', '이름으로 찾기')}
                  placeholderTextColor={colors.inkFaint}
                  autoCorrect={false}
                  autoCapitalize="none"
                  returnKeyType="search"
                  clearButtonMode="while-editing"
                />
                {/* Android 는 clearButtonMode 미지원 → 수동 지우기 버튼 */}
                {query.length > 0 && (
                  <PressableScale onPress={() => setQuery('')} hitSlop={8}><Text style={styles.searchClear}>✕</Text></PressableScale>
                )}
              </View>
            )}
            {query.trim().length > 0 && (
              <Text style={{ ...font.caption, color: colors.inkFaint, marginBottom: space(2) }}>
                {shown.length ? `검색 결과 ${shown.length}개` : '검색 결과가 없어요'} · 순서 변경은 검색을 지우고
              </Text>
            )}
            {/* 카테고리(관계) 필터 — 관계가 2종 이상일 때만. [전체] + 각 카테고리 칩(daniel: 전체보기+카테고리별). */}
            {showFilter && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catBar} contentContainerStyle={styles.catRow}>
                <PressableScale style={[styles.catChip, !filtering && styles.catChipOn]} onPress={() => setCatFilter(null)}>
                  <Text style={[styles.catChipTx, !filtering && styles.catChipTxOn]}>{t('community.all', '전체')}</Text>
                </PressableScale>
                {categories.map((r) => (
                  <PressableScale key={r} style={[styles.catChip, catFilter === r && styles.catChipOn]} onPress={() => setCatFilter(r)}>
                    <Text style={[styles.catChipTx, catFilter === r && styles.catChipTxOn]} numberOfLines={1}>{relLabel(r)}</Text>
                  </PressableScale>
                ))}
              </ScrollView>
            )}
            {/* 순서 변경 안내 — 전체보기에서만 드래그 가능(필터 중엔 부분집합이라 순서 저장이 꼬임). */}
            {charts.length > 1 && !filtering && <Text style={{ ...font.caption, color: colors.inkFaint, marginBottom: space(2) }}>명식을 길게 눌러 끌면 순서가 바뀌어요</Text>}
            {filtering && <Text style={{ ...font.caption, color: colors.inkFaint, marginBottom: space(2) }}>‘{relLabel(catFilter!)}’ {shown.length}개 · 순서 변경은 ‘전체’에서</Text>}
            {/* 이슈20: 롱프레스→드래그 reorder. 끌어 놓으면 onDragEnd가 저장·계정동기화(별도 모드/저장버튼 없음). */}
            {/* daniel: 무거운 리스트 마운트 전까지 스피너 — 명식 버튼 누르면 모달 즉시 열려 로딩 표시 */}
            {!listReady ? (
              <View style={{ height: 200, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={colors.ju} /></View>
            ) : (
            <DraggableFlatList
              ref={listRef}
              data={shown}
              keyExtractor={(c) => c.id}
              style={styles.list}
              // 마지막 행 ⋯ 메뉴(수정/삭제)가 하단에 잘리지 않도록 여유(daniel 07-02)
              contentContainerStyle={{ paddingBottom: space(14) }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"  // 검색 키보드가 열린 채로도 명식 탭이 첫 터치에 먹게
              activationDistance={14}
              // 필터 중(부분집합)엔 순서 저장이 전체 순서를 꼬이게 하므로 드래그 결과를 무시(renderItem에서 drag 자체도 비활성).
              onDragEnd={({ data }) => { if (!filtering) onDragEnd(data); }}
              renderItem={({ item: c, drag, isActive }) => {
                const on = c.id === repId;
                const em = emblems[c.id];
                const iljuImg = em ? iljuImage(em.stem, em.branch) : null; // 60갑자 AI 일러스트(없으면 색+동물 폴백)
                return (
                  <ScaleDecorator>
                    <View
                      style={[styles.row, isActive && styles.rowActive, actionsFor === c.id && styles.rowMenuOpen]}
                      // 첫 행의 실제 높이를 한 번만 재서 '현재 명식으로 이동'의 offset 기준으로 쓴다(상수 추정 금지).
                      onLayout={(e) => { if (!rowHRef.current) { rowHRef.current = e.nativeEvent.layout.height; scrollToRep(); } }}
                    >
                      {!em ? (
                        <SkeletonDot d={EMB} /> /* 펄스 스켈레톤 — 엠블럼 계산 전(딜레이 가림) */
                      ) : iljuImg ? (
                        <PressableScale onPress={() => setViewImg(iljuImg)} hitSlop={6} style={[styles.emblemImg, { width: EMB, height: EMB, borderRadius: EMB / 2 }]}>
                          <ExpoImage source={iljuImg} style={[StyleSheet.absoluteFill, { borderRadius: EMB / 2 }]} contentFit="cover" cachePolicy="memory-disk" transition={250}
                            onLoadEnd={() => setLoadedEmblems((s) => { const n = new Set(s); n.add(c.id); return n; })} />
                          {/* 이미지 디코드 중 로딩 인디케이터(daniel: 명식변경 리스트 이미지 로딩 표시) — 로드되면 사라짐 */}
                          {!loadedEmblems.has(c.id) && <ActivityIndicator size="small" color={colors.ju} style={StyleSheet.absoluteFill} />}
                        </PressableScale>
                      ) : (
                        <View style={[styles.emblem, { backgroundColor: em.color, width: EMB, height: EMB, borderRadius: EMB / 2 }]}>
                          <Text style={[styles.emblemTx, { color: em.textColor, fontSize: fs(13) }]}>{em.animal}</Text>
                        </View>
                      )}
                      <PressableScale style={styles.rowMain} onPress={() => choose(c.id)} onLongPress={filtering ? undefined : drag} delayLongPress={250}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(1.5) }}>
                          <Text style={[styles.rowName, on && styles.rowOn, { fontSize: fs(15) }]} numberOfLines={1}>{c.label}</Text>
                          {/* ★성별 배지(daniel 2026-08-02 "명식 리스트에서 여자인지 남자인지도 보이면 좋겠어")
                              — 동명이인·가족 명식이 쌓이면 이름만으론 구분이 안 된다. 사주는 성별에 따라
                              대운 방향(순행/역행)이 갈리므로 **명식의 정체성 정보**지 장식이 아니다.
                              색으로 성별을 나누지 않고 중립 톤을 쓴다(테마 일관·고정관념 회피). */}
                          {!!c.input.sex && (
                            <Text style={[styles.sexBadge, { fontSize: fs(10.5) }]}>{c.input.sex}</Text>
                          )}
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
                      {/* ⋯ → 하단 액션시트 모달(수정·만세력보기·삭제). in-row 드롭다운은 리스트가 잘라내고 반투명·auto-dismiss가
                          안 돼서 모달로 전환(daniel 07-05). 모달=클리핑 없음·불투명·뷰 바뀌면 자동 닫힘. */}
                      <PressableScale style={styles.actWrap} hitSlop={12} onPress={() => setActionsFor(c.id)}>
                        <Text style={[styles.rowAct, { fontSize: 20 }]}>⋯</Text>
                      </PressableScale>
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
        {/* ⋯ 액션시트 — 메인 모달 안·리스트 밖(absoluteFill)이라 하단이 잘리지 않고, bg 불투명이라 뒤가 안 비침.
            backdrop 탭·액션 선택·시트 닫힘(useEffect)·화면 이탈(useFocusEffect) 어디서든 자동으로 닫힌다(daniel 07-05). */}
        {!!actionsFor && (() => {
          const c = charts.find((x) => x.id === actionsFor);
          if (!c) return null;
          return (
            <Pressable style={styles.actSheetBackdrop} onPress={() => setActionsFor(null)}>
              <Pressable style={styles.actSheet} onPress={() => {}}>
                <Text style={styles.actSheetTitle} numberOfLines={1}>{c.label}</Text>
                <PressableScale style={styles.actSheetItem} onPress={() => { setActionsFor(null); edit(c.id); }}>
                  <Text style={styles.actSheetTx}>{t('common.edit', '수정')}</Text>
                </PressableScale>
                <PressableScale style={styles.actSheetItem} onPress={() => { setActionsFor(null); viewManse(c.id); }}>
                  <Text style={styles.actSheetTx}>{t('manse.viewManse', '만세력 보기')}</Text>
                </PressableScale>
                <PressableScale style={styles.actSheetItem} onPress={() => { const id = c.id, lbl = c.label; setActionsFor(null); remove(id, lbl); }}>
                  <Text style={[styles.actSheetTx, styles.actSheetDel]}>{t('common.delete', '삭제')}</Text>
                </PressableScale>
                <PressableScale style={[styles.actSheetItem, styles.actSheetCancel]} onPress={() => setActionsFor(null)}>
                  <Text style={styles.actSheetCancelTx}>{t('common.cancel', '취소')}</Text>
                </PressableScale>
              </Pressable>
            </Pressable>
          );
        })()}
      </Modal>

      {/* 엠블럼 풀스크린 뷰어(daniel) — 일주 일러스트 탭 → 큰 화면, 다시 탭하면 닫힘 */}
      <Modal statusBarTranslucent visible={!!viewImg} transparent animationType="fade" onRequestClose={() => setViewImg(null)}>
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
  barRight: { flexDirection: 'row', alignItems: 'center', gap: space(2), flexShrink: 1 },
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
    paddingHorizontal: space(5), paddingTop: space(2.5), paddingBottom: space(6), maxHeight: '88%',
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.line, alignSelf: 'center', marginBottom: space(3) },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space(2) },
  sheetTitle: { ...font.heading },
  usage: { ...font.caption, color: colors.inkSoft, fontWeight: '700' },
  usageMax: { color: colors.ju }, // 한도 도달 = 주색(업그레이드 신호)

  // 이름 검색줄 — 칩과 같은 sunk 톤. ★fontSize 는 fs() 없이 고정(전역 배율 패치가 곱한다)
  searchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.sunk, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, paddingHorizontal: space(3), marginBottom: space(2.5), gap: space(2) },
  searchIcon: { fontSize: 13 },
  searchInput: { flex: 1, paddingVertical: space(2.5), fontSize: 14, lineHeight: 18, color: colors.ink },
  searchClear: { fontSize: 14, color: colors.inkFaint, paddingHorizontal: space(1) },
  // 카테고리(관계) 필터 바 — 커뮤니티 catBar 와 동일 톤(전체 + 각 관계 칩). daniel: 전체보기+카테고리별.
  catBar: { flexGrow: 0, flexShrink: 0, minHeight: 40, marginBottom: space(2.5) }, // ★flexShrink:0 필수 — 부모 flex 공간 부족 시 ScrollView 가 세로로 눌려(height 줘도) 칩이 짜부라짐(daniel 07-18 "계속 안 보임"). flexGrow:0=안 늘고, flexShrink:0=안 줄고, height 고정.
  catRow: { gap: space(2), paddingRight: space(2), alignItems: 'center' }, // 칩 세로 중앙(catBar 고정높이 안에서)
  catChip: { minHeight: 32, justifyContent: 'center', backgroundColor: colors.sunk, borderRadius: radius.pill, paddingHorizontal: space(3.5), borderWidth: 1, borderColor: colors.line }, // 명시적 높이+세로중앙(paddingVertical 대신 — 짜부라짐 이중 방어)
  catChipOn: { backgroundColor: colors.ju, borderColor: colors.ju },
  catChipTx: { ...font.caption, color: colors.inkSoft, fontWeight: '700' },
  catChipTxOn: { color: colors.bg },
  list: { flexShrink: 1, maxHeight: Dimensions.get('window').height * 0.62 }, // ★flexShrink=시트가 꽉 차면 리스트가 줄어 마지막 명식·＋등록 버튼이 안 잘림(daniel 07-21). maxHeight=상한(시트 내 스크롤)
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: space(3.5), borderBottomWidth: 1, borderBottomColor: colors.line, gap: space(2) },
  rowActive: { backgroundColor: colors.card, borderRadius: radius.md, borderBottomColor: 'transparent' }, // 드래그 중 행 강조(들어올림)
  rowMain: { flex: 1 },
  // ★크기는 스타일 상수가 아니라 **글자 배율에 비례**해야 한다(daniel 2026-07-27 "글씨가 커지면 명식 리스트에서 칸 크기가 안 맞아").
  //   고정 46 은 글자를 키웠을 때 옆 텍스트 칸(fs(15)+fs(12)+fs(11))보다 작아져 행이 어긋나 보인다.
  //   → 아래 EMB(fs) 로 계산해 인라인 적용하고, 여기 상수는 공통 모양(원형·정렬)만 남긴다.
  emblem: { alignItems: 'center', justifyContent: 'center', marginRight: space(3) }, // 색+동물 폴백(일러스트 없을 때)
  emblemSkel: { backgroundColor: colors.sunk, opacity: 0.55 }, // 스켈레톤(엠블럼 계산 전 — 리스트는 즉시 표시, 딜레이 가림)
  emblemImg: { marginRight: space(3), backgroundColor: colors.sunk }, // 60갑자 AI 일러스트(원형 크롭) — 크기는 EMB(fs) 인라인
  emblemTx: { fontWeight: '800' },
  iljuName: { color: colors.ju, fontWeight: '700', marginTop: 1 }, // 일주 이름 "은빛 소"
  rowAct: { fontSize: 13, fontWeight: '700', color: colors.ju, paddingHorizontal: space(1.5) }, // 수정·삭제 글자
  rowActDel: { color: '#E5484D' }, // 삭제 = 적색 강조
  // ⋯ 버튼 래퍼(행 우측) — 탭 → 하단 액션시트(아래) 오픈
  actWrap: { paddingHorizontal: space(1.5), alignItems: 'center', justifyContent: 'center' },
  rowMenuOpen: { zIndex: 1 }, // (액션시트가 모달 오버레이라 행 z-index 불필요 — 참조 유지)
  // ⋯ 액션시트(수정·만세력보기·삭제) — 하단 모달형. in-row 드롭다운의 클리핑·반투명·auto-dismiss 문제 근본해결(daniel 07-05).
  //   불투명 카드 + backdrop dim = 뒤 안 비침 / absoluteFill = 하단 안 잘림 / setActionsFor(null) 다경로 = 뷰 바뀌면 닫힘.
  actSheetBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  actSheet: { backgroundColor: colors.card, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, paddingTop: space(3), paddingBottom: space(8), paddingHorizontal: space(4), borderTopWidth: 1, borderColor: colors.juLine, ...shadow.card, elevation: 16 },
  actSheetTitle: { ...font.caption, color: colors.inkFaint, fontWeight: '700', textAlign: 'center', marginBottom: space(1), paddingBottom: space(2.5), borderBottomWidth: 1, borderBottomColor: colors.line },
  actSheetItem: { paddingVertical: space(3.5), alignItems: 'center' },
  actSheetTx: { fontSize: 16, fontWeight: '700', color: colors.ink },
  actSheetDel: { color: '#E5484D' },
  actSheetCancel: { marginTop: space(2), backgroundColor: colors.sunk, borderRadius: radius.md },
  actSheetCancelTx: { fontSize: 16, fontWeight: '700', color: colors.inkSoft },
  // 프리미엄 지정 명식 배지(골드) — 명식 옆에 프리미엄 여부(daniel 07-02)
  premBadge: { backgroundColor: colors.badgeGold, borderRadius: radius.pill, paddingHorizontal: space(2), paddingVertical: 1, overflow: 'hidden' },
  premBadgeTx: { color: colors.bg, fontSize: 10, fontWeight: '900' },
  // 성별 배지(남/여) — 중립 톤. overflow:hidden 이 있어야 안드로이드에서 borderRadius 가 먹는다.
  sexBadge: { color: colors.inkSoft, backgroundColor: colors.sunk, borderWidth: 1, borderColor: colors.line, borderRadius: radius.pill, paddingHorizontal: space(1.75), paddingVertical: 1, overflow: 'hidden', fontWeight: '800' },
  rowName: { ...font.body, fontWeight: '600', color: colors.ink },
  rowOn: { color: colors.ju },
  rowMeta: { ...font.caption, flex: 1 },
  rowCategory: { ...font.caption, color: colors.inkFaint, marginHorizontal: space(1.5) }, // 관계 카테고리 우측 배지(daniel)
  check: { fontSize: 18, color: colors.ju, fontWeight: '700' },
  addBtn: { backgroundColor: colors.ju, borderRadius: radius.md, paddingVertical: space(3.5), alignItems: 'center', marginTop: space(4) },
  addBtnText: { color: colors.bg, fontSize: 15, fontWeight: '700' },
});
