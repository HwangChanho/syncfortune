// app/src/screens/CompatScreen.tsx — 1:1 궁합 (관계 유형별 일반인 통변 + 글자 작용 상세)
// ─────────────────────────────────────────────────────────────────────────
// daniel 개편(2026-06-11): ① 두 명식을 각각 슬롯으로 — '내 명식'은 골드 슬롯으로 따로 빼서 식별,
//   상대는 저장 명식 선택 또는 직접 입력. ② 통변 = 단순 합충 나열이 아니라 관계 유형(지인·친구/동업/
//   투자/연애/결혼)별로 핵심을 먼저 짚어 일반인이 읽게(Edge kind='compat', 쉬운 말). 합충 비교는 접이식 상세.
// 결정론(일간관계·교차합충)은 온디바이스 → 통변의 근거로 Edge에 전달(규칙2 사주 단독). 상대 PII=동의(규칙8).
// ─────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useRef } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator, Modal, TextInput, Keyboard, Image, Animated, Easing } from 'react-native';
import { PressableScale } from '../components/PressableScale';
import { useSafeAreaInsets } from 'react-native-safe-area-context'; // 모달 상단 노치/상태바 침범 방지(J)
import { Alert } from '../lib/ui/alert'; // 커스텀 알림(앱 디자인)
import { useTranslation } from 'react-i18next';
import { computeChart } from '../lib/engine/engine';
import { analyzeCompatibility } from '@engine/compatibility';
import { detectInteractionsAmong } from '@engine/structure';
import { stemElement, branchElement, elementColor, elementText } from '../lib/engine/ohaeng';
import { colors, radius, space, shadow, font } from '../lib/theme';
import { listCharts, getRepresentativeId, addChart, ChartLimitError, type SavedChart } from '../lib/engine/myChart';
import { buildNumerology } from '../lib/content/numerology'; // 수비학 보조 교차(궁합, daniel 2026-06-23)
import { ChartRegisterScreen } from './ChartRegisterScreen'; // 상대 명식 = 정식 등록 폼으로 입력
import { useAuth } from '../lib/useAuth';
import { useSubscription, purchasePremium } from '../lib/billing/subscription';
import { assertOnline } from '../lib/backend/network'; // 오프라인 시 신규 생성 차단
import { purchaseCreditRC } from '../lib/billing/purchases'; // 궁합 건당 결제 = credit_compat(서버 consume)
import { waitForCreditGrant, creditPrice, formatKrw } from '../lib/billing/coupons'; // C1 웹훅 폴링 + 실가 주입(하드코딩 근절)
import { ensureServerChartId } from '../lib/backend/prewarmReadings';
import { useFontScale } from '../lib/ui/fontScale';
import { COMPAT_RELS, otherSig, loadCompatReadings, genCompatReading, compatSections, compatSectionLabel, type CompatReading } from '../lib/content/compatReadings';
import { setGenProgress, getGenItem } from '../lib/backend/genProgress'; // 다건 진행도(route='/compat', daniel·docs/CONTENT_API_INVENTORY.md)
import { acquireGen, releaseGen, isGenActive } from '../lib/backend/genLock'; // 크로스마운트 이중 생성 잠금(② 이중 LLM 방지)
import { loadFollowups, askFollowup, type Followup } from '../lib/backend/followups'; // 궁합 추가질문(사주/자미 풀이와 동일 — 무료1 + 건당)
import { yearGanZhi } from '../lib/content/dailyFortune'; // 연도별 궁합: 그 해 간지(세운)
import { compatScore, tierLabel, tierOf, type CompatScoreResult } from '../lib/content/compatScore'; // 궁합 점수·등급(R26: LLM 직접 산출 우선, 결정론은 폴백)
import { appLang } from '../lib/i18n';

// 궁합 등급별 이미지 — assets/icons/compat/{tier.key}.jpg. 없으면 이모지 폴백(이미지 생성 후 require 연결).
const COMPAT_IMG: Record<string, any> = {
  soulmate: require('../../assets/icons/compat/soulmate.jpg'),
  great: require('../../assets/icons/compat/great.jpg'),
  good: require('../../assets/icons/compat/good.jpg'),
  steady: require('../../assets/icons/compat/steady.jpg'),
  spark: require('../../assets/icons/compat/spark.jpg'),
  opposite: require('../../assets/icons/compat/opposite.jpg'),
};

// 관계 카테고리별 이미지(daniel: 각 카테고리에 맞는 이미지) — assets/icons/compat-rel/{rel}.jpg. 선택 관계 배너.
const CAT_IMG: Record<string, any> = {
  friend: require('../../assets/icons/compat-rel/friend.jpg'),
  family: require('../../assets/icons/compat-rel/family.jpg'),
  love: require('../../assets/icons/compat-rel/love.jpg'),
  marriage: require('../../assets/icons/compat-rel/marriage.jpg'),
  coworker: require('../../assets/icons/compat-rel/coworker.jpg'),
  senior: require('../../assets/icons/compat-rel/senior.jpg'),
  staff: require('../../assets/icons/compat-rel/staff.jpg'),
  business: require('../../assets/icons/compat-rel/business.jpg'),
};
import { UnlockOverlay } from '../components/UnlockOverlay'; // 생성 중 화면 가림 로딩(daniel)
import { DoorReveal } from '../components/DoorReveal'; // 풀이 공개 순간 골드 명조 문 열림 영상(daniel 07-06)
import { TTSButton } from '../components/TTSButton'; // 풀이 음성 읽기(온디바이스 TTS·무료)
import type { ChartInput } from '@spec/chart';

// 이어보기(daniel): 궁합 상태가 in-memory라 홈 갔다 오면 초기화됐음 → 마지막 선택(나·상대·관계)을 모듈에 보관해 복원.
//   서버 캐시(readings)는 항상 저장되지만, 상대를 복원해야 sig로 캐시를 다시 불러올 수 있다.
let _lastCompat: { meId?: string; otherId?: string; rel?: string } = {};

