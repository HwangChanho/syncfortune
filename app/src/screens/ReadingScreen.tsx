// app/src/screens/ReadingScreen.tsx — 전 항목 일괄 풀이 (사주 16영역 / 자미두수 12궁 공용)
// ─────────────────────────────────────────────────────────────────────────
// 한 명식의 여러 항목(사주=영역, 자미두수=궁)을 한 번에 통변해 카드로 표시.
//   categories prop 으로 항목 집합·라벨·종류(kind)를 주입 → 사주/자미 공용(DRY). 기본=사주 16영역.
// 캐시(ADR-052): 명식↔서버 charts.id 매핑(savedChart.serverChartId, 온디바이스)으로 chart_id 안정화
//   → 진입 시 readings(chart_id×category)를 select 해 *생성 없이* 즉시 표시. 없는 항목만 생성.
//   사주/자미는 같은 serverChartId 를 공유하고 category 키(영역명 vs 궁명)로 구분 캐시된다.
// 접근: 프리미엄(구독)=게이트 없이 생성 / 비프리미엄=미리보기 + perUse(이용권·건당 결제). 캐시 열람은 무게이트.
//   ★daniel(2026-07): 유료(비용발생) 통변은 보상형 광고로 무료 생성하지 않는다 — 결제/프리미엄만(광고 무료 경로 제거).
//   ⚠️ '1회 트리거=전 항목 1세트' 게이트. 세트 단가 정책은 daniel 검수.
//   ⚠️ Edge invoke=프로덕션(개발 미배포=호출 실패=비용0·절대0). charts insert/readings select 는 직접 호출이라 개발에서도 동작.
// ─────────────────────────────────────────────────────────────────────────
import { useState, useMemo, useEffect, useRef, type ReactNode } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator, Modal, TextInput, Keyboard, KeyboardAvoidingView, Platform } from 'react-native';
import { PressableScale } from '../components/PressableScale';
import { ExpiryNote } from '../components/ExpiryNote'; // 보유 만료일 공통(프리미엄 가드 한 곳)
import { TTSButton } from '../components/TTSButton'; // daniel: 풀이 음성 읽기(온디바이스 TTS·무료)
import { ShareReadingButton } from '../components/ShareReadingButton'; // daniel: 공유는 풀이 맨 끝에 균일하게(콘텐츠 화면과 동일)
import { Alert } from '../lib/ui/alert'; // 커스텀 알림(앱 디자인)
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { computeChart } from '../lib/engine/engine';
import { useAuth } from '../lib/useAuth';
import { supabase } from '../lib/supabase';
// 완료 푸시는 genProgress(setGenProgress 완료 전이)에서 중앙 처리(daniel ⑨ — 모든 풀이 공통)
import { setGenProgress, useGenProgress, clearGenProgress } from '../lib/backend/genProgress'; // 홈 진행률 + 완료 구독 + 진입 시 배너 제거(daniel: 완성 배너 안 사라짐)
import { isReadingUnlocked } from '../lib/billing/unlocks'; // 서버 권위 세트 언락(P3) — 이미 열렸으면 무료 재생성
import { isPremiumForChart } from '../lib/billing/premiumStore'; // 명식별 프리미엄 판정(#1 — 비지정 명식/무료모드 페이월)
import { computeEntitled, computeLocked, showUnlockOverlay, computeShouldAutoGen } from '../lib/billing/readingGate'; // 게이트 순수로직(하네스 시나리오 테스트 대상)
import { useSubscription } from '../lib/billing/subscription';
import { runContentRenewal } from '../lib/billing/renewal'; // 운세형 1년 경과 → 재통변 할인 구매 후 재생성(daniel 07-08 통일모델)
import { needsContentRenewal } from '../lib/billing/repurchase'; // 운세형 1년 경과 판정(재통변 버튼 노출)
import { setServerChartId, getRepresentativeId, type SavedChart } from '../lib/engine/myChart';
import { loadFollowups, askFollowup, type Followup } from '../lib/backend/followups';
import { useFontScale } from '../lib/ui/fontScale';
import { appLang } from '../lib/i18n'; // 통변 출력 언어(앱 언어)
import { readingFromInvoke } from '../lib/backend/interpretResult'; // 방어: Edge 응답 정규화(일시적 불가·결제필요·오류)
import { acquireGen, releaseGen } from '../lib/backend/genLock'; // 생성 중복 잠금(크로스마운트 공유·150초 stale-timeout) — daniel 07-16: 자체 Set 폐기, 다른 유료 화면과 통일(락 누수로 사주·자미 먹통 방지)
import { PALACE_DESC } from '../lib/content/palaceDesc'; // 자미두수 궁 설명(궁 옆 표시)
import { shareReading } from '../lib/ui/share'; // 이슈17: 풀이 결과 공유(앱 설치자만 열람)
import { loadCredits, waitForCreditGrant, creditPrice, formatKrw } from '../lib/billing/coupons'; // 크레딧 보유확인(UX) + 결제 후 웹훅 반영 폴링 + 실가 주입(하드코딩 가격 근절·daniel 2026-07-12)
import { confirmReadingChart, autoGenWithChartConfirm } from '../lib/ui/confirmChart'; // 생성 전 명식 확인(수동=항상 / 자동=명식 2개+ 일 때, daniel 07-13)
import { purchaseCreditRC } from '../lib/billing/purchases'; // 추가질문 건당 결제 = credit_followup(서버 consume)
import { requireLoginForPurchase } from '../lib/billing/requireLogin'; // 결제/저장 전 로그인 안내
import { assertOnline, isOnline } from '../lib/backend/network'; // 오프라인 시 신규 생성 차단
import { colors, radius, space, shadow, font } from '../lib/theme';
import type { ChartInput, CategoryKey } from '@spec/chart';

// 풀이 항목 = { key(=캐시 category·Edge 요청 키), label(표시명), desc(부가 설명 — 자미두수 궁이 뭘 보는지) }
export type ReadingCategory = { key: string; label: string; desc?: string };

// opus 응답 정규화: ```json 코드펜스로 감싸졌거나(가드 폴백) base 등이 객체일 때 안전 처리.
function normalizeReading(r: any): any {
  if (!r || typeof r !== 'object' || r.error) return r;
  if (typeof r.base === 'string' && r.base.includes('```')) {
    const m = r.base.match(/```(?:json)?\s*([\s\S]*?)```/);
    const raw = (m ? m[1] : r.base.replace(/```json?|```/g, '')).trim();
    try { return JSON.parse(raw); } catch { /* 파싱 실패 시 원본 유지 */ }
  }
  return r;
}
// 값이 객체/배열이어도 문자열로 평탄화(중첩 {summary,detail…} → 합침)
function asText(v: any): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return v.map(asText).filter(Boolean).join(' · ');
  if (typeof v === 'object') return Object.values(v).map(asText).filter(Boolean).join('\n');
  return String(v);
}

// 사주 16영역 = lib/prewarmReadings 와 단일 출처 공유(프리워밍·화면이 같은 캐시 키를 쓴다).
import { SAJU_READING_CATEGORIES as SAJU_CATEGORIES, ensureServerChartId } from '../lib/backend/prewarmReadings';
import { UnlockOverlay } from '../components/UnlockOverlay'; // 풀이 생성 중 화면 가림 로딩(daniel)
import { DoorReveal } from '../components/DoorReveal'; // 풀이 진입 골드 명조 문 열림 영상(daniel 07-06)

