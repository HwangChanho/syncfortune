// app/src/screens/TimelineScreen.tsx — 인생 타임라인 (대운·연도 각각 picker + 위/아래 분리 통변)
// ─────────────────────────────────────────────────────────────────────────
// daniel: ① 대운(10년)·연도(1년) 모두 picker(모달)로 선택 ② 위(대운)/아래(연도)로 나눠 각각 통변 표시.
//   선택 항목(life_{startAge} / year_{YYYY}) 통변을 Edge(kind='timeline')로 생성·캐시. 현재 대운·올해 기본.
//   캐시(readings chart_id×category)로 재생성 0. 프리미엄 메뉴(비프리미엄=유도).
// ─────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator, Modal } from 'react-native';
import { PressableScale } from '../components/PressableScale';
import { ExpiryNote } from '../components/ExpiryNote'; // 보유 만료일 공통(프리미엄 가드 한 곳)
import { Alert } from '../lib/ui/alert'; // 커스텀 알림(앱 디자인)
import { useTranslation } from 'react-i18next';
import { computeChart } from '../lib/engine/engine';
import { useAuth } from '../lib/useAuth';
import { useSubscription } from '../lib/billing/subscription';
import { useFontScale } from '../lib/ui/fontScale';
import { setGenProgress } from '../lib/backend/genProgress'; // 일회성 진행도(daniel 이슈15)
import { acquireGen, releaseGen } from '../lib/backend/genLock'; // 크로스마운트 이중 생성 잠금(② 이중 LLM 방지)
import { supabase } from '../lib/supabase';
import { ensureServerChartId } from '../lib/backend/prewarmReadings';
import { invokeFail } from '../lib/backend/interpretResult'; // 방어: 일시적 불가/오류 친화 처리
import { getRepresentativeId } from '../lib/engine/myChart'; // 대표 명식 여부(자동생성 한정)
import { assertOnline, isOnline } from '../lib/backend/network'; // 오프라인 시 신규 생성 차단
import { loadCredits, waitForCreditGrant } from '../lib/billing/coupons'; // 크레딧 보유확인 + 결제 후 웹훅 적립 폴링(차감은 Edge·P3·C1)
import { isReadingUnlocked } from '../lib/billing/unlocks'; // 서버 세트 언락(timeline)
import { isPremiumForChart } from '../lib/billing/premiumStore'; // 명식별 프리미엄 판정(#1 — 비지정 명식/무료모드 게이트)
import { purchaseCreditRC } from '../lib/billing/purchases'; // timeline 개별 구매(비프리미엄)
import { appLang } from '../lib/i18n'; // 통변 출력 언어(앱 언어)
import { confirmReadingChart } from '../lib/ui/confirmChart'; // 생성 전 명식 확인 + 보유 이용권 안내(daniel)
import { stemElement, branchElement, elementColor, elementText, stemYinYang, branchYinYang } from '../lib/engine/ohaeng';
import { TTSButton } from '../components/TTSButton'; // daniel: 풀이 음성 읽기(온디바이스 TTS·무료)
import { UnlockOverlay } from '../components/UnlockOverlay'; // 시기 통변 생성 중 로딩(타임라인 테마 영상)
import { DoorReveal } from '../components/DoorReveal'; // 풀이 공개 순간 골드 명조 문 열림 영상(daniel 07-06)
import { TimelineTeaser } from '../components/TimelineTeaser'; // 무료 결정론 대운 흐름 스트립(유료 카드 위·API 0·퍼널)
import { colors, radius, space, shadow, font } from '../lib/theme';
import type { ChartInput } from '@spec/chart';
import type { SavedChart } from '../lib/engine/myChart';

const AGE_MIN = 10, AGE_MAX = 110;  // 대운 110세까지(daniel)

// 타임라인 통변 카테고리 — Edge 응답 키와 1:1, 라벨은 i18n.
//   대운(10년)=5갈래 / 연운(1년)=유료라 8갈래(+월별, daniel "올해는 더 다양하게").
type CatKey = 'general' | 'work' | 'money' | 'love' | 'health' | 'social' | 'growth' | 'move';
const CAT_DEF: Record<CatKey, string> = {
  general: 'timeline.catGeneral', work: 'timeline.catWork', money: 'timeline.catMoney',
  love: 'timeline.catLove', health: 'timeline.catHealth',
  social: 'timeline.catSocial', growth: 'timeline.catGrowth', move: 'timeline.catMove',
};
const DECADE_KEYS: CatKey[] = ['general', 'work', 'money', 'love', 'health'];
const YEAR_KEYS: CatKey[] = ['general', 'work', 'money', 'love', 'health', 'social', 'growth', 'move'];
const catsFor = (key: string): CatKey[] => (key.startsWith('year_') ? YEAR_KEYS : DECADE_KEYS);