// 궁합 점수 카운트업(0→score) + 게이지 채움 — 궁합 고유 재미(daniel ②콘텐츠별 메타포). score 변경 시 재애니.
function ScoreReveal({ score }: { score: number }) {
  const [disp, setDisp] = useState(0);
  const w = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const v = new Animated.Value(0);
    const id = v.addListener(({ value }) => setDisp(Math.round(value)));
    Animated.timing(v, { toValue: score, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    Animated.timing(w, { toValue: score, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    return () => v.removeListener(id);
  }, [score, w]);
  return (
    <>
      <Text style={styles.scoreNum}>{disp}<Text style={styles.scoreUnit}> / 100</Text></Text>
      <View style={styles.scoreBar}><Animated.View style={[styles.scoreBarFill, { width: w.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) }]} /></View>
    </>
  );
}

export function CompatScreen({ me }: { me: ChartInput | null }) {
  const { t } = useTranslation();
  const { session } = useAuth();
  const { isPremium } = useSubscription();
  const { fs } = useFontScale(); // 통변 본문 글자 크기(설정에서 조절)
  const insets = useSafeAreaInsets(); // 상대 등록 모달 헤더가 노치/상태바에 가리지 않게(daniel J)
  const [saved, setSaved] = useState<SavedChart[]>([]);
  const [meSel, setMeSel] = useState<SavedChart | null>(null);   // '내 명식' 슬롯(기본=대표). 저장 명식에서 변경 가능.
  const [pickFor, setPickFor] = useState<null | 'me' | 'other'>(null); // 명식 선택 드롭다운(내/상대 공용) — daniel: 버블 대신 세로 리스트 스크롤
  const [otherSel, setOtherSel] = useState<SavedChart | null>(null); // 상대(저장 명식). 없으면 등록 폼으로 추가.
  const [otherReg, setOtherReg] = useState(false);                    // 상대 명식 등록 폼 모달
  // 통변(관계별) + 결정론 비교
  const [rel, setRel] = useState('love');                        // 선택 관계 유형(기본 연애)
  const [year, setYear] = useState('');                          // '' = 원국(관계 본바탕) / 'YYYY' = 그 해 흐름
  const [compatTab] = useState<'saju' | 'ziwei'>('saju'); // ★탭 제거(daniel 2026-07-15) — 항상 'saju'(=사주+자미 합친 'compat' 통변). setter 미사용.
  const [readings, setReadings] = useState<Record<string, CompatReading>>({});
  const [busy, setBusy] = useState<string | null>(null);         // 생성 중 키(rel 또는 rel_yYYYY)
  const [loading, setLoading] = useState(false);                 // 재진입 시 캐시 로딩 중 — 자물쇠 대신 스피너(daniel ⑦ 완료 감지)
  const [pair, setPair] = useState<{ me: any; other: any } | null>(null);
  const [compat, setCompat] = useState<CompatScoreResult | null>(null); // 궁합 점수·등급(결정론 — 통변과 별개로 항상)
  const [ctx, setCtx] = useState<{ chartId: string; sig: string; cross: string[]; dayRel: string; meZiwei: any; otherZiwei: any; numMe?: any; numOther?: any } | null>(null); // 연도별 추가 생성 컨텍스트(+수비학 보조)
  const YEARS = Array.from({ length: 43 }, (_, i) => new Date().getFullYear() - 2 + i); // 연도별 옵션(올해-2~+40 전체 — 드롭다운 스크롤·daniel K)
  const [yearOpen, setYearOpen] = useState(false);              // 년도 선택 드롭다운(전체 년도 스크롤 리스트)
  const [showDetail, setShowDetail] = useState(false);           // 글자 작용 상세 접이식
  const [active, setActive] = useState<Set<string>>(new Set());
  // 궁합 추가질문(관계유형/연도 키별) — 사주·자미 풀이와 동일(무료 1회 + 건당 결제)
  const [followups, setFollowups] = useState<Record<string, Followup[]>>({});
  const [askInput, setAskInput] = useState('');
  const [asking, setAsking] = useState(false);
  const [doorPlaying, setDoorPlaying] = useState(false); // 풀이 공개 순간 골드 명조 문 열림 영상(daniel 07-06)
  const doorShown = useRef(false);                       // 유효 궁합 통변 최초 공개 1회 가드(관계/탭 전환·재렌더 시 재생 방지)
  // ① 생성 세대 토큰 — 쌍(나+상대) 전환 시 analyze() 가 ++ 로 진행 중 gen 무효화(옛 쌍 결과가 새 쌍 readings 에 섞이는 것 차단).
  //   compat 의 '명식'은 쌍이므로 analyze() 재실행(= 쌍 변경)이 곧 chartIdRef 갱신 역할을 겸한다.
  const genSeq = useRef(0);

  // 저장 명식 + 대표 로드 → 내 명식 슬롯. 이어보기(daniel): 마지막 나·상대·관계 복원(홈 갔다 와도 초기화 안 되게).
  useEffect(() => {
    (async () => {
      const list = await listCharts(); setSaved(list);
      const repId = await getRepresentativeId();
      const rep = list.find((c) => c.id === repId) ?? list.find((c) => c.relation === 'self') ?? list[0] ?? null;
      setMeSel((_lastCompat.meId && list.find((c) => c.id === _lastCompat.meId)) || rep);
      if (_lastCompat.otherId) { const o = list.find((c) => c.id === _lastCompat.otherId); if (o) setOtherSel(o); }
      if (_lastCompat.rel) setRel(_lastCompat.rel);
    })();
  }, []);

  // 위저드(daniel 궁합 재디자인): 나+상대가 준비되면 자동 분석 → 캐시 로드(동일 쌍 재선택은 무과금). 상대 변경 시 재분석. 큰 분석 버튼 제거 → 선택만으로 진행.
  useEffect(() => {
    if (meSel && otherSel && session) analyze();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meSel?.id, otherSel?.id, session?.user?.id]);

  // 통변 컨텍스트(ctx) 준비되면 그 차트의 추가질문 로드(관계유형/연도 키별)
  useEffect(() => { if (ctx?.chartId) loadFollowups(ctx.chartId).then(setFollowups).catch(() => {}); }, [ctx]);

  // 현재 '내 명식' input(슬롯 선택 우선, 없으면 라우트 me)
  const meInput: ChartInput | null = meSel?.input ?? me;
  const otherInput: ChartInput | null = otherSel?.input ?? null; // 상대 = 저장 명식(등록 폼으로 추가)

  // 상대 명식 등록(정식 폼) → 내 명식 목록에 저장 + 상대 슬롯 자동 선택. 무료 한도 초과 시 안내.
  async function onRegisterOther(input: any) {
    try {
      const id = await addChart(input, { isPro: isPremium });
      const list = await listCharts(); setSaved(list);
      setOtherSel(list.find((c) => c.id === id) ?? null);
      setOtherReg(false);
    } catch (e) {
      if (e instanceof ChartLimitError) Alert.alert(t('register.limitTitle'), t('register.limitMsg', { limit: e.limit }));
      else Alert.alert('!', (e as Error).message);
    }
  }

  function toggleActive(key: string) {
    setActive((prev) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  }

  // 궁합 풀이 — 두 명식 결정론 계산(근거) → 서버차트 확보 → 관계 유형별 통변 로드/생성.
  //   게이트(서버 판정): 비프리미엄=프리미엄 유도 / 무료 5쌍 초과=건당 결제(paid 재시도). daniel.
  async function analyze() {
    if (!meInput || !otherInput || !session) return;
    genSeq.current++;  // ① 쌍(나+상대) 재분석 = 진행 중 runCompatGen 무효화(옛 쌍 결과가 새 쌍 readings 에 setReadings 되지 않게)
    setBusy(null);     // ① 무효화한 gen 의 로딩 키 정리(옛 관계키 스피너 잔존 방지)
    setLoading(true); // 캐시/서버 차트 로딩 시작 — 준비 전까지 스피너(noReading·자물쇠 플래시 방지)
    _lastCompat = { meId: meSel?.id, otherId: otherSel?.id, rel }; // 이어보기 복원용(마지막 선택 보관)
    const meC = computeChart(meInput), otherC = computeChart(otherInput);
    // 수비학 보조 교차(daniel 2026-06-23) — 두 사람 생명수·생일수(생년월일 기반)를 Edge 궁합 통변에 보조로 전달.
    const numOf = (inp: any) => { const [dp] = String(inp?.birthDateTime ?? '').split(' '); const [y, mo, d] = dp.split('-').map(Number); return (y && mo && d) ? buildNumerology({ year: y, month: mo, day: d }) : undefined; };
    const numMe = numOf(meInput), numOther = numOf(otherInput);
    setPair({ me: meC.saju, other: otherC.saju }); setActive(new Set()); setYear(''); // 분석 시작 = 원국부터
    const dx = analyzeCompatibility(meC.saju, otherC.saju);     // 일간관계·교차(통변 근거)
    setCompat(compatScore(dx));                                 // 궁합 점수·등급(결정론 — 항상 표시, 저장명식 없어도)
    if (!meSel) { setLoading(false); return; } // 캐시·통변은 저장 명식(serverChartId) 필요 — 대표 없으면 점수·비교만
    const chartId = await ensureServerChartId(meC, meInput, session, meSel);
    if (!chartId) { setLoading(false); return; }
    const sig = otherSig(otherC.saju);
    const cross = crossDetails(meC.saju, otherC.saju);          // 교차작용(통변 근거 — 쉬운 말로 번역)
    setCtx({ chartId, sig, cross, dayRel: dx.dayMasterRelation.detail, meZiwei: meC.ziwei, otherZiwei: otherC.ziwei, numMe, numOther }); // 연도별 추가 생성용(+수비학 보조)
    const cached = await loadCompatReadings(chartId, sig);
    setReadings(cached);
    setLoading(false); // 캐시 로드 완료 — 준비된 관계는 바로 표시(나머지는 genAll이 백그라운드)

    // ★비용 보호(daniel J/L): 진입 시 9종을 자동 생성하지 않는다(genAll 제거 = 비용 폭탄 차단).
    //   캐시된 관계는 위에서 로드돼 바로 보이고, 미생성 관계는 탭→'생성' 버튼→alert 확인 후 1건씩(genOne).
  }

  // 연도별 궁합(그 해 흐름) — 선택 관계×연도 1개 lazy 생성. ctx(analyze 시 보관) 재사용.
  //   같은 상대(쌍)면 게이트 통과(원국 생성 후라 samePair) — 비용은 캐시(연도×관계 1회)로 방어.
  // ★관계(±연도) 1건 생성 — 개별 비용이라 alert 확인 후에만(daniel J/L). 자동 전부생성(genAll) 대체.
  async function genOne(relKey: string, yr = '') {
    if (!ctx || !pair || busy) return;
    if (!assertOnline(t)) return;
    const key = `${compatTab}:${relKey}${yr ? '_y' + yr : ''}`;
    if (readings[key]) return;
    const relName = t(COMPAT_RELS.find((r) => r.key === relKey)?.tk ?? '');
    const pairOwned = Object.keys(readings).length > 0; // 이 쌍을 이미 구매했으면 추가 비용 0(쌍당 1회 결제)
    Alert.alert(
      t('compat.genTitle', '풀이 만들기'),
      `${relName}${yr ? ' ' + yr + '년' : ''} 궁합 풀이를 만들까요?\n${pairOwned ? '추가 비용 없이 생성돼요.' : '이용권 1회 또는 결제가 필요해요.'}`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('compat.genConfirm', '생성'), onPress: () => runCompatGen(relKey, yr, key) },
      ],
    );
  }
  async function runCompatGen(relKey: string, yr: string, key: string) {
    if (!ctx || !pair) return;
    const tab: 'saju' | 'ziwei' = key.split(':')[0] === 'ziwei' ? 'ziwei' : 'saju'; // 키 접두에서 탭 추출(닫힘 안전)
    // ② 중복/크로스마운트 생성 잠금 — 이 명식·이 관계키가 이미 생성 중이면 2차 호출 안 함(쌍당 비용 방어).
    const lockKey = `compat:${ctx.chartId}:${key}`;
    const myGen = genSeq.current;    // ① 이 생성의 세대 스냅샷(읽기만) — 쌍 전환 시 analyze 가 genSeq 를 올려 무효화. 동시 관계키 생성끼리 서로 무효화 안 하게 '읽기'.
    const isStale = () => myGen !== genSeq.current; // ① 도중 쌍 바뀌면 이 결과를 새 쌍 readings 에 쓰지 않음(오염 차단)
    // A4(daniel 2026-07-08): 이미 이 관계키가 생성 중이면 2차 LLM 막고(과금0) 로딩 유지·완료까지 대기 후 재시도(Edge 캐시 히트=과금0). daniel: 풀이중 진입차단 허용.
    if (!acquireGen(lockKey)) {
      setBusy(key);
      for (let i = 0; i < 45 && isGenActive(lockKey); i++) await new Promise((r) => setTimeout(r, 3000));
      setBusy(null);
      if (isStale() || isGenActive(lockKey)) return;
      return runCompatGen(relKey, yr, key);
    }
    setBusy(key);
    // ③ 배너/푸시 명식 식별 — route 에 chartId(내 명식 로컬 meSel.id) + chartLabel. '나' 측 재진입 바인딩은 ★M1 로 compat.tsx 라우트(대표 전환→meSel 채택)에 구현됨. 상대(쌍)는 _lastCompat 복원.
    const gpRoute = meSel?.id ? `/compat?chartId=${meSel.id}` : '/compat';
    setGenProgress({ active: true, total: 1, done: 0, label: tab === 'ziwei' ? '자미 궁합' : '궁합', chartLabel: meSel?.label, route: gpRoute });
    try {
      const gz = yr ? yearGanZhi(Number(yr)) : undefined;
      const res = await genCompatReading(ctx.chartId, relKey, ctx.sig, pair.other, ctx.cross, ctx.dayRel, ctx.meZiwei, ctx.otherZiwei, yr || undefined, gz, meSel?.context, ctx.numMe, ctx.numOther, tab);
      if (isStale()) return;   // ① 생성 사이 쌍 전환됨 → 폐기(옛 쌍 결과가 새 쌍 readings 에 섞이지 않게)
      setBusy(null);
      if (res.kind === 'answer') { setReadings((prev) => ({ ...prev, [key]: res.reading })); setGenProgress({ route: gpRoute, done: 1, total: 1 }); return; }
      setGenProgress({ route: gpRoute, active: false });
      if (res.kind === 'needPremium') { Alert.alert(t('compat.premiumTitle'), t('compat.premiumMsg')); return; }
      if (res.kind === 'unavailable') { Alert.alert(t('common.error'), res.message); return; } // 방어: LLM 일시적 불가 — 재시도 안내
      if (res.kind === 'needPayment') {
        Alert.alert(t('compat.payTitle'), t('compat.payMsg'), [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('compat.payBtn'), onPress: async () => {
            try { const ok = await purchaseCreditRC('compat'); if (!ok) return; const { granted } = await waitForCreditGrant('compat'); if (granted) await runCompatGen(relKey, yr, key); else Alert.alert(t('compat.payTitle'), t('reading.applyPending', '결제가 완료됐어요. 적용까지 잠시 걸릴 수 있어요. 잠시 후 다시 시도해 주세요.')); } // ★C1: 결제→웹훅 적립 폴링→서버 consume→재생성(새 lock 획득)
            catch (e) { Alert.alert(t('reading.payPending'), (e as Error).message); }
          } },
        ]);
      }
    } finally {
      releaseGen(lockKey);   // ② 완료·중단·오류·폐기·구매유도 모두 해제(구매 후 재시도는 새 lock)
    }
  }

  // 나↔상대 교차 합충(detail 문자열 배열) — Edge 통변 근거(원국+대운+세운)
  function crossDetails(meS: any, otherS: any): string[] {
    const POSK = ['시', '일', '월', '년'] as const;
    const pers = (s: any, who: string) => {
      const out: any[] = POSK.map((p) => ({ pos: `${who}${p}`, stem: s.pillars[p].stem, branch: s.pillars[p].branch }));
      if (s.currentLuck) out.push({ pos: `${who}대운`, stem: s.currentLuck.stem, branch: s.currentLuck.branch });
      return out;
    };
    const all = [...pers(meS, '나'), ...pers(otherS, '상')];
    return detectInteractionsAmong(all.map((x) => ({ pos: x.pos as any, stem: x.stem, branch: x.branch })))
      .filter((it) => String(it.members[0]).startsWith('나') !== String(it.members[1]).startsWith('나'))
      .map((it) => it.detail);
  }

  const curKey = `${compatTab}:${rel}${year ? '_y' + year : ''}`; // 탭(사주/자미) × 관계 × 연도 — 추가질문·캐시 키
  const cur = readings[curKey];
  // R26: 궁합 점수는 LLM이 카테고리별로 *입체 산출*(가산표 아님) → 현재 풀이의 score 우선. 생성 전엔 결정론(compat) 임시값.
  const llmScore = (() => { const v: any = (cur as any)?.score; const n = typeof v === 'number' ? v : typeof v === 'string' ? parseInt(v, 10) : NaN; return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : null; })();
  const dispScore = llmScore ?? compat?.score ?? null;
  const dispTier = llmScore != null ? tierOf(llmScore) : (compat?.tier ?? null);
  const slotLine = (input: ChartInput | null) => input ? `${String(input.birthDateTime).split(' ')[0]} · ${input.sex}` : '미선택';

  // ★유료 궁합 통변(cur)이 실제로 공개되는 순간 = 골드 명조 문 열림 연출 1회(daniel 07-06). 캐시 로드/생성 완료로 처음 뜰 때만.
  //   ReadingScreen 선례처럼 마운트당 1회(관계/탭/연도 전환마다 재생 X). 무료 결정론 점수 티저(ScoreReveal)엔 재생 안 함.
  useEffect(() => {
    if (cur && !(cur as any).error && !doorShown.current) { doorShown.current = true; setDoorPlaying(true); }
  }, [cur]);

  return (
    <>
    {/* 보고 있는 관계 풀이가 이미 준비됐으면(cur) 전체 잠금 오버레이로 막지 않음 — 나머지 관계는 홈 배너로 백그라운드 진행(daniel: 완료 감지·이어보기 개선) */}
    <UnlockOverlay visible={!!busy && !cur} message={t('compat.generating', '궁합을 풀어내는 중…')} videoKey="compat" />
    {/* 풀이 공개 순간 골드 명조 문 열림 영상 — 1회 재생 후 페이드아웃하며 풀이 노출(daniel 07-06) */}
    <DoorReveal visible={doorPlaying} onDone={() => setDoorPlaying(false)} />
    <ScrollView style={styles.screen} contentContainerStyle={styles.wrap} automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled">
      {/* ── 단계형 위저드(daniel: 궁합 새 디자인) — 나❤상대 헤더 → ①상대 → ②관계 → ③관점 → 풀이 ── */}
      {/* 나 ❤ 상대 — 한 줄 컴팩트 헤더(각자 탭하면 변경/선택). 큰 슬롯·갈색 분석버튼 제거 */}
      <View style={styles.wizPair}>
        <PressableScale style={styles.wizPerson} onPress={() => setPickFor('me')}>
          <Text style={styles.wizRole}>{t('compat.mySlot', '나')}</Text>
          <Text style={styles.wizName} numberOfLines={1}>{meSel?.label ?? t('compat.mySlot', '나')}</Text>
        </PressableScale>
        <Text style={styles.wizHeart}>↔</Text>{/* daniel: 하트 X(연애 전용 아님) → 중립 상호관계 기호 */}
        <PressableScale style={[styles.wizPerson, !otherSel && styles.wizPersonEmpty]} onPress={() => setPickFor('other')}>
          <Text style={styles.wizRole}>{t('compat.otherSlot', '상대')}</Text>
          <Text style={[styles.wizName, !otherSel && styles.wizNameEmpty]} numberOfLines={1}>{otherSel?.label ?? t('compat.wizPickShort', '탭해서 선택')}</Text>
        </PressableScale>
      </View>

      {/* ① 누구와 — 상대 미선택 시 안내(선택하면 자동 분석 → 다음 단계 펼쳐짐) */}
      {!otherSel && (
        <View style={styles.wizStep}>
          <Text style={styles.stepLabel}>{t('compat.step1', '① 누구와 볼까요?')}</Text>
          <PressableScale style={styles.wizSelectBtn} onPress={() => setPickFor('other')}>
            <Text style={styles.wizSelectBtnTx}>{t('compat.otherPick', '상대 선택 · 새 상대 등록')}</Text>
          </PressableScale>
        </View>
      )}

      {/* ── 관계 유형별 통변 ── */}
      {pair && (
        <>
          {/* ② 어떤 사이? — 관계 유형 */}
          <Text style={styles.stepLabel}>{t('compat.step2', '② 어떤 사이인가요?')}</Text>
          <View style={styles.relChips}>
            {COMPAT_RELS.map((r) => (
              <PressableScale key={r.key} style={[styles.relChip, rel === r.key && styles.relChipOn]} onPress={() => setRel(r.key)}>
                <Text style={[styles.relChipTx, rel === r.key && styles.relChipTxOn]}>{t(r.tk)}</Text>
              </PressableScale>
            ))}
          </View>
          {/* ★사주/자미 탭 제거(daniel 2026-07-15 '구분짓지 말고 같이풀어') — 'compat' 통변이 이미 사주 주축+자미 보조교차로 합쳐 나옴(규칙2·R46). 항상 compatTab='saju'(=합친 통변). */}
          {/* 연도별 — 전체(원국 본바탕) / 그 해 흐름(세운). 연도 탭 시 그 관계×연도 통변 생성 */}
          <Text style={[styles.stepLabel, { marginTop: space(4) }]}>{t('compat.step3year', '③ 언제로 볼까요?')}</Text>
          <View style={styles.yearChips}>
            <PressableScale style={[styles.yearChip, !year && styles.yearChipOn]} onPress={() => setYear('')}>
              <Text style={[styles.yearChipTx, !year && styles.yearChipTxOn]}>{t('compat.yearAll')}</Text>
            </PressableScale>
            {/* K(daniel): 고정 5칸 → 드롭다운(전체 년도 스크롤 선택) */}
            <PressableScale style={[styles.yearChip, !!year && styles.yearChipOn]} onPress={() => setYearOpen(true)}>
              <Text style={[styles.yearChipTx, !!year && styles.yearChipTxOn]}>{year ? `${year}년` : t('compat.yearPick', '년도 선택')} ▾</Text>
            </PressableScale>
          </View>
          {/* 선택한 관계 카테고리 배너(daniel: 카테고리별 이미지) */}
          {CAT_IMG[rel] && <Image source={CAT_IMG[rel]} style={styles.catBanner} resizeMode="cover" />}
          {/* 궁합 점수 — 풀이 '위로'(daniel 변경: 점수 먼저, 풀이 앞). LLM 산출 score 우선, 생성 전 결정론 임시값. */}
          {cur && dispTier && dispScore != null && (
            <View style={styles.scoreCard}>
              {COMPAT_IMG[dispTier.key]
                ? <Image source={COMPAT_IMG[dispTier.key]} style={styles.scoreImg} resizeMode="cover" />
                : <Text style={styles.scoreEmoji}>{dispTier.emoji}</Text>}
              <Text style={styles.scoreTier}>{dispTier.emoji} {tierLabel(dispTier, appLang() as 'ko' | 'en' | 'ja')}</Text>
              <ScoreReveal score={dispScore} />
              {compat && <Text style={styles.scoreSub}>{t('compat.scoreHarmony', '조화')} {compat.harmony} · {t('compat.scoreTension', '긴장')} {compat.tension}</Text>}
              {/* 궁합 6기준 근거 칩(daniel 07-18) — 계절 상보·상대→나 재/관·결핍 보완·배우자궁 충돌 */}
              {compat && (
                <View style={styles.scoreSignals}>
                  {compat.seasonComplement && <Text style={styles.sigChip}>🌗 계절 상보</Text>}
                  {compat.jaegwan && <Text style={styles.sigChip}>💫 상대 = 내 {compat.jaegwan}</Text>}
                  {compat.fillChars.length > 0 && <Text style={styles.sigChip}>🧩 결핍 보완 {compat.fillChars.join('·')}</Text>}
                  {compat.spouseAfflictions.length > 0 && <Text style={[styles.sigChip, styles.sigWarn]}>⚠️ 배우자궁 {compat.spouseAfflictions.join('·')}</Text>}
                </View>
              )}
            </View>
          )}
          {cur ? (
            <View style={styles.readCard}>
              {/* 이슈19 소제목 — 이 관계 통변의 headline 있으면 섹션들 맨 위에 한 줄 강조 */}
              {typeof cur.headline === 'string' && cur.headline.trim() ? (
                <Text style={{ fontSize: fs(19), fontWeight: '800', color: colors.ju, marginBottom: space(3), lineHeight: fs(26) }}>{cur.headline}</Text>
              ) : null}
              {/* ★근본 '풀이 안 보임'(daniel 07-11): 관계별 섹션셋에 base 키가 없어 base 프로즈만 오면(JSON 파싱 폴백) 본문 공백(headline만) → base 통째로 표시. */}
              {typeof cur.base === 'string' && cur.base.trim() ? (
                <Text style={[styles.secBody, { fontSize: fs(15), lineHeight: fs(25) }]}>{cur.base}</Text>
              ) : null}
              {/* 관계별 동적 섹션(daniel 2026-06): 연애=속궁합·썸·짝사랑 등 / 결혼=속궁합·시댁·자녀 등 / 동업=투자 등. 연도별은 기본 4항목. */}
              {compatSections(rel, !!year).map((s) => {
                const v = cur[s.key];
                if (typeof v !== 'string' || !v) return null;
                if (s.key === 'core') return <Text key="core" style={[styles.coreTx, { fontSize: fs(16), lineHeight: fs(24) }]}>{v}</Text>;
                return (
                  <View key={s.key} style={[styles.sec, (s.key === 'advice' || s.key === 'remedy') && styles.remedySec]}>
                    <Text style={styles.secLabel}>{compatSectionLabel(s)}</Text>
                    <Text style={[styles.secBody, { fontSize: fs(15), lineHeight: fs(25) }]}>{v}</Text>
                  </View>
                );
              })}
              {/* 풀이 음성 읽기(온디바이스 TTS·무료) — 이 관계 통변을 compatSections 순서로 읽음 */}
              <TTSButton reading={cur} sections={compatSections(rel, !!year)} />
            </View>
          ) : (loading || (!!busy && busy === curKey)) ? (
            // 로딩/이 관계 생성 중 = 자물쇠 대신 스피너(daniel ⑦)
            <View style={{ paddingVertical: space(8), alignItems: 'center' }}><ActivityIndicator color={colors.ju} /></View>
          ) : (
            // 비용 보호(daniel J/L): 미생성 관계는 자동 호출 않고 '생성' 버튼 → alert 확인 후 1건만(genOne)
            <PressableScale onPress={() => genOne(rel, year)} style={{ alignItems: 'center', backgroundColor: colors.ju, borderRadius: radius.md, paddingVertical: space(4), paddingHorizontal: space(5), marginTop: space(4), gap: space(1) }}>
              <Text style={{ color: colors.bg, fontWeight: '900', fontSize: 16 }}>{t('compat.genCta', '이 관계 풀이 만들기')}</Text>
              <Text style={{ color: colors.bg, opacity: 0.85, fontSize: 12, fontWeight: '600' }}>{t('compat.genCtaSub', '확인 후 이용권 1회 또는 결제')}</Text>
            </PressableScale>
          )}

          {/* 추가질문 — 통변이 있을 때만(관계유형/연도 키별, 사주·자미와 동일) */}
          {cur && renderFollowups(curKey)}

          {/* 글자 작용 자세히(접이식 — 근거·글라스박스) */}
          <PressableScale style={styles.detailToggle} onPress={() => setShowDetail((v) => !v)}>
            <Text style={styles.detailToggleTx}>{showDetail ? '▾' : '▸'} {t('compat.detailToggle')}</Text>
          </PressableScale>
          {showDetail && renderCrossDetail()}
        </>
      )}
    </ScrollView>

    {/* 상대 명식 등록 — 정식 등록 폼(이름·시진·출생지) 모달, 저장 시 상대 슬롯 자동 선택 */}
    <Modal visible={otherReg} animationType="slide" onRequestClose={() => setOtherReg(false)}>
      <View style={styles.modalRoot}>
        <View style={[styles.modalHeader, { paddingTop: insets.top + space(3) }]}>
          <Text style={styles.modalTitle}>{t('compat.registerOtherTitle')}</Text>
          <PressableScale onPress={() => setOtherReg(false)} hitSlop={10}><Text style={styles.modalClose}>✕</Text></PressableScale>
        </View>
        <ChartRegisterScreen defaultRelation="지인" submitLabel={t('compat.registerOtherSubmit')} showMakeRep={false} onSubmit={onRegisterOther} />
      </View>
    </Modal>
    {/* 명식 선택 드롭다운(내/상대 공용) — 버블 대신 세로 리스트 스크롤 선택(daniel) */}
    <Modal visible={!!pickFor} transparent animationType="fade" onRequestClose={() => setPickFor(null)}>
      <Pressable style={styles.pickBackdrop} onPress={() => setPickFor(null)}>
        <Pressable style={[styles.pickSheet, { paddingBottom: insets.bottom + space(4) }]} onPress={() => {}}>
          <Text style={styles.pickHead}>{pickFor === 'me' ? t('compat.mySlot') : t('compat.otherSlot')}</Text>
          <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
            {saved.filter((s) => pickFor === 'other' ? s.id !== meSel?.id : true).map((s) => {
              const on = pickFor === 'me' ? meSel?.id === s.id : otherSel?.id === s.id;
              return (
                <PressableScale key={s.id} style={[styles.pickRow, on && styles.pickRowOn]} onPress={() => { if (pickFor === 'me') setMeSel(s); else setOtherSel(s); setPickFor(null); }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.pickRowTx, on && styles.pickRowTxOn]} numberOfLines={1}>{s.label}</Text>
                    {/* 날짜+시간 노출(daniel: 시간도) */}
                    <Text style={{ color: colors.inkFaint, fontSize: fs(11), marginTop: 1 }} numberOfLines={1}>{String(s.input.birthDateTime ?? '').replace('T', ' ').slice(0, 16)}</Text>
                  </View>
                  {/* 카테고리(관계)를 우측에(daniel: 카테고리도 오른쪽에) */}
                  <Text style={{ color: colors.inkFaint, fontSize: fs(11), marginHorizontal: space(1.5) }} numberOfLines={1}>{s.relation === 'self' ? t('register.selfLabel') : s.relation}</Text>
                  {on ? <Text style={styles.pickCheck}>✓</Text> : null}
                </PressableScale>
              );
            })}
          </ScrollView>
          {pickFor === 'other' && (
            <PressableScale style={[styles.regOtherBtn, { marginTop: space(3) }]} onPress={() => { setPickFor(null); setOtherReg(true); }}>
              <Text style={styles.regOtherTx}>＋ {t('compat.registerOther')}</Text>
            </PressableScale>
          )}
        </Pressable>
      </Pressable>
    </Modal>

    {/* K(daniel): 년도 선택 드롭다운 — 전체 년도 스크롤 리스트 */}
    <Modal visible={yearOpen} transparent animationType="fade" onRequestClose={() => setYearOpen(false)}>
      <Pressable style={styles.pickBackdrop} onPress={() => setYearOpen(false)}>
        <Pressable style={[styles.pickSheet, { paddingBottom: insets.bottom + space(4) }]} onPress={() => {}}>
          <Text style={styles.pickHead}>{t('compat.yearPick', '년도 선택')}</Text>
          <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator>
            <PressableScale style={[styles.pickRow, !year && styles.pickRowOn]} onPress={() => { setYear(''); setYearOpen(false); }}>
              <Text style={[styles.pickRowTx, !year && styles.pickRowTxOn]}>{t('compat.yearAll')}</Text>
              {!year ? <Text style={styles.pickCheck}>✓</Text> : null}
            </PressableScale>
            {YEARS.map((y) => { const ys = String(y); const on = year === ys; return (
              <PressableScale key={ys} style={[styles.pickRow, on && styles.pickRowOn]} onPress={() => { setYear(ys); setYearOpen(false); }}>
                <Text style={[styles.pickRowTx, on && styles.pickRowTxOn]}>{ys}년</Text>
                {on ? <Text style={styles.pickCheck}>✓</Text> : null}
              </PressableScale>
            ); })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
    </>
  );

  // 추가질문 전송 — 서버가 무료한도/크레딧/프리미엄 판정(사주·자미와 동일). 키=관계유형/연도.
  async function submitFollowup() {
    if (!cur || !ctx || !askInput.trim() || asking) return;
    Keyboard.dismiss();
    const q = askInput.trim();
    setAsking(true);
    const res = await askFollowup(ctx.chartId, curKey, 'compat', q);
    setAsking(false);
    if (res.kind === 'answer') {
      setFollowups((prev) => ({ ...prev, [curKey]: [...(prev[curKey] ?? []), { question: q, answer: res.answer }] }));
      setAskInput('');
    } else if (res.kind === 'needPremium') {
      Alert.alert(t('reading.askPremiumTitle'), t('reading.askPremiumMsg'));
    } else if (res.kind === 'needPayment') {
      Alert.alert(t('reading.askPayTitle'), t('reading.askPayMsg', { price: formatKrw(creditPrice('followup')) }), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('reading.askPayBtn', { price: formatKrw(creditPrice('followup')) }), onPress: async () => {
          try { const ok = await purchaseCreditRC('followup'); if (!ok) return; const { granted } = await waitForCreditGrant('followup'); if (granted) await submitFollowup(); else Alert.alert(t('reading.askPayTitle'), t('reading.applyPending', '결제가 완료됐어요. 적용까지 잠시 걸릴 수 있어요. 잠시 후 다시 시도해 주세요.')); } // ★C1: 결제→웹훅 적립 폴링→서버 consume(followup)
          catch (e) { Alert.alert(t('reading.payPending'), (e as Error).message); }
        } },
      ]);
    } else { Alert.alert(t('common.error'), res.message); }
  }

  // 추가질문(Q&A) 영역 — 통변 카드 하단. 프리미엄=무료1회+건당 / 비프리미엄=프리미엄 유도.
  function renderFollowups(key: string) {
    const list = followups[key] ?? [];
    const freeLeft = Math.max(0, 1 - list.length);
    return (
      <View style={styles.askWrap}>
        <Text style={styles.askH}>{t('reading.askTitle')}</Text>
        {list.map((f, i) => (
          <View key={i} style={styles.qaItem}>
            <Text style={styles.qaQ}>Q. {f.question}</Text>
            <Text style={styles.qaA}>{f.answer}</Text>
          </View>
        ))}
        {isPremium ? (
          <>
            <Text style={styles.askQuota}>{freeLeft > 0 ? t('reading.askFree', { n: freeLeft }) : t('reading.askPaid', { price: formatKrw(creditPrice('followup')) })}</Text>
            <View style={styles.askRow}>
              {/* singleline — 50자 제한이라 한 줄로 충분, iOS/Android 모두 텍스트가 칸 세로중앙 자동정렬(daniel: y축 한가운데) */}
              <TextInput style={styles.askInput} value={askInput} onChangeText={setAskInput} placeholder={t('reading.askPh')} placeholderTextColor={colors.inkFaint} maxLength={50} editable={!asking} returnKeyType="send" onSubmitEditing={() => submitFollowup()} />
              <Text style={styles.askLen}>{askInput.length}/50</Text>
              <PressableScale style={[styles.askSend, (!askInput.trim() || asking) && styles.askSendOff]} onPress={() => submitFollowup()} disabled={!askInput.trim() || asking}>
                {asking ? <ActivityIndicator color={colors.bg} size="small" /> : <Text style={styles.askSendTx}>{t('reading.askSend')}</Text>}
              </PressableScale>
            </View>
          </>
        ) : (
          <PressableScale style={styles.askLock} onPress={() => Alert.alert(t('reading.askPremiumTitle'), t('reading.askPremiumMsg'))}>
            <Text style={styles.askLockTx}>🔒 {t('reading.askPremiumCta')}</Text>
          </PressableScale>
        )}
      </View>
    );
  }

  // ── 글자 작용 비교(나↔상대) — 기존 미니명식 + 합충 그룹(근거·탭 강조) ──
  function renderCrossDetail() {
    if (!pair) return null;
    const POSK = ['시', '일', '월', '년'] as const;
    const personPillars = (saju: any, who: string) => {
      const out: any[] = POSK.map((p) => ({ pos: `${who}${p}`, who, label: p, stem: saju.pillars[p].stem, branch: saju.pillars[p].branch }));
      if (saju.currentLuck) out.push({ pos: `${who}대운`, who, label: '대운', stem: saju.currentLuck.stem, branch: saju.currentLuck.branch });
      if (saju.annual) out.push({ pos: `${who}세운`, who, label: '세운', stem: saju.annual.stem, branch: saju.annual.branch });
      return out;
    };
    const mineP = personPillars(pair.me, '나'), othersP = personPillars(pair.other, '상대');
    const all = [...mineP, ...othersP];
    const cross = detectInteractionsAmong(all.map((x) => ({ pos: x.pos as any, stem: x.stem, branch: x.branch })))
      .filter((it) => String(it.members[0]).startsWith('나') !== String(it.members[1]).startsWith('나'));
    const findP = (pos: string) => all.find((x) => x.pos === pos);
    const typeColor = (ty: string) => (ty === '합' ? colors.ju : (ty === '충' || ty === '극') ? '#C0392B' : '#9A8CC0');
    const rowKey = (it: any) => `${it.type}:${it.level}:${it.members[0]}:${it.members[1]}`;
    const hlCells = new Set<string>();
    cross.forEach((it) => { if (!active.has(rowKey(it))) return; const side = it.level === '천간' ? 'stem' : 'branch'; hlCells.add(`${it.members[0]}|${side}`); hlCells.add(`${it.members[1]}|${side}`); });
    const miniChart = (pillars: any[], title: string) => (
      <View>
        <Text style={styles.cmTitle}>{title}</Text>
        <View style={styles.cmRow}>
          {pillars.map((x, i) => {
            const stemOn = hlCells.has(`${x.pos}|stem`), branchOn = hlCells.has(`${x.pos}|branch`);
            return (
              <View key={i} style={[styles.cmCol, (x.label === '대운' || x.label === '세운') && styles.cmColLuck]}>
                <Text style={styles.cmLabel}>{x.label}</Text>
                <View style={[styles.cmCell, { backgroundColor: elementColor[stemElement(x.stem)] }, stemOn && styles.cmCellHL]}><Text style={[styles.cmTx, { color: elementText[stemElement(x.stem)] }]}>{x.stem}</Text></View>
                <View style={[styles.cmCell, { backgroundColor: elementColor[branchElement(x.branch)] }, branchOn && styles.cmCellHL]}><Text style={[styles.cmTx, { color: elementText[branchElement(x.branch)] }]}>{x.branch}</Text></View>
              </View>
            );
          })}
        </View>
      </View>
    );
    return (
      <View style={styles.crossWrap}>
        {/* 가로 ScrollView 제거 — 6칸이 화면에 들어가므로 전체 폭에 고르게 분배(나↔상대 세로 정렬) */}
        <View style={{ marginBottom: space(2) }}>{miniChart(mineP, '나')}</View>
        <View>{miniChart(othersP, '상대')}</View>
        {cross.length > 0 && <Text style={styles.cmHint}>작용을 탭하면 위 두 명식에서 해당 글자가 강조됩니다.</Text>}
        <View style={styles.crossList}>
          {cross.length === 0 ? <Text style={styles.note}>두 명식 간 직접 합충형해가 없습니다.</Text> :
            ['합', '충', '형', '해', '파', '극'].map((ty) => {
              const grp = cross.filter((it) => it.type === ty);
              if (!grp.length) return null;
              const col = typeColor(ty);
              return (
                <View key={ty} style={{ marginBottom: space(2) }}>
                  <Text style={[styles.cmGroupHead, { color: col }]}>● {ty} {grp.length}</Text>
                  {grp.map((it, i) => {
                    const isGan = it.level === '천간';
                    const pa = findP(String(it.members[0])), pb = findP(String(it.members[1]));
                    if (!pa || !pb) return null;
                    const ca = isGan ? pa.stem : pa.branch, cb = isGan ? pb.stem : pb.branch;
                    const key = rowKey(it), on = active.has(key);
                    return (
                      <PressableScale key={i} onPress={() => toggleActive(key)} style={[styles.cmLinkRow, on && { borderLeftColor: col, backgroundColor: colors.sunk }]}>
                        <Text style={styles.cmLink}>{on ? '◉ ' : '○ '}{pa.who}·{pa.label} <Text style={{ color: elementColor[isGan ? stemElement(ca) : branchElement(ca)], fontWeight: '800' }}>{ca}</Text>{'  ⟷  '}{pb.who}·{pb.label} <Text style={{ color: elementColor[isGan ? stemElement(cb) : branchElement(cb)], fontWeight: '800' }}>{cb}</Text>{'   '}<Text style={{ color: col, fontWeight: '800' }}>{it.type}{it.transformsTo ? ` ${it.transformsTo}` : ''}</Text></Text>
                      </PressableScale>
                    );
                  })}
                </View>
              );
            })}
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  screen: { backgroundColor: 'transparent' }, // 전역 배경 투과(ContentBackdrop)
  wrap: { padding: space(5), paddingBottom: space(12) },
  // 궁합 점수 카드(daniel: 메인 콘텐츠 — 점수+등급 이미지)
  scoreCard: { alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.ju, padding: space(5), marginTop: space(4), marginBottom: space(2), ...shadow.card },
  scoreImg: { width: '100%', height: 190, borderRadius: radius.md, marginBottom: space(3) },
  scoreEmoji: { fontSize: 60, marginBottom: space(2) },
  scoreTier: { fontSize: 19, fontWeight: '900', color: colors.ju, marginBottom: space(1) },
  scoreNum: { fontSize: 40, fontWeight: '900', color: colors.ink },
  scoreUnit: { fontSize: 16, fontWeight: '700', color: colors.inkFaint },
  scoreBar: { width: '80%', height: 8, borderRadius: 4, backgroundColor: colors.line, marginTop: space(3), overflow: 'hidden' },
  scoreBarFill: { height: '100%', borderRadius: 4, backgroundColor: colors.ju },
  scoreSub: { ...font.caption, color: colors.inkSoft, marginTop: space(2) },
  // 궁합 6기준 근거 칩(daniel 07-18)
  scoreSignals: { flexDirection: 'row', flexWrap: 'wrap', gap: space(1.5), marginTop: space(2.5), justifyContent: 'center' },
  sigChip: { ...font.caption, color: colors.ju, backgroundColor: colors.juSoft, paddingHorizontal: space(2.5), paddingVertical: space(1), borderRadius: radius.pill, overflow: 'hidden', fontWeight: '700' },
  sigWarn: { color: colors.inkSoft, backgroundColor: colors.sunk },
  catBanner: { width: '100%', height: 190, alignSelf: 'center', borderRadius: radius.md, marginTop: space(3), marginBottom: space(5) },  // 이미지↔컨텐츠 간격 넓힘(daniel: 너무 가까움)
  slotLabel: { ...font.caption, color: colors.ju, fontWeight: '800', marginBottom: space(2), letterSpacing: 0.3 },
  // 내 명식 골드 슬롯
  meSlot: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.ju, borderRadius: radius.md, padding: space(4), ...shadow.card },
  meSlotName: { fontSize: 16, fontWeight: '800', color: colors.ink },
  meSlotSub: { ...font.caption, color: colors.inkSoft, marginTop: 2 },
  meSlotChange: { color: colors.ju, fontSize: 13, fontWeight: '700' },
  chipRow: { gap: space(2), paddingVertical: space(2) },
  chip: { paddingVertical: space(2), paddingHorizontal: space(4), borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  chipOn: { backgroundColor: colors.ju, borderColor: colors.ju },
  chipTx: { ...font.body, color: colors.ink, fontWeight: '700' },
  chipTxOn: { color: colors.bg },
  pickBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }, // 드롭다운 배경(탭하면 닫힘)
  pickSheet: { backgroundColor: colors.card, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, paddingHorizontal: space(5), paddingTop: space(4) },
  pickHead: { fontSize: 16, fontWeight: '900', color: colors.ju, marginBottom: space(3) },
  pickRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: space(3.5), paddingHorizontal: space(4), borderRadius: radius.md, marginBottom: space(2), backgroundColor: colors.sunk },
  pickRowOn: { backgroundColor: colors.ju + '22', borderWidth: 1, borderColor: colors.ju },
  pickRowTx: { fontSize: 15, fontWeight: '700', color: colors.ink, flex: 1 },
  pickRowTxOn: { color: colors.ju },
  pickCheck: { color: colors.ju, fontSize: 16, fontWeight: '900', marginLeft: space(2) },
  orHint: { ...font.caption, color: colors.inkSoft, marginTop: space(2), marginBottom: space(1) },
  placeField: { marginTop: space(2) },
  input: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, padding: space(3), fontSize: 15, color: colors.ink, marginTop: space(2), ...shadow.soft },
  inputDim: { opacity: 0.4 },
  btn: { backgroundColor: colors.ju, borderRadius: radius.md, padding: space(3.5), alignItems: 'center', marginTop: space(4), ...shadow.card },
  btnOff: { opacity: 0.5 },
  btnText: { color: colors.white, fontSize: 15, fontWeight: '700' },
  // 상대 명식 등록 버튼(점선) + 등록 폼 모달
  regOtherBtn: { marginTop: space(3), padding: space(3.5), borderRadius: radius.md, borderWidth: 1, borderColor: colors.ju, borderStyle: 'dashed', alignItems: 'center', backgroundColor: colors.card },
  regOtherTx: { color: colors.ju, fontSize: 15, fontWeight: '800' },
  modalRoot: { flex: 1, backgroundColor: colors.bg },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space(5), paddingTop: space(6), paddingBottom: space(3), borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  modalTitle: { fontSize: 18, fontWeight: '800', color: colors.ink },
  modalClose: { fontSize: 22, color: colors.inkSoft, fontWeight: '700' },
  // 관계 유형
  relChips: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2), marginBottom: space(3) },  // marginTop 제거 — ② 라벨 밑 여백을 ③과 동일하게(daniel)
  // 연도별 칩(전체/그 해)
  yearChips: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2), marginBottom: space(3) },
  yearChip: { paddingHorizontal: space(3), paddingVertical: space(1.5), borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  yearChipOn: { backgroundColor: colors.juSoft, borderColor: colors.ju },
  yearChipTx: { fontSize: 12, fontWeight: '700', color: colors.inkSoft },
  yearChipTxOn: { color: colors.ju },
  relChip: { paddingHorizontal: space(3.5), paddingVertical: space(2), borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  // 사주/자미 궁합 2탭(daniel)
  compatTabBar: { flexDirection: 'row', backgroundColor: colors.sunk, borderRadius: radius.md, padding: 3, marginBottom: space(3) },
  compatTab: { flex: 1, paddingVertical: space(2.5), alignItems: 'center', borderRadius: radius.sm },
  compatTabOn: { backgroundColor: colors.ju },
  compatTabTx: { color: colors.inkFaint, fontWeight: '700', fontSize: 13 },
  compatTabTxOn: { color: colors.bg },
  // 위저드 — 나❤상대 헤더 + 단계 라벨(daniel 궁합 재디자인)
  wizPair: { flexDirection: 'row', alignItems: 'center', gap: space(2), marginBottom: space(4) },
  wizPerson: { flex: 1, backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, paddingVertical: space(3), paddingHorizontal: space(2), alignItems: 'center' },
  wizPersonEmpty: { borderStyle: 'dashed', borderColor: colors.ju },
  wizRole: { color: colors.inkFaint, fontSize: 11, fontWeight: '700', marginBottom: 2 },
  wizName: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  wizNameEmpty: { color: colors.ju },
  wizHeart: { color: colors.ju, fontSize: 18 },
  wizStep: { marginBottom: space(4) },
  stepLabel: { color: colors.ju, fontSize: 14, fontWeight: '800', marginBottom: space(2.5) },
  wizSelectBtn: { backgroundColor: colors.ju, borderRadius: radius.md, paddingVertical: space(4), alignItems: 'center' },
  wizSelectBtnTx: { color: colors.bg, fontSize: 15, fontWeight: '800' },
  relChipOn: { backgroundColor: colors.ju, borderColor: colors.ju },
  relChipTx: { fontSize: 13, fontWeight: '700', color: colors.inkSoft },
  relChipTxOn: { color: colors.bg },
  readCard: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.juLine, padding: space(5), ...shadow.card, alignItems: 'stretch' },
  coreTx: { fontSize: 16, fontWeight: '800', color: colors.ju, lineHeight: 24, marginBottom: space(3) },
  sec: { marginTop: space(4) },
  secLabel: { fontSize: 15, fontWeight: '800', color: colors.ju, marginBottom: space(2) },
  secBody: { ...font.body, color: colors.ink, fontSize: 15, lineHeight: 25 },
  remedySec: { marginTop: space(5), paddingTop: space(4), borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  busyTx: { ...font.caption, color: colors.inkSoft, marginTop: space(2), textAlign: 'center' },
  note: { ...font.caption, marginTop: space(3) },
  detailToggle: { marginTop: space(5), paddingVertical: space(2) },
  // 추가질문(Q&A) — ReadingScreen 과 동일 스타일
  askWrap: { marginTop: space(7), paddingTop: space(5), borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  askH: { fontSize: 17, fontWeight: '800', color: colors.ink, marginBottom: space(3) },
  qaItem: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.juLine, padding: space(4), marginBottom: space(3) },
  qaQ: { ...font.body, fontWeight: '800', color: colors.ju, marginBottom: space(2) },
  qaA: { ...font.body, color: colors.ink, lineHeight: 24 },
  askQuota: { ...font.caption, color: colors.inkFaint, marginBottom: space(2) },
  askRow: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  // 좌상단 정렬(daniel: 가운데 X — 위·왼쪽으로)
  askInput: { ...font.body, flex: 1, height: 44, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: space(3), color: colors.ink, textAlign: 'left' },
  askLen: { fontSize: 11, color: colors.inkFaint },
  askSend: { backgroundColor: colors.ju, borderRadius: radius.md, paddingHorizontal: space(4), height: 44, alignItems: 'center', justifyContent: 'center' },
  askSendOff: { opacity: 0.4 },
  askSendTx: { color: colors.bg, fontWeight: '800', fontSize: 14 },
  askLock: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.ju, borderRadius: radius.md, paddingVertical: space(4), alignItems: 'center' },
  askLockTx: { color: colors.ju, fontWeight: '700', fontSize: 14 },
  detailToggleTx: { ...font.body, color: colors.inkSoft, fontWeight: '700' },
  // 글자 작용 비교
  crossWrap: { marginTop: space(2) },
  cmTitle: { ...font.caption, color: colors.ju, fontWeight: '700', marginBottom: space(1) },
  // 전체 폭에 칸을 고르게 분배(space-between) + 양끝 패딩 → 나/상대 칸이 화면 양끝에 맞춰 정렬
  cmRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: space(1) },
  cmCol: { alignItems: 'center', width: 38 },
  cmColLuck: { backgroundColor: colors.juSoft, borderRadius: radius.sm },
  cmLabel: { fontSize: 9, color: colors.inkFaint, marginBottom: 2 },
  cmCell: { width: 30, height: 30, borderRadius: 5, alignItems: 'center', justifyContent: 'center', marginVertical: 1 },
  // 강조 테두리 = 밝은 청록(오행 5색에 없는 색) — 土(골드 #C9A14A)·金 배경에서도 또렷이 보이게(daniel)
  cmCellHL: { borderWidth: 3, borderColor: '#19E3E3' },
  cmTx: { fontSize: 17, fontWeight: '800' },
  cmHint: { ...font.caption, color: colors.inkFaint, marginTop: space(1), marginBottom: space(1) },
  crossList: { marginTop: space(2), padding: space(3), borderRadius: radius.sm, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  cmGroupHead: { ...font.caption, fontWeight: '800', marginBottom: space(1) },
  cmLinkRow: { borderLeftWidth: 3, borderLeftColor: 'transparent', borderRadius: radius.sm, paddingLeft: space(2) },
  cmLink: { ...font.body, color: colors.ink, paddingVertical: space(1) },
});