// ADR-055 P3: opt-in 갱신 — 통변 분석(L2) 버전. Edge interpret 의 L2_VER 과 동기화(메이저 통변 개선 시 양쪽 +1).
//   저장된 풀이의 l2_ver 가 이 값보다 낮으면(=옛 분석) '최신 해석으로 갱신' 노출. 레거시(l2_ver 0·분리 전)는 미노출.
const READING_L2_VER = 1;

// ★풀이 생성 중복 잠금 — 키 `${kind}:${chartId}`. runAll 루프는 언마운트돼도 지속되므로,
//   백그라운드 생성 중에 홈 로딩바를 타고 재진입하면 두 번째 마운트가 또 1/12 부터 생성하던 문제(daniel) 방지.
//   이미 같은 차트·종류가 생성 중이면 두 번째는 생성하지 않고(자물쇠도 안 띄움) 캐시만 보여준다.
// ★daniel 07-16: 자체 `Set<string>`(타임스탬프 없음) 대신 genLock(다른 유료 화면과 공유 모듈)으로 통일 —
//   Edge interpret invoke 가 hang 하면 자체 Set 은 release 가 영영 안 돌아 락이 세션 내내 누수 → 이후
//   "생성"을 눌러도 조용히 return(사주·자미 먹통, 앱 완전 종료로만 풀림). genLock 의 150초 stale-timeout 이
//   이 누수를 회수한다(genLock.ts 헤더 참고).

// 풀이 영역/궁 → 카테고리 그룹(아코디언). 사주 16영역 4그룹 · 자미 12궁(daniel b안: 명궁·복덕=나/재백·전택=돈/부처·자녀·형제·노복=관계/관록·천이·질액·부모=일·건강).
const SAJU_GROUPS: { label: string; keys: string[] }[] = [
  { label: '나', keys: ['성격내면', '건강'] },
  { label: '일·돈', keys: ['취업운', '직장운', '사업운', '금전소득운', '투자편재운', '재물손재'] },
  { label: '관계', keys: ['연애운', '결혼배우자운', '대인사회성', '부모운', '형제운', '자식운'] },
  { label: '성장', keys: ['학업자기계발', '이동환경'] },
];
const ZIWEI_GROUPS: { label: string; keys: string[] }[] = [
  { label: '나', keys: ['명궁', '복덕궁'] },
  { label: '돈', keys: ['재백궁', '전택궁'] },
  { label: '관계', keys: ['부처궁', '자녀궁', '형제궁', '노복궁'] },
  { label: '일·건강', keys: ['관록궁', '천이궁', '질액궁', '부모궁'] },
];

