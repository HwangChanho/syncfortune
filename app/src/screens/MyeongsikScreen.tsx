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
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { computeChart } from '../lib/engine';
import type { ChartInput, PillarPos } from '@spec/chart';
import { colors, radius, space, shadow, font, gradients } from '../lib/theme';
import { GlassCard } from '../components/GlassCard';
import { OhaengIcon } from '../components/OhaengIcon';
import { stemElement, branchElement, elementColor, elementText, stemReading, branchReading } from '../lib/ohaeng';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
// ⚠️ expo-haptics 는 네이티브 모듈 — 현재 dev 빌드에 미포함이면 impactAsync 호출 시 크래시(2026-06).
//   안전 래퍼로 감싼다(네이티브 없으면 조용히 무시). 재빌드(npx expo run:ios) 후 진동 정상 동작.
const haptic = () => { try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); } catch { /* 네이티브 미포함 — 무시 */ } };
import { HIDDEN, computeMonthDays, branchTenGod } from '@engine/saju'; // 지장간 표 + 일운(流日) + 지지십신
import { twelveStage } from '@engine/twelve';                          // 임의 지지 12운성(타임라인용)
import { detectInteractionsAmong } from '@engine/structure';           // 시간층(원국×대운×세운) 합충 검출
import { lookupGlossary, GLOSSARY_KIND_LABEL, SINSAL_GLOSSARY, type GlossaryKind } from '../lib/myeongriGlossary'; // 클릭 설명
import { playSound } from '../lib/sounds';
import Svg, { Path, Rect, Circle, Text as SvgText, G } from 'react-native-svg';

// 전통 표기 — 오른쪽이 년주: 시(왼) ← 일 ← 월 ← 년(오른쪽)
const POS: PillarPos[] = ['시', '일', '월', '년'];

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

// 간지 한 칸(오행색 배경 + 한자 + 한글음) — 대운·세운·월운 타임라인/확장명식 공용. sm=대운/원국, xs=세운/월운.
//   onPress 주면 글자 탭 = 물상 설명(확장명식용). 타임라인 카드(선택 기능)에는 onPress 미전달(카드 탭=드릴다운 유지).
function GzCell({ char, kind, size, scale = 1, onPress }: { char: string; kind: 'stem' | 'branch'; size: 'sm' | 'xs'; scale?: number; onPress?: () => void }) {
  const el = kind === 'stem' ? stemElement(char) : branchElement(char);
  const ko = kind === 'stem' ? stemReading(char) : branchReading(char);
  const txt = { color: elementText[el] };
  // scale=1 → 정적 스타일(타임라인 카드). scale>1 → 확장명식 반응형(층 끄면 칸·글자 비례 확대).
  const baseW = size === 'sm' ? 38 : 34, baseF = size === 'sm' ? 19 : 16, baseLH = size === 'sm' ? 22 : 19;
  const cellDyn = scale !== 1 ? { width: Math.round(baseW * scale) } : null;
  const textDyn = scale !== 1 ? { fontSize: Math.round(baseF * scale), lineHeight: Math.round(baseLH * scale) } : null;
  const koDyn = scale !== 1 ? { fontSize: Math.round(9 * scale), lineHeight: Math.round(11 * scale) } : null;
  const inner = (
    <View style={[size === 'sm' ? styles.gzCellSm : styles.gzCellXs, cellDyn, { backgroundColor: elementColor[el] }]}>
      <Text style={[size === 'sm' ? styles.gzTextSm : styles.gzTextXs, textDyn, txt]}>{char}</Text>
      <Text style={[styles.gzKo, koDyn, txt]}>{ko}</Text>
    </View>
  );
  return onPress ? <Pressable onPress={onPress}>{inner}</Pressable> : inner;
}

