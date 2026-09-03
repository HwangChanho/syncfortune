// app/src/screens/MyeongsikScreen.tsx — 명식·성반 표시 (미드나잇 테마, glass-box, 다국어)
// ─────────────────────────────────────────────────────────────────────────
// 온디바이스 결정론 명식을 날것으로 보여줌(태그 압축 X — 기획서 §9). 무료 신뢰 훅.
// ★ 전통 사주 표기: 오른쪽이 년주 — 표시 순서 시·일·월·년(왼→오) = 오른쪽 년.
// ★ 디테일: 각 기둥 = 천간십신·천간·지지·지지십신·12운성·지장간·통근(PillarData 전부).
//   하단 = 지장간 상세(stem+십신)·대운/세운·합충·신살·자미두수.
// 시각 미상(timeAccuracy '미상') = 시주 ✕ + 시주 의존 항목 제외(시각 모르면 시주 불가).
// 일주(日柱) = '나'(일간) → 골드 강조. 용신·통변은 별도(하단 "풀이 보기").
// ─────────────────────────────────────────────────────────────────────────
import { useMemo, useState, useEffect, useRef, type ReactNode } from 'react';
import { interactionColor, INTERACTION_ORDER } from '../lib/content/interactionColor';
import { View, Text, ScrollView, StyleSheet, Pressable, Modal, Animated, LayoutAnimation, Platform, UIManager, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';                    // 잔액 부족 시 충전 화면으로
import { Alert } from '../lib/ui/alert';                  // ★RN Alert 아님 — 웹에서도 뜨고, 연타로 겹치지 않게 큐를 탄다
import { PressableScale } from '../components/PressableScale';
import { RelatedContent } from '../components/RelatedContent';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { computeChart } from '../lib/engine/engine';
import type { GlyphSwapMode } from '@engine/glyphSwap';                  // 「충/합 글자 바꿔 보기」 렌즈(Boss 2026-09-01)
import { isUnlocked, markUnlocked } from '../lib/billing/unlocks';        // (명식×기능) 영구 언락 — 로컬+서버 권위
import { unlockChartFeature } from '../lib/billing/coins';               // 운 차감 + 언락 기록을 한 트랜잭션으로
import { FEATURE_UNLOCKS } from '../lib/billing/coinPrices';             // 표기용 가격(실제 차감액은 서버가 정한다)
import { IljuTabCard } from '../components/IljuTabCard';   // 일주론 탭(Boss 2026-08-25)
import { GaeunCard } from '../components/GaeunCard';     // 개운 방향(Boss 2026-08-24) — 용신 카드 바로 아래
import { YongsinCard } from '../components/YongsinCard'; // 만세력 용신(canonical 엔진·억부/병약/조후+희신/기신·Boss 07-22)
import type { ChartInput, PillarPos } from '@spec/chart';
import { useSafeAreaInsets } from 'react-native-safe-area-context';   // ★하단 탭바·홈 인디케이터 여백(daniel 07-29 잘림)
import { colors, radius, space, shadow, font } from '../lib/theme';
import { GlassCard } from '../components/GlassCard';
import { OhaengEnergy } from '../components/OhaengEnergy'; // 오행 에너지 구슬 인포그래픽(팔자 앞·이탈률↓·daniel 기획서①)
import { GzCell } from '../components/GzCell'; // 간지 한 칸(오행색+한자+한글음) — 2026-07-16 추출(커뮤니티 SharedChart와 공유하는 단일 출처)
import { elementPower } from '@engine/elementPower';
import { twelveSinsalAt } from '@engine/sinsal';   // 12신살 — 만세력 표(년지 기준 한 칸씩)
import { LuckNest } from '../components/LuckNest'; // ★운 중첩(벤다이어그램식) — 원국 안쪽·일운→대운 바깥(daniel 2026-08-05) // ★오행 세력 2모드(합화·조후궁성) — daniel 2026-08-05
import { stemElement, branchElement, elementColor, stemReading, branchReading, stemYinYang, branchYinYang, eumYangSkew } from '../lib/engine/ohaeng';
import { johu2, johuLabel } from '@engine/johu2'; // ★조후 **정본** — 상담가 판정을 반영한 쪽(아래 주석)
import { ELEMENT_SKEW, tengodSkew, YINYANG_SKEW, JOHU_SKEW, JOSEUP_SKEW, CONCEPT_INFO, type SkewItem } from '../lib/content/skewKnowledge';
import { useFontScale } from '../lib/ui/fontScale'; // 글자 크기(설정) — 명식 글자까지 모든 텍스트에 적용(daniel)
import { hasSidebar } from '../lib/ui/wideLayout'; // 면 판단(웹·태블릿·폰) 단일 출처
import { emph } from '../lib/ui/richText'; // 콘텐츠 *별표 강조* → bold 렌더(CONCEPT_INFO 개념설명, daniel 2026-07-07)
// ⚠️ 전환 지연(useDeferredReady/ChartSkeleton)은 이 컴포넌트 *내부에서 조기 return* 하면 안 된다 —
//   본문 곳곳(140·145~·282…)에 useState 가 있어, ready false→true 재렌더 시 hook 수가 바뀌어
//   "Rendered more hooks than during the previous render" 크래시(06-29). 지연은 *래퍼*(charts/myeongsik 라우트)가
//   마운트 자체를 늦춰 담당한다(컴포넌트는 마운트되면 항상 전체 hook 실행).

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
// ⚠️ expo-haptics 는 네이티브 모듈 — 현재 dev 빌드에 미포함이면 impactAsync 호출 시 크래시(2026-06).
//   안전 래퍼로 감싼다(네이티브 없으면 조용히 무시). 재빌드(npx expo run:ios) 후 진동 정상 동작.
const haptic = () => { try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); } catch { /* 네이티브 미포함 — 무시 */ } };
import { LuckSinsalLine } from '../components/LuckSinsal';
import { HIDDEN, computeMonthDays, branchTenGod, daeunForward } from '@engine/saju'; // 지장간 표 + 일운(流日) + 지지십신 + 대운 순역
import { twelveStage } from '@engine/twelve';                          // 임의 지지 12운성(타임라인용)
import { detectInteractionsAmong, interactionLabel } from '@engine/structure';   // 합충 검출 + 짝이름 라벨(daniel: 유축반합·정신극)
import { detectGyeokguk } from '../lib/engine/gyeokguk';                                 // 핵심 격(살인상생·식신제살 등) 검출 — daniel
import { TWELVE_SINSAL_ALIAS, lookupGlossary, GLOSSARY_KIND_LABEL, type GlossaryKind } from '../lib/content/myeongriGlossary'; // 클릭 설명
import { playSound } from '../lib/ui/sounds';
import { PILLAR_DISPLAY_ORDER } from '../lib/ui/pillarOrder'; // ★명식 표기 순서 단일 소스(오른쪽=년주)
// ★명리 용어의 표시 글자(Boss 2026-08-27 *"명리 용어는 한자 그대로 두고 설명만 그 언어로"*).
//   한국어면 그대로, 그 밖의 언어면 **한자**. 번역하지 않는다 — 용어는 고유명이다.
import { termLabel } from '../lib/ui/termLabel';
import Svg, { Path, Rect, Circle, Text as SvgText, G } from 'react-native-svg';

// 전통 표기 — 오른쪽이 년주: 시(왼) ← 일 ← 월 ← 년(오른쪽)
// ★순서는 단일 소스에서 온다(`lib/ui/pillarOrder`). 여기 사본을 두면 화면마다 방향이 갈린다 —
//   실제로 벤다이어그램(LuckNest)이 반대로 나갔던 자리다(2026-08-16).
const POS: PillarPos[] = PILLAR_DISPLAY_ORDER;



/**
 * 엔진(`johuSkew`·`joSeupSkew`)이 붙여 주는 꼬리말 — 화면에선 떼고 쓴다.
 *
 * ⚠️★이건 **엔진이 만든 글자**라 번역 대상이 아니다. 다만 화면이 잘라 쓰므로 이름을 준다
 *   (문자열을 두 군데에 그대로 적으면 엔진이 꼬리말을 바꿀 때 한쪽만 남는다).
 */

// 만세력 카테고리 탭(daniel 07-13 재편) — 사주원국(팔자+지장간+합충+신살길성 통합)/운세(대운·세운·월운·일운)/오행·강약/자미두수.
type MyeongTab = 'wonguk' | 'rel' | 'elem' | 'ilju' | 'ziwei';  // rel = 운세 전용(구 '사주관계' → 운세). 합충·신살은 wonguk으로 흡수.
// ⚠️★모듈 상수라 `t()` 를 여기서 못 부른다(훅 밖·언어가 정해지기 전이다).
//   ⇒ **키만** 담고, 그릴 때 푼다. 문구 본문은 `copy/ko.ts`·`en.ts`·`ja.ts` 의 `ms.` 항목에 있다.
// ★`label` 도 **키**다(종전엔 한국어가 박혀 있었다) — 그릴 때 `t()` 로 푼다.
//   ⚠️용어가 **이어 붙은 이름**(원국·운세)이라 `termLabel()` 로 조립하지 않는다 —
//   조각을 붙이면 언어마다 가운뎃점·띄어쓰기가 달라 오히려 어색해진다.
//   ⇒ `copy/en.ts`·`ja.ts` 에 **한자 그대로** 적어 둔다(Boss 규칙: 용어는 번역하지 않는다).
const MYEONG_TABS: { id: MyeongTab; label: string; desc: string }[] = [
  // ★사주원국 + 운세 통합(daniel 2026-07-24) — 원국(팔자·지장간·합충·신살)과 운세(대운·세운·월운·일운)를 한 탭에서. 겹치던 원국 표시 중복 제거.
  { id: 'wonguk', label: 'ms.tabNatal', desc: 'ms.tabNatalDesc' },
  { id: 'elem', label: 'ms.tabElem', desc: 'ms.tabElemDesc' },
  // ★일주론(Boss 2026-08-25) — 자미두수 **앞**에 둔다. 사주를 읽는 흐름이 원국 → 오행 → 일주 이고,
  //   자미두수는 *별개 체계*라 맨 뒤가 맞다.
  { id: 'ilju', label: 'ms.tabIlju', desc: 'ms.tabIljuDesc' },
  { id: 'ziwei', label: 'ms.tabZiwei', desc: 'ms.tabZiweiDesc' },
];
let lastMyeongTab: MyeongTab = 'wonguk';   // 선택 탭 기억(세션 내 — 나갔다 와도 분류 유지, daniel)

// 신강/신약 특징(신강약 섹션 탭 → 상세 시트). ★명리 stance = daniel 검수 슬롯. en/ja i18n 은 검수 후.
const STRENGTH_INFO: { key: '신강' | '신약'; title: string; traits: string; strong: string; caution: string; yongsin: string }[] = [
  { key: '신강', title: 'ms.strongTitle',
    traits: 'ms.strongWhat',
    strong: 'ms.strongGood',
    caution: 'ms.strongCare',
    yongsin: 'ms.strongKey' },
  { key: '신약', title: 'ms.weakTitle',
    traits: 'ms.weakWhat',
    strong: 'ms.weakGood',
    caution: 'ms.weakCare',
    yongsin: 'ms.weakKey' },
];

type MyeongsikProps = {
  /**
   * 친구에게서 담아 온 **이미 계산된** 명식(Boss 2026-08-31).
   * ⚠️있으면 `input` 은 껍데기다 — 생년월일이 안 넘어오므로(생일 역산 차단) **계산 금지**.
   */
  friendSaju?: unknown;
  input: ChartInput | null;
  /**
   * 지금 보고 있는 명식의 서버 id — **유료 언락(충/합 렌즈)에만** 쓴다.
   * ⚠️없으면(미저장·친구 명식) 렌즈 버튼을 **아예 안 그린다** — 살 수 없는 것을 보여 주지 않는다.
   */
  chartId?: string | null;
  onReading?: () => void; onSinsal?: () => void; header?: ReactNode; whoName?: string | null };

/**
 * 명식 화면 — **껍데기**.
 *
 * ⚠️★왜 껍데기가 따로 있나 (2026-08-19 크래시 수정)
 *   본체는 훅을 30개 쓴다. 종전엔 그 **한가운데**에 `if (!c) return <명식 없음/>` 이 있었다 —
 *   명식이 없을 땐 훅 15개만 돌고, 등록하면 30개가 된다.
 *   React 는 렌더마다 훅 개수가 달라지면 **"Rendered more hooks than during the previous render"**
 *   로 화면을 통째로 죽인다(= 「화면을 그리다 문제가 생겼어요」).
 *   ⇒ 판정을 **훅보다 앞**으로 빼서, 명식이 없으면 본체 자체를 마운트하지 않는다.
 *     이러면 본체는 언제나 명식이 있는 상태로만 돌아 훅 개수가 흔들리지 않는다.
 *   ★1527줄을 쪼개지 않고 고칠 수 있는 가장 작은 방법이다(`check:hookorder` 가 지킨다).
 */
export function MyeongsikScreen(props: MyeongsikProps) {
  const { t } = useTranslation();
  if (!props.input) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'transparent' }}>
        <Text style={font.body}>{t('myeongsik.noChart')}</Text>
      </View>
    );
  }
  return <MyeongsikBody {...props} input={props.input} />;
}

