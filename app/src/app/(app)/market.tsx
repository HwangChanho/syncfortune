// app/src/app/(app)/market.tsx — 마켓: 적용할 명식 선택 → 풀이 진입 + 쿠폰 등록
// ─────────────────────────────────────────────────────────────────────────
// daniel: 이용권/풀이는 명식별로 적용된다. 마켓에서 ① 적용할 명식을 드롭다운으로 고르고
//   ② 이용권(사주·자미·궁합·타임라인·추가질문·애정)을 누르면 그 명식의 해당 풀이 화면으로 진입
//   (선택 명식을 대표로 설정 → 캐시·서버차트 연결, 거기서 이용권 use_credit·프리미엄·건당구매로 열림).
//   무료 이용권(쿠폰) 등록도 여기로 이동(설정→마켓). ★1회성 소모 — 보유/미보유로만 표시.
// ─────────────────────────────────────────────────────────────────────────
import { View, Text, ScrollView, Pressable, TextInput, StyleSheet, Modal, Image } from 'react-native';
import { PressableScale } from '../../components/PressableScale';
import { AdFreeSection } from '../../components/AdFreeSection';   // ★광고 제거(코인 구매) 공용 블록
import { Alert } from '../../lib/ui/alert'; // 커스텀 알림(앱 디자인)
import { useEffect, useRef, useState } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { CREDIT_KINDS, loadCredits, redeemCoupon, waitForCreditGrant, type CreditKind } from '../../lib/billing/coupons';
import { coinPriceOf, coinBalanceOrNull } from '../../lib/billing/coins';
import { ensureCoinsFor } from '../../lib/billing/coinGate';   // ★코인 단일 경로(daniel 07-28)   // ★코인 표기·잔액(충전은 /coins 전용)
import { isNewContent } from '../../lib/content/newBadge'; // 신규 콘텐츠 NEW 배지(출시일+21일 자동 만료)
import { requireLoginForPurchase } from '../../lib/billing/requireLogin'; // C1: 결제=계정 귀속(웹훅 적립엔 로그인 필수)
import { listCharts, getRepresentativeId, setRepresentative, loadRepChart, type SavedChart } from '../../lib/engine/myChart';
import { requestChartConfirm } from '../../lib/ui/chartConfirm'; // 구매 전 명식 확인(드롭다운으로 변경 가능)
import { ListSkeleton } from '../../components/Skeleton'; // 첫 진입 로딩 스켈레톤(daniel 07-02: 마켓 즉시 전환+스켈레톤)
import { useDeferredReady } from '../../lib/ui/useDeferredReady'; // 전환 즉시 스켈레톤 → 전환 후 콘텐츠 마운트(멈칫 제거)
import { purchasesEnabled, priceStringsRC, priceStringRC, CREDIT_PRODUCT } from '../../lib/billing/purchases';
import { useSubscription } from '../../lib/billing/subscription'; // 프리미엄 가입 루트(전체 무제한)
import { useAuth } from '../../lib/useAuth';              // 세션(프리미엄 명식 지정 시 serverChartId 발급)
import { supabase } from '../../lib/supabase';            // set_premium_chart RPC(구매 명식 지정)
import { ensureServerChartIdForSaved } from '../../lib/backend/prewarmReadings'; // 구매 명식 serverChartId 확보
import { colors, radius, space, shadow, font } from '../../lib/theme';

// 이용권 kind → 적용할 풀이 화면(선택 명식을 대표로 둔 뒤 진입 — 대표 기준 캐시)
export const ROUTE: Record<CreditKind, { pathname: string; kind?: string }> = { // export: 연관 콘텐츠 추천(RelatedContent)이 단일 소스로 재사용
  reading: { pathname: '/reading' },                  // 사주 원국 풀이
  ziwei: { pathname: '/reading', kind: 'ziwei' },     // 자미두수 풀이
  timeline: { pathname: '/timeline' },                // 인생 타임라인
  compat: { pathname: '/compat' },                    // 궁합
  followup: { pathname: '/reading' },                 // 추가 질문(풀이 안에서)
  love: { pathname: '/love' },                        // 애정흐름
  newyear: { pathname: '/newyear' },                  // 신년운세(스페셜)
  lifegraph: { pathname: '/lifegraph' },              // 인생 그래프(스페셜)
  roots: { pathname: '/roots' },                      // 명식의 뿌리(통근·투출)
  image: { pathname: '/image' },                      // 비치는 나(천간 인상)
  mission: { pathname: '/mission' },                  // 나의 사명(자미 보조)
  career: { pathname: '/career' },                    // 사업가의 나 vs 직장인의 나
  talent: { pathname: '/talent' },                    // 나의 타고난 재능(월지 축)
  astrology: { pathname: '/astrology' },              // 별자리 운세(서양 네이탈)
  dream: { pathname: '/dream' },                       // AI 꿈해몽(자유 텍스트)
  gaeun: { pathname: '/gaeun' },                       // 맞춤 개운법(daniel #18)
  celeb: { pathname: '/celeb' },                       // 세계 인물 매칭(daniel B)
  timeresolve: { pathname: '/timeResolve' },           // 태어난 시 찾기(TPR — daniel 06-28)
  future10: { pathname: '/future10' },                 // 10년 뒤 나의 모습(대운·세운 스페셜)
  child: { pathname: '/child' },                       // 자식운(프리미엄 포함, 비프리미엄 개별)
  child_couple: { pathname: '/child' },                // 자식운 · 부부(반값 업그레이드) — /child 안에서만 구매(마켓 단독 판매 X, 아래 MARKET_HIDDEN)
  reunion: { pathname: '/reunion' },                   // 재회운(옛 인연·도화-충 timing)
  crush: { pathname: '/crush' },                       // 짝사랑 인연운(인연星·도화 발동 timing)
  job: { pathname: '/job' },                           // 취업·이직운(관성·인성 발동 timing)
  jobfit: { pathname: '/jobfit' },                     // 나에게 어울리는 직업(직업 적성 딥리포트 EEL)
  wealth: { pathname: '/wealth' },                     // 재물 딥리포트(그릇/유형/시기/처방 4축 EEL·jobfit 동형)
  coach: { pathname: '/coach' },                       // AI 코치 질문권 — 코치 화면 내에서 구매(마켓 단독카드는 숨김)
  timeline5: { pathname: '/timeline' },                // 세운 5회 묶음 — TimelineScreen 잠긴 시기에서만 구매(마켓 단독카드 X·아래 MARKET_HIDDEN). 타입 총망라 위해 라우트만 둠
  timeline10: { pathname: '/timeline' },               // 세운 10회(대운 전체) 묶음 — 위와 동일
};

