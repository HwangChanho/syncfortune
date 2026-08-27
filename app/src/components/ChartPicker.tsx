// app/src/components/ChartPicker.tsx — 대표 명식 선택/전환 (홈)
// ─────────────────────────────────────────────────────────────────────────
// 홈 상단에서 현재 '대표 명식'을 보여주고, 탭하면 등록된 명식 목록(바텀시트)에서 전환.
//   대표 변경 = setRepresentative → 만세력·풀이·궁합이 그 명식 기준(loadMyChart).
// 명식이 없으면 등록 유도. 화면 복귀 시 useFocusEffect 로 목록 갱신.
// ─────────────────────────────────────────────────────────────────────────
import { useState, useCallback, useEffect, useRef, useMemo, Fragment } from 'react';
import { ActivityIndicator, Animated, Dimensions, Easing, FlatList, InteractionManager, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { PressableScale } from './PressableScale';
import { Image as ExpoImage } from 'expo-image'; // 자동 다운샘플(메모리) + 엠블럼 탭 풀스크린 뷰어
import DraggableFlatList, { ScaleDecorator } from 'react-native-draggable-flatlist'; // 이슈20 롱프레스 드래그 reorder
import type { FlatList as GHFlatList } from 'react-native-gesture-handler'; // DraggableFlatList 가 넘겨주는 ref 실체(scrollToOffset)
import { Alert } from '../lib/ui/alert'; // 커스텀 알림(삭제 확인)
import { getCategories, addCategory, removeCategory, isRemovable } from '../lib/core/categories'; // 카테고리 관리(daniel 2026-08-12 — 명식리스트에서 추가·삭제)
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context'; // 시트 하단 안전영역(홈 인디케이터) — 아래 addBtn 주석
import { useTranslation } from 'react-i18next';
import { listCharts, setRepresentative, getRepresentativeId, deleteChart, reorderCharts, subscribeRepChange, updateChart, type SavedChart } from '../lib/engine/myChart';
import { getPremiumChartIdSnapshot, subscribePremium } from '../lib/billing/premiumStore'; // 프리미엄 지정 명식(왕관·삭제경고, daniel 07-01)
import { saveLastCompat } from '../lib/core/lastCompat'; // ★'궁합 보기' 말풍선 — 관계 지도가 쓰는 **그 복원 경로**를 그대로 쓴다(경로를 둘로 만들지 않는다)
import { useFontScale } from '../lib/ui/fontScale'; // 명식 헤더 글자크기 반영(daniel)
import { computeChart } from '../lib/engine/engine'; // 각 명식 일주 산출(엠블럼)
import { iljuEmblem, iljuImage, type IljuEmblem } from '../lib/dayPillarEmblem'; // 일주 엠블럼(은빛 소 등) + 60갑자 AI 일러스트
import { colors, radius, space, shadow, font } from '../lib/theme';
import { useSheetLayout } from './WebShell'; // 넓은 웹 = 바텀시트를 가운데 다이얼로그로

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

/** 연인 카테고리 전용 — 말풍선이 위아래로 **살짝 떠오르는** 폭(px). 크면 리스트가 어지럽다. */
const BUBBLE_LIFT = 5;

/**
 * '궁합보기' 말풍선 — 위아래로 둥실거리는 작은 버튼.
 *
 * Boss 2026-08-23 *"연인 카테고리로 변경했을때는 각 명식마다 궁합보기가 뜨면 좋겠어
 *   약간 귀여운 모양으로 위아래로 움직이는 애니메이션 넣어서 말풍선 같이 탭하면 궁합으로 넘어가고"*.
 *
 * @param onPress 탭 — 궁합 화면으로 넘어간다
 * @param fs 글자 배율 함수(설정의 글자 크기를 따른다 — 고정 px 로 박으면 확대 설정에서 깨진다)
 *
 * ⚠️루프 애니는 **언마운트에서 반드시 멈춘다**. 명식 목록은 스크롤로 행이 재활용되므로
 *   안 멈추면 사라진 행의 애니가 계속 돈다(같은 파일의 `SkeletonDot` 과 동일한 관용).
 */
function CompatBubble({ onPress, fs }: { onPress: () => void; fs: (n: number) => number }) {
  const y = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(y, { toValue: -BUBBLE_LIFT, duration: 780, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(y, { toValue: 0, duration: 780, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [y]);
  return (
    <Animated.View style={{ transform: [{ translateY: y }] }}>
      <PressableScale style={styles.compatBubble} onPress={onPress} hitSlop={10}>
        {/* ⚠️<Text> 안에 <Text> 를 넣지 않는다 — 웹에서 백지가 된다([[web-nested-text-crash]]) */}
        <Text style={[styles.compatBubbleTx, { fontSize: fs(11), lineHeight: Math.round(fs(11) * 1.3) }]} numberOfLines={1}>
          궁합 보기
        </Text>
        {/* 말풍선 꼬리 — 45° 돌린 작은 네모를 아래에 반쯤 걸친다(삼각형 에셋 없이 만든다) */}
        <View style={styles.compatBubbleTail} pointerEvents="none" />
      </PressableScale>
    </Animated.View>
  );
}

// ★일주 엠블럼 캐시(daniel 2026-07-29 "명식 리스트 이미지 로딩 너무 오래걸리는데").
//   원인: 모달을 **닫을 때마다 setEmblems({}) 로 전부 버려서**, 다시 열면 N개 명식을
//   computeChart 로 처음부터 순차 재계산했다(명식 29개면 29틱 + 엔진 29회).
//   → 컴포넌트 **밖**(모듈 레벨)에 캐시를 두면 언마운트·재열기에도 살아남아 두 번째부터 즉시 뜬다.
//   ⚠️키에 input 을 포함한다 — 명식을 **수정하면 id 는 같고 내용만 바뀌므로**, id 만 쓰면 옛 엠블럼이 굳는다.
/** '연인' 카테고리 이름 — `lib/core/categories.ts` 의 프리셋과 같은 글자여야 한다.
 *  ⚠️여기 하드코딩을 늘리지 말 것. 이 한 곳만 쓴다(궁합 말풍선 노출 조건). */
const LOVE_CATEGORY = '연인';

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

export function ChartPicker({ onChange, viewOnly }: {
  /** 명식이 바뀌었다. `viewOnly` 면 **고른 명식**을 함께 준다(대표는 안 바뀐다). */
  onChange?: (picked?: SavedChart) => void;
  /**
   * ★★**보기 전용** — 고른 명식을 화면에 띄우기만 하고 **대표를 바꾸지 않는다**
   *   (Boss 2026-08-27 *"무조건 대표명식으로 고정이야"* ·
   *    *"만세력에서 명식 변경하면 화면이 홈을 한번갔다가 다시 돌아와"*).
   *
   * ■ ★두 증상이 **한 뿌리**였다
   *   대표를 바꾸면 오행이 바뀌고 → 테마 색이 바뀌고 → **앱을 다시 띄운다**
   *   (`colors` 는 모듈 로드 시 1회 결정된다 · `_layout` 의 `subscribeRepChange`).
   *   그 리로드가 «홈을 한 번 갔다 오는» 것으로 보였고, 동시에 **홈 이름도 그 사람으로 바뀌었다.**
   * ⇒ 만세력에서 «다른 명식 보기» 는 **보기일 뿐**이다. 대표는 «본인» 하나로 둔다.
   */
  viewOnly?: boolean;
}) {
  const sheetL = useSheetLayout();
  const { t } = useTranslation();
  const router = useRouter();
  const { fs } = useFontScale();
  const insets = useSafeAreaInsets(); // 시트가 화면 바닥에 붙으므로 홈 인디케이터만큼 아래를 띄운다(addBtn 잘림 방지)
  const EMB = embSize(fs);   // 엠블럼 지름 — 글자 배율 연동(행 높이와 어긋나지 않게)           // 명식 헤더 글자크기(설정 반영)
  const [charts, setCharts] = useState<SavedChart[]>([]);
  const [repId, setRepId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [listReady, setListReady] = useState(false); // 모달 열림 직후 스피너 → 리스트는 인터랙션 후 마운트(daniel: 명식 버튼 로딩 표시)
  const [viewImg, setViewImg] = useState<any>(null); // 엠블럼 탭 → 풀스크린 이미지 뷰어(daniel)
  const [loadedEmblems, setLoadedEmblems] = useState<Set<string>>(new Set()); // 엠블럼 이미지 디코드 완료 — 로딩 인디케이터용(daniel: 명식변경 리스트 이미지 로딩 표시)
  const [catFor, setCatFor] = useState<string | null>(null);   // 카테고리 변경 시트(daniel 2026-08-15)
  const [actionsFor, setActionsFor] = useState<string | null>(null); // 수정/삭제 펼친 행(daniel: 한 버튼 ⋯ 탭 → 수정·삭제 분리)
  const [premChartId, setPremChartId] = useState<string | null>(getPremiumChartIdSnapshot()); // 프리미엄 지정 명식 serverChartId(👑·삭제경고)
  const [catFilter, setCatFilter] = useState<string | null>(null); // 카테고리(관계) 필터 — null=전체보기(daniel: 전체보기+카테고리별 보기)
  const [catMenu, setCatMenu] = useState(false);   // 카테고리 드롭박스 펼침(daniel 2026-08-12 — 종전 칩 나열)
  const [newCat, setNewCat] = useState('');        // 새 카테고리 입력
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
  // ⚠️보기 전용에서는 **대표 변경 알림을 흘려보낸다** — 내가 고른 «보는 명식» 을 덮어쓰면
  //   다른 화면에서 대표가 바뀔 때 만세력이 제멋대로 딴 사람으로 넘어간다.
  const viewOnlyRef = useRef(viewOnly); viewOnlyRef.current = viewOnly;
  useEffect(() => subscribeRepChange(() => { if (viewOnlyRef.current) return; reload(); onChangeRef.current?.(); }), [reload]);
  useEffect(() => subscribePremium(() => setPremChartId(getPremiumChartIdSnapshot())), []); // 프리미엄 지정 변경 시 👑 갱신

  const rep = charts.find((c) => c.id === repId) ?? charts[0];
  // ── 카테고리(관계)별 보기 ──────────────────────────────────────────────
  //   relation 은 자유 문자열('self'·'가족'·'연인'·'기타'…)이라 고정 목록 대신 *저장된 명식에서 동적 추출*.
  //   → 관계 옵션이 나중에 바뀌어도 자동 반영. 등장 순서 보존(첫 등장 순).
  const relOf = (c: SavedChart) => c.relation || 'self';
  const relLabel = useCallback((r: string) => (r === 'self' ? t('register.selfLabel', '본인') : r), [t]);
  // ★★관리 목록과 합친다(daniel 2026-08-12 *"명식리스트에서 카테고리 추가할수있게"*).
  //   종전엔 **저장된 명식에서만** 뽑았다 — 그러면 여기서 새 카테고리를 만들어도
  //   **아직 그 카테고리의 명식이 없으니 목록에 안 나타난다**(만들었는데 사라진 것처럼 보인다).
  //   ⇒ 실제 쓰인 relation ∪ 관리 목록(프리셋+커스텀+기타). 순서는 '실제 쓰인 것 먼저'를 유지한다.
  const [catRev, setCatRev] = useState(0);   // 추가·삭제 후 목록 재조회 트리거
  const categories = useMemo(() => {
    const used = charts.reduce<string[]>((acc, c) => { const r = relOf(c); if (!acc.includes(r)) acc.push(r); return acc; }, []);
    const managed = getCategories();         // 프리셋(숨김 제외) + 커스텀 + 기타
    return [...used, ...managed.filter((m) => !used.includes(m))];
  }, [charts, catRev]);
  /** 카테고리별 명식 수 — 드롭박스에서 '몇 개짜리인지' 보여 삭제 판단을 돕는다(0개면 지워도 옮겨갈 명식이 없다). */
  const catCount = useMemo(() => {
    const m: Record<string, number> = {};
    for (const c of charts) { const r = relOf(c); m[r] = (m[r] ?? 0) + 1; }
    return m;
  }, [charts]);
  // ★종전엔 카테고리가 2종 미만이면 필터 바를 아예 숨겼다(showFilter). 드롭박스는 **추가 창구이기도 하므로**
  //   항상 보여야 한다 — 숨기면 카테고리가 하나뿐인 사용자는 새로 만들 방법이 없다(닭이 먼저인 문제).
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
    // ⚠️★웹은 `InteractionManager` 를 **쓰지 않는다**(2026-08-19 daniel *"웹에서 명식 리스트가 안나와"*).
    //   react-native-web 의 구현은 **`requestIdleCallback`** 이다(node_modules 실측).
    //     · 배경 탭에서는 아예 안 돈다
    //     · 앞에 있어도 **브라우저가 한가해져야** 불린다 — 명식 64개를 그리는 동안 계속 밀려
    //       콜백이 영영 안 왔고, 목록 자리에 **스피너만 200px** 남았다(DOM 으로 확인).
    //   네이티브의 `InteractionManager` 는 '애니메이션 끝난 뒤'라는 뜻이라 의도대로 동작한다 → 그대로 둔다.
    if (Platform.OS === 'web') { setListReady(true); return; }
    const h = InteractionManager.runAfterInteractions(() => setListReady(true));
    return () => h.cancel();
  }, [open]);

  // ★엠블럼 이미지 선적재 — 위 warmedOnce 주석 참조. 모달을 열기 *전*에 디스크 캐시를 채운다.
  //   순서: 인터랙션이 끝난 뒤 시작 → 명식 하나씩(틱 분리) 계산 → 이미지 URL 이 나오는 즉시 프리페치.
  //   실패는 전부 무시한다(다음에 리스트에서 정상 경로로 다시 받는다) — 데우기는 **최적화지 정확성이 아니다**.
  //
  // ★★상한을 둔다(daniel 2026-08-12 *"명식리스트에 데이터가 많으면 이미지 로딩도 느려지는데"*).
  //   실측(2026-08-12): 엠블럼 원본 **512×512 · 53~68KB**, 표시 크기는 46~72px.
  //   종전엔 **명식 전량**을 돌며 ①computeChart(사주 엔진 — 무겁다) ②원격 프리페치를 걸었다.
  //   명식이 50개면 **엔진 50회 + 동시 요청 ~3MB** 를 목록을 열기도 전에 쓴다.
  //   ⇒ *데우기는 최적화지 정확성이 아니다*(위 주석). 처음 화면에 들어올 만큼만 데우고,
  //     나머지는 스크롤할 때 리스트가 정상 경로로 받는다(cachePolicy='memory-disk' 라 한 번이면 끝).
  const WARM_MAX = 12;   // 화면에 한 번에 보이는 행(대략 8~10) + 여유 몇 개
  useEffect(() => {
    if (warmedOnce || !charts.length) return;
    warmedOnce = true;
    const snapshot = charts.slice(0, WARM_MAX);
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

  /**
   * 명식 목록 행 하나.
   * ★네이티브(DraggableFlatList)와 웹(FlatList)이 **같은 함수**를 쓴다 — 두 벌로 그리면
   *   행 UI 가 언젠가 갈린다([[duplicate-ui-single-source]]). 웹은 `drag` 만 no-op 으로 받는다.
   */
  const renderChartRow = ({ item: c, drag, isActive }: { item: SavedChart; drag: () => void; isActive: boolean }) => {
    // ⚠️`ScaleDecorator` 는 **DraggableFlatList 컨텍스트 전용**이다. 일반 FlatList(웹) 안에서 쓰면
    //   `useIsActive must be called from within CellProvider!` 로 화면이 죽는다(2026-08-18 실물에서 확인).
    //   ⇒ 웹에서는 장식을 걷어내고 그대로 그린다. 행 내용은 두 경로가 **같은 코드**를 쓴다.
    const Deco: any = Platform.OS === 'web' ? Fragment : ScaleDecorator;
            const on = c.id === repId;
            const em = emblems[c.id];
            const iljuImg = em ? iljuImage(em.stem, em.branch) : null; // 60갑자 AI 일러스트(없으면 색+동물 폴백)
            return (
              <Deco>
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
                        /* ★recyclingKey — 스크롤로 행이 재활용될 때 **이전 명식의 그림이 잠깐 남는 것**을 막는다.
                           (가상화를 조인 뒤에는 재활용이 잦아져 이게 없으면 엉뚱한 엠블럼이 스친다.)
                           ★512×512 원본을 46~72px 로 그리므로 디코딩 크기를 명시해 메모리·시간을 아낀다
                           — expo-image 는 힌트가 없으면 원본 해상도로 디코딩할 수 있다(실측: 장당 1MB). */
                        recyclingKey={`${em.stem}${em.branch}`}
                        allowDownscaling
                        contentPosition="center"
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
                  {/* ★'연인'으로 걸러 본 목록에서는 카테고리 배지가 **모든 행에 같은 글자**라 정보가 0이다.
                      그 자리를 '궁합 보기' 말풍선에 내준다(Boss 2026-08-23). 다른 카테고리는 종전대로 배지. */}
                  {catFilter === LOVE_CATEGORY && relOf(c) === LOVE_CATEGORY ? (
                    <CompatBubble fs={fs} onPress={() => openCompatWith(c)} />
                  ) : (
                    <Text style={[styles.rowCategory, { fontSize: fs(11) }]} numberOfLines={1}>{c.relation === 'self' ? t('register.selfLabel') : c.relation}</Text>
                  )}
                  {on && <Text style={styles.check}>✓</Text>}
                  {/* ⋯ 토글 → 작은 세로 메뉴(수정·만세력보기·삭제). 삭제는 항상 재확인 alert(daniel 07-01) */}
                  {/* ⋯ → 하단 액션시트 모달(수정·만세력보기·삭제). in-row 드롭다운은 리스트가 잘라내고 반투명·auto-dismiss가
                      안 돼서 모달로 전환(daniel 07-05). 모달=클리핑 없음·불투명·뷰 바뀌면 자동 닫힘. */}
                  <PressableScale style={styles.actWrap} hitSlop={12} onPress={() => setActionsFor(c.id)}>
                    <Text style={[styles.rowAct, { fontSize: 20 }]}>⋯</Text>
                  </PressableScale>
                </View>
              </Deco>
            );
  };

  /**
   * '궁합 보기' — 이 명식을 **상대**로 세우고 궁합 화면으로.
   *
   * @param c 상대가 될 명식(연인 카테고리 행)
   *
   * ★'나'는 본인(self) 명식을 우선한다. 대표가 연인 명식으로 바뀌어 있을 수 있어서,
   *   대표를 그대로 '나'로 쓰면 **연인 vs 연인**이 될 수 있다(실제로 대표는 자주 바뀐다).
   *   self 가 없으면 대표(단, 상대와 다를 때)로, 그것도 아니면 비워 둔다 —
   *   비면 궁합 화면이 대표를 '나'로 채운다(CompatScreen 의 기존 폴백).
   * ⚠️새 라우트 파라미터를 만들지 않는다. 관계 지도가 쓰는 `saveLastCompat` 경로 그대로다
   *   — 경로가 둘이 되면 한쪽만 고쳐지는 사고가 난다([[duplicate-ui-single-source]]).
   */
  function openCompatWith(c: SavedChart) {
    const selfC = charts.find((x) => relOf(x) === 'self' && x.id !== c.id);
    const meId = selfC?.id ?? (repId && repId !== c.id ? repId : undefined);
    saveLastCompat({ meId, otherId: c.id });
    setOpen(false);                 // 시트를 닫고 넘어간다(뒤로 오면 목록이 그대로 열려 있는 게 아니라 화면이 남는다)
    router.push('/compat');
  }

  async function choose(id: string) {
    const picked = charts.find((c) => c.id === id);
    if (viewOnly) {
      // ★대표를 **건드리지 않는다** — 테마 리로드도, 홈 이름 바뀜도 일어나지 않는다(위 주석)
      setRepId(id);            // 시트에서 «지금 보고 있는 것» 표시만 옮긴다
      setOpen(false);
      onChange?.(picked);
      return;
    }
    await setRepresentative(id);
    setRepId(id);
    setOpen(false);
    onChange?.(picked); // 대표 변경 알림 → 호출처 즉시 갱신
  }

  // 순서 변경 — 롱프레스 드래그(이슈20): 끌어 놓으면 즉시 반영 + 저장·계정동기화(별도 저장 버튼 X, daniel).
  const onDragEnd = async (data: SavedChart[]) => {
    setCharts(data);                          // 로컬 즉시 반영(애니메이션은 DraggableFlatList가 처리)
    await reorderCharts(data.map((c) => c.id)); // 영속 + 계정동기화(ADR-056)
  };

  // 명식 수정 → 등록 폼 편집모드(editId)로 이동. 모달 닫고 진입.
  function edit(id: string) { setOpen(false); router.push({ pathname: '/register', params: { editId: id } }); }
  // 만세력 보기 → 그 명식을 대표로 설정하고 만세력(/charts) 화면으로 진입(daniel 07-01)
  async function viewManse(id: string) {
    // ★보기 전용이면 **그 자리에서** 바꾼다 — 이미 만세력이라 `push` 하면 스택만 쌓인다
    if (viewOnly) { const picked = charts.find((c) => c.id === id); setRepId(id); setOpen(false); onChange?.(picked); return; }
    await setRepresentative(id); setOpen(false); onChange?.(); router.push('/charts');
  }

  // ── 카테고리 관리(daniel 2026-08-12 *"카테고리 추가할수있게하고 삭제도 할수 있게"*) ──
  /** 새 카테고리 추가 — 만들자마자 그 카테고리로 필터를 옮겨 '만들어졌다'가 눈에 보이게 한다. */
  async function addCat() {
    const n = newCat.trim();
    if (!n) return;
    await addCategory(n);
    setNewCat(''); setCatRev((v) => v + 1); setCatFilter(n);
  }
  /**
   * 카테고리 삭제 — 소속 명식은 **전부 '기타'로** 옮겨진다(removeCategory → reassignRelation).
   * '본인(self)'과 '기타'는 삭제 대상이 아니다(isRemovable) — 애초에 ✕ 를 그리지 않는다.
   * ★확인창은 이 모달을 **닫지 않고** 띄운다 — 바로 아래 confirmDelete(명식 삭제)가 이미 같은 방식으로
   *   프로덕션에서 동작 중이다. 화면 안에서 두 방식이 갈리지 않게 그 관용구를 따른다.
   */
  function confirmRemoveCat(r: string) {
    if (!isRemovable(r)) return;
    const n = catCount[r] ?? 0;
    Alert.alert(
      t('manse.catDeleteTitle', '카테고리 삭제'),
      n > 0
        ? (t('manse.catDeleteMsgN', { cat: relLabel(r), n, defaultValue: `‘${relLabel(r)}’ 카테고리를 지울까요?\n이 카테고리의 명식 ${n}개는 ‘기타’로 옮겨져요(명식은 지워지지 않아요).` }) as string)
        : (t('manse.catDeleteMsg0', { cat: relLabel(r), defaultValue: `‘${relLabel(r)}’ 카테고리를 지울까요?` }) as string),
      [
        { text: t('common.cancel', '취소'), style: 'cancel' },
        { text: t('common.delete', '삭제'), style: 'destructive', onPress: async () => {
          await removeCategory(r);
          if (catFilter === r) setCatFilter(null);   // 지운 카테고리를 보고 있었으면 전체로
          setCatRev((v) => v + 1);
          await reload();                            // 명식들의 relation 이 '기타'로 바뀌었다 — 목록 재조회
          onChange?.();
        } },
      ],
    );
  }

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
          <Text style={[styles.barName, { fontSize: fs(15) }]}>{rep?.label} ▾</Text>
        </View>
      </PressableScale>

      <Modal statusBarTranslucent visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={[styles.backdrop, sheetL.backdrop]} onPress={() => setOpen(false)}>
          <Pressable style={[styles.sheet, sheetL.sheet]} onPress={() => {}}>
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
            {/* ★카테고리 — **드롭박스**(daniel 2026-08-12 *"버블형식으로 나열하지말고 드랍박스로하자"*).
                종전엔 가로 스크롤 칩이라 ①카테고리가 늘면 오른쪽으로 밀려 안 보이고
                ②추가·삭제할 방법이 이 화면에 아예 없었다. 이제 선택·추가·삭제를 여기서 다 한다.
                ★**펼침은 인라인**(absolute·중첩 Modal 아님) — 이 화면은 이미 Modal 안이고,
                  리스트 안 absolute 는 잘림·유령터치를 만든다([[toggle-view-auto-dismiss]]). */}
            <PressableScale style={styles.catDrop} onPress={() => setCatMenu((v) => !v)}>
              <Text style={styles.catDropTx} numberOfLines={1}>
                {catFilter ? relLabel(catFilter) : t('community.all', '전체')}
                <Text style={styles.catDropCount}>  {catFilter ? (catCount[catFilter] ?? 0) : charts.length}개</Text>
              </Text>
              <Text style={styles.catDropCaret}>{catMenu ? '▴' : '▾'}</Text>
            </PressableScale>
            {catMenu && (
              <View style={styles.catMenu}>
                <Pressable style={styles.catItem} onPress={() => { setCatFilter(null); setCatMenu(false); }}>
                  <Text style={[styles.catItemTx, !catFilter && styles.catItemOn]}>{t('community.all', '전체')}</Text>
                  <Text style={styles.catItemN}>{charts.length}</Text>
                </Pressable>
                {categories.map((r) => (
                  <Pressable key={r} style={styles.catItem} onPress={() => { setCatFilter(r); setCatMenu(false); }}>
                    <Text style={[styles.catItemTx, catFilter === r && styles.catItemOn]} numberOfLines={1}>{relLabel(r)}</Text>
                    <Text style={styles.catItemN}>{catCount[r] ?? 0}</Text>
                    {/* ★'본인'·'기타'는 ✕ 를 아예 안 그린다 — 못 누르는 버튼을 보여 주지 않는다 */}
                    {isRemovable(r) && (
                      <Pressable hitSlop={8} style={styles.catX} onPress={() => confirmRemoveCat(r)}>
                        <Text style={styles.catXTx}>✕</Text>
                      </Pressable>
                    )}
                  </Pressable>
                ))}
                {/* 새 카테고리 — 여기서 바로 만들고, 만들면 그 카테고리로 필터가 옮겨간다 */}
                <View style={styles.catAddRow}>
                  <TextInput style={styles.catAddInput} value={newCat} onChangeText={setNewCat}
                    placeholder={t('manse.newCategoryPh', '새 카테고리 이름')} placeholderTextColor={colors.inkFaint}
                    returnKeyType="done" onSubmitEditing={addCat} />
                  <PressableScale style={[styles.catAddBtn, !newCat.trim() && styles.catAddBtnOff]} onPress={addCat} disabled={!newCat.trim()}>
                    <Text style={styles.catAddBtnTx}>{t('common.add', '추가')}</Text>
                  </PressableScale>
                </View>
                <Text style={styles.catNote}>{t('manse.catDelNote', '카테고리를 지워도 명식은 지워지지 않아요 — ‘기타’로 옮겨져요.')}</Text>
              </View>
            )}
            {/* 순서 변경 안내 — 전체보기에서만 드래그 가능(필터 중엔 부분집합이라 순서 저장이 꼬임). */}
            {charts.length > 1 && !filtering && <Text style={{ ...font.caption, color: colors.inkFaint, marginBottom: space(2) }}>명식을 길게 눌러 끌면 순서가 바뀌어요</Text>}
            {filtering && <Text style={{ ...font.caption, color: colors.inkFaint, marginBottom: space(2) }}>‘{relLabel(catFilter!)}’ {shown.length}개 · 순서 변경은 ‘전체’에서</Text>}
            {/* 이슈20: 롱프레스→드래그 reorder. 끌어 놓으면 onDragEnd가 저장·계정동기화(별도 모드/저장버튼 없음). */}
            {/* daniel: 무거운 리스트 마운트 전까지 스피너 — 명식 버튼 누르면 모달 즉시 열려 로딩 표시 */}
            {!listReady ? (
              <View style={{ height: 200, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={colors.ju} /></View>
            ) : (
            /* ★★웹은 **일반 FlatList** 로 그린다(2026-08-18 실측 버그).
                 `react-native-draggable-flatlist` 는 gesture-handler 위에서 도는데, **웹에서 행 탭을 삼킨다** —
                 명식을 눌러도 `choose()` 가 아예 불리지 않아 **한 명식에 갇혔다**(64개를 등록해 놓고도).
                 롱프레스 드래그 정렬은 어차피 손가락 인터랙션이라 웹에서 쓸 일이 없다 ⇒ 웹은 드래그를 포기하고
                 **선택이 되게** 한다(둘 중 하나를 골라야 한다면 선택이 먼저다).
                 ⚠️`renderItem` 은 그대로 쓴다 — 두 벌로 갈리면 행 UI 가 언젠가 어긋난다. drag 만 no-op 으로 넘긴다. */
            Platform.OS === 'web' ? (
            <FlatList
              data={shown}
              keyExtractor={(c: SavedChart) => c.id}
              style={styles.list}
              contentContainerStyle={{ paddingBottom: space(14) }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              initialNumToRender={10}
              maxToRenderPerBatch={8}
              windowSize={5}
              renderItem={({ item }: { item: SavedChart }) => renderChartRow({ item, drag: () => {}, isActive: false })}
            />
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
              // ★가상화 튜닝(daniel 2026-08-12 "데이터가 많으면 … 느려지는데") — 종전엔 **하나도 안 줬다**.
              //   기본 windowSize=21 은 *화면의 21배*를 마운트해 둔다. 행마다 512×512 엠블럼이 붙으므로
              //   명식이 많을수록 메모리·디코딩이 그대로 늘었다. 보이는 근처만 유지한다.
              //   ⚠️removeClippedSubviews 는 **드래그 reorder 중 행이 사라지는** 알려진 문제가 있어 쓰지 않는다.
              initialNumToRender={10}
              maxToRenderPerBatch={8}
              windowSize={5}
              // 필터 중(부분집합)엔 순서 저장이 전체 순서를 꼬이게 하므로 드래그 결과를 무시(renderItem에서 drag 자체도 비활성).
              onDragEnd={({ data }) => { if (!filtering) onDragEnd(data); }}
              renderItem={renderChartRow}
            />
            ))}
            {/* ★'＋ 명식 등록' — 시트의 마지막 요소이자 **주 CTA**. 잘리면 명식을 더 못 만든다.
                daniel 2026-08-07 IMG_8431 "명식등록 계속 짤려"(명식 51개 · 목록이 길 때).
                근인 둘을 함께 막는다:
                  ① 시트가 화면 바닥에 붙는데 **안전영역(홈 인디케이터)을 안 뺐다** → 버튼 아래가 잘렸다
                  ② 목록이 길면 시트가 maxHeight 88% 에 닿아 버튼이 밖으로 밀렸다 → 버튼 높이를 확보(flexShrink 0)하고
                     줄어드는 쪽은 **리스트**가 되게 한다(리스트는 안에서 스크롤되므로 줄어도 정보가 안 사라진다). */}
            <PressableScale
              style={[styles.addBtn, { marginBottom: insets.bottom }]}
              onPress={() => { setOpen(false); router.push('/register'); }}
            >
              <Text style={styles.addBtnText}>＋ {t('compat.registerMyChart')}</Text>
            </PressableScale>

            {/* ★★「태어난 시 찾기」 — **명식 목록 안**에 둔다 (Boss 2026-08-27
                *"태어난 시찾기 컨텐츠를 만세력에서 명식리스트 쪽에 넣자"*).
                ■ 왜 여기인가 — **시를 모르는 사람이 서 있는 자리**가 바로 여기다.
                  명식을 등록하려다 «태어난 시각» 에서 막히거나, 「시각 미상」으로 넣어 둔 명식을
                  목록에서 보고 있을 때. 콘텐츠 목록(`/contents`)에 있으면 그 순간에 못 만난다.
                ⚠️「택일」(`/taegil`)과 **다른 것**이다 — 그건 «어떤 선택을 할 때 좋은 날» 이고,
                  이건 «내가 태어난 시» 를 사건으로 좁히는 것이다(Boss 가 둘을 갈라 말했다). */}
            <PressableScale
              style={[styles.findTimeBtn, { marginBottom: insets.bottom }]}
              onPress={() => { setOpen(false); router.push('/timeResolve'); }}
            >
              <Text style={styles.findTimeTx}>{t('manse.findHour', '태어난 시 찾기')}</Text>
              <Text style={styles.findTimeSub}>{t('manse.findHourSub', '시각을 모르면 사건으로 좁혀요')}</Text>
            </PressableScale>
          </Pressable>
        </Pressable>
        {/* ⋯ 액션시트 — 메인 모달 안·리스트 밖(absoluteFill)이라 하단이 잘리지 않고, bg 불투명이라 뒤가 안 비침.
            backdrop 탭·액션 선택·시트 닫힘(useEffect)·화면 이탈(useFocusEffect) 어디서든 자동으로 닫힌다(daniel 07-05). */}
        {!!actionsFor && (() => {
          const c = charts.find((x) => x.id === actionsFor);
          if (!c) return null;
          return (
            <Pressable style={[styles.actSheetBackdrop, sheetL.backdrop]} onPress={() => setActionsFor(null)}>
              <Pressable style={[styles.actSheet, sheetL.sheet]} onPress={() => {}}>
                <Text style={styles.actSheetTitle} numberOfLines={1}>{c.label}</Text>
                <PressableScale style={styles.actSheetItem} onPress={() => { setActionsFor(null); edit(c.id); }}>
                  <Text style={styles.actSheetTx}>{t('common.edit', '수정')}</Text>
                </PressableScale>
                {/* ★카테고리 변경(daniel 2026-08-15 "여기서 카테고리도 바로 바꿀수 잇게해줘") —
                    종전엔 '수정'으로 들어가 등록 폼 전체를 거쳐야 했다. 한 항목만 바꾸는데 폼을 다 지나는 건 과하다. */}
                {relOf(c) !== 'self' && (
                  <PressableScale style={styles.actSheetItem} onPress={() => { setActionsFor(null); setCatFor(c.id); }}>
                    <Text style={styles.actSheetTx}>{t('manse.changeCategory', '카테고리 변경')}</Text>
                  </PressableScale>
                )}
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
        {/* 카테고리 변경 시트 — 고르면 바로 저장하고 닫는다(확인 단계 없음: 되돌리기 쉬운 변경이다) */}
        {!!catFor && (() => {
          const c = charts.find((x) => x.id === catFor);
          if (!c) return null;
          const cur = relOf(c);
          return (
            <Pressable style={styles.actSheetBackdrop} onPress={() => setCatFor(null)}>
              <Pressable style={styles.actSheet} onPress={() => {}}>
                <Text style={styles.actSheetTitle} numberOfLines={1}>{c.label}</Text>
                <ScrollView style={{ maxHeight: 320 }}>
                  {categories.filter((k) => k !== 'self').map((k) => (
                    <PressableScale
                      key={k}
                      style={styles.actSheetItem}
                      onPress={async () => {
                        setCatFor(null);
                        if (k === cur) return;                       // 같은 값이면 저장하지 않는다
                        // ⚠️relation 이 바뀌면 updateChart 가 serverChartId 를 새로 발급한다(풀이 캐시 계약).
                        //   그래서 input 전체를 그대로 넘기고 relation 만 얹는다 — 사주 값은 손대지 않는다.
                        await updateChart(c.id, { ...c.input, relation: k });
                        await reload();
                      }}
                    >
                      <Text style={[styles.actSheetTx, k === cur && { color: colors.ju, fontWeight: '800' }]}>
                        {k}{k === cur ? '  ✓' : ''}
                      </Text>
                    </PressableScale>
                  ))}
                </ScrollView>
                <PressableScale style={[styles.actSheetItem, styles.actSheetCancel]} onPress={() => setCatFor(null)}>
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
  catChipTxOn: { color: colors.onJu },
  // ── 카테고리 드롭박스(daniel 2026-08-12) — 칩 가로스크롤을 대체 ──
  //   ★생김새는 위 검색창(input)과 맞춘다. 같은 시트 안에서 컨트롤이 서로 달라 보이면 그게 잡음이다.
  catDrop: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.sunk, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md,
    paddingHorizontal: space(3.5), minHeight: 40, marginBottom: space(2),
  },
  catDropTx: { ...font.caption, color: colors.ink, fontWeight: '700', flex: 1 },
  catDropCount: { color: colors.inkFaint, fontWeight: '600' },
  catDropCaret: { color: colors.inkFaint, fontSize: 12 },
  // 펼침은 **인라인**(absolute 금지 — 리스트 안 absolute 는 잘림·유령터치를 만든다)
  catMenu: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md,
    paddingHorizontal: space(3), paddingVertical: space(1), marginBottom: space(2.5),
  },
  catItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: space(2.5), borderBottomWidth: 1, borderBottomColor: colors.line },
  catItemTx: { ...font.caption, color: colors.inkSoft, flex: 1 },
  catItemOn: { color: colors.ju, fontWeight: '800' },
  catItemN: { ...font.caption, color: colors.inkFaint, marginRight: space(2) },
  catX: { paddingHorizontal: space(1.5), paddingVertical: space(0.5) },
  catXTx: { color: colors.inkFaint, fontSize: 13 },
  catAddRow: { flexDirection: 'row', alignItems: 'center', gap: space(2), paddingVertical: space(2.5) },
  catAddInput: {
    flex: 1, backgroundColor: colors.sunk, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm,
    paddingHorizontal: space(2.5), minHeight: 36, color: colors.ink, fontSize: 13,
  },
  catAddBtn: { backgroundColor: colors.ju, borderRadius: radius.sm, paddingHorizontal: space(3.5), minHeight: 36, justifyContent: 'center' },
  catAddBtnOff: { opacity: 0.4 },
  catAddBtnTx: { color: colors.bg, fontSize: 13, fontWeight: '800' },
  catNote: { ...font.caption, color: colors.inkFaint, paddingBottom: space(2) },
  // ★flexShrink=시트가 꽉 차면 리스트가 줄어 마지막 명식·＋등록 버튼이 안 잘림(daniel 07-21). maxHeight=상한(시트 내 스크롤)
  //   ★★상한을 0.62→0.52 로 낮춘다(daniel 2026-08-07 IMG_8431 "명식등록 계속 짤려" · 명식 51개).
  //     시트 최대 88% 인데 헤더(제목·검색·필터칩·안내문)가 ~22% + 등록 버튼 ~9% + 안전영역 ~4% 를 먹는다.
  //     남는 자리는 ~53% 뿐인데 상한이 62% 라, flexShrink 가 제때 안 먹으면 버튼이 밖으로 밀렸다.
  //     상한 자체를 남는 자리 안으로 넣어 **어느 경로로도 버튼이 밀리지 않게** 한다(리스트는 안에서 스크롤된다).
  list: { flexShrink: 1, maxHeight: Dimensions.get('window').height * 0.52 },
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
  // ★'궁합 보기' 말풍선 — 채운 라벤더 + 배경색 글씨(같은 파일 `addBtn` 과 같은 대비 조합).
  //   ⚠️연한 배경 + 흰 글씨로 하면 대비가 1점대로 떨어진다(08-23 에 한 번 당한 조합).
  compatBubble: {
    backgroundColor: colors.ju, borderRadius: radius.pill,
    paddingHorizontal: space(2.25), paddingVertical: space(1),
    marginHorizontal: space(1.5), ...shadow.card,
  },
  compatBubbleTx: { color: colors.bg, fontWeight: '800' },
  // 꼬리 = 45° 돌린 작은 네모. 말풍선 아래 왼쪽에 반쯤 걸쳐 '이 행이 하는 말'처럼 보이게.
  compatBubbleTail: {
    position: 'absolute', left: 11, bottom: -3,
    width: 7, height: 7, backgroundColor: colors.ju, transform: [{ rotate: '45deg' }],
  },
  check: { fontSize: 18, color: colors.ju, fontWeight: '700' },
  // flexShrink:0 — 시트가 꽉 차도 이 버튼은 **절대 줄지 않는다**(줄어드는 쪽은 위의 리스트). marginBottom 은 렌더에서 안전영역만큼.
  addBtn: { backgroundColor: colors.ju, borderRadius: radius.md, paddingVertical: space(3.5), alignItems: 'center', marginTop: space(4), flexShrink: 0 },
  // ★「태어난 시 찾기」 — 주 CTA(등록)보다 **한 단계 낮게**. 목록의 주인공은 명식이지 이 버튼이 아니다.
  findTimeBtn: {
    marginTop: space(2), paddingVertical: space(3), paddingHorizontal: space(4),
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.line,
    backgroundColor: colors.sunk, alignItems: 'center',
  },
  findTimeTx: { ...font.body, color: colors.ink, fontWeight: '800' },
  findTimeSub: { ...font.caption, color: colors.inkFaint, marginTop: 2 },
  addBtnText: { color: colors.bg, fontSize: 15, fontWeight: '700' },
});
