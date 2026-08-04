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
import { View, Text, ScrollView, StyleSheet, Pressable, Modal, Animated, LayoutAnimation, Platform, UIManager } from 'react-native';
import { PressableScale } from '../components/PressableScale';
import { RelatedContent } from '../components/RelatedContent';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { computeChart } from '../lib/engine/engine';
import { YongsinCard } from '../components/YongsinCard'; // 만세력 용신(canonical 엔진·억부/병약/조후+희신/기신·Boss 07-22)
import type { ChartInput, PillarPos } from '@spec/chart';
import { useSafeAreaInsets } from 'react-native-safe-area-context';   // ★하단 탭바·홈 인디케이터 여백(daniel 07-29 잘림)
import { colors, radius, space, shadow, font } from '../lib/theme';
import { GlassCard } from '../components/GlassCard';
import { OhaengEnergy } from '../components/OhaengEnergy'; // 오행 에너지 구슬 인포그래픽(팔자 앞·이탈률↓·daniel 기획서①)
import { GzCell } from '../components/GzCell'; // 간지 한 칸(오행색+한자+한글음) — 2026-07-16 추출(커뮤니티 SharedChart와 공유하는 단일 출처)
import { stemElement, branchElement, elementColor, stemReading, branchReading, stemYinYang, branchYinYang, eumYangSkew, johuSkew, joSeupSkew } from '../lib/engine/ohaeng';
import { ELEMENT_SKEW, tengodSkew, YINYANG_SKEW, JOHU_SKEW, JOSEUP_SKEW, CONCEPT_INFO, type SkewItem } from '../lib/content/skewKnowledge';
import { useFontScale } from '../lib/ui/fontScale'; // 글자 크기(설정) — 명식 글자까지 모든 텍스트에 적용(daniel)
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
import { HIDDEN, computeMonthDays, branchTenGod, daeunForward } from '@engine/saju'; // 지장간 표 + 일운(流日) + 지지십신 + 대운 순역
import { twelveStage } from '@engine/twelve';                          // 임의 지지 12운성(타임라인용)
import { detectInteractionsAmong, interactionLabel } from '@engine/structure';   // 합충 검출 + 짝이름 라벨(daniel: 유축반합·정신극)
import { detectGyeokguk } from '../lib/engine/gyeokguk';                                 // 핵심 격(살인상생·식신제살 등) 검출 — daniel
import { lookupGlossary, GLOSSARY_KIND_LABEL, SINSAL_GLOSSARY, type GlossaryKind } from '../lib/content/myeongriGlossary'; // 클릭 설명
import { playSound } from '../lib/ui/sounds';
import Svg, { Path, Rect, Circle, Text as SvgText, G } from 'react-native-svg';

// 전통 표기 — 오른쪽이 년주: 시(왼) ← 일 ← 월 ← 년(오른쪽)
const POS: PillarPos[] = ['시', '일', '월', '년'];

// 만세력 카테고리 탭(daniel 07-13 재편) — 사주원국(팔자+지장간+합충+신살길성 통합)/운세(대운·세운·월운·일운)/오행·강약/자미두수.
type MyeongTab = 'wonguk' | 'rel' | 'elem' | 'ziwei';  // rel = 운세 전용(구 '사주관계' → 운세). 합충·신살은 wonguk으로 흡수.
const MYEONG_TABS: { id: MyeongTab; label: string; desc: string }[] = [
  // ★사주원국 + 운세 통합(daniel 2026-07-24) — 원국(팔자·지장간·합충·신살)과 운세(대운·세운·월운·일운)를 한 탭에서. 겹치던 원국 표시 중복 제거.
  { id: 'wonguk', label: '원국·운세', desc: '팔자(연·월·일·시 여덟 글자)와 숨은 기운(지장간), 글자끼리의 합·충·형·해·파 관계·신살·길성, 그리고 대운·세운·월운·일운으로 보는 시기별 흐름(운세)까지 한자리에서 봐요.' },
  { id: 'elem', label: '오행·강약', desc: '내 글자들이 목·화·토·금·수 다섯 기운 중 무엇에 쏠렸는지·그게 나에게 어떤 역할(십성)인지, 그리고 내 힘(일간)이 강한지 약한지·무엇으로 균형을 잡으면 좋은지 함께 봐요.' },
  { id: 'ziwei', label: '자미두수', desc: '사주와는 별개의 운명 체계예요. 태어난 시각으로 열두 자리(명궁·재물·관록·배우자 등)에 여러 별을 배치해, 삶의 각 영역에 어떤 기운이 드는지 봅니다. 사주를 보조해 교차로 참고해요(시각을 알아야 정확).' },
];
let lastMyeongTab: MyeongTab = 'wonguk';   // 선택 탭 기억(세션 내 — 나갔다 와도 분류 유지, daniel)

// 신강/신약 특징(신강약 섹션 탭 → 상세 시트). ★명리 stance = daniel 검수 슬롯. en/ja i18n 은 검수 후.
const STRENGTH_INFO: { key: '신강' | '신약'; title: string; traits: string; strong: string; caution: string; yongsin: string }[] = [
  { key: '신강', title: '신강 (身強)',
    traits: '일간이 뿌리 깊고 비겁·인성이 받쳐주는 사주. 자기 주관이 뚜렷하고 추진력·독립심이 강합니다.',
    strong: '주도적이고 위기에 강하며, 자기 힘으로 밀어붙이는 돌파력과 리더십이 있습니다.',
    caution: '힘이 과하면 독선·고집으로 흐르고 주변과 타협이 어려울 수 있습니다.',
    yongsin: '식상·재성·관성으로 힘을 덜어 균형 잡는 게 관건 — 일·재물·관계·책임에 힘을 쓸 때 성취가 큽니다.' },
  { key: '신약', title: '신약 (身弱)',
    traits: '일간이 약하고 식상·재성·관성에 기운을 내주는 사주. 유연하고 섬세하며 환경에 잘 맞춥니다.',
    strong: '협조·조율에 능하고 적응력이 좋아, 주변의 도움과 흐름을 활용하는 데 강합니다.',
    caution: '힘이 너무 빠지면 의존적이거나 우유부단해지고 자신감이 약해질 수 있습니다.',
    yongsin: '인성·비겁으로 보강하는 게 관건 — 배움·휴식·내 편(동료)을 통해 힘을 채울 때 안정됩니다.' },
];