export function MyeongsikScreen({ input, onReading, onSinsal, header }: { input: ChartInput | null; onReading?: () => void; onSinsal?: () => void; header?: ReactNode }) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'natal' | 'luck' | 'stars'>('natal');
  const [strengthOpen, setStrengthOpen] = useState(false); // 신강·신약 특징 시트
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(10)).current;
  // 대운·세운·월운 타임라인 = 오른쪽(과거)→왼쪽(미래) 흐름(전통 명식). 초기엔 오른쪽 끝(과거 시작)을 보여준다.
  const luckScrollRef = useRef<ScrollView>(null);
  const seunScrollRef = useRef<ScrollView>(null);
  const monthScrollRef = useRef<ScrollView>(null);

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
  if (!c) return <View style={styles.center}><Text style={font.body}>{t('myeongsik.noChart')}</Text></View>;

  const timeUnknown = input?.timeAccuracy === '미상'; // 시각 모름 → 시주 마스킹
  const P = c.saju.pillars;
  const dm = c.saju.dayMaster.stem;   // 일간 — 시간층(대운·세운·월운) 지지십신·12운성 산출 기준
  const s = c.saju as any; // currentLuck/annual 옵셔널 접근
  const visiblePos = POS.filter((p) => !(p === '시' && timeUnknown)); // 시각 미상 시 시주 제외
  // 통근(通根): 투출 천간(일간 포함)이 어느 지지 지장간에 같은 오행으로 뿌리내렸나 (일간뿐 아니라 재관도)
  const allGan = visiblePos.map((p) => P[p].stem);
  const rootsOf = (p: PillarPos) => {
    const he = new Set(P[p].hiddenStems.map((h) => stemElement(h.stem))); // 이 지지 지장간 오행
    return Array.from(new Set(allGan.filter((g) => he.has(stemElement(g))))); // 통근한 투출 천간
  };
  // 오행 분포 (천간+지지 카운트)
  const elem: Record<string, number> = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
  visiblePos.forEach((p) => { elem[stemElement(P[p].stem)]++; elem[branchElement(P[p].branch)]++; });
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
  const [showLayers, setShowLayers] = useState({ luck: true, year: true, month: true, day: true }); // 운세 확장명식 시간층 토글(대운·년운·월운·일운 — 끄면 남은 칸 넓어지고 글자 커짐)
  const [expW, setExpW] = useState(0); // 확장명식 가용폭 — 컬럼 수에 맞춰 칸·글자 반응형(daniel)
  const [glossary, setGlossary] = useState<{ kind: GlossaryKind; key?: string } | null>(null); // 클릭 설명 바텀시트
  const [showLinks, setShowLinks] = useState(false); // 팔자 합충형해 카드 펼침(기본 숨김)
  const [showExpandLinks, setShowExpandLinks] = useState(false); // 대운/세운 합충 펼침(기본 숨김)
  const [activePalja, setActivePalja] = useState<Set<string>>(() => new Set());   // 클릭으로 켠 팔자 합충(명식 강조용)
  const [activeExpand, setActiveExpand] = useState<Set<string>>(() => new Set());  // 클릭으로 켠 대운/세운 합충
  const posIndex: Record<string, number> = { 시: 0, 일: 1, 월: 2, 년: 3 };
  const allLinks = (c.saju.interactions as any[]).filter(
    (it) => (it.members?.length ?? 0) >= 2 && it.members.every((m: string) => posIndex[m] != null && visiblePos.includes(m as any))
  );
  const ganLinks = allLinks.filter((it: any) => it.level === '천간'); // 천간 합·충(극) — 팔자 위(점선)
  const jiLinks = allLinks.filter((it: any) => it.level !== '천간');  // 지지 합·충·형·해·파 — 팔자 아래(실선)
  // 합충선 라벨: 합이면 '합+합화오행'을 그 오행 색으로(=어떤 기운이 강해지는지), 그 외는 종류만.
  const linkLabel = (it: any) => (it.type === '합' ? `${t('myeongsik.합')}${it.transformsTo ?? ''}` : t(`myeongsik.${it.type}`));
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
        <Pressable onPress={() => setGlossary({ kind: 'interaction', key: ty })}><Text style={[styles.linkGroupHead, { color: col }]}>● {ty} {grp.length}  ⓘ</Text></Pressable>
        {grp.map((x: any, i: number) => {
          const on = active.has(x.key);
          return (
            <Pressable key={i} onPress={() => onToggle(x.key)} style={[styles.linkGRow, on && styles.linkGRowOn]}>
              <Text style={styles.linkGTx}>
                <Text style={{ color: on ? col : colors.inkFaint }}>{on ? '◉ ' : '○ '}</Text>
                {x.mem.map((mm: any, k: number) => (
                  <Text key={k}>
                    {k > 0 ? '  ·  ' : ''}{mm.label} <Text style={{ color: elementColor[mm.el], fontWeight: '800' }}>{mm.char}</Text>
                  </Text>
                ))}
                {ty === '합' && x.transformsTo ? <Text style={{ color: col, fontWeight: '800' }}>{`  → ${x.transformsTo}`}</Text> : null}
                {x.isGan ? <Text style={styles.linkLevel}>  천간</Text> : null}
              </Text>
            </Pressable>
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
      <Pressable key={i} onPress={() => onToggle(x.key)} style={[styles.strRow, tier === '강' && styles.strRowTop, on && styles.linkGRowOn]}>
        <Text style={[styles.strBadge, { color: col, borderColor: col }]}>{on ? '◉' : tier}</Text>
        <Text style={styles.linkGTx}>
          {x.mem.map((mm: any, k: number) => (
            <Text key={k}>
              {k > 0 ? '  ⟷  ' : ''}{mm.label} <Text style={{ color: elementColor[mm.el], fontWeight: '800' }}>{mm.char}</Text>
            </Text>
          ))}
          {'   '}
          <Text style={{ color: col, fontWeight: '800' }}>{x.type}{x.type === '합' && x.transformsTo ? ` ${x.transformsTo}` : ''}</Text>
          {x.isGan ? <Text style={styles.linkLevel}>  천간</Text> : null}
        </Text>
      </Pressable>
    );
  });

  const [showAdvanced, setShowAdvanced] = useState(true); // daniel: 디폴트 상세분석 ON(지장간·12운성·통근)
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
              <Pressable onPress={() => setGlossary({ kind: 'tengod', key: P[p].stemTenGod })}>
                <Text style={[styles.pillarTenGod, { color: colors.inkSoft }]}>{P[p].stemTenGod}</Text>
              </Pressable>
              <Pressable style={styles.pillarMain} onPress={() => setGlossary({ kind: 'stem', key: P[p].stem })}>
                <Text style={[styles.pillarChar, { color: elementColor[elStem] }]}>{P[p].stem}</Text>
                <Text style={[styles.pillarReading, { color: colors.inkFaint }]}>{stemReading(P[p].stem)}</Text>
              </Pressable>


              <Pressable style={styles.pillarMain} onPress={() => setGlossary({ kind: 'branch', key: P[p].branch })}>
                <Text style={[styles.pillarChar, { color: elementColor[elBranch] }]}>{P[p].branch}</Text>
                <Text style={[styles.pillarReading, { color: colors.inkFaint }]}>{branchReading(P[p].branch)}</Text>
              </Pressable>
              {/* 지지 십신 — 개별 클릭 시 십신 설명 */}
              <Pressable onPress={() => setGlossary({ kind: 'tengod', key: P[p].branchMainTenGod })}>
                <Text style={[styles.pillarTenGod, { color: colors.inkSoft }]}>{P[p].branchMainTenGod}</Text>
              </Pressable>

              {showAdvanced && (
                <Animated.View style={styles.advancedInfo}>
                  <View style={styles.pillarDivider} />
                  <Pressable onPress={() => setGlossary({ kind: 'stage', key: c.stages[p] })}>
                    <Text style={styles.pillarStage}>{c.stages[p]}</Text>
                  </Pressable>
                  <View style={styles.pillarHidden}>
                    {P[p].hiddenStems.map((h, i) => {
                      const rooted = allGan.includes(h.stem); // 지장간이 원국 천간에 투출 = 통근(동그라미 표시)
                      return (
                        <View key={i} style={[styles.pillarHiddenItem, rooted && styles.pillarHiddenRooted]}>
                          <Text style={[styles.pillarHiddenChar, { color: elementColor[stemElement(h.stem)] }]}>{h.stem}</Text>
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
      {[
        { id: 'natal', label: '명식' },
        { id: 'luck', label: '운세' },
        { id: 'stars', label: '신살' },
      ].map((t2) => (
        <Pressable
          key={t2.id}
          style={[styles.tabBtn, activeTab === t2.id && styles.tabBtnOn]}
          onPress={() => {
            setActiveTab(t2.id as any);
            haptic();
          }}
        >
          <Text style={[styles.tabLabel, activeTab === t2.id && styles.tabLabelOn]}>{t2.label}</Text>
        </Pressable>
      ))}
    </View>

    <ScrollView style={styles.screen} contentContainerStyle={styles.wrap}>
      {header}
      <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
        {activeTab === 'natal' && (
        <>
          <View style={styles.headerArea}>
            <Text style={styles.h}>{t('myeongsik.palja')}</Text>
            <Pressable style={styles.advancedBtn} onPress={toggleAdvanced}>
              <Text style={styles.advancedBtnTx}>{showAdvanced ? '간략히' : '상세 분석'}</Text>
            </Pressable>
          </View>

          {renderArcs(activeGanP, 'above')}
          {renderPillars()}
          {renderArcs(activeJiP, 'below')}

          {/* 12신살(원국) — 자리별 요약. 상세·기준지(년/일)·길신은 '신살' 탭에서(daniel: 원국에도 포함) */}
          <View style={styles.twelveRow}>
            <Text style={styles.twelveRowLabel}>12신살</Text>
            {visiblePos.map((p) => {
              const names = Array.from(new Set((c.sinsal.twelve[p] ?? []).map((tw: any) => tw.name)));
              return (
                <View key={p} style={styles.twelveCell}>
                  {names.length ? names.map((n, i) => (
                    <Pressable key={i} onPress={() => setGlossary({ kind: 'sinsal', key: n })}><Text style={styles.twelveCellTx}>{n}</Text></Pressable>
                  )) : <Text style={styles.twelveDim}>—</Text>}
                </View>
              );
            })}
          </View>

          {/* 합충형해 토글 */}
          {(ganLinks.length + jiLinks.length) > 0 && (
            <Pressable 
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
            </Pressable>
          )}
      {showLinks && normPalja.length > 0 && (
        <View style={styles.linksCard}>{renderGroups(normPalja, activePalja, (k) => toggleKey(setActivePalja, k))}</View>
      )}

      {/* 일간·신강약·격국 */}
      <Text style={styles.kv}>{t('myeongsik.dayMaster')}: <Text style={styles.kvAccent}>{c.saju.dayMaster.stem}({c.saju.dayMaster.element})</Text></Text>
      <Text style={styles.kv}>{t('myeongsik.dayMaster')} {c.saju.dayMaster.stem}  ·  {t('myeongsik.pattern')}: {c.pattern.candidates.join(', ')}</Text>
      {timeUnknown && <Text style={styles.warn}>{t('myeongsik.timeUnknownNote')}</Text>}

      {/* 대표 오행(일간)·대표 십성(격국) — 탭→설명 */}
      <View style={styles.repRow}>
        <Pressable style={styles.repChip} onPress={() => setGlossary({ kind: 'element', key: c.saju.dayMaster.element })}>
          <Text style={styles.repLabel}>대표 오행</Text>
          <Text style={[styles.repVal, { color: elementColor[c.saju.dayMaster.element] }]}>{c.saju.dayMaster.stem} · {c.saju.dayMaster.element}</Text>
        </Pressable>
        {(() => {
          const repTg = (c.pattern.candidates[0] || '').replace('격', '') || c.saju.pillars['월'].branchMainTenGod;
          return (
            <Pressable style={styles.repChip} onPress={() => setGlossary({ kind: 'tengod', key: repTg })}>
              <Text style={styles.repLabel}>대표 십성(격)</Text>
              <Text style={styles.repValTg}>{c.pattern.candidates.join(' · ') || repTg}</Text>
            </Pressable>
          );
        })()}
      </View>

      {/* 신강약 — 게이지(중화=50% 기준, 신약←→신강) + 신왕/신강 분류(강함의 동력) */}
      <Text style={styles.h}>{t('myeongsik.strength')}</Text>
      {(() => {
        const dist = c.tenGods.distribution;
        const favor = (dist['비겁'] || 0) + (dist['인성'] || 0);            // 우호 = 비겁+인성
        const total = Object.values(dist).reduce((a: number, b: number) => a + b, 0) || 1;
        const ratio = favor / total;
        const R = 42, CX = 52, CY = 52, circ = 2 * Math.PI * R;
        const sc = c.strength.score;
        const driverLabel = c.strengthClass.driver === '비겁' ? '비겁결집형 (자력본위)'
          : c.strengthClass.driver === '인성' ? '인성받침형 (수용)'
          : c.strengthClass.driver === '약' ? '신약' : '혼합';
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
              <Text style={styles.kv}><Text style={styles.kvLabel}>결집유형</Text>  {driverLabel}</Text>
              <Text style={styles.kv}><Text style={styles.kvLabel}>강약축</Text>  {c.strengthClass.gangyakAxis} (재관 대비)</Text>
              <Text style={styles.kv}><Text style={styles.kvLabel}>우호세력</Text>  {Math.round(ratio * 100)}% · 비겁+인성</Text>
              <Text style={styles.kv}><Text style={styles.kvLabel}>득령·득지·득세</Text>  {[c.strengthClass.deukryeong && '득령', c.strengthClass.deukji && '득지', c.strengthClass.deukse && '득세'].filter(Boolean).join('·') || '없음'}</Text>
            </View>
          </View>
        );
      })()}
      <Text style={styles.hint}>{c.strengthClass.reason}</Text>
      {/* 신강·신약 특징 — 탭하면 상세 시트(성향·강점·주의·용신 방향) */}
      <Pressable style={styles.strDetailBtn} onPress={() => setStrengthOpen(true)}>
        <Text style={styles.strDetailBtnTx}>신강·신약 특징 자세히 보기 ›</Text>
      </Pressable>

      {/* 오행 분포 (오행색 도넛 + %·개수 범례) */}
      <Text style={styles.h}>{t('myeongsik.elements')}</Text>
      {(() => {
        const order = ['木', '火', '土', '金', '水'] as const;
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
              {order.map((el) => (
                <View key={el} style={styles.elemLegendRow}>
                  <View style={[styles.elemDot, { backgroundColor: elementColor[el] }]} />
                  <Text style={[styles.elemLegendEl, { color: elementColor[el] }]}>{el}</Text>
                  <Text style={styles.elemLegendVal}>{elem[el]}  ·  {Math.round((elem[el] / total) * 100)}%</Text>
                </View>
              ))}
            </View>
          </View>
        );
      })()}

      {/* 지장간 상세 — 숨은 기운(지장간)과 강약(본기=상시 강 / 중기·여기=잠재, 투출 시 드러나 강) */}
      <Text style={styles.h}>{t('myeongsik.hidden')}</Text>
      <Text style={styles.hiddenHint}>진한 칸 = 드러나 작용하는 힘(본기·뿌리내린 기운) · 흐린 칸 = 아직 숨은 잠재 기운</Text>
      {visiblePos.map((p) => {
        const d = P[p];
        return (
          <View key={p} style={styles.hiddenDetailRow}>
            <Text style={styles.hiddenRowLabel}>{p}주 {d.branch}</Text>
            <View style={styles.hiddenChips}>
              {d.hiddenStems.map((h, i) => {
                const rooted = allGan.includes(h.stem);            // 투출=통근(원국 천간에 드러나 뿌리내림)
                const strong = h.role === '본기' || rooted;         // 본기=상시 강 / 중기·여기는 투출(통근) 시 강 발현
                return (
                  <View key={i} style={[styles.hiddenChip, strong ? styles.hiddenChipStrong : styles.hiddenChipWeak]}>
                    <Text style={[styles.hiddenChipChar, { color: elementColor[stemElement(h.stem)] }, !strong && styles.hiddenDim]}>{h.stem}</Text>
                    <Text style={[styles.hiddenChipTg, !strong && styles.hiddenDim]}>{h.tenGod}</Text>
                    <Text style={styles.hiddenChipRole}>{h.role}{rooted ? '·뿌리' : ''}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        );
      })}

        </>
      )}

      {activeTab === 'luck' && (
        <>
          {/* 대운·세운 타임라인 (원국·지장간 바로 아래) — 대운 탭 → 세운(과거~100세) → 월운 드릴다운 */}
          {luckCycles.length > 0 && (() => {
        const lc = luckCycles[selLuck];
        const an = lc?.annuals?.[selSeun];
        const mo = an?.months?.[selMonth];
        // 일진(流日) — 선택 세운·월운의 날짜별 간지. 선택 일운(selDay)이 없으면 그 달 1일로 폴백.
        const days = (input && an) ? computeMonthDays(input, an.year, selMonth + 1) : [];
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
        const expandLinks = detectInteractionsAmong(expandCols.map((c2) => ({ pos: c2.label as any, stem: c2.stem, branch: c2.branch })))
          .filter((it) => it.members.length >= 2 && it.members.some((m) => expandCols.find((c2) => c2.label === m)?.luck)); // 3자 국(원국+운 완성) 포함
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
          const items = links.map((it, i) => {
            // off 없음 — 칸 '중앙'에서 출발(daniel: 대운/세운/월운/일운 토글로 컬럼 수가 바뀌어도 칸 중앙 정렬). 겹침은 다리 높이로 구분.
            const xs = (it.members as string[]).map((m) => xOfCol(m)).sort((a, b) => a - b); // 3자 국 포함 전 멤버
            const xa = xs[0], xb = xs[xs.length - 1];
            const legY = dir === 'above' ? 6 + i * STEP : H - (6 + i * STEP);
            const lbl = linkLabel(it);
            return { xa, xb, mids: xs.slice(1, -1), mid: (xa + xb) / 2, legY, col: linkColor(it), lbl, lw: lbl.length * 11 + 6 };
          });
          return (
            <Svg width={expandCols.length * COLW} height={H}>
              {items.map((o, i) => (
                <G key={`p${i}`}>
                  <Path d={`M ${o.xa} ${reach} L ${o.xa} ${o.legY} L ${o.mid - o.lw / 2} ${o.legY}`} stroke={o.col} strokeWidth={1.5} fill="none" strokeDasharray={dash} />
                  <Path d={`M ${o.mid + o.lw / 2} ${o.legY} L ${o.xb} ${o.legY} L ${o.xb} ${reach}`} stroke={o.col} strokeWidth={1.5} fill="none" strokeDasharray={dash} />
                  {o.mids.map((mx, k) => (
                    <Path key={k} d={`M ${mx} ${reach} L ${mx} ${o.legY}`} stroke={o.col} strokeWidth={1.5} fill="none" strokeDasharray={dash} />
                  ))}
                </G>
              ))}
              {items.map((o, i) => (
                <G key={`l${i}`}>
                  <Rect x={o.mid - o.lw / 2} y={o.legY - 7} width={o.lw} height={14} fill={colors.bg} rx={2} />
                  <SvgText x={o.mid} y={o.legY + 3} fill={o.col} fontSize={9} fontWeight="700" textAnchor="middle">{o.lbl}</SvgText>
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
              <Pressable key={k} style={[styles.layerChip, showLayers[k] && styles.layerChipOn]} onPress={() => setShowLayers((p) => ({ ...p, [k]: !p[k] }))}>
                <Text style={[styles.layerChipTx, showLayers[k] && styles.layerChipTxOn]}>{showLayers[k] ? '✓ ' : ''}{l}</Text>
              </Pressable>
            ))}
          </View>
          {/* 원국 + 대운·세운 확장 명식 (합충선은 아래 토글로 펼침) */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.luckScroll} onLayout={(e) => setExpW(e.nativeEvent.layout.width)}>
            <View>
              {expandArcs(activeGanEx, 'above')}
              <View style={{ flexDirection: 'row' }}>
                {expandCols.map((col, i) => (
                  <View key={i} style={[styles.expCol2, { width: COLW }, col.luck && styles.expColLuck, hlExpand.has(col.label) && styles.expCol2On]}>
                    <Text style={[styles.expLabel, { fontSize: Math.round(11 * scale) }]}>{col.label}</Text>
                    {/* 대운수(입운 나이) — 대운 컬럼만 표기, 나머지 컬럼은 빈 줄로 세로 정렬 유지 */}
                    <Text style={[styles.expAge, { fontSize: Math.round(9 * scale) }]}>{col.label === '대운' && lc ? `${lc.startAge}세` : ' '}</Text>
                    <Text style={[styles.expTg, { fontSize: Math.round(11 * scale) }]}>{col.tg}</Text>
                    <GzCell char={col.stem} kind="stem" size="sm" scale={scale} onPress={() => setGlossary({ kind: 'stem', key: col.stem })} />
                    <GzCell char={col.branch} kind="branch" size="sm" scale={scale} onPress={() => setGlossary({ kind: 'branch', key: col.branch })} />
                    <Text style={[styles.expTg, { fontSize: Math.round(11 * scale) }]}>{branchTenGod(dm, col.branch)}</Text>
                    <Text style={[styles.expStage, { fontSize: Math.round(10 * scale) }]}>{twelveStage(dm, col.branch)}</Text>
                    <View style={styles.expHidden}>
                      {col.hidden.map((h: any, k: number) => (
                        <Text key={k} style={[styles.expHiddenTx, { fontSize: Math.round(12 * scale), lineHeight: Math.round(15 * scale) }, { color: elementColor[stemElement(h.stem)] }]}>{h.stem}</Text>
                      ))}
                    </View>
                  </View>
                ))}
              </View>
              {expandArcs(activeJiEx, 'below')}
            </View>
          </ScrollView>
          {(ganEx.length + jiEx.length) > 0 && (
            <Pressable style={styles.linksToggle} onPress={() => setShowExpandLinks((v) => !v)}>
              <Text style={styles.linksToggleTx}>운 합충형해 {ganEx.length + jiEx.length}개  {showExpandLinks ? '▲ 접기' : '▼ 펼쳐 보기'}</Text>
            </Pressable>
          )}
          {showExpandLinks && normEx.length > 0 && (
            <View style={styles.linksCard}>
              <Text style={styles.strHint}>작용이 강한 순 — 충·합 강 / 형·극 중 / 해·파 약</Text>
              {renderByStrength(normEx as any[], activeExpand, (k) => toggleKey(setActiveExpand, k))}
            </View>
          )}
          {/* 대운 타임라인 (천간/지지 분리, 탭 → 확장 명식·세운 갱신) */}
          <Text style={styles.luckSub}>대운 (탭하면 그 대운의 세운 펼침)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} ref={luckScrollRef} onContentSizeChange={() => luckScrollRef.current?.scrollToEnd({ animated: false })} style={styles.luckScroll} contentContainerStyle={styles.luckScrollC}>
            {luckCycles.map((l, i) => (
              <Pressable key={i} onPress={() => { setSelLuck(i); setSelSeun(0); }} style={[styles.luckCard, l.isCurrent && styles.luckCardCur, selLuck === i && styles.luckCardSel]}>
                <Text style={styles.luckAge}>{l.startAge}세</Text>
                <Text style={styles.luckTg}>{l.stemTenGod}</Text>
                <GzCell char={l.stem} kind="stem" size="sm" />
                <GzCell char={l.branch} kind="branch" size="sm" />
                <Text style={styles.luckTg}>{branchTenGod(dm, l.branch)}</Text>
                <Text style={styles.luckStage}>{twelveStage(dm, l.branch)}</Text>
              </Pressable>
            ))}
          </ScrollView>
          {/* 세운 타임라인 (선택 대운 10년, 탭 → 확장 명식 갱신) */}
          {lc?.annuals?.length > 0 && (
            <>
              <Text style={styles.luckSub}>{lc.startAge}세 대운 · 세운 (탭하면 위 명식에 반영)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} ref={seunScrollRef} onContentSizeChange={() => seunScrollRef.current?.scrollToEnd({ animated: false })} style={styles.luckScroll} contentContainerStyle={styles.luckScrollC}>
                {lc.annuals.map((a: any, j: number) => (
                  <Pressable key={j} onPress={() => { setSelSeun(j); setSelMonth(0); }} style={[styles.seunCard, selSeun === j && styles.luckCardSel, a.year === s.annual?.year && styles.seunCur]}>
                    <Text style={styles.seunYear}>{a.year}</Text>
                    <Text style={styles.seunTg}>{a.stemTenGod}</Text>
                    <GzCell char={a.stem} kind="stem" size="xs" />
                    <GzCell char={a.branch} kind="branch" size="xs" />
                    <Text style={styles.seunTg}>{branchTenGod(dm, a.branch)}</Text>
                    <Text style={styles.seunStage}>{twelveStage(dm, a.branch)}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </>
          )}
          {an?.months && an.months.length > 0 && (
            <>
              <Text style={styles.luckSub}>{an.year} 세운 · 월운 (탭하면 위 명식에 반영)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} ref={monthScrollRef} onContentSizeChange={() => monthScrollRef.current?.scrollToEnd({ animated: false })} style={styles.luckScroll} contentContainerStyle={styles.luckScrollC}>
                {an.months.map((m: any, k: number) => (
                  <Pressable key={k} onPress={() => setSelMonth(k)} style={[styles.seunCard, selMonth === k && styles.luckCardSel]}>
                    <Text style={styles.seunYear}>{k + 1}월</Text>
                    <Text style={styles.seunTg}>{m.stemTenGod}</Text>
                    <GzCell char={m.stem} kind="stem" size="xs" />
                    <GzCell char={m.branch} kind="branch" size="xs" />
                    <Text style={styles.seunTg}>{branchTenGod(dm, m.branch)}</Text>
                    <Text style={styles.seunStage}>{twelveStage(dm, m.branch)}</Text>
                  </Pressable>
                ))}
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
                      <Pressable key={dd.day} onPress={() => setSelDay(dd.day)} style={[styles.calCell, isToday && styles.calCellToday, isSel && styles.calCellSel]}>
                        <Text style={[styles.calDay, isToday && styles.calDayToday]}>{dd.day}{isToday ? ' ·오늘' : ''}</Text>
                        <Text style={[styles.calGz, { color: elementColor[stemElement(dd.stem)] }]}>{dd.stem}{dd.branch}</Text>
                      </Pressable>
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

      {activeTab === 'stars' && (
        <>
          {/* 신살·공망 — 원국 적중은 자리별 표(팔자처럼 칸), 운에서 오는 건 별도 분리 */}
          <Text style={styles.h}>{t('myeongsik.sinsal')}</Text>
      <Text style={styles.hint}>{t('myeongsik.sinsalHint')}</Text>
      {/* 전용 상세 화면(분류·의미·활용)으로 — 명식 표는 요약, 깊은 디테일은 따로 */}
      {onSinsal && (
        <Pressable style={styles.sinsalDetailBtn} onPress={onSinsal}>
          <Text style={styles.sinsalDetailTx}>{t('myeongsik.sinsalDetail')}</Text>
        </Pressable>
      )}
      {(() => {
        // 적중(원국) 길신·흉살 병합(천을귀인 등 다중) + 괴강·백호
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
        const luckOnly = [...byName.values()].filter((s) => !s.hits.some((h) => (visiblePos as string[]).includes(h.pos)));
        const noGm = c.sinsal.gongmangHits.filter((p) => (visiblePos as string[]).includes(p)).length === 0;
        const tag = (name: string, onPress: () => void, key: any) => {
          const g = (SINSAL_GLOSSARY as any)[name];
          return <Pressable key={key} onPress={onPress}><Text style={styles.ssTagLink}>{g?.ko ?? name}</Text></Pressable>;
        };
        const cellTags = (names: string[]) => names.length ? names.map((n, i) => tag(n, () => setGlossary({ kind: 'sinsal', key: n }), i)) : <Text style={styles.ssDim}>—</Text>;
        const detailRow = (name: string, glyphs: string, hanja: string, kw: string, onPress: () => void) => (
          <Pressable onPress={onPress} style={styles.ssDRow}>
            <Text style={styles.ssDName} numberOfLines={1}>{name}<Text style={styles.ssDHanja}>{hanja ? ` ${hanja}` : ''}</Text></Text>
            <Text style={styles.ssDGlyph}>{glyphs}</Text>
            <Text style={styles.ssDDim}>운에서</Text>
            <Text style={styles.ssDKw} numberOfLines={1}>{kw}</Text>
          </Pressable>
        );
        return (
          <>
            <Text style={styles.ssSubHead}>원국 (자리별 적중)</Text>
            <View style={styles.ssTable}>
              <View style={styles.ssTableRow}><Text style={styles.ssRowLabel} />{visiblePos.map((p) => <Text key={p} style={styles.ssColHead}>{p}주</Text>)}</View>
              <View style={styles.ssTableRow}><Text style={styles.ssRowLabel}>천간</Text>{visiblePos.map((p) => <View key={p} style={styles.ssCell}>{cellTags(atSide(p, 'stem'))}</View>)}</View>
              <View style={styles.ssTableRow}><Text style={styles.ssRowLabel}>지지</Text>{visiblePos.map((p) => <View key={p} style={styles.ssCell}>{cellTags(atSide(p, 'branch'))}</View>)}</View>
              <View style={styles.ssTableRow}><Text style={styles.ssRowLabel}>12신살</Text>{visiblePos.map((p) => <View key={p} style={styles.ssCell}>{(c.sinsal.twelve[p] ?? []).filter((tw: any) => tw.bases.some((b: string) => (visiblePos as string[]).includes(b))).map((tw: any, i: number) => tag(tw.name, () => setGlossary({ kind: 'sinsal', key: tw.name }), i))}</View>)}</View>
              <View style={styles.ssTableRow}><Text style={styles.ssRowLabel}>공망</Text>{visiblePos.map((p) => <View key={p} style={styles.ssCell}>{c.sinsal.gongmangHits.includes(p) ? tag('공망', () => setGlossary({ kind: 'gongmang' }), 'gm') : <Text style={styles.ssDim}>—</Text>}</View>)}</View>
            </View>
            {(luckOnly.length > 0 || noGm) && (
              <>
                <Text style={styles.ssSubHead}>운에서 오는 신살 (원국 미적중 — 대운·세운에서 작동)</Text>
                {luckOnly.map((s, idx) => {
                  const g = (SINSAL_GLOSSARY as any)[s.name];
                  return <View key={idx}>{detailRow(g?.ko ?? s.name, s.glyphs.join(''), g?.hanja ?? '', g?.keywords?.join('·') ?? '', () => setGlossary({ kind: 'sinsal', key: s.name }))}</View>;
                })}
                {noGm && <View>{detailRow('공망', c.sinsal.gongmang.join(''), '空亡', '비움·정신·종교', () => setGlossary({ kind: 'gongmang' }))}</View>}
              </>
            )}
            {!byName.has('양인') && <Text style={styles.ssLuckLine}>양인(羊刃): 음간 일간({P['일'].stem}) — 표준 양인 없음(이설).</Text>}
          </>
        );
      })()}

      {/* 자미두수(보조) */}
      <Text style={styles.h}>{t('myeongsik.ziwei')}</Text>
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
                          <Pressable onPress={() => setGlossary({ kind: 'palace', key: pl.name })}><Text style={[styles.ziName, styles.ziLink]}>{pl.name}</Text></Pressable>
                        ) : <Text style={styles.ziName} />}
                        <Text style={[styles.ziBr, { color: elementColor[branchElement(cell)] }]}>{cell}</Text>
                      </View>
                      {pl?.majorStars?.map((st: any, i: number) => (
                        <Pressable key={i} onPress={() => setGlossary({ kind: 'star', key: st.name })}>
                          <Text style={[styles.ziMajor, styles.ziLink]}>
                            {st.name}<Text style={styles.ziBright}>{brSym[st.brightness] ?? ''}</Text>
                            {(st.transforms ?? []).map((tr: string, j: number) => <Text key={j} style={[styles.ziSihwa, { color: sihwaCol[tr] ?? colors.ink }]}> {tr.slice(-1)}</Text>)}
                          </Text>
                        </Pressable>
                      ))}
                      {pl?.minorStars?.map((s: any, k: number) => (
                        <Pressable key={`m${k}`} onPress={() => setGlossary({ kind: 'star', key: s.name })}>
                          <Text style={[styles.ziMinor, styles.ziLink]}>{s.name}</Text>
                        </Pressable>
                      ))}
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        );
      })()}
        </>
      )}

      <Text style={styles.note}>{t('myeongsik.note')}</Text>

      {onReading && (
        <Pressable style={styles.readingBtn} onPress={onReading}>
          <Text style={styles.readingBtnText}>{t('myeongsik.readingBtn')}</Text>
        </Pressable>
      )}
      </Animated.View>
    </ScrollView>

    {/* 클릭 설명 바텀시트 — 십신·신살·공망 의미 (탭한 항목) */}
    <Modal visible={!!glossary} transparent animationType="slide" onRequestClose={() => setGlossary(null)}>
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
                <Pressable style={styles.sheetClose} onPress={() => setGlossary(null)}>
                  <Text style={styles.sheetCloseText}>닫기</Text>
                </Pressable>
              </>
            );
          })()}
        </Pressable>
      </Pressable>
    </Modal>

    {/* 신강·신약 특징 시트 — 내 유형 강조 + 성향·강점·주의·용신 방향 */}
    <Modal visible={strengthOpen} transparent animationType="slide" onRequestClose={() => setStrengthOpen(false)}>
      <Pressable style={styles.sheetOverlay} onPress={() => setStrengthOpen(false)}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetKind}>신강·신약</Text>
          <Text style={styles.sheetTitle}>내 명식 · {c.strengthClass.type}</Text>
          <ScrollView style={{ maxHeight: 440 }} showsVerticalScrollIndicator={false}>
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
          <Pressable style={styles.sheetClose} onPress={() => setStrengthOpen(false)}>
            <Text style={styles.sheetCloseText}>닫기</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.bg },
  wrap: { padding: space(5), paddingBottom: space(10) },
  tabBar: { flexDirection: 'row', backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.line },
  tabBtn: { flex: 1, paddingVertical: space(3.5), alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabBtnOn: { borderBottomColor: colors.ju },
  tabLabel: { ...font.body, color: colors.inkFaint, fontWeight: '700' },
  tabLabelOn: { color: colors.ju },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  h: { ...font.heading, marginTop: space(5), marginBottom: space(2) },
  hint: { ...font.caption, marginBottom: space(2) },
  ssRow: { flexDirection: 'row', alignItems: 'center', gap: space(2), paddingVertical: space(1.5), borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  ssName: { ...font.body, width: 76, color: colors.ink },
  ssBranches: { flexDirection: 'row', gap: space(1) },
  ssBranch: { fontSize: 16, fontWeight: '800', minWidth: 22, textAlign: 'center' },
  ssHit: { ...font.caption, color: colors.ju, fontWeight: '700' },
  ssDim: { ...font.caption, color: colors.inkFaint },
  // 자리별 신살 표 (천간/지지 × 시·일·월·년)
  ssTable: { marginTop: space(2), borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, overflow: 'hidden' },
  ssTableRow: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  ssRowLabel: { width: 36, alignSelf: 'center', textAlign: 'center', ...font.caption, color: colors.inkSoft, fontWeight: '700' },
  ssColHead: { flex: 1, textAlign: 'center', paddingVertical: space(1.5), ...font.caption, color: colors.inkFaint, fontWeight: '700' },
  ssCell: { flex: 1, alignItems: 'center', paddingVertical: space(1.5), paddingHorizontal: 2, gap: 2, borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.line },
  // 12신살 원국 요약 행(명식 탭) — daniel: 원국에도 12신살 표시
  twelveRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: space(3), backgroundColor: colors.card, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line, paddingVertical: space(2) },
  twelveRowLabel: { width: 44, alignSelf: 'center', textAlign: 'center', ...font.caption, color: colors.inkSoft, fontWeight: '700' },
  twelveCell: { flex: 1, alignItems: 'center', gap: 2 },
  twelveCellTx: { ...font.caption, color: colors.ju, fontWeight: '600' },
  twelveDim: { ...font.caption, color: colors.inkFaint },
  ssCellGz: { fontSize: 20, fontWeight: '800' },
  ssTag: { fontSize: 10, color: colors.ju, fontWeight: '600', textAlign: 'center' },
  ssGmRow: { flexDirection: 'row', alignItems: 'center', gap: space(2), marginTop: space(2.5) },
  ssLuckLine: { ...font.caption, color: colors.inkFaint, marginTop: space(2), lineHeight: 18 },
  // 신살·공망 전용 상세 화면 진입 버튼(골드 아웃라인)
  sinsalDetailBtn: { alignSelf: 'flex-start', borderWidth: 1, borderColor: colors.ju, borderRadius: radius.pill, paddingHorizontal: space(3.5), paddingVertical: space(1.75), marginTop: space(1), marginBottom: space(3) },
  sinsalDetailTx: { color: colors.ju, fontSize: 13, fontWeight: '700' },
  // 신살·공망 상세 (길신/흉살/기타/공망)
  ssCatBlock: { marginTop: space(3) },
  ssCatHead: { ...font.caption, color: colors.ju, fontWeight: '800', marginBottom: space(1) },
  ssDRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: space(1.5), borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line, gap: space(1.5) },
  ssDName: { ...font.body, color: colors.ink, width: 96, fontWeight: '700' },
  ssDHanja: { fontSize: 11, color: colors.inkFaint, fontWeight: '400' },
  ssDGlyph: { fontSize: 14, fontWeight: '800', color: colors.inkSoft, width: 52 },
  ssDHit: { ...font.caption, color: colors.ju, fontWeight: '700', width: 58 },
  ssDDim: { ...font.caption, color: colors.inkFaint, width: 58 },
  ssDKw: { ...font.caption, color: colors.inkSoft, flex: 1 },
  ssSubHead: { ...font.caption, color: colors.inkSoft, fontWeight: '700', marginTop: space(3), marginBottom: space(1) },
  ss12Tag: { fontSize: 11, color: colors.ink, fontWeight: '700', textAlign: 'center', textDecorationLine: 'none', textDecorationStyle: 'dotted' },
  ss12Base: { fontSize: 8, color: colors.inkFaint, fontWeight: '400' },
  rootBadgeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2, flexWrap: 'wrap', justifyContent: 'center' },
  rootStem: { fontSize: 10, fontWeight: '800' },
  rootSuffix: { fontSize: 9, color: colors.inkFaint, marginLeft: 1 },
  // 시간층 토글(년운·월운·일운)
  layerToggle: { flexDirection: 'row', gap: space(2), marginTop: space(2), marginBottom: space(1) },
  layerChip: { paddingHorizontal: space(3), paddingVertical: space(1.5), borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  layerChipOn: { backgroundColor: colors.juSoft, borderColor: colors.ju },
  layerChipTx: { fontSize: 12, fontWeight: '700', color: colors.inkFaint },
  layerChipTxOn: { color: colors.ju },
  luckScroll: { marginTop: space(2) },
  luckScrollC: { gap: space(1.5), flexDirection: 'row-reverse', paddingHorizontal: space(2) },
  luckCard: { alignItems: 'center', paddingVertical: space(2), paddingHorizontal: space(2.5), borderRadius: radius.sm, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, minWidth: 58 },
  luckCardCur: { borderColor: colors.ju },
  luckCardSel: { backgroundColor: colors.juSoft, borderColor: colors.ju, borderWidth: 1.5 },
  luckAge: { fontSize: 9, color: colors.inkFaint },
  luckGz: { flexDirection: 'row', gap: 1, marginVertical: 2 },
  luckStem: { fontSize: 17, fontWeight: '800' },
  luckTg: { fontSize: 9, color: colors.inkSoft },
  luckStage: { fontSize: 9, color: colors.inkFaint, fontWeight: '600' },   // 12운성
  luckSub: { ...font.caption, color: colors.ju, marginTop: space(3), marginBottom: space(1) },
  seunCard: { alignItems: 'center', paddingVertical: space(1.5), paddingHorizontal: space(2), borderRadius: radius.sm, backgroundColor: colors.sunk, minWidth: 52 },
  seunCur: { borderWidth: 1.5, borderColor: colors.ju },
  seunYear: { fontSize: 9, color: colors.inkFaint },
  seunGz: { fontSize: 14, fontWeight: '700' },
  seunTg: { fontSize: 8, color: colors.inkSoft },
  seunStage: { fontSize: 8, color: colors.inkFaint, fontWeight: '600' },   // 12운성
  gzCellSm: { width: 38, borderRadius: 6, alignItems: 'center', justifyContent: 'center', paddingVertical: 3, marginVertical: 1.5 },
  gzTextSm: { fontSize: 19, fontWeight: '800', lineHeight: 22 },
  gzCellXs: { width: 34, borderRadius: 6, alignItems: 'center', justifyContent: 'center', paddingVertical: 2, marginVertical: 1.5 },
  gzTextXs: { fontSize: 16, fontWeight: '700', lineHeight: 19 },
  gzKo: { fontSize: 9, fontWeight: '700', lineHeight: 11, opacity: 0.85 },   // 한자 아래 한글음
  expCol: { alignItems: 'center', paddingHorizontal: space(0.75), paddingVertical: space(0.5) },
  expCol2: { width: 50, alignItems: 'center', paddingVertical: space(0.5) },   // 고정폭(합충 호 좌표용)
  expColLuck: { backgroundColor: colors.juSoft, borderRadius: radius.sm },
  expLabel: { fontSize: 11, color: colors.inkFaint, marginBottom: 2, fontWeight: '600' },
  expAge: { fontSize: 9, color: colors.ju, marginBottom: 2, fontWeight: '700' },  // 대운수(입운 나이) — 대운 컬럼 강조
  expTg: { fontSize: 11, color: colors.inkSoft, marginBottom: 2, fontWeight: '600' },
  expStage: { fontSize: 10, color: colors.inkFaint, fontWeight: '600', marginTop: 1 },   // 12운성
  expHidden: { alignItems: 'center', marginTop: 4 },
  expHiddenTx: { fontSize: 12, fontWeight: '700', lineHeight: 15 },
  // 지장간 강약 칩 — 본기·통근(투출)=진하게(강) / 중기·여기 미투출=흐리게(잠재). daniel: 지장간 강약 표시
  hiddenHint: { ...font.caption, color: colors.inkFaint, marginTop: space(1), marginBottom: space(1), lineHeight: 16 },
  hiddenDetailRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: space(2.5), gap: space(2) },
  hiddenRowLabel: { ...font.caption, color: colors.inkSoft, fontWeight: '700', width: 52 },
  hiddenChips: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2), flex: 1 },
  hiddenChip: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: space(2), paddingVertical: space(1), borderRadius: radius.sm, borderWidth: 1 },
  hiddenChipStrong: { backgroundColor: colors.card, borderColor: colors.juLine },
  hiddenChipWeak: { backgroundColor: 'transparent', borderColor: colors.line, borderStyle: 'dashed' },
  hiddenChipChar: { fontSize: 15, fontWeight: '800' },
  hiddenChipTg: { fontSize: 12, color: colors.ink, fontWeight: '600' },
  hiddenChipRole: { fontSize: 9, color: colors.inkFaint, fontWeight: '700' },
  hiddenDim: { opacity: 0.45 },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: space(2) },
  calHead: { width: '14.28%', textAlign: 'center', fontSize: 10, color: colors.inkFaint, paddingVertical: 3 },
  calCell: { width: '14.28%', alignItems: 'center', paddingVertical: space(1) },
  calDay: { fontSize: 10, color: colors.inkSoft },
  calCellToday: { backgroundColor: colors.juSoft, borderRadius: radius.sm },
  calCellSel: { borderWidth: 1.5, borderColor: colors.ju, borderRadius: radius.sm }, // 선택된 일운(달력 탭)
  calDayToday: { color: colors.ju, fontWeight: '800' },
  calGz: { fontSize: 13, fontWeight: '700', marginTop: 1 },
  row: { flexDirection: 'row', gap: space(2) },
  pillarContainer: { flexDirection: 'row', gap: space(2), marginTop: space(2), marginBottom: space(4) },
  pillarWrapper: { flex: 1 },
  pillarGlass: { paddingVertical: space(3), paddingHorizontal: 0, alignItems: 'center' },
  pillarDayGlass: { borderColor: colors.ju, borderWidth: 1.5 },
  pillarPos: { ...font.caption, fontWeight: '700', color: colors.inkFaint, marginBottom: space(1.5) },
  pillarPosDay: { color: colors.ju },
  pillarMain: { alignItems: 'center', width: '100%', paddingVertical: space(0.5) },
  pillarChar: { fontSize: 26, fontWeight: '800', lineHeight: 32 },
  pillarTenGod: { fontSize: 10, fontWeight: '600' },
  pillarReading: { fontSize: 9, fontWeight: '400' },
  pillarIcon: { marginVertical: space(2) },
  advancedInfo: { width: '100%', alignItems: 'center' },
  pillarStage: { fontSize: 10, color: colors.inkSoft, fontWeight: '600', marginTop: space(1) },
  pillarHidden: { flexDirection: 'row', gap: 2, marginTop: space(1) },
  pillarHiddenChar: { fontSize: 11, fontWeight: '700' },
  pillarHiddenItem: { width: 15, height: 15, alignItems: 'center', justifyContent: 'center' }, // 지장간 1자 칸
  pillarHiddenRooted: { borderWidth: 1, borderColor: colors.ju, borderRadius: 8 }, // 투출(통근) = 동그라미
  headerArea: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space(4) },
  advancedBtn: { paddingHorizontal: space(2), paddingVertical: space(1), borderRadius: radius.sm, backgroundColor: colors.sunk },
  advancedBtnTx: { ...font.caption, color: colors.ju, fontWeight: '700' },
  linksToggleNew: { marginTop: space(4), borderRadius: radius.md, overflow: 'hidden', ...shadow.card },
  linksToggleGradient: { paddingVertical: space(3), alignItems: 'center' },
  linksToggleTx: { ...font.body, color: colors.ju, fontWeight: '700' },
  pillarDivider: { width: '70%', height: 1, backgroundColor: colors.line, marginVertical: space(1.5) },
  ptable: { display: 'none' }, // 기존 테이블 숨김
  kv: { ...font.body, color: colors.ink, marginTop: space(1.5), lineHeight: 21 },
  kvLabel: { color: colors.inkSoft, fontWeight: '700' },
  kvAccent: { color: colors.ju, fontWeight: '700' },
  warn: { ...font.caption, color: colors.ju, marginTop: space(2) },
  gaugeRow: { flexDirection: 'row', alignItems: 'center', gap: space(3), marginTop: space(1) },
  gaugeTrack: { flex: 1, height: 10, borderRadius: 5, backgroundColor: colors.sunk, overflow: 'hidden', justifyContent: 'center' },
  gaugeMid: { position: 'absolute', left: '50%', width: 1, height: 10, backgroundColor: colors.inkFaint }, // 중화(중앙) 기준선
  gaugeFill: { height: '100%', backgroundColor: colors.ju, borderRadius: 5 },
  gaugeText: { ...font.caption, color: colors.ink },
  strengthRow: { flexDirection: 'row', alignItems: 'center', gap: space(4), marginTop: space(2) },
  strengthInfo: { flex: 1, gap: space(1.5) },
  strDetailBtn: { marginTop: space(3), alignSelf: 'flex-start', paddingVertical: space(1) },
  strDetailBtnTx: { ...font.caption, color: colors.ju, fontWeight: '800' },
  strDetailCard: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: space(4), marginBottom: space(3) },
  strDetailMine: { borderColor: colors.ju, borderWidth: 1.5 },
  strDetailTitle: { ...font.body, color: colors.ink, fontWeight: '800', marginBottom: space(2) },
  strDetailLabel: { ...font.caption, color: colors.ju, fontWeight: '800', marginTop: space(2) },
  strDetailBody: { ...font.body, color: colors.inkSoft, lineHeight: 22, marginTop: space(0.5) },
  elemLegend: { flex: 1, gap: space(1) },
  elemLegendRow: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  elemDot: { width: 10, height: 10, borderRadius: 5 },
  elemLegendEl: { fontSize: 15, fontWeight: '800', width: 20 },
  elemLegendVal: { ...font.caption, color: colors.inkSoft },
  note: { ...font.caption, marginTop: space(6) },
  readingBtn: {
    backgroundColor: colors.ju, borderRadius: radius.md, paddingVertical: space(3.5),
    alignItems: 'center', marginTop: space(5), ...shadow.card,
  },
  readingBtnText: { color: colors.bg, fontSize: 15, fontWeight: '700' },
  // 클릭 설명 — 탭 가능 힌트(점선 밑줄) + 바텀시트
  tgSmallLink: { fontSize: 10, color: colors.inkSoft, marginVertical: space(0.5), textDecorationLine: 'none', textDecorationStyle: 'dotted' },
  ssTagLink: { fontSize: 10, color: colors.ju, fontWeight: '600', textAlign: 'center', textDecorationLine: 'none', textDecorationStyle: 'dotted' },
  linkText: { textDecorationLine: 'none', textDecorationStyle: 'dotted' },
  // 팔자 카드 — 12운성·지장간·12신살 (각 탭 가능, 점선밑줄 힌트)
  stageLink: { fontSize: 10, color: colors.inkSoft, fontWeight: '600', textDecorationLine: 'none', textDecorationStyle: 'dotted', marginTop: space(0.5) },
  hiddenRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 3, marginTop: space(0.5) },
  hiddenG: { fontSize: 11, fontWeight: '700', textDecorationLine: 'none', textDecorationStyle: 'dotted' },
  pillarSinsal: { alignItems: 'center', marginTop: space(1) },
  pillarSsTx: { fontSize: 9, color: colors.ju, fontWeight: '600', lineHeight: 13, textAlign: 'center', textDecorationLine: 'none', textDecorationStyle: 'dotted' },
  pillarSsBase: { fontSize: 7, color: colors.inkFaint, fontWeight: '400', textDecorationLine: 'none' },
  // 팔자 표 (행 라벨 + 칸 구분선 + 일주 강조)
  ptRow: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line, alignItems: 'stretch' },
  ptRowLast: { borderBottomWidth: 0 },
  ptLabel: { width: 34, ...font.caption, color: colors.inkSoft, fontWeight: '700', textAlign: 'center', alignSelf: 'center', paddingVertical: space(1) },
  ptCell: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: space(1.5), borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.line },
  ptCellDay: { backgroundColor: colors.juSoft },
  ptHead: { ...font.caption, color: colors.inkFaint, fontWeight: '700' },
  ptHeadDay: { color: colors.ju },
  ptTgLink: { fontSize: 11, color: colors.inkSoft, fontWeight: '600', textAlign: 'center', textDecorationLine: 'none', textDecorationStyle: 'dotted' },
  ptGz: { width: 40, height: 40, borderRadius: 6, alignItems: 'center', justifyContent: 'center', marginVertical: 1 },
  ptGzTx: { fontSize: 22, fontWeight: '800', lineHeight: 24 },
  ptGzKo: { fontSize: 9, fontWeight: '700', lineHeight: 10, opacity: 0.85 },
  ptHidWrap: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 2 },
  ptHid: { fontSize: 12, fontWeight: '700', textDecorationLine: 'none', textDecorationStyle: 'dotted' },
  ptHidRooted: { borderWidth: 1, borderColor: colors.ju, borderRadius: 9, paddingHorizontal: 3, paddingVertical: 0.5, textDecorationLine: 'none', overflow: 'hidden' }, // 투출(透出) 지장간 = 동그라미 강조
  ptStageLink: { fontSize: 11, color: colors.inkSoft, fontWeight: '600', textAlign: 'center', textDecorationLine: 'none', textDecorationStyle: 'dotted' },
  ptSsLink: { fontSize: 9, color: colors.ju, fontWeight: '600', lineHeight: 13, textAlign: 'center', textDecorationLine: 'none', textDecorationStyle: 'dotted' },
  ptSsBase: { fontSize: 7, color: colors.inkFaint, fontWeight: '400', textDecorationLine: 'none' },
  ptRoot: { fontSize: 11, fontWeight: '800' },
  // 자미두수 명반 (12궁 4×4)
  ziGrid: { marginTop: space(2), borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm },
  ziRow: { flexDirection: 'row' },
  ziCell: { flex: 1, minHeight: 76, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, padding: 3 },
  ziCenterCell: { flex: 1, minHeight: 76, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.sunk },
  ziCenterT: { fontSize: 9, color: colors.inkFaint },
  ziCenterV: { fontSize: 15, color: colors.ju, fontWeight: '800' },
  ziTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  ziName: { fontSize: 8, color: colors.inkFaint, fontWeight: '600' },
  ziBr: { fontSize: 13, fontWeight: '800' },
  ziMajor: { fontSize: 11, color: colors.ink, fontWeight: '700', marginTop: 1, lineHeight: 14 },
  ziBright: { fontSize: 8, color: colors.inkFaint, fontWeight: '400' },
  ziSihwa: { fontSize: 9, fontWeight: '800' },
  ziMinor: { fontSize: 8, color: colors.inkSoft, marginTop: 1, lineHeight: 12 },
  ziLink: { textDecorationLine: 'none', textDecorationStyle: 'dotted' }, // 탭 힌트
  // 합충형해 토글 카드 (기본 숨김 → 선 + 글자작용)
  linksToggle: { marginTop: space(2), paddingVertical: space(2.5), paddingHorizontal: space(3), borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, alignItems: 'center' },
  linksCard: { marginTop: space(1.5), padding: space(3), borderRadius: radius.sm, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  linkMini: { alignSelf: 'center', marginBottom: space(2) },
  linkMiniRow: { flexDirection: 'row' },
  linkMiniCol: { width: 56, alignItems: 'center' },
  linkList: { gap: space(1.5), borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, paddingTop: space(2.5) },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  linkDot: { fontSize: 10 },
  linkRowTx: { ...font.body, color: colors.ink, flex: 1 },
  linkLevel: { fontSize: 10, color: colors.inkFaint },
  // 종류별 그룹(팔자) + 강도순(대운세운)
  linkGroup: { marginBottom: space(2) },
  linkGroupHead: { ...font.caption, fontWeight: '800', marginBottom: space(1) },
  linkGRow: { paddingVertical: space(1), paddingLeft: space(2) },
  linkGTx: { ...font.body, color: colors.ink },
  strHint: { ...font.caption, color: colors.inkFaint, marginBottom: space(2) },
  strRow: { flexDirection: 'row', alignItems: 'center', gap: space(2), paddingVertical: space(1.5), paddingHorizontal: space(2), borderRadius: radius.sm },
  strRowTop: { backgroundColor: colors.sunk },
  strBadge: { fontSize: 11, fontWeight: '800', width: 22, height: 20, lineHeight: 18, textAlign: 'center', borderWidth: 1, borderRadius: 4 },
  linkGRowOn: { backgroundColor: colors.juSoft, borderRadius: radius.sm },          // 켜진 합충 행
  ptCellHL: { backgroundColor: 'rgba(201,161,74,0.30)' },                            // 명식 강조 셀
  expCol2On: { backgroundColor: 'rgba(201,161,74,0.30)', borderRadius: radius.sm },  // 확장명식 강조 컬럼
  // 대표 오행·십성 칩
  repRow: { flexDirection: 'row', gap: space(2), marginTop: space(3) },
  repChip: { flex: 1, paddingVertical: space(2.5), paddingHorizontal: space(2), borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, alignItems: 'center' },
  repLabel: { ...font.caption, color: colors.inkFaint },
  repVal: { fontSize: 18, fontWeight: '800', marginTop: 2, textDecorationLine: 'none', textDecorationStyle: 'dotted' },
  repValTg: { fontSize: 15, fontWeight: '800', color: colors.ju, marginTop: 2, textDecorationLine: 'none', textDecorationStyle: 'dotted' },
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.card, borderTopLeftRadius: radius.md, borderTopRightRadius: radius.md, padding: space(5), paddingBottom: space(9) },
  sheetHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.line, marginBottom: space(3) },
  sheetKind: { ...font.caption, color: colors.ju, fontWeight: '700', marginBottom: space(1) },
  sheetTitle: { ...font.heading, color: colors.ink, marginBottom: space(2.5) },
  sheetMeaning: { ...font.body, color: colors.ink, lineHeight: 24 },
  sheetChips: { flexDirection: 'row', flexWrap: 'wrap', gap: space(1.5), marginTop: space(3.5) },
  sheetChip: { ...font.caption, color: colors.ink, backgroundColor: colors.sunk, paddingHorizontal: space(2.5), paddingVertical: space(1), borderRadius: radius.pill, overflow: 'hidden' },
  sheetClose: { marginTop: space(4), alignItems: 'center', paddingVertical: space(2.5), borderRadius: radius.sm, backgroundColor: colors.sunk },
  sheetCloseText: { ...font.body, color: colors.inkSoft, fontWeight: '700' },
});