export function ReadingScreen({
  input, savedChart, categories, kind = 'saju', header,
}: {
  input: ChartInput | null;
  savedChart?: SavedChart | null;
  categories?: ReadingCategory[];        // 미지정 = 사주 16영역(t 라벨)
  kind?: string;                         // 'saju' | 'ziwei' — Edge 프롬프트 분기 키
  titleKey?: string;
  subKey?: string;
  header?: ReactNode;                    // 상단 명식 헤더(ChartPicker). 전환 시 부모가 key로 리마운트 → 게이트 재평가
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const { session } = useAuth();
  const { isPremium } = useSubscription();
  const { fs } = useFontScale(); // 통변 본문 글자 크기(설정에서 조절)
  const [readings, setReadings] = useState<Record<string, any>>({});
  const [readingsChartId, setReadingsChartId] = useState<string | null>(null); // 지금 readings가 *어느 chartId 기준*으로 로드됐나 — 자동생성 가드(stale 로드로 재생성 방지, daniel 07-02)
  const [progress, setProgress] = useState<{ done: number; total: number; current?: string } | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const genDone = useGenProgress().reduce((s, g) => s + g.done, 0); // 풀이 완료 누적 — 변할 때마다 캐시 재조회(G: 백그라운드 생성분을 이 화면에 라이브 반영, 무한로딩/씽크 어긋남 제거)
  const [chartId, setChartId] = useState<string | null>(savedChart?.serverChartId ?? null);
  const [detail, setDetail] = useState<string | null>(null); // 상세로 펼친 항목 key
  const [stale, setStale] = useState<Set<string>>(new Set()); // ADR-055 P3: 분석 버전이 낮아 갱신 가능한 영역(opt-in)
  const [renewable, setRenewable] = useState<Set<string>>(new Set()); // ★재통변(daniel 07-08): 운세형 & 생성 1년 경과 영역
  const [expiry, setExpiry] = useState<string | null>(null); // 풀이 보유 만료일(가장 먼저 만료=최초 생성+1년) — 소모성 제외 모든 풀이 1년(daniel #25)
  // 추가 질문(Q&A) — 영역별 누적 + 입력/전송 상태(프리미엄 2회 무료 + 건당)
  const [followups, setFollowups] = useState<Record<string, Followup[]>>({});
  const [askInput, setAskInput] = useState('');
  const [asking, setAsking] = useState(false);
  const [cacheLoaded, setCacheLoaded] = useState(false);  // 캐시 로드 완료(자동 생성 판단 기준)
  const autoRan = useRef(false);                          // 프리미엄 진입 시 자동 생성 1회 가드
  const previewRan = useRef(false);                       // 미리보기(첫 분야 맛보기) 1회 가드 — 무료 진입용
  const startingRef = useRef(false);                      // onStart(생성 시작) 연타 가드(동기 ref) — 이중 결제·중복 API 호출 차단(daniel). runAll의 genLock(모듈락) 앞단에서 동기 차단.
  // ★풀이 진입 문 열림(daniel 07-06): 풀이가 준비돼 보이는 순간(캐시/생성완료·생성중 아님) 골드 명조 문 1회 연출. 명식 전환=부모 key 리마운트라 매 진입 재생.
  const [doorPlaying, setDoorPlaying] = useState(false);
  const doorShown = useRef(false);
  useEffect(() => {
    if (Object.keys(readings).length > 0 && !progress && !doorShown.current) { doorShown.current = true; setDoorPlaying(true); }
  }, [readings, progress]);
  // 대표 명식 여부 — 프리미엄 '자동 생성'은 대표 명식에만(비용통제 daniel: 명식 100개 자동 생성 방지).
  //   대표가 아니면 프리미엄이라도 수동 '생성' 버튼으로(의도된 1회 소비). 캐시는 그대로 표시.
  const [isRep, setIsRep] = useState(false);
  const [unlocked, setUnlocked] = useState(false); // 이 명식 세트 결제 언락 여부(#1 — 프리미엄 아니어도 결제자면 표시 유지)
  const [unlockedLoaded, setUnlockedLoaded] = useState(false); // 언락 조회 완료 — 이 전엔 잠금 판정 보류(로드 race 자물쇠 깜빡임 방지, daniel 07-01)
  const [expandedG, setExpandedG] = useState<Record<string, boolean>>({}); // 아코디언 펼침(그룹 라벨→bool, 기본 펼침)
  useEffect(() => {
    let alive = true;
    getRepresentativeId().then((rid) => { if (alive) setIsRep(!!savedChart && !!rid && rid === savedChart.id); }).catch(() => {});
    return () => { alive = false; };
  }, [savedChart]);
  const c = useMemo(() => (input ? computeChart(input) : null), [input]);
  // 항목 집합: 주입된 categories 우선, 없으면 사주 16영역(i18n 라벨)
  const cats = useMemo<ReadingCategory[]>(() => {
    if (categories) return categories;
    // 자미두수: 명반 12궁을 항목으로(궁명 = 캐시 category·표시 라벨) + 이 궁이 뭘 보는지 설명(daniel).
    if (kind === 'ziwei') return ((c?.ziwei?.palaces as any[]) ?? []).map((p) => ({ key: p.name, label: p.name, desc: PALACE_DESC[p.name] }));
    return SAJU_CATEGORIES.map((k) => ({ key: k, label: t(`category.${k}`) }));
  }, [categories, kind, c, t]);

  // 카테고리 그룹(아코디언) — 생성된 영역만 그룹별로 묶는다(미생성은 생성 버튼이 별도 처리).
  //   매핑에 없는(생성된) 키는 '기타' 그룹으로 모아 누락 방지.
  const groups = useMemo(() => {
    const defs = kind === 'ziwei' ? ZIWEI_GROUPS : SAJU_GROUPS;
    const used = new Set<string>();
    const out = defs.map((g) => {
      const items = cats.filter((cat) => g.keys.includes(cat.key) && readings[cat.key]);
      items.forEach((it) => used.add(it.key));
      return { label: g.label, items };
    }).filter((g) => g.items.length);
    const etc = cats.filter((cat) => readings[cat.key] && !used.has(cat.key));
    if (etc.length) out.push({ label: '기타', items: etc });
    return out;
  }, [cats, kind, readings]);

  // 진입 시: 서버 chart_id 확보 + 저장된 풀이(캐시) 로드 → 생성 없이 즉시 표시.
  //   savedChart 가 있어야 chart_id 안정화(재사용). 없으면(input-param 경로) 캐시 생략 → 버튼 생성.
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!c || !session || !savedChart) { if (alive) setCacheLoaded(true); return; } // 저장명식 없으면 캐시 없음
      const id = await ensureServerChart();
      if (!alive || !id) { if (alive) setCacheLoaded(true); return; }
      setChartId(id);
      isReadingUnlocked(id, kind === 'ziwei' ? 'ziwei' : 'reading').then((u) => { if (alive) { setUnlocked(u); setUnlockedLoaded(true); } }).catch(() => { if (alive) setUnlockedLoaded(true); }); // #1 표시 게이트용 세트 언락 로드(+완료 플래그)
      const { data } = await supabase.from('readings').select('category, content, l2_ver, created_at').eq('chart_id', id).eq('lang', appLang());
      if (!alive) return;
      const keys = new Set(cats.map((x) => x.key));   // 이 화면 항목(사주/자미)만 반영
      const loaded: Record<string, any> = {};
      const st = new Set<string>();                   // ADR-055 P3: 분리본(l2_ver≥1)인데 옛 버전 → 갱신 가능
      const rn = new Set<string>();                   // ★재통변(daniel 07-08): 운세형 & 생성 1년 경과 영역
      const renewCk = kind === 'ziwei' ? 'ziwei' : 'reading'; // 이 화면 credit kind(SET_KIND — saju→reading)
      const nowD = new Date();
      let minCreated: string | null = null; // 보유 만료 = 최초 생성+1년(가장 먼저 만료되는 영역 기준)
      (data ?? []).forEach((r: any) => {
        if (!keys.has(r.category)) return;
        loaded[r.category] = r.content;
        if (r.created_at && (!minCreated || r.created_at < minCreated)) minCreated = r.created_at;
        if ((r.l2_ver ?? 0) >= 1 && (r.l2_ver ?? 0) < READING_L2_VER) st.add(r.category);
        if (needsContentRenewal(renewCk, r.created_at, nowD)) rn.add(r.category); // 운세형 1년 경과 → 재통변 노출
      });
      setReadings(loaded);
      setReadingsChartId(id); // 이 readings는 id(현재 resolved 명식) 기준 — 자동생성 가드가 stale 로드 구분에 사용
      setStale(st);
      setRenewable(rn);
      if (minCreated) { const d = new Date(minCreated); d.setFullYear(d.getFullYear() + 1); setExpiry(`${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`); }
      setCacheLoaded(true);
      loadFollowups(id).then((f) => { if (alive) setFollowups(f); }).catch(() => {}); // 추가 질문 누적 로드
    })().catch(() => { if (alive) setCacheLoaded(true); /* 실패해도 자동 생성 판단은 진행 */ });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, session, savedChart, cats]);

  // G(daniel: 씽크 단일화): 풀이 완료(genDone)마다 캐시 재조회 → 머지(기존 보존). 다른 화면/백그라운드 생성분이
  //   이 화면에 *라이브로* 채워진다 → 들어왔을 때 무한로딩·홈%·푸시가 따로 노는 문제 제거(잠금화면은 실제 데이터로 갱신).
  useEffect(() => {
    if (!chartId) return;
    let alive = true;
    supabase.from('readings').select('category, content').eq('chart_id', chartId).eq('lang', appLang()).then(({ data }) => {
      if (!alive) return;
      const upd: Record<string, any> = {};
      (data ?? []).forEach((r: any) => { if (cats.some((c) => c.key === r.category)) upd[r.category] = r.content; });
      if (Object.keys(upd).length) setReadings((prev) => ({ ...prev, ...upd }));
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [genDone, chartId]);

  // (G 서버위임 gen_jobs realtime 구독은 무한반복 버그로 제거됨 — daniel 2026-06-30. 현재 runAllLocal 직접 생성. 재설계 시 재도입.)

  // ★daniel(2026-06-30): '○○ 풀이가 완성됐어요' 배너를 탭해 진입했는데 안 사라지던 것 —
  //   이 화면 항목이 전부 캐시(완성)이고 생성 진행 중이 아니면 홈 배너를 확실히 제거(진입=이미 봄).
  //   (생성 진행 중이면 progress 로 유지 → 홈 나가도 진행률 표시.) charts stale 로 배너 키가 어긋났어도 차단.
  useEffect(() => {
    if (!savedChart || !cacheLoaded || progress) return;
    if (cats.length && cats.every((cat) => readings[cat.key])) {
      const k = kind === 'ziwei' ? 'ziwei' : 'saju';
      clearGenProgress(`/reading?kind=${k}&chartId=${savedChart.id}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedChart, cacheLoaded, readings, cats, progress, kind]);

  if (!c) return <View style={styles.center}><Text style={font.body}>{t('myeongsik.noChart')}</Text></View>;

  // 서버 charts row 확보 — 단일 구현(lib/prewarmReadings.ensureServerChartId) 공유.
  async function ensureServerChart(): Promise<string | null> {
    if (!c || !session || !savedChart || !input) return null;
    return ensureServerChartId(c, input, session, savedChart);
  }

  // savedChart 없는 폴백(input-param 경로): 캐시 매핑 없이 1회용 charts insert.
  async function insertChart(): Promise<string | null> {
    if (!c || !session) return null;
    // birth 평문 서버 저장 금지(규칙8) — insert_chart_enc RPC 로 서버 암호화. input 없으면 birth 생략(null).
    const { data, error } = await supabase.rpc('insert_chart_enc', {
      p_relation: 'self',
      p_saju: { ...c.saju, timeUnknown: input?.timeAccuracy === '미상' },
      p_ziwei: c.ziwei ?? null,
      p_birth: input ? JSON.stringify(input) : null,
      p_label: null,
    });
    return error || !data ? null : (data as string);
  }

  // 아직 없는 항목만 생성(캐시된 건 skip — 비용 방어). chart_id 는 재사용 우선.
  async function runAll(preId?: string | null) {
    if (!c || !session) return;
    setGlobalError(null);
    // ★자물쇠(chart race) 계보(daniel 07-03): 호출처(doStart)가 canonical id를 넘기면 그대로 신뢰한다(이미 재해석됨).
    //   자동생성(autoGen effect)은 canonical 확정 뒤에만 fire되도록 가드돼 있어 chartId가 곧 canonical이다.
    let id = preId ?? chartId;
    if (!id) {
      id = savedChart ? await ensureServerChart() : await insertChart();
      if (!id) { setGlobalError(t('reading.saveFail')); return; }
      setChartId(id);
    }
    const todo = cats.filter((cat) => !readings[cat.key]);
    if (!todo.length) return;                              // 전부 캐시됨 → 생성 불필요(자물쇠·진행 X, 바로 노출)
    // ★중복 생성 방지(daniel: 로딩바 타고 재진입 시 1/12 재시작) — 같은 차트·종류가 이미 생성 중이면
    //   두 번째는 생성하지 않는다. runAllLocal 이 이어서 남은 영역을 채운다.
    const lockKey = `${kind}:${id}`;
    if (!acquireGen(lockKey)) return;                      // genLock 공유 — stale(150초) 락은 자동 회수(daniel 07-16)
    const gDone = cats.length - todo.length;               // 이미 완료된 영역(홈 진행률 시작값)
    // 홈 배너/푸시 route — ★chartId를 담아야 진입 시 *그 명식*을 로드(안 담으면 대표로 가서 캐시 미스→재생성 버그, daniel G).
    const gpRoute = `/reading?kind=${kind === 'ziwei' ? 'ziwei' : 'saju'}${savedChart ? `&chartId=${savedChart.id}` : ''}`;
    setProgress({ done: gDone, total: cats.length, current: todo[0].label });
    setGenProgress({ active: true, done: gDone, total: cats.length, label: kind === 'ziwei' ? t('reading.ziweiTitle', '자미두수') : t('reading.sajuTitle', '사주 풀이'), chartLabel: savedChart?.label, route: gpRoute }); // 어느 명식 풀이인지 배너·푸시에(daniel 07-02)
    // ★G 서버위임 롤백(daniel 2026-06-30: 무한반복 버그 — gen_jobs done↔autoGen 재호출↔재생성↔푸시 루프).
    //   클라 직접 생성으로 복귀(기존 안정 경로). 완료(todo 없음)면 위에서 이미 return → 자물쇠 안 뜸.
    //   서버측 generate_set 위임(+gen_jobs 구독)은 현재 휴면 — 무한반복 없이 재설계 후 재도입.
    await runAllLocal(id, todo, gDone, gpRoute);
  }

  // 클라가 직접 항목별 interpret 를 호출(현재 유일 경로 — generate_set 서버위임은 휴면). 재도입 시 이 함수는 미배포·오류·1회용 명식 폴백으로 강등.
  async function runAllLocal(id: string, todo: ReadingCategory[], gDone0: number, gpRoute: string) {
    let gDone = gDone0;
    const lockKey = `${kind}:${id}`;
    try {
      for (const cat of todo) {
        setProgress((p) => (p ? { ...p, current: cat.label } : null)); // 지금 풀이 중인 영역
        try {
          // 자미는 운한(대한 비성사화)이 포함된 최신 명반을 body 로 전달(저장본은 구버전일 수 있음 → Edge가 우선 사용).
          const { data, error } = await supabase.functions.invoke('interpret', { body: { chartId: id, category: cat.key, kind, tier: 'paid', lang: appLang(), ...(kind === 'ziwei' ? { ziwei: c!.ziwei } : {}), ...(savedChart?.context ? { context: savedChart.context } : {}) } });
          setReadings((prev) => ({ ...prev, [cat.key]: readingFromInvoke(data, error) })); // 방어: 일시적 불가·오류 친화 처리
          if ((data as any)?.unavailable) { setProgress(null); setGenProgress({ route: gpRoute, active: false }); return; } // 방어: 사용량 한도 등 → 남은 영역 연속 호출·과금 방지(중단)
        } catch (err) {
          setReadings((prev) => ({ ...prev, [cat.key]: { error: (err as Error).message } }));
        }
        setProgress((p) => (p ? { done: p.done + 1, total: p.total, current: p.current } : null));
        setGenProgress({ route: gpRoute, done: ++gDone }); // 홈 진행률 갱신(영역 1개 완료)
      }
      setProgress(null);
      setGenProgress({ route: gpRoute, done: cats.length, total: cats.length }); // 완료 — 홈 배너에 '풀이 보기'(active 유지·탭하면 이동+닫기, daniel 이슈13)
      // (완료 푸시는 setGenProgress 완료 전이에서 중앙 발송 — 중복 방지)
    } finally {
      releaseGen(lockKey);                                 // 완료·중단·오류 모두 잠금 해제(genLock 공유)
    }
  }

  // 미리보기(daniel 2026-06): 무료 진입 시 '첫 분야 1개만' 맛보기 생성 → 나머지는 잠김(unlock 유도).
  //   trial(전 항목 무료) 폐지 대체 — 비용 1영역/chart(캐시되어 재방문 0). 전체는 onStart(광고/결제/쿠폰).
  async function generatePreview(key: string) {
    let id = chartId;
    if (!id) { id = savedChart ? await ensureServerChart() : await insertChart(); if (!id) return; setChartId(id); }
    try {
      const { data, error } = await supabase.functions.invoke('interpret', { body: { chartId: id, category: key, kind, tier: 'paid', preview: true, lang: appLang(), ...(kind === 'ziwei' ? { ziwei: c!.ziwei } : {}), ...(savedChart?.context ? { context: savedChart.context } : {}) } });
      setReadings((prev) => ({ ...prev, [key]: readingFromInvoke(data, error) })); // 방어: 일시적 불가·오류 친화 처리(미리보기=preview)
    } catch (e) { setReadings((prev) => ({ ...prev, [key]: { error: (e as Error).message } })); }
  }

  // ADR-055 P3 opt-in 갱신 — 분석 버전이 낮은 풀이를 최신 해석으로 재생성(refresh:true). 풀이당 횟수 cap(서버 REGEN_CAP).
  async function refreshReading(key: string) {
    if (!chartId || progress) return;
    const label = cats.find((x) => x.key === key)?.label ?? '';
    setProgress({ done: 0, total: 1, current: label });
    try {
      const { data, error } = await supabase.functions.invoke('interpret', {
        body: { chartId, category: key, kind, tier: 'paid', refresh: true, lang: appLang(), ...(kind === 'ziwei' ? { ziwei: c!.ziwei } : {}) },
      });
      if (error) Alert.alert(t('common.error'), t('common.genFailed', '풀이를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.')); // 방어: 원문 대신 친화 문구
      else if (data?.unavailable) Alert.alert(t('common.error'), (data as any).message || t('common.llmBusy', '지금 통변 생성이 일시적으로 어려워요. 잠시 후 다시 시도해 주세요.')); // 방어: LLM 일시적 불가
      else if (data?.refreshDenied) Alert.alert(t('reading.refreshDeniedTitle', '갱신 한도'), t('reading.refreshDenied', { cap: data.cap, defaultValue: '이 풀이는 최대 {{cap}}번까지 갱신할 수 있어요.' }));
      else if (data?.renewRequired) await runContentRenewal({ kind: data.kind, isPremium, onDone: () => void refreshReading(key) }); // 운세형 1년 경과 → 재통변 할인(프리미엄30%/일반10%) 구매 후 재생성 재시도(daniel 07-08)
      else if (data?.reading) {
        setReadings((prev) => ({ ...prev, [key]: data.reading }));
        setStale((prev) => { const n = new Set(prev); n.delete(key); return n; });
      }
    } catch (e) { Alert.alert('!', (e as Error).message); }
    setProgress(null);
  }

  // 생성 트리거: 프리미엄 > 무료이용권(쿠폰) > 건당 결제 순. (★보상형 광고 무료 생성 제거 — 유료 통변은 결제/프리미엄만, daniel 2026-07.)
  // 생성 전 '이 명식으로 풀이할지' 확인(+보유 이용권) → 확인 시 doStart(daniel 07-02). 자동생성(runAll 직접)엔 미적용.
  function onStart() {
    if (startingRef.current) return;                       // 연타 시 확인창 중복 방지(실제 락은 doStart)
    void confirmReadingChart({ chartLabel: savedChart?.label, creditKind: kind === 'ziwei' ? 'ziwei' : 'reading', t, onConfirm: () => { void doStart(); } });
  }
  async function doStart() {
    if (startingRef.current) return;                       // ★연타 가드(동기): 이미 시작 처리 중이면 무시 — 게이트(언락·크레딧 조회) 비동기 구간 사이로 새는 이중 결제·중복 생성 차단
    startingRef.current = true;
    try {
      // 풀이는 계정에 저장·캐시됨(서버차트 귀속) → 미로그인 시 '저장용' 안내 후 로그인 유도(daniel)
      if (!requireLoginForPurchase(session, () => router.push('/login'), t)) return;
      if (!assertOnline(t)) return;                          // 오프라인 = 신규 생성 차단(경고)
      // ★자물쇠(chart race) 계보의 마지막 문(daniel 07-03): 수동 생성은 게이트 판정·생성 모두 canonical id로 한다.
      //   chartId useState 시드는 온디바이스 캐시(savedChart.serverChartId)라, 진입 effect가 서버 canonical로 교체하기 전에
      //   사용자가 이 버튼을 누르면 stale id로 게이트·interpret가 나갈 수 있다(재해석·자물쇠 재발·오결제). ensureServerChartId는
      //   멱등(inflight dedupe + 서버 natal 지문)이라 재호출해도 이중 발급·이중 과금이 없다 → 아래 전 분기에서 이 id만 쓴다.
      const id = savedChart ? await ensureServerChart() : chartId;
      if (savedChart && !id) { setGlobalError(t('reading.saveFail')); return; } // 저장명식인데 canonical 해석 실패(오프라인 등) → stale로 진행 금지(생성 보류)
      if (id && id !== chartId) setChartId(id);              // 시드가 stale이었으면 canonical로 동기화(표시 상태 일치)
      if (isPremiumForChart(id)) { await runAll(id); return; } // 이 명식이 프리미엄 지정이면 무게이트(#1 — 계정 프리미엄이라도 비지정 명식은 아래 결제 게이트로)
      const ck = kind === 'ziwei' ? 'ziwei' : 'reading';     // 이 화면 종류의 세트 크레딧 키
      // ★서버 권위 세트 게이트(보안 P3·daniel): 차감·언락은 Edge가 한다(이중차감 제거). 클라는 UX 사전확인만.
      //   ① 이미 세트 언락됨 → 무료 재생성  ② 크레딧 보유 → 바로 생성(Edge가 1회 차감+언락)  ③ 없음 → 건당 결제로 부여
      if (id && await isReadingUnlocked(id, ck)) { setUnlocked(true); await runAll(id); return; } // ★언락됨 → 표시상태 즉시 해제(자물쇠 누른 뒤 안 풀리던 것 수정)
      if (((await loadCredits())[ck] ?? 0) > 0) { await runAll(id); return; }
      // ★유료 통변은 보상형 광고로 무료 생성하지 않는다(daniel: 비용발생 콘텐츠=결제/프리미엄만) → 건당 결제로만 크레딧 부여 후 생성(Edge가 차감+세트 언락).
      Alert.alert(t('reading.premiumAlert'), t('reading.premiumAlertMsg', { price: formatKrw(creditPrice(ck)) }), [
        // ★C1(daniel 07-03): 결제 상품을 credit_{reading|ziwei}(웹훅이 적립 가능)로 통일 + 클라 grant 폐지 → 웹훅 반영 폴링 후 생성(Edge 세트게이트가 1회 차감·언락).
        //   (기존 purchaseReading=deprecated unlock_2500 은 credit_* 아님 → 웹훅이 적립할 수 없어 교체. 가격은 스토어의 credit_reading/credit_ziwei 값.)
        { text: t('reading.payPerUse', { price: formatKrw(creditPrice(ck)) }), onPress: async () => { try { const ok = await purchaseCreditRC(ck); if (!ok) return; const { granted } = await waitForCreditGrant(ck); if (granted) await runAll(id); else Alert.alert(t('reading.premiumAlert'), t('reading.applyPending', '결제가 완료됐어요. 적용까지 잠시 걸릴 수 있어요. 잠시 후 다시 시도해 주세요.')); } catch (e) { Alert.alert('!', (e as Error).message); } } },
        { text: t('common.cancel'), style: 'cancel' },
      ]);
    } finally {
      startingRef.current = false;                           // 해제 — 생성(runAll)은 위에서 await되어 끝까지 잠금 유지, 결제 alert 분기는 모달이 추가 탭을 막음
    }
  }

  const banner = isPremium ? t('reading.bannerPremium') : t('reading.bannerPerUse', { price: formatKrw(creditPrice(kind === 'ziwei' ? 'ziwei' : 'reading')) }); // 실가 주입(사주 19,900·자미 14,900) — 하드코딩 근절
  const haveAll = cats.every((cat) => readings[cat.key]);
  // 명식별 프리미엄(#1): 이 명식이 프리미엄 지정이거나 결제 언락돼야 '전부 보기'. 아니면(무료모드·비지정 명식) 캐시가 있어도 페이월.
  const entitled = computeEntitled(isPremium, isPremiumForChart(chartId), unlocked); // 권한=전역프리미엄/이명식지정/결제언락(readingGate·테스트됨)
  // 미권한 = 잠금 — 단 ①캐시된 풀이가 하나도 없을 때만(이미 생성된 풀이는 절대 가리지 않음=자물쇠 근본수정) ②언락 조회 끝난 뒤(race 깜빡임 방지). daniel 07-01
  const locked = computeLocked({ cacheLoaded, unlockedLoaded, entitled, hasProgress: !!progress, readingsCount: Object.keys(readings).length }); // ★캐시 있으면 잠금 X(readingGate·테스트됨)
  // 생성/결제 버튼: 잠금(미권한)이거나, 미완성 + (비프리미엄 or 대표 아님)일 때.
  const showStart = progress === null && (locked || (!haveAll && (!isPremium || !isRep)));

  // 프리미엄 자동 생성 — 캐시 로드 후 미생성 영역이 있으면 1회 자동 runAll(버튼 없이).
  //   ★대표 명식에만(비용통제): 다른 명식은 프리미엄이라도 자동 생성하지 않는다(수동 버튼).
  useEffect(() => {
    // ★자물쇠 근본 방어(readingGate·테스트됨): 로드된 캐시가 *현재 명식(chartId) 기준*으로 비어 있을 때만 자동생성.
    //   stale/race 로드(직전 다른 명식으로 로드된 결과)로는 재생성하지 않는다(잘못된 명식 재생성=자물쇠 방지). 서버 지문 멱등이 근본.
    if (computeShouldAutoGen({
      premiumForChart: isPremiumForChart(chartId), isRep, cacheLoaded, hasProgress: !!progress,
      autoRan: autoRan.current, online: isOnline(), hasSession: !!session,
      readingsChartId, currentChartId: chartId, missingCount: cats.filter((cat) => !readings[cat.key]).length,
    })) { autoRan.current = true; void autoGenWithChartConfirm({ creditKind: kind === 'ziwei' ? 'ziwei' : 'reading', onConfirm: () => runAll() }); } // 명식 2개+ 면 '어느 명식?' 먼저(daniel 07-13)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPremium, isRep, cacheLoaded, readings, cats, progress, session, chartId, readingsChartId]);

  // 미리보기 자동 생성 — 미프리미엄·미완성 시 '첫 분야 1개'만 맛보기(나머지는 showStart 로 unlock).
  //   이미 맛보기/전체 캐시가 있으면 skip(멱등). 오프라인·미로그인 보류.
  useEffect(() => {
    if (isPremiumForChart(chartId) || unlocked || !cacheLoaded || !session || !isOnline() || progress || previewRan.current) return; // 권한 있으면(지정 프리미엄/결제) 미리보기 불필요
    const pk = cats[0]?.key;
    if (!pk || haveAll || readings[pk]) return;            // 전체 완성 or 맛보기 이미 있으면 생성 안 함
    previewRan.current = true;
    generatePreview(pk);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPremium, unlocked, chartId, cacheLoaded, session, progress, cats, readings, haveAll]);

  // 추가 질문 전송 — 프리미엄 무료 2회 + 초과 시 건당 결제 후 재시도(paid). Edge가 게이트 판정.
  async function submitFollowup() {
    if (!detail || !chartId || !askInput.trim() || asking) return;
    Keyboard.dismiss();                                    // 전송 시 키보드 내림(모달 위 키보드 잔존=먹통 방지)
    const q = askInput.trim();
    setAsking(true);
    const res = await askFollowup(chartId, detail, kind, q); // 서버가 무료한도/크레딧/프리미엄 판정
    setAsking(false);
    if (res.kind === 'answer') {
      setFollowups((prev) => ({ ...prev, [detail!]: [...(prev[detail!] ?? []), { question: q, answer: res.answer }] }));
      setAskInput('');
    } else if (res.kind === 'needPremium') {
      Alert.alert(t('reading.askPremiumTitle'), t('reading.askPremiumMsg'));
    } else if (res.kind === 'needPayment') {
      // 무료 한도 소진 → 건당 결제 안내 → 결제 성공 시 paid 로 재시도(RevenueCat 미연동 시 '준비 중')
      Alert.alert(t('reading.askPayTitle'), t('reading.askPayMsg', { price: formatKrw(creditPrice('followup')) }), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('reading.askPayBtn', { price: formatKrw(creditPrice('followup')) }), onPress: async () => {
          try { const ok = await purchaseCreditRC('followup'); if (!ok) return; const { granted } = await waitForCreditGrant('followup'); if (granted) await submitFollowup(); else Alert.alert(t('reading.askPayTitle'), t('reading.applyPending', '결제가 완료됐어요. 적용까지 잠시 걸릴 수 있어요. 잠시 후 다시 시도해 주세요.')); } // ★C1: 클라 grant 폐지 → 웹훅 적립 폴링 후 서버 consume(followup)
          catch (e) { Alert.alert(t('reading.payPending'), (e as Error).message); }
        } },
      ]);
    } else {
      Alert.alert(t('common.error'), res.message);
    }
  }

  // 상세 모달 닫기 — 키보드(추가질문 입력)부터 내리고 닫는다(daniel: followup 후 뒤로가기 먹통=freeze 방지).
  //   ★iOS: Modal 안 TextInput 키보드가 떠 있는 채로 Modal 을 닫으면 키보드 프레임이 남아 화면 터치가 막힘.
  const closeDetail = () => { Keyboard.dismiss(); setDetail(null); };

  // 추가 질문(Q&A) 영역 — 상세 모달 하단. 프리미엄 = 무료 2회+건당 / 비프리미엄 = 프리미엄 유도.
  const renderFollowups = (key: string) => {
    const list = followups[key] ?? [];
    const used = list.length;
    const freeLeft = Math.max(0, 1 - used); // 무료 1회(daniel) — 초과는 건당 구매
    return (
      <View style={styles.askWrap}>
        <Text style={styles.askH}>{t('reading.askTitle')}</Text>
        {/* 지난 질문·답변 */}
        {list.map((f, i) => (
          <View key={i} style={styles.qaItem}>
            <Text style={styles.qaQ}>Q. {f.question}</Text>
            <Text style={styles.qaA}>{f.answer}</Text>
          </View>
        ))}
        {isPremium ? (
          <>
            <Text style={styles.askQuota}>
              {freeLeft > 0 ? t('reading.askFree', { n: freeLeft }) : t('reading.askPaid', { price: formatKrw(creditPrice('followup')) })}
            </Text>
            <View style={styles.askRow}>
              <TextInput
                style={[styles.askInput, { fontSize: fs(15), lineHeight: fs(20), minHeight: fs(20) + space(5) }]}
                value={askInput}
                onChangeText={setAskInput}
                placeholder={t('reading.askPh')}
                placeholderTextColor={colors.inkFaint}
                multiline
                maxLength={50}
                editable={!asking}
              />
              <Text style={styles.askLen}>{askInput.length}/50</Text>
              <PressableScale
                style={[styles.askSend, { minHeight: fs(20) + space(5) }, (!askInput.trim() || asking) && styles.askSendOff]}
                onPress={() => submitFollowup()}
                disabled={!askInput.trim() || asking}
              >
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
  };

  // 항목 상세 섹션 렌더 — 리스트 상세 모달에서 재사용
  const renderSections = (key: string) => {
    const r = normalizeReading(readings[key]);
    // race 방어: readings 상태 초기화·undefined 시 빈 표시(크래시 방지)
    if (!r || typeof r !== 'object') return <Text style={styles.err}>{'풀이를 불러오는 중…'}</Text>;
    const base = asText(r.base), past = asText(r.past), overlay = asText(r.overlay), future = asText(r.future), remedy = asText(r.remedy);
    if (r.error) return <Text style={styles.err}>{r.error}</Text>;
    const bodyDyn = { fontSize: fs(15), lineHeight: fs(26) }; // 설정 글자 크기 반영
    return (
      <>
        {/* 이슈19 소제목 — 이 카테고리 통변의 headline 있으면 상세 내용 맨 위에 한 줄 강조 */}
        {typeof r.headline === 'string' && r.headline.trim() ? (
          <Text style={{ fontSize: fs(19), fontWeight: '800', color: colors.ju, marginBottom: space(3), lineHeight: fs(26) }}>{r.headline}</Text>
        ) : null}
        {base ? (
          <View style={styles.section}>
            <Text style={styles.secLabel}>{t('reading.base')}</Text>
            <Text style={[styles.secBody, bodyDyn]}>{base}</Text>
          </View>
        ) : null}
        {past ? (
          <View style={styles.section}>
            <Text style={styles.secLabel}>{t('reading.past')}</Text>
            <Text style={[styles.secBody, bodyDyn]}>{past}</Text>
          </View>
        ) : null}
        {overlay ? (
          <View style={styles.section}>
            <Text style={styles.secLabel}>{t('reading.overlay')}</Text>
            <Text style={[styles.secBody, bodyDyn]}>{overlay}</Text>
          </View>
        ) : null}
        {future ? (
          <View style={styles.section}>
            <Text style={styles.secLabel}>{t('reading.future', '앞날·다가올 흐름')}</Text>
            <Text style={[styles.secBody, bodyDyn]}>{future}</Text>
          </View>
        ) : null}
        {remedy ? (
          <View style={[styles.section, styles.remedySection]}>
            <Text style={styles.secLabel}>{t('reading.remedy')}</Text>
            <Text style={[styles.secBody, bodyDyn]}>{remedy}</Text>
          </View>
        ) : null}
        {!base && !overlay && !remedy && <Text style={[styles.secBody, bodyDyn]}>{asText(r)}</Text>}
      </>
    );
  };

  return (
    <>
    <UnlockOverlay visible={showUnlockOverlay(!!progress, Object.keys(readings).length) /* 생성중+캐시0일 때만 — 기존 풀이 위 자물쇠 방지(readingGate·테스트됨) */} message={progress?.current ? t('reading.progress', { current: progress.current, done: progress.done, total: progress.total }) : t('reading.generating', '풀이를 정성껏 그리는 중…')} videoKey={kind === 'ziwei' ? 'ziwei' : 'saju'} /* 사주=saju / 자미두수=ziwei 테마 로딩 영상(ReadingScreen 은 kind prop 로 두 종류 공용) */ />
    {/* 풀이 진입 순간 골드 명조 문 열림 영상 — 1회 재생 후 페이드아웃(daniel 07-06) */}
    <DoorReveal visible={doorPlaying} onDone={() => setDoorPlaying(false)} />
    <ScrollView style={styles.screen} contentContainerStyle={styles.wrap}>
      {header}
      {/* 풀이 보유 만료일 — 공통 컴포넌트(프리미엄 가드·문구 한 곳, daniel 07-01). 생성된 풀이 있을 때만. */}
      <ExpiryNote expiry={Object.keys(readings).length > 0 ? expiry : null} chartId={chartId} />
      {/* 상단 타이틀·설명 제거(daniel: 카드뷰만) — 화면 헤더(네비)로 충분 */}
      {/* 생성 버튼 + 과금 안내(미생성 항목이 있을 때만) */}
      {showStart && (
        <>
          <PressableScale style={styles.startBtn} onPress={onStart}>
            <Text style={styles.startBtnText}>{t('reading.runAll', { count: cats.length })}</Text>
          </PressableScale>
          <Text style={styles.bannerText}>{banner}</Text>
        </>
      )}

      {/* 생성 중 진행률은 UnlockOverlay(자물쇠) message로 일원화 — 중복 인디케이터 제거(daniel) */}

      {/* 차트 저장 실패(전역) */}
      {globalError && <View style={styles.card}><Text style={styles.err}>{globalError}</Text></View>}

      {/* ★진입 직후 캐시(serverChartId·readings) 로딩 중 — 빈 화면 '무반응' 대신 스피너(daniel: 첫 진입 로딩이 김).
          생성 중(progress)·생성 버튼(showStart)·이미 받은 풀이가 있으면 그쪽 UI가 대신 떠서 미표시. */}
      {!cacheLoaded && !showStart && !progress && Object.keys(readings).length === 0 && (
        <View style={styles.loadingBox}><ActivityIndicator color={colors.ju} /></View>
      )}

      {/* #1: 미권한 명식(무료모드·비지정 프리미엄)은 캐시 풀이 대신 페이월 — 첫 영역만 맛보기 */}
      {locked && (
        <View style={styles.card}>
          <Text style={{ ...font.heading, color: colors.ju, marginBottom: space(3), fontSize: fs(16) }}>🔒 {t('reading.lockedTitle', '이 명식의 풀이는 프리미엄 또는 결제로 열려요')}</Text>
          {(() => {
            const r0 = normalizeReading(readings[cats[0]?.key]);
            const tease = r0 && typeof r0 === 'object' && !(r0 as any).error ? asText((r0 as any).base) : null;
            return tease ? <Text style={[styles.secBody, { fontSize: fs(15), lineHeight: fs(26) }]} numberOfLines={4}>{tease}</Text> : null;
          })()}
          <Text style={{ ...font.caption, color: colors.inkSoft, marginTop: space(3) }}>{t('reading.lockedNote', '위 버튼으로 열어 전부 보실 수 있어요.')}</Text>
        </View>
      )}
      {/* 카테고리 그룹 아코디언 — 그룹 헤더(접기/펴기) + 영역 리스트(탭→상세 모달). 기본 펼침. */}
      {!locked && groups.map((g) => {
        const open = expandedG[g.label] ?? true;
        return (
          <View key={g.label} style={styles.group}>
            <PressableScale style={styles.groupHead} onPress={() => setExpandedG((e) => ({ ...e, [g.label]: !open }))}>
              <Text style={styles.groupLabel}>{g.label}</Text>
              <Text style={styles.groupCount}>{g.items.length}</Text>
              <Text style={styles.groupChevron}>{open ? '▼' : '▶'}</Text>
            </PressableScale>
            {open && g.items.map((cat) => {
              const r = normalizeReading(readings[cat.key]);
              // race 방어: r이 undefined이면 로딩 중으로 표시(크래시 방지)
              const preview = (!r || typeof r !== 'object') ? '풀이를 불러오는 중…' : r.error ? '생성 실패 — 다시 시도해 주세요' : asText(r.base);
              return (
                <PressableScale key={cat.key} style={styles.listItem} onPress={() => setDetail(cat.key)}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.listLabelRow}>
                      <Text style={styles.listLabel}>{cat.label}</Text>
                      {cat.desc ? <Text style={styles.listDesc}>{cat.desc}</Text> : null}
                    </View>
                    <Text style={styles.listPreview} numberOfLines={1}>{preview}</Text>
                  </View>
                  <Text style={styles.listArrow}>›</Text>
                </PressableScale>
              );
            })}
          </View>
        );
      })}
    </ScrollView>

    {/* 항목 상세 — 탭한 영역의 섹션을 별도 페이지처럼 슬라이드 */}
    <Modal visible={!!detail} animationType="slide" onRequestClose={closeDetail}>
      <KeyboardAvoidingView style={styles.detailScreen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* daniel(2026-06-24): 공유는 헤더가 아니라 풀이 맨 끝으로 이동(자미 등 위치 통일) → 헤더는 '목록으로'만 */}
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <PressableScale style={styles.detailBack} onPress={closeDetail} hitSlop={12}>
            <Text style={[styles.detailBackTx, { fontSize: fs(20) }]}>‹ 목록으로</Text>
          </PressableScale>
        </View>
        {detail && (
          <ScrollView contentContainerStyle={styles.detailWrap} keyboardShouldPersistTaps="handled">
            <Text style={styles.detailTitle}>{cats.find((x) => x.key === detail)?.label}</Text>
            {/* 자미두수 등 — 이 항목(궁)이 뭘 보는지 설명 */}
            {cats.find((x) => x.key === detail)?.desc ? <Text style={styles.detailDesc}>{cats.find((x) => x.key === detail)?.desc}</Text> : null}
            {renderSections(detail)}
            {/* ADR-055 P3: 분석 버전이 낮은 풀이만 '최신 해석으로 갱신'(opt-in·cap). 최신이면 미노출. */}
            {(stale.has(detail) || renewable.has(detail)) && (
              <PressableScale style={styles.refreshBtn} onPress={() => refreshReading(detail)}>
                <Text style={styles.refreshBtnTx}>{renewable.has(detail) ? t('reading.renew', '🔄 최신 통변으로 재통변') : t('reading.refreshStale', '최신 해석으로 갱신')}</Text>
              </PressableScale>
            )}
            {renderFollowups(detail)}
            {/* daniel(2026-06-24): 풀이 맨 끝에 음성 듣기 + 공유(콘텐츠 화면과 균일 — 자미 등 헤더에 있던 공유 통일) */}
            {readings[detail] && !(readings[detail] as any)?.error ? (<>
              <TTSButton key={detail} reading={readings[detail]} />{/* key=카테고리 → 이동 시 옛 TTSButton 언마운트=옛 음성 정지(daniel: 다른 카테고리 읽힘) */}
              <ShareReadingButton kind={kind} category={detail} title={cats.find((x) => x.key === detail)?.label} content={readings[detail]} />
            </>) : null}
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: 'transparent' }, // 전역 배경 투과(ContentBackdrop)
  wrap: { padding: space(5), paddingBottom: space(10) },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'transparent' }, // 전역 배경 투과(ContentBackdrop)
  loadingBox: { paddingVertical: space(12), alignItems: 'center' }, // 진입 직후 캐시 로딩 스피너(무반응 방지·daniel)
  h: { ...font.heading, fontSize: 21 },
  sub: { ...font.caption, marginTop: space(1.5), marginBottom: space(4) },
  startBtn: { backgroundColor: colors.ju, borderRadius: radius.md, paddingVertical: space(4), alignItems: 'center', marginTop: space(2), ...shadow.card },
  startBtnText: { color: colors.bg, fontSize: 16, fontWeight: '800' },
  // ADR-055 P3 '최신 해석으로 갱신'(stale 영역만) — 보조 외곽선 버튼
  refreshBtn: { marginTop: space(6), borderWidth: 1.5, borderColor: colors.ju, borderRadius: radius.md, paddingVertical: space(3.5), alignItems: 'center' },
  refreshBtnTx: { color: colors.ju, fontSize: 15, fontWeight: '800' },
  bannerText: { ...font.caption, color: colors.inkSoft, textAlign: 'center', marginTop: space(3) },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: space(2), marginTop: space(5), marginBottom: space(2) },
  progressText: { ...font.body, color: colors.inkSoft },
  card: {
    marginTop: space(4), padding: space(4), borderRadius: radius.md,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, ...shadow.card,
  },
  cardTitle: { ...font.heading, color: colors.ju, marginBottom: space(2) },
  // 가독성(daniel): 소제목 더 크게 + 섹션(문단) 사이 간격 넉넉히
  section: { marginTop: space(6) },
  secLabel: { fontSize: 16, color: colors.ju, fontWeight: '800', marginBottom: space(2.5), letterSpacing: 0.3 },
  secBody: { ...font.body, color: colors.ink, fontSize: 15, lineHeight: 26 },
  remedySection: { marginTop: space(6), paddingTop: space(5), borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  // 카테고리 그룹 아코디언
  group: { marginTop: space(5) },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: space(2), paddingVertical: space(2), paddingHorizontal: space(1), borderBottomWidth: 1.5, borderBottomColor: colors.juLine, marginBottom: space(1) },
  groupLabel: { ...font.heading, fontSize: 18, color: colors.ink, fontWeight: '800', flex: 1 },
  groupCount: { ...font.caption, color: colors.inkFaint, fontWeight: '700' },
  groupChevron: { fontSize: 12, color: colors.ju },
  // 항목 리스트(구역)
  listItem: { flexDirection: 'row', alignItems: 'center', gap: space(3), marginTop: space(3), padding: space(4), backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, ...shadow.card },
  listLabelRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: space(2) },
  listLabel: { ...font.heading, fontSize: 19, color: colors.ju },
  listDesc: { ...font.caption, color: colors.inkSoft },
  listPreview: { ...font.caption, color: colors.inkSoft, marginTop: space(1) },
  listArrow: { fontSize: 24, color: colors.inkFaint, fontWeight: '300' },
  // 상세 페이지(모달)
  detailScreen: { flex: 1, backgroundColor: colors.bg },
  detailBack: { paddingTop: space(12), paddingHorizontal: space(5), paddingBottom: space(3) },
  detailBackTx: { ...font.body, fontSize: 18, color: colors.ju, fontWeight: '700' },
  detailWrap: { padding: space(5), paddingTop: space(2), paddingBottom: space(10) },
  detailTitle: { ...font.title, fontSize: 26, color: colors.ink, marginBottom: space(1) },
  detailDesc: { ...font.body, color: colors.inkSoft, marginBottom: space(3) },
  err: { fontSize: 13, color: colors.ju },
  // 추가 질문(Q&A)
  askWrap: { marginTop: space(7), paddingTop: space(5), borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  askH: { fontSize: 17, fontWeight: '800', color: colors.ink, marginBottom: space(3) },
  qaItem: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.juLine, padding: space(4), marginBottom: space(3) },
  qaQ: { ...font.body, fontWeight: '800', color: colors.ju, marginBottom: space(2) },
  qaA: { ...font.body, color: colors.ink, lineHeight: 24 },
  askQuota: { ...font.caption, color: colors.inkFaint, marginBottom: space(2) },
  askRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space(2) },
  // 좌상단 정렬(daniel: 가운데 X — 위·왼쪽으로) + minHeight로 충분한 높이
  askInput: { ...font.body, flex: 1, minHeight: 44, maxHeight: 120, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: space(3), paddingVertical: space(2.5), color: colors.ink, textAlign: 'left', textAlignVertical: 'top' },
  askLen: { fontSize: 11, color: colors.inkFaint, alignSelf: 'flex-end', marginBottom: space(3) },
  askSend: { backgroundColor: colors.ju, borderRadius: radius.md, paddingHorizontal: space(4), alignItems: 'center', justifyContent: 'center' },
  askSendOff: { opacity: 0.4 },
  askSendTx: { color: colors.bg, fontWeight: '800', fontSize: 14 },
  askLock: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.ju, borderRadius: radius.md, paddingVertical: space(4), alignItems: 'center' },
  askLockTx: { color: colors.ju, fontWeight: '700', fontSize: 14 },
});