export function MyeongsikScreen({ input, onReading, onSinsal, header, whoName }: { input: ChartInput | null; onReading?: () => void; onSinsal?: () => void; header?: ReactNode; whoName?: string | null }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<MyeongTab>(lastMyeongTab === 'rel' ? 'wonguk' : lastMyeongTab); // 'rel'(구 운세 탭)은 wonguk 으로 통합(daniel 07-24) — 저장값 방어
  const [catDescOpen, setCatDescOpen] = useState(false); // 카테고리 ? 설명 시트(daniel: 설명도 나오게)
  useEffect(() => { lastMyeongTab = activeTab; }, [activeTab]); // 선택 탭 기억 — 나갔다 와도 유지(daniel)
  const [strengthOpen, setStrengthOpen] = useState(false); // 신강·신약 특징 시트
  const [elemHidden, setElemHidden] = useState(false); // 오행분포에 지장간(支藏干) 오행 포함 토글(daniel)
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

  const c = useMemo(() => (input ? computeChart(input) : null), [input]);
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
  if (!c) return <View style={styles.center}><Text style={font.body}>{t('myeongsik.noChart')}</Text></View>;

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
  // ① 오행별 십성(daniel) — 일간 오행 기준 각 오행의 십성(대분류: 비겁/식상/재성/관성/인성)
  const dayElem = stemElement(P['일'].stem);
  const ELEM_GEN: Record<string, string> = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' }; // 상생
  const ELEM_CTRL: Record<string, string> = { 木: '土', 火: '金', 土: '水', 金: '木', 水: '火' }; // 상극
  const elemTenGod = (el: string): string => {
    if (el === dayElem) return '비겁';
    if (ELEM_GEN[dayElem] === el) return '식상';   // 일간이 생함
    if (ELEM_CTRL[dayElem] === el) return '재성';  // 일간이 극함
    if (ELEM_CTRL[el] === dayElem) return '관성';  // 일간을 극함
    if (ELEM_GEN[el] === dayElem) return '인성';   // 일간을 생함
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
  const [selMonth, setSelMonth] = useState(now.getMonth());           // 선택된 월운(기본=이번 달)
  const [selDay, setSelDay] = useState(now.getDate());                // 선택된 일운(기본=오늘) — 일진 달력 탭으로 변경
  // 운세 확장명식 시간층 — ★**기본 ON**(daniel 2026-08-03 "만세력에 디폴트가 오늘 기준
  //   대운·세운·월운·일운으로 잡혀 있어야지"). 07-24 엔 통합하며 기본 OFF(원국만)로 뒀는데,
  //   만세력을 여는 이유가 대개 '지금 내 운이 어떤가' 라서 매번 네 칩을 눌러야 했다.
  //   선택값은 이미 오늘 기준이다(아래 selLuck/selSeun/selMonth/selDay = 현재 대운·올해·이번 달·오늘)
  //   — 켜져 있지 않았을 뿐이라, 기본을 켜면 **열자마자 오늘 기준 네 층**이 원국 옆에 붙는다.
  //   ⚠️끄고 원국만 보고 싶으면 칩을 눌러 끄면 된다(토글은 그대로).
  const [showLayers, setShowLayers] = useState({ luck: true, year: true, month: true, day: true });
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
  const linkColor = (it: any) =>
    it.type === '합' ? colors.ju
    : (it.type === '충' || it.type === '극') ? '#C0392B' : '#9A8CC0';
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
  const typeColor = (ty: string) => (ty === '합' ? colors.ju : (ty === '충' || ty === '극') ? '#C0392B' : '#9A8CC0');
  const renderGroups = (items: any[], active: Set<string>, onToggle: (k: string) => void) => ['합', '충', '형', '해', '파', '극'].map((ty) => {
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
                {x.isGan ? <Text style={styles.linkLevel}>  천간</Text> : null}
                {x.mem.length === 3 ? <Text style={{ color: col, fontWeight: '800', fontSize: 11 }}>  ★{x.type === '합' ? '삼합/방합' : x.type === '형' ? '삼형' : '3자'}</Text> : null}
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
    const tier = s >= 4 ? '강' : s >= 3 ? '중' : '약';
    const col = typeColor(x.type);
    const on = active.has(x.key);
    return (
      <PressableScale key={i} onPress={() => onToggle(x.key)} style={[styles.strRow, tier === '강' && styles.strRowTop, on && styles.linkGRowOn]}>
        <Text style={[styles.strBadge, { color: col, borderColor: col }]}>{on ? '◉' : tier}</Text>
        <Text style={styles.linkGTx}>
          {x.mem.map((mm: any, k: number) => (
            <Text key={k}>
              {k > 0 ? '  ⟷  ' : ''}{mm.label} <Text style={{ color: elementColor[mm.el], fontWeight: '800' }}>{mm.char}</Text>
            </Text>
          ))}
          {'   '}
          <Text style={{ color: col, fontWeight: '800' }}>{interactionLabel({ type: x.type, detail: x.key, level: x.isGan ? '천간' : '지지' } as any)}</Text>
          {x.isGan ? <Text style={styles.linkLevel}>  천간</Text> : null}
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
              style={StyleSheet.flatten([styles.pillarGlass, isDay && styles.pillarDayGlass])} 
              intensity={isDay ? 60 : 30}
            >
              <Text style={[styles.pillarPos, isDay && styles.pillarPosDay]}>{p}</Text>
              
              {/* 천간 십신 — 개별 클릭 시 십신 설명(daniel: 십성 클릭 복구) */}
              <PressableScale onPress={() => setGlossary({ kind: 'tengod', key: P[p].stemTenGod })}>
                <Text style={[styles.pillarTenGod, { color: colors.inkSoft }]}>{P[p].stemTenGod}</Text>
              </PressableScale>
              <PressableScale style={styles.pillarMain} onPress={() => setGlossary({ kind: 'stem', key: P[p].stem })}>
                <Text style={[styles.pillarChar, { color: elementColor[elStem] }]}>{hangeul ? stemReading(P[p].stem) : P[p].stem}</Text>
                <Text style={[styles.pillarReading, { color: colors.inkFaint }]}>{hangeul ? P[p].stem : stemReading(P[p].stem)} · {stemYinYang(P[p].stem)}</Text>
              </PressableScale>


              <PressableScale style={styles.pillarMain} onPress={() => setGlossary({ kind: 'branch', key: P[p].branch })}>
                <Text style={[styles.pillarChar, { color: elementColor[elBranch] }]}>{hangeul ? branchReading(P[p].branch) : P[p].branch}</Text>
                <Text style={[styles.pillarReading, { color: colors.inkFaint }]}>{hangeul ? P[p].branch : branchReading(P[p].branch)} · {branchYinYang(P[p].branch)}</Text>
              </PressableScale>
              {/* 지지 십신 — 개별 클릭 시 십신 설명 */}
              <PressableScale onPress={() => setGlossary({ kind: 'tengod', key: P[p].branchMainTenGod })}>
                <Text style={[styles.pillarTenGod, { color: colors.inkSoft }]}>{P[p].branchMainTenGod}</Text>
              </PressableScale>

              {/* 12운성 — 항상 표시(daniel: 상세분석 토글 밖). 탭 → 글로서리 설명. */}
              <View style={styles.pillarDivider} />
              <PressableScale onPress={() => setGlossary({ kind: 'stage', key: c.stages[p] })}>
                <Text style={styles.pillarStage}>{c.stages[p]}</Text>
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
          <Text style={[styles.tabLabel, activeTab === t2.id && styles.tabLabelOn]} numberOfLines={1}>{t2.label}</Text>
        </PressableScale>
      ))}
    </View>
    <ScrollView style={styles.screen} contentContainerStyle={[styles.wrap, { paddingBottom: insets.bottom + space(24) }]}>
      {/* 카테고리 ? 설명(daniel: 설명도 나오게) — 탭하면 이 분류가 무엇을 보는지 시트로.
          ★ScrollView 안으로 이동(daniel 2026-07-24 '글자 짤려'): 예전엔 고정 탭바 아래 '투명 영역'에 떠 있어,
          운세 탭 기둥 등을 위로 스크롤하면 그 투명 경계에서 상단 라벨(기둥명·나이·천간십신)이 지저분하게 잘려 보였다.
          콘텐츠와 함께 스크롤되게 옮겨, 기둥은 불투명 테두리 탭바 아래로 깔끔히 스크롤되게 함. */}
      {header}
      <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
        {/* ── 사주원국 1: 팔자 그리드 + 12신살(원국) ── */}
        {activeTab === 'wonguk' && (
        <>
          {/* ★오행 에너지 구슬 인포그래픽(daniel 기획서①) — 팔자(한자) '앞'에 색 에너지로 먼저 시각화(대중 이탈률↓). */}
          <OhaengEnergy saju={c.saju} />
          <View style={styles.headerArea}>
            {/* 누구 명식인지 제목에 표기(daniel 07-05) — 헤더 ChartPicker(변경 가능)와 함께 '누구의 사주 원국'인지 명확히. */}
            <Text style={styles.h}>{whoName ? `${whoName} · ${t('myeongsik.palja')}` : t('myeongsik.palja')}</Text>
            <View style={{ flexDirection: 'row', gap: space(2) }}>
              {/* ★한자↔한글 토글(daniel 07-24) — 사주 모르는 사람도 한글음으로 명식 보기 */}
              <PressableScale style={styles.advancedBtn} onPress={() => setHangeul((v) => !v)}>
                <Text style={styles.advancedBtnTx}>{hangeul ? '漢 한자' : '가 한글'}</Text>
              </PressableScale>
              <PressableScale style={styles.advancedBtn} onPress={toggleAdvanced}>
                <Text style={styles.advancedBtnTx}>{showAdvanced ? '간략히' : '상세 분석'}</Text>
              </PressableScale>
            </View>
          </View>

          {renderArcs(activeGanP, 'above')}
          {renderPillars()}
          {renderArcs(activeJiP, 'below')}

          {/* ★신살·공망(원국) — 12신살 있던 자리로 이동(daniel 2026-07-25). 자리별 적중만: 운에서 오는 신살 제외 · 12신살 요약은 관계분석으로. */}
          <Text style={styles.hint}>신살·공망 (자리별 적중)</Text>
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
            const tag = (name: string, onPress: () => void, key: any) => { const g = (SINSAL_GLOSSARY as any)[name]; return <PressableScale key={key} onPress={onPress}><Text style={styles.ssTagLink}>{g?.ko ?? name}</Text></PressableScale>; };
            const cellTags = (names: string[]) => names.length ? names.map((n, i) => tag(n, () => setGlossary({ kind: 'sinsal', key: n }), i)) : <Text style={styles.ssDim}>—</Text>;
            return (
              <View style={styles.ssTable}>
                <View style={styles.ssTableRow}><Text style={styles.ssRowLabel} />{visiblePos.map((p) => <Text key={p} style={styles.ssColHead}>{p}주</Text>)}</View>
                <View style={styles.ssTableRow}><Text style={styles.ssRowLabel}>천간</Text>{visiblePos.map((p) => <View key={p} style={styles.ssCell}>{cellTags(atSide(p, 'stem'))}</View>)}</View>
                <View style={styles.ssTableRow}><Text style={styles.ssRowLabel}>지지</Text>{visiblePos.map((p) => <View key={p} style={styles.ssCell}>{cellTags(atSide(p, 'branch'))}</View>)}</View>
                <View style={styles.ssTableRow}><Text style={styles.ssRowLabel}>공망</Text>{visiblePos.map((p) => <View key={p} style={styles.ssCell}>{c.sinsal.gongmangHits.includes(p) ? tag('공망', () => setGlossary({ kind: 'gongmang' }), 'gm') : <Text style={styles.ssDim}>—</Text>}</View>)}</View>
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
            <Text style={{ color: colors.ju, fontWeight: '700', fontSize: 12 }}>{activePalja.size ? '전체 해제' : '전체 선택'}</Text>
          </PressableScale>
          {renderGroups(normPalja, activePalja, (k) => toggleKey(setActivePalja, k))}
        </View>
      )}
          {/* 12신살(원국) — 관계분석 안으로 이동(daniel 2026-07-25 N). 상세 분석 전용(이 블록이 showAdvanced 게이트). 합충 유무와 무관하게 항상 표시. */}
          <View style={styles.twelveRow}>
            <Text style={styles.twelveRowLabel}>12신살</Text>
            {visiblePos.map((p) => {
              const names = Array.from(new Set((c.sinsal.twelve[p] ?? []).map((tw: any) => tw.name)));
              return (
                <View key={p} style={styles.twelveCell}>
                  {names.length ? names.map((n, i) => (
                    <PressableScale key={i} onPress={() => setGlossary({ kind: 'sinsal', key: n })}><Text style={styles.twelveCellTx}>{n}</Text></PressableScale>
                  )) : <Text style={styles.twelveDim}>—</Text>}
                </View>
              );
            })}
          </View>

        </>
      )}
      {/* ── 오행과 십성 1: 일간·격국·대표 십성 ── */}
      {activeTab === 'elem' && (
        <>
      {/* 일간·신강약·격국 */}
      <Text style={styles.kv}>{t('myeongsik.dayMaster')}: <Text style={styles.kvAccent}>{c.saju.dayMaster.stem}({c.saju.dayMaster.element})</Text></Text>
      <Text style={styles.kv}>{t('myeongsik.dayMaster')} {c.saju.dayMaster.stem}  ·  {t('myeongsik.pattern')}: {c.pattern.name} ({t(c.pattern.revealed ? 'myeongsik.patternRevealed' : 'myeongsik.patternHidden')})</Text>
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
            <Text style={styles.gyeokHead}>핵심 격</Text>
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

      {/* 대표 오행(일간)·대표 십성(격국) — 탭→설명 */}
      <View style={styles.repRow}>
        <PressableScale style={styles.repChip} onPress={() => setGlossary({ kind: 'element', key: c.saju.dayMaster.element })}>
          <Text style={styles.repLabel}>대표 오행</Text>
          <Text style={[styles.repVal, { color: elementColor[c.saju.dayMaster.element] }]}>{c.saju.dayMaster.stem} · {c.saju.dayMaster.element}</Text>
        </PressableScale>
        {(() => {
          const repTg = (c.pattern.candidates[0] || '').replace('격', '') || c.saju.pillars['월'].branchMainTenGod;
          return (
            <PressableScale style={styles.repChip} onPress={() => setGlossary({ kind: 'tengod', key: repTg })}>
              <Text style={styles.repLabel}>대표 십성(격)</Text>
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
              <SvgText x={CX} y={CY + 17} fill={colors.ju} fontSize={12} fontWeight="700" textAnchor="middle">{c.strengthClass.type}</SvgText>
            </Svg>
            <View style={styles.strengthInfo}>
              <Text style={styles.kv}><Text style={styles.kvLabel}>강약</Text>  {c.strengthClass.type}</Text>{/* 엔진 판단값 그대로(daniel) — 재해석 라벨 제거 */}
              <Text style={styles.kv}><Text style={styles.kvLabel}>강약축</Text>  {c.strengthClass.gangyakAxis} (재관 대비)</Text>
              <Text style={styles.kv}><Text style={styles.kvLabel}>우호세력</Text>  {Math.round(ratio * 100)}% · 비겁+인성</Text>
              <Text style={styles.kv}><Text style={styles.kvLabel}>득령·득지·득세</Text>  {[c.strengthClass.deukryeong && '득령', c.strengthClass.deukji && '득지', c.strengthClass.deukse && '득세'].filter(Boolean).join('·') || '없음'}</Text>
            </View>
          </View>
        );
      })()}
      <Text style={styles.hint}>{c.strengthClass.reason}</Text>
      {/* 신강·신약 특징 — 탭하면 상세 시트(성향·강점·주의·용신 방향) */}
      <PressableScale style={styles.strDetailBtn} onPress={() => setStrengthOpen(true)}>
        <Text style={styles.strDetailBtnTx}>신강·신약 특징 자세히 보기 ›</Text>
      </PressableScale>
      {/* 조후·음양 쏠림(daniel) — 탭하면 설명·문제점·대응법(개운법) */}
      {(() => {
        const ey = eumYangSkew(P, input?.sex); const jh = johuSkew(P); const js = joSeupSkew(P);
        return (
          <PressableScale style={styles.strDetailBtn} onPress={() => setJohuOpen(true)}>
            <Text style={styles.strDetailBtnTx}>한난조습 {jh.skew.replace(' 쏠림', '')}·{js.skew.replace(' 쏠림', '')} · 음양 {ey.skew.replace('양', '+').replace('음', '-')}  — 문제점·대응법 ›</Text>
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
      </View>
      {(() => {
        // 도넛(원 그리기)은 오행 상생 순서를 지켜야 한다 — 목생화·화생토… 가 눈에 보여야 해서.
        const order = ['木', '火', '土', '金', '水'] as const;
        // ★범례(목록)는 **갯수 내림차순**으로 세운다(daniel 2026-08-04 "갯수 내림차순으로 노출시켜").
        //   순서를 고정하면 어느 기운이 많은지 숫자를 하나하나 읽어야 안다 — 많은 것부터 놓으면 한눈에 보인다.
        //   같은 개수면 원래 오행 순서를 유지한다(흔들리지 않게).
        const legendOrder = [...order].sort((a, b) => elem[b] - elem[a] || order.indexOf(a) - order.indexOf(b));
        const total = order.reduce((a, el) => a + elem[el], 0) || 1;
        const R = 40, CX = 50, CY = 50, SW = 13, circ = 2 * Math.PI * R;
        // 누적 오프셋으로 세그먼트 배치(12시 시작). 강한 오행 순이 아니라 상생순(목화토금수) 고정.
        let acc = 0;
        const segs = order.filter((el) => elem[el] > 0).map((el) => {
          const frac = elem[el] / total;
          const seg = { el, len: circ * frac, offset: acc };
          acc += frac;
          return seg;
        });
        const top = order.reduce((m, el) => (elem[el] > elem[m] ? el : m), '木' as typeof order[number]);
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
              <SvgText x={CX} y={CY + 15} fill={colors.inkSoft} fontSize={9} textAnchor="middle">최강</SvgText>
            </Svg>
            <View style={styles.elemLegend}>
              {legendOrder.map((el) => (
                <View key={el} style={styles.elemLegendRow}>
                  <View style={[styles.elemDot, { backgroundColor: elementColor[el] }]} />
                  <Text style={[styles.elemLegendEl, { color: elementColor[el] }]}>{el} <Text style={{ fontSize: 11, color: colors.inkFaint, fontWeight: '600' }}>({elemTenGod(el)})</Text></Text>
                  <Text style={styles.elemLegendVal}>{elem[el]}  ·  {Math.round((elem[el] / total) * 100)}%</Text>
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
            <Text style={styles.todayBtnTx}>⊙ 오늘 기준 현재운세 보기</Text>
          </PressableScale>
          {/* 대운·세운 타임라인 (원국·지장간 바로 아래) — 대운 탭 → 세운(과거~100세) → 월운 드릴다운 */}
          {luckCycles.length > 0 && (() => {
        const lc = luckCycles[selLuck];
        // 대운수(행운수)+순역 — 명식당 하나. daniel 07-17: 표준 대운수(절기까지 일수÷3, 1~10)로 표기.
        //   라이브러리(lunar-javascript)의 startAge 는 '입운 세는나이'(=순수 대운수 + 1)라 그대로 쓰면 11처럼 큼.
        //   순수 대운수 = getStartYear − 출생연도 = startAge − 1 (재현 검증: 1992-08-09 남 startAge11→대운수10).
        const daeunsu: number | undefined = luckCycles[0]?.startAge != null ? Math.max(1, luckCycles[0].startAge - 1) : undefined;
        const sx = input?.sex;
        const luckDir = sx ? (daeunForward(P['년'].stem, sx) ? '순행' : '역행') : null;
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
          ...visiblePos.map((p) => ({ label: `${p}주`, stem: P[p].stem, branch: P[p].branch, tg: P[p].stemTenGod, luck: false, hidden: HIDDEN[P[p].branch] ?? [] })),
          ...(lc && showLayers.luck ? [{ label: '대운', stem: lc.stem, branch: lc.branch, tg: lc.stemTenGod, luck: true, hidden: HIDDEN[lc.branch as keyof typeof HIDDEN] ?? [] }] : []),
          ...(an && showLayers.year ? [{ label: '세운', stem: an.stem, branch: an.branch, tg: an.stemTenGod, luck: true, hidden: HIDDEN[an.branch as keyof typeof HIDDEN] ?? [] }] : []),
          ...(mo && showLayers.month ? [{ label: `${selMonth + 1}월`, stem: mo.stem, branch: mo.branch, tg: mo.stemTenGod, luck: true, hidden: HIDDEN[mo.branch as keyof typeof HIDDEN] ?? [] }] : []),
          ...(dayItem && showLayers.day ? [{ label: '일운', stem: dayItem.stem, branch: dayItem.branch, tg: dayItem.stemTenGod, luck: true, hidden: HIDDEN[dayItem.branch as keyof typeof HIDDEN] ?? [] }] : []),
        ];
        // 시간층 합충 — 확장명식 컬럼(원국+운) 간 작용. 운(대운/세운/월운) 연루된 것만(원국끼리는 팔자 표에).
        // 컬럼 수에 맞춰 가용폭(expW)을 꽉 채움 — 층을 끄면 칸이 넓어지고 글자(scale)도 커진다.
        //   컬럼이 많아 폭을 넘으면 최소 50으로 두고 가로 스크롤. scale 상한 1.7(과도 확대 방지).
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
            {([['luck', '대운'], ['year', '년운'], ['month', '월운'], ['day', '일운']] as const).map(([k, l]) => (
              <PressableScale key={k} style={[styles.layerChip, showLayers[k] && styles.layerChipOn]} onPress={() => setShowLayers((p) => ({ ...p, [k]: !p[k] }))}>
                <Text style={[styles.layerChipTx, showLayers[k] && styles.layerChipTxOn]}>{showLayers[k] ? '✓ ' : ''}{l}</Text>
              </PressableScale>
            ))}
          </View>
          {/* ★확장명식(원국+대운/세운/월운/일운) = 시간층을 하나라도 켰을 때만 노출(daniel 2026-07-24 통합): 다 끄면 원국은 위 팔자표에 있으니 중복 렌더 안 함. */}
          {hasLuckCol && (<>
          {/* 원국 + 대운·세운 확장 명식 (합충선은 아래 토글로 펼침) */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.luckScroll} onLayout={(e) => setExpW(e.nativeEvent.layout.width)}>
            <View>
              {expandArcs(activeGanEx, 'above')}
              <View style={{ flexDirection: 'row' }}>
                {expandCols.map((col, i) => (
                  <View key={i} style={[styles.expCol2, { width: COLW }, col.luck && styles.expColLuck, hlExpand.has(col.label) && styles.expCol2On]}>
                    <Text style={[styles.expLabel, { fontSize: Math.round(fs(11) * scale) }]}>{col.label}</Text>
                    {/* 대운수(입운 나이) — 대운 컬럼만 표기, 나머지 컬럼은 빈 줄로 세로 정렬 유지 */}
                    <Text style={[styles.expAge, { fontSize: Math.round(fs(9) * scale) }]}>{col.label === '대운' && lc ? `${lc.startAge}세` : col.label === '세운' && seunAge != null ? `만 ${seunAge}세` : ' '}</Text>
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
              <Text style={styles.linksToggleTx}>{hasLuckCol ? '운 ' : '원국 '}합충형해 {ganEx.length + jiEx.length}개  {showExpandLinks ? '▲ 접기' : '▼ 펼쳐 보기'}</Text>
            </PressableScale>
          )}
          {showExpandLinks && normEx.length > 0 && (
            <View style={styles.linksCard}>
              <Text style={styles.strHint}>작용이 강한 순 — 충·합 강 / 형·극 중 / 해·파 약</Text>
              {/* ③ 운 합충선 전체 선택/해제(daniel) — 한번에 켜고 끄기 */}
              <PressableScale onPress={() => setActiveExpand((p) => p.size ? new Set<string>() : new Set(normEx.map((x: any) => x.key as string)))} style={{ alignSelf: 'flex-end', paddingVertical: 4, paddingHorizontal: 8 }}>
                <Text style={{ color: colors.ju, fontWeight: '700', fontSize: 12 }}>{activeExpand.size ? '전체 해제' : '전체 선택'}</Text>
              </PressableScale>
              {renderByStrength(normEx as any[], activeExpand, (k) => toggleKey(setActiveExpand, k))}
            </View>
          )}
          </>)}
          {/* 대운 타임라인 — 제목 옆 대운수(행운수)·순역 표기(daniel) */}
          <Text style={styles.luckSub}>
            대운{daeunsu != null ? <Text style={{ fontWeight: '700' }}> · 대운수 {daeunsu}{luckDir ? ` ${luckDir}` : ''}</Text> : null} (탭하면 그 대운의 세운 펼침)
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} ref={luckScrollRef} onLayout={(e) => { centerM.current.luck.v = e.nativeEvent.layout.width; recenter('luck', luckScrollRef); }} onContentSizeChange={() => recenter('luck', luckScrollRef)} style={styles.luckScroll} contentContainerStyle={styles.luckScrollC}>
            {luckCycles.map((l, i) => (
              <PressableScale key={i} onPress={() => { setSelLuck(i); setSelSeun(0); }} onLayout={l.isCurrent ? (e) => { centerM.current.luck.x = e.nativeEvent.layout.x; centerM.current.luck.w = e.nativeEvent.layout.width; recenter('luck', luckScrollRef); } : undefined} style={[styles.luckCard, { minWidth: ls(58) }, l.isCurrent && styles.luckCardCur, selLuck === i && styles.luckCardSel]}>
                <Text style={styles.luckAge}>{l.startAge}세</Text>
                <Text style={styles.luckTg}>{l.stemTenGod}</Text>
                <GzCell char={l.stem} kind="stem" size="sm" hangeul={hangeul} />
                <GzCell char={l.branch} kind="branch" size="sm" hangeul={hangeul} />
                <Text style={styles.luckTg}>{branchTenGod(dm, l.branch)}</Text>
                <Text style={styles.luckStage}>{twelveStage(dm, l.branch)}</Text>
              </PressableScale>
            ))}
          </ScrollView>
          {/* 세운 타임라인 (선택 대운 10년, 탭 → 확장 명식 갱신) */}
          {lc?.annuals?.length > 0 && (
            <>
              <Text style={styles.luckSub}>{lc.startAge}세 대운 · 세운 (탭하면 위 명식에 반영)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} ref={seunScrollRef} onLayout={(e) => { centerM.current.seun.v = e.nativeEvent.layout.width; recenter('seun', seunScrollRef); }} onContentSizeChange={() => recenter('seun', seunScrollRef)} style={styles.luckScroll} contentContainerStyle={styles.luckScrollC}>
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
            </>
          )}
          {an?.months && an.months.length > 0 && (
            <>
              <Text style={styles.luckSub}>{an.year} 세운 · 월운 (탭하면 위 명식에 반영)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} ref={monthScrollRef} onLayout={(e) => { centerM.current.month.v = e.nativeEvent.layout.width; recenter('month', monthScrollRef); }} onContentSizeChange={() => recenter('month', monthScrollRef)} style={styles.luckScroll} contentContainerStyle={styles.luckScrollC}>
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
            </>
          )}
          {/* 월운 탭 → 그 달 일진(日辰) 달력 — 날짜 탭하면 위 명식 '일운'에 반영 */}
          {input && an?.months?.[selMonth] && days.length > 0 && (() => {
            const firstDow = new Date(an.year, selMonth, 1).getDay(); // 1일 요일(0=일)
            return (
              <>
                <Text style={styles.luckSub}>{an.year}년 {selMonth + 1}월 일진 달력 (탭하면 위 명식에 일운 반영)</Text>
                <View style={styles.calGrid}>
                  {['일', '월', '화', '수', '목', '금', '토'].map((w) => (
                    <Text key={w} style={styles.calHead}>{w}</Text>
                  ))}
                  {Array.from({ length: firstDow }).map((_, i) => <View key={`e${i}`} style={styles.calCell} />)}
                  {days.map((dd) => {
                    const isToday = an.year === now.getFullYear() && selMonth === now.getMonth() && dd.day === now.getDate();
                    const isSel = dayItem?.day === dd.day; // 선택된 일운 강조
                    return (
                      <PressableScale key={dd.day} onPress={() => setSelDay(dd.day)} style={[styles.calCell, isToday && styles.calCellToday, isSel && styles.calCellSel]}>
                        <Text style={[styles.calDay, isToday && styles.calDayToday]}>{dd.day}{isToday ? ' ·오늘' : ''}</Text>
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
      {activeTab === 'ziwei' && (
        <>
      {/* 자미두수(보조) */}
      <Text style={styles.h}>{t('myeongsik.ziwei')}</Text>
      <Text style={[styles.hint, { marginHorizontal: 0 }]}>사주와는 별개의 운명 체계예요. 태어난 시각으로 열두 자리(명궁·재물·관록·배우자 등)에 별을 배치해, 삶의 각 영역에 드는 기운을 봅니다. 사주를 보조해 교차로 참고해요.</Text>
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
                    const info = r === 1 && ci === 1 ? { t: '일간', v: dm.stem }
                      : r === 1 && ci === 2 ? { t: '명궁', v: c.ziwei.lifePalaceBranch }
                      : r === 2 && ci === 1 ? { t: '국', v: c.ziwei.bureau.replace('五局', '') }
                      : { t: '오행', v: dm.element };
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
            <Text style={styles.h}>자미두수 운흐름</Text>
            <Text style={styles.luckSub}>대한(10년) · 그 시기 천간이 일으키는 비성사화</Text>
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
                  <Text style={styles.sheetCloseText}>닫기</Text>
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
          <Text style={styles.sheetTitle}>{MYEONG_TABS.find((x) => x.id === activeTab)?.label}</Text>
          <Text style={styles.sheetMeaning}>{MYEONG_TABS.find((x) => x.id === activeTab)?.desc}</Text>
          <PressableScale style={styles.sheetClose} onPress={() => setCatDescOpen(false)}>
            <Text style={styles.sheetCloseText}>닫기</Text>
          </PressableScale>
        </Pressable>
      </Pressable>
    </Modal>

    {/* 신강·신약 특징 시트 — 내 유형 강조 + 성향·강점·주의·용신 방향 */}
    <Modal statusBarTranslucent visible={strengthOpen} transparent animationType="slide" onRequestClose={() => setStrengthOpen(false)}>
      <Pressable style={styles.sheetOverlay} onPress={() => setStrengthOpen(false)}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetKind}>신강·신약</Text>
          <Text style={styles.sheetTitle}>내 명식 · {c.strengthClass.type}</Text>
          <ScrollView style={{ flexShrink: 1 }} showsVerticalScrollIndicator={true}>
            {STRENGTH_INFO.map((s) => {
              const mine = c.strengthClass.type.includes(s.key === '신강' ? '강' : '약');
              return (
                <View key={s.key} style={[styles.strDetailCard, mine && styles.strDetailMine]}>
                  <Text style={styles.strDetailTitle}>{s.title}{mine ? '  · 내 유형' : ''}</Text>
                  <Text style={styles.strDetailBody}>{s.traits}</Text>
                  <Text style={styles.strDetailLabel}>강점</Text>
                  <Text style={styles.strDetailBody}>{s.strong}</Text>
                  <Text style={styles.strDetailLabel}>주의</Text>
                  <Text style={styles.strDetailBody}>{s.caution}</Text>
                  <Text style={styles.strDetailLabel}>방향 (용신)</Text>
                  <Text style={styles.strDetailBody}>{s.yongsin}</Text>
                </View>
              );
            })}
            <Text style={styles.sheetMeaning}>* 경향 안내예요. 정확한 풀이는 원국 전체로 봐야 합니다.</Text>
          </ScrollView>
          <PressableScale style={styles.sheetClose} onPress={() => setStrengthOpen(false)}>
            <Text style={styles.sheetCloseText}>닫기</Text>
          </PressableScale>
        </Pressable>
      </Pressable>
    </Modal>

    {/* 조후·음양·오행·십성 쏠림 → 문제점·대응법(daniel 2026-06-24) */}
    <Modal statusBarTranslucent visible={johuOpen} transparent animationType="slide" onRequestClose={() => setJohuOpen(false)}>
      <Pressable style={styles.sheetOverlay} onPress={() => setJohuOpen(false)}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetKind}>조후 · 음양 쏠림</Text>
          <ScrollView style={{ flexShrink: 1 }} showsVerticalScrollIndicator={true}>
            {(() => {
              const ey = eumYangSkew(P, input?.sex); const jh = johuSkew(P); const js = joSeupSkew(P);
              const elc: Record<string, number> = {};
              for (const p of (['년', '월', '일', '시'] as const)) { const d = P[p]; if (!d) continue; const se = stemElement(d.stem), be = branchElement(d.branch); elc[se] = (elc[se] || 0) + 1; elc[be] = (elc[be] || 0) + (p === '월' ? 2 : 1); }
              const domEl = Object.entries(elc).sort((a, b) => b[1] - a[1])[0];
              // ★테마A(daniel 2026-07-06): 십성 쏠림 = 정/편·식/상 분리 + 신강약 게이트(재/관 신강=용신·길). 10정밀 detail + verdict 소비.
              const tgSkew = tengodSkew((c.tenGods?.detail ?? {}) as Record<string, number>, c.strength?.verdict ?? '중화');
              const block = (label: string, sub: string, concept: string, item: SkewItem | null, favorable = false) => (
                <View style={styles.strDetailCard} key={label}>
                  <Text style={styles.strDetailTitle}>{label} · {sub}</Text>
                  {concept ? emph(concept, styles.strDetailBody) : null}
                  {item ? (<><Text style={styles.strDetailLabel}>{favorable ? '이렇게 강하면' : '이렇게 쏠리면'}</Text><Text style={styles.strDetailBody}>{item.problem}</Text><Text style={styles.strDetailLabel}>{favorable ? '살리는 법' : '대응법(개운)'}</Text><Text style={styles.strDetailBody}>{item.remedy}</Text></>) : <Text style={styles.strDetailBody}>치우침이 크지 않아 무난해요.</Text>}
                </View>
              );
              return (<>
                {block('한난(조후)', `${jh.skew} (따뜻 ${jh.warm}·차가움 ${jh.cold})`, CONCEPT_INFO.조후, jh.skew !== '중화' ? JOHU_SKEW[jh.skew] : null)}
                {block('조습', `${js.skew} (습함 ${js.wet}·건조 ${js.dry})`, CONCEPT_INFO.조습, js.skew !== '중화' ? JOSEUP_SKEW[js.skew] : null)}
                {block('음양', `${ey.skew.replace('양', '+').replace('음', '-')} (+ ${ey.yang}·- ${ey.yin})`, CONCEPT_INFO.음양, ey.skew !== '균형' ? YINYANG_SKEW[ey.skew] : null)}
                {domEl && domEl[1] >= 4 ? block('오행 쏠림', `${domEl[0]} 강함`, '', ELEMENT_SKEW[domEl[0]]) : null}
                {tgSkew ? block('기운(십성) 쏠림', `${tgSkew.god} 강함`, '', tgSkew.item, tgSkew.favorable) : null}
              </>);
            })()}
            <Text style={styles.sheetMeaning}>* 쏠림 경향 안내예요(대응법=개운법). 정확한 풀이는 원국 전체로 봐야 합니다.</Text>
                {/* ★이어서 보면 좋은 콘텐츠(daniel 2026-07-27 "전부 붙여") — 큐레이션 출처 RELATED 단일. */}
      <RelatedContent kind="charts" />
</ScrollView>
          <PressableScale style={styles.sheetClose} onPress={() => setJohuOpen(false)}>
            <Text style={styles.sheetCloseText}>닫기</Text>
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
  h: { ...f.heading, marginTop: space(5), marginBottom: space(2) },
  hint: { ...f.caption, marginBottom: space(2) },
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
  layerToggle: { flexDirection: 'row', gap: space(2), marginTop: space(2), marginBottom: space(1) },
  layerChip: { paddingHorizontal: space(3), paddingVertical: space(1.5), borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  layerChipOn: { backgroundColor: colors.juSoft, borderColor: colors.ju },
  layerChipTx: { fontSize: fs(12), fontWeight: '700', color: colors.inkFaint },
  layerChipTxOn: { color: colors.ju },
  luckScroll: { marginTop: space(2) },
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
  luckSub: { ...f.caption, color: colors.ju, marginTop: space(3), marginBottom: space(1) },
  // 자미두수 운흐름(대한) 행 — 나이 | 궁 지지 | 비성사화
  ziDecRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: space(2), borderBottomWidth: 1, borderBottomColor: colors.line, gap: space(2) },
  ziDecAge: { ...f.caption, color: colors.inkSoft, width: 74 },
  ziDecBr: { ...f.body, color: colors.ink, fontWeight: '700', width: 24 },
  ziDecSihwa: { flex: 1, flexDirection: 'row', flexWrap: 'wrap' },
  ziDecTx: { ...f.caption },
  seunCard: { alignItems: 'center', paddingVertical: space(1.5), paddingHorizontal: space(2), borderRadius: radius.sm, backgroundColor: colors.sunk, minWidth: 52 },
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
