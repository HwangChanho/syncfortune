// app/src/app/(app)/market.tsx — 마켓: 적용할 명식 선택 → 풀이 진입 + 쿠폰 등록
// ─────────────────────────────────────────────────────────────────────────
// daniel: 이용권/풀이는 명식별로 적용된다. 마켓에서 ① 적용할 명식을 드롭다운으로 고르고
//   ② 이용권(사주·자미·궁합·타임라인·추가질문·애정)을 누르면 그 명식의 해당 풀이 화면으로 진입
//   (선택 명식을 대표로 설정 → 캐시·서버차트 연결, 거기서 이용권 use_credit·프리미엄·건당구매로 열림).
//   무료 이용권(쿠폰) 등록도 여기로 이동(설정→마켓). ★1회성 소모 — 보유/미보유로만 표시.
// ─────────────────────────────────────────────────────────────────────────
import { View, Text, ScrollView, Pressable, TextInput, StyleSheet, Modal, Image } from 'react-native';
import { PressableScale } from '../../components/PressableScale';
import { Alert } from '../../lib/ui/alert'; // 커스텀 알림(앱 디자인)
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { CREDIT_KINDS, loadCredits, redeemCoupon, waitForCreditGrant, PREMIUM_PRICE, type CreditKind } from '../../lib/billing/coupons';
import { requireLoginForPurchase } from '../../lib/billing/requireLogin'; // C1: 결제=계정 귀속(웹훅 적립엔 로그인 필수)
import { listCharts, getRepresentativeId, setRepresentative, loadRepChart, type SavedChart } from '../../lib/engine/myChart';
import { requestChartConfirm } from '../../lib/ui/chartConfirm'; // 구매 전 명식 확인(드롭다운으로 변경 가능)
import { ListSkeleton } from '../../components/Skeleton'; // 첫 진입 로딩 스켈레톤(daniel 07-02: 마켓 즉시 전환+스켈레톤)
import { useDeferredReady } from '../../lib/ui/useDeferredReady'; // 전환 즉시 스켈레톤 → 전환 후 콘텐츠 마운트(멈칫 제거)
import { purchaseCreditRC, purchasesEnabled, priceStringsRC, priceStringRC, CREDIT_PRODUCT, PRODUCT_PREMIUM } from '../../lib/billing/purchases';
import { waitForPremium, markPremiumOwnedNow } from '../../lib/billing/premiumStore'; // 구매 후: 낙관 즉시표시(markPremiumOwnedNow) + 서버 is_premium 확인(waitForPremium) 병행(#6)
import { useSubscription } from '../../lib/billing/subscription'; // 프리미엄 가입 루트(전체 무제한)
import { getPremiumChartIdSnapshot } from '../../lib/billing/premiumStore'; // 프리미엄 지정 명식(어느 명식에 적용 중인지 표기, daniel 07-04)
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
};

// 마켓 목록에서 숨길 이용권(kind) — 아래 섹션 A·B 렌더 필터에서 제외한다(!MARKET_HIDDEN.has).
//   child_couple(자식운·부부) = 솔로(child) 소유자만 /child 안에서 반값 업그레이드로 구매한다. 마켓에 단독 타일로 노출하면
//   솔로 미소유자가 부부(상위 콘텐츠)를 반값에 우회 구매해 솔로 상품을 잠식하므로 목록에서 제외(daniel 07-03).
//     (※ child_couple 은 CREDIT_KINDS 에도 없어 애초에 목록에 안 뜨지만, 방어적으로 함께 둔다.)
//   celeb(세계 인물 매칭) = 온디바이스 결정론·API 0 → 완전 무료 전환(daniel 07-07). 이용권을 사도 화면이 이미 무료라
//     '아무것도 안 주는 유료 판매' = App Store 3.1.1 리젝 리스크 → 마켓 판매 제거(화면은 무료 공개). CreditKind 타입엔 남김(파급 최소).
const MARKET_HIDDEN = new Set<CreditKind>(['child_couple', 'celeb', 'coach']); // coach=AI 코치 질문권은 코치 화면 내에서 구매(마켓 단독카드 X)