// 마켓 목록에서 숨길 이용권(kind) — 아래 섹션 A·B 렌더 필터에서 제외한다(!MARKET_HIDDEN.has).
//   child_couple(자식운·부부) = 솔로(child) 소유자만 /child 안에서 반값 업그레이드로 구매한다. 마켓에 단독 타일로 노출하면
//   솔로 미소유자가 부부(상위 콘텐츠)를 반값에 우회 구매해 솔로 상품을 잠식하므로 목록에서 제외(daniel 07-03).
//     (※ child_couple 은 CREDIT_KINDS 에도 없어 애초에 목록에 안 뜨지만, 방어적으로 함께 둔다.)
//   celeb(세계 인물 매칭) = 온디바이스 결정론·API 0 → 완전 무료 전환(daniel 07-07). 이용권을 사도 화면이 이미 무료라
//     '아무것도 안 주는 유료 판매' = App Store 3.1.1 리젝 리스크 → 마켓 판매 제거(화면은 무료 공개). CreditKind 타입엔 남김(파급 최소).
//   timeline5/timeline10(세운 번들) = fungible 'timeline' 크레딧 묶음. 인생 타임라인의 *잠긴 시기*에서만 구매(TimelineScreen) — 마켓에 단독 타일로 노출하면 맥락 없이 팔려 혼란(어느 시기에 쓰는지 불명) → 목록 제외.
const MARKET_HIDDEN = new Set<CreditKind>(['child_couple', 'celeb', 'coach', 'timeline5', 'timeline10']); // coach=AI 코치 질문권은 코치 화면 내에서 구매(마켓 단독카드 X)

// ★가장 많이 찾는 콘텐츠(daniel 07-05) — 수요 폭발 카테고리에 ★★★ 배지로 구미를 당긴다(전환 유도).
//   재회·애정·궁합·신년 = 사람들이 가장 많이 검색·구매하는 연애/시즌 콘텐츠(시장 조사 기반).
const HOT_KINDS = new Set<CreditKind>(['reunion', 'crush', 'love', 'compat', 'newyear', 'jobfit', 'wealth']); // crush(짝사랑)=최다 수요(daniel 07-05) · jobfit·wealth=신규 유료 딥리포트(인기 섹션 노출·daniel 07-13/07-22)

// ★마켓 주제 필터(daniel 2026-07-25 L '대분류·소분류로 찾기 쉽게') — 프리미엄/개별(대분류)은 유지하고,
//   주제(소분류)로 걸러 '너무 나열됨'을 해소. 각 kind 를 한 주제에 배정(UI 그룹핑·명리 판정 아님·daniel 조정 슬롯).
type MarketTopic = 'love' | 'job' | 'self' | 'time' | 'etc';
const TOPIC_OF: Partial<Record<CreditKind, MarketTopic>> = {
  love: 'love', compat: 'love', crush: 'love', reunion: 'love', child: 'love',                         // 애정·궁합
  career: 'job', jobfit: 'job', job: 'job', wealth: 'job', talent: 'job',                               // 직업·재물
  reading: 'self', ziwei: 'self', roots: 'self', image: 'self', mission: 'self', astrology: 'self',     // 성격·자기이해(종합 원국 포함)
  future10: 'time', timeline: 'time', newyear: 'time', lifegraph: 'time', gaeun: 'time', timeresolve: 'time', // 시기·미래
  dream: 'etc', followup: 'etc',                                                                         // 기타
};
const MARKET_TOPICS: [('all' | MarketTopic), string][] = [
  ['all', '전체'], ['love', '애정·궁합'], ['job', '직업·재물'], ['self', '성격·자기이해'], ['time', '시기·미래'], ['etc', '기타'],
];