export function TimelineScreen({ input, savedChart }: { input: ChartInput | null; savedChart?: SavedChart | null }) {
  const { t } = useTranslation();
  const { session } = useAuth();
  const { isPremium } = useSubscription();
  const { fs } = useFontScale();
  const c = useMemo(() => (input ? computeChart(input) : null), [input]);
  const nowYear = new Date().getFullYear();
  const birthYear = input ? parseInt(String(input.birthDateTime).slice(0, 4), 10) : 0;
  const curAge = nowYear - birthYear;

  // 대운(10년)·연도(1년) 목록 — 엔진 luckCycles + annuals
  const { decades, years, curDecadeKey } = useMemo(() => {
    const luck: any[] = (c?.saju as any)?.luckCycles ?? [];
    const decades = luck
      .filter((l) => l.startAge + 9 >= AGE_MIN && l.startAge <= AGE_MAX)
      .map((l) => ({ key: `life_${l.startAge}`, startAge: l.startAge, label: `${l.startAge}~${l.startAge + 9}세`, gz: `${l.stem}${l.branch}`, stem: l.stem }));
    const cur = decades.find((d) => curAge >= d.startAge && curAge < d.startAge + 10);
    const ymap = new Map<number, any>();
    luck.forEach((l) => (l.annuals ?? []).forEach((a: any) => {
      const age = a.year - birthYear;
      if (age >= AGE_MIN && age <= AGE_MAX && !ymap.has(a.year)) ymap.set(a.year, { ...a, age });
    }));
    const years = Array.from(ymap.values()).sort((x, y) => x.year - y.year)
      .map((a) => ({ key: `year_${a.year}`, year: a.year, age: a.age, gz: `${a.stem}${a.branch}`, stem: a.stem }));
    return { decades, years, curDecadeKey: cur?.key ?? decades[0]?.key ?? '' };
  }, [c, birthYear, curAge]);

  const [readings, setReadings] = useState<Record<string, any>>({});
  const [createdAt, setCreatedAt] = useState<Record<string, string>>({}); // 기간(life_/year_)별 생성일 — 보유 만료일(생성일+1년) 계산용(daniel #25)
  const [selDecade, setSelDecade] = useState<string>('');
  const [selYear, setSelYear] = useState<string>(`year_${nowYear}`);
  const [chartId, setChartId] = useState<string | null>(savedChart?.serverChartId ?? null);
  const [busy, setBusy] = useState<string | null>(null);      // 생성 중인 category
  const [picker, setPicker] = useState<'decade' | 'year' | null>(null);
  const [catByKey, setCatByKey] = useState<Record<string, CatKey>>({}); // 기간별 선택된 카테고리 칩(기본 general)
  const [doorPlaying, setDoorPlaying] = useState(false); // 풀이 공개 순간 골드 명조 문 열림 영상(daniel 07-06)
  const doorShown = useRef(false);                       // 유효 시기 통변 최초 공개 1회 가드(재렌더·명식전환 시 재생 방지)
  const genSeq = useRef(0);        // ① 생성 세대 토큰 — 명식 전환(load effect) 시 ++ 로 진행 중 gen 무효화(옛 명식 시기통변이 새 명식 readings 에 섞이는 것 차단). 읽기(스냅샷)라 동시 2기간 생성끼리는 무효화 안 함.
  const chartIdRef = useRef<string | null>(null); // ① gen 이 대상으로 삼은 명식(canonical serverChartId) 대조 기준
  const listRef = useRef<ScrollView>(null);                   // picker 목록 스크롤(선택 위치로 이동)
  const ROW_H = 48;                                           // 목록 행 고정 높이(스크롤 오프셋 계산용)
  // 기간별 잠금 해제 집합(ref). 프리미엄=현재 대운/올해 무료, 그 외엔 이용권으로 해당 key만 1회 해제.
  //   생성되면 캐시(readings)에 남아 영구 무료 → ref는 '결제 직후 재생성 허용' 용도.
  // 세트 언락은 서버 reading_unlocks 권위로 이전(P3) — 로컬 unlocked ref 제거
  // 대표 명식 여부 — 자동생성(현재 대운/올해)은 대표 명식에만(비용통제). 다른 명식은 직접 열어야.
  const [isRep, setIsRep] = useState(false);
  useEffect(() => {
    let alive = true;
    getRepresentativeId().then((rid) => { if (alive) setIsRep(!!savedChart && !!rid && rid === savedChart.id); }).catch(() => {});
    return () => { alive = false; };
  }, [savedChart]);

  // ★유효 시기 통변(readings)이 실제로 공개되는 순간 = 골드 명조 문 열림 연출 1회(daniel 07-06). 캐시 로드/자동생성 완료로 처음 뜰 때(생성중 아님).
  //   무료 결정론 티저(TimelineTeaser)엔 재생 안 함. ReadingScreen 선례처럼 마운트당 1회(ref 가드).
  useEffect(() => {
    if (!busy && !doorShown.current && Object.values(readings).some((r) => r && !r.error)) { doorShown.current = true; setDoorPlaying(true); }
  }, [readings, busy]);

  // 한 기간이 무료인지(프리미엄 & 현재 대운/올해) — 자동 생성·게이트 분기 공용
  const isCurrentPeriod = (key: string) => key === curDecadeKey || key === `year_${nowYear}`;
  const isFree = (key: string) => isCurrentPeriod(key); // 현재 대운·올해 = 전원 무료(무료시기·daniel)

  useEffect(() => { if (curDecadeKey && !selDecade) setSelDecade(curDecadeKey); }, [curDecadeKey, selDecade]);

  // picker 열릴 때 선택 항목(연도=올해·대운=현재)으로 스크롤 위치를 맞춘다(맨 위 아닌 현재로, daniel).
  useEffect(() => {
    if (!picker) return;
    const items = picker === 'decade' ? decades : years;
    const selKey = picker === 'decade' ? selDecade : selYear;
    const idx = items.findIndex((x) => x.key === selKey);
    if (idx > 1) setTimeout(() => listRef.current?.scrollTo({ y: (idx - 1) * ROW_H, animated: false }), 60);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picker]);

  // 진입 시 서버차트 + 캐시 로드 → 현재 대운·올해 자동 생성(둘 다 보이게)
  useEffect(() => {
    let alive = true;
    genSeq.current++;   // ① 재로드(진입·명식전환) = 진행 중 gen 무효화(그 결과가 이 화면 readings 에 setReadings 되지 않게)
    setBusy(null);      // ① 무효화한 gen 의 로딩 키 정리(옛 기간 스피너 잔존 방지)
    (async () => {
      if (!c || !session || !input || !savedChart) return;
      const id = await ensureServerChartId(c, input, session, savedChart);
      if (!alive || !id) return;
      setChartId(id);
      chartIdRef.current = id;   // ① 현재 명식 확정 — 이후 gen 결과의 명식 대조 기준
      const { data } = await supabase.from('readings').select('category, content, created_at').eq('chart_id', id).eq('lang', appLang());
      if (!alive) return;
      const loaded: Record<string, any> = {};
      const created: Record<string, string> = {}; // 기간별 생성일(보유 만료일 계산용·daniel #25)
      (data ?? []).forEach((r: any) => { if (/^(life|year)_/.test(r.category)) { loaded[r.category] = r.content; if (r.created_at) created[r.category] = r.created_at; } });
      setReadings(loaded);
      setCreatedAt(created);
      // 프리미엄 자동 생성은 '무료' 기간(현재 대운·올해)만 + ★대표 명식에만(비용통제). 오프라인=보류.
      if (isRep && isOnline()) { // 현재 대운·올해는 전원 무료 → 자동 생성(daniel)
        if (curDecadeKey && !loaded[curDecadeKey]) gen(curDecadeKey, id);
        if (!loaded[`year_${nowYear}`]) gen(`year_${nowYear}`, id);
      }
    })().catch(() => {});
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, session, savedChart, curDecadeKey, isRep]);

  // ★자물쇠(chart race) 계보의 마지막 문(daniel 07-03): 수동 생성 경로가 stale 시드로 나가지 않게 canonical id 재해석.
  //   chartId useState 시드는 온디바이스 캐시(savedChart.serverChartId)라, 진입 effect가 서버 canonical로 교체하기 전에
  //   사용자가 생성/열기 버튼을 누르면 그 stale id로 게이트·interpret가 나갈 수 있다. ensureServerChartId는 멱등
  //   (inflight dedupe + 서버 natal 지문)이라 재호출해도 이중 발급·이중 과금이 없다. 자동생성 경로는 이미 canonical id를 넘긴다.
  async function resolveChartId(): Promise<string | null> {
    if (!c || !session || !input || !savedChart) return chartId; // 재해석 불가(폴백 경로) → 기존 시드 유지
    return ensureServerChartId(c, input, session, savedChart);
  }

  // 항목 통변 생성(Edge kind='timeline') — 캐시 적중 시 재생성 0.
  //   게이트(daniel): 프리미엄=현재 대운/올해 무료, 그 외 시기는 타임라인 이용권으로 1회 열기(건당 결제 준비 중).
  async function gen(key: string, id?: string | null) {
    // 가드: selDecade 초기값('')이 그대로 전달되면 Edge에 빈 category가 가는 것을 막는다.
    if (!key) return;
    // id를 명시적으로 받지 않은 수동 경로(startGen/pick)는 canonical id를 항상 재해석(자물쇠 계보 마지막 문).
    const cid = id ?? await resolveChartId();
    if (!cid || readings[key] || busy === key) return;
    if (cid !== chartId) setChartId(cid);                   // 온디바이스 시드가 stale이었으면 canonical로 동기화
    chartIdRef.current = cid;                               // ① gen 이 대상으로 삼는 명식 확정(load effect 미완료 시점 탭에도 false-stale 방지 — canonical 은 멱등이라 안전)
    if (!assertOnline(t)) return;                          // 오프라인 = 신규 생성 차단
    // 비프리미엄 = 프리미엄 유도(타임라인은 프리미엄 메뉴). 이용권이 있으면 이용권으로 열기 허용.
    // 게이트(새 정책·daniel): 프리미엄(무제한)=무료 / 현재 대운·올해=전원 무료 / 그 외=서버 언락 또는 개별 크레딧(없으면 구매). 차감·언락은 Edge.
    if (!isPremiumForChart(cid) && !isFree(key)) { // 지정 프리미엄 명식만 무게이트(#1). 계정 프리미엄이라도 비지정 명식은 개별 결제
      const has = (cid ? await isReadingUnlocked(cid, 'timeline') : false) || ((await loadCredits())['timeline'] ?? 0) > 0;
      if (!has) {
        Alert.alert(t('timeline.unlockTitle'), t('timeline.unlockMsg'), [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('reading.payPerUse', '구매'), onPress: async () => { try { const ok = await purchaseCreditRC('timeline'); if (!ok) return; const { granted } = await waitForCreditGrant('timeline'); if (granted) await gen(key, cid); else Alert.alert(t('timeline.unlockTitle'), t('reading.applyPending', '결제가 완료됐어요. 적용까지 잠시 걸릴 수 있어요. 잠시 후 다시 시도해 주세요.')); } catch (e) { Alert.alert('!', (e as Error).message); } } }, // ★C1: 결제→웹훅 적립 폴링→Edge 세트게이트 차감
        ]);
        return;
      }
    }
    // ② 중복/크로스마운트 생성 잠금 — 이 명식·이 기간이 이미 생성 중이면 2차 호출 안 함(자동 2기간은 키가 달라 각각 통과·과금 0).
    const lockKey = `timeline:${cid}:${key}`;
    if (!acquireGen(lockKey)) return;
    const myGen = genSeq.current;   // ① 세대 스냅샷(load effect 가 명식전환 시 증가 → stale 판별)
    const myChart = cid;            // ① 대상 명식
    const isStale = () => myGen !== genSeq.current || myChart !== chartIdRef.current;
    setBusy(key);
    // ③ 배너/푸시 명식 식별 — route 에 chartId(로컬 savedChart.id) + chartLabel. 재진입 바인딩은 ★M1 로 timeline.tsx 라우트(loadRepChart 前)에 구현됨(reading.tsx 38-43 패턴).
    const gpRoute = savedChart?.id ? `/timeline?chartId=${savedChart.id}` : '/timeline';
    setGenProgress({ active: true, total: 1, done: 0, label: '인생 타임라인', chartLabel: savedChart?.label, route: gpRoute }); // 일회성 진행도(daniel 이슈15)
    try {
      // 사주 大運 주축 + 자미두수 운한(대한) 보조 교차(daniel: 타임라인은 사주+자미 종합) — love 화면처럼 최신 자미 명반(운한 포함)을 body로 전달.
      //   시각 미상 차트는 c.ziwei가 子시(0시) 기반이라 부실하지만, 서버 빌더가 timeUnknown 게이트로 무시(사주만 폴백). 자미 계산은 지연 — 이 호출 시 1회만.
      const { data, error } = await supabase.functions.invoke('interpret', { body: { chartId: cid, category: key, kind: 'timeline', tier: 'paid', lang: appLang(), ziwei: c?.ziwei } });
      if (isStale()) return;   // ① 생성 사이 명식 전환됨 → 폐기(옛 명식 시기통변이 새 명식 readings 에 섞이지 않게)
      // 방어: 일시적 불가/오류는 원문 대신 친화 메시지로(예전 'non-2xx' 노출 방지)
      const f = invokeFail(data, error);
      setReadings((prev) => ({ ...prev, [key]: f ? { error: f.message } : data?.reading }));
    } catch (e) {
      if (isStale()) return;
      setReadings((prev) => ({ ...prev, [key]: { error: (e as Error).message } }));
    } finally {
      releaseGen(lockKey);   // ② 완료·중단·오류·폐기 모두 잠금 해제
    }
    if (isStale()) return;   // ① 완료 처리도 현재 명식일 때만
    setGenProgress({ route: gpRoute, done: 1, total: 1 }); // 완료 → 홈 배너 '풀이 보기'(daniel 이슈15)
    setBusy(null);
  }

  // 생성 전 '이 명식으로 풀이할지' 확인(+보유 이용권) → 확인 시 gen. 수동 '보기/열기' 버튼 전용 — 자동생성 useEffect·pick(무료 자동)에는 미적용(daniel 07-02).
  function startGen(key: string) {
    if (!key || busy === key || readings[key]) return; // gen과 동일한 값싼 가드(불필요한 확인창 방지)
    void confirmReadingChart({ chartLabel: savedChart?.label, creditKind: 'timeline', t, onConfirm: () => { void gen(key); } });
  }

  // picker에서 선택 → 무료/이미 캐시된 기간만 자동 생성. 잠긴 기간은 카드의 '열기' 버튼으로 명시적 결제.
  function pick(key: string) {
    if (key.startsWith('life_')) setSelDecade(key); else setSelYear(key);
    setPicker(null);
    if (!readings[key] && isFree(key)) gen(key); // 무료시기(현재 대운·올해)만 자동 — 유료 시기는 카드에서 직접
  }

  // 카드의 카테고리 칩 선택값(기본 general)
  const catOf = (key: string): CatKey => catByKey[key] ?? 'general';

  const bodyDyn = { fontSize: fs(15), lineHeight: fs(25) };
  const decadeLabel = decades.find((d) => d.key === selDecade)?.label ?? '';
  const yearLabel = selYear.startsWith('year_') ? `${selYear.slice(5)}년` : '';

  // 간지 칩 — 천간·지지 각각 제 오행색으로 분리(daniel #16: 한 글자씩 알맞은 색)
  const gzChip = (gz: string, _stem?: string) => (
    <View style={{ flexDirection: 'row', gap: 3 }}>
      {[...gz].map((ch, i) => {
        const el = i === 0 ? stemElement(ch) : branchElement(ch); // 0=천간, 1=지지
        const yy = i === 0 ? stemYinYang(ch) : branchYinYang(ch); // daniel: 모든 한자에 음양 표시
        return (
          <View key={i} style={[styles.gz, { backgroundColor: elementColor[el] }]}>
            <Text style={[styles.gzTx, { color: elementText[el] }]}>{ch}</Text>
            <Text style={{ fontSize: 8, fontWeight: '700', color: elementText[el], marginTop: -3 }}>{yy}</Text>
          </View>
        );
      })}
    </View>
  );

  // 통변 카드(공용) — 5카테고리(통합·직업·재물·애정·건강) 칩 + 선택 카테고리 본문(원국 풀이처럼 상세).
  //   잠긴 기간(프리미엄 현재 외)은 잠금 안내 + '이 시기 열기' 버튼(이용권 차감).
  const card = (key: string) => {
    // 가드: curDecadeKey가 아직 확정되지 않아 selDecade === '' 인 경우 스켈레톤만 표시(Edge 호출 없음).
    if (!key) return <View style={styles.card}><ActivityIndicator color={colors.ju} /></View>;
    const r = readings[key];
    if (busy === key && !r) return <View style={styles.card}><ActivityIndicator color={colors.ju} /><Text style={[styles.busyTx, { fontSize: fs(12) }]}>{t('timeline.generating')}</Text></View>;
    if (r?.error) return <View style={styles.card}><Text style={[styles.err, { fontSize: fs(13) }]}>{String(r.error)}</Text></View>;
    // 아직 생성 안 됨 → 무료 기간이면 안내, 잠긴 기간이면 잠금 카드(열기 버튼)
    if (!r) {
      if (isFree(key)) return (
        <PressableScale style={styles.readBtn} onPress={() => startGen(key)}>
          <Text style={[styles.readBtnTx, { fontSize: fs(15) }]}>{t('timeline.readThis', '이 시기 풀이 보기')}</Text>
        </PressableScale>
      );
      return (
        <View style={[styles.card, styles.lockCard]}>
          <Text style={[styles.lockH, { fontSize: fs(15) }]}>🔒 {t('timeline.lockedTitle')}</Text>
          <Text style={[styles.lockSub, { fontSize: fs(12), lineHeight: fs(19) }]}>{t('timeline.lockedSub')}</Text>
          <PressableScale style={styles.unlockBtn} onPress={() => startGen(key)}>
            <Text style={[styles.unlockBtnTx, { fontSize: fs(15) }]}>{t('timeline.unlock')}</Text>
          </PressableScale>
        </View>
      );
    }
    // 보유 만료일(daniel #25): 이 기간 풀이 생성(구매)일 + 1년. 유료 기간만(현재 대운·올해 = 무료라 '재구매' 문구 부적합 → 미표시).
    //   현재 무료 기간도 시간이 지나면(과거 대운·작년) isFree=false가 되어 그때부터 만료일이 노출된다.
    const cAt = createdAt[key];
    // 만료일 = 유료 기간(현재 대운/올해 무료 제외)만 계산 → ExpiryNote가 프리미엄 가드·표시(공통, daniel 07-01)
    const exp = (cAt && !isFree(key)) ? (() => { const d = new Date(cAt); d.setFullYear(d.getFullYear() + 1); return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`; })() : null;
    const expiryNote = <ExpiryNote expiry={exp} chartId={chartId} />;
    // 하위호환: 구(舊) 캐시는 {base,overlay,remedy} 형식 — 카테고리 키가 없으면 옛 레이아웃으로 표시.
    //   (배포 후 새로 생성되는 풀이는 {general,work,money,love,health} 5카테고리)
    const isOld = !YEAR_KEYS.some((ck) => typeof r[ck] === 'string') && (r.base || r.overlay || r.remedy);
    if (isOld) {
      return (
        <View style={styles.card}>
          {expiryNote}
          {r.base ? <Text style={[styles.body, bodyDyn]}>{r.base}</Text> : null}
          {r.overlay ? <Text style={[styles.body, bodyDyn, { marginTop: space(3) }]}>{r.overlay}</Text> : null}
          {r.remedy ? <Text style={[styles.body, bodyDyn, { marginTop: space(3) }]}>{r.remedy}</Text> : null}
        </View>
      );
    }
    const cats = catsFor(key);                                 // 연도=8 / 대운=5
    const cat = cats.includes(catOf(key)) ? catOf(key) : 'general'; // 대운에서 8개용 선택이 남아있으면 보정
    const body = r[cat];                                       // 선택 카테고리 본문
    const months: any[] = Array.isArray(r.months) ? r.months : []; // 연운 월별(12)
    return (
      <View style={styles.card}>
        {expiryNote}
        {/* 이슈19 소제목 — 이 시기 통변의 headline 있으면 통변 표시 맨 위에 한 줄 강조 */}
        {typeof r.headline === 'string' && r.headline.trim() ? (
          <Text style={{ fontSize: fs(19), fontWeight: '800', color: colors.ju, marginBottom: space(3), lineHeight: fs(26) }}>{r.headline}</Text>
        ) : null}
        {/* 카테고리 칩 — 대운 5 / 연운 8 */}
        <View style={styles.chips}>
          {cats.map((ck) => {
            const on = ck === cat;
            return (
              <PressableScale key={ck} style={[styles.chip, on && styles.chipOn]} onPress={() => setCatByKey((p) => ({ ...p, [key]: ck }))}>
                <Text style={[styles.chipTx, on && styles.chipTxOn, { fontSize: fs(13) }]}>{t(CAT_DEF[ck])}</Text>
              </PressableScale>
            );
          })}
        </View>
        <Text style={[styles.body, bodyDyn, { marginTop: space(4) }]}>{typeof body === 'string' && body ? body : t('timeline.generating')}</Text>

        {/* 연운 월별 흐름(1~12월) — 유료라 더 디테일하게 */}
        {months.length > 0 && (
          <View style={styles.monthsBox}>
            <Text style={[styles.monthsH, { fontSize: fs(14) }]}>{t('timeline.months')}</Text>
            {months.map((m, i) => (
              <View key={i} style={styles.monthRow}>
                <Text style={[styles.monthNo, { fontSize: fs(13) }]}>{i + 1}{t('timeline.monthUnit')}</Text>
                <Text style={[styles.monthTx, bodyDyn]}>{String(m).replace(/^\s*\d+\s*월\s*[—\-:]*\s*/, '')}</Text>
              </View>
            ))}
          </View>
        )}
        {/* daniel(2026-06-24): 이 시기 풀이 음성으로 듣기(온디바이스 TTS·무료) */}
        <TTSButton reading={r} />
      </View>
    );
  };

  // picker 버튼(공용)
  const pickerBtn = (label: string, sub: string, onPress: () => void) => (
    <PressableScale style={styles.pickBtn} onPress={onPress}>
      <Text style={[styles.pickBtnTx, { fontSize: fs(15) }]}>{label}: <Text style={{ color: colors.ju, fontWeight: '800' }}>{sub}</Text></Text>
      <Text style={styles.pickChevron}>▾</Text>
    </PressableScale>
  );

  if (!c) return <View style={styles.center}><Text style={[font.body, { fontSize: fs(15) }]}>{t('myeongsik.noChart')}</Text></View>;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.wrap}>
      {/* 시기(대운/세운) 통변 생성 중 = 타임라인 테마 영상 로딩(busy=생성 중인 category). Modal 이라 위치 무관(최상단 오버레이) */}
      <UnlockOverlay visible={!!busy} videoKey="timeline" message={t('timeline.generating')} />
      {/* 풀이 공개 순간 골드 명조 문 열림 영상 — 1회 재생 후 페이드아웃하며 풀이 노출(daniel 07-06) */}
      <DoorReveal visible={doorPlaying} onDone={() => setDoorPlaying(false)} />
      <Text style={[styles.h, { fontSize: fs(22) }]}>{t('reading.timelineTitle')}</Text>
      <Text style={[styles.sub, { fontSize: fs(12), lineHeight: fs(19) }]}>{t('reading.timelineSub')}</Text>

      {/* 무료 결정론 티저 — 유료 연도별 풀이 '위'에 대운 흐름 스트립(온디바이스·API 0). 아래 유료 카드로 자연 유도 */}
      {c.saju ? <TimelineTeaser saju={c.saju} /> : null}

      {/* ── 위: 대운(10년) ── */}
      <Text style={[styles.secH, { fontSize: fs(15) }]}>{t('timeline.decades')}</Text>
      {pickerBtn(t('timeline.pickDecade'), `${decadeLabel}${selDecade === curDecadeKey ? ` (${t('timeline.now')})` : ''}`, () => setPicker('decade'))}
      {card(selDecade)}

      <View style={styles.divider} />

      {/* ── 아래: 연도(1년) ── */}
      <Text style={[styles.secH, { fontSize: fs(15) }]}>{t('timeline.years')}</Text>
      {pickerBtn(t('timeline.pickYear'), `${yearLabel}${selYear === `year_${nowYear}` ? ` (${t('timeline.thisYear')})` : ''}`, () => setPicker('year'))}
      {card(selYear)}

      {/* picker 모달(대운/연도 공용) */}
      <Modal visible={picker !== null} transparent animationType="slide" onRequestClose={() => setPicker(null)}>
        <Pressable style={styles.backdrop} onPress={() => setPicker(null)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={[styles.sheetH, { fontSize: fs(17) }]}>{picker === 'decade' ? t('timeline.pickDecade') : t('timeline.pickYear')}</Text>
            <ScrollView ref={listRef} style={{ maxHeight: 440 }}>
              {picker === 'decade' && decades.map((d) => {
                const on = selDecade === d.key, isCur = d.key === curDecadeKey;
                return (
                  <PressableScale key={d.key} style={[styles.row, on && styles.rowOn]} onPress={() => pick(d.key)}>
                    <Text style={[styles.rowTx, isCur && { color: colors.ju, fontWeight: '800' }, { fontSize: fs(15) }]}>{d.label}{isCur ? ` (${t('timeline.now')})` : ''}</Text>
                    {gzChip(d.gz, d.stem)}
                  </PressableScale>
                );
              })}
              {picker === 'year' && years.map((y) => {
                const on = selYear === y.key, isNow = y.year === nowYear;
                return (
                  <PressableScale key={y.key} style={[styles.row, on && styles.rowOn]} onPress={() => pick(y.key)}>
                    <Text style={[styles.rowTx, isNow && { color: colors.ju, fontWeight: '800' }, { fontSize: fs(15) }]}>{y.year}년 · {y.age}세{isNow ? ` (${t('timeline.thisYear')})` : ''}</Text>
                    {gzChip(y.gz, y.stem)}
                  </PressableScale>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: 'transparent' }, // 전역 배경 투과(ContentBackdrop)
  wrap: { padding: space(5), paddingBottom: space(12) },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'transparent' }, // 전역 배경 투과(ContentBackdrop)
  h: { ...font.title, marginBottom: space(1) },
  sub: { ...font.caption, color: colors.inkSoft, marginBottom: space(5), lineHeight: 19 },
  secH: { fontSize: 15, fontWeight: '800', color: colors.ju, marginBottom: space(2) },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.line, marginVertical: space(7) },
  gz: { minWidth: 44, paddingHorizontal: space(2), paddingVertical: space(1), borderRadius: radius.sm, alignItems: 'center' },
  gzTx: { fontSize: 16, fontWeight: '800' },
  pickBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.ju, borderRadius: radius.md, padding: space(4), ...shadow.card },
  pickBtnTx: { ...font.body, color: colors.ink, flexShrink: 1 },
  pickChevron: { color: colors.ju, fontSize: 16, fontWeight: '800' },
  card: { marginTop: space(3), backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.juLine, padding: space(5), ...shadow.card },
  body: { ...font.body, color: colors.ink },
  // 카테고리 칩(통합·직업·재물·애정·건강)
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  chip: { paddingVertical: space(2), paddingHorizontal: space(3), borderRadius: radius.pill ?? 999, borderWidth: 1, borderColor: colors.juLine, backgroundColor: colors.bg },
  chipOn: { backgroundColor: colors.ju, borderColor: colors.ju },
  chipTx: { fontSize: 13, fontWeight: '700', color: colors.inkSoft },
  chipTxOn: { color: colors.bg },
  // 연운 월별(1~12월)
  monthsBox: { marginTop: space(5), paddingTop: space(4), borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  monthsH: { fontSize: 14, fontWeight: '800', color: colors.ju, marginBottom: space(3) },
  monthRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: space(2.5), gap: space(3) },
  monthNo: { fontSize: 13, fontWeight: '800', color: colors.ju, width: 34 },
  monthTx: { ...font.body, color: colors.ink, flex: 1 },
  // 잠금 카드(현재 외 시기)
  lockCard: { alignItems: 'center', borderColor: colors.ju, borderStyle: 'dashed' },
  lockH: { fontSize: 15, fontWeight: '800', color: colors.ju, marginBottom: space(2) },
  lockSub: { ...font.caption, color: colors.inkSoft, textAlign: 'center', lineHeight: 19, marginBottom: space(4) },
  unlockBtn: { backgroundColor: colors.ju, borderRadius: radius.md, paddingVertical: space(3), paddingHorizontal: space(7) },
  unlockBtnTx: { color: colors.bg, fontWeight: '800', fontSize: 15 },
  readBtn: { backgroundColor: colors.ju, borderRadius: radius.md, paddingVertical: space(3.5), alignItems: 'center', marginTop: space(3), ...shadow.card }, // 이 시기 풀이 생성 버튼(daniel)
  readBtnTx: { color: colors.bg, fontWeight: '800' },
  busyTx: { ...font.caption, color: colors.inkSoft, marginTop: space(2), textAlign: 'center' },
  err: { fontSize: 13, color: colors.ju },
  note: { ...font.caption, color: colors.inkFaint, marginTop: space(3), lineHeight: 19 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.bg, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: space(5), paddingBottom: space(9) },
  sheetH: { ...font.heading, color: colors.ink, marginBottom: space(3) },
  row: { height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space(2), borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  rowOn: { backgroundColor: colors.juSoft, borderRadius: radius.sm },
  rowTx: { ...font.body, color: colors.ink },
});
