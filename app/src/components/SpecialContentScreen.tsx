// app/src/components/SpecialContentScreen.tsx — 심층 콘텐츠 공통 화면(뿌리·비치는 나·사명 등)
// ─────────────────────────────────────────────────────────────────────────
// love.tsx 패턴 일반화(단일 책임): 프리미엄 자동생성 + 쿠폰/관리자 게이트 + UnlockOverlay + 영구 캐시.
//   각 콘텐츠 라우트(roots/image/mission)는 kind·제목·섹션 + 시각(heroMotif/themeColor/heroImage)만 주입한다.
//   ★보는 맛(daniel 2026-06): 상단 ContentHero(SVG 모티프 + 타이틀 애니 + 이미지 슬롯) + 섹션 순차 등장(stagger).
//   needsZiwei=true 면 자미두수 명반을 body 로 전달(사명=사주 主 + 자미 보조 교차).
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState, useRef, type ReactNode } from 'react';
import { A } from '../lib/ui/remoteAsset'; // ★이미지 원격화(daniel 08-01) — 번들에서 걷어내고 Storage 에서 받는다
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, Animated, Easing, Modal } from 'react-native';
import { PressableScale } from './PressableScale';
import { ReadingProse, ReadingHeadline, ReadingPoints } from './ReadingProse'; // 풀이 본문 공통 렌더(P0 문단화·강조·접이식 + P1 핵심3줄). 이 셸을 쓰는 유료 콘텐츠 29종에 일괄 적용
import { GlossarySheet, type GlossaryTarget } from './GlossarySheet'; // 명리 용어 탭 → 뜻(가독성 P2)
import { glossaryKindOf } from '../lib/ui/readingEmphasis'; // 용어 → 글로서리 kind(십신/기본)
import { ExpiryNote } from './ExpiryNote'; // 보유 만료일 공통(프리미엄 가드 한 곳)
import { Image as ExpoImage } from 'expo-image'; // 콘텐츠 배너 — 자동 다운샘플·디스크캐시(daniel: 이미지 프리로드/캐시). 홈카드와 같은 파일 캐시 공유 → 콘텐츠 진입 즉시
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { Alert } from '../lib/ui/alert'; // 커스텀 알림(앱 디자인)
import { useTranslation } from 'react-i18next';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { computeChart } from '../lib/engine/engine';
import { loadRepChart, listCharts, setRepresentative, getRepresentativeId, type SavedChart } from '../lib/engine/myChart';
import { ensureServerChartId } from '../lib/backend/prewarmReadings';
import { useAuth } from '../lib/useAuth';
import { useSubscription } from '../lib/billing/subscription';   // 프리미엄=자동 생성
import { useFontScale } from '../lib/ui/fontScale';
import { promptSignupOnReadingEnter } from '../lib/ui/signupPrompt'; // ★유료 콘텐츠 진입 시 계정 연결 안내(daniel 07-27)
import { type CreditKind } from '../lib/billing/coupons'; // C1: 결제 후 웹훅 적립 폴링(차감은 Edge 서버 게이트) · loadCredits=게이트 사전 확인(자물쇠 번쩍임 방지)
import { markUnlocked } from '../lib/billing/unlocks';
import { fetchReadingState } from '../lib/billing/readingState'; // ★ADR-061 서버가 상태를 정한다(앱은 표출만) // isUnlocked=무차감 재열람 힌트 / markUnlocked=생성 성공 후 캐시 힌트(C3 part2 — 게이트 아님)
import { ShareReadingButton } from './ShareReadingButton'; // 이슈17: 풀이 결과 공유
import { TTSButton } from './TTSButton'; // daniel: 풀이 음성 읽기(온디바이스 TTS·무료)
import { RelatedContent } from './RelatedContent'; // 연관 콘텐츠 자동 추천(하단 크로스셀·API 0·daniel 기획서)
import { buildRomanceMirror } from '../lib/engine/romanceMirror';   // R60 애정 이원분석(온디바이스 판정)
import { ensureCoinsFor } from '../lib/billing/coinGate';
import { withTimeout, GEN_TIMEOUT_MS } from '../lib/core/withTimeout';   // ★게이트·생성 대기 상한(멈춤 방지)   // ★운 단일 경로(daniel 07-28)
import { requireLoginForPurchase } from '../lib/billing/requireLogin';
import { autoGenWithChartConfirm } from '../lib/ui/confirmChart'; // 자동생성 전 명식 확인(명식 2개+ 일 때)
import { requestChartConfirm } from '../lib/ui/chartConfirm'; // 명식 확인 모달을 await — 수동 경로는 runFlow 가 순서를 직접 제어(daniel 07-26)
import { assertOnline } from '../lib/backend/network';
import { supabase } from '../lib/supabase';
import { excludeMock } from '../lib/core/testMode'; // ★목업(tier='mock') 제외(테스트모드 OFF) — 실모드 목업 서빙 차단
import { appLang } from '../lib/i18n';
import { readingFromInvoke } from '../lib/backend/interpretResult'; // 방어: Edge 응답 정규화(일시적 불가·결제필요·오류)
import { logEvent } from '../lib/backend/logger';
import { useLogContentVisit } from '../lib/backend/contentVisit'; // 콘텐츠 방문 집계(daniel 2026-07-06) — 진입 1회
import { setGenProgress } from '../lib/backend/genProgress'; // 일회성 진행도(daniel 이슈15)
import { acquireGen, releaseGen } from '../lib/backend/genLock'; // 크로스마운트 이중 생성 잠금(② 이중 LLM 방지)
import { colors, radius, space, shadow, font } from '../lib/theme';
import { UnlockOverlay } from './UnlockOverlay';         // unlock 자물쇠 애니 + 그 사이 LLM
import { ChartPicker } from './ChartPicker';             // 상단 명식 헤더 — 현재 적용 명식 표시·전환
import { useHeroCap, HERO_CAP } from '../lib/ui/heroSize';
import { useReadBody } from './WebShell';   // ★읽는 화면 본문 캡(단일 소스 — 17개 화면과 같은 값)

export type Section = { key: string; label: string; groupTitle?: string }; // groupTitle: 이 섹션 카드 위에 그룹 구분 헤더(divider) 표시(daniel: 별자리/점성술 섹터 분리)

// kind별 기본 히어로 이미지(daniel: 모든 콘텐츠 히어로에 이미지 — 세로 카드아트도 1.75 박스 cover-crop 시 중앙 띠가 꽉 참, 시뮬 확인).
//   heroImage prop 명시 시 그게 우선(roots/image/mission = 전용 가로 hero-*.jpg). 없으면 이 맵 폴백.
const HERO_BY_KIND: Record<string, any> = {
  daily: A('icons/today.jpg'), monthly: A('icons/month.jpg'), dayPillar: A('icons/dayPillar.jpg'),
  astrology: A('icons/astrology.jpg'), bok: A('icons/bok.jpg'), career: A('icons/career.jpg'), celeb: A('icons/celeb.jpg'),
  dream: A('icons/dream.jpg'), egen: A('icons/egen.jpg'), healing: A('icons/healing.jpg'),
  joseonjob: A('icons/joseonjob.jpg'), lifegraph: A('icons/lifegraph-hero.jpg'), love: A('icons/love-hero.jpg'),
  lovestyle: A('icons/lovestyle.jpg'), luck: A('icons/luck.jpg'), mbti: A('icons/mbti.jpg'),
  name: A('icons/name.jpg'), newyear: A('icons/newyear-hero.jpg'), numerology: A('icons/numerology.jpg'),
  pastlife: A('icons/pastlife.jpg'), persona: A('icons/persona.jpg'), pet: A('icons/pet.jpg'),
  taegil: A('icons/taegil.jpg'), talent: A('icons/talent.jpg'), zodiac: A('icons/zodiac.jpg'),
  child: A('icons/child.jpg'), future10: A('icons/future10.jpg'),
};

/** 열람 플로우 잠금의 stale 회수 시간(ms). 결제창·웹훅 폴링을 포함해 넉넉히 — genLock(150초)보다 길게 둔다. */
const FLOW_STALE_MS = 180_000;

/** 통변 생성 대기 상한(ms) — 실제 20~40초 걸리므로 넉넉히. 초과하면 캐시 폴링으로 회수한다. */