// 이용권 kind → 카드 이미지 + 설명키(홈 카드와 동일 재사용, daniel: 마켓 리스트에도 작게+설명).
//   followup(추가질문)은 standalone 카드가 아니라(풀이 내부) 생략 — 없으면 이미지·설명 미표시(graceful).
const CARD: Partial<Record<CreditKind, { img: any; desc: string }>> = {
  reading: { img: require('../../../assets/icons/premium.jpg'), desc: 'menu.sajuDesc' },
  ziwei: { img: require('../../../assets/icons/ziwei.jpg'), desc: 'menu.ziweiHubDesc' },
  compat: { img: require('../../../assets/icons/compat.jpg'), desc: 'menu.compatDesc' },
  timeline: { img: require('../../../assets/icons/timeline.jpg'), desc: 'menu.timelineDesc' },
  love: { img: require('../../../assets/icons/love.jpg'), desc: 'menu.loveDesc' },
  newyear: { img: require('../../../assets/icons/newyear.jpg'), desc: 'menu.newyearTileDesc' },
  lifegraph: { img: require('../../../assets/icons/lifegraph.jpg'), desc: 'menu.lifegraphDesc' },
  roots: { img: require('../../../assets/icons/roots.jpg'), desc: 'menu.rootsDesc' },
  image: { img: require('../../../assets/icons/image.jpg'), desc: 'menu.imageDesc' },
  mission: { img: require('../../../assets/icons/mission.jpg'), desc: 'menu.missionDesc' },
  career: { img: require('../../../assets/icons/career.jpg'), desc: 'menu.careerDesc' },
  talent: { img: require('../../../assets/icons/talent.jpg'), desc: 'menu.talentDesc' },
  astrology: { img: require('../../../assets/icons/astrology.jpg'), desc: 'menu.astrologyDesc' },
  dream: { img: require('../../../assets/icons/dream.jpg'), desc: 'menu.dreamDesc' },
  gaeun: { img: require('../../../assets/icons/gaeun.jpg'), desc: 'menu.gaeunDesc' }, // 맞춤 개운법(daniel #18)
  celeb: { img: require('../../../assets/icons/celeb.jpg'), desc: 'menu.celebDesc' }, // 세계 인물 매칭(daniel B)
  timeresolve: { img: require('../../../assets/icons/timeResolve.jpg'), desc: 'menu.timeResolveDesc' }, // 태어난 시 찾기(TPR — daniel 06-28)
  followup: { img: require('../../../assets/icons/followup.jpg'), desc: 'menu.followupDesc' }, // 추가 질문(daniel: 마켓에도 이미지)
  future10: { img: require('../../../assets/icons/future10.jpg'), desc: 'menu.future10Desc' }, // 10년 뒤 나의 모습(전용 아이콘)
  child: { img: require('../../../assets/icons/child.jpg'), desc: 'menu.childDesc' }, // 자식운(전용 아이콘)
  reunion: { img: require('../../../assets/icons/reunion.jpg'), desc: 'menu.reunionDesc' }, // 재회운(전용 아이콘 — 부모가 reunion.jpg 추가)
  crush: { img: require('../../../assets/icons/crush.jpg'), desc: 'menu.crushDesc' }, // 짝사랑 인연운(전용 히어로)
  job: { img: require('../../../assets/icons/job.jpg'), desc: 'menu.jobDesc' }, // 취업·이직운(전용 히어로)
  jobfit: { img: require('../../../assets/icons/jobfit.jpg'), desc: 'menu.jobfitDesc' }, // 나에게 어울리는 직업(전용 히어로 — 갈림길에서 어울리는 길, 미드나잇+골드 톤)
  wealth: { img: require('../../../assets/icons/wealth.jpg'), desc: 'menu.wealthDesc' }, // 재물 딥리포트(전용 히어로 — 재물 그릇에 빛·재물 유입, 미드나잇+골드 톤)
};