function MyeongsikBody({ input, friendSaju, onReading, onSinsal, header, whoName, chartId }: MyeongsikProps & { input: ChartInput }) {
  const { t, i18n } = useTranslation();
  /**
   * 명리 **용어**의 표시 글자 — 한국어면 그대로, 그 밖의 언어면 한자.
   * Boss 2026-08-27: *"명리 용어는 한자 그대로 두고 설명만 그 언어로"*
   * ★번역하지 않는 이유는 `lib/ui/termLabel.ts` 머리말에 있다(용어는 뜻풀이가 아니라 고유명).
   */
  const T = (k: string) => termLabel(k, i18n.language);
  /**
   * 제목 아래 한 줄 — 생년월일(+음력 표기) · 시각(또는 미상) · 출생지(또는 미상).
   *
   * ⚠️★`t()` 를 쓰므로 **훅 뒤**에 있어야 한다(종전엔 위에 있어서 한국어가 박혀 있었다).
   *   `input.calendar === '음'` 처럼 **비교 대상**은 엔진 값이라 그대로 둔다 — 그건 화면 글자가 아니다.
   */
  const birthMeta = (() => {
    const [d = '', tm = ''] = String(input.birthDateTime ?? '').split(' ');
    const date = d.replace(/-/g, '.');
    const cal = input.calendar === '음' ? ` (${t('ms.lunar', '음력')})` : '';
    const time = input.timeAccuracy === '미상'
      ? t('ms.timeUnknown', '시 미상')
      : `${tm}${input.timeAccuracy === '추정' ? ` (${t('ms.approx', '추정')})` : ''}`;
    const place = (input.birthPlace ?? '').trim() || t('ms.placeUnknown', '출생지 미상');
    return [date + cal, time, place].filter(Boolean).join(' · ');
  })();
  /**
   * ★★넓은 화면에서 **본문을 두 칸 폭으로 넓힌다** (Boss 2026-09-01
   *   *"웹 기준에서 만세력에 빈칸이 너무커"*).
   *
   * ■ ⚠️처음엔 «원국 왼쪽 · 오행 오른쪽» 으로 **블록을 두 칸에 나누려** 했다. 세 번 시도했고
   *   세 번 다 실측에서 막혔다 — 기록해 둔다(다음 사람이 같은 길을 안 가게):
   *     ①`columnCount` — RN Web 은 모든 View 를 `display:flex` 로 깐다. **다단이 무시된다.**
   *     ②`display:'block'` 으로 살렸더니 **내가 칸을 못 고른다**(다단은 «넘치면 다음 칸»).
   *     ③`flexWrap` + `order` — 줄바꿈이 **줄 단위**라 왼쪽이 끝나야 오른쪽이 시작된다.
   *   ★진짜 두 칸을 만들려면 JSX 를 옮겨 묶어야 하는데, 이 화면은 블록이 번갈아 있고
   *     사이사이에 코드가 끼어 있다(실측: 한 자리에만 114줄). **깨질 위험이 이득보다 크다.**
   * ⇒ 지금은 «빈칸이 크다» 를 **폭으로** 푼다 — 본문 상한을 넓혀 좌우 여백을 줄인다.
   *   ★2열 재배치는 이 화면을 **블록 단위로 쪼갠 뒤**에 하는 것이 맞다(별건).
   */
  const { width: winW } = useWindowDimensions();
  const wide = hasSidebar(winW, Platform.OS);
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<MyeongTab>(lastMyeongTab === 'rel' ? 'wonguk' : lastMyeongTab); // 'rel'(구 운세 탭)은 wonguk 으로 통합(daniel 07-24) — 저장값 방어
  const [catDescOpen, setCatDescOpen] = useState(false); // 카테고리 ? 설명 시트(daniel: 설명도 나오게)
  useEffect(() => { lastMyeongTab = activeTab; }, [activeTab]); // 선택 탭 기억 — 나갔다 와도 유지(daniel)
  const [strengthOpen, setStrengthOpen] = useState(false); // 신강·신약 특징 시트
  const [elemHidden, setElemHidden] = useState(false); // 오행분포에 지장간(支藏干) 오행 포함 토글(daniel)
  const [luckView, setLuckView] = useState<'cols' | 'nest'>('cols'); // 운세 표시 모드 — 옆으로(기존 그리드)/벤다이어그램(중첩). daniel 2026-08-05
  const [pwHap, setPwHap] = useState(false);       // 오행 세력: 합에 따른 오행 변화(化) 적용
  const [pwJohu, setPwJohu] = useState(false);     // 오행 세력: 조후(왕상휴수)+궁성 보정 적용
  const [johuOpen, setJohuOpen] = useState(false); // 조후·음양 쏠림 시트(daniel)
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(10)).current;
  // 대운·세운·월운 타임라인 = 오른쪽(과거)→왼쪽(미래) 흐름(전통 명식). 초기엔 오른쪽 끝(과거 시작)을 보여준다.
  const luckScrollRef = useRef<ScrollView>(null);
  const seunScrollRef = useRef<ScrollView>(null);
  const monthScrollRef = useRef<ScrollView>(null);
  // 현재(대운/세운/월운) 셀을 가로 스크롤 *가운데*로(daniel) — 선택/현재 셀의 onLayout 위치(x,w)와 뷰 너비(v)를 재서 scrollTo 중앙. 미측정 시 끝으로 폴백.
  const centerM = useRef<Record<string, { v: number; x: number; w: number }>>({ luck: { v: 0, x: 0, w: 0 }, seun: { v: 0, x: 0, w: 0 }, month: { v: 0, x: 0, w: 0 } });
  const recenter = (key: 'luck' | 'seun' | 'month', ref: any) => {
    const m = centerM.current[key];
    if (!ref.current) return;
    if (m.v && m.w) ref.current.scrollTo({ x: Math.max(0, m.x + m.w / 2 - m.v / 2), animated: false });
    else ref.current.scrollToEnd({ animated: false });
  };

  useEffect(() => {
    playSound('transition');
    fadeAnim.setValue(0);
    slideAnim.setValue(10);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, [activeTab]);

  /**
   * ★친구에게서 담아 온 명식은 **계산하지 않는다**(Boss 2026-08-31).
   *   생년월일이 안 넘어오므로(암호화 · 생일 역산 차단) `input` 은 껍데기다 —
   *   ⚠️그걸로 `computeChart` 를 돌리면 **엉뚱한 명식**이 나온다.
   *   ⇒ 서버가 이미 계산해 둔 것을 그대로 쓴다.
   */
  /**
   * ★★「충/합 글자 바꿔 보기」 (Boss 2026-09-01) — 원국 여덟 글자를 각자의 짝으로 갈아 끼운
   *   «거울 명식». `null` = 원국 그대로.
   * ■ ★왜 여기 한 곳에서 거나 — `computeChart` 입력에 태우면 **십신·지장간·통근·12운성·신살·
   *   오행분포·용신이 전부 저절로 따라온다**(Boss: "거기에 맞게 내용 십신등 변경해줘").
   *   화면 아래쪽에서 글자만 바꿔 그리면 속이 안 맞는 명식이 된다.
   * ■ ⚠️친구에게서 담아 온 명식은 **못 건다** — 생년월일이 없어 다시 계산할 수 없다(위 주석).
   * ■ ⚠️대운·세운의 **간지는 안 바뀐다**(실측 확인). 십신만 새 일간을 따라간다 — 렌즈니까 맞다.
   */
  const [swapMode, setSwapMode] = useState<GlyphSwapMode | null>(null);
  /**
   * 모드별로 **따로** 산다 (Boss 2026-09-03 *"합보기 충보기는 개별로 비용 발생"*).
   * `null` = 아직 확인 중 · `{chung:boolean, hap:boolean}` = 각각 열렸나.
   */
  const [swapPaid, setSwapPaid] = useState<{ chung: boolean; hap: boolean } | null>(null);
  const [swapBusy, setSwapBusy] = useState(false);                  // 차감 왕복 중 — 두 번 눌림 방지
  const c = useMemo(
    () => (friendSaju
      ? { saju: friendSaju } as ReturnType<typeof computeChart>
      : computeChart(swapMode ? { ...input, glyphSwap: swapMode } : input)),
    [input, friendSaju, swapMode],
  );

  /** 렌즈 값(표기용). 서버가 최종 금액을 정하므로 여기 숫자는 **보여 주기만** 한다. */
  /** 모드별 값(표기용). ★실제 차감액은 서버가 정한다 — 여기 숫자는 보여 주기만 한다. */
  const feeOf = (m: GlyphSwapMode) => FEATURE_UNLOCKS.find((f) => f.kind === m)?.coins ?? 0;
  /**
   * 렌즈를 팔 수 있는 자리인가 — **내 저장된 명식**일 때만.
   * ⚠️친구 명식·미저장 명식은 다시 계산을 못 하거나 차트 id 가 없어 언락 자체가 불가능하다.
   *   그런 자리에 «100 운» 버튼을 띄우면 눌러도 안 되는 버튼이 된다.
   */
  const swapSellable = !friendSaju && !!chartId;

  // 이미 산 명식인지 확인 — 화면에 들어올 때 한 번. ⚠️확인 실패는 `false`(잠김)로 두지 않고
  //   `isUnlocked` 가 서버까지 본 결과를 그대로 쓴다(로컬 없으면 서버 권위).
  useEffect(() => {
    if (!swapSellable || !chartId) { setSwapPaid({ chung: false, hap: false }); return; }
    let alive = true;
    // ★둘을 **따로** 묻는다 — 하나만 샀으면 하나만 열려야 한다
    void Promise.all([isUnlocked(chartId, 'chung'), isUnlocked(chartId, 'hap')])
      .then(([c, h]) => { if (alive) setSwapPaid({ chung: c, hap: h }); });
    return () => { alive = false; };
  }, [swapSellable, chartId]);

  /**
   * 렌즈 켜기 — 안 샀으면 먼저 묻고 차감한다.
   * @param next 켤 모드(`'chung'`·`'hap'`) 또는 `null`(원국으로 되돌리기)
   * ★되돌리기(`null`)는 **언제나 공짜**다 — 잠긴 상태에서도 원국은 볼 수 있어야 한다.
   * ⚠️차감은 서버 `unlock_chart_feature` 한 번. 이미 열렸으면 서버가 `cost 0` 으로 돌려준다(멱등).
   * ⚠️`swapBusy` 로 왕복 중 재입력을 막는다 — 두 번 눌러도 원장엔 한 줄뿐이지만, 화면이 두 번
   *   묻는 것 자체가 «또 결제하나» 로 읽힌다(07-28 사고의 체감 증상).
   */
  const pickSwap = async (next: GlyphSwapMode | null) => {
    if (next === null) { setSwapMode(null); return; }        // 원국으로 되돌리기는 언제나 공짜
    if (swapPaid?.[next]) { setSwapMode(next); return; }      // ★그 모드를 이미 샀다
    if (swapBusy || !chartId) return;
    const ok = await new Promise<boolean>((resolve) => {
      Alert.alert(
        t('ms.swapBuyTitle', '글자 바꿔 보기'),
        t('ms.swapBuyMsg2', {
          what: next === 'chung' ? T('충') : T('합'), coins: feeOf(next),
          defaultValue: '이 명식의 여덟 글자를 {{what}} 짝으로 바꿔 봐요. {{coins}} 운으로 이 명식에서 한 번만 열면 계속 볼 수 있어요.',
        }),
        [{ text: t('common.cancel'), style: 'cancel', onPress: () => resolve(false) },
         { text: t('ms.swapBuyOk', { coins: feeOf(next), defaultValue: '{{coins}} 운으로 열기' }), onPress: () => resolve(true) }],
        () => resolve(false),   // 뒤로가기로 닫아도 대기 Promise 가 남지 않는다
      );
    });
    if (!ok) return;
    setSwapBusy(true);
    try {
      const r = await unlockChartFeature(next, chartId);   // ★모드별로 따로 산다
      if (!r.ok) {
        if (r.reason === 'insufficient') {
          Alert.alert(
            t('coins.needTitle', '운이 조금 모자라요'),
            t('coins.needMsg', { need: r.cost ?? feeOf(next), have: r.balance ?? 0, defaultValue: '이 풀이는 {{need}} 운이 필요해요. 지금 {{have}} 운 있어요.' }),
            [{ text: t('common.cancel'), style: 'cancel' },
             { text: t('coins.charge', '운 충전하기'), onPress: () => router.push('/coins') }],
            () => {},
          );
        } else {
          Alert.alert(t('common.error'), t('common.retryLater', '잠시 후 다시 시도해 주세요.'));
        }
        return;
      }
      await markUnlocked(chartId, next);   // 로컬 도장 — 다음엔 서버 왕복 없이 열린다
      setSwapPaid((p) => ({ chung: false, hap: false, ...(p ?? {}), [next]: true }));
      setSwapMode(next);
    } finally { setSwapBusy(false); }
  };
  const { fs, ls } = useFontScale();
  // ★지장간 동그라미는 **글자 크기에서 파생**시킨다(daniel 2026-07-29 IMG_8302 "아직도 깨지잖아").
  //   원인: 원이 `width/height: 15` **고정**인데 글자는 전역 배율로 커진다(fs 는 2026-07-29 부터 항등).
  //   배율 1.45 에서 글자 13→19px 인데 상자는 15px 그대로라 한자가 원 밖으로 삐져나왔다.
  //   ⚠️StyleSheet 안에서는 훅을 못 쓰므로 **렌더에서 인라인**으로 덮는다.
  //   높이는 글자에 딱 맞추고, **가로는 더 넉넉히**(daniel 2026-07-30 "한자 칸을 옆으로 더 길게해줘").
  //   한자는 폭이 넓어 정사각 원에 넣으면 좌우가 빠듯하다 → 알약(pill) 형태로 여유를 준다.
  const HID_H = ls(13) + 6;                       // 높이 = 글자(13) + 여백
  //   ★가로는 **고정폭을 주지 않는다**(daniel 2026-07-30 "한자 칸을 옆으로 더 길게해줘").
  //   기둥은 flex:1 로 4등분이라 칸당 여유가 ~26pt 뿐 — 고정폭(글자+16)을 주면 큰 배율에서 3칸이 **넘친다**.
  //   → 칸을 flex:1 로 **3등분**하면 기둥 폭을 최대한 쓰면서(=옆으로 길어지고) 절대 넘치지 않는다.
  const HID_BOX = { height: HID_H };
  const styles = useMemo(() => makeStyles(fs), [fs]);     // fs 적용 스타일 — 명식 글자 포함 모든 텍스트 스케일

  const timeUnknown = input?.timeAccuracy === '미상'; // 시각 모름 → 시주 마스킹
  const P = c.saju.pillars;
  const dm = c.saju.dayMaster.stem;   // 일간 — 시간층(대운·세운·월운) 지지십신·12운성 산출 기준
  const s = c.saju as any; // currentLuck/annual 옵셔널 접근
  const visiblePos = POS.filter((p) => !(p === '시' && timeUnknown)); // 시각 미상 시 시주 제외
  // 통근(通根): 투출 천간(일간 포함)이 어느 지지 지장간에 같은 오행으로 뿌리내렸나 (일간뿐 아니라 재관도)
  const allGan = visiblePos.map((p) => P[p].stem);
  // 오행 분포 (천간+지지 카운트) — daniel: elemHidden 토글 시 각 지지의 지장간(支藏干) 오행도 합산(숨은 기운까지 본 분포)
  const elem: Record<string, number> = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
  visiblePos.forEach((p) => {
    elem[stemElement(P[p].stem)]++;
    elem[branchElement(P[p].branch)]++;
    if (elemHidden) P[p].hiddenStems.forEach((h) => { elem[stemElement(h.stem)]++; });
  });
  // ★오행 세력 2모드(daniel 2026-08-05) — 보정 켜면 '개수'가 아니라 '세력치 %' 로 그린다.
  //   판정 재료는 전부 엔진(합화 성립=transformSupported·궁성=POS_WEIGHT 사상·조후=왕상휴수 통설표).
  const pwLabels = elementPower(c.saju, { hap: false, johuGung: false }).labels; // 발달/과다/부재(개수 기준·모드 무관)

  // ① 오행별 십성(daniel) — 일간 오행 기준 각 오행의 십성(대분류: 비겁/식상/재성/관성/인성)
  const dayElem = stemElement(P['일'].stem);
  const ELEM_GEN: Record<string, string> = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' }; // 상생
  const ELEM_CTRL: Record<string, string> = { 木: '土', 火: '金', 土: '水', 金: '木', 水: '火' }; // 상극
  // ★반환값이 **그대로 화면에 뜬다** ⇒ 용어 표(`T`)를 태운다.
  //   한국어면 「비겁」, 그 밖의 언어면 「比劫」 — 번역하지 않는다(Boss 규칙).
  const elemTenGod = (el: string): string => {
    if (el === dayElem) return T('비겁');
    if (ELEM_GEN[dayElem] === el) return T('식상');   // 일간이 생함
    if (ELEM_CTRL[dayElem] === el) return T('재성');  // 일간이 극함
    if (ELEM_CTRL[el] === dayElem) return T('관성');  // 일간을 극함
    if (ELEM_GEN[el] === dayElem) return T('인성');   // 일간을 생함
    return '';
  };
  // 합충형해 선 (원국 — 쌍(2자)·삼합국/방합국(3자) 모두, 전 멤버가 표시 중일 때만)
  const [rowW, setRowW] = useState(0);
  const luckCycles: any[] = (c.saju as any).luckCycles ?? [];          // 전체 대운(과거~미래)
  const curLuckIdx = Math.max(0, luckCycles.findIndex((l) => l.isCurrent));
  const now = new Date();                                              // 대운/세운/월운/일운 기본 = 오늘
  const curSeunIdx = Math.max(0, ((luckCycles[curLuckIdx]?.annuals ?? []) as any[]).findIndex((a) => a.year === now.getFullYear()));
  const [selLuck, setSelLuck] = useState(curLuckIdx);                  // 선택된 대운 → 세운 드릴다운(기본=현재 대운)
  const [selSeun, setSelSeun] = useState(curSeunIdx);                 // 선택된 세운(기본=올해)

  /**
   * ★오행 분포에 **운을 얹어 본다**(Boss 2026-08-25 *"대운 세운별로 선택해서 확인"*).
   *   'natal' 원국만 · 'luck' +대운 · 'both' +대운·세운.
   *   ⚠️어느 대운·세운인지는 **운세 띠의 선택**(`selLuck`·`selSeun`)을 그대로 따라간다 —
   *     여기 별도 선택기를 만들면 같은 것을 두 곳에서 고르게 되어 어긋난다.
   */
  const [elemSpan, setElemSpan] = useState<'natal' | 'luck' | 'both'>('natal');
  /**
   * 시점 고르기 시트 (Boss 2026-08-27
   *   *"여기서 대운 세운을 특정 시점으로 지정할수 있어야해 모바일의경우 뷰를 새로 올리던지 해서"*).
   *
   * ★★**출처는 그대로 하나**다 — 시트는 위 운세 띠와 **같은 `selLuck`·`selSeun`** 을 바꾼다.
   *   여기에 별도 상태를 두면 «띠에서 고른 것» 과 «분포에서 고른 것» 이 갈려 숫자가 어긋난다.
   *   ⇒ 입구만 하나 더 내는 것이지, 값을 두 벌 갖는 것이 아니다.
   */
  const [spanPick, setSpanPick] = useState(false);
  const spanExtra = (() => {
    if (elemSpan === 'natal') return undefined;
    const l = luckCycles[selLuck];
    if (!l) return undefined;
    const out = [{ label: `${t('ms.ageN', '{{n}}세', { n: l.startAge })} ${T('대운')}`, stem: l.stem, branch: l.branch }];
    if (elemSpan === 'both') {
      const a = l.annuals?.[selSeun];
      if (a) out.push({ label: `${a.year} ${T('세운')}`, stem: a.stem, branch: a.branch });
    }
    return out;
  })();
  // ★운을 얹으면 **보정 여부와 무관하게** 세력치로 그려야 한다(개수 축은 원국 전용이라).
  const pwOn = pwHap || pwJohu || elemSpan !== 'natal';
  const pw = pwOn ? elementPower(c.saju, { hap: pwHap, johuGung: pwJohu, extra: spanExtra }) : null;
  const [selMonth, setSelMonth] = useState(now.getMonth());           // 선택된 월운(기본=이번 달)
  const [selDay, setSelDay] = useState(now.getDate());                // 선택된 일운(기본=오늘) — 일진 달력 탭으로 변경
  // 운세 확장명식 시간층 — ★**기본 ON**(daniel 2026-08-03 "만세력에 디폴트가 오늘 기준
  //   대운·세운·월운·일운으로 잡혀 있어야지"). 07-24 엔 통합하며 기본 OFF(원국만)로 뒀는데,
  //   만세력을 여는 이유가 대개 '지금 내 운이 어떤가' 라서 매번 네 칩을 눌러야 했다.
  //   선택값은 이미 오늘 기준이다(아래 selLuck/selSeun/selMonth/selDay = 현재 대운·올해·이번 달·오늘)
  //   — 켜져 있지 않았을 뿐이라, 기본을 켜면 **열자마자 오늘 기준 네 층**이 원국 옆에 붙는다.
  //   ⚠️끄고 원국만 보고 싶으면 칩을 눌러 끄면 된다(토글은 그대로).
  const [showLayers, setShowLayers] = useState({ luck: true, year: true, month: true, day: true });

  // ★★선택값을 **오늘 기준으로 되잡는다**(daniel 2026-08-12 *"만세력 대운세운월운일운이 오늘기준으로
  //   안나와 처음에 킬때"*).
  // ─────────────────────────────────────────────────────────────────────────
  //   위 네 개는 `useState(...)` 라 **첫 렌더의 값으로 굳는다.** 그런데 이 화면은
  //   명식(input)이 나중에 채워지거나 바뀌어도 **언마운트되지 않는다** — 그러면
  //   selLuck/selSeun 은 옛 명식(혹은 luckCycles 가 비었을 때의 0 = 첫 대운 = 어린 시절)에 머문다.
  //   ⇒ "오늘 기준 현재운세 보기" 버튼이 하던 리셋을 **명식이 바뀔 때 자동으로** 한다.
  //     (그 버튼이 처음부터 있었다는 건, 어긋나는 경우가 있다는 걸 알고도 수동으로 두었다는 뜻이다.)
  //   ⚠️사용자가 다른 대운·달을 골라 보는 중에는 건드리지 않는다 — 의존성이 **명식(input)** 뿐이라
  //     같은 명식을 보는 동안에는 다시 돌지 않는다.
  const luckKey = `${curLuckIdx}|${curSeunIdx}|${luckCycles.length}`;   // 명식이 바뀌면 함께 바뀐다
  useEffect(() => {
    setSelLuck(curLuckIdx);
    setSelSeun(curSeunIdx);
    setSelMonth(new Date().getMonth());   // ★now 를 쓰지 않는다 — 렌더 시점이 아니라 **지금**을 다시 읽는다
    setSelDay(new Date().getDate());      //   (앱을 켜 둔 채 자정을 넘기면 now 가 어제일 수 있다)
  }, [luckKey]);
  const [expW, setExpW] = useState(0); // 확장명식 가용폭 — 컬럼 수에 맞춰 칸·글자 반응형(daniel)
  const [glossary, setGlossary] = useState<{ kind: GlossaryKind; key?: string } | null>(null); // 클릭 설명 바텀시트
  const [showLinks, setShowLinks] = useState(false); // ★관계분석(합충형해) 기본 접힘(daniel 2026-07-24) — 펼치면 관계 리스트 + 12신살
  const [showExpandLinks, setShowExpandLinks] = useState(false); // 운 합충형해(대운/세운 관계) 기본 접힘(daniel 07-18) — 펼치면 3자 국[삼합/삼형]+개별 2자 노출
  const [activePalja, setActivePalja] = useState<Set<string>>(() => new Set());   // 클릭으로 켠 팔자 합충(명식 강조용)
  const [activeExpand, setActiveExpand] = useState<Set<string>>(() => new Set());  // 클릭으로 켠 대운/세운 합충
  const posIndex: Record<string, number> = { 시: 0, 일: 1, 월: 2, 년: 3 };
  const allLinks = (c.saju.interactions as any[]).filter(
    (it) => (it.members?.length ?? 0) >= 2 && it.members.every((m: string) => posIndex[m] != null && visiblePos.includes(m as any))
  );
  const ganLinks = allLinks.filter((it: any) => it.level === '천간'); // 천간 합·충(극) — 팔자 위(점선)
  const jiLinks = allLinks.filter((it: any) => it.level !== '천간');  // 지지 합·충·형·해·파 — 팔자 아래(실선)
  // 합충선 라벨: 합이면 '합+합화오행'을 그 오행 색으로(=어떤 기운이 강해지는지), 그 외는 종류만.
  const linkLabel = (it: any) => interactionLabel(it); // 짝 이름 라벨(유축반합·묘술육합·정신극) — daniel. 화오행은 글라스박스/transformsTo로.
  // ★작용 색은 `interactionColor` 단일 원본 — 궁합 화면과 **같은 표**를 쓴다.
  //   종전엔 여기와 궁합에 3색 배색이 따로 박혀 있었다(형·해·파가 한 색). 같은 「작용」이
  //   화면마다 다르게 보이면 안 된다([[duplicate-ui-single-source]]).
  const linkColor = (it: any) => interactionColor(it.type);
  // 합충 호 — 표의 천간 행 위(above·점선) / 지지 행 아래(below·실선). 라벨열(34) 오프셋 반영.
  const renderArcs = (links: any[], dir: 'above' | 'below') => {
    if (!(rowW > 0) || links.length === 0) return null;
    // 명식 기둥과 동일 좌표계 — 라벨열 없음(L=0), 기둥 사이 gap(=pillarContainer gap space(2)) 반영.
    const GAP = space(2);
    const n = visiblePos.length;
    const colW = (rowW - GAP * (n - 1)) / n;                          // 각 기둥(칸) 너비 = flex 균등 + gap
    const centerX = (idx: number) => idx * (colW + GAP) + colW / 2;   // 그 칸의 '중앙' x — 선이 여기서 나온다
    const STEP = 20;
    const PAD = 12;                                                  // 라벨 박스(높이16·중심±8, 둥근모서리)가 Svg 위/아래 가장자리에 짤리지 않게 한 여백(daniel: 합충선 위/아래 짤림)
    const H = links.length * STEP + 16;                              // 다리 영역 높이(여유 — 명식에서 띄움)
    const reach = dir === 'above' ? H : 0;                           // 명식에 닿는 변(위=아래쪽 H / 아래=위쪽 0)
    const dash = dir === 'above' ? '3 2' : undefined;

    const items = links.map((it, i) => {
      // off 없음 — 어느 관계든 해당 칸 '중앙'에서 수직으로 출발(daniel). 겹침은 다리 높이(STEP)로 구분.
      const xs = (it.members as string[]).map((m) => centerX(visiblePos.indexOf(m as any))).sort((a, b) => a - b);
      const xa = xs[0], xb = xs[xs.length - 1];
      const legY = dir === 'above' ? PAD + i * STEP : H - (PAD + i * STEP); // 수평 다리 높이(가장자리 PAD 확보 — 라벨 위/아래 짤림 방지)
      const lbl = linkLabel(it);
      const mid = (xa + xb) / 2;
      return { xa, xb, mids: xs.slice(1, -1), mid, legY, col: linkColor(it), lbl, lw: lbl.length * 11 + 8 };
    });

    return (
      <Svg width={rowW} height={H} style={{ marginBottom: dir === 'above' ? -4 : 0, marginTop: dir === 'below' ? -4 : 0 }}>
        {items.map((o, i) => (
          <G key={`p${i}`}>
            {/* ㄷ자 다리 — 칸 중앙에서 수직으로 나와 수평으로 잇고 라벨 양옆을 비운다(확장명식 expandArcs 와 동일 스타일) */}
            <Path d={`M ${o.xa} ${reach} L ${o.xa} ${o.legY} L ${o.mid - o.lw / 2} ${o.legY}`} stroke={o.col} strokeWidth={2} fill="none" strokeDasharray={dash} opacity={0.85} />
            <Path d={`M ${o.mid + o.lw / 2} ${o.legY} L ${o.xb} ${o.legY} L ${o.xb} ${reach}`} stroke={o.col} strokeWidth={2} fill="none" strokeDasharray={dash} opacity={0.85} />
            {o.mids.map((mx, k) => (
              <Path key={k} d={`M ${mx} ${reach} L ${mx} ${o.legY}`} stroke={o.col} strokeWidth={1.5} fill="none" strokeDasharray={dash} opacity={0.6} />
            ))}
          </G>
        ))}
        {items.map((o, i) => (
          <G key={`l${i}`}>
            <Rect x={o.mid - o.lw / 2} y={o.legY - 8} width={o.lw} height={16} fill={colors.card} rx={8} stroke={o.col} strokeWidth={0.5} />
            <SvgText x={o.mid} y={o.legY + 4} fill={o.col} fontSize={10} fontWeight="800" textAnchor="middle">{o.lbl}</SvgText>
          </G>
        ))}
      </Svg>
    );
  };

  // 합충형해 종류별 그룹 렌더 (선 클러터 대신 합/충/형/해/파/극 묶음 + 글자쌍, 탭→의미)
  const typeColor = (ty: string) => interactionColor(ty);   // ★위 linkColor 와 같은 단일 원본
  const renderGroups = (items: any[], active: Set<string>, onToggle: (k: string) => void) => INTERACTION_ORDER.map((ty) => {
    const grp = items.filter((x) => x.type === ty);
    if (!grp.length) return null;
    const col = typeColor(ty);
    return (
      <View key={ty} style={styles.linkGroup}>
        <PressableScale onPress={() => setGlossary({ kind: 'interaction', key: ty })}><Text style={[styles.linkGroupHead, { color: col }]}>● {ty} {grp.length}  ⓘ</Text></PressableScale>
        {[...grp].sort((a: any, b: any) => b.mem.length - a.mem.length).map((x: any, i: number) => {
          const on = active.has(x.key);
          return (
            <PressableScale key={i} onPress={() => onToggle(x.key)} style={[styles.linkGRow, on && styles.linkGRowOn]}>
              <Text style={styles.linkGTx}>
                <Text style={{ color: on ? col : colors.inkFaint }}>{on ? '◉ ' : '○ '}</Text>
                {x.mem.map((mm: any, k: number) => (
                  <Text key={k}>
                    {k > 0 ? '  ·  ' : ''}{mm.label} <Text style={{ color: elementColor[mm.el], fontWeight: '800' }}>{mm.char}</Text>
                  </Text>
                ))}
                {ty === '합' && x.transformsTo ? <Text style={{ color: col, fontWeight: '800' }}>{`  → ${x.transformsTo}`}</Text> : null}
                {x.isGan ? <Text style={styles.linkLevel}>  {T('천간')}</Text> : null}
                {x.mem.length === 3 ? <Text style={{ color: col, fontWeight: '800', fontSize: 11 }}>  ★{x.type === '합' ? `${T('삼합')}/${T('방합')}` : x.type === '형' ? t('ms.samhyeong', '삼형') : t('ms.three', '3자')}</Text> : null}
              </Text>
            </PressableScale>
          );
        })}
      </View>
    );
  });
  const toggleKey = (setFn: any, k: string) => setFn((prev: Set<string>) => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const combinedPalja = [...ganLinks, ...jiLinks];
  const normPalja = combinedPalja.map((it: any) => {
    const isGan = it.level === '천간';
    // members 전체(쌍=2 · 삼합국/방합국=3)를 글자 배열로 정규화 — 렌더는 mem 순회
    const mem = (it.members as PillarPos[]).map((m) => ({
      label: `${m}`, char: isGan ? P[m].stem : P[m].branch, el: isGan ? stemElement(P[m].stem) : branchElement(P[m].branch),
    }));
    return { key: it.detail as string, type: it.type, transformsTo: it.transformsTo, isGan, mem };
  });
  // 클릭으로 켠 팔자 합충 → 명식 강조(arc + 셀 하이라이트)
  const activeGanP = combinedPalja.filter((it: any) => it.level === '천간' && activePalja.has(it.detail));
  const activeJiP = combinedPalja.filter((it: any) => it.level !== '천간' && activePalja.has(it.detail));
  const hlStem = new Set<string>(); activeGanP.forEach((it: any) => it.members.forEach((m: string) => hlStem.add(m)));
  const hlBranch = new Set<string>(); activeJiP.forEach((it: any) => it.members.forEach((m: string) => hlBranch.add(m)));
  // 강도 순 — 대운/세운 작용을 강한 순으로 강조(daniel). 충·합=강 / 형·극=중 / 해·파=약.
  const STRENGTH: Record<string, number> = { 충: 5, 합: 4, 형: 3, 극: 3, 해: 2, 파: 1 };
  const renderByStrength = (items: any[], active: Set<string>, onToggle: (k: string) => void) => [...items].sort((a, b) => (STRENGTH[b.type] || 0) - (STRENGTH[a.type] || 0)).map((x: any, i: number) => {
    const s = STRENGTH[x.type] || 0;
    // ★뱃지 글자 — 「강·중·약」은 세기 표시다(용어가 아니라 **보통 말**) ⇒ 문구 파일로 옮긴다
    const tier = s >= 4 ? t('ms.tierHi', '강') : s >= 3 ? t('ms.tierMid', '중') : t('ms.tierLo', '약');
    const col = typeColor(x.type);
    const on = active.has(x.key);
    return (
      <PressableScale key={i} onPress={() => onToggle(x.key)} style={[styles.strRow, s >= 4 && styles.strRowTop, on && styles.linkGRowOn]}>
        <Text style={[styles.strBadge, { color: col, borderColor: col }]}>{on ? '◉' : tier}</Text>
        <Text style={styles.linkGTx}>
          {x.mem.map((mm: any, k: number) => (
            <Text key={k}>
              {k > 0 ? '  ⟷  ' : ''}{mm.label} <Text style={{ color: elementColor[mm.el], fontWeight: '800' }}>{mm.char}</Text>
            </Text>
          ))}
          {'   '}
          <Text style={{ color: col, fontWeight: '800' }}>{interactionLabel({ type: x.type, detail: x.key, level: x.isGan ? '천간' : '지지' } as any)}</Text>
          {x.isGan ? <Text style={styles.linkLevel}>  {T('천간')}</Text> : null}
        </Text>
      </PressableScale>
    );
  });

  const [showAdvanced, setShowAdvanced] = useState(false); // ★기본 '간략히'(daniel 2026-07-24) — 상세(지장간·통근)는 버튼으로. 12운성은 상시 표시라 영향 적음.
  const [hangeul, setHangeul] = useState(false); // ★한자↔한글 토글(daniel 2026-07-24) — 켜면 명식 간지를 한글음(갑·자)으로 주 표기, 한자는 작게.
  const toggleAdvanced = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowAdvanced(!showAdvanced);
    haptic();
  };

  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  /**
   * ★★넓은 화면에서 명식을 **키운다** (Boss 2026-09-02
   *   *"웹 기준 높이 맞쳐줘 거기에맞게 글자크기도 키우고"*).
   *
   * ■ 왜 — 오행을 오른쪽으로 보내고 나니 두 칸의 **키가 안 맞았다.**
   *   실측(창 1298px): 오른쪽 패널 **514** · 명식 카드 **239** — 138px 짧아 아래가 휑했다.
   * ■ 글자를 키우면 카드도 같이 커진다(높이는 내용이 정한다) ⇒ **배율 하나**로 둘을 같이 푼다.
   *   ★배율은 **실측으로 맞췄다**: 1.55 → 카드 343(아래끝 차이 34px 남음) → **1.72** 로 올려 맞췄다.
   *     (카드 높이는 배율에 정비례하지 않는다 — 고정 여백이 섞여 있어 한 번 재고 조정했다.)
   * ■ ⚠️폰은 **건드리지 않는다**(`wide` 일 때만) — 좁은 화면에서 키우면 글자가 눌려 세로로 깨진다
   *   ([[container-width-not-window]] 의 그 증상).
   * ■ ⚠️`fontSize` 를 키우면 `lineHeight` 도 **같이** 키운다(전역 규칙 · `check:lineheight`).
   */
  const PW = wide ? 1.72 : 1;
  const pz = (n: number) => Math.round(n * PW);

  const renderPillars = () => (
    // 합충 호 좌표 기준 = 명식 기둥영역 실제 폭(패딩 안). arc Svg 와 동일 좌표계가 되도록 여기서 측정.
    <View style={styles.pillarContainer} onLayout={(e) => setRowW(e.nativeEvent.layout.width)}>
      {visiblePos.map((p) => {
        const isDay = p === '일';
        const elStem = stemElement(P[p].stem);
        const elBranch = branchElement(P[p].branch);
        
        return (
          <Animated.View 
            key={p} 
            style={[
              styles.pillarWrapper, 
              isDay && { transform: [{ scale: pulseAnim }] }
            ]}
          >
            <GlassCard 
              style={StyleSheet.flatten([styles.pillarGlass, isDay && styles.pillarDayGlass, wide && { paddingVertical: pz(12) }])} 
              intensity={isDay ? 60 : 30}
            >
              <Text style={[styles.pillarPos, isDay && styles.pillarPosDay, wide && { fontSize: pz(12), lineHeight: pz(17) }]}>{p}</Text>
              
              {/* 천간 십신 — 개별 클릭 시 십신 설명(daniel: 십성 클릭 복구) */}
              <PressableScale onPress={() => setGlossary({ kind: 'tengod', key: P[p].stemTenGod })}>
                <Text style={[styles.pillarTenGod, { color: colors.inkSoft }, wide && { fontSize: pz(12), lineHeight: pz(17) }]}>{P[p].stemTenGod}</Text>
              </PressableScale>
              <PressableScale style={styles.pillarMain} onPress={() => setGlossary({ kind: 'stem', key: P[p].stem })}>
                <Text style={[styles.pillarChar, { color: elementColor[elStem] }, wide && { fontSize: pz(31), lineHeight: pz(38) }]}>{hangeul ? stemReading(P[p].stem) : P[p].stem}</Text>
                <Text style={[styles.pillarReading, { color: colors.inkFaint }, wide && { fontSize: pz(11), lineHeight: pz(15) }]}>{hangeul ? P[p].stem : stemReading(P[p].stem)} · {stemYinYang(P[p].stem)}</Text>
              </PressableScale>


              <PressableScale style={styles.pillarMain} onPress={() => setGlossary({ kind: 'branch', key: P[p].branch })}>
                <Text style={[styles.pillarChar, { color: elementColor[elBranch] }, wide && { fontSize: pz(31), lineHeight: pz(38) }]}>{hangeul ? branchReading(P[p].branch) : P[p].branch}</Text>
                <Text style={[styles.pillarReading, { color: colors.inkFaint }, wide && { fontSize: pz(11), lineHeight: pz(15) }]}>{hangeul ? P[p].branch : branchReading(P[p].branch)} · {branchYinYang(P[p].branch)}</Text>
              </PressableScale>
              {/* 지지 십신 — 개별 클릭 시 십신 설명 */}
              <PressableScale onPress={() => setGlossary({ kind: 'tengod', key: P[p].branchMainTenGod })}>
                <Text style={[styles.pillarTenGod, { color: colors.inkSoft }, wide && { fontSize: pz(12), lineHeight: pz(17) }]}>{P[p].branchMainTenGod}</Text>
              </PressableScale>

              {/* 12운성 — 항상 표시(daniel: 상세분석 토글 밖). 탭 → 글로서리 설명. */}
              <View style={styles.pillarDivider} />
              <PressableScale onPress={() => setGlossary({ kind: 'stage', key: c.stages[p] })}>
                <Text style={[styles.pillarStage, wide && { fontSize: pz(12), lineHeight: pz(17) }]}>{c.stages[p]}</Text>
              </PressableScale>

              {showAdvanced && (
                <Animated.View style={styles.advancedInfo}>
                  <View style={styles.pillarDivider} />
                  <View style={styles.pillarHidden}>
                    {/* ★지장간 3슬롯 고정(여기·중기·본기) — 중기 없는 지지(왕지 등)는 가운데 빈칸으로 정렬(daniel 2026-07-24). */}
                    {(['여기', '중기', '본기'] as const).map((role, i) => {
                      const h = P[p].hiddenStems.find((x) => x.role === role);
                      if (!h) return <View key={i} style={[styles.pillarHiddenItem, HID_BOX]}><Text numberOfLines={1} style={[styles.pillarHiddenChar, { color: colors.line }]}>·</Text></View>;
                      const rooted = allGan.includes(h.stem); // 지장간이 원국 천간에 투출 = 통근(동그라미 표시)
                      return (
                        <View key={i} style={[styles.pillarHiddenItem, HID_BOX, rooted && [styles.pillarHiddenRooted, { borderRadius: HID_H / 2 }]]}>
                          <Text numberOfLines={1} style={[styles.pillarHiddenChar, { color: elementColor[stemElement(h.stem)] }]}>{h.stem}</Text>
                        </View>
                      );
                    })}
                  </View>
                </Animated.View>
              )}
            </GlassCard>
          </Animated.View>
        );
      })}
    </View>
  );

  return (
    <>
    <View style={styles.tabBar}>
      {MYEONG_TABS.map((t2) => (
        <PressableScale
          key={t2.id}
          style={[styles.tabBtn, activeTab === t2.id && styles.tabBtnOn]}
          onPress={() => { setActiveTab(t2.id); haptic(); }}
        >
          <Text style={[styles.tabLabel, activeTab === t2.id && styles.tabLabelOn]} numberOfLines={1}>{t(t2.label)}</Text>
        </PressableScale>
      ))}
    </View>
    <ScrollView style={styles.screen} contentContainerStyle={[styles.wrap,
      // ★넓은 화면에서는 본문이 좌우로 더 퍼지게 한다(그만큼 빈칸이 줄어든다).
      wide ? { maxWidth: 1180, width: '100%', alignSelf: 'center' } : null,
      { paddingBottom: insets.bottom + space(24) }]}>
      {/* 카테고리 ? 설명(daniel: 설명도 나오게) — 탭하면 이 분류가 무엇을 보는지 시트로.
          ★ScrollView 안으로 이동(daniel 2026-07-24 '글자 짤려'): 예전엔 고정 탭바 아래 '투명 영역'에 떠 있어,
          운세 탭 기둥 등을 위로 스크롤하면 그 투명 경계에서 상단 라벨(기둥명·나이·천간십신)이 지저분하게 잘려 보였다.
          콘텐츠와 함께 스크롤되게 옮겨, 기둥은 불투명 테두리 탭바 아래로 깔끔히 스크롤되게 함. */}
      {header}
      <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
        {/* ── 사주원국 1: 팔자 그리드 + 12신살(원국) ── */}
        {activeTab === 'wonguk' && (
        <>
          {/* ★★넓은 화면에서는 **오행을 오른쪽으로** 보낸다 (Boss 2026-09-02
              *"웹에서 만세력에 나를이루는 다섯가지기운 그대로 상단에 있는데?"*
               · 앞서 *"웹은 오행강약을 오른쪽 만세력은 왼쪽에 표시하자"*).

              ■ 좁은 화면(폰)은 **그대로** 위에 둔다 — 세로로 긴 화면에서 옆으로 나누면 둘 다 좁아진다.
              ■ ⚠️★예전에 세 번 실패한 방식(다단 `columnCount`·`display:block`·`flexWrap`+`order`)은
                **쓰지 않는다**. RN Web 은 모든 View 를 `display:flex` 로 깔아 다단이 무시된다.
                ⇒ 여기서는 «연속한 한 구간을 감싸 가로로 놓는» **평범한 flex row** 하나만 쓴다.
              ■ 오른쪽 칸은 **고정 폭**이다 — 비율(`flex`)로 두면 명식 글자가 눌려 세로로 깨진다
                ([[container-width-not-window]] 의 그 증상). */}
          {!wide ? <OhaengEnergy saju={c.saju} /> : null}
          <View style={wide ? { flexDirection: 'row', gap: space(5), alignItems: 'flex-start' } : null}>
          <View style={wide ? { flex: 1, minWidth: 0 } : null}>
          <View style={styles.headerArea}>
            {/* 누구 명식인지 제목에 표기(daniel 07-05) — 헤더 ChartPicker(변경 가능)와 함께 '누구의 사주 원국'인지 명확히. */}
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.h}>{whoName ? `${whoName} · ${t('myeongsik.palja')}` : t('myeongsik.palja')}</Text>
              {/* ★생년월일시·출생지를 작게 함께(Boss 2026-08-23) — '이 명식이 누구의 무엇인지'를
                  제목만으로는 알 수 없다. 명식을 여러 개 두는 앱이라 특히.
                  ⚠️시각 미상이면 `birthDateTime` 이 '0:0' 이다 — **00:00 으로 적으면 거짓**이라
                    '시 미상'으로 적는다(`timeAccuracy` 가 정본).
                  ⚠️음력이면 반드시 표시한다 — 안 적으면 날짜를 양력으로 잘못 읽는다.
                  ⚠️출생지가 없으면 '출생지 미상' — 비워 두면 진태양시가 한국 평균으로 계산된 걸 모른다. */}
              <Text style={styles.hMeta} numberOfLines={1}>{birthMeta}</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: space(2) }}>
              {/* ★한자↔한글 토글(daniel 07-24) — 사주 모르는 사람도 한글음으로 명식 보기 */}
              <PressableScale style={styles.advancedBtn} onPress={() => setHangeul((v) => !v)}>
                <Text style={styles.advancedBtnTx}>{hangeul ? t('ms.showHanja', '漢 한자') : t('ms.showHangeul', '가 한글')}</Text>
              </PressableScale>
              <PressableScale style={styles.advancedBtn} onPress={toggleAdvanced}>
                <Text style={styles.advancedBtnTx}>{showAdvanced ? t('ms.brief', '간략히') : t('ms.detail', '상세 분석')}</Text>
              </PressableScale>
            </View>
          </View>

          {/* ★★「글자 바꿔 보기」 — 충 / 합 (Boss 2026-09-01)
              *"원국에서 충하는 글자보기 하면 전체 글자별 충하는 글자로 바꾸고 거기에 맞게 내용 십신등 변경해줘
                합하는글자 보기도 두개를 하나로 묶어서 버튼으로 만들고 각각설정해서 볼수있게"*
              ■ 하나의 띠에 세 칸 — 원국 / 충 / 합. «각각 설정해서 볼 수 있게» = 눌러서 갈아 끼운다.
              ■ 명식 **바로 위**에 둔다 — 무엇이 바뀌는지 눈이 같이 봐야 한다(밑에 두면 스크롤로 갈린다).
              ■ ⚠️친구 명식·미저장 명식엔 **안 그린다**(`swapSellable`) — 눌러도 안 되는 버튼을 만들지 않는다. */}
          {swapSellable && (
            <View style={styles.layerToggle}>
              {([[null, t('ms.swapOff', '원국')], ['chung', `${T('충')} ${t('ms.swapView', '보기')}`], ['hap', `${T('합')} ${t('ms.swapView', '보기')}`]] as const).map(([k, label]) => (
                <PressableScale
                  key={String(k)}
                  style={[styles.layerChip, swapMode === k && styles.layerChipOn]}
                  disabled={swapBusy}
                  onPress={() => { void pickSwap(k); }}
                >
                  <Text style={[styles.layerChipTx, swapMode === k && styles.layerChipTxOn]}>
                    {swapMode === k ? '✓ ' : ''}{label}
                    {/* 아직 안 산 사람에게만 자물쇠 + 값. 산 뒤에는 사라진다(산 것에 값을 계속 붙이지 않는다). */}
                    {k !== null && swapPaid && !swapPaid[k] ? ` 🔒${feeOf(k)}` : ''}
                  </Text>
                </PressableScale>
              ))}
            </View>
          )}
          {/* ★★렌즈가 켜져 있으면 **반드시 밝힌다** — 안 밝히면 «내 사주가 이거였나» 로 읽힌다.
              가정(what-if)이지 이 사람의 명식이 아니다. 저장에도 안 들어간다(spec/chart.ts 주석). */}
          {swapMode && (
            <Text style={styles.swapNote}>
              {swapMode === 'chung'
                ? t('ms.swapNoteChung', '지금은 여덟 글자를 각자의 충(沖) 짝으로 바꿔 본 가정이에요. 실제 명식이 아니고, 십신·지장간도 바뀐 글자를 따라간 값이에요.')
                : t('ms.swapNoteHap', '지금은 여덟 글자를 각자의 합(合) 짝으로 바꿔 본 가정이에요. 실제 명식이 아니고, 십신·지장간도 바뀐 글자를 따라간 값이에요.')}
            </Text>
          )}

          {renderArcs(activeGanP, 'above')}
          {renderPillars()}
          {renderArcs(activeJiP, 'below')}
          </View>
          {/* 오른쪽 칸 — 넓을 때만. 폭은 고정(위 주석) */}
          {wide ? <View style={{ width: 340 }}><OhaengEnergy saju={c.saju} /></View> : null}
          </View>

          {/* ★신살·공망(원국) — 12신살 있던 자리로 이동(daniel 2026-07-25). 자리별 적중만: 운에서 오는 신살 제외 · 12신살 요약은 관계분석으로. */}
          <Text style={styles.hint}>{T('신살')}·{T('공망')} ({t('ms.byPillar', '자리별 적중')})</Text>
          {(() => {
            const byName = new Map<string, { name: string; glyphs: string[]; hits: any[] }>();
            c.sinsal.sinsal.forEach((s) => {
              if (!byName.has(s.name)) byName.set(s.name, { name: s.name, glyphs: [], hits: [] });
              const e = byName.get(s.name)!;
              s.glyphs.forEach((g) => { if (!e.glyphs.includes(g)) e.glyphs.push(g); });
              e.hits.push(...s.hits);
            });
            if (c.sinsal.goegang) byName.set('괴강', { name: '괴강', glyphs: [`${P['일'].stem}${P['일'].branch}`], hits: [{ pos: '일', side: 'stem' }] });
            if (c.sinsal.baekhoHits.length) byName.set('백호', { name: '백호', glyphs: ['白虎'], hits: c.sinsal.baekhoHits.map((p) => ({ pos: p, side: 'stem' })) });
            const atSide = (p: PillarPos, side: string) => [...byName.values()].filter((s) => s.hits.some((h) => h.pos === p && h.side === side)).map((s) => s.name);
            // ★태그 글자도 용어 표를 탄다 — `SINSAL_GLOSSARY` 가 한자를 갖고 있어 `T()` 가 그대로 푼다
    const tag = (name: string, onPress: () => void, key: any) => <PressableScale key={key} onPress={onPress}><Text style={styles.ssTagLink}>{T(name)}</Text></PressableScale>;
            const cellTags = (names: string[]) => names.length ? names.map((n, i) => tag(n, () => setGlossary({ kind: 'sinsal', key: n }), i)) : <Text style={styles.ssDim}>—</Text>;
            return (
              <View style={styles.ssTable}>
                <View style={styles.ssTableRow}><Text style={styles.ssRowLabel} />{visiblePos.map((p) => <Text key={p} style={styles.ssColHead}>{T(`${p}주`)}</Text>)}</View>
                <View style={styles.ssTableRow}><Text style={styles.ssRowLabel}>{T('천간')}</Text>{visiblePos.map((p) => <View key={p} style={styles.ssCell}>{cellTags(atSide(p, 'stem'))}</View>)}</View>
                <View style={styles.ssTableRow}><Text style={styles.ssRowLabel}>{T('지지')}</Text>{visiblePos.map((p) => <View key={p} style={styles.ssCell}>{cellTags(atSide(p, 'branch'))}</View>)}</View>
                <View style={styles.ssTableRow}><Text style={styles.ssRowLabel}>{T('공망')}</Text>{visiblePos.map((p) => <View key={p} style={styles.ssCell}>{c.sinsal.gongmangHits.includes(p) ? tag('공망', () => setGlossary({ kind: 'gongmang' }), 'gm') : <Text style={styles.ssDim}>—</Text>}</View>)}</View>
                {/* ★★12신살을 **만세력 본문**으로(Boss 2026-08-31 *"만세력에 12신살도 나와야해"*
                     · *"관계분석 밑에 12신살 나열은 지우고 명식기준 12신살이 나와야해"*).
                    ■ 종전엔 «관계분석»(상세 분석 게이트) 안이라 만세력을 보는 사람이 두 번 눌러야 만났고,
                      자리마다 기준지 넷의 이름을 **전부 늘어놓아** 왜 그게 거기 있는지 알 수 없었다.
                    ■ ★**년지 기준 한 칸씩**으로 그린다 — Boss 가 보여 준 다른 만세력과 같은 형태다.
                      실측으로 맞춰 봤다(황찬호 명식): 년지 기준이 시=육해·일=천살·월=도화(=년살)로
                      **네 칸 중 셋을 정확히** 맞췄다. ⚠️`도화` 와 `년살` 은 **같은 신살의 다른 이름**이라
                      12신살 표에서는 그 체계의 이름인 **「년살」로** 적는다(신살 표에서는 도화 그대로).
                    ■ ★엔진은 **넷 다 그대로 산출**한다(Boss stance 2026-06-08 *"전부 산출"*).
                      바뀐 것은 화면뿐 — 다른 기준지 값이 필요해지면 `c.sinsal.twelve` 에 그대로 있다. */}
                <View style={styles.ssTableRow}>
                  <Text style={styles.ssRowLabel}>{T('12신살')}</Text>
                  {visiblePos.map((p) => {
                    /**
                     * ★★기준지 — **시·일·월은 년지, 년주만 일지**(Boss 2026-08-31 판정 *"년지는 반안살로 나오게"*).
                     *
                     * ■ 왜 년주만 다른가
                     *   년지를 **자기 삼합국**에 대보면 늘 같은 자리(화개)가 나와 **아무것도 말하지 않는다.**
                     *   그래서 년주 칸만 일지를 기준으로 본다 — Boss 가 보여 준 만세력도 그 형태였다.
                     * ■ ★실측으로 확인한 값(황찬호 년甲戌·월丁卯·일辛丑·시丁酉)
                     *     시(酉)=육해 · 일(丑)=천살 · 월(卯)=년살(=도화)  ← 년지 戌 기준
                     *     년(戌)=반안                                    ← 일지 丑 기준
                     *   레퍼런스 만세력과 **네 칸 모두** 일치한다.
                     * ⚠️이건 관법이라 내가 정한 것이 아니다 — 위 Boss 판정이 근거다. 바꾸려면 Boss 에게 묻는다.
                     */
                    const baseBranch = (p === '년' ? P['일'] : P['년']).branch;
                    const nm = twelveSinsalAt(baseBranch as any, P[p].branch as any);
                    // ★12신살 체계에서는 도화를 «년살» 로 부른다. 그 표는 **용어 파일이 소유**한다 —
                    //   여기 한국어를 박으면 다국어가 못 따라온다(`check:langpicker` 가 센다).
                    const key = TWELVE_SINSAL_ALIAS[nm] ?? nm;
                    return (
                      <View key={p} style={styles.ssCell}>
                        <PressableScale onPress={() => setGlossary({ kind: 'sinsal', key })}>
                          <Text style={styles.ssTagLink}>{T(key)}</Text>
                        </PressableScale>
                      </View>
                    );
                  })}
                </View>
              </View>
            );
          })()}
          {onSinsal && (
            <PressableScale style={styles.sinsalDetailBtn} onPress={onSinsal}>
              <Text style={styles.sinsalDetailTx}>{t('myeongsik.sinsalDetail')}</Text>
            </PressableScale>
          )}

        </>
      )}
      {/* ── 사주원국 2: 천간과 지지(합충) 관계 + 12신살 — 관계분석은 '상세 분석'일 때만 노출(daniel 2026-07-25 R). ── */}
      {activeTab === 'wonguk' && showAdvanced && (
        <>
          {/* 합충형해 토글 — 위 명식 차트의 합충선(arcs)에 대응하는 관계 분석 리스트 */}
          {(ganLinks.length + jiLinks.length) > 0 && (
            <PressableScale 
              style={styles.linksToggleNew} 
              onPress={() => {
                setShowLinks((v) => !v);
                haptic();
              }}
            >
              <View style={[styles.linksToggleGradient, { backgroundColor: colors.glass }]}>
                <Text style={styles.linksToggleTx}>
                  관계 분석 {ganLinks.length + jiLinks.length}개  {showLinks ? '▲' : '▼'}
                </Text>
              </View>
            </PressableScale>
          )}
      {showLinks && normPalja.length > 0 && (
        <View style={styles.linksCard}>
          {/* ③ 전체 선택/해제(daniel) — 합충선 한번에 켜고 끄기 */}
          <PressableScale onPress={() => setActivePalja((p) => p.size ? new Set<string>() : new Set(normPalja.map((x: any) => x.key as string)))} style={{ alignSelf: 'flex-end', paddingVertical: 4, paddingHorizontal: 8 }}>
            <Text style={{ color: colors.ju, fontWeight: '700', fontSize: 12 }}>{activePalja.size ? t('ms.unselectAll', '전체 해제') : t('ms.selectAll', '전체 선택')}</Text>
          </PressableScale>
          {renderGroups(normPalja, activePalja, (k) => toggleKey(setActivePalja, k))}
        </View>
      )}
          {/* ★12신살은 **만세력 본문(신살·공망 표)** 으로 옮겼다(Boss 2026-08-31).
              여기 있던 나열은 지운다 — 같은 것을 두 곳에서 그리면 언젠가 갈린다. */}

        </>
      )}
      {/* ── 오행과 십성 1: 일간·격국·대표 십성 ── */}
      {activeTab === 'elem' && (
        <>
      {/* 일간·신강약·격국 */}
      <Text style={styles.kv}>{t('myeongsik.dayMaster')}: <Text style={styles.kvAccent}>{c.saju.dayMaster.stem}({c.saju.dayMaster.element})</Text></Text>
      {/* ★격이 아예 서지 않는 명식이 있다(생지 월지에 중기·정기가 모두 미투간 — 표본의 약 21%).
          그때는 투간 라벨을 붙이지 않는다 — "격 없음 (잠복)" 같은 문구가 되지 않게.
          ★2026-08-11 `000h#1`(△) *"격이 없는게 맞다. **하지만 고객에게 격이 없다고하면 기분나빠한다**"* ·
            `#3`(O) *"두 말은 같은 것을 다르게 부르는 것뿐"* ⇒ **판정은 그대로, 부르는 이름만** 바꾼다.
            화면은 `displayName`('◯◯격(드러나지 않음)')을 쓰고, 계산은 `established` 를 본다. */}
      <Text style={styles.kv}>{t('myeongsik.dayMaster')} {c.saju.dayMaster.stem}  ·  {t('myeongsik.pattern')}: {(c.pattern as { displayName?: string }).displayName ?? c.pattern.name}
        {(c.pattern as { established?: boolean }).established === false
          ? ''
          : ` (${t(c.pattern.revealed ? 'myeongsik.patternRevealed' : 'myeongsik.patternHidden')})`}</Text>
      {/* ★핵심 격(格, 동적 구조) — 살인상생·식신제살·상관패인 등(daniel). B5: 월령(월지 본기/투출) 중심으로 발화 게이트. 명리 정제 = daniel 검수 슬롯 */}
      {(() => {
        const present = new Set<string>();
        for (const p of POS) { const d = P[p]; if (d) { present.add(d.stemTenGod); present.add(d.branchMainTenGod); } }
        // B5(daniel 2026-07-06): 월령 앵커 십신 집합 — 격의 주기(主氣)는 반드시 여기 있어야 성립(자평 월령 중심).
        //   ① 월지 본기 십신(월령)  ② 월지 지장간 중 원국 천간(allGan)에 투출한 것의 십신.
        const wollyeong = new Set<string>();
        const wolP = P['월'];
        if (wolP) {
          wollyeong.add(wolP.branchMainTenGod);                                        // ① 월령 본기 십신
          for (const h of wolP.hiddenStems) { if (allGan.includes(h.stem)) wollyeong.add(h.tenGod); } // ② 월지 지장간 투출 → 그 십신도 월령 격 주기
        }
        const gyeok = detectGyeokguk(present, wollyeong);
        if (!gyeok.length) return null;
        return (
          <View style={styles.gyeokWrap}>
            <Text style={styles.gyeokHead}>{t('ms.coreGyeok', '핵심 격')}</Text>
            {gyeok.map((g, i) => (
              <View key={i} style={styles.gyeokCard}>
                <Text style={styles.gyeokName}>{g.name} <Text style={styles.gyeokHanja}>{g.hanja}</Text></Text>
                <Text style={[styles.gyeokDesc, { fontSize: fs(13), lineHeight: 19 }]}>{g.desc}</Text>
              </View>
            ))}
          </View>
        );
      })()}

      {/* ★용신(Boss 07-22) — canonical 엔진 산출: 용신·희신·기신 + 관점(method=억부/병약/조후/종격/통관). 격국용신은 관법 대기. */}
      <YongsinCard saju={c.saju} pattern={c.pattern} timeUnknown={timeUnknown} />
      {/* ★개운 방향(Boss 2026-08-24) — 용신 카드 **바로 아래**. 순서가 곧 논리다:
          "무엇이 용신인가"(위) → "그래서 무엇을 하면 되나"(아래).
          ⚠️적은 오행을 채우라고 말하지 않는다 · 채우면 안 되는 기운(기신)을 반드시 같이 적는다. */}
      <GaeunCard saju={c.saju} />

      {/* 대표 오행(일간)·대표 십성(격국) — 탭→설명 */}
      <View style={styles.repRow}>
        <PressableScale style={styles.repChip} onPress={() => setGlossary({ kind: 'element', key: c.saju.dayMaster.element })}>
          <Text style={styles.repLabel}>{t('ms.repElem', '대표 오행')}</Text>
          <Text style={[styles.repVal, { color: elementColor[c.saju.dayMaster.element] }]}>{c.saju.dayMaster.stem} · {c.saju.dayMaster.element}</Text>
        </PressableScale>
        {(() => {
          const repTg = (c.pattern.candidates[0] || '').replace('격', '') || c.saju.pillars['월'].branchMainTenGod;
          return (
            <PressableScale style={styles.repChip} onPress={() => setGlossary({ kind: 'tengod', key: repTg })}>
              <Text style={styles.repLabel}>{t('ms.repTengod', '대표 십성(격)')}</Text>
              <Text style={styles.repValTg}>{c.pattern.candidates.join(' · ') || repTg}</Text>
            </PressableScale>
          );
        })()}
      </View>

        </>
      )}
      {/* ── 신강신약 ── */}
      {activeTab === 'elem' && (    /* 신강신약 — 오행·강약 통합 탭(daniel) */
        <>
      {/* 신강약 — 게이지(중화=50% 기준, 신약←→신강) + 신왕/신강 분류(강함의 동력) */}
      <Text style={styles.h}>{t('myeongsik.strength')}</Text>
      {(() => {
        const dist = c.tenGods.distribution;
        const favor = (dist['비겁'] || 0) + (dist['인성'] || 0);            // 우호 = 비겁+인성
        const total = Object.values(dist).reduce((a: number, b: number) => a + b, 0) || 1;
        const ratio = favor / total;
        const R = 42, CX = 52, CY = 52, circ = 2 * Math.PI * R;
        const sc = c.strength.score;
        return (
          <View style={styles.strengthRow}>
            <Svg width={104} height={104}>
              {/* 도넛 배경 + 우호세력 비율(골드) arc, 12시 시작 */}
              <Circle cx={CX} cy={CY} r={R} stroke={colors.sunk} strokeWidth={9} fill="none" />
              <Circle cx={CX} cy={CY} r={R} stroke={colors.ju} strokeWidth={9} fill="none"
                strokeDasharray={`${circ * ratio} ${circ}`} strokeLinecap="round" transform={`rotate(-90 ${CX} ${CY})`} />
              <SvgText x={CX} y={CY - 1} fill={colors.ink} fontSize={22} fontWeight="800" textAnchor="middle">{sc > 0 ? `+${sc}` : `${sc}`}</SvgText>
              <SvgText x={CX} y={CY + 17} fill={colors.ju} fontSize={12} fontWeight="700" textAnchor="middle">{T(c.strengthClass.type)}</SvgText>
            </Svg>
            <View style={styles.strengthInfo}>
              <Text style={styles.kv}><Text style={styles.kvLabel}>{T('강약')}</Text>  {T(c.strengthClass.type)}</Text>{/* 엔진 판단값 그대로(daniel) — 재해석 라벨 제거 */}
              <Text style={styles.kv}><Text style={styles.kvLabel}>{t('ms.gangyakAxis', '강약축')}</Text>  {c.strengthClass.gangyakAxis} (재관 대비)</Text>
              <Text style={styles.kv}><Text style={styles.kvLabel}>{t('ms.allyPower', '우호세력')}</Text>  {Math.round(ratio * 100)}% · 비겁+인성</Text>
              <Text style={styles.kv}><Text style={styles.kvLabel}>{T('득령')}·{T('득지')}·{T('득세')}</Text>  {[c.strengthClass.deukryeong && T('득령'), c.strengthClass.deukji && T('득지'), c.strengthClass.deukse && T('득세')].filter(Boolean).join('·') || t('common.none', '없음')}</Text>
            </View>
          </View>
        );
      })()}
      <Text style={styles.hint}>{c.strengthClass.reason}</Text>
      {/* 신강·신약 특징 — 탭하면 상세 시트(성향·강점·주의·용신 방향) */}
      <PressableScale style={styles.strDetailBtn} onPress={() => setStrengthOpen(true)}>
        <Text style={styles.strDetailBtnTx}>{t('ms.strengthMore', '{{a}}·{{b}} 특징 자세히 보기 ›', { a: T('신강'), b: T('신약') })}</Text>
      </PressableScale>
      {/* 조후·음양 쏠림(daniel) — 탭하면 설명·문제점·대응법(개운법) */}
      {(() => {
        /**
         * ★★2026-09-01 — 조후를 **정본(`engine/johu2`)** 으로 바꾼다 (Boss 제보:
         *   *"한난조습 지금 측정을 어떻게 하고있어? 내 명식이랑 안맞는거 같은데"*).
         *
         * ■ ⚠️★조후 구현이 **두 벌**이었다 — 이 화면만 옛 것을 쓰고 있었다.
         *   · `engine/johu2.ts` = **정본**. 상담가 판정(`verify-000d-johu` 15건)을 반영했다
         *     (지장간 제외 · 대운 축 분리 · 기준점 우선).
         *   · `app/src/lib/engine/ohaeng.ts` 의 `johuSkew`/`joSeupSkew` = **옛 단순식**.
         *     주석에도 *"단순화 산출 — 명리 stance 정교화는 검수 슬롯"* 이라 적혀 있었다.
         * ■ 실측(Boss 명식 甲戌 丁卯 辛丑 丙申)
         *   · 옛 식(화면): 한난 **더움** · 조습 **건조 쏠림**
         *   · 정본:        한난 **暖** · 조습 **濕**   ← Boss 말씀(“난하고, 습이 아주 조금 우세”)과 **일치**
         *   ⇒ 계산이 틀린 게 아니라 **화면이 옛 함수를 붙들고 있었다.**
         * ★[[duplicate-ui-single-source]] — 같은 것을 두 곳에서 세면 반드시 갈린다.
         */
        const ey = eumYangSkew(P, input?.sex); const jl = johuLabel(johu2(c.saju));
        return (
          <PressableScale style={styles.strDetailBtn} onPress={() => setJohuOpen(true)}>
            <Text style={styles.strDetailBtnTx}>{T('조후')} {jl.hanNan}·{jl.joSeup} · {T('음양')} {ey.skew.replace('양', '+').replace('음', '-')}  — {t('ms.problemFix', '문제점·대응법')} ›</Text>
          </PressableScale>
        );
      })()}

        </>
      )}
      {/* ── 오행과 십성 2: 오행 분포 ── */}
      {activeTab === 'elem' && (
        <>
      {/* 오행 분포 (오행색 도넛 + %·개수 범례) */}
      <Text style={styles.h}>{t('myeongsik.elements')}</Text>
      {/* 지장간 포함 토글(daniel) — 켜면 도넛·범례가 지장간(支藏干) 오행까지 합산해 '숨은 기운'까지 본 분포 */}
      <View style={styles.layerToggle}>
        <PressableScale style={[styles.layerChip, elemHidden && styles.layerChipOn]} onPress={() => setElemHidden((v) => !v)}>
          <Text style={[styles.layerChipTx, elemHidden && styles.layerChipTxOn]}>{elemHidden ? '✓ ' : ''}지장간 포함</Text>
        </PressableScale>
        {/* ★세력 2모드(daniel 2026-08-05) — 켜면 개수 대신 보정 세력 %. 두 칩은 독립(겹쳐 켜기 가능). */}
        <PressableScale style={[styles.layerChip, pwHap && styles.layerChipOn]} onPress={() => setPwHap((v) => !v)}>
          <Text style={[styles.layerChipTx, pwHap && styles.layerChipTxOn]}>{pwHap ? '✓ ' : ''}합화 반영</Text>
        </PressableScale>
        <PressableScale style={[styles.layerChip, pwJohu && styles.layerChipOn]} onPress={() => setPwJohu((v) => !v)}>
          <Text style={[styles.layerChipTx, pwJohu && styles.layerChipTxOn]}>{pwJohu ? '✓ ' : ''}조후·궁성 보정</Text>
        </PressableScale>
      </View>
      {/* ★기간 — 원국에 운을 얹어 본다(Boss 2026-08-25).
          ⚠️어느 대운·세운인지는 **위 운세 탭에서 고른 것**을 따라간다(선택기를 둘로 만들지 않는다). */}
      <View style={styles.layerToggle}>
        {([['natal', T('원국')], ['luck', `+${T('대운')}`], ['both', `+${T('대운')}·${T('세운')}`]] as const).map(([k, label]) => (
          <PressableScale key={k} style={[styles.layerChip, elemSpan === k && styles.layerChipOn]} onPress={() => setElemSpan(k)}>
            <Text style={[styles.layerChipTx, elemSpan === k && styles.layerChipTxOn]}>{label}</Text>
          </PressableScale>
        ))}
        {/* ★시점 고르기 — **운을 얹었을 때만** 뜬다(원국만 볼 땐 고를 것이 없다).
            누르면 대운·세운 목록이 올라온다. 값은 위 운세 띠와 **같은 것**을 바꾼다. */}
        {elemSpan !== 'natal' ? (
          <PressableScale style={[styles.layerChip, styles.spanPickBtn]} onPress={() => setSpanPick(true)}>
            <Text style={styles.layerChipTx}>
              {luckCycles[selLuck] ? t('ms.ageN', '{{n}}세', { n: luckCycles[selLuck].startAge }) : t('ms.pickPoint', '시점')}
              {elemSpan === 'both' && luckCycles[selLuck]?.annuals?.[selSeun]
                ? ` · ${luckCycles[selLuck]!.annuals![selSeun]!.year}` : ''} ▾
            </Text>
          </PressableScale>
        ) : null}
      </View>
      {/* ★시점 고르기 시트 — Boss *"모바일의경우 뷰를 새로 올리던지 해서"*.
          ⚠️`Modal` 을 안 쓴다(iOS 에서 그 안의 영상이 소리만 남는 이력) — 화면 위에 덮는다.
          ⚠️`absoluteFill` 은 **부모를 채우므로** 이 화면의 가장 바깥 안에 있어야 한다. */}
      {spanPick ? (
        <View style={styles.spanSheetWrap}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSpanPick(false)} />
          <View style={styles.spanSheet}>
            <Text style={styles.spanSheetH}>{T('대운')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.spanRow}>
              {luckCycles.map((l, i) => (
                <PressableScale key={`${l.startAge}-${i}`}
                  style={[styles.spanItem, selLuck === i && styles.spanItemOn]}
                  onPress={() => { setSelLuck(i); setSelSeun(0); }}>
                  <Text style={[styles.spanItemTx, selLuck === i && styles.spanItemTxOn]}>{t('ms.ageN', '{{n}}세', { n: l.startAge })}</Text>
                  <Text style={[styles.spanItemGz, selLuck === i && styles.spanItemTxOn]}>{l.stem}{l.branch}</Text>
                </PressableScale>
              ))}
            </ScrollView>
            {/* 세운은 **+대운·세운** 일 때만 고를 수 있다 — 안 쓰는 것을 보여 주면 눌러도 아무 일이 없다 */}
            {elemSpan === 'both' ? (
              <>
                <Text style={styles.spanSheetH}>{T('세운')}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.spanRow}>
                  {((luckCycles[selLuck]?.annuals ?? []) as any[]).map((a, i) => (
                    <PressableScale key={a.year}
                      style={[styles.spanItem, selSeun === i && styles.spanItemOn]}
                      onPress={() => setSelSeun(i)}>
                      <Text style={[styles.spanItemTx, selSeun === i && styles.spanItemTxOn]}>{a.year}</Text>
                      <Text style={[styles.spanItemGz, selSeun === i && styles.spanItemTxOn]}>{a.stem}{a.branch}</Text>
                    </PressableScale>
                  ))}
                </ScrollView>
              </>
            ) : null}
            <PressableScale style={styles.spanDone} onPress={() => setSpanPick(false)}>
              <Text style={styles.spanDoneTx}>{t('common.close', '닫기')}</Text>
            </PressableScale>
          </View>
        </View>
      ) : null}
      {/* 어느 운을 얹었는지 **글자로** 밝힌다 — 안 적으면 무엇이 더해졌는지 알 수 없다 */}
      {spanExtra && spanExtra.length > 0 && (
        <Text style={styles.spanNote}>
          {spanExtra.map((e) => `${e.label} ${e.stem}${e.branch}`).join(' · ')} 을(를) 더해서 본 분포예요.
          발달·과다·부재 표시는 **타고난 글자**만 보고 정해요.
        </Text>
      )}
      {(() => {
        // 도넛(원 그리기)은 오행 상생 순서를 지켜야 한다 — 목생화·화생토… 가 눈에 보여야 해서.
        const order = ['木', '火', '土', '金', '水'] as const;
        // ★보정 모드(pwOn)면 개수(elem) 대신 세력치(pw.power). 표시값도 '개수'가 아니라 % 만.
        const view: Record<string, number> = pwOn && pw
          ? Object.fromEntries(order.map((el) => [el, pw.power[el]]))
          : elem;
        // ★범례(목록)는 **갯수 내림차순**으로 세운다(daniel 2026-08-04 "갯수 내림차순으로 노출시켜").
        //   순서를 고정하면 어느 기운이 많은지 숫자를 하나하나 읽어야 안다 — 많은 것부터 놓으면 한눈에 보인다.
        //   같은 개수면 원래 오행 순서를 유지한다(흔들리지 않게).
        const legendOrder = [...order].sort((a, b) => view[b] - view[a] || order.indexOf(a) - order.indexOf(b));
        const total = order.reduce((a, el) => a + view[el], 0) || 1;
        const R = 40, CX = 50, CY = 50, SW = 13, circ = 2 * Math.PI * R;
        // 누적 오프셋으로 세그먼트 배치(12시 시작). 강한 오행 순이 아니라 상생순(목화토금수) 고정.
        let acc = 0;
        const segs = order.filter((el) => view[el] > 0).map((el) => {
          const frac = view[el] / total;
          const seg = { el, len: circ * frac, offset: acc };
          acc += frac;
          return seg;
        });
        const top = order.reduce((m, el) => (view[el] > view[m] ? el : m), '木' as typeof order[number]);
        return (
          <View style={styles.strengthRow}>
            <Svg width={100} height={100}>
              <Circle cx={CX} cy={CY} r={R} stroke={colors.sunk} strokeWidth={SW} fill="none" />
              {segs.map((sg, i) => (
                <Circle key={i} cx={CX} cy={CY} r={R} stroke={elementColor[sg.el]} strokeWidth={SW} fill="none"
                  strokeDasharray={`${sg.len} ${circ}`} strokeDashoffset={-circ * sg.offset}
                  transform={`rotate(-90 ${CX} ${CY})`} />
              ))}
              <SvgText x={CX} y={CY - 1} fill={elementColor[top]} fontSize={21} fontWeight="800" textAnchor="middle">{top}</SvgText>
              <SvgText x={CX} y={CY + 15} fill={colors.inkSoft} fontSize={9} textAnchor="middle">{t('ms.strongest', '최강')}</SvgText>
            </Svg>
            <View style={styles.elemLegend}>
              {legendOrder.map((el) => (
                <View key={el} style={styles.elemLegendRow}>
                  <View style={[styles.elemDot, { backgroundColor: elementColor[el] }]} />
                  <Text style={[styles.elemLegendEl, { color: elementColor[el] }]}>{el} <Text style={{ fontSize: 11, color: colors.inkFaint, fontWeight: '600' }}>({elemTenGod(el)})</Text></Text>
                  {/* ★발달/과다/부재 라벨(daniel "어떤 오행이 발달했는지도") — 글자 개수 기준·모드 무관 */}
                  {pwLabels[el as '木'] ? (
                    <Text style={[styles.elemDevBadge, pwLabels[el as '木'] === '부재' && { color: colors.inkFaint, borderColor: colors.line }]}>{pwLabels[el as '木']}</Text>
                  ) : null}
                  {/* 보정 모드에선 세력치가 소수라 개수 표기를 빼고 % 만(개수 모드는 기존 그대로) */}
                  <Text style={styles.elemLegendVal}>{pwOn ? '' : `${elem[el]}  ·  `}{Math.round((view[el] / total) * 100)}%</Text>
                </View>
              ))}
            </View>
          </View>
        );
      })()}

        </>
      )}
      {/* 지장간 상세(숨은 기운 표)는 제거(daniel 2026-07-25 '관계분석 아래 지장간 필드 빼') — 지장간은 위 팔자 칸에 이미 표시됨. */}

      {/* ── 운세 탭(대운/세운/월운/일진) — daniel 07-13: 기존 '사주관계' 탭을 운세 전용으로 전환 ── */}
      {/* ★운세(대운·세운·월운·일운) — 사주원국 탭에 통합(daniel 2026-07-24). 원국 아래 이어짐. */}
      {activeTab === 'wonguk' && (
        <>
          {/* ★현재운세 보기(daniel 2026-07-08): 대운/세운/월운/일운을 모두 오늘자 인덱스로 리셋 → 오늘 기준 운세 바로 표시 */}
          <PressableScale
            onPress={() => { setSelLuck(curLuckIdx); setSelSeun(curSeunIdx); setSelMonth(now.getMonth()); setSelDay(now.getDate()); }}
            style={styles.todayBtn}
          >
            <Text style={styles.todayBtnTx}>⊙ {t('ms.todayLuck', '오늘 기준 현재운세 보기')}</Text>
          </PressableScale>
          {/* 대운·세운 타임라인 (원국·지장간 바로 아래) — 대운 탭 → 세운(과거~100세) → 월운 드릴다운
              ★게이트 해제(daniel 2026-08-05 "대운 세운 월운 일운 표시 없어도 원국은 뜨게") —
              종전엔 luckCycles 가 비면 이 블록 전체(원국 기둥 포함)가 사라졌다. 운 컬럼·대운/세운 목록은
              각자 lc/an 가드가 있으므로, 바깥은 항상 열고 안쪽에서 조건부로 그린다. */}
          {(() => {
        const lc = luckCycles[selLuck];
        // 대운수(행운수)+순역 — 명식당 하나. daniel 07-17: 표준 대운수(절기까지 일수÷3, 1~10)로 표기.
        //   라이브러리(lunar-javascript)의 startAge 는 '입운 세는나이'(=순수 대운수 + 1)라 그대로 쓰면 11처럼 큼.
        //   순수 대운수 = getStartYear − 출생연도 = startAge − 1 (재현 검증: 1992-08-09 남 startAge11→대운수10).
        const daeunsu: number | undefined = luckCycles[0]?.startAge != null ? Math.max(1, luckCycles[0].startAge - 1) : undefined;
        const sx = input?.sex;
        const luckDir = sx ? (daeunForward(P['년'].stem, sx) ? T('순행') : T('역행')) : null;
        const an = lc?.annuals?.[selSeun];
        // ★세운 만 나이(daniel) — 선택 세운 연도의 만 나이. 대운 startAge(입운 만나이) + 대운 내 연차(an.year−첫세운.year).
        //   엔진 나이모델(대운 startAge)과 일관 → 대운 옆 나이와 안 어긋남 + 음력도 정확(startAge는 solar 변환 후 산출).
        const seunAge = (an && lc && typeof lc.startAge === 'number' && lc.annuals?.[0])
          ? lc.startAge + (an.year - lc.annuals[0].year) : null;
        // ★월운 인덱싱 수정(daniel 07-07): months 는 寅(正月)기준 0-index(getLiuYue: [0]正월=寅 … [5]六월=未 … [6]七월=申)인데
        //   selMonth 는 양력월(getMonth, 0=1월)이다. 그대로 쓰면 7월(selMonth=6)→months[6]=申월(丙申)로 한 달 밀렸다(daniel).
        //   양력월→절기월 매핑 (selMonth+11)%12: 7월→index5=未월(乙未·정답). (재현 검증: 2026 [5]乙未 [6]丙申)
        const mo = an?.months?.[(selMonth + 11) % 12];
        // 일진(流日) — 선택 세운·월운의 날짜별 간지. 선택 일운(selDay)이 없으면 그 달 1일로 폴백.
        // ★일운 빈칸 수정(daniel 07-07): input 은 저장/대표 명식 로드 시 null 이라 (input && an) 가드가 days 를 비워
        //   *일운 컬럼만 통째로 사라졌다*(월운은 an.months 라 떴음). 일간(dm=c.saju.dayMaster)은 항상 가용 → input 의존 제거.
        const days = an ? computeMonthDays(dm, an.year, selMonth + 1) : [];
        const dayItem = days.find((d) => d.day === selDay) ?? days[0] ?? null;
        // 원국(시일월년) + 선택 대운 + 선택 세운 + 선택 월운 + 선택 일운 = 확장 명식 컬럼
        const expandCols = [
          // ⚠️★`key` 를 함께 싣는다 — `label` 은 언어에 따라 바뀌므로 **글자로 층을 판별하면 깨진다**
          //   (「대운」이 「大運」이 되는 순간 `col.label === '대운'` 이 거짓이 된다).
          ...visiblePos.map((p) => ({ key: p, label: T(`${p}주`), stem: P[p].stem, branch: P[p].branch, tg: P[p].stemTenGod, luck: false, hidden: HIDDEN[P[p].branch] ?? [] })),
          ...(lc && showLayers.luck ? [{ key: 'luck', label: T('대운'), stem: lc.stem, branch: lc.branch, tg: lc.stemTenGod, luck: true, hidden: HIDDEN[lc.branch as keyof typeof HIDDEN] ?? [] }] : []),
          ...(an && showLayers.year ? [{ key: 'year', label: T('세운'), stem: an.stem, branch: an.branch, tg: an.stemTenGod, luck: true, hidden: HIDDEN[an.branch as keyof typeof HIDDEN] ?? [] }] : []),
          ...(mo && showLayers.month ? [{ key: 'month', label: t('ms.monthN', '{{n}}월', { n: selMonth + 1 }), stem: mo.stem, branch: mo.branch, tg: mo.stemTenGod, luck: true, hidden: HIDDEN[mo.branch as keyof typeof HIDDEN] ?? [] }] : []),
          ...(dayItem && showLayers.day ? [{ key: 'day', label: T('일운'), stem: dayItem.stem, branch: dayItem.branch, tg: dayItem.stemTenGod, luck: true, hidden: HIDDEN[dayItem.branch as keyof typeof HIDDEN] ?? [] }] : []),
        ];
        // 시간층 합충 — 확장명식 컬럼(원국+운) 간 작용. 운(대운/세운/월운) 연루된 것만(원국끼리는 팔자 표에).
        // 컬럼 수에 맞춰 가용폭(expW)을 꽉 채움 — 층을 끄면 칸이 넓어지고 글자(scale)도 커진다.
        //   컬럼이 많아 폭을 넘으면 최소 50으로 두고 가로 스크롤. scale 상한 1.7(과도 확대 방지).
        // ★운 중첩 다이어그램(daniel 2026-08-05) — 원국 제일 안쪽, 일운→월운→년운→대운이 감싼다.
        //   배열 순서 = 안쪽부터(daniel 지정 순서 그대로). 데이터 없거나 토글 끈 층은 감싸지 않는다.
        const nestRings = [
          ...(dayItem && showLayers.day ? [{ label: T('일운'), stem: dayItem.stem, branch: dayItem.branch, sub: dayItem.stemTenGod }] : []),
          ...(mo && showLayers.month ? [{ label: `${t('ms.monthN', '{{n}}월', { n: selMonth + 1 })}${T('월운').slice(-1)}`, stem: mo.stem, branch: mo.branch, sub: mo.stemTenGod }] : []),
          ...(an && showLayers.year ? [{ label: `${an.year}${T('유년').slice(-1)}`, stem: an.stem, branch: an.branch, sub: an.stemTenGod }] : []),
          ...(lc && showLayers.luck ? [{ label: `${T('대운')} ${t('ms.ageN', '{{n}}세', { n: lc.startAge })}~`, stem: lc.stem, branch: lc.branch, sub: lc.stemTenGod }] : []),
        ];
        const nCols = expandCols.length || 1;
        const COLW = expW > 0 ? Math.max(50, Math.floor(expW / nCols)) : 50;
        const scale = Math.min(1.7, COLW / 50);
        // 운(대운/세운/월운/일운) 컬럼이 하나라도 켜져 있으면 = 운 연루된 작용만(원국끼리는 위 팔자 표에 이미 표시).
        //   ★모든 운이 꺼져 원국만 남으면 = 원국 합충형해를 여기서도 보여준다(daniel 07-05: 다 꺼도 원국 합충 나와야).
        const hasLuckCol = expandCols.some((c2) => c2.luck);
        const expandLinks = detectInteractionsAmong(expandCols.map((c2) => ({ pos: c2.label as any, stem: c2.stem, branch: c2.branch })))
          .filter((it) => it.members.length >= 2 && (!hasLuckCol || it.members.some((m) => expandCols.find((c2) => c2.label === m)?.luck))); // 운 켜짐=운 연루만 / 다 꺼짐=원국 전부
        const ganEx = expandLinks.filter((it) => it.level === '천간');
        const jiEx = expandLinks.filter((it) => it.level !== '천간');
        const normEx = [...ganEx, ...jiEx].map((it: any) => {
          const isGan = it.level === '천간';
          // members 전체(쌍·3자 국) → 확장 컬럼 매칭. 하나라도 못 찾으면 표시 제외(방어).
          const cols = (it.members as string[]).map((m) => expandCols.find((cc) => cc.label === m));
          if (cols.some((cc) => !cc)) return null;
          const mem = cols.map((cc: any) => ({ label: cc.label, char: isGan ? cc.stem : cc.branch, el: isGan ? stemElement(cc.stem) : branchElement(cc.branch) }));
          return { key: it.detail as string, type: it.type, transformsTo: it.transformsTo, isGan, mem };
        }).filter(Boolean);
        const hlExpand = new Set<string>();
        [...ganEx, ...jiEx].forEach((it: any) => { if (activeExpand.has(it.detail)) it.members.forEach((m: string) => hlExpand.add(m)); });
        const activeGanEx = ganEx.filter((it: any) => activeExpand.has(it.detail));   // 켠 천간 작용 → 호
        const activeJiEx = jiEx.filter((it: any) => activeExpand.has(it.detail));     // 켠 지지 작용 → 호
        const xOfCol = (label: string) => expandCols.findIndex((c2) => c2.label === label) * COLW + COLW / 2;
        const expandArcs = (links: any[], dir: 'above' | 'below') => {
          if (!links.length) return null;
          const STEP = 16, H = links.length * STEP + 14, reach = dir === 'above' ? H : 0;
          const dash = dir === 'above' ? '3 2' : undefined;
          // ★라벨 양옆 잘림 방지(daniel 07-11): SVG 폭 밖으로 라벨이 넘으면 뷰포트가 잘라낸다. 폭에 좌우 여백(PAD)을 주고
          //   라벨(+연결선 갭)을 [lw/2, W-lw/2] 로 clamp 해 어느 칸의 라벨이든 안 잘리게. 아크 다리(xa·xb)는 칸 중앙 그대로.
          const PAD = 8;
          const svgW = expandCols.length * COLW + PAD * 2;
          const items = links.map((it, i) => {
            // off 없음 — 칸 '중앙'에서 출발(daniel: 대운/세운/월운/일운 토글로 컬럼 수가 바뀌어도 칸 중앙 정렬). 겹침은 다리 높이로 구분.
            const xs = (it.members as string[]).map((m) => xOfCol(m) + PAD).sort((a, b) => a - b); // 3자 국 포함 전 멤버(+PAD 오프셋)
            const xa = xs[0], xb = xs[xs.length - 1];
            const legY = dir === 'above' ? 6 + i * STEP : H - (6 + i * STEP);
            const lbl = linkLabel(it);
            const lw = lbl.length * 12 + 8; // 라벨 배경 폭(한글 넉넉히 — 텍스트가 배경/뷰포트를 넘지 않게)
            const mid = (xa + xb) / 2;
            const lx = Math.max(lw / 2 + 1, Math.min(mid, svgW - lw / 2 - 1)); // 라벨을 SVG 안쪽으로 clamp(양옆 잘림 방지)
            return { xa, xb, mids: xs.slice(1, -1), mid, lx, legY, col: linkColor(it), lbl, lw };
          });
          return (
            <Svg width={svgW} height={H} style={{ marginLeft: -PAD }}>
              {items.map((o, i) => (
                <G key={`p${i}`}>
                  <Path d={`M ${o.xa} ${reach} L ${o.xa} ${o.legY} L ${o.lx - o.lw / 2} ${o.legY}`} stroke={o.col} strokeWidth={1.5} fill="none" strokeDasharray={dash} />
                  <Path d={`M ${o.lx + o.lw / 2} ${o.legY} L ${o.xb} ${o.legY} L ${o.xb} ${reach}`} stroke={o.col} strokeWidth={1.5} fill="none" strokeDasharray={dash} />
                  {o.mids.map((mx, k) => (
                    <Path key={k} d={`M ${mx} ${reach} L ${mx} ${o.legY}`} stroke={o.col} strokeWidth={1.5} fill="none" strokeDasharray={dash} />
                  ))}
                </G>
              ))}
              {items.map((o, i) => (
                <G key={`l${i}`}>
                  <Rect x={o.lx - o.lw / 2} y={o.legY - 7} width={o.lw} height={14} fill={colors.bg} rx={2} />
                  <SvgText x={o.lx} y={o.legY + 3} fill={o.col} fontSize={9} fontWeight="700" textAnchor="middle">{o.lbl}</SvgText>
                </G>
              ))}
            </Svg>
          );
        };
        return (
        <>
          <Text style={styles.h}>{t('myeongsik.luck')}</Text>
          {/* 시간층 토글 — 명식에 년운·월운·일운 표시/숨김(대운은 항상 표시) */}
          <View style={styles.layerToggle}>
            {([['luck', T('대운')], ['year', T('유년')], ['month', T('월운')], ['day', T('일운')]] as const).map(([k, l]) => (
              <PressableScale key={k} style={[styles.layerChip, showLayers[k] && styles.layerChipOn]} onPress={() => setShowLayers((p) => ({ ...p, [k]: !p[k] }))}>
                <Text style={[styles.layerChipTx, showLayers[k] && styles.layerChipTxOn]}>{showLayers[k] ? '✓ ' : ''}{l}</Text>
              </PressableScale>
            ))}
          </View>
          {/* ★표시 모드 선택(daniel 2026-08-05 2차): 옆으로 보기(기존 그리드) / 벤다이어그램(중첩). */}
          <View style={[styles.layerToggle, { marginTop: space(2) }]}>
            {([['cols', t('ms.viewCols', '옆으로 보기')], ['nest', t('ms.viewNest', '벤다이어그램')]] as const).map(([k, l]) => (
              <PressableScale key={k} style={[styles.layerChip, luckView === k && styles.layerChipOn]} onPress={() => setLuckView(k)}>
                <Text style={[styles.layerChipTx, luckView === k && styles.layerChipTxOn]}>{luckView === k ? '✓ ' : ''}{l}</Text>
              </PressableScale>
            ))}
          </View>
          {/* ★운 중첩(벤다이어그램) — 원국 제일 안쪽·일운이 첫 띠(daniel 2차: 일운=가장 안쪽·색깔 한자).
              켠 층·데이터 있는 층만 두른다. 운 전부 꺼도 원국 상자는 남는다. */}
          {luckView === 'nest' && (
          <View style={{ marginTop: space(3), marginBottom: space(2) }}>
            <LuckNest
              natal={visiblePos.map((p) => ({ pos: T(`${p}주`), stem: P[p].stem, branch: P[p].branch }))}
              rings={nestRings}
              hangeul={hangeul}
            />
          </View>
          )}
          {/* ★옆으로 보기(기존 확장명식). 운을 다 꺼도 원국 컬럼은 남긴다(daniel 2026-08-05 2차 —
              07-24 '다 끄면 중복 렌더 안 함' 결정을 대체). */}
          {luckView === 'cols' && (<>
          {/* 원국 + 대운·세운 확장 명식 (합충선은 아래 토글로 펼침) */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.luckScroll} onLayout={(e) => setExpW(e.nativeEvent.layout.width)}>
            <View>
              {expandArcs(activeGanEx, 'above')}
              <View style={{ flexDirection: 'row' }}>
                {expandCols.map((col, i) => (
                  <View key={i} style={[styles.expCol2, { width: COLW }, col.luck && styles.expColLuck, hlExpand.has(col.label) && styles.expCol2On]}>
                    <Text style={[styles.expLabel, { fontSize: Math.round(fs(11) * scale) }]}>{col.label}</Text>
                    {/* 대운수(입운 나이) — 대운 컬럼만 표기, 나머지 컬럼은 빈 줄로 세로 정렬 유지 */}
                    <Text style={[styles.expAge, { fontSize: Math.round(fs(9) * scale) }]}>{col.key === 'luck' && lc ? t('ms.ageN', '{{n}}세', { n: lc.startAge }) : col.key === 'year' && seunAge != null ? t('ms.ageFull', '만 {{n}}세', { n: seunAge }) : ' '}</Text>
                    <Text style={[styles.expTg, { fontSize: Math.round(fs(11) * scale) }]}>{col.tg}</Text>
                    <GzCell char={col.stem} kind="stem" size="sm" scale={scale} grid hangeul={hangeul} onPress={() => setGlossary({ kind: 'stem', key: col.stem })} />
                    <GzCell char={col.branch} kind="branch" size="sm" scale={scale} grid hangeul={hangeul} onPress={() => setGlossary({ kind: 'branch', key: col.branch })} />
                    <Text style={[styles.expTg, { fontSize: Math.round(fs(11) * scale) }]}>{branchTenGod(dm, col.branch)}</Text>
                    <PressableScale onPress={() => setGlossary({ kind: 'stage', key: twelveStage(dm, col.branch) })}>
                      <Text style={[styles.expStage, { fontSize: Math.round(fs(10) * scale) }]}>{twelveStage(dm, col.branch)}</Text>
                    </PressableScale>
                    <View style={styles.expHidden}>
                      {/* ★지장간 = 여기·중기·본기 3슬롯 고정(daniel 2026-07-24): 중기 없는 지지(왕지 卯·酉 등)는 가운데를 비워 세로 정렬(빈 슬롯 = faint '·'). */}
                      {(['여기', '중기', '본기'] as const).map((role, k) => {
                        const h = col.hidden.find((x: any) => x.role === role);
                        return (
                          <Text key={k} style={[styles.expHiddenTx, { fontSize: ls(12), lineHeight: 15 }, h ? { color: elementColor[stemElement(h.stem)] } : { color: colors.line }]}>{h ? h.stem : '·'}</Text>
                        );
                      })}
                    </View>
                  </View>
                ))}
              </View>
              {expandArcs(activeJiEx, 'below')}
            </View>
          </ScrollView>
          {(ganEx.length + jiEx.length) > 0 && (
            <PressableScale style={styles.linksToggle} onPress={() => setShowExpandLinks((v) => !v)}>
              <Text style={styles.linksToggleTx}>{hasLuckCol ? `${t('ms.luckWord', '운')} ` : `${T('원국')} `}{t('myeongsik.interactions')} {ganEx.length + jiEx.length}{t('ms.countSuffix', '개')}  {showExpandLinks ? t('ms.collapse', '▲ 접기') : t('ms.expand', '▼ 펼쳐 보기')}</Text>
            </PressableScale>
          )}
          {showExpandLinks && normEx.length > 0 && (
            <View style={styles.linksCard}>
              <Text style={styles.strHint}>{t('ms.byStrength', '작용이 강한 순 — 충·합 강 / 형·극 중 / 해·파 약')}</Text>
              {/* ③ 운 합충선 전체 선택/해제(daniel) — 한번에 켜고 끄기 */}
              <PressableScale onPress={() => setActiveExpand((p) => p.size ? new Set<string>() : new Set(normEx.map((x: any) => x.key as string)))} style={{ alignSelf: 'flex-end', paddingVertical: 4, paddingHorizontal: 8 }}>
                <Text style={{ color: colors.ju, fontWeight: '700', fontSize: 12 }}>{activeExpand.size ? t('ms.unselectAll', '전체 해제') : t('ms.selectAll', '전체 선택')}</Text>
              </PressableScale>
              {renderByStrength(normEx as any[], activeExpand, (k) => toggleKey(setActiveExpand, k))}
            </View>
          )}
          </>)}
          {/* 대운 타임라인 — 제목 옆 대운수(행운수)·순역 표기(daniel). 운 데이터 없으면 목록 자체가 없다. */}
          {luckCycles.length > 0 && (<>
          <Text style={styles.luckSub}>
            {/* ★지금 보는 층을 **굵게**(Boss 2026-08-26 *"대운 세운 이렇게 같이 나와있으니깐
                이게 대운인지 세운인지 모르겠고"*). 제목이 «A · B» 인데 아래 띠는 **B** 다. */}
            <Text style={styles.luckSubOn}>{T('대운')}</Text>{daeunsu != null ? <Text style={{ fontWeight: '700' }}> · {t('ms.daeunsu', '대운수')} {daeunsu}{luckDir ? ` ${luckDir}` : ''}</Text> : null} {t('ms.tapDaeun', '(탭하면 그 대운의 세운 펼침)')}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} ref={luckScrollRef} onLayout={(e) => { centerM.current.luck.v = e.nativeEvent.layout.width; recenter('luck', luckScrollRef); }} onContentSizeChange={() => recenter('luck', luckScrollRef)} style={styles.luckScroll} contentContainerStyle={[styles.luckScrollC, { flexGrow: 1 }]}>
            {luckCycles.map((l, i) => (
              <PressableScale key={i} onPress={() => { setSelLuck(i); setSelSeun(0); }} onLayout={l.isCurrent ? (e) => { centerM.current.luck.x = e.nativeEvent.layout.x; centerM.current.luck.w = e.nativeEvent.layout.width; recenter('luck', luckScrollRef); } : undefined} style={[styles.luckCard, { minWidth: ls(58), flex: 1 }, l.isCurrent && styles.luckCardCur, selLuck === i && styles.luckCardSel]}>
                <Text style={styles.luckAge}>{t('ms.ageN', '{{n}}세', { n: l.startAge })}</Text>
                <Text style={styles.luckTg}>{l.stemTenGod}</Text>
                <GzCell char={l.stem} kind="stem" size="sm" hangeul={hangeul} />
                <GzCell char={l.branch} kind="branch" size="sm" hangeul={hangeul} />
                <Text style={styles.luckTg}>{branchTenGod(dm, l.branch)}</Text>
                <Text style={styles.luckStage}>{twelveStage(dm, l.branch)}</Text>
                {/* ★살 꼬리표를 **칸에서 뺐다**(Boss 2026-08-26 *"발생하는 살은 따로 공간을 만들어서"*).
                    칸이 좁아 두 개만 보이던 데다, 간지·십신·12운성과 뒤섞여 무엇이 무엇인지 안 갈렸다.
                    ⇒ 아래 **전용 칸**에서 전부 본다(자르지 않는다). */}
              </PressableScale>
            ))}
          </ScrollView>
          <LuckSinsalLine label={lc ? `${t('ms.ageN', '{{n}}세', { n: lc.startAge })} ${T('대운')} ${lc.stem}${lc.branch}` : ''}
                          saju={c.saju} stem={lc?.stem} branch={lc?.branch}
                          onTag={(n) => setGlossary(n === '공망' ? { kind: 'gongmang' } : { kind: 'sinsal', key: n })} />
          </>)}
          {/* 세운 타임라인 (선택 대운 10년, 탭 → 확장 명식 갱신) */}
          {lc?.annuals?.length > 0 && (
            <>
              {/* 아래 띠는 **세운**이다 — 그 낱말만 굵게 */}
              <Text style={styles.luckSub}>{t('ms.ageN', '{{n}}세', { n: lc.startAge })} {T('대운')} · <Text style={styles.luckSubOn}>{T('세운')}</Text> {t('ms.tapReflect', '(탭하면 위 명식에 반영)')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} ref={seunScrollRef} onLayout={(e) => { centerM.current.seun.v = e.nativeEvent.layout.width; recenter('seun', seunScrollRef); }} onContentSizeChange={() => recenter('seun', seunScrollRef)} style={styles.luckScroll} contentContainerStyle={[styles.luckScrollC, { flexGrow: 1 }]}>
                {lc.annuals.map((a: any, j: number) => {
                  // ★세운 만 나이(daniel 2026-07-12) — 대운 입운 만나이(startAge) + 대운 내 연차(위 seunAge 와 동일식·엔진 나이모델 일관)
                  const seunAgeJ = (typeof lc.startAge === 'number' && lc.annuals?.[0]) ? lc.startAge + (a.year - lc.annuals[0].year) : null;
                  return (
                  <PressableScale key={j} onPress={() => { setSelSeun(j); setSelMonth(0); }} onLayout={a.year === s.annual?.year ? (e) => { centerM.current.seun.x = e.nativeEvent.layout.x; centerM.current.seun.w = e.nativeEvent.layout.width; recenter('seun', seunScrollRef); } : undefined} style={[styles.seunCard, selSeun === j && styles.luckCardSel, a.year === s.annual?.year && styles.seunCur]}>
                    <Text style={styles.seunYear}>{a.year}</Text>
                    {seunAgeJ != null && <Text style={styles.seunAge}>{seunAgeJ}세</Text>}
                    <Text style={styles.seunTg}>{a.stemTenGod}</Text>
                    <GzCell char={a.stem} kind="stem" size="xs" hangeul={hangeul} />
                    <GzCell char={a.branch} kind="branch" size="xs" hangeul={hangeul} />
                    <Text style={styles.seunTg}>{branchTenGod(dm, a.branch)}</Text>
                    <Text style={styles.seunStage}>{twelveStage(dm, a.branch)}</Text>
                  </PressableScale>
                  );
                })}
              </ScrollView>
              <LuckSinsalLine label={an ? `${an.year} ${T('세운')} ${an.stem}${an.branch}` : ''}
                              saju={c.saju} stem={an?.stem} branch={an?.branch}
                              onTag={(n) => setGlossary(n === '공망' ? { kind: 'gongmang' } : { kind: 'sinsal', key: n })} />
            </>
          )}
          {an?.months && an.months.length > 0 && (
            <>
              {/* 아래 띠는 **월운**이다 */}
              <Text style={styles.luckSub}>{an.year} {T('세운')} · <Text style={styles.luckSubOn}>{T('월운')}</Text> {t('ms.tapReflect', '(탭하면 위 명식에 반영)')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} ref={monthScrollRef} onLayout={(e) => { centerM.current.month.v = e.nativeEvent.layout.width; recenter('month', monthScrollRef); }} onContentSizeChange={() => recenter('month', monthScrollRef)} style={styles.luckScroll} contentContainerStyle={[styles.luckScrollC, { flexGrow: 1 }]}>
                {an.months.map((_m: any, k: number) => {
                  // ★월 선택기(daniel 2026-07-08): 카드 k = 양력월(라벨 (k+1)월). 干支는 월운 타임라인(위 line 716)과 동일하게
                  //   절기월로 매핑 months[(k+11)%12] — 예전엔 months[k] 를 그대로 써 7월(k=6) 카드에 申월(丙申)이 떠 한 달 밀렸다.
                  const m = an.months[(k + 11) % 12];
                  return (
                  <PressableScale key={k} onPress={() => setSelMonth(k)} onLayout={selMonth === k ? (e) => { centerM.current.month.x = e.nativeEvent.layout.x; centerM.current.month.w = e.nativeEvent.layout.width; recenter('month', monthScrollRef); } : undefined} style={[styles.seunCard, selMonth === k && styles.luckCardSel]}>
                    <Text style={styles.seunYear}>{k + 1}월</Text>
                    <Text style={styles.seunTg}>{m.stemTenGod}</Text>
                    <GzCell char={m.stem} kind="stem" size="xs" hangeul={hangeul} />
                    <GzCell char={m.branch} kind="branch" size="xs" hangeul={hangeul} />
                    <Text style={styles.seunTg}>{branchTenGod(dm, m.branch)}</Text>
                    <Text style={styles.seunStage}>{twelveStage(dm, m.branch)}</Text>
                  </PressableScale>
                  );
                })}
              </ScrollView>
              {/* ★월운에도 살 칸을 둔다 — 대운·세운엔 있는데 여기만 없으면 «월운은 살이 없나» 로 읽힌다.
                  층이 셋이면 셋 다 같은 자리에 같은 모양으로 있어야 한다. */}
              <LuckSinsalLine label={mo ? `${an.year} ${t('ms.monthN', '{{n}}월', { n: selMonth + 1 })} ${T('월운')} ${mo.stem}${mo.branch}` : ''}
                              saju={c.saju} stem={mo?.stem} branch={mo?.branch}
                              onTag={(n) => setGlossary(n === '공망' ? { kind: 'gongmang' } : { kind: 'sinsal', key: n })} />
            </>
          )}
          {/* 월운 탭 → 그 달 일진(日辰) 달력 — 날짜 탭하면 위 명식 '일운'에 반영 */}
          {input && an?.months?.[selMonth] && days.length > 0 && (() => {
            const firstDow = new Date(an.year, selMonth, 1).getDay(); // 1일 요일(0=일)
            return (
              <>
                <Text style={styles.luckSub}>{t('ms.dayCal', '{{y}}년 {{m}}월 일진 달력', { y: an.year, m: selMonth + 1 })} {t('ms.tapReflectDay', '(탭하면 위 명식에 일운 반영)')}</Text>
                <View style={styles.calGrid}>
                  {(t('ms.dow', '일,월,화,수,목,금,토').split(',')).map((w) => (
                    <Text key={w} style={styles.calHead}>{w}</Text>
                  ))}
                  {Array.from({ length: firstDow }).map((_, i) => <View key={`e${i}`} style={styles.calCell} />)}
                  {days.map((dd) => {
                    const isToday = an.year === now.getFullYear() && selMonth === now.getMonth() && dd.day === now.getDate();
                    const isSel = dayItem?.day === dd.day; // 선택된 일운 강조
                    return (
                      <PressableScale key={dd.day} onPress={() => setSelDay(dd.day)} style={[styles.calCell, isToday && styles.calCellToday, isSel && styles.calCellSel]}>
                        <Text style={[styles.calDay, isToday && styles.calDayToday]}>{dd.day}{isToday ? ` ·${t('ms.today', '오늘')}` : ''}</Text>
                        {/* ★일진 달력 오행색(daniel 07-07): 간지 전체를 stem 색 하나로 칠하던 것 → 천간·지지 각각 제 오행색(壬=水파랑·午=火빨강). */}
                        <Text style={styles.calGz}>
                          <Text style={{ color: elementColor[stemElement(dd.stem)] }}>{hangeul ? stemReading(dd.stem) : dd.stem}</Text>
                          <Text style={{ color: elementColor[branchElement(dd.branch)] }}>{hangeul ? branchReading(dd.branch) : dd.branch}</Text>
                        </Text>
                      </PressableScale>
                    );
                  })}
                </View>
              </>
            );
          })()}
              </>
            );
          })()}
        </>
      )}

      {/* 신살·공망 = 팔자 바로 아래로 이동(daniel 2026-07-25 T) · 운에서 오는 신살 제거(S). 여기 있던 '신살과 길성' 블록은 삭제. */}
      {/* ── 자미두수: 사주관계 신살탭에서 별도 탭으로 분리(daniel) ── */}
      {/* ── 일주론(Boss 2026-08-25) ── ★화면을 베끼지 않았다: `/dayPillar` 와 **같은 자료**를 읽고
             내 일주만 보여 준다. 60갑자 전체는 그 화면으로 보낸다(문구가 두 갈래가 되지 않게). */}
      {activeTab === 'ilju' && <IljuTabCard saju={c.saju} sex={(input?.sex as '남' | '여' | undefined) ?? null} />}

      {activeTab === 'ziwei' && (
        <>
      {/* 자미두수(보조) */}
      <Text style={styles.h}>{t('myeongsik.ziwei')}</Text>
      <Text style={[styles.hint, { marginHorizontal: 0 }]}>{t('ms.ziweiIntro', '사주와는 별개의 운명 체계예요. 태어난 시각으로 열두 자리(명궁·재물·관록·배우자 등)에 별을 배치해, 삶의 각 영역에 드는 기운을 봅니다. 사주를 보조해 교차로 참고해요.')}</Text>
      <Text style={styles.kv}>{c.ziwei.bureau} · {t('myeongsik.lifePalace')} {c.ziwei.lifePalaceBranch}</Text>
      {/* 자미두수 명반 (12궁 4×4, 중앙=일간·명궁·국) */}
      {(() => {
        const byBr: Record<string, any> = {};
        (c.ziwei.palaces as any[]).forEach((pl) => { byBr[pl.branch] = pl; });
        const LAYOUT = [['巳', '午', '未', '申'], ['辰', 'C', 'C', '酉'], ['卯', 'C', 'C', '戌'], ['寅', '丑', '子', '亥']];
        const sihwaCol: Record<string, string> = { '化祿': '#3E8E5A', '化權': '#C0392B', '化科': '#3A6EA5', '化忌': '#7A7A7A' };
        const brSym: Record<string, string> = { '廟': '◎', '旺': '○', '得地': '△', '利': '△', '平': '△', '不得地': 'x', '陷': 'x' }; // 밝기 기호(daniel 참고 양식)
        const dm = c.saju.dayMaster;
        return (
          <View style={styles.ziGrid}>
            {LAYOUT.map((row, r) => (
              <View key={r} style={styles.ziRow}>
                {row.map((cell, ci) => {
                  if (cell === 'C') {
                    const info = r === 1 && ci === 1 ? { t: T('일간'), v: dm.stem }
                      : r === 1 && ci === 2 ? { t: T('명궁'), v: c.ziwei.lifePalaceBranch }
                      : r === 2 && ci === 1 ? { t: t('ms.bureau', '국'), v: c.ziwei.bureau.replace('五局', '') }
                      : { t: T('오행'), v: dm.element };
                    return (
                      <View key={ci} style={styles.ziCenterCell}>
                        <Text style={styles.ziCenterT}>{info.t}</Text>
                        <Text style={styles.ziCenterV}>{info.v}</Text>
                      </View>
                    );
                  }
                  const pl = byBr[cell];
                  return (
                    <View key={ci} style={styles.ziCell}>
                      <View style={styles.ziTop}>
                        {pl ? (
                          <PressableScale onPress={() => setGlossary({ kind: 'palace', key: pl.name })}><Text style={[styles.ziName, styles.ziLink]}>{pl.name}</Text></PressableScale>
                        ) : <Text style={styles.ziName} />}
                        <Text style={[styles.ziBr, { color: elementColor[branchElement(cell)] }]}>{cell}</Text>
                      </View>
                      {pl?.majorStars?.map((st: any, i: number) => (
                        <PressableScale key={i} onPress={() => setGlossary({ kind: 'star', key: st.name })}>
                          <Text style={[styles.ziMajor, styles.ziLink]}>
                            {st.name}<Text style={styles.ziBright}>{brSym[st.brightness] ?? ''}</Text>
                            {(st.transforms ?? []).map((tr: string, j: number) => <Text key={j} style={[styles.ziSihwa, { color: sihwaCol[tr] ?? colors.ink }]}> {tr.slice(-1)}</Text>)}
                          </Text>
                        </PressableScale>
                      ))}
                      {pl?.minorStars?.map((s: any, k: number) => (
                        <PressableScale key={`m${k}`} onPress={() => setGlossary({ kind: 'star', key: s.name })}>
                          <Text style={[styles.ziMinor, styles.ziLink]}>{s.name}</Text>
                        </PressableScale>
                      ))}
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        );
      })()}

      {/* ── 자미두수 운흐름(대한) ── daniel 2026-08-04 "만세력에 자미두수에 자미두수 운흐름도 표출해".
          엔진(iztro)이 이미 `ziwei.decades` 로 대한 구간·비성사화를 계산해 두고 있었는데 **어디서도 안 그리고 있었다**.
          ⚠️여기서 새로 판정하는 건 없다 — 결정론 산출을 표로 옮길 뿐(CLAUDE.md §3.3: 자미두수는 보조·수렴까지).
          사화 색은 위 명반과 **같은 팔레트**를 쓴다(따로 정의하면 또 갈린다). */}
      {Array.isArray((c.ziwei as any).decades) && (c.ziwei as any).decades.length > 0 && (() => {
        const SIHWA_COL: Record<string, string> = { '化祿': '#3E8E5A', '化權': '#C0392B', '化科': '#3A6EA5', '化忌': '#7A7A7A' };
        return (
          <>
            <Text style={styles.h}>{t('ms.ziweiFlow', '자미두수 운흐름')}</Text>
            <Text style={styles.luckSub}>{t('ms.ziweiFlowSub', '대한(10년) · 그 시기 천간이 일으키는 비성사화')}</Text>
            {((c.ziwei as any).decades as any[]).map((d: any, i: number) => (
              <View key={i} style={styles.ziDecRow}>
                <Text style={styles.ziDecAge}>{d.startAge}~{d.startAge + 9}세</Text>
                <Text style={styles.ziDecBr}>{d.palaceBranch}</Text>
                <View style={styles.ziDecSihwa}>
                  {(d.flyingSihwa ?? []).map((fs2: any, j: number) => (
                    <Text key={j} style={[styles.ziDecTx, { color: SIHWA_COL[fs2.type] ?? colors.ink }]}>
                      {fs2.star}{String(fs2.type).slice(-1)}{fs2.intoPalace ? `→${fs2.intoPalace}` : ''}{j < ((d.flyingSihwa?.length ?? 0) - 1) ? ' · ' : ''}
                    </Text>
                  ))}
                </View>
              </View>
            ))}
          </>
        );
      })()}
        </>
      )}

{onReading && (
        <PressableScale style={styles.readingBtn} onPress={onReading}>
          <Text style={styles.readingBtnText}>{t('myeongsik.readingBtn')}</Text>
        </PressableScale>
      )}
      </Animated.View>
    </ScrollView>

    {/* 클릭 설명 바텀시트 — 십신·신살·공망 의미 (탭한 항목) */}
    <Modal statusBarTranslucent visible={!!glossary} transparent animationType="slide" onRequestClose={() => setGlossary(null)}>
      <Pressable style={styles.sheetOverlay} onPress={() => setGlossary(null)}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          {glossary && (() => {
            const e = lookupGlossary(glossary.kind, glossary.key);
            if (!e) return <Text style={styles.sheetMeaning}>{glossary.key}</Text>;
            return (
              <>
                <View style={styles.sheetHandle} />
                <Text style={styles.sheetKind}>{GLOSSARY_KIND_LABEL[glossary.kind]}</Text>
                <Text style={styles.sheetTitle}>{e.ko}{e.hanja ? `   ${e.hanja}` : ''}</Text>
                <Text style={styles.sheetMeaning}>{e.meaning}</Text>
                <View style={styles.sheetChips}>
                  {e.keywords.map((k, i) => <Text key={i} style={styles.sheetChip}>{k}</Text>)}
                </View>
                <PressableScale style={styles.sheetClose} onPress={() => setGlossary(null)}>
                  <Text style={styles.sheetCloseText}>{t('common.close')}</Text>
                </PressableScale>
              </>
            );
          })()}
        </Pressable>
      </Pressable>
    </Modal>

    {/* 카테고리 ? 설명 시트(daniel: 설명도 나오게) — 지금 보는 분류가 무엇을 보는지 쉬운 말로 */}
    <Modal statusBarTranslucent visible={catDescOpen} transparent animationType="slide" onRequestClose={() => setCatDescOpen(false)}>
      <Pressable style={styles.sheetOverlay} onPress={() => setCatDescOpen(false)}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>{t(MYEONG_TABS.find((x) => x.id === activeTab)?.label ?? '')}</Text>
          <Text style={styles.sheetMeaning}>{t(MYEONG_TABS.find((x) => x.id === activeTab)?.desc ?? '')}</Text>
          <PressableScale style={styles.sheetClose} onPress={() => setCatDescOpen(false)}>
            <Text style={styles.sheetCloseText}>{t('common.close')}</Text>
          </PressableScale>
        </Pressable>
      </Pressable>
    </Modal>

    {/* 신강·신약 특징 시트 — 내 유형 강조 + 성향·강점·주의·용신 방향 */}
    <Modal statusBarTranslucent visible={strengthOpen} transparent animationType="slide" onRequestClose={() => setStrengthOpen(false)}>
      <Pressable style={styles.sheetOverlay} onPress={() => setStrengthOpen(false)}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetKind}>{T('신강')}·{T('신약')}</Text>
          <Text style={styles.sheetTitle}>{t('ms.myChart', '내 명식')} · {T(c.strengthClass.type)}</Text>
          <ScrollView style={{ flexShrink: 1 }} showsVerticalScrollIndicator={true}>
            {STRENGTH_INFO.map((s) => {
              const mine = c.strengthClass.type.includes(s.key === '신강' ? '강' : '약');
              return (
                <View key={s.key} style={[styles.strDetailCard, mine && styles.strDetailMine]}>
                  <Text style={styles.strDetailTitle}>{t(s.title)}{mine ? `  · ${t('ms.mine', '내 유형')}` : ''}</Text>
                  <Text style={styles.strDetailBody}>{t(s.traits)}</Text>
                  <Text style={styles.strDetailLabel}>{t('ms.pro', '강점')}</Text>
                  <Text style={styles.strDetailBody}>{t(s.strong)}</Text>
                  <Text style={styles.strDetailLabel}>{t('ms.con', '주의')}</Text>
                  <Text style={styles.strDetailBody}>{t(s.caution)}</Text>
                  <Text style={styles.strDetailLabel}>{t('ms.dir', '방향 (用神)')}</Text>
                  <Text style={styles.strDetailBody}>{t(s.yongsin)}</Text>
                </View>
              );
            })}
            <Text style={styles.sheetMeaning}>{t('ms.noteTendency', '* 경향 안내예요. 정확한 풀이는 원국 전체로 봐야 합니다.')}</Text>
          </ScrollView>
          <PressableScale style={styles.sheetClose} onPress={() => setStrengthOpen(false)}>
            <Text style={styles.sheetCloseText}>{t('common.close')}</Text>
          </PressableScale>
        </Pressable>
      </Pressable>
    </Modal>

    {/* 조후·음양·오행·십성 쏠림 → 문제점·대응법(daniel 2026-06-24) */}
    <Modal statusBarTranslucent visible={johuOpen} transparent animationType="slide" onRequestClose={() => setJohuOpen(false)}>
      <Pressable style={styles.sheetOverlay} onPress={() => setJohuOpen(false)}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetKind}>{T('조후')} · {t('ms.eumYangSkew', '음양 쏠림')}</Text>
          <ScrollView style={{ flexShrink: 1 }} showsVerticalScrollIndicator={true}>
            {(() => {
              // ★조후는 **정본**(`engine/johu2`)을 쓴다 — 위 주석 참고(2026-09-01 두 벌이던 것을 하나로)
              const ey = eumYangSkew(P, input?.sex); const jl = johuLabel(johu2(c.saju));
              const elc: Record<string, number> = {};
              for (const p of (['년', '월', '일', '시'] as const)) { const d = P[p]; if (!d) continue; const se = stemElement(d.stem), be = branchElement(d.branch); elc[se] = (elc[se] || 0) + 1; elc[be] = (elc[be] || 0) + (p === '월' ? 2 : 1); }
              const domEl = Object.entries(elc).sort((a, b) => b[1] - a[1])[0];
              // ★테마A(daniel 2026-07-06): 십성 쏠림 = 정/편·식/상 분리 + 신강약 게이트(재/관 신강=용신·길). 10정밀 detail + verdict 소비.
              const tgSkew = tengodSkew((c.tenGods?.detail ?? {}) as Record<string, number>, c.strength?.verdict ?? '중화');
              const block = (label: string, sub: string, concept: string, item: SkewItem | null, favorable = false) => (
                <View style={styles.strDetailCard} key={label}>
                  <Text style={styles.strDetailTitle}>{label} · {sub}</Text>
                  {concept ? emph(concept, styles.strDetailBody) : null}
                  {item ? (<><Text style={styles.strDetailLabel}>{favorable ? t('ms.strongLead', '이렇게 강하면') : t('ms.skewLead', '이렇게 쏠리면')}</Text><Text style={styles.strDetailBody}>{item.problem}</Text><Text style={styles.strDetailLabel}>{favorable ? t('ms.useIt', '살리는 법') : t('ms.remedy', '대응법(개운)')}</Text><Text style={styles.strDetailBody}>{item.remedy}</Text></>) : <Text style={styles.strDetailBody}>{t('ms.balanced', '치우침이 크지 않아 무난해요.')}</Text>}
                </View>
              );
              return (<>
                {/* ★조후 두 줄 — **정본**(`engine/johu2`) 값으로 그린다(2026-09-01).
                    ★설명표(`JOHU_SKEW`·`JOSEUP_SKEW`)의 키도 **정본 값으로 맞췄다** —
                      옮겨 담는 자리를 아예 없앴다(소비처가 이 화면 하나뿐이라 안전). */}
                {block(t('ms.hannan', '한난(조후)'),
                  `${jl.hanNan === '暖' ? t('ms.warm') : jl.hanNan === '寒' ? t('ms.cold') : t('ms.neutral')}`,
                  CONCEPT_INFO.조후, jl.hanNan !== '중화' ? JOHU_SKEW[jl.hanNan] : null)}
                {block(t('ms.joseup', '조습'),
                  `${jl.joSeup === '濕' ? t('ms.wet') : jl.joSeup === '燥' ? t('ms.dry') : t('ms.neutral')}`,
                  CONCEPT_INFO.조습, jl.joSeup !== '중화' ? JOSEUP_SKEW[jl.joSeup] : null)}
                {block(T('음양'), `${ey.skew.replace('양', '+').replace('음', '-')} (+ ${ey.yang}·- ${ey.yin})`, CONCEPT_INFO.음양, ey.skew !== '균형' ? YINYANG_SKEW[ey.skew] : null)}
                {domEl && domEl[1] >= 4 ? block(t('ms.elemSkew', '오행 쏠림'), t('ms.strongEl', '{{el}} 강함', { el: domEl[0] }), '', ELEMENT_SKEW[domEl[0]]) : null}
                {tgSkew ? block(t('ms.tgSkew', '기운(십성) 쏠림'), t('ms.strongEl', '{{el}} 강함', { el: tgSkew.god }), '', tgSkew.item, tgSkew.favorable) : null}
              </>);
            })()}
            <Text style={styles.sheetMeaning}>{t('ms.noteSkew', '* 쏠림 경향 안내예요(대응법=개운법). 정확한 풀이는 원국 전체로 봐야 합니다.')}</Text>
                {/* ★이어서 보면 좋은 콘텐츠(daniel 2026-07-27 "전부 붙여") — 큐레이션 출처 RELATED 단일. */}
      <RelatedContent kind="charts" />
</ScrollView>
          <PressableScale style={styles.sheetClose} onPress={() => setJohuOpen(false)}>
            <Text style={styles.sheetCloseText}>{t('common.close')}</Text>
          </PressableScale>
        </Pressable>
      </Pressable>
    </Modal>
    </>
  );
}

// 글자 크기(fs) 적용 — 테마 font 스프레드(고정 fontSize)도 fs로 덮어 명식 포함 모든 글자가 스케일.
const scaledFont = (fs: (n: number) => number) => ({
  title: { ...font.title, fontSize: fs(22) },
  heading: { ...font.heading, fontSize: fs(17) },
  body: { ...font.body, fontSize: fs(15) },
  label: { ...font.label, fontSize: fs(13) },
  caption: { ...font.caption, fontSize: fs(12) },
});
// makeStyles(fs): 아래 fontSize/lineHeight 리터럴은 sed로 fs()로 감쌈, ...font.X 는 ...f.X(scaledFont) 로 치환됨.
const makeStyles = (fs: (n: number) => number) => { const f = scaledFont(fs); return StyleSheet.create({
  screen: { backgroundColor: 'transparent' }, // 전역 배경 투과(ContentBackdrop)
  // ★하단 여백은 인라인에서 safe-area + 탭바만큼 준다(daniel 2026-07-29 "여전히 글자 짤려").
  //   고정 40pt 로는 **탭바(≈49) + 홈 인디케이터(≈34)** 를 못 덮어 표 마지막 행이 잘렸다.
  wrap: { padding: space(5) },
  tabBar: { flexDirection: 'row', backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.line },
  tabBtn: { flex: 1, paddingVertical: space(3.5), alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabBtnOn: { borderBottomColor: colors.ju },
  tabLabel: { ...f.body, color: colors.inkFaint, fontWeight: '700' },
  tabLabelOn: { color: colors.ju },
  // 관계 하위탭(합충·신살·운세) + 카테고리 ? 설명 버튼(daniel: 카테고리 분류 + 설명)
  subTabBar: { flexDirection: 'row', backgroundColor: colors.sunk, borderBottomWidth: 1, borderBottomColor: colors.line },
  subTabBtn: { flex: 1, paddingVertical: space(2.5), alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  subTabBtnOn: { borderBottomColor: colors.ju },
  subTabLabel: { color: colors.inkFaint, fontWeight: '700', fontSize: 13 },
  subTabLabelOn: { color: colors.ju },
  // ★좌상단으로(daniel 2026-07-25 '더 왼쪽 위로') — wrap padding(space5) 위에 얹던 추가 들여쓰기(marginHorizontal space4)·상단여백 제거.
  catDescBtn: { alignSelf: 'flex-start', marginHorizontal: 0, marginTop: -space(1), marginBottom: space(2), paddingVertical: space(1.5), paddingHorizontal: space(3), borderRadius: 999, backgroundColor: colors.sunk },
  catDescBtnTx: { color: colors.ju, fontWeight: '600', fontSize: 12 },
  // 핵심 격(살인상생 등) 카드 — daniel
  gyeokWrap: { marginTop: space(3), marginBottom: space(1) },
  gyeokHead: { ...f.label, color: colors.ju, fontWeight: '800', marginBottom: space(2) },
  gyeokCard: { backgroundColor: colors.sunk, borderRadius: radius.md, borderLeftWidth: 3, borderLeftColor: colors.ju, paddingVertical: space(2.5), paddingHorizontal: space(3), marginBottom: space(2) },
  gyeokName: { ...f.body, color: colors.ink, fontWeight: '800' },
  gyeokHanja: { color: colors.inkFaint, fontWeight: '600', fontSize: 13 },
  gyeokDesc: { color: colors.inkSoft, marginTop: space(1) },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'transparent' }, // 전역 배경 투과(ContentBackdrop)
  h: { ...f.heading, marginTop: space(5), marginBottom: 2 },
  // 제목 아래 메타 — 작고 흐리게(제목을 밀어내지 않는다)
  hMeta: { ...f.caption, color: colors.inkFaint, marginBottom: space(2) },
  hint: { ...f.caption, marginBottom: space(2) },
  // ★렌즈 켠 상태 고지 — 눈에 띄되 명식을 가리지 않게. `lineHeight` 는 `fontSize` 와 짝(전역 규칙).
  swapNote: { ...f.caption, color: colors.ju, marginBottom: space(2), lineHeight: fs(17) },
  ssRow: { flexDirection: 'row', alignItems: 'center', gap: space(2), paddingVertical: space(1.5), borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  ssName: { ...f.body, width: 76, color: colors.ink },
  ssBranches: { flexDirection: 'row', gap: space(1) },
  ssBranch: { fontSize: fs(16), fontWeight: '800', minWidth: 22, textAlign: 'center' },
  ssHit: { ...f.caption, color: colors.ju, fontWeight: '700' },
  ssDim: { ...f.caption, color: colors.inkFaint },
  // 자리별 신살 표 (천간/지지 × 시·일·월·년)
  ssTable: { marginTop: space(2), borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, overflow: 'hidden' },
  ssTableRow: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  ssRowLabel: { width: 36, alignSelf: 'center', textAlign: 'center', ...f.caption, color: colors.inkSoft, fontWeight: '700' },
  ssColHead: { flex: 1, textAlign: 'center', paddingVertical: space(1.5), ...f.caption, color: colors.inkFaint, fontWeight: '700' },
  ssCell: { flex: 1, alignItems: 'center', paddingVertical: space(1.5), paddingHorizontal: 2, gap: 2, borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.line },
  // 12신살 태그 — 이름 + **어느 기준지에서 나왔는지**(년·월·일·시). 겹치지 않게 형제로 배치
  twelveTag: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  twelveBase: { fontSize: 9, color: colors.inkFaint, lineHeight: 12 },
  // 12신살 원국 요약 행(명식 탭) — daniel: 원국에도 12신살 표시
  twelveRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: space(3), backgroundColor: colors.card, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line, paddingVertical: space(2) },
  twelveRowLabel: { width: 44, alignSelf: 'center', textAlign: 'center', ...f.caption, color: colors.inkSoft, fontWeight: '700' },
  twelveCell: { flex: 1, alignItems: 'center', gap: 2 },
  twelveCellTx: { ...f.caption, color: colors.ju, fontWeight: '600' },
  twelveDim: { ...f.caption, color: colors.inkFaint },
  ssCellGz: { fontSize: fs(20), fontWeight: '800' },
  ssTag: { fontSize: fs(10), color: colors.ju, fontWeight: '600', textAlign: 'center' },
  ssGmRow: { flexDirection: 'row', alignItems: 'center', gap: space(2), marginTop: space(2.5) },
  ssLuckLine: { ...f.caption, color: colors.inkFaint, marginTop: space(2), lineHeight: fs(18) },
  // 신살·공망 전용 상세 화면 진입 버튼(골드 아웃라인)
  spanNote: { ...font.caption, color: colors.inkFaint, marginTop: space(2), marginBottom: space(1), lineHeight: 18 },
  sinsalDetailBtn: { alignSelf: 'flex-start', borderWidth: 1, borderColor: colors.ju, borderRadius: radius.pill, paddingHorizontal: space(3.5), paddingVertical: space(1.75), marginTop: space(1), marginBottom: space(3) },
  sinsalDetailTx: { color: colors.ju, fontSize: fs(13), fontWeight: '700' },
  // 신살·공망 상세 (길신/흉살/기타/공망)
  ssCatBlock: { marginTop: space(3) },
  ssCatHead: { ...f.caption, color: colors.ju, fontWeight: '800', marginBottom: space(1) },
  ssDRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: space(1.5), borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line, gap: space(1.5) },
  ssDName: { ...f.body, color: colors.ink, width: 96, fontWeight: '700' },
  ssDHanja: { fontSize: fs(11), color: colors.inkFaint, fontWeight: '400' },
  ssDGlyph: { fontSize: fs(14), fontWeight: '800', color: colors.inkSoft, width: 52 },
  ssDHit: { ...f.caption, color: colors.ju, fontWeight: '700', width: 58 },
  ssDDim: { ...f.caption, color: colors.inkFaint, width: 58 },
  ssDKw: { ...f.caption, color: colors.inkSoft, flex: 1 },
  ssSubHead: { ...f.caption, color: colors.inkSoft, fontWeight: '700', marginTop: space(3), marginBottom: space(1) },
  ss12Tag: { fontSize: fs(11), color: colors.ink, fontWeight: '700', textAlign: 'center', textDecorationLine: 'none', textDecorationStyle: 'dotted' },
  ss12Base: { fontSize: fs(8), color: colors.inkFaint, fontWeight: '400' },
  rootBadgeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2, flexWrap: 'wrap', justifyContent: 'center' },
  rootStem: { fontSize: fs(10), fontWeight: '800' },
  rootSuffix: { fontSize: fs(9), color: colors.inkFaint, marginLeft: 1 },
  // 시간층 토글(년운·월운·일운)
  // 시점 고르기(Boss 2026-08-27) — 아래에서 올라오는 시트
  spanPickBtn: { borderStyle: 'dashed' },
  spanSheetWrap: {
    ...StyleSheet.absoluteFillObject, zIndex: 90,
    backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end',
  },
  spanSheet: {
    backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 28, gap: 8,
  },
  spanSheetH: { ...font.caption, color: colors.inkFaint, marginTop: 4 },
  spanRow: { gap: 8, paddingVertical: 4 },
  spanItem: {
    minWidth: 58, alignItems: 'center', paddingVertical: 8, paddingHorizontal: 10,
    borderRadius: 12, backgroundColor: colors.sunk, borderWidth: 1, borderColor: colors.line,
  },
  spanItemOn: { backgroundColor: colors.ju, borderColor: colors.ju },
  spanItemTx: { ...font.caption, color: colors.inkSoft, fontWeight: '700' },
  spanItemGz: { ...font.caption, fontSize: 12, color: colors.ink, fontWeight: '800' },
  spanItemTxOn: { color: colors.onJu },
  spanDone: { alignSelf: 'center', marginTop: 8, paddingHorizontal: 20, paddingVertical: 10 },
  spanDoneTx: { ...font.body, color: colors.ju, fontWeight: '800' },
  layerToggle: { flexDirection: 'row', gap: space(2), marginTop: space(2), marginBottom: space(1) },
  layerChip: { paddingHorizontal: space(3), paddingVertical: space(1.5), borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  layerChipOn: { backgroundColor: colors.juSoft, borderColor: colors.ju },
  layerChipTx: { fontSize: fs(12), fontWeight: '700', color: colors.inkFaint },
  layerChipTxOn: { color: colors.ju },
  luckScroll: { marginTop: space(2) },
  // ⚠️★`flexGrow: 1` 은 **호출부에서** 준다 — 세 띠(대운·세운·월운)가 같은 이 스타일을 쓰는데,
  //   그중 하나만 다르게 하고 싶어질 때 여기 박아 두면 갈라진다.
  //   Boss 2026-08-27: *"대운 세운 월운 양끝에 맞춰서 사이즈 키워 공간이 안남게"* —
  //   칸은 `flex: 1` 로 남는 폭을 나눠 갖고, `minWidth` 가 있어 좁은 화면에서는 그대로 스크롤된다.
  luckScrollC: { gap: space(1.5), flexDirection: 'row-reverse', paddingHorizontal: space(2) },
  // ★minWidth 는 렌더에서 ls() 로 덮는다(daniel 2026-07-30 "대운세운월운도 옆으로 커져야").
  //   가로 스크롤 안이라 넓어져도 잘리지 않는다 — 고정 58 이면 큰 글자에서 칸이 빠듯해진다.
  luckCard: { alignItems: 'center', paddingVertical: space(2), paddingHorizontal: space(2.5), borderRadius: radius.sm, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  luckCardCur: { borderColor: colors.ju },
  luckCardSel: { backgroundColor: colors.juSoft, borderColor: colors.ju, borderWidth: 1.5 },
  luckAge: { fontSize: fs(9), color: colors.inkFaint },
  luckGz: { flexDirection: 'row', gap: 1, marginVertical: 2 },
  luckStem: { fontSize: fs(17), fontWeight: '800' },
  luckTg: { fontSize: fs(9), color: colors.inkSoft },
  luckStage: { fontSize: fs(9), color: colors.inkFaint, fontWeight: '600' },   // 12운성
  // ★지금 보는 층 — 제목에서 이 낱말만 굵다(대운·세운·월운이 한 화면에 있어 헷갈렸다)
  luckSubOn: { fontWeight: '900', color: colors.ju },
  luckSub: { ...f.caption, color: colors.ju, marginTop: space(3), marginBottom: space(1) },
  // 자미두수 운흐름(대한) 행 — 나이 | 궁 지지 | 비성사화
  ziDecRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: space(2), borderBottomWidth: 1, borderBottomColor: colors.line, gap: space(2) },
  ziDecAge: { ...f.caption, color: colors.inkSoft, width: 74 },
  ziDecBr: { ...f.body, color: colors.ink, fontWeight: '700', width: 24 },
  ziDecSihwa: { flex: 1, flexDirection: 'row', flexWrap: 'wrap' },
  ziDecTx: { ...f.caption },
  seunCard: { alignItems: 'center', paddingVertical: space(1.5), paddingHorizontal: space(2), borderRadius: radius.sm, backgroundColor: colors.sunk, minWidth: 52, flex: 1},
  todayBtn: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: space(1.5), paddingHorizontal: space(4), borderRadius: radius.sm, borderWidth: 1, borderColor: colors.ju, backgroundColor: colors.sunk, marginTop: space(2), marginBottom: space(1) }, // 현재운세 보기(daniel 07-08)
  todayBtnTx: { ...f.caption, color: colors.ju, fontWeight: '700' },
  seunCur: { borderWidth: 1.5, borderColor: colors.ju },
  seunYear: { fontSize: fs(9), color: colors.inkFaint },
  seunAge: { fontSize: fs(8), color: colors.inkSoft, fontWeight: '600' },   // ★세운 만 나이(daniel 2026-07-12) — 연도 아래

  seunGz: { fontSize: fs(14), fontWeight: '700' },
  seunTg: { fontSize: fs(8), color: colors.inkSoft },
  seunStage: { fontSize: fs(8), color: colors.inkFaint, fontWeight: '600' },   // 12운성
  // gzCellSm/gzTextSm/gzCellXs/gzTextXs/gzKo — GzCell 전용 스타일은 components/GzCell.tsx로 이전(단일 출처, 2026-07-16)
  expCol: { alignItems: 'center', paddingHorizontal: space(0.75), paddingVertical: space(0.5) },
  expCol2: { width: 50, alignItems: 'center', paddingVertical: space(0.5) },   // 고정폭(합충 호 좌표용)
  expColLuck: { backgroundColor: colors.juSoft, borderRadius: radius.sm },
  expLabel: { fontSize: fs(11), color: colors.inkFaint, marginBottom: 2, fontWeight: '600' },
  expAge: { fontSize: fs(9), color: colors.ju, marginBottom: 2, fontWeight: '700' },  // 대운수(입운 나이) — 대운 컬럼 강조
  expTg: { fontSize: fs(11), color: colors.inkSoft, marginBottom: 2, fontWeight: '600' },
  expStage: { fontSize: fs(10), color: colors.inkFaint, fontWeight: '600', marginTop: 1 },   // 12운성
  expHidden: { alignItems: 'center', marginTop: 4 },
  expHiddenTx: { fontSize: fs(12), fontWeight: '700', lineHeight: fs(15) },
  // 지장간 강약 칩 — 본기·통근(투출)=진하게(강) / 중기·여기 미투출=흐리게(잠재). daniel: 지장간 강약 표시
  hiddenHint: { ...f.caption, color: colors.inkFaint, marginTop: space(1), marginBottom: space(1), lineHeight: fs(16) },
  hiddenDetailRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: space(2.5), gap: space(2) },
  hiddenRowLabel: { ...f.caption, color: colors.inkSoft, fontWeight: '700', width: 52 },
  hiddenChips: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2), flex: 1 },
  hiddenChip: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: space(2), paddingVertical: space(1), borderRadius: radius.sm, borderWidth: 1 },
  hiddenChipStrong: { backgroundColor: colors.card, borderColor: colors.juLine },
  hiddenChipWeak: { backgroundColor: 'transparent', borderColor: colors.line, borderStyle: 'dashed' },
  hiddenChipChar: { fontSize: fs(15), fontWeight: '800' },
  hiddenChipTg: { fontSize: fs(12), color: colors.ink, fontWeight: '600' },
  hiddenChipRole: { fontSize: fs(9), color: colors.inkFaint, fontWeight: '700' },
  hiddenDim: { opacity: 0.45 },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: space(2) },
  calHead: { width: '14.28%', textAlign: 'center', fontSize: fs(10), color: colors.inkFaint, paddingVertical: 3 },
  calCell: { width: '14.28%', alignItems: 'center', paddingVertical: space(1) },
  calDay: { fontSize: fs(10), color: colors.inkSoft },
  calCellToday: { backgroundColor: colors.juSoft, borderRadius: radius.sm },
  calCellSel: { borderWidth: 1.5, borderColor: colors.ju, borderRadius: radius.sm }, // 선택된 일운(달력 탭)
  calDayToday: { color: colors.ju, fontWeight: '800' },
  calGz: { fontSize: fs(13), fontWeight: '700', marginTop: 1 },
  row: { flexDirection: 'row', gap: space(2) },
  pillarContainer: { flexDirection: 'row', gap: space(2), marginTop: space(2), marginBottom: space(4) },
  pillarWrapper: { flex: 1 },
  pillarGlass: { paddingVertical: space(3), paddingHorizontal: 0, alignItems: 'center' },
  pillarDayGlass: { borderColor: colors.ju, borderWidth: 1.5 },
  pillarPos: { ...f.caption, fontWeight: '700', color: colors.inkFaint, marginBottom: space(1.5) },
  pillarPosDay: { color: colors.ju },
  pillarMain: { alignItems: 'center', width: '100%', paddingVertical: space(0.5) },
  pillarChar: { fontSize: fs(31), fontWeight: '800', lineHeight: fs(38) },  // ★크기↑(daniel 07-24) 26→31
  pillarTenGod: { fontSize: fs(12), fontWeight: '600' },                    // 10→12
  pillarReading: { fontSize: fs(11), fontWeight: '400' },                   // 9→11
  pillarIcon: { marginVertical: space(2) },
  advancedInfo: { width: '100%', alignItems: 'center' },
  pillarStage: { fontSize: fs(12), color: colors.inkSoft, fontWeight: '600', marginTop: space(1) },  // 10→12(크기↑)
  pillarHidden: { flexDirection: 'row', gap: 2, marginTop: space(1), width: '100%', paddingHorizontal: space(1) }, // 폭 100% 라야 flex 3등분이 성립
  pillarHiddenChar: { fontSize: fs(13), fontWeight: '700' },  // 11→13(크기↑)
  pillarHiddenItem: { flex: 1, alignItems: 'center', justifyContent: 'center' }, // 지장간 1자 칸 — flex 로 기둥 폭 3등분(가로 최대)
  pillarHiddenRooted: { borderWidth: 1, borderColor: colors.ju, borderRadius: 8 }, // 투출(통근) = 동그라미
  headerArea: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space(4) },
  advancedBtn: { paddingHorizontal: space(2), paddingVertical: space(1), borderRadius: radius.sm, backgroundColor: colors.sunk },
  advancedBtnTx: { ...f.caption, color: colors.ju, fontWeight: '700' },
  linksToggleNew: { marginTop: space(4), borderRadius: radius.md, overflow: 'hidden', ...shadow.card },
  linksToggleGradient: { paddingVertical: space(3), alignItems: 'center' },
  linksToggleTx: { ...f.body, color: colors.ju, fontWeight: '700' },
  pillarDivider: { width: '70%', height: 1, backgroundColor: colors.line, marginVertical: space(1.5) },
  ptable: { display: 'none' }, // 기존 테이블 숨김
  kv: { ...f.body, color: colors.ink, marginTop: space(1.5), lineHeight: fs(21) },
  kvLabel: { color: colors.inkSoft, fontWeight: '700' },
  kvAccent: { color: colors.ju, fontWeight: '700' },
  warn: { ...f.caption, color: colors.ju, marginTop: space(2) },
  gaugeRow: { flexDirection: 'row', alignItems: 'center', gap: space(3), marginTop: space(1) },
  gaugeTrack: { flex: 1, height: 10, borderRadius: 5, backgroundColor: colors.sunk, overflow: 'hidden', justifyContent: 'center' },
  gaugeMid: { position: 'absolute', left: '50%', width: 1, height: 10, backgroundColor: colors.inkFaint }, // 중화(중앙) 기준선
  gaugeFill: { height: '100%', backgroundColor: colors.ju, borderRadius: 5 },
  gaugeText: { ...f.caption, color: colors.ink },
  strengthRow: { flexDirection: 'row', alignItems: 'center', gap: space(4), marginTop: space(2) },
  strengthInfo: { flex: 1, gap: space(1.5) },
  strDetailBtn: { marginTop: space(3), alignSelf: 'flex-start', paddingVertical: space(1) },
  strDetailBtnTx: { ...f.caption, color: colors.ju, fontWeight: '800' },
  strDetailCard: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: space(4), marginBottom: space(3) },
  strDetailMine: { borderColor: colors.ju, borderWidth: 1.5 },
  strDetailTitle: { ...f.body, color: colors.ink, fontWeight: '800', marginBottom: space(2) },
  strDetailLabel: { ...f.caption, color: colors.ju, fontWeight: '800', marginTop: space(2) },
  strDetailBody: { ...f.body, color: colors.inkSoft, lineHeight: fs(22), marginTop: space(0.5) },
  elemLegend: { flex: 1, gap: space(1) },
  elemLegendRow: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  elemDot: { width: 10, height: 10, borderRadius: 5 },
  elemLegendEl: { fontSize: fs(15), fontWeight: '800' }, // 오행+십성 한 줄(daniel) — 고정폭 제거(width 20이 '(식상)'을 줄바꿈시켰음)
  elemLegendVal: { ...f.caption, color: colors.inkSoft, marginLeft: 'auto' }, // 개수·% 는 우측 정렬(열 정돈)
  // 발달/과다/부재 배지 — 개수 통설(4+/3/0). 색은 발달·과다=골드, 부재=흐림.
  elemDevBadge: { fontSize: 10.5, lineHeight: 14, fontWeight: '800', color: colors.ju, borderWidth: 1, borderColor: colors.ju + '66', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1, marginLeft: 6, overflow: 'hidden' },
  note: { ...f.caption, marginTop: space(6) },
  readingBtn: {
    backgroundColor: colors.ju, borderRadius: radius.md, paddingVertical: space(3.5),
    alignItems: 'center', marginTop: space(5), ...shadow.card,
  },
  readingBtnText: { color: colors.bg, fontSize: fs(15), fontWeight: '700' },
  // 클릭 설명 — 탭 가능 힌트(점선 밑줄) + 바텀시트
  tgSmallLink: { fontSize: fs(10), color: colors.inkSoft, marginVertical: space(0.5), textDecorationLine: 'none', textDecorationStyle: 'dotted' },
  ssTagLink: { fontSize: fs(10), color: colors.ju, fontWeight: '600', textAlign: 'center', textDecorationLine: 'none', textDecorationStyle: 'dotted' },
  linkText: { textDecorationLine: 'none', textDecorationStyle: 'dotted' },
  // 팔자 카드 — 12운성·지장간·12신살 (각 탭 가능, 점선밑줄 힌트)
  stageLink: { fontSize: fs(10), color: colors.inkSoft, fontWeight: '600', textDecorationLine: 'none', textDecorationStyle: 'dotted', marginTop: space(0.5) },
  hiddenRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 3, marginTop: space(0.5) },
  hiddenG: { fontSize: fs(11), fontWeight: '700', textDecorationLine: 'none', textDecorationStyle: 'dotted' },
  pillarSinsal: { alignItems: 'center', marginTop: space(1) },
  pillarSsTx: { fontSize: fs(9), color: colors.ju, fontWeight: '600', lineHeight: fs(13), textAlign: 'center', textDecorationLine: 'none', textDecorationStyle: 'dotted' },
  pillarSsBase: { fontSize: fs(7), color: colors.inkFaint, fontWeight: '400', textDecorationLine: 'none' },
  // 팔자 표 (행 라벨 + 칸 구분선 + 일주 강조)
  ptRow: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line, alignItems: 'stretch' },
  ptRowLast: { borderBottomWidth: 0 },
  ptLabel: { width: 34, ...f.caption, color: colors.inkSoft, fontWeight: '700', textAlign: 'center', alignSelf: 'center', paddingVertical: space(1) },
  ptCell: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: space(1.5), borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.line },
  ptCellDay: { backgroundColor: colors.juSoft },
  ptHead: { ...f.caption, color: colors.inkFaint, fontWeight: '700' },
  ptHeadDay: { color: colors.ju },
  ptTgLink: { fontSize: fs(11), color: colors.inkSoft, fontWeight: '600', textAlign: 'center', textDecorationLine: 'none', textDecorationStyle: 'dotted' },
  // ⚠️ptGz 제거(daniel 2026-07-29) — 사용처 0(죽은 스타일). 되살릴 거면 치수는 ls() 로.
  ptGzTx: { fontSize: fs(22), fontWeight: '800', lineHeight: fs(24) },
  ptGzKo: { fontSize: fs(9), fontWeight: '700', lineHeight: fs(10), opacity: 0.85 },
  ptHidWrap: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 2 },
  ptHid: { fontSize: fs(12), fontWeight: '700', textDecorationLine: 'none', textDecorationStyle: 'dotted' },
  // ⚠️ptHidRooted 제거(daniel 2026-07-29) — **어디서도 쓰이지 않는 죽은 스타일**이었다(grep 0건).
  //   게다가 치수를 fs() 로 계산해 배율을 못 받는 형태였다(fs 는 2026-07-29 부터 항등 —
  //   글자는 전역 패치로 커지는데 상자는 그대로여서 넘친다). 살릴 거면 ls() 로 다시 쓴다.
  ptStageLink: { fontSize: fs(11), color: colors.inkSoft, fontWeight: '600', textAlign: 'center', textDecorationLine: 'none', textDecorationStyle: 'dotted' },
  ptSsLink: { fontSize: fs(9), color: colors.ju, fontWeight: '600', lineHeight: fs(13), textAlign: 'center', textDecorationLine: 'none', textDecorationStyle: 'dotted' },
  ptSsBase: { fontSize: fs(7), color: colors.inkFaint, fontWeight: '400', textDecorationLine: 'none' },
  ptRoot: { fontSize: fs(11), fontWeight: '800' },
  // 자미두수 명반 (12궁 4×4)
  ziGrid: { marginTop: space(2), borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm },
  ziRow: { flexDirection: 'row' },
  ziCell: { flex: 1, minHeight: 76, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, padding: 3 },
  ziCenterCell: { flex: 1, minHeight: 76, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.sunk },
  ziCenterT: { fontSize: fs(9), color: colors.inkFaint },
  ziCenterV: { fontSize: fs(15), color: colors.ju, fontWeight: '800' },
  ziTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  ziName: { fontSize: fs(8), color: colors.inkFaint, fontWeight: '600' },
  ziBr: { fontSize: fs(13), fontWeight: '800' },
  ziMajor: { fontSize: fs(11), color: colors.ink, fontWeight: '700', marginTop: 1, lineHeight: fs(14) },
  ziBright: { fontSize: fs(8), color: colors.inkFaint, fontWeight: '400' },
  ziSihwa: { fontSize: fs(9), fontWeight: '800' },
  ziMinor: { fontSize: fs(8), color: colors.inkSoft, marginTop: 1, lineHeight: fs(12) },
  ziLink: { textDecorationLine: 'none', textDecorationStyle: 'dotted' }, // 탭 힌트
  // 합충형해 토글 카드 (기본 숨김 → 선 + 글자작용)
  linksToggle: { marginTop: space(2), paddingVertical: space(2.5), paddingHorizontal: space(3), borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, alignItems: 'center' },
  linksCard: { marginTop: space(1.5), padding: space(3), borderRadius: radius.sm, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  linkMini: { alignSelf: 'center', marginBottom: space(2) },
  linkMiniRow: { flexDirection: 'row' },
  linkMiniCol: { width: 56, alignItems: 'center' },
  linkList: { gap: space(1.5), borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, paddingTop: space(2.5) },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  linkDot: { fontSize: fs(10) },
  linkRowTx: { ...f.body, color: colors.ink, flex: 1 },
  linkLevel: { fontSize: fs(10), color: colors.inkFaint },
  // 종류별 그룹(팔자) + 강도순(대운세운)
  linkGroup: { marginBottom: space(2) },
  linkGroupHead: { ...f.caption, fontWeight: '800', marginBottom: space(1) },
  linkGRow: { paddingVertical: space(1), paddingLeft: space(2) },
  linkGTx: { ...f.body, color: colors.ink },
  strHint: { ...f.caption, color: colors.inkFaint, marginBottom: space(2) },
  strRow: { flexDirection: 'row', alignItems: 'center', gap: space(2), paddingVertical: space(1.5), paddingHorizontal: space(2), borderRadius: radius.sm },
  strRowTop: { backgroundColor: colors.sunk },
  strBadge: { fontSize: fs(11), fontWeight: '800', width: 22, height: 20, lineHeight: fs(18), textAlign: 'center', borderWidth: 1, borderRadius: 4 },
  linkGRowOn: { backgroundColor: colors.juSoft, borderRadius: radius.sm },          // 켜진 합충 행
  ptCellHL: { backgroundColor: 'rgba(201,161,74,0.30)' },                            // 명식 강조 셀
  expCol2On: { backgroundColor: 'rgba(201,161,74,0.30)', borderRadius: radius.sm },  // 확장명식 강조 컬럼
  // 대표 오행·십성 칩
  repRow: { flexDirection: 'row', gap: space(2), marginTop: space(3) },
  repChip: { flex: 1, paddingVertical: space(2.5), paddingHorizontal: space(2), borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, alignItems: 'center' },
  repLabel: { ...f.caption, color: colors.inkFaint },
  repVal: { fontSize: fs(18), fontWeight: '800', marginTop: 2, textDecorationLine: 'none', textDecorationStyle: 'dotted' },
  repValTg: { fontSize: fs(15), fontWeight: '800', color: colors.ju, marginTop: 2, textDecorationLine: 'none', textDecorationStyle: 'dotted' },
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  // 시트 90% 상한 + 내부 ScrollView 적응 → 화면 넘어 닫기버튼·하단 짤리던 것 방지(daniel)
  sheet: { backgroundColor: colors.card, borderTopLeftRadius: radius.md, borderTopRightRadius: radius.md, padding: space(5), paddingBottom: space(9), maxHeight: '90%' },
  sheetHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.line, marginBottom: space(3) },
  sheetKind: { ...f.caption, color: colors.ju, fontWeight: '700', marginBottom: space(1) },
  sheetTitle: { ...f.heading, color: colors.ink, marginBottom: space(2.5) },
  sheetMeaning: { ...f.body, color: colors.ink, lineHeight: fs(24) },
  sheetChips: { flexDirection: 'row', flexWrap: 'wrap', gap: space(1.5), marginTop: space(3.5) },
  sheetChip: { ...f.caption, color: colors.ink, backgroundColor: colors.sunk, paddingHorizontal: space(2.5), paddingVertical: space(1), borderRadius: radius.pill, overflow: 'hidden' },
  sheetClose: { marginTop: space(4), alignItems: 'center', paddingVertical: space(2.5), borderRadius: radius.sm, backgroundColor: colors.sunk },
  sheetCloseText: { ...f.body, color: colors.inkSoft, fontWeight: '700' },
}); };