export function SpecialContentScreen({ kind, category = kind, title, sub, sections, needsZiwei = false, genMsg, heroMotif, themeColor = colors.ju, heroImage, buildBody, freePreview, freeHook, showExpiry = false, premiumCovered = false, headerExtra, autoGen = true, keepHeaderExtra = false, onChartResolved, regenToken }: {
  kind: CreditKind;        // 이용권/unlock 키(roots·image·mission). 크레딧 단위.
  category?: string;       // 캐시·Edge category(기본=kind). daniel B 유명인: 인물별 celeb_{id}로 분리(크레딧은 kind='celeb' 공용).
  title: string;
  sub: string;
  sections: Section[];     // 응답 JSON 키 ↔ 라벨(순서대로 카드)
  needsZiwei?: boolean;    // 자미 명반을 body 로 전달(사명)
  genMsg: string;          // 생성 중 오버레이 메시지
  heroMotif?: ReactNode;   // 상단 SVG 모티프(나무·오라·별자리)
  themeColor?: string;     // 섹션 강조색(콘텐츠별 정체성)
  heroImage?: any;         // 히어로 배경 이미지(옵션 — 없으면 모티프만)
  buildBody?: (chart: SavedChart) => Record<string, any>; // 추가 body(수비학/점성술 = 앱이 산출한 차트를 Edge로 전달)
  freePreview?: (chart: SavedChart) => ReactNode; // 무료 티어(하이브리드) — 잠김 화면에 온디바이스 기본값 미리보기(수비학 생명수·점성술 빅3)
  freeHook?: (saju: any) => ReactNode; // ★무료 온디바이스 티저 — 히어로 바로 아래·잠김/열림 무관 항상 노출(유료 전환 후크). love.tsx의 LoveFlowGraph 배치를 공용화(재회 도화-충 달력 등). c.saju(+timeUnknown 관례 병합)를 넘겨받는다.
  showExpiry?: boolean;    // 유료 단일 풀이(roots·image·talent·mission)만 = 생성일+1년 '보유 만료일' 표시(daniel #25). 무료·소모성 콘텐츠는 미전달 → 숨김.
  premiumCovered?: boolean; // 프리미엄 포함 콘텐츠(자식운 등 프리미엄 5종) = 프리미엄 명식이면 무료 해제·자동생성. 기본 false(스페셜=관리자/크레딧 전용, 프리미엄 무관).
  autoGen?: boolean;         // 프리미엄/소유 시 자동 생성 여부(기본 true). ★자식운=false: 부부/단일을 고른 뒤 '풀이 보기'로 생성(자동생성 시 선택 기회 없음, daniel 07-03).
  headerExtra?: ReactNode;  // 콘텐츠별 상단 커스텀 컨트롤(히어로 아래·섹션/게이트 위, 옵션). 자식운 COUPLE 토글 등 — 잠김·열림 두 상태 모두 노출. 기본 undefined(대부분 콘텐츠는 변화 없음).
  keepHeaderExtra?: boolean; // headerExtra 를 풀이 공개(revealed) 후에도 계속 노출(기본 false=공개 시 숨김). ★재회=true: 잠긴 상대 표시·'상대 바꾸기'를 풀이 보면서도 접근(daniel 07-05).
  onChartResolved?: (chartId: string | null) => void; // 대표 명식 → 서버차트ID 해석/전환 시 콜백(옵션). ★재회: 상대 잠금 저장 키(reunion_other_<id>)를 이 id 로 맞추고 명식 전환 시 재로드.
  regenToken?: number;      // 값이 바뀌면 '그 상대로 다시 풀기' 재생성 트리거(옵션). ★재회: 상대 등록/변경 시 reunion.tsx 가 증가 → 캐시(본인만) 있으면 refresh 로 덮어씀, 없으면 정식 게이트(onStart).
}) {
  const { t } = useTranslation();
  // ★유료 콘텐츠 진입 안내(daniel 2026-07-27) — 비회원·앱 실행당 1회. 차단 아님('나중에' 가능·5.1.1).
  useEffect(() => { promptSignupOnReadingEnter(() => router.push('/login'), t); }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  const router = useRouter();
  const { chartId: chartIdParam } = useLocalSearchParams<{ chartId?: string }>(); // ★M1 재진입 바인딩(배너/푸시 route 의 chartId — 소비 라우트 공통)
  const { session } = useAuth();
  const { isPremium } = useSubscription();
  const { fs } = useFontScale();
  const [savedChart, setSavedChart] = useState<SavedChart | null>(null);
  const [chartId, setChartId] = useState<string | null>(null);
  const [reading, setReading] = useState<any>(null);
  const [expiry, setExpiry] = useState<string | null>(null); // 보유 만료일(생성일+1년) — showExpiry(유료 단일)일 때 캐시 created_at으로 채움(daniel #25)
  const [busy, setBusy] = useState(false);
  const [purchasing] = useState(false); // ★결제 오버레이(daniel 07-24) — '바로 구매' 탭 후 애플 결제창 뜨기까지·웹훅 적립까지 무피드백 방지(성격급한 유저 이탈)
  const [loaded, setLoaded] = useState(false);
  const [owned, setOwned] = useState(false); // 소유(프리미엄/관리자/차감 unlock) — 미구매 차트 풀이 노출 차단(daniel ⓐ). 명식 변경 시 재판정.
  const [reloadKey, setReloadKey] = useState(0); // ChartPicker 로 대표 전환 시 재로드 트리거
  const [revealed, setRevealed] = useState(false); // 상태 뷰 경유(daniel 07-03): 소유(프리미엄/구매/관리자) 풀이도 바로 노출하지 않고 '이미 열려 있음' 상태 뷰를 먼저 보여준 뒤 '풀이 보기'로 공개. 명식/카테고리 변경 시 false 리셋 → 전환할 때마다 상태 뷰 재노출.
  const c = useMemo(() => (savedChart ? computeChart(savedChart.input) : null), [savedChart]);
  // ★열람 플로우 잠금(daniel 07-26 "진행중일땐 다른행동 못하게") — 값 = 시작 시각(ms), 0 = 유휴.
  //   시각을 담는 이유: Alert 가 콜백 없이 닫히면(안드로이드 백버튼) await 가 영구 대기해 잠금이 누수될 수 있어
  //   genLock 과 동일한 stale 타임아웃으로 회수한다.
  const flowRef = useRef(0);
  const [flowBusy, setFlowBusy] = useState(false); // 렌더 잠금(CTA 비활성) — ref 는 동기 차단, state 는 표시용
  const lastAppliedChartId = useRef<string | null>(null); // ★M1 적용한 chartId param 추적(재진입 중복 setRepresentative 방지·reading.tsx 38-43)
  const genSeq = useRef(0);        // ① 생성 세대 토큰 — 명식 전환/재로드 시 ++ 로 진행 중 gen 무효화(stale setReading 폐기)
  const chartIdRef = useRef<string | null>(null); // ① 현재 로드된 serverChartId — generate 결과 명식 대조(남의 풀이 표시 차단)
  const reveal = useRef(new Animated.Value(0)).current; // 섹션 순차 등장
  // 명리 용어 설명 시트(가독성 P2) — 본문 용어 탭 → 기존 글로서리(daniel 검수본)에서 뜻을 띄운다.
  const [term, setTerm] = useState<GlossaryTarget>(null);
  const openTerm = (t: string) => setTerm({ kind: glossaryKindOf(t), key: t });
  const prevRevealed = useRef(false);                    // revealed false→true 전환 감지(문 1회 재생)
  // 콘텐츠 방문 집계(daniel 2026-07-06) — 이 공통 화면을 쓰는 전 콘텐츠(roots/image/mission/crush/job/reunion/future10/child/talent/astrology 등)를 kind 기준 진입 1회 기록.
  useLogContentVisit(kind);
  // ★풀이를 공개(revealed=true)하는 순간 = 골드 명조 문 열림 연출 1회(daniel 07-06). 명식/카테고리 전환 시 revealed 리셋되므로 공개할 때마다 재생.
  useEffect(() => {
    prevRevealed.current = revealed;
  }, [revealed]);

  // 대표 명식 → 서버차트ID → 캐시(category=kind) 조회. 프리미엄이고 캐시 없으면 자동 생성.
  useEffect(() => {
    let alive = true;
    genSeq.current++;   // ① 재로드(진입·명식전환) = 진행 중 generate 무효화(그 결과가 이 화면에 setReading 되지 않게)
    setBusy(false);     // ① 무효화한 gen 의 로딩 상태 정리(자물쇠가 남지 않게)
    setReading(null); setOwned(false); setExpiry(null); setRevealed(false); // 진입/명식 변경 시 초기화 — 미구매 차트가 직전 풀이로 새지 않게(daniel ⓐ) + 상태 뷰 재노출(revealed 리셋: 명식 전환 시 다시 상태 뷰부터, daniel 07-03)
    (async () => {
      // ★M1(재진입 바인딩): 배너/푸시 route(/${kind}?chartId=) 의 chartId → 그 명식을 대표로 1회 전환(reading.tsx 38-43 패턴).
      //   콜드런치 preferSelfAsRep 로 대표가 self 로 리셋돼도 결제한 명식이 뜨게. 중복가드(ref)+이미 대표면 skip(무한전환 방지).
      if (chartIdParam && chartIdParam !== lastAppliedChartId.current) {
        lastAppliedChartId.current = chartIdParam;
        const cs = await listCharts();
        const target = cs.find((sc) => sc.id === chartIdParam) ?? null;
        if (target && (await getRepresentativeId()) !== target.id) await setRepresentative(target.id);
      }
      const ch = await loadRepChart();
      if (!alive) return;
      setSavedChart(ch);
      if (!ch || !session) { onChartResolved?.(null); setLoaded(true); return; } // 명식/세션 없음 → 상대 잠금 키 없음(null)
      const cc = computeChart(ch.input);
      const id = await ensureServerChartId(cc, ch.input, session, ch);
      if (!alive || !id) { onChartResolved?.(null); setLoaded(true); return; } // 서버차트ID 미해석(미로그인 등) → null
      setChartId(id);
      chartIdRef.current = id;   // ① 현재 명식 확정 — 이후 도착하는 generate 결과의 명식 대조 기준
      onChartResolved?.(id); // ★해석된 서버차트ID 통지(재회: 이 명식의 잠긴 상대를 로드/저장)
      // ★★소유·캐시·만료를 **서버 상태 한 번**으로 받는다(ADR-061 · daniel "모바일은 그대로 표출만").
      //   종전엔 여기서 프리미엄·관리자·로컬 언락을 각각 await 하고 readings 도 따로 읽었다 —
      //   판단자가 넷이라 하나가 늦거나 틀리면 화면이 어긋났고, 그중 isAdminActing 은 상한이 없어
      //   07-31 '명식의 뿌리 진행 중…' 멈춤의 범인이었다. 이제 앱은 판단하지 않는다.
      const st = await fetchReadingState(id, kind, category);
      if (!alive) return;
      const cached = st.status === 'ready' ? ((st.data as string) ?? null) : null;
      setOwned(st.status === 'ready' || st.status === 'running' || st.status === 'free'); // 결제를 물어볼 상태가 아니면 소유
      setReading(cached);
      // 보유 만료일(daniel #25): 생성(구매)일 + 1년. 생성일도 서버가 같이 준다(별도 조회 없음).
      const ca = st.status === 'ready' ? st.createdAt : null;
      if (showExpiry && ca) { const d = new Date(ca); d.setFullYear(d.getFullYear() + 1); setExpiry(`${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`); }
      setLoaded(true);
      // ★이어서 만들기(ADR-061): **이미 샀는데 아직 안 만들어진** 상태(running)면 자동으로 생성한다.
      //   종전 조건은 `prem`(프리미엄 명식)이었는데 프리미엄이 폐지돼(07-28) 늘 false = 죽은 코드였다.
      //   새 기준은 daniel 이 말한 그대로다 — "구매 이력 기준으로 추가 구매 또는 **대기**".
      //   이미 결제된 건이라 추가 과금이 없다(서버가 언락을 보고 무료로 만든다).
      //   ★autoGen=false(자식운)면 자동생성 안 함. 명식 2개 이상이면 '어느 명식?' 확인 먼저(daniel 07-13).
      //
      // ★★'대기'와 '이어서 만들기'를 가른다(2026-08-01 · daniel "진행 중에 나갔다 들어오면…").
      //   종전엔 running 이면 **무조건** 자동생성을 걸었다. 그런데 running 에는 '지금 만들어지는 중'도
      //   포함돼 있어서, 재진입할 때마다 **이미 도는 생성 위에 생성을 또 걸었다**(명식 확인 모달까지 다시 떴다).
      //   이제 서버가 live 로 알려준다 — 살아 있으면 손대지 않고 결과만 기다린다(waitForServerGen).
      if (alive && autoGen && st.status === 'running' && !cached) {
        if (st.live) void waitForServerGen(id);   // 서버가 만드는 중 → 트리거하지 말고 로딩만 띄우고 기다린다
        else void autoGenWithChartConfirm({ creditKind: kind as any, onConfirm: () => generate(id, cc.ziwei) }); // 멈춤 → 이어서 만들기
      }
    })().catch(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, isPremium, reloadKey, category, chartIdParam]);

  // 통변 도착(캐시·생성 완료) → 섹션 순차 등장 애니 시작
  useEffect(() => {
    if (reading && !reading.error) {
      reveal.setValue(0);
      Animated.timing(reveal, { toValue: 1, duration: 500 + sections.length * 110, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reading]);

  // ★상대(옛 인연) 등록/변경 시 재생성(daniel 07-05 재회) — regenToken 이 바뀌면 그 상대로 다시 푼다.
  //   · 이미 풀이(캐시)가 있으면 = 상태 뷰 건너뛰고 refresh 로 덮어쓴다(프리미엄=무료 / 비프리미엄=Edge 재차감).
  //     → 프리미엄이 '본인만' 캐시를 보던 버그(상대 추가해도 그대로) 해소: 상대를 넣어 실제 재생성.
  //   · 캐시가 없으면(첫 생성) = 정식 확인·게이트(onStart) 경유 — 상대는 buildBody 로 포함되어 그 상대로 생성된다.
  //   chartId 미해석(미로그인 등)이면 스킵하고 lastRegenTok 을 갱신하지 않아, chartId 세팅 후 재시도되게 둔다.
  const lastRegenTok = useRef(0);
  useEffect(() => {
    if (!regenToken || regenToken === lastRegenTok.current) return;
    if (!chartId) return; // 미해석 — 다음 렌더(chartId 세팅)에서 재시도(lastRegenTok 미갱신)
    lastRegenTok.current = regenToken;
    if (reading) { setRevealed(true); generate(chartId, c?.ziwei, true); } // 캐시 덮어쓰기(refresh) — 상대 반영
    else onStart(); // 첫 생성 — 확인·결제 게이트 경유(상대는 buildBody 포함)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regenToken, chartId]);

  // invoke 타임아웃/실패 시 readings 캐시를 폴링해 결과 회수(Edge가 서버에서 계속 생성·캐시하므로).
  //   무거운 풀이(별자리=사주+점성+수비 3계층 등)는 Edge 생성이 87~103s → 클라 invoke가 먼저 끊겨도('Failed to send request')
  //   서버는 완료·캐시함. 그 캐시를 폴링해 로딩 유지한 채 결과를 받아온다(멈춤·"갑자기 완료" 해결, daniel 07-02).
  async function pollCachedReading(id: string, maxMs = 135000, everyMs = 3500): Promise<any | null> {
    const deadline = Date.now() + maxMs;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, everyMs));
      const { data } = await excludeMock(supabase.from('readings').select('content').eq('chart_id', id).eq('category', category).eq('lang', appLang())).maybeSingle();
      if (data?.content) return data.content;
    }
    return null;
  }

  /**
   * 서버가 **이미 만들고 있는** 풀이를 기다린다 — 생성을 트리거하지 않는다(2026-08-01).
   *
   * 왜 필요한가(daniel: "진행중에 홈으로 나가기 누른 다음 다시 진입하면 로딩화면 초기화되고 api 이중으로 호출"):
   *   재진입은 아주 흔한 동작인데, 그때마다 앱이 생성을 다시 걸면 같은 풀이를 두 번 만들게 된다.
   *   서버가 live=true 로 "지금 내가 만드는 중"이라고 알려주므로, 앱이 할 일은 **로딩을 띄우고 기다리는 것**뿐이다.
   *   결과는 기존 캐시 폴링 경로를 그대로 재사용한다(새 통로를 만들면 또 갈라진다).
   * @param id 서버 명식 id
   */
  async function waitForServerGen(id: string) {
    const myGen = genSeq.current;                                   // 이 대기의 세대(명식 전환 시 폐기 판정)
    const isStale = () => myGen !== genSeq.current || id !== chartIdRef.current;
    setBusy(true);                                                  // 로딩(자물쇠) — 사용자에겐 '만드는 중'으로 보인다
    logEvent(`${kind}_wait_server_gen`, { chartId: id });
    const cached = await pollCachedReading(id);
    if (isStale()) return;                                          // 기다리는 사이 명식이 바뀜 → 폐기
    if (cached) { setReading(cached); setRevealed(true); await markUnlocked(id, kind); }
    setBusy(false);                                                 // 못 받았으면 로딩만 걷는다 — 소유 상태 뷰('이어서 만들기')로 돌아간다
  }

  // 순수 생성(LLM) — 게이트는 Edge(SERVER_GATED consume_credit / effPrem)가 권위. idArg/ziweiArg = 자동생성용(state 갱신 전 직접 전달).
  //   ★C3 part2(daniel 2026-07-03): 클라는 이용권을 차감하지 않는다 — Edge 가 1회 차감/판정(이중차감 제거).
  //   이용권 없으면 Edge 가 needPayment(200) 반환 → 구매 플로우(promptPurchase)로 유도. 생성 성공 시에만
  //   markUnlocked(캐시 힌트) — 게이트가 아니라 재열람 시 owned 표시·재차감 없음.
  async function generate(idArg?: string, ziweiArg?: any, refreshArg = false) {
    const id = idArg ?? chartId;
    if (!id || busy) return;
    // ② 크로스마운트 이중 LLM 방지 — 이미 이 명식·이 콘텐츠(category)가 생성 중이면 2차 호출하지 않는다(과금 0·프리미엄 자동생성 경로도 포함).
    const lockKey = `${category}:${id}`; // category = 콘텐츠 캐시 단위(roots·celeb_{id} 등)
    const myGen = genSeq.current;    // ① 이 생성의 세대 스냅샷(읽기만) — 재로드/명식전환(load effect)이 genSeq 를 올리면 stale
    const myChart = id;              // ① 대상 명식
    const isStale = () => myGen !== genSeq.current || myChart !== chartIdRef.current; // ① 결과 쓰기 직전 대조 — 남의 명식 위에 setReading 차단
    // A4(daniel 2026-07-08): 이미 다른 마운트가 이 명식·콘텐츠를 생성 중(잠금 점유)이면 2차 LLM은 막되(과금 0),
    //   화면은 로딩으로 두고 캐시를 폴링해 완료 시 결과 회수. 예전엔 여기서 조용히 return → 오버레이·에러·로딩 없이 '멈춤'(홈도 못 감)이었다.
    if (!acquireGen(lockKey)) {
      setBusy(true);
      const cached = await pollCachedReading(id);
      if (isStale()) return;
      if (cached) { setReading(cached); await markUnlocked(id, kind); }
      setBusy(false);
      return;
    }
    setBusy(true);
    setOwned(true); // 낙관적: 생성 진행 = 소유 표시(생성 애니). needPayment 면 아래에서 되돌림.
    // ③ 배너/푸시 명식 식별 — route 에 chartId(로컬 savedChart.id) + chartLabel.
    //    재진입 바인딩(이 param → 대표 전환)은 ★M1 로 이 컴포넌트 load effect 상단에 구현됨 — 소비 라우트(reunion/crush/job/child/roots/image/mission/talent/astrology/future10) 공통(reading.tsx 38-43 패턴).
    const gpRoute = savedChart?.id ? `/${kind}?chartId=${savedChart.id}` : ('/' + kind);
    setGenProgress({ active: true, total: 1, done: 0, label: title, chartLabel: savedChart?.label, route: gpRoute }); // 일회성 진행도(daniel 이슈15) — '풀이 중'
    logEvent(`${kind}_invoke_start`, { chartId: id });
    let ok = false; // ★L2: 실제 성공(정상 reading 객체) 여부 — 완료 배너·푸시는 이때만(오완료 '완성' 푸시 방지)
    try {
      const body: any = { chartId: id, category, kind, tier: 'paid', lang: appLang() };
      if (refreshArg) body.refresh = true; // ★캐시(본인만) 덮어쓰기(daniel 07-05 재회 상대 재등록) — Edge 가 REGEN_CAP 내 재생성(프리미엄=무료 / 비프리미엄=재차감). refresh 계약은 ReadingScreen 갱신과 동일.
      if (needsZiwei) body.ziwei = ziweiArg ?? c?.ziwei; // 사명 = 자미 보조 교차
      // ★R60 애정 이원분석(daniel 스펙 v0.2.0) — 온디바이스 판정 결과를 body 로.
      //   판정은 앱 엔진이 끝내고 Edge 는 서술만 한다(엔진 사본을 Edge 에 두면 표가 두 벌이 된다).
      //   게이트가 STAR_PALACE_ONLY 면 buildRomanceMirror 가 경상 프로파일을 **빼고** 준다.
      if (['love', 'reunion', 'crush'].includes(kind) && c?.saju) {
        const rm = buildRomanceMirror(c.saju, savedChart?.input?.sex === '여' ? '여' : '남');
        if (rm) body.romance = rm;
      }
      if (buildBody && savedChart) Object.assign(body, buildBody(savedChart)); // 수비학/점성술 = 앱 산출 차트(numerologyChart/natalChart)
      // ★★상한(2026-07-31): `functions.invoke` 도 기본 타임아웃이 없다. 회선이 끊긴 채로 응답이 안 오면
      //   이 await 가 영원히 안 끝나 `finally` 가 실행되지 않고 → 버튼이 '진행 중…'에 붙박인다(멈춤).
      //   ⚠️짧게 끊으면 안 된다 — 실제 통변은 20~40초 걸린다. 넉넉히 두되 **반드시 끝나게** 한다.
      //   초과하면 아래 `error || !data` 분기로 떨어져 **이미 있는 캐시 폴링 회수**를 탄다
      //   (Edge 는 클라 연결과 무관하게 서버에서 끝까지 실행되므로 결과는 캐시에 남는다) = 사용자 손해 0.
      const inv = await withTimeout(supabase.functions.invoke('interpret', { body }), GEN_TIMEOUT_MS);
      const { data, error } = inv ?? { data: null, error: { message: 'client timeout' } as any };
      if (isStale()) return;   // ① 생성 사이 명식 전환됨 → 폐기(promptPurchase·setReading 모두 안 함)
      // ★C3 part2: 서버 게이트가 이용권 없음 판정 → needPayment(200) → 소유 되돌리고 구매 플로우(에러 표시 아님).
      if ((data as any)?.needPayment || (data as any)?.needPremium) {
        setOwned(false); setBusy(false); setGenProgress({ route: gpRoute, active: false });
        logEvent(`${kind}_need_payment`, { chartId: id });
        void promptPurchase(id, refreshArg); // ★refresh 유지 — 결제 후 재시도도 캐시 덮어쓰기여야(재회 상대 반영). 아니면 stale 캐시(본인만)를 서빙.
        return;
      }
      if (error || !data) {
        // ★클라 invoke가 끊겨도(무거운 풀이 타임아웃) Edge는 서버에서 완료·캐시 → 캐시 폴링으로 회수(로딩 유지).
        logEvent(`${kind}_invoke_error`, { message: error?.message ?? 'no data', polling: true }, 'error');
        const cached = await pollCachedReading(id);
        if (isStale()) return;   // ① 폴링 사이 명식 전환됨 → 폐기
        if (cached) { setReading(cached); await markUnlocked(id, kind); ok = true; } // 서버가 완료·캐시 = 생성 성공(차감됨) → 캐시 힌트
        else setReading(readingFromInvoke(data, error));
      } else if ((data as any)?.code === 'llm_busy') {
        // ★서버 단일화 락에 걸렸다 = **다른 워커가 지금 이 풀이를 만들고 있다**(2026-08-01).
        //   이건 오류가 아니라 '조금만 기다리면 나온다'는 뜻이다. 오류 문구를 띄우면
        //   사용자는 실패한 줄 알고 다시 누른다 → 그게 또 트리거가 된다. 조용히 결과를 기다린다.
        logEvent(`${kind}_llm_busy`, { chartId: id });
        const cached2 = await pollCachedReading(id);
        if (isStale()) return;
        if (cached2) { setReading(cached2); await markUnlocked(id, kind); ok = true; }
        else setReading(readingFromInvoke(data, error));
      } else if ((data as any)?.unavailable) {
        logEvent(`${kind}_unavailable`, { retryAt: (data as any)?.retryAt }, 'error'); // 방어: LLM 일시적 불가(미차감·재시도)
        setReading(readingFromInvoke(data, error));
      } else {
        const r = readingFromInvoke(data, error); // 정상 도착
        setReading(r);
        // ★목업(source='mock')은 소유 힌트를 남기지 않는다(daniel 2026-08-05 "테스트 통변은 구매 이력 0·다음엔 재요청").
        //   서버도 차감·언락·저장을 전부 스킵하므로, 여기 로컬 힌트까지 막아야 재진입 시 다시 '구매하고 보기'가 뜬다.
        const isMock = (data as any)?.source === 'mock';
        if (r && !r.error && !isMock) { await markUnlocked(id, kind); ok = true; }
        else if (isMock) { ok = true; } // 화면 표시는 정상 완료(진행 배너만 정리)
      }
    } catch (e) {
      // fetch throw(타임아웃 등)도 동일 — 서버가 완료·캐시했으면 폴링으로 회수, 아니면 오류 표시.
      logEvent(`${kind}_invoke_throw`, { message: (e as Error).message }, 'error');
      const cached = await pollCachedReading(id);
      if (isStale()) return;
      if (cached) { setReading(cached); await markUnlocked(id, kind); ok = true; } // 서버 완료·캐시 = 성공 → 캐시 힌트
      else setReading({ error: (e as Error).message });
    } finally {
      releaseGen(lockKey);   // ② 완료·중단·오류·폐기 모두 잠금 해제
    }
    if (isStale()) return;   // ① 완료 처리도 현재 명식일 때만
    // ★L2: 실제 성공만 완료 전이(배너+완료 푸시). 실패(오류·폴링실패·unavailable)면 배너 제거 → 오완료 '완성' 푸시 방지(needPayment 처리와 통일).
    if (ok) {
      setGenProgress({ route: gpRoute, done: 1, total: 1 }); // 완료 → 홈 배너 '풀이 보기' 이동버튼(daniel 이슈15)
      // ★생성 성공 = 바로 공개(daniel 07-26 순서 이상 ②): 예전엔 revealed 가 false 로 남아 방금 결제·생성한
      //   직후에도 "이미 열려 있는 풀이예요" 상태 뷰가 다시 뜨고 '풀이 보기'를 또 눌러야 했다.
      //   상태 뷰는 *재방문*에서만 의미가 있다.
      setRevealed(true);
    }
    else setGenProgress({ route: gpRoute, active: false });
    setBusy(false);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ★열람 플로우 재설계(daniel 2026-07-26 IMG_8190~8192 "순서가 이상해 / 진행 중일 땐 다른 행동 못하게 /
  //   결제 취소·실패·앱 강제종료·네트워크 끊김도 대응")
  //
  // 예전 순서의 문제 3가지:
  //   ①**순서 역전** — 미구매인데 `onStart` 가 *명식 확인 모달부터* 띄우고, 확인 후 `doStart` 에서야 크레딧을
  //     보고 구매 모달을 띄웠다 → 살지 말지도 안 정한 사람에게 명식을 먼저 묻고 **모달 2연타**.
  //   ②**불필요한 1탭** — 결제·생성이 끝나도 `revealed` 가 false 라 "이미 열려 있는 풀이예요" 상태 뷰가 다시
  //     뜨고 '풀이 보기'를 또 눌러야 했다.
  //   ③**문구 모순** — 이미 소유한 사람의 확인 모달에도 "보유 이용권 0개"가 떴다.
  //
  // 새 순서: **소유 판정 → (미소유면) 구매 → 명식 확인 → 생성 → 즉시 공개.**
  //   전 구간을 하나의 async 플로우로 직렬화하고 `flowRef` 로 잠근다 → 진행 중 다른 조작이 끼어들지 못한다.
  //   ⚠️차감·게이트의 권위는 여전히 **Edge**(consume_credit). 클라 판정은 UX 순서용이며, 서버가 needPayment 를
  //     주면 generate 가 promptPurchase 로 되돌린다(이중차감 없음·멱등).
  // ─────────────────────────────────────────────────────────────────────────
  function onStart() { void runFlow(); }



  /**
   * 진입 CTA('구매하고 보기' / '풀이 보기' / '이어서 풀이 만들기')의 **단일 경로**.
   * 소유 판정 → (미소유) 구매 → 명식 확인 → 생성 → 공개. 어느 단계에서 빠져나가도 잠금은 finally 에서 해제.
   */
  async function runFlow(): Promise<void> {
    // 진행 중이면 무시 — 단, 오래 걸려 있으면(Alert 콜백 유실 등) stale 로 보고 회수한다.
    if (flowRef.current && Date.now() - flowRef.current < FLOW_STALE_MS) return;
    if (busy) return;                                                        // 이미 생성 중(자물쇠)
    flowRef.current = Date.now();
    setFlowBusy(true);
    try {
      if (!chartId) return;
      logEvent(`${kind}_generate_tap`, { chartId });
      if (!assertOnline(t)) return;                                          // 네트워크 없음 → 사전 차단(경고)
      if (!requireLoginForPurchase(session, () => router.push('/login'), t)) return;

      // ★★①상태는 **서버가 정한다**(ADR-061). 앱은 그 결과로 분기만 한다.
      //   종전엔 프리미엄·관리자·로컬언락·잔액을 앱이 각각 조회해 판단했다 — 그 네 개의 await 가
      //   전부 멈춤 후보였고, 실제로 여러 번 멈췄다. 지금은 왕복 한 번이고 실패도 값으로 온다.
      const st = await fetchReadingState(chartId, kind, category);
      if (st.status === 'error') {                                           // 확인 불가 ≠ 미구매. 결제를 권하지 않는다.
        logEvent(`${kind}_state_error`, { reason: st.reason }, 'error');
        Alert.alert(t('common.error'), t('common.retryLater', '잠시 후 다시 시도해 주세요.'));
        return;
      }
      if (st.status === 'topup') {                                           // 잔액 부족 — 서버 판정
        Alert.alert(
          t('coins.needTitle', '운이 조금 모자라요'),
          t('coins.needMsg', { need: st.cost, have: st.balance, defaultValue: '이 풀이는 {{need}} 운이 필요해요. 지금 {{have}} 운 있어요.' }),
          [{ text: t('common.cancel'), style: 'cancel' },
           { text: t('coins.charge', '운 충전하기'), onPress: () => router.push('/coins') }],
          () => {},                                                          // 뒤로가기로 닫아도 안전(대기 Promise 없음)
        );
        return;
      }
      // ★서버가 이미 만들고 있으면 **또 만들지 않는다**(2026-08-01). 명식 확인도 묻지 않는다 —
      //   물어봐야 할 게 없다. 이미 결정된 생성이 돌고 있으니 로딩을 띄우고 결과만 받으면 된다.
      if (st.status === 'running' && st.live) { await waitForServerGen(chartId); return; }
      const ownedNow = st.status !== 'purchase';                             // purchase 일 때만 결제를 묻는다

      // ③ 이제 명식 확인. ★소유 경로면 creditKind 를 넘기지 않아 "보유 이용권 N개" 문구가 뜨지 않는다.
      const ok = await requestChartConfirm({ creditKind: ownedNow ? undefined : (kind as any) });
      if (!ok) return;
      // 확인 모달 dismiss 완료 후 생성 시작 — iOS 는 Modal 을 한 번에 하나만 present(자물쇠가 안 뜨던 문제).
      await new Promise((r) => setTimeout(r, 380));

      // ④ 생성 — 차감·게이트 권위는 Edge. 여기서 크레딧을 깎지 않는다.
      await generate(chartId);
    } catch (e) {
      logEvent(`${kind}_flow_error`, { message: (e as Error).message }, 'error');
    } finally {
      flowRef.current = 0;
      setFlowBusy(false);
    }
  }

  // 구매 유도 — 서버 게이트(Edge)가 needPayment 를 반환했을 때만 호출(클라 차감 없음).
  //   차감은 서버(Edge)가 생성 직전에 한다. 부족하면 게이트가 충전 화면으로 보낸다. id = 재생성 대상 명식.
  //
  // ★★중간 알림을 걷어냈다(daniel 2026-08-12 *"다른 유료 콘텐츠도 사용후 남은운이 얼마가 되는지
  //   나와야해 없을경우 충전창으로 이동시켜야하고"*).
  //   종전엔 여기서 **숫자가 하나도 없는** 알림을 먼저 띄웠다 —
  //     "운이 필요해요. 지금 운으로 열거나, 마켓에서 충전할 수 있어요."
  //   가격도·보유 운도·사용 후 남는 운도 없이 '운 사용'을 누르라고 했고, 누른 **뒤에야**
  //   `ensureCoinsFor` 가 숫자를 보여 줬다. 이 화면 하나가 **유료 18종**을 담당하므로
  //   "유료인데 얼마 남는지 안 보인다"가 여기서 대량으로 생겼다.
  //   ⇒ 게이트를 **바로** 부른다. 게이트가 이미 셋을 다 한다:
  //      ①`{cost} 운을 사용해…  보유 {have} 운 → 사용 후 {after} 운`
  //      ②부족하면 '운 충전하기' → 충전 화면  ③조회 실패는 '부족'과 구분(재결제 유도 방지)
  //   ★알림이 하나로 줄어 **모달 연속 present** 위험도 함께 준다([[alert-double-fire-crash]]).
  //   ※'마켓에서 보기'는 뺐다 — 부족할 때 갈 곳은 충전 화면이고, 게이트가 그리로 보낸다.
  async function promptPurchase(id?: string, refresh = false) {
    const g = await ensureCoinsFor(kind, { title, t, goCharge: () => router.push('/coins'), chartId });
    if (g === 'ok') generate(id, undefined, refresh);   // refresh 유지(재회 상대 재등록 후 캐시 덮어쓰기)
  }

  // 동적 폰트 스케일이 필요한 StyleSheet 정적값 대체 — StyleSheet.create는 렌더 밖이라 fs()를 직접 쓸 수 없음.
  const dynStyles = {
    secLabel:    { fontSize: fs(16) },
    groupTitle:  { fontSize: fs(18), lineHeight: 26 },
    err:         { fontSize: fs(13) },
    msg:         { fontSize: fs(15) },                       // font.body 기본값
    gateTitle:   { fontSize: fs(17) },                       // font.heading 기본값
    gateDesc:    { fontSize: fs(15), lineHeight: 22 },   // font.body + lineHeight
    gateNote:    { fontSize: fs(12) },                       // font.caption 기본값
    previewHead: { fontSize: fs(13) },
    previewItem: { fontSize: fs(14), lineHeight: 24 },
    ctaTx:       { fontSize: fs(16) },
  };
  const n = sections.length;

  // 넓은 웹에서만 본문을 좁힌다(히어로·명식 헤더는 지면 전체를 쓴다)
  // ⚠️★이 훅은 **조기 return 위**에 있어야 한다(2026-08-19 크래시 수정).
  //   종전엔 `if (!loaded) return …` **아래**에 있었다 → 로딩 중에는 훅이 하나 적게 돌고
  //   로드가 끝나면 하나 늘어나 React 가 **"Rendered more hooks than during the previous render"** 로 터졌다.
  //   증상: 별자리·이미지 등 이 컴포넌트를 쓰는 화면이 열리자마자 「화면을 그리다 문제가 생겼어요」.
  //   ★훅은 **컴포넌트 맨 위에서 무조건** 부른다 — 조건·조기 return 뒤에 두지 않는다(React 규칙 1).
  const webBody = useReadBody();   // ★본문 캡 단일 소스(WebShell) — 17개 화면과 같은 값을 쓴다

  if (!loaded) return <View style={styles.center}><ActivityIndicator color={colors.ju} /></View>;

  if (!savedChart) return (
    <View style={styles.center}>
      <Text style={[styles.msg, dynStyles.msg]}>{t('manse.empty')}</Text>
      <PressableScale style={styles.cta} onPress={() => router.push('/register')}><Text style={[styles.ctaTx, dynStyles.ctaTx]}>{t('compat.registerMyChart')}</Text></PressableScale>
    </View>
  );

  // ★전체화면 오버레이(자물쇠·문열림·결제준비)는 **ScrollView 밖**에 둔다
  //   (daniel 2026-08-04 "풀이할 때 자물쇠가 가운데로 가게 스크롤 옮겨야지").
  //   종전엔 ScrollView **안**에 있었다 — StyleSheet.absoluteFill 은 스크롤 *콘텐츠* 기준이라
  //   자물쇠가 콘텐츠 맨 위에 붙었다. 아래로 스크롤해 '구매하고 보기'를 누른 뒤라면
  //   자물쇠는 화면 위쪽 바깥에 그려져 **보이지도 않았다**(가운데가 아니라 아예 안 보임).
  //   부모 View 의 자식으로 빼면 뷰포트를 덮어 언제나 화면 한가운데에 뜬다.
  return (
    <View style={{ flex: 1 }}>
    <ScrollView
      style={styles.screen} contentContainerStyle={styles.wrap}
      // ★공통 콘텐츠 틀이라 여기 한 줄이 이 틀을 쓰는 모든 화면을 덮는다(재회 '지금의 고민' 등 하단 입력).
      //   키보드가 입력창을 가리지 않게 iOS 자동 인셋(daniel 07-18 표준 · check:keyboard 가 강제).
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled"
    >
      {/* 상단 명식 헤더 — 현재 적용된 대표 명식 표시·전환(daniel: 모든 콘텐츠 상단). 전환 시 그 명식 기준 재로드 */}
      {/* ★진행 중 명식 전환 차단 — 결제/생성 대상이 도중에 바뀌면 어긋난다(genSeq 가 폐기하긴 하나 혼란). */}
      <ChartPicker onChange={() => { if (!flowBusy && !busy) setReloadKey((k) => k + 1); }} />
      {/* ★결제 준비 오버레이(daniel 07-24) — '바로 구매' 탭 후 애플 결제창 뜨기까지·웹훅 적립까지 무피드백 방지(자물쇠는 생성 단계에서) */}
      <Modal visible={purchasing} transparent animationType="fade" statusBarTranslucent onRequestClose={() => {}}>{/* Android 뒤로가기 무시(결제 진행 중 닫힘 방지) — 의도 */}
        <View style={styles.payWrap}><View style={styles.payCard}>
          <ActivityIndicator color={colors.gold} size="large" />
          <Text style={[styles.payTx, { fontSize: fs(15) }]}>{t('special.preparingPayment', '결제 준비 중…')}</Text>
        </View></View>
      </Modal>
      <ContentHero motif={heroMotif} image={heroImage ?? HERO_BY_KIND[kind]} title={title} sub={sub} themeColor={themeColor} />

      {/* ★본문 컬럼(29CM/브런치 방향) — **히어로는 지면 전체, 글은 좁게**.
          긴 풀이를 1000px 로 흘리면 눈이 다음 줄을 놓친다. 폰에서는 undefined 라 그대로 지나간다.
          ★이 틀 하나가 **콘텐츠 화면 31개**를 덮는다. */}
      <View style={webBody}>

      {/* ★무료 온디바이스 티저(재회 도화-충 달력 등) — 히어로 바로 아래. ★유료 전환 후크라 '미소유(잠김)'일 때만 노출(daniel 2026-07-24 재개정):
          유료로 열린 뒤에도 티저의 "무료로 짚어 봤어요/지금은 미리보기예요/아래에서 열 수 있어요" 문구가 남아 구매 상태와 모순됐다(IMG_8168·freeHook 쓰는 12개 유료콘텐츠 공통).
          owned(구매·프리미엄·관리자)면 숨김 → 전체 풀이만 노출(전환 후크는 미소유일 때만 의미). c.saju에 timeUnknown 을 코드베이스 관례(prewarm/Reading)와 동일하게 병합해 전달. */}
      {freeHook && c?.saju && !owned ? freeHook({ ...c.saju, timeUnknown: savedChart?.input?.timeAccuracy === '미상' }) : null}

      {/* 콘텐츠별 상단 커스텀 컨트롤(옵션) — 히어로 아래·상태 뷰/게이트 위. ★풀이를 실제로 공개(revealed)한 뒤엔 숨김 — 상태 뷰·게이트(공개 前)에서는 계속 노출(자식운 COUPLE 토글은 생성 前에만 의미, daniel 07-03).
          단 keepHeaderExtra(재회)=공개 후에도 계속 노출: 잠긴 상대 표시·'상대 바꾸기'를 풀이 보면서도 쓸 수 있게(daniel 07-05). */}
      {(keepHeaderExtra || !(reading && owned && revealed)) && headerExtra}

      {reading?.error ? (
        <View style={styles.card}><Text style={[styles.err, dynStyles.err]}>{String(reading.error)}</Text></View>
      ) : (owned && !revealed) ? (
        // ★상태 뷰(daniel 07-03): 소유(프리미엄/구매/관리자) 풀이라도 바로 노출하지 않고
        //   '이미 열려 있음 + (일반 계정) 만료일' 상태를 먼저 보여준 뒤 '풀이 보기'로 공개(관리 편의·구매이력 인지).
        //   reading 유무와 무관하게 진입 — 캐시가 있으면 '풀이 보기'가 즉시 공개, 없으면 생성까지 트리거(소유 경로라 재차감 없음).
        // ★소유 진입 카드 리디자인(daniel 2026-07-25 IMG_8183 '풀이로 넘어가는 부분') — 점선(미완성 느낌)→솔리드 프리미엄 카드.
        //   ✓ 소유 뱃지 + 제목 + 상태 한 줄(제목과 중복되던 '구매한 풀이예요' 문구 교체) + 풀 폭 '풀이 보기 ›' CTA. themeColor=콘텐츠 정체색.
        <View style={[styles.ownedCard, { borderColor: themeColor + '55' }]}>
          <View style={[styles.ownedBadge, { backgroundColor: themeColor + '22', borderColor: themeColor + '66' }]}>
            <Text style={[styles.ownedBadgeTx, { color: themeColor }]}>✓</Text>
          </View>
          {/* ★중단 감지(daniel 07-26 "앱 강제종료·네트워크 끊김도 대응"): 소유인데 풀이가 없으면 = 결제는 됐고
              생성이 끊긴 상태. 문구를 바꿔 "또 결제해야 하나?" 오해를 없애고 재차감 없이 이어감을 명시한다. */}
          <Text style={[styles.ownedTitle, dynStyles.gateTitle]}>
            {reading ? t('special.ownedTitle', '이미 열려 있는 풀이예요') : t('special.ownedResumeTitle', '결제는 끝났어요 — 풀이만 남았어요')}
          </Text>
          {/* 상태 한 줄 — 만료일이 있으면 만료일, 없으면 구매완료.
              ★프리미엄 분기 제거(ADR-061): 프리미엄은 07-28 에 폐지돼 늘 false 였고(죽은 분기),
                무엇보다 **앱이 소유를 판정하는 코드**라 새 구조와 충돌한다(판단은 서버 한 곳). */}
          {!reading ? (
            <Text style={[styles.ownedStatus2, dynStyles.gateDesc]}>{t('special.ownedResumeSub', '생성이 중단됐어요. 추가 결제 없이 이어서 만들어 드려요')}</Text>
          ) : (showExpiry && expiry) ? (
            <Text style={[styles.ownedStatus2, dynStyles.gateDesc]}>{t('special.ownedUntil', { date: expiry, defaultValue: '{{date}}까지 볼 수 있어요' })}</Text>
          ) : (
            <Text style={[styles.ownedStatus2, dynStyles.gateDesc]}>{t('special.ownedBoughtV2', '구매 완료 · 언제든 다시 볼 수 있어요')}</Text>
          )}
          {/* 풀 폭 '풀이 보기 ›' — revealed 전환(캐시 즉시 공개). 캐시 없으면 onStart(소유 경로: 프리미엄/unlock/관리자 → generate만, 재차감 없음). */}
          {/* ★flowBusy 동안 비활성 — 진행 중 재탭으로 플로우가 겹치지 않게(daniel: 진행중일 땐 다른 행동 못하게). */}
          <PressableScale
            style={[styles.ownedCta, { backgroundColor: themeColor }, flowBusy && styles.ctaDisabled]}
            disabled={flowBusy}
            onPress={() => { setRevealed(true); if (!reading) onStart(); }}
          >
            <Text style={[styles.ctaTx, dynStyles.ctaTx]}>
              {flowBusy ? t('special.working', '진행 중…') : reading ? t('special.viewCta', '풀이 보기') : t('special.resumeCta', '이어서 풀이 만들기')}
            </Text>
            {!flowBusy && <Text style={[styles.ctaTx, dynStyles.ctaTx, styles.ownedCtaArrow]}>›</Text>}
          </PressableScale>
        </View>
      ) : (reading && owned && revealed) ? (
        <>
        {/* 풀이 보유 만료일(daniel #25) — 캐시(생성된 풀이) + 유료 단일(showExpiry)일 때만. 소모성·무료는 showExpiry 미전달이라 미노출. */}
        <ExpiryNote expiry={showExpiry ? expiry : null} chartId={chartId} />
        {/* 이슈19 소제목 → ★한 줄 결론 배지(가독성 P0 축2 — 본문에 묻히던 headline 을 좌측바+틴트 카드로·콘텐츠 테마색) */}
        {typeof reading.headline === 'string' ? <ReadingHeadline text={reading.headline} accent={themeColor} /> : null}
        {/* ★핵심 3줄(가독성 P1) — 신규 생성분에만 있는 points. 없으면 미표시(기존 저장 풀이 하위호환) */}
        <ReadingPoints points={reading.points} accent={themeColor} />
        {/* ★근본 '풀이 안 보임'(daniel 07-11): LLM이 구조화 JSON을 못 내면 Edge가 {base:텍스트}로 폴백 → 구조화 섹션 키가 비어 화면이 텅 빔. base 있으면 통째로 표시(무표시 방지). */}
        {/* ★가독성 P0(2026-07-26): 통짜 <Text> → ReadingProse(문단화·시기/명리어 강조·행간 1.75). 내용 불변, 표현만.
            폴백 base 는 여러 섹션이 한 덩어리로 뭉친 *가장 긴* 본문이라 접이식(collapsible)을 켠다. */}
        {typeof reading.base === 'string' && reading.base.trim() ? (
          <Animated.View style={[styles.card, { borderLeftColor: themeColor }, styles.cardAccent, cardAnim(reveal, 0, 1)]}>
            <ReadingProse text={reading.base} accent={themeColor} collapsible onTermPress={openTerm} />
          </Animated.View>
        ) : sections.map((s, i) => (typeof reading[s.key] === 'string' && reading[s.key] ? (
          <View key={s.key}>
            {/* 그룹 구분 헤더(daniel: 별자리/점성술 섹터 분리) — groupTitle 있으면 카드 위 divider+제목 */}
            {s.groupTitle ? <Text style={[styles.groupTitle, { color: themeColor }, dynStyles.groupTitle]}>{s.groupTitle}</Text> : null}
            <Animated.View style={[styles.card, { borderLeftColor: themeColor }, styles.cardAccent, cardAnim(reveal, i, n)]}>
              <Text style={[styles.secLabel, { color: themeColor }, dynStyles.secLabel]}>{s.label}</Text>
              <ReadingProse text={reading[s.key]} accent={themeColor} onTermPress={openTerm} />
            </Animated.View>
          </View>
        ) : null))}
        {/* daniel(2026-06-24): 풀이 음성으로 듣기(온디바이스 TTS·무료) */}
        <TTSButton reading={reading} sections={sections} />
        {/* 이슈17: 이 풀이 공유(앱 설치자만 열람) — roots/image/mission 등 공통 */}
        <ShareReadingButton kind={kind} title={title} content={reading} />
        </>
      ) : (
        // 잠김(미생성) — 스페셜은 쿠폰(이용권)/관리자로 unlock(결제 미연동)
        <View style={[styles.card, styles.gate, { borderColor: themeColor }]}>
          <Text style={[styles.gateTitle, dynStyles.gateTitle]}>{title}</Text>
          <Text style={[styles.gateDesc, dynStyles.gateDesc]}>{sub}</Text>
          {/* 무료 티어(하이브리드) — 온디바이스 기본값 먼저 보여주고(API 0) 심층은 유료로 유도(daniel) */}
          {freePreview && savedChart ? freePreview(savedChart) : null}
          {/* 미리보기 — 사람들이 궁금해할 핵심 항목들을 보여주고 unlock 유도(daniel) */}
          <View style={styles.previewBox}>
            <Text style={[styles.previewHead, { color: themeColor }, dynStyles.previewHead]}>{t('special.previewHead', '이런 걸 풀어드려요')}</Text>
            {sections.filter((s) => s.key !== 'summary').map((s) => <Text key={s.key} style={[styles.previewItem, dynStyles.previewItem]}>· {s.label}</Text>)}
          </View>
          {/* owned(프리미엄/관리자/unlock)면 '풀이 보기'(구매 아님) — 자식운은 위 토글로 단일/부부 고른 뒤 이 버튼으로 생성(daniel 07-03) */}
          {/* ★flowBusy 동안 비활성(daniel 07-26) — 결제·확인·생성 플로우가 겹쳐 시작되지 않게. */}
          <PressableScale style={[styles.cta, { backgroundColor: themeColor }, flowBusy && styles.ctaDisabled]} disabled={flowBusy} onPress={onStart}>
            <Text style={[styles.ctaTx, dynStyles.ctaTx]}>{flowBusy ? t('special.working', '진행 중…') : owned ? t('special.viewCta', '풀이 보기') : t('special.unlockCta', '구매하고 보기')}</Text>
          </PressableScale>
          {!owned ? (
            <>
              <Text style={[styles.gateNote, dynStyles.gateNote]}>{t('special.unlockHint', '운으로 열려요')}</Text>
              {/* 상점 이동 버튼(daniel 07-07): 쿠폰 없을 때 마켓으로 바로 이동 — 안내만 있고 버튼 없던 것 보완.
                  ★2026-07-27: `focus=kind` 를 실어 **그 상품 카드까지 스크롤·강조**(daniel "바로 그거 구매 위치로 이동돼야 해").
                  이전엔 마켓 최상단으로만 가서 35개 목록에서 다시 찾아야 했다(주제 필터가 걸려 있으면 더 어려움). */}
              <PressableScale style={styles.goMarketBtn} onPress={() => router.push({ pathname: '/market', params: { focus: kind } })}>
                <Text style={[styles.goMarketTx, dynStyles.ctaTx]}>{t('special.goMarketBtn', '상점으로 이동 ›')}</Text>
              </PressableScale>
            </>
          ) : null}
        </View>
      )}
      {/* 연관 콘텐츠 자동 추천(daniel 기획서) — 잠김/열림 무관 하단 크로스셀(API 0) */}
      <RelatedContent kind={kind} />
      {/* 명리 용어 설명(가독성 P2) */}
      <GlossarySheet target={term} onClose={() => setTerm(null)} />
      </View>
    </ScrollView>
    {/* ↓ 스크롤 밖 = 뷰포트 기준. 자물쇠·문열림이 항상 화면 한가운데에 뜬다. */}
    {/* child/child_couple(자녀운)만 전용 테마 영상 — 그 외 스페셜(roots·image·mission·talent·astrology·future10 등)은 videoKey 미지정=기본 링+자물쇠 */}
    <UnlockOverlay visible={busy} message={genMsg} videoKey={(kind === 'child' || kind === 'child_couple') ? 'child' : undefined} />
    </View>
  );
}

// 섹션 순차 등장(stagger) — index 기반으로 reveal 진행을 잘라 카드별 딜레이. love/newyear 등 다른 화면도 재사용.
export function cardAnim(reveal: Animated.Value, i: number, n: number) {
  const start = i / (n + 1), end = (i + 1) / (n + 1);
  return {
    opacity: reveal.interpolate({ inputRange: [start, end], outputRange: [0, 1], extrapolate: 'clamp' }),
    transform: [{ translateY: reveal.interpolate({ inputRange: [start, end], outputRange: [16, 0], extrapolate: 'clamp' }) }],
  };
}

// 상단 히어로 — **시안 톤**(밝은 색면 + 아치 + 먹/강조 글자). love/newyear 등 다른 화면도 재사용(export).
// ═══════════════════════════════════════════════════════════════════════════
// ★2026-08-19 daniel *"상세 화면들도 시안톤으로 다 바꿔"* — 이 한 컴포넌트가 상세 19화면의 길목이다.
//
// [before] 어두운 사진이 꽉 차고 그 위에 **검은 스크림 + 흰 글자**(미디어 히어로).
//          앱 전체가 파스텔로 바뀌자 이 히어로만 홀로 어두워 화면마다 결이 끊겼다.
// [after ] 시안 p10·p11 의 풀이 히어로와 같은 결 —
//          **오행 색면 그라데이션 + 아치 곡선 + 강조색 제목**. 글자는 먹, 배경은 밝다.
//
// ■ 사진은 버리지 않고 **아주 옅게 뒤에 남긴다**(opacity 0.08)
//   그림이 있으면 '무엇에 관한 화면인지'가 한눈에 오고, 없으면 19화면이 전부 똑같아 보인다.
//   ⚠️0.08 은 눈대중이 아니라 **계산한 값**이다 — 사진이 최악(완전 검정)이어도 그 위 제목(`ju`) 대비가
//     다섯 오행 전부 4.5 를 넘는 최대치다. 0.10 이면 水 가 4.34 로 떨어진다.
//     처음엔 0.14 로 잡았다가 계산해 보고 내렸다(3.96 이었다). `check:herotone` 이 지킨다.
//
// ■ 아치는 `ReadingHero` 와 같은 모양이되 **점은 없다**
//   거기 점은 '내 오행 지도'라는 뜻이 있고, 여기엔 그 데이터가 없다. 뜻 없는 장식은 넣지 않는다.
// ═══════════════════════════════════════════════════════════════════════════

/** 히어로 사진의 불투명도 — 이 위에 먹 글자가 올라간다. `check:herotone` 이 대비를 계산해 지킨다. */
export const HERO_PHOTO_OPACITY = 0.08;

export function ContentHero({ motif, image, title, sub, themeColor = colors.ju }: { motif?: ReactNode; image?: any; title: string; sub: string; themeColor?: string }) {
  const { fs } = useFontScale();
  const heroCap = useHeroCap(HERO_CAP.reading);   // 넓은 웹에서만 높이를 묶는다(폰·네이티브는 null)
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(a, { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(); }, [a]);
  const titleAnim = { opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] };

  return (
    <View style={heroCap ? [styles.heroBox, heroCap] : styles.heroBox}>
      {/* 배경 — 위가 밝다(시안 p10). 오행 팔레트라 테마가 바뀌면 히어로도 따라간다 */}
      <LinearGradient
        colors={[colors.juSoft, colors.bg]}
        start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* 사진 — 아주 옅게. 없으면 그냥 색면 */}
      {image ? (
        <ExpoImage
          source={image}
          style={[StyleSheet.absoluteFill, { opacity: HERO_PHOTO_OPACITY }]}
          contentFit="cover" contentPosition="center" cachePolicy="memory-disk" transition={150}
        />
      ) : null}
      {/* 아치 — 제목 뒤로 지나간다 */}
      <Svg width="100%" height="100%" viewBox="0 0 320 210" preserveAspectRatio="none" style={StyleSheet.absoluteFill} pointerEvents="none">
        <Path d="M 26 210 L 26 150 A 134 122 0 0 1 294 150 L 294 210" stroke={themeColor + '55'} strokeWidth={2.2} fill="none" strokeLinecap="round" />
      </Svg>

      <View style={styles.heroInner}>
        {motif}
        <Animated.Text style={[styles.heroTitle, { fontSize: fs(24), color: themeColor }, titleAnim]}>{title}</Animated.Text>
        <Animated.Text style={[styles.heroSub, { fontSize: fs(13), lineHeight: 20, opacity: a }]}>{sub}</Animated.Text>
      </View>
    </View>
  );
}

// 무료 티어 미리보기 카드 — 온디바이스 결정론 기본값(수비학 생명수·점성술 빅3)을 키:값 줄로. 유료=LLM 심층(하이브리드 hook).
export function FreeBasics({ title, rows, color = colors.ju }: { title: string; rows: [string, string | number][]; color?: string }) {
  const { fs } = useFontScale();
  return (
    <View style={{ width: '100%', backgroundColor: colors.sunk, borderRadius: radius.md, padding: space(4), marginBottom: space(4) }}>
      <Text style={{ fontSize: fs(13), fontWeight: '800', color, marginBottom: space(2), letterSpacing: 0.5 }}>{title}</Text>
      {rows.map(([k, v]) => (
        <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: space(1.5) }}>
          <Text style={{ ...font.body, color: colors.inkSoft, fontSize: fs(14) }}>{k}</Text>
          <Text style={{ ...font.body, color: colors.ink, fontSize: fs(16), fontWeight: '800' }}>{String(v)}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: 'transparent' }, // 전역 ContentBackdrop 비쳐 보이게(07-21 배경통일 — 이 셸 쓰는 11화면 일괄)
  wrap: { padding: space(6), paddingBottom: space(12) }, // 콘텐츠 화면 좌우여백 통일(daniel) — space(6)
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: space(7), backgroundColor: 'transparent' },
  // 히어로
  hero: { borderRadius: radius.lg, overflow: 'hidden', marginBottom: space(5), aspectRatio: 1.5, backgroundColor: colors.sunk },
  // 이미지 히어로 = 단일 스타일(hero와 병합 금지 — aspectRatio 이중지정이 Yoga 폭 계산을 깨 좌치우침 유발). width 100%로 전폭·중앙(daniel 시뮬 실측 확인: 좌72=우72).
  // ★시안 히어로 — 색면 + 아치. 사진이 있든 없든 **같은 상자**다(종전엔 둘이 갈려 화면마다 높이가 달랐다).
  heroBox: { width: '100%', minHeight: 210, borderRadius: radius.lg, overflow: 'hidden', marginBottom: space(5), justifyContent: 'flex-end' },
  heroImg: { borderRadius: radius.lg },
  heroInner: { alignItems: 'center', justifyContent: 'flex-end', paddingVertical: space(7), paddingHorizontal: space(6) },
  heroTitle: { fontWeight: '900', letterSpacing: -0.5, marginTop: space(2), textAlign: 'center' },
  heroSub: { color: colors.inkSoft, marginTop: space(2), textAlign: 'center' },
  // 섹션 카드(좌측 테마색 띠)
  card: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.juLine, padding: space(5), marginBottom: space(3), ...shadow.card },
  cardAccent: { borderLeftWidth: 3 },
  secLabel: { fontSize: 16, fontWeight: '800', marginBottom: space(2) },
  groupTitle: { fontSize: 18, fontWeight: '900', marginTop: space(6), marginBottom: space(3), paddingTop: space(4), borderTopWidth: 1, borderTopColor: colors.juLine }, // 섹터 구분 헤더(별자리/점성술 — daniel)
  body: { ...font.body, color: colors.ink },
  busyTx: { ...font.caption, color: colors.inkSoft, marginTop: space(2), textAlign: 'center' },
  err: { fontSize: 13, color: colors.ju },
  msg: { ...font.body, textAlign: 'center', marginBottom: space(5) },
  // 잠김 게이트(쿠폰 안내)
  gate: { alignItems: 'center', borderStyle: 'dashed', paddingVertical: space(7) },
  gateTitle: { ...font.heading, color: colors.ink, marginBottom: space(2) },
  gateDesc: { ...font.body, color: colors.inkSoft, textAlign: 'center', marginBottom: space(5), lineHeight: 22 },
  // ★대비(가독성 P0 축5·2026-07-26): inkFaint(#8A8A8F on #FFF ≈ 3.4:1)는 WCAG AA(4.5:1) 미달 —
  //   화살표·카운터 같은 chrome 엔 의도적 약한 위계라 그대로 두되, **읽어야 하는 안내문**은 inkSoft(≈8.9:1)로 올린다.
  gateNote: { ...font.caption, color: colors.inkSoft, marginTop: space(3) },
  // 상점 이동 버튼(daniel 07-07) — 게이트 안내 아래 서브 버튼(마켓으로). 주 CTA(구매하고 보기)와 구분되게 아웃라인.
  goMarketBtn: { marginTop: space(3), paddingVertical: space(2.5), paddingHorizontal: space(6), borderRadius: radius.md, borderWidth: 1, borderColor: colors.ju, backgroundColor: colors.sunk, alignItems: 'center' },
  goMarketTx: { ...font.body, color: colors.ju, fontWeight: '700' },
  ownedStatus: { ...font.body, color: colors.ink, fontWeight: '700', textAlign: 'center', marginBottom: space(5), lineHeight: 22 }, // 상태 뷰(daniel 07-03) 상태 라인 — 구매이력/만료일/무제한. 게이트 설명(inkSoft)보다 또렷하게(ink·700).
  // ★소유 진입 카드 리디자인(daniel 2026-07-25 IMG_8183 '풀이로 넘어가는 부분') — 점선→솔리드 프리미엄. ✓뱃지·제목·상태 한줄·풀폭 CTA.
  ownedCard: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1.5, alignItems: 'center', paddingVertical: space(6), paddingHorizontal: space(5), marginBottom: space(4), ...shadow.card },
  ownedBadge: { width: 48, height: 48, borderRadius: 24, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginBottom: space(3) }, // ✓ 소유 뱃지(themeColor 틴트)
  ownedBadgeTx: { fontSize: 24, fontWeight: '900', lineHeight: 28 },
  ownedTitle: { ...font.heading, color: colors.ink, fontWeight: '900', marginBottom: space(1.5), textAlign: 'center' },
  ownedStatus2: { ...font.body, color: colors.inkSoft, fontWeight: '700', textAlign: 'center', marginBottom: space(5), lineHeight: 22 },
  ownedCta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space(1), alignSelf: 'stretch', borderRadius: radius.md, paddingVertical: space(4), ...shadow.card }, // 풀 폭 CTA(카드 안에서 stretch)
  ownedCtaArrow: { fontSize: 18 },
  // 미리보기 박스(잠긴 콘텐츠의 핵심 항목 목록)
  previewBox: { width: '100%', backgroundColor: colors.sunk, borderRadius: radius.md, padding: space(4), marginBottom: space(5) },
  previewHead: { fontSize: 13, fontWeight: '800', marginBottom: space(2), letterSpacing: 0.5 },
  previewItem: { ...font.body, color: colors.inkSoft, lineHeight: 24, fontSize: 14 },
  cta: { backgroundColor: colors.ju, borderRadius: radius.md, paddingVertical: space(3.5), paddingHorizontal: space(7) },
  ctaTx: { color: colors.bg, fontWeight: '800', fontSize: 16 },
  ctaDisabled: { opacity: 0.55 }, // 플로우 진행 중 CTA 비활성 표시(daniel 07-26)
  // 결제 준비 오버레이(daniel 07-24) — '바로 구매' 후 애플 결제창/웹훅 적립 대기 로딩(무피드백 방지)
  payWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  payCard: { backgroundColor: colors.card, borderRadius: radius.lg, paddingVertical: space(7), paddingHorizontal: space(9), alignItems: 'center', ...shadow.card },
  payTx: { ...font.body, color: colors.ink, marginTop: space(4), fontWeight: '700' },
});