export default function MarketRoute() {
  const { t } = useTranslation();
  const router = useRouter();
  const { session } = useAuth();                          // 프리미엄 명식 지정(serverChartId 발급)에 필요
  const [saved, setSaved] = useState<SavedChart[]>([]);
  const [sel, setSel] = useState<SavedChart | null>(null);   // 적용할 명식(기본=대표)
  const [pick, setPick] = useState(false);                   // 명식 선택 모달
  const [credits, setCredits] = useState<Record<string, number>>({});
  const [code, setCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [busy, setBusy] = useState<CreditKind | null>(null);
  // ★보유 코인(daniel 2026-07-28 "마켓에 본인 보유코인도 나와야지") — 충전 화면에 들어가지 않고도
  //   지금 얼마 있는지 알아야 '이걸 열 수 있나'를 판단할 수 있다. null=조회 실패(0으로 표시하지 않는다).
  const [coins, setCoins] = useState<number | null>(null);   // 보유 코인(null=조회 실패 — 0으로 표시하지 않는다)
  const [prices, setPrices] = useState<Record<string, string>>({}); // 현지통화 가격(RC) — 미설정 시 ₩ 폴백
  const [topic, setTopic] = useState<'all' | MarketTopic>('all'); // ★마켓 주제 필터(daniel 2026-07-25 L)
  // ★'상점으로 이동' 딥링크(daniel 2026-07-27 "상점으로 이동하기 하면 바로 그거 구매 위치로 이동돼야 해")
  //   기존엔 /market 으로만 보내서 사용자가 35개 목록에서 그 상품을 **다시 찾아야** 했다(주제 필터까지 걸려 있으면 더 어렵다).
  //   이제 호출측이 `?focus=<CreditKind>` 를 넘기고, 여기서 ①그 상품의 주제로 필터 전환 ②카드까지 스크롤 ③잠깐 강조한다.
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  //   ⚠️MARKET_HIDDEN 5종(child_couple·celeb·coach·timeline5·timeline10)은 **마켓에 카드가 없다**(각 화면 안에서만 구매).
  //     그쪽으로 focus 가 와도 스크롤할 대상이 없으므로 아예 무시한다(2초 헛도는 재시도 방지 · 기존 동작으로 자연 폴백).
  const focusKey = (focus
    && (CREDIT_KINDS as readonly { key: CreditKind }[]).some((c) => c.key === focus)
    && !MARKET_HIDDEN.has(focus as CreditKind)
    ? focus as CreditKind : null);
  const scrollRef = useRef<ScrollView>(null);
  const cardY = useRef<Partial<Record<CreditKind, number>>>({});   // 카드별 y(onLayout 로 수집) — 스크롤 목표
  const [hi, setHi] = useState<CreditKind | null>(null);           // 강조 중인 카드
  const didFocus = useRef(false);                                  // 1회만 — 사용자가 스크롤한 뒤 다시 끌어당기지 않게

  // focus 상품의 주제로 필터를 먼저 옮긴다(필터에 걸려 카드가 아예 렌더되지 않으면 스크롤할 대상이 없다).
  useEffect(() => {
    if (!focusKey) return;
    const tp = TOPIC_OF[focusKey];
    if (tp) setTopic(tp);
  }, [focusKey]);
  const [buyingPrem, setBuyingPrem] = useState(false);
  const ready = useDeferredReady(); // 네비 전환 완료 후 콘텐츠 마운트 — 그 전엔 스켈레톤(첫 진입 즉시 전환·멈칫 제거)

  useEffect(() => {
    (async () => {
      const list = await listCharts(); setSaved(list);
      const repId = await getRepresentativeId();
      setSel(list.find((c) => c.id === repId) ?? list[0] ?? null);
      loadCredits().then(setCredits).catch(() => {});
      // 현지 통화 가격(RC) 일괄 로드 — USD 기준 등록 시 사용자 지역 통화로 자동 표시. 미설정/실패 시 ₩ 폴백.
      priceStringsRC(CREDIT_KINDS.map((c) => CREDIT_PRODUCT[c.key])).then((m) => {
        setPrices(Object.fromEntries(CREDIT_KINDS.map((c) => [c.key, m[CREDIT_PRODUCT[c.key]] ?? `₩${c.price.toLocaleString()}`])));
      }).catch(() => {});
    })();
  }, []);

  // 프리미엄 현지통화 가격(RC) — 미설정 시 ₩ 폴백
  // 보유 코인 로드 — 카드마다 코인가가 붙으므로 잔액을 함께 보여야 비교가 된다(daniel 07-28)
  useEffect(() => { void coinBalanceOrNull().then(setCoins); }, []);


  // 프리미엄 가입(평생·전체 무제한) — 결제 미연동 시 '준비 중'. 성공 시 상태 갱신. 취소는 조용히.
  //   daniel: 결제 진행 전 '적용 명식'을 확인 Alert 로 한 번 더 보여준다(오결제 방지). 실제 구매 로직은 내부 함수로 분리.
  // ★코인 팩 구매 로직 제거(daniel 07-28) — 충전은 /coins 전용 페이지 한 곳에서만.
  //   두 화면에 결제 코드가 있으면 고칠 곳이 둘이 되고, 오늘 겪은 '반쪽 전환'이 또 난다.


  // ★buyPremium 제거(daniel 2026-07-28 "프리미엄도 빼버려 … 기존 결제관련해서는 코드 정리하고").
  //   프리미엄 구매 → 낙관표시 → 서버 is_premium 폴링 → 명식 바인딩까지 이어지던 흐름을 통째로 삭제.
  //   이 왕복(스토어 결제 + 웹훅 폴링)이 곧 코인 시스템으로 넘어온 문제의 원형이었다.


  // 이용권 적용 — 선택 명식을 대표로 설정 후 해당 풀이 화면으로(거기서 이용권/프리미엄/구매로 열림).
  async function apply(kind: CreditKind) {
    if (sel) await setRepresentative(sel.id);
    const r = ROUTE[kind];
    router.navigate({ pathname: r.pathname, params: r.kind ? { kind: r.kind } : {} }); // navigate=정적 /reading 중복 스택 dedup(daniel 07-01)
  }

  // 이용권 구매(결제) — RevenueCat 소비성 결제 성공 → 크레딧 +1(웹훅 전 클라 반영) → 보유 갱신.
  //   RC 미설정(키/네이티브 미포함) 시 '준비 중' 안내. 사용자 취소는 조용히 무시.
  /**
   * 마켓 카드 '열기' — ★코인 단일 경로(daniel 2026-07-28 "기존 단건 결제는 다 없애").
   * 종전엔 여기서 스토어 결제가 나갔다(구매 → 웹훅 적립 폴링). 그 왕복이 오늘 하루에만 여러 번 깨졌고,
   * 무엇보다 카드에는 **코인가**가 적혀 있는데 누르면 원화 결제창이 뜨는 모순이 있었다.
   * 이제 여기서는 **잔액 확인·동의만** 받고, 실제 차감은 콘텐츠를 생성할 때 서버가 한다.
   * (마켓에서 미리 차감하면 생성 전에 돈만 빠지는 구간이 생긴다 — 그래서 차감하지 않는다.)
   */
  async function buy(kind: CreditKind) {
    if (busy) return;
    if (!requireLoginForPurchase(session, () => router.push('/login'), t)) return;
    setBusy(kind);
    try {
      const g = await ensureCoinsFor(kind, {
        title: t('market.doneTitle', '이용 안내'),
        t,
        goCharge: () => router.push('/coins'),
      });
      if (g !== 'ok') return;                       // 부족(충전 화면으로)·취소·오류는 여기서 끝
      // 코인이 충분하다 = 바로 열 수 있다. 해당 콘텐츠 화면으로 보내고 거기서 생성·차감된다.
      apply(kind);
    } catch (e: any) {
      Alert.alert(t('market.buyFailTitle'), e?.message ?? '');
    } finally {
      setBusy(null);
    }
  }

  // 쿠폰 등록(설정→마켓 이동) — 서버 검증·부여 → 결과 안내 + 보유 갱신.
  async function onRedeem() {
    const c = code.trim();
    if (!c || redeeming) return;
    setRedeeming(true);
    const res = await redeemCoupon(c);
    setRedeeming(false);
    if (res.ok) {
      setCode('');
      setCredits(await loadCredits());
      Alert.alert(t('settings.couponOkTitle'), t('settings.couponOk'));
    } else {
      Alert.alert(t('settings.couponFailTitle'), t(`settings.couponErr_${res.error}`, t('settings.couponErr_invalid')));
    }
  }

  // ★프리미엄 포함(섹션 A) = 프리미엄이 실제 제공하는 5종만(사주·자미·궁합·인생타임라인·자식운, daniel 07-03).
  //   그 외 전부(애정·신년·인생그래프·10년뒤·개운·재능 등)는 개별 구매 전용(섹션 B) — 프리미엄에 포함 아님.
  const PREMIUM_KINDS = new Set<CreditKind>(['reading', 'ziwei', 'compat', 'timeline', 'child']);

  // 마켓 카드 한 장 렌더(섹션 A·B 공유 헬퍼) — premInc=프리미엄 포함 섹션 여부.
  //   • premInc && isPremium → 가격·구매 버튼 숨기고 '무제한 이용 중' 배지 + 카드 누르면 열기(apply).
  //   • 그 외(비프리미엄 또는 개별전용 섹션) → 기존 동작: 보유 시 열기 / 미보유 시 개별 구매.
  //   ※ 결제·적용 로직(buy=웹훅 폴링/apply)은 미변경 — 표시 분기만 추가(UI 전용).
  function renderCard(c: (typeof CREDIT_KINDS)[number], premInc: boolean) {
    const owned = (credits[c.key] ?? 0) > 0; // 1회성 소모 — 보유/미보유로만
    const card = CARD[c.key];                // 카드 이미지+설명(홈과 동일·daniel: 마켓 리스트에도)

    // ★프리미엄 폐지(daniel 2026-07-28) — '프리미엄이면 무제한' 분기를 제거했다.
    //   이제 모든 카드가 같은 규칙(보유=열기 / 미보유=코인 결제)으로 렌더된다. premInc 는 섹션 분류에만 쓰인다.

    // 기존 동작(현행 그대로): 보유 시 열기(apply) / 미보유 시 개별 구매(buy)
    return (
      <View key={c.key} onLayout={(e) => { cardY.current[c.key] = e.nativeEvent.layout.y; }}
        style={[styles.card, hi === c.key && styles.cardFocus]}>
        {isNewContent(c.key) && <View style={styles.newTag}><Text style={styles.newTagTx}>NEW</Text></View>}
          {card && <Image source={card.img} style={styles.thumb} />}
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{c.ko}</Text>
          {card && <Text style={styles.desc} numberOfLines={2}>{t(card.desc)}</Text>}
          <Text style={styles.price}>{coinPriceOf(c.key) != null ? `◉ ${coinPriceOf(c.key)}` : (prices[c.key] ?? `₩${c.price.toLocaleString()}`)}</Text>
          <Text style={[styles.have, owned && styles.haveOn]}>{owned ? `${t('market.owned')} ×${credits[c.key]}` : t('market.notOwned')}</Text>
        </View>
        {/* ★코인 전환(daniel 2026-07-28 "기존 단건 결제는 다 없애") — 마켓에서 개별 결제하지 않는다.
            코인이 화폐이므로 **콘텐츠를 열고 거기서 코인을 쓴다**(게이트가 잔액 확인·부족 시 충전 유도).
            마켓은 카탈로그 + 충전 입구 역할만 한다. 보유/미보유는 라벨로만 구분한다. */}
        <PressableScale style={styles.buyBtn} onPress={() => apply(c.key)} disabled={!sel}>
          <Text style={styles.buyTx}>{owned ? t('market.openApply') : t('market.open', '열기')}</Text>
        </PressableScale>
      </View>
    );
  }

  // ★첫 진입 즉시 마켓뷰 전환 + 로딩까지 스켈레톤(daniel 07-02) — 전환 애니 끝난 뒤 무거운 카드·RC 가격 마운트.
  // focus 카드로 스크롤 + 강조. ★`ready` 이후에만 — 그 전엔 스켈레톤이라 카드가 없어 onLayout y 가 안 잡힌다.
  //   레이아웃이 한 프레임 뒤에 확정되므로 짧게 재시도한다(첫 시도에 y 가 아직 없을 수 있다).
  useEffect(() => {
    if (!ready || !focusKey || didFocus.current) return;
    let tries = 0;
    const tick = setInterval(() => {
      const y = cardY.current[focusKey];
      if (y != null) {
        clearInterval(tick);
        didFocus.current = true;
        // 헤더 여백만큼 위로 띄워 카드가 화면 상단에 딱 붙지 않게(-24)
        scrollRef.current?.scrollTo({ y: Math.max(0, y - 24), animated: true });
        setHi(focusKey);
        setTimeout(() => setHi(null), 2200);   // 강조는 잠깐만 — 계속 켜두면 '선택된 상태'로 오해된다
      } else if (++tries > 20) {               // 약 2초. 못 찾으면 조용히 포기(목록 상단 그대로 — 기존 동작)
        clearInterval(tick);
        didFocus.current = true;
      }
    }, 100);
    return () => clearInterval(tick);
  }, [ready, focusKey, topic]);

  if (!ready) return <ScrollView style={styles.screen} contentContainerStyle={styles.wrap}><ListSkeleton rows={6} /></ScrollView>;

  // ★주제 필터 적용 목록(daniel 2026-07-25 L) — 프리미엄/개별(대분류) 안에서 주제(소분류)로 거른다. 빈 섹션은 헤더째 숨김.
  const inTopic = (c: (typeof CREDIT_KINDS)[number]) => topic === 'all' || TOPIC_OF[c.key] === topic;
  const premList = CREDIT_KINDS.filter((c) => PREMIUM_KINDS.has(c.key) && !MARKET_HIDDEN.has(c.key) && inTopic(c));
  const hotList = CREDIT_KINDS.filter((c) => HOT_KINDS.has(c.key) && !PREMIUM_KINDS.has(c.key) && !MARKET_HIDDEN.has(c.key) && inTopic(c));
  const restList = CREDIT_KINDS.filter((c) => !PREMIUM_KINDS.has(c.key) && !MARKET_HIDDEN.has(c.key) && !HOT_KINDS.has(c.key) && inTopic(c));

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      <Text style={styles.intro}>{t('market.intro')}</Text>
      {/* ★보유기한 1년 명시(daniel: 법적 — 약관 제4조 3항과 일치) — 비프리미엄에게만(프리미엄=무제한 보유라 불필요) */}
      <Text style={styles.retention}>{t('market.retentionNote', '구매한 풀이는 구매일로부터 1년간 보유되며, 1년이 지나면 자동 삭제됩니다. 이후 다시 보려면 재구매가 필요해요.')}</Text>

      {/* ★프리미엄 폐지(daniel 2026-07-28) — 프리미엄 카드가 있던 자리를 **보유 코인**이 대신한다.
          ⚠️이 카드는 프리미엄 카드를 정규식으로 걷어낼 때 함께 지워져 있었다(스타일만 남아 있었다).
          daniel "마켓에서 보유코인이 보여야지" 로 확인 — 카드마다 코인가가 붙으니 잔액이 옆에 있어야 비교가 된다. */}
      <PressableScale style={styles.coinCard} onPress={() => router.push('/coins')}>
        <View style={{ flex: 1 }}>
          <Text style={styles.coinLabel}>보유 코인</Text>
          {/* null=조회 실패 → '—'. 0 으로 표시하면 이미 충전한 사용자를 혼란시킨다. */}
          <Text style={styles.coinNum}>{coins == null ? '—' : coins.toLocaleString('ko-KR')}</Text>
        </View>
        <View style={styles.chargePill}><Text style={styles.chargeTx}>충전하기</Text></View>
      </PressableScale>

      {/* ★광고 제거(daniel 07-28) — 충전 바로 위. 코인을 왜 사는지 가장 즉물적인 이유 하나를 먼저 보인다. */}
      <AdFreeSection onDone={() => void coinBalanceOrNull().then(setCoins)} onNeedCoins={() => router.push('/coins')} />

      {/* ★충전은 전용 페이지로 분리(daniel 2026-07-28 "마켓에 코인충전 페이지 분리하고").
          마켓은 '무엇을 살까'를 고르는 곳이고 충전은 '얼마를 넣을까'라 판단이 섞이면 둘 다 흐려진다.
          여기엔 진입점만 두고 실제 충전은 /coins 한 곳에서만 일어나게 한다(결제 경로 단일화). */}
      <PressableScale style={styles.chargeCta} onPress={() => router.push('/coins')}>
        <Text style={styles.chargeCtaTx}>코인 충전하러 가기 ›</Text>
      </PressableScale>

      {/* ★프리미엄 '갱신'은 마켓 카드에서 제거(daniel 07-08) — 풀이 화면의 '최신 해석으로 갱신' 버튼(맥락상 인지적)에만 노출.
          갱신 흐름은 lib/billing/renewal.ts(runPremiumRenewal) + interpret renewRequired 게이트가 담당. */}

      {/* 적용할 명식 선택(드롭다운) — 이용권은 이 명식에 적용된다 */}
      <PressableScale style={styles.chartSel} onPress={() => setPick(true)}>
        <View style={{ flex: 1 }}>
          <Text style={styles.chartSelLabel}>{t('market.applyTo')}</Text>
          <Text style={styles.chartSelVal}>{sel?.label ?? t('market.noChart')}</Text>
        </View>
        <Text style={styles.chartSelChevron}>▾</Text>
      </PressableScale>

      {/* ★주제 필터 칩(daniel 2026-07-25 L) — 전체/애정·궁합/직업·재물/성격·자기이해/시기·미래/기타. 프리미엄·개별(대분류)은 유지, 주제로 거른다. */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.topicRow} contentContainerStyle={styles.topicRowC}>
        {MARKET_TOPICS.map(([k, l]) => (
          <PressableScale key={k} style={[styles.topicChip, topic === k && styles.topicChipOn]} onPress={() => setTopic(k)}>
            <Text style={[styles.topicChipTx, topic === k && styles.topicChipTxOn]}>{l}</Text>
          </PressableScale>
        ))}
      </ScrollView>

      {/* ── 섹션 A: 프리미엄에 포함(주제 필터·비면 헤더째 숨김) ── 타임라인도 여기 포함(daniel 2026-07-01, 사주+자미 종합). */}
      {premList.length > 0 && (
        <>
          <Text style={styles.sectionH}>{t('market.sectionIncluded', '✦ 프리미엄에 포함')}</Text>
          <Text style={styles.sectionSub}>{t('market.sectionIncludedSub', '프리미엄 가입 시 아래 풀이를 명식 수 제한 없이 무제한 이용해요(개별 구매도 가능).')}</Text>
          {premList.map((c) => renderCard(c, true))}
        </>
      )}

      {/* ── 섹션 B: 개별 구매 전용(프리미엄 미포함·주제 필터) ── isPremium 무관 항상 개별 구매(기존) */}
      {(hotList.length + restList.length) > 0 && (
        <>
          <Text style={styles.sectionH}>{t('market.sectionIndividual', '◆ 개별 구매 전용 · 프리미엄 미포함')}</Text>
          <Text style={styles.sectionSub}>{t('market.sectionIndividualSub', '아래 항목은 프리미엄에 포함되지 않아 개별 구매해야 합니다.')}</Text>
          {/* ★인기 외곽칸(daniel 07-08) — 개별 섹션 상단에 수요 많은 유료 콘텐츠를 박스로 강조. 주제 필터 시 해당 주제의 인기만. */}
          {hotList.length > 0 && (
            <View style={styles.hotBox}>
              <Text style={styles.hotBoxH}>{t('market.hotSection', '🔥 인기')}</Text>
              {hotList.map((c) => renderCard(c, false))}
            </View>
          )}
          {restList.map((c) => renderCard(c, false))}
        </>
      )}

      {/* 주제 필터 결과 0건 안내(모든 주제가 최소 1개라 실제론 거의 안 뜸·방어) */}
      {premList.length + hotList.length + restList.length === 0 && (
        <Text style={styles.emptyTopic}>{t('market.emptyTopic', '이 주제의 콘텐츠가 준비 중이에요. 다른 주제를 골라 보세요.')}</Text>
      )}

      {/* 쿠폰 등록(무료 이용권) — 설정에서 이동 */}
      <Text style={styles.couponH}>{t('settings.coupon')}</Text>
      <View style={styles.couponRow}>
        <TextInput
          style={styles.couponInput}
          value={code}
          onChangeText={(v) => setCode(v.toUpperCase())}
          placeholder={t('settings.couponPh')}
          placeholderTextColor={colors.inkFaint}
          autoCapitalize="characters"
          autoCorrect={false}
          editable={!redeeming}
        />
        <PressableScale style={[styles.couponBtn, (!code.trim() || redeeming) && styles.couponBtnOff]} onPress={onRedeem} disabled={!code.trim() || redeeming}>
          <Text style={styles.couponBtnTx}>{t('settings.couponRedeem')}</Text>
        </PressableScale>
      </View>

      <Text style={styles.note}>{t('market.note')}</Text>

      {/* 명식 선택 모달 */}
      <Modal visible={pick} transparent animationType="slide" onRequestClose={() => setPick(false)}>
        <Pressable style={styles.backdrop} onPress={() => setPick(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{t('market.applyTo')}</Text>
            <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false}>
              {saved.length === 0 ? <Text style={styles.note}>{t('market.noChart')}</Text> : saved.map((s) => {
                const on = sel?.id === s.id;
                return (
                  <PressableScale key={s.id} style={styles.pickRow} onPress={() => { setSel(s); setPick(false); }}>
                    <Text style={[styles.pickTx, on && styles.pickTxOn]}>{s.label}</Text>
                    {on && <Text style={styles.pickChk}>✓</Text>}
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
  wrap: { padding: space(5), paddingBottom: space(20) },
  intro: { ...font.body, color: colors.inkSoft, marginBottom: space(2) },
  retention: { ...font.caption, color: colors.inkFaint, marginBottom: space(4), lineHeight: 18 }, // 보유기한 1년 안내(daniel 법적)
  // 프리미엄 가입 카드(골드 강조)
  sectionH2: {},
  chargeCta: { alignItems: 'center', backgroundColor: colors.ju, borderRadius: radius.md, paddingVertical: space(3.5), marginBottom: space(4) },
  chargeCtaTx: { ...font.body, color: colors.bg, fontWeight: '900' },
  packRow: { flexDirection: 'row', gap: space(2), marginBottom: space(4) },
  packBtn: { flex: 1, alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.juLine, paddingVertical: space(2.5), paddingHorizontal: space(1) },
  packCoins: { ...font.body, color: colors.ju, fontWeight: '900', fontSize: 17 },
  packWon: { ...font.caption, color: colors.inkSoft, fontWeight: '700', marginTop: 1 },
  packBonus: { ...font.caption, color: colors.ju, fontWeight: '800', fontSize: 10 },
  premCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.ju, borderRadius: radius.md, padding: space(4), marginBottom: space(4), ...shadow.card },
  premTitle: { fontSize: 16, fontWeight: '900', color: colors.bg },
  premSub: { fontSize: 12, color: colors.bg, opacity: 0.85, marginTop: 2 },
  premChart: { fontSize: 11, fontWeight: '700', color: colors.bg, opacity: 0.75, marginTop: 4 }, // 적용 명식 안내(비프리미엄 카드)
  premPrice: { fontSize: 16, fontWeight: '900', color: colors.bg, marginLeft: space(2) },
  // 인생 타임라인 독립 강조 카드(골드 강조 테두리 — 명식 선택 아래 단독 노출, daniel)
  timelineCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.ju, padding: space(4), marginBottom: space(4), ...shadow.card },
  timelineThumb: { width: 56, height: 78, borderRadius: radius.md, marginRight: space(3), backgroundColor: colors.sunk }, // 강조 카드라 일반 thumb(46×64)보다 크게
  timelineTitle: { fontSize: 17, fontWeight: '900', color: colors.ink },
  timelineDesc: { ...font.caption, color: colors.inkSoft, marginTop: 2, marginBottom: 1, lineHeight: 16 },
  // 적용할 명식 선택
  chartSel: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.ju, borderRadius: radius.md, padding: space(4), marginBottom: space(4), ...shadow.card },
  chartSelLabel: { ...font.caption, color: colors.ju, fontWeight: '800' },
  chartSelVal: { fontSize: 16, fontWeight: '800', color: colors.ink, marginTop: 2 },
  chartSelChevron: { fontSize: 16, color: colors.ju, marginLeft: space(2) },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: space(4), marginBottom: space(3), ...shadow.card },
  name: { fontSize: 16, fontWeight: '800', color: colors.ink },
  // ★★★ 가장 많이 찾는 배지(daniel 07-05) — 골드 필, 이름 위 작게
  hotBadge: { alignSelf: 'flex-start', backgroundColor: colors.badgeGold, borderRadius: radius.pill, paddingHorizontal: space(2), paddingVertical: 1, marginBottom: 3, overflow: 'hidden' },
  hotBadgeTx: { color: colors.bg, fontSize: 10, fontWeight: '900', letterSpacing: 0.2 },
  thumb: { width: 46, height: 64, borderRadius: radius.md, marginRight: space(3), backgroundColor: colors.sunk }, // 마켓 리스트 카드 썸네일(작게·daniel)
  // 신규 콘텐츠 NEW 배지 — 우측 상단·연한 빨강(daniel 07-22). newBadge.NEW_SINCE 출시+21일 자동.
  newTag: { position: 'absolute', top: space(2), right: space(2), zIndex: 3, backgroundColor: '#F16C6C', borderRadius: radius.pill, paddingHorizontal: space(1.75), paddingVertical: space(0.25) },
  newTagTx: { color: '#FFFFFF', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  desc: { ...font.caption, color: colors.inkSoft, marginTop: 2, marginBottom: 1, lineHeight: 16 }, // 설명 아랫줄(홈과 동일)
  price: { ...font.caption, color: colors.ju, fontWeight: '800', marginTop: 2 },
  have: { ...font.caption, color: colors.inkFaint, marginTop: 2 },
  haveOn: { color: colors.ju, fontWeight: '800' },
  // marginLeft = 텍스트(제목·설명·가격) 컨테이너(flex:1)와 구매/열기 버튼 사이 gutter 확보.
  //   flex:1 컨테이너가 이 여백만큼 줄어들어 긴 설명(numberOfLines=2)이 버튼에 닿지 않고 그 안에서 줄바꿈된다(daniel 07-07 IMG_7980: '별자리 운세' 긴 설명↔구매 버튼 밀착 수정).
  buyBtn: { backgroundColor: colors.ju, borderRadius: radius.pill, paddingHorizontal: space(5), paddingVertical: space(2.5), minWidth: 84, alignItems: 'center', marginLeft: space(4) },
  buyBtnBusy: { opacity: 0.5 },
  coinCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.juLine, paddingVertical: space(3), paddingHorizontal: space(4), marginBottom: space(3), ...shadow.card },
  coinLabel: { ...font.caption, color: colors.inkSoft, fontWeight: '800', letterSpacing: 0.4 },
  coinNum: { ...font.display, color: colors.ju, fontWeight: '900', fontSize: 22, marginTop: 1 },
  chargePill: { backgroundColor: colors.ju, borderRadius: radius.pill, paddingVertical: space(2), paddingHorizontal: space(3.5) },
  chargeTx: { color: colors.bg, fontWeight: '900', fontSize: 13 },
  // ★focus 도착 강조 — '여기가 그 상품' 신호. 색이 아니라 테두리+틴트로(색맹 대비·액센트 남용 방지).
  cardFocus: { borderColor: colors.ju, borderWidth: 2, backgroundColor: colors.juSoft },
  buyTx: { color: colors.bg, fontWeight: '800', fontSize: 14 },
  // 마켓 섹션 제목·설명(프리미엄 포함 / 개별 구매 전용 구분 — daniel) — 골드 톤 heading + 보조 caption
  // ★마켓 주제 필터 칩(daniel 2026-07-25 L)
  topicRow: { marginTop: space(3), marginBottom: space(2) },
  topicRowC: { gap: space(2), paddingRight: space(4) },
  topicChip: { paddingVertical: space(2), paddingHorizontal: space(3.5), borderRadius: radius.pill, backgroundColor: colors.sunk, borderWidth: 1, borderColor: colors.line },
  topicChipOn: { backgroundColor: colors.ju, borderColor: colors.ju },
  topicChipTx: { fontSize: 13, fontWeight: '700', color: colors.inkSoft },
  topicChipTxOn: { color: '#15132E', fontWeight: '800' },
  emptyTopic: { ...font.caption, color: colors.inkSoft, textAlign: 'center', marginTop: space(6), lineHeight: 18 },
  sectionH: { ...font.heading, color: colors.ju, marginTop: space(5), marginBottom: space(1) },
  // ★인기 외곽칸(daniel 07-08) — juSoft 배경 + gold 테두리로 개별섹션 상단 강조.
  hotBox: { borderWidth: 1, borderColor: colors.ju, borderRadius: radius.md, backgroundColor: colors.juSoft, paddingHorizontal: space(2), paddingTop: space(2), paddingBottom: space(1), marginBottom: space(3) },
  hotBoxH: { ...font.heading, color: colors.ju, marginBottom: space(2), paddingHorizontal: space(1) },
  sectionSub: { ...font.caption, color: colors.inkSoft, marginBottom: space(3), lineHeight: 16 },
  // 프리미엄 무제한 배지(섹션 A · 프리미엄 가입 시 가격·구매 버튼 대체) — 골드 외곽선 상태 배지
  //   marginLeft = 텍스트 컨테이너↔무제한 배지 gutter(구매버튼과 동일 space(4)로 통일 — 프리미엄 카드도 설명이 배지에 닿지 않게).
  unlimitedBadge: { backgroundColor: colors.juSoft, borderWidth: 1, borderColor: colors.juLine, borderRadius: radius.pill, paddingHorizontal: space(4), paddingVertical: space(2), marginLeft: space(4), alignItems: 'center' },
  unlimitedTx: { color: colors.ju, fontWeight: '800', fontSize: 13 },
  // 쿠폰 등록
  couponH: { ...font.heading, marginTop: space(6), marginBottom: space(3) },
  couponRow: { flexDirection: 'row', gap: space(2), alignItems: 'center' },
  couponInput: { flex: 1, ...font.body, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, paddingHorizontal: space(3), paddingVertical: space(2.75), color: colors.ink, letterSpacing: 1 },
  couponBtn: { backgroundColor: colors.ju, borderRadius: radius.sm, paddingHorizontal: space(4), paddingVertical: space(2.75) },
  couponBtnOff: { opacity: 0.45 },
  couponBtnTx: { color: colors.bg, fontWeight: '800', fontSize: 14 },
  note: { ...font.caption, color: colors.inkFaint, marginTop: space(4), lineHeight: 18 },
  // 명식 선택 모달
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { backgroundColor: colors.bg, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, paddingHorizontal: space(5), paddingTop: space(2.5), paddingBottom: space(8) },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.line, alignSelf: 'center', marginBottom: space(3) },
  sheetTitle: { ...font.heading, marginBottom: space(2) },
  pickRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: space(3.5), borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  pickTx: { ...font.body, color: colors.inkSoft },
  pickTxOn: { color: colors.ju, fontWeight: '800' },
  pickChk: { fontSize: 16, color: colors.ju, fontWeight: '800' },
});