// ★가장 많이 찾는 콘텐츠(daniel 07-05) — 수요 폭발 카테고리에 ★★★ 배지로 구미를 당긴다(전환 유도).
//   재회·애정·궁합·신년 = 사람들이 가장 많이 검색·구매하는 연애/시즌 콘텐츠(시장 조사 기반).
const HOT_KINDS = new Set<CreditKind>(['reunion', 'crush', 'love', 'compat', 'newyear', 'jobfit']); // crush(짝사랑)=최다 수요(daniel 07-05) · jobfit=나에게 어울리는 직업(신규 유료 딥리포트, 인기 섹션 노출·daniel 07-13)

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
  const [busy, setBusy] = useState<CreditKind | null>(null); // 구매 진행 중 kind
  const [prices, setPrices] = useState<Record<string, string>>({}); // 현지통화 가격(RC) — 미설정 시 ₩ 폴백
  const { isPremium, purchasePremium, refresh } = useSubscription(); // 프리미엄 상태·구매
  // 프리미엄이 '어느 명식에' 적용 중인지(premium_chart_id 매칭 명식) — 카드에 표기(daniel 07-04). null=미지정(모든 명식 유예).
  const premChartId = getPremiumChartIdSnapshot();
  const premChart = premChartId ? saved.find((c) => String(c.serverChartId) === String(premChartId)) : null;
  const [premPrice, setPremPrice] = useState(''); // 프리미엄 현지통화 가격(RC)
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
  useEffect(() => { priceStringRC(PRODUCT_PREMIUM, `₩${PREMIUM_PRICE.toLocaleString()}`).then(setPremPrice).catch(() => {}); }, []);


  // 프리미엄 가입(평생·전체 무제한) — 결제 미연동 시 '준비 중'. 성공 시 상태 갱신. 취소는 조용히.
  //   daniel: 결제 진행 전 '적용 명식'을 확인 Alert 로 한 번 더 보여준다(오결제 방지). 실제 구매 로직은 내부 함수로 분리.
  async function buyPremium() {
    // 실제 프리미엄 구매(명식 확인 통과 후 호출). target = 확인창에서 고른(변경 가능) 명식.
    async function doBuyPremium(target: SavedChart | null) {
      if (buyingPrem) return;
      if (!purchasesEnabled()) { Alert.alert(t('market.payPending')); return; }
      setBuyingPrem(true);
      try {
        await purchasePremium();
        // ★#6 구매 성공 직후 낙관적 즉시 반영(daniel: '구매했는데 프리미엄이 바로 안 뜸' 체감 제거).
        //   purchasePremium()이 throw 없이 끝났으면 RC 결제가 확정된 것(미결제 아님) → owns=true 로 전 화면(배너·배지·페이월)을
        //   즉시 켠다. 이어지는 waitForPremium(서버 is_premium 폴링)이 서버 권위로 재확인 = 확정되면 유지, 웹훅 미도달이면
        //   다음 refreshPremium(포그라운드 복귀·재로그인)에서 서버값(false)으로 정정된다. 서버가 최종 진실이라 오적용은 자정.
        markPremiumOwnedNow();
        const uid = session?.user?.id;
        const confirmed = uid ? await waitForPremium(uid) : false;
        if (confirmed) {
          // 서버 확인(is_premium=true) → 지정 명식 바인딩(이제 set_premium_chart 성공, 최초 1회·변경은 재결제) + 반영.
          try {
            if (target && session) {
              const scid = await ensureServerChartIdForSaved(target, session);
              if (scid) await supabase.rpc('set_premium_chart', { p_chart_id: scid });
            }
          } catch { /* 지정 실패해도 프리미엄은 확정(유예=전 명식, 추후 재시도) */ }
          await refresh(); // 서버값으로 재평가 — 낙관표시 유지 + pcid(지정 명식) 확정
          Alert.alert(t('settings.premiumOkTitle'), t('settings.premiumOk'));
        } else {
          // 웹훅 미도달(타임아웃) — 낙관표시(markPremiumOwnedNow)는 *유지*한다(결제는 완료). 여기서 refresh() 로 덮지 않는다:
          //   서버 미반영 상태라 refresh 하면 owns=false 로 도로 꺼져 '구매 직후 안 뜸'이 재발한다. 곧 자동 반영
          //   (포그라운드 재평가·다음 진입 시 refreshPremium 이 서버 is_premium 확인 → 유지/정정).
          Alert.alert(t('settings.premiumTitle'), t('market.premiumPending', '결제가 완료됐어요. 반영까지 잠시 걸릴 수 있어요 — 곧 자동으로 적용됩니다.'));
        }
      } catch (e: any) {
        if (e?.message === 'cancelled') return;
        Alert.alert(t('settings.premiumTitle'), e?.message ?? '');
      } finally { setBuyingPrem(false); }
    }
    // 명식이 하나도 없으면(=등록 0개) 먼저 등록 안내 — 명식 기준으로 적용·진입하므로.
    if (!sel) { Alert.alert(t('market.noChart'), t('market.registerChartFirst', '명식을 먼저 등록해 주세요')); return; }
    // ★진행 전 적용 명식 확인 — 드롭다운으로 *다른 명식으로 변경 가능*(daniel 07-02). 확인 시 (변경된) 대표 명식으로 구매.
    //   프리미엄 구매용 문구(daniel 07-03: 풀이 문구 '풀이할까요/볼게요'가 뜨던 버그 → 구매 문구로).
    const ok = await requestChartConfirm({ title: '이 명식에 프리미엄을 적용할까요?', sub: '명식을 눌러 변경할 수 있어요 · 확인하면 결제가 진행돼요', okLabel: '네, 구매할게요' });
    if (!ok) return;
    const target = await loadRepChart();      // 모달에서 고른 명식(대표) = 프리미엄 적용 명식
    if (target) setSel(target);               // 마켓 표시 동기화
    void doBuyPremium(target ?? sel);
  }

  // 이용권 적용 — 선택 명식을 대표로 설정 후 해당 풀이 화면으로(거기서 이용권/프리미엄/구매로 열림).
  async function apply(kind: CreditKind) {
    if (sel) await setRepresentative(sel.id);
    const r = ROUTE[kind];
    router.navigate({ pathname: r.pathname, params: r.kind ? { kind: r.kind } : {} }); // navigate=정적 /reading 중복 스택 dedup(daniel 07-01)
  }

  // 이용권 구매(결제) — RevenueCat 소비성 결제 성공 → 크레딧 +1(웹훅 전 클라 반영) → 보유 갱신.
  //   RC 미설정(키/네이티브 미포함) 시 '준비 중' 안내. 사용자 취소는 조용히 무시.
  async function buy(kind: CreditKind) {
    if (busy) return;
    if (!purchasesEnabled()) { Alert.alert(t('market.payPending')); return; }
    // ★C1: 결제는 계정에 귀속(웹훅이 그 계정에 적립) → 로그인 필수. 비로그인 결제는 웹훅이 적립할 수 없어 유실.
    if (!requireLoginForPurchase(session, () => router.push('/login'), t)) return;
    setBusy(kind);
    try {
      const before = credits[kind] ?? 0;         // 결제 전 잔여(웹훅 반영 판정 기준 — 마켓 buy 는 미보유에서만 진입해 보통 0)
      const ok = await purchaseCreditRC(kind);   // 결제 성공 시 true(취소=false)
      if (ok) {
        // ★C1 보안(daniel 07-03): 클라 grant_credit 직접 적립 폐지(위변조 차단) — 영수증 검증된 RC 웹훅만 적립.
        //   결제 성공 → 웹훅이 서버에 적립할 때까지 폴링(loadCredits). 반영되면 보유 갱신, 지연되면 '적용 중' 안내.
        const { granted, credits: fresh } = await waitForCreditGrant(kind, { baseline: before });
        setCredits(fresh);
        Alert.alert(t('market.doneTitle'), granted
          ? t('market.doneMsg')
          : t('market.applyPending', '결제가 완료됐어요. 이용권 적용까지 잠시 걸릴 수 있어요. 잠시 후 새로고침해 주세요.'));
      }
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

    // 프리미엄 포함 섹션 + 프리미엄 가입 = 무제한(가격/구매 숨김, 카드 전체가 열기 버튼)
    if (premInc && isPremium) {
      return (
        <PressableScale key={c.key} style={styles.card} onPress={() => apply(c.key)} disabled={!sel}>
          {card && <Image source={card.img} style={styles.thumb} />}
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{c.ko}</Text>
            {card && <Text style={styles.desc} numberOfLines={2}>{t(card.desc)}</Text>}
            {/* 개별 구매가 노출(daniel 07-03: 프리미엄 상품도 개별구매 가능하니 금액 표시) — 프리미엄 유저는 무제한이라 참조용 */}
            <Text style={styles.price}>{prices[c.key] ?? `₩${c.price.toLocaleString()}`} {t('market.perItem', '개별')}</Text>
          </View>
          <View style={styles.unlimitedBadge}>
            <Text style={styles.unlimitedTx}>{t('market.unlimited', '무제한 이용 중')}</Text>
          </View>
        </PressableScale>
      );
    }

    // 기존 동작(현행 그대로): 보유 시 열기(apply) / 미보유 시 개별 구매(buy)
    return (
      <View key={c.key} style={styles.card}>
        {card && <Image source={card.img} style={styles.thumb} />}
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{c.ko}</Text>
          {card && <Text style={styles.desc} numberOfLines={2}>{t(card.desc)}</Text>}
          <Text style={styles.price}>{prices[c.key] ?? `₩${c.price.toLocaleString()}`}</Text>
          <Text style={[styles.have, owned && styles.haveOn]}>{owned ? `${t('market.owned')} ×${credits[c.key]}` : t('market.notOwned')}</Text>
        </View>
        {owned ? (
          <PressableScale style={styles.buyBtn} onPress={() => apply(c.key)} disabled={!sel}>
            <Text style={styles.buyTx}>{t('market.openApply')}</Text>
          </PressableScale>
        ) : (
          <PressableScale style={[styles.buyBtn, busy === c.key && styles.buyBtnBusy]} onPress={() => buy(c.key)} disabled={busy !== null}>
            <Text style={styles.buyTx}>{busy === c.key ? '…' : t('market.buy')}</Text>
          </PressableScale>
        )}
      </View>
    );
  }

  // ★첫 진입 즉시 마켓뷰 전환 + 로딩까지 스켈레톤(daniel 07-02) — 전환 애니 끝난 뒤 무거운 카드·RC 가격 마운트.
  if (!ready) return <ScrollView style={styles.screen} contentContainerStyle={styles.wrap}><ListSkeleton rows={6} /></ScrollView>;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      <Text style={styles.intro}>{t('market.intro')}</Text>
      {/* ★보유기한 1년 명시(daniel: 법적 — 약관 제4조 3항과 일치) — 비프리미엄에게만(프리미엄=무제한 보유라 불필요) */}
      {!isPremium && <Text style={styles.retention}>{t('market.retentionNote', '구매한 풀이는 구매일로부터 1년간 보유되며, 1년이 지나면 자동 삭제됩니다. 이후 다시 보려면 재구매가 필요해요.')}</Text>}

      {/* 프리미엄 — 명식 무관(전체 무제한). 비프리미엄=가입 카드 / 프리미엄=이용 중 표시(항상 노출) */}
      {isPremium ? (
        <View style={styles.premCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.premTitle}>{t('market.premiumActive', '프리미엄 이용 중')}</Text>
            <Text style={styles.premSub}>{t('market.premiumActiveSub', '모든 콘텐츠 무제한 · 광고 제거 적용 중')}</Text>
            {/* ★프리미엄이 어느 명식에 적용 중인지 표기(daniel 07-04) — premium_chart_id 매칭 명식. 미지정이면 모든 명식(유예). */}
            <Text style={styles.premChart}>{t('market.appliedChart', '적용 명식')}: {premChart?.label ?? t('market.allChartsGrace', '모든 명식(미지정)')}</Text>
          </View>
          <Text style={styles.premPrice}>✓</Text>
        </View>
      ) : (
        <PressableScale style={styles.premCard} onPress={buyPremium} disabled={buyingPrem}>
          <View style={{ flex: 1 }}>
            <Text style={styles.premTitle}>{t('settings.premiumBuy', '평생 프리미엄')}</Text>
            <Text style={styles.premSub}>{t('settings.premiumDesc', '모든 콘텐츠 무제한 · 광고 제거')}</Text>
            {/* 적용 명식 안내(daniel) — 결제 전 어느 명식으로 진행되는지 작은 글씨로 노출 */}
            <Text style={styles.premChart}>{t('market.appliedChart', '적용 명식')}: {sel?.label ?? t('market.noChart')}</Text>
          </View>
          <Text style={styles.premPrice}>{buyingPrem ? '…' : (premPrice || `₩${PREMIUM_PRICE.toLocaleString()}`)}</Text>
        </PressableScale>
      )}

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

      {/* ── 섹션 A: 프리미엄에 포함 ── 프리미엄=무제한 이용 중 배지 / 비프리미엄=가격+개별구매(기존). 타임라인도 여기 포함(daniel 2026-07-01, 사주+자미 종합). */}
      <Text style={styles.sectionH}>{t('market.sectionIncluded', '✦ 프리미엄에 포함')}</Text>
      <Text style={styles.sectionSub}>{t('market.sectionIncludedSub', '프리미엄 가입 시 아래 풀이를 명식 수 제한 없이 무제한 이용해요(개별 구매도 가능).')}</Text>
      {CREDIT_KINDS.filter((c) => PREMIUM_KINDS.has(c.key) && !MARKET_HIDDEN.has(c.key)).map((c) => renderCard(c, true))}

      {/* ── 섹션 B: 개별 구매 전용(프리미엄 미포함) ── isPremium 무관 항상 개별 구매(기존) */}
      <Text style={styles.sectionH}>{t('market.sectionIndividual', '◆ 개별 구매 전용 · 프리미엄 미포함')}</Text>
      <Text style={styles.sectionSub}>{t('market.sectionIndividualSub', '아래 항목은 프리미엄에 포함되지 않아 개별 구매해야 합니다.')}</Text>
      {/* ★인기 외곽칸(daniel 07-08) — 개별 섹션 상단에 수요 많은 유료 콘텐츠를 박스로 강조(홈 '인기'와 동일 개념). 아래 목록에선 중복 제외. */}
      <View style={styles.hotBox}>
        <Text style={styles.hotBoxH}>{t('market.hotSection', '🔥 인기')}</Text>
        {CREDIT_KINDS.filter((c) => HOT_KINDS.has(c.key) && !PREMIUM_KINDS.has(c.key) && !MARKET_HIDDEN.has(c.key)).map((c) => renderCard(c, false))}
      </View>
      {CREDIT_KINDS.filter((c) => !PREMIUM_KINDS.has(c.key) && !MARKET_HIDDEN.has(c.key) && !HOT_KINDS.has(c.key)).map((c) => renderCard(c, false))}

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
  desc: { ...font.caption, color: colors.inkSoft, marginTop: 2, marginBottom: 1, lineHeight: 16 }, // 설명 아랫줄(홈과 동일)
  price: { ...font.caption, color: colors.ju, fontWeight: '800', marginTop: 2 },
  have: { ...font.caption, color: colors.inkFaint, marginTop: 2 },
  haveOn: { color: colors.ju, fontWeight: '800' },
  // marginLeft = 텍스트(제목·설명·가격) 컨테이너(flex:1)와 구매/열기 버튼 사이 gutter 확보.
  //   flex:1 컨테이너가 이 여백만큼 줄어들어 긴 설명(numberOfLines=2)이 버튼에 닿지 않고 그 안에서 줄바꿈된다(daniel 07-07 IMG_7980: '별자리 운세' 긴 설명↔구매 버튼 밀착 수정).
  buyBtn: { backgroundColor: colors.ju, borderRadius: radius.pill, paddingHorizontal: space(5), paddingVertical: space(2.5), minWidth: 84, alignItems: 'center', marginLeft: space(4) },
  buyBtnBusy: { opacity: 0.5 },
  buyTx: { color: colors.bg, fontWeight: '800', fontSize: 14 },
  // 마켓 섹션 제목·설명(프리미엄 포함 / 개별 구매 전용 구분 — daniel) — 골드 톤 heading + 보조 caption
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
