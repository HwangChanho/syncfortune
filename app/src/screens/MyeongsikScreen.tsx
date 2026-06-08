// app/src/screens/MyeongsikScreen.tsx — 명식·성반 표시 (미드나잇 테마, glass-box, 다국어)
// ─────────────────────────────────────────────────────────────────────────
// 온디바이스 결정론 명식을 날것으로 보여줌(태그 압축 X — 기획서 §9). 무료 신뢰 훅.
// ★ 전통 사주 표기: 오른쪽이 년주 — 표시 순서 시·일·월·년(왼→오) = 오른쪽 년.
// ★ 디테일: 각 기둥 = 천간십신·천간·지지·지지십신·12운성·지장간·통근(PillarData 전부).
//   하단 = 지장간 상세(stem+십신)·대운/세운·합충·신살·자미두수.
// 시각 미상(timeAccuracy '미상') = 시주 ✕ + 시주 의존 항목 제외(시각 모르면 시주 불가).
// 일주(日柱) = '나'(일간) → 골드 강조. 용신·통변은 별도(하단 "풀이 보기").
// ─────────────────────────────────────────────────────────────────────────
import { useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Modal } from 'react-native';
import { useTranslation } from 'react-i18next';
import { computeChart } from '../lib/engine';
import type { ChartInput, PillarPos } from '@spec/chart';
import { colors, radius, space, shadow, font } from '../lib/theme';
import { stemElement, branchElement, elementColor, elementText, stemReading, branchReading } from '../lib/ohaeng';
import { HIDDEN, computeMonthDays, branchTenGod } from '@engine/saju'; // 지장간 표 + 일운(流日) + 지지십신
import { twelveStage } from '@engine/twelve';                          // 임의 지지 12운성(타임라인용)
import { lookupGlossary, GLOSSARY_KIND_LABEL, type GlossaryKind } from '../lib/myeongriGlossary'; // 클릭 설명
import Svg, { Path, Rect, Circle, Text as SvgText, G } from 'react-native-svg';

// 전통 표기 — 오른쪽이 년주: 시(왼) ← 일 ← 월 ← 년(오른쪽)
const POS: PillarPos[] = ['시', '일', '월', '년'];

// 간지 한 칸(오행색 배경 + 한자 + 한글음) — 대운·세운·월운 타임라인/확장명식 공용. sm=대운/원국, xs=세운/월운.
function GzCell({ char, kind, size }: { char: string; kind: 'stem' | 'branch'; size: 'sm' | 'xs' }) {
  const el = kind === 'stem' ? stemElement(char) : branchElement(char);
  const ko = kind === 'stem' ? stemReading(char) : branchReading(char);
  const txt = { color: elementText[el] };
  return (
    <View style={[size === 'sm' ? styles.gzCellSm : styles.gzCellXs, { backgroundColor: elementColor[el] }]}>
      <Text style={[size === 'sm' ? styles.gzTextSm : styles.gzTextXs, txt]}>{char}</Text>
      <Text style={[styles.gzKo, txt]}>{ko}</Text>
    </View>
  );
}

export function MyeongsikScreen({ input, onReading }: { input: ChartInput | null; onReading?: () => void }) {
  const { t } = useTranslation();
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
  // 합충형해 선 (원국 — members 2개 기둥, 둘 다 표시 중)
  const [rowW, setRowW] = useState(0);
  const luckCycles: any[] = (c.saju as any).luckCycles ?? [];          // 전체 대운(과거~미래)
  const curLuckIdx = Math.max(0, luckCycles.findIndex((l) => l.isCurrent));
  const [selLuck, setSelLuck] = useState(curLuckIdx);                  // 선택된 대운 → 세운 드릴다운
  const [selSeun, setSelSeun] = useState(0);                          // 선택된 세운 → 원국 확장 명식
  const [selMonth, setSelMonth] = useState(0);                        // 선택된 월운 → 확장 명식
  const [glossary, setGlossary] = useState<{ kind: GlossaryKind; key?: string } | null>(null); // 클릭 설명 바텀시트
  const posIndex: Record<string, number> = { 시: 0, 일: 1, 월: 2, 년: 3 };
  const allLinks = (c.saju.interactions as any[]).filter(
    (it) => it.members?.length === 2 && it.members.every((m: string) => posIndex[m] != null && visiblePos.includes(m as any))
  );
  const ganLinks = allLinks.filter((it: any) => it.level === '천간'); // 천간 합·충(극) — 팔자 위(점선)
  const jiLinks = allLinks.filter((it: any) => it.level !== '천간');  // 지지 합·충·형·해·파 — 팔자 아래(실선)
  // 합충선 라벨: 합이면 '합+합화오행'을 그 오행 색으로(=어떤 기운이 강해지는지), 그 외는 종류만.
  const linkLabel = (it: any) => (it.type === '합' ? `${t('myeongsik.합')}${it.transformsTo ?? ''}` : t(`myeongsik.${it.type}`));
  const linkColor = (it: any) =>
    it.type === '합' ? colors.ju
    : (it.type === '충' || it.type === '극') ? '#C0392B' : '#9A8CC0';

  return (
    <>
    <ScrollView style={styles.screen} contentContainerStyle={styles.wrap}>
      {/* 팔자 4기둥 (오른쪽=년주) */}
      <Text style={styles.h}>{t('myeongsik.palja')}</Text>
      <Text style={styles.hint}>{t('myeongsik.paljaHint')}</Text>
      {/* 천간 합·충(극) 호 — 팔자 위, 위로 볼록·점선. 인덱스별 깊이 분산으로 겹침 방지 */}
      {rowW > 0 && ganLinks.length > 0 && (() => {
        const colW = rowW / 4;
        const STEP = 20;
        const H = ganLinks.length * STEP + 14;
        // 좌표 사전계산: ㄷ자(⊔)별 좌우 오프셋(겹쳐 한 줄 되는 것 방지) + 라벨
        const items = ganLinks.map((it, i) => {
          const a = posIndex[it.members[0]], b = posIndex[it.members[1]];
          const off = (i - (ganLinks.length - 1) / 2) * 5;
          const xa = colW * (a + 0.5) + off, xb = colW * (b + 0.5) + off;
          const legY = H - (8 + i * STEP);
          const lbl = linkLabel(it);
          return { xa, xb, mid: (xa + xb) / 2, legY, col: linkColor(it), lbl, lw: lbl.length * 11 + 6 };
        });
        return (
          <Svg width={rowW} height={H} style={{ marginBottom: space(0.5) }}>
            {/* 1패스: 선 전부 (두 천간 칸에서 위로 다리 → 수평, 점선) */}
            {items.map((o, i) => (
              <G key={`p${i}`}>
                <Path d={`M ${o.xa} ${H} L ${o.xa} ${o.legY} L ${o.mid - o.lw / 2} ${o.legY}`} stroke={o.col} strokeWidth={1.5} fill="none" strokeDasharray="3 2" />
                <Path d={`M ${o.mid + o.lw / 2} ${o.legY} L ${o.xb} ${o.legY} L ${o.xb} ${H}`} stroke={o.col} strokeWidth={1.5} fill="none" strokeDasharray="3 2" />
              </G>
            ))}
            {/* 2패스: 라벨 전부 (모든 선 위에 그려 가림 방지) */}
            {items.map((o, i) => (
              <G key={`l${i}`}>
                <Rect x={o.mid - o.lw / 2} y={o.legY - 7} width={o.lw} height={15} fill={colors.bg} rx={2} />
                <SvgText x={o.mid} y={o.legY + 3} fill={o.col} fontSize={9} fontWeight="700" textAnchor="middle">{o.lbl}</SvgText>
              </G>
            ))}
          </Svg>
        );
      })()}
      <View style={styles.row} onLayout={(e) => setRowW(e.nativeEvent.layout.width)}>
        {POS.map((p) => {
          const d = P[p];
          const masked = p === '시' && timeUnknown;
          const isDay = p === '일';
          return (
            <View key={p} style={[styles.pillar, isDay && styles.pillarDay, masked && styles.pillarMasked]}>
              <Text style={[styles.pos, isDay && styles.posDay]}>{p}</Text>
              {masked ? (
                <><Text style={styles.gzMasked}>✕</Text><Text style={styles.maskedLabel}>{t('register.timeUnknown')}</Text></>
              ) : (
                <>
                  <Pressable onPress={() => setGlossary({ kind: 'tengod', key: d.stemTenGod })}><Text style={styles.tgSmallLink}>{d.stemTenGod}</Text></Pressable>
                  <View style={[styles.gzCell, { backgroundColor: elementColor[stemElement(d.stem)] }]}>
                    <Text style={[styles.gzText, { color: elementText[stemElement(d.stem)] }]}>{d.stem}</Text>
                  </View>
                  <View style={[styles.gzCell, { backgroundColor: elementColor[branchElement(d.branch)] }]}>
                    <Text style={[styles.gzText, { color: elementText[branchElement(d.branch)] }]}>{d.branch}</Text>
                  </View>
                  <Pressable onPress={() => setGlossary({ kind: 'tengod', key: d.branchMainTenGod })}><Text style={styles.tgSmallLink}>{d.branchMainTenGod}</Text></Pressable>
                  <View style={styles.pillarDivider} />
                  {/* 12운성 (탭→의미) */}
                  <Pressable onPress={() => setGlossary({ kind: 'stage', key: c.stages[p] })}>
                    <Text style={styles.stageLink}>{c.stages[p]}</Text>
                  </Pressable>
                  {/* 지장간 (각 글자 탭→그 십신 의미, 오행색) */}
                  <View style={styles.hiddenRow}>
                    {d.hiddenStems.map((h, i) => (
                      <Pressable key={i} onPress={() => setGlossary({ kind: 'tengod', key: h.tenGod })}>
                        <Text style={[styles.hiddenG, { color: elementColor[stemElement(h.stem)] }]}>{h.stem}</Text>
                      </Pressable>
                    ))}
                  </View>
                  {/* 12신살 (4기준 전부, 각 탭→의미) */}
                  <View style={styles.pillarSinsal}>
                    {c.sinsal.twelve[p]
                      .map((tw) => ({ name: tw.name, bases: tw.bases.filter((b) => visiblePos.includes(b)) }))
                      .filter((tw) => tw.bases.length > 0)
                      .map((tw, i) => (
                        <Pressable key={i} onPress={() => setGlossary({ kind: 'sinsal', key: tw.name })}>
                          <Text style={styles.pillarSsTx}>{tw.name}<Text style={styles.pillarSsBase}> {tw.bases.join('')}</Text></Text>
                        </Pressable>
                      ))}
                  </View>
                  {(() => {
                    const r = rootsOf(p); // 이 지지에 통근한 천간 (일간=골드 강조, 투간=오행색)
                    if (!r.length) return null;
                    return (
                      <View style={styles.rootBadgeRow}>
                        {r.map((s, i) => (
                          <Text key={i} style={[styles.rootStem, { color: s === P['일'].stem ? colors.ju : elementColor[stemElement(s)] }]}>{s}</Text>
                        ))}
                        <Text style={styles.rootSuffix}>根</Text>
                      </View>
                    );
                  })()}
                </>
              )}
            </View>
          );
        })}
      </View>

      {/* 지지 합·충·형·해·파 호 — 팔자 아래, 아래로 볼록·실선. 인덱스별 깊이 분산으로 겹침 방지 */}
      {rowW > 0 && jiLinks.length > 0 && (() => {
        const colW = rowW / 4;
        const STEP = 20;
        const H = jiLinks.length * STEP + 14;
        const items = jiLinks.map((it, i) => {
          const a = posIndex[it.members[0]], b = posIndex[it.members[1]];
          const off = (i - (jiLinks.length - 1) / 2) * 5;
          const xa = colW * (a + 0.5) + off, xb = colW * (b + 0.5) + off;
          const legY = 8 + i * STEP;
          const lbl = linkLabel(it);
          return { xa, xb, mid: (xa + xb) / 2, legY, col: linkColor(it), lbl, lw: lbl.length * 11 + 6 };
        });
        return (
          <Svg width={rowW} height={H} style={{ marginTop: space(1) }}>
            {/* 1패스: 선 전부 (두 지지 칸에서 아래로 다리 → 수평, 실선) */}
            {items.map((o, i) => (
              <G key={`p${i}`}>
                <Path d={`M ${o.xa} 0 L ${o.xa} ${o.legY} L ${o.mid - o.lw / 2} ${o.legY}`} stroke={o.col} strokeWidth={1.5} fill="none" />
                <Path d={`M ${o.mid + o.lw / 2} ${o.legY} L ${o.xb} ${o.legY} L ${o.xb} 0`} stroke={o.col} strokeWidth={1.5} fill="none" />
              </G>
            ))}
            {/* 2패스: 라벨 전부 (모든 선 위에 그려 가림 방지) */}
            {items.map((o, i) => (
              <G key={`l${i}`}>
                <Rect x={o.mid - o.lw / 2} y={o.legY - 7} width={o.lw} height={15} fill={colors.bg} rx={2} />
                <SvgText x={o.mid} y={o.legY + 3} fill={o.col} fontSize={9} fontWeight="700" textAnchor="middle">{o.lbl}</SvgText>
              </G>
            ))}
          </Svg>
        );
      })()}

      {/* 일간·신강약·격국 */}
      <Text style={styles.kv}>{t('myeongsik.dayMaster')}: <Text style={styles.kvAccent}>{c.saju.dayMaster.stem}({c.saju.dayMaster.element})</Text></Text>
      <Text style={styles.kv}>{t('myeongsik.dayMaster')} {c.saju.dayMaster.stem}  ·  {t('myeongsik.pattern')}: {c.pattern.candidates.join(', ')}</Text>
      {timeUnknown && <Text style={styles.warn}>{t('myeongsik.timeUnknownNote')}</Text>}

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

      {/* 지장간 상세 (각 주 stem + 십신) */}
      <Text style={styles.h}>{t('myeongsik.hidden')}</Text>
      {visiblePos.map((p) => {
        const d = P[p];
        return (
          <Text key={p} style={styles.kv}>
            <Text style={styles.kvLabel}>{p}주 {d.branch}</Text>  {d.hiddenStems.map((h) => `${h.stem}(${h.tenGod})`).join(' · ')}
          </Text>
        );
      })}

      {/* 대운·세운 타임라인 (원국·지장간 바로 아래) — 대운 탭 → 세운(과거~100세) → 월운 드릴다운 */}
      {luckCycles.length > 0 && (() => {
        const lc = luckCycles[selLuck];
        const an = lc?.annuals?.[selSeun];
        const mo = an?.months?.[selMonth];
        // 원국(시일월년) + 선택 대운 + 선택 세운 + 선택 월운 = 확장 명식 컬럼
        const expandCols = [
          ...visiblePos.map((p) => ({ label: `${p}주`, stem: P[p].stem, branch: P[p].branch, tg: P[p].stemTenGod, luck: false, hidden: HIDDEN[P[p].branch] ?? [] })),
          ...(lc ? [{ label: '대운', stem: lc.stem, branch: lc.branch, tg: lc.stemTenGod, luck: true, hidden: HIDDEN[lc.branch as keyof typeof HIDDEN] ?? [] }] : []),
          ...(an ? [{ label: '세운', stem: an.stem, branch: an.branch, tg: an.stemTenGod, luck: true, hidden: HIDDEN[an.branch as keyof typeof HIDDEN] ?? [] }] : []),
          ...(mo ? [{ label: `${selMonth + 1}월`, stem: mo.stem, branch: mo.branch, tg: mo.stemTenGod, luck: true, hidden: HIDDEN[mo.branch as keyof typeof HIDDEN] ?? [] }] : []),
        ];
        return (
        <>
          <Text style={styles.h}>{t('myeongsik.luck')}</Text>
          {/* 원국 + 대운·세운 확장 명식 (천간/지지 분리, 나란히) */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.luckScroll} contentContainerStyle={styles.luckScrollC}>
            {expandCols.map((col, i) => (
              <View key={i} style={[styles.expCol, col.luck && styles.expColLuck]}>
                <Text style={styles.expLabel}>{col.label}</Text>
                <Text style={styles.expTg}>{col.tg}</Text>
                <GzCell char={col.stem} kind="stem" size="sm" />
                <GzCell char={col.branch} kind="branch" size="sm" />
                <Text style={styles.expTg}>{branchTenGod(dm, col.branch)}</Text>
                <Text style={styles.expStage}>{twelveStage(dm, col.branch)}</Text>
                <View style={styles.expHidden}>
                  {col.hidden.map((h: any, k: number) => (
                    <Text key={k} style={[styles.expHiddenTx, { color: elementColor[stemElement(h.stem)] }]}>{h.stem}</Text>
                  ))}
                </View>
              </View>
            ))}
          </ScrollView>
          {/* 대운 타임라인 (천간/지지 분리, 탭 → 확장 명식·세운 갱신) */}
          <Text style={styles.luckSub}>대운 (탭하면 그 대운의 세운 펼침)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.luckScroll} contentContainerStyle={styles.luckScrollC}>
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
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.luckScroll} contentContainerStyle={styles.luckScrollC}>
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
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.luckScroll} contentContainerStyle={styles.luckScrollC}>
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
          {/* 월운 탭 → 그 달 일진(日辰) 달력 — 날짜별 일운 간지 */}
          {input && an?.months?.[selMonth] && (() => {
            const days = computeMonthDays(input, an.year, selMonth + 1);
            const firstDow = new Date(an.year, selMonth, 1).getDay(); // 1일 요일(0=일)
            return (
              <>
                <Text style={styles.luckSub}>{an.year}년 {selMonth + 1}월 일진 달력</Text>
                <View style={styles.calGrid}>
                  {['일', '월', '화', '수', '목', '금', '토'].map((w) => (
                    <Text key={w} style={styles.calHead}>{w}</Text>
                  ))}
                  {Array.from({ length: firstDow }).map((_, i) => <View key={`e${i}`} style={styles.calCell} />)}
                  {days.map((dd) => (
                    <View key={dd.day} style={styles.calCell}>
                      <Text style={styles.calDay}>{dd.day}</Text>
                      <Text style={[styles.calGz, { color: elementColor[stemElement(dd.stem)] }]}>{dd.stem}{dd.branch}</Text>
                    </View>
                  ))}
                </View>
              </>
            );
          })()}
        </>
        );
      })()}

      {/* 12운성 (전 기둥) */}
      <Text style={styles.h}>{t('myeongsik.stages')}</Text>
      <Text style={styles.kv}>{visiblePos.map((p) => `${p}${c.stages[p]}`).join('  ·  ')}</Text>

      {/* 합충형해 */}
      <Text style={styles.h}>{t('myeongsik.interactions')}</Text>
      <Text style={styles.kv}>{c.saju.interactions.map((i) => i.detail).join(', ') || t('common.none')}</Text>

      {/* 신살·공망 — 기준글자가 원국에 있으면 ✓(자리), 없으면 운에서 작동 */}
      <Text style={styles.h}>{t('myeongsik.sinsal')}</Text>
      <Text style={styles.hint}>{t('myeongsik.sinsalHint')}</Text>
      {/* 자리(기둥)별 신살 표 — 행=천간/지지, 열=시·일·월·년 (카톡 만세력 표 형식) */}
      {(() => {
        // 길신·기타 신살(천을·문창·양인·홍염)은 지지 행, 간지 신살(백호·괴강)은 천간 행, 12신살은 별도 행.
        const sideTags = (p: PillarPos, side: 'stem' | 'branch') =>
          c.sinsal.sinsal
            .filter((s2) => s2.hits.some((h) => h.pos === p && h.side === side))
            .map((s2) => ({ name: s2.name, label: t(`sinsal.${s2.name}`, { defaultValue: s2.name }) }));
        const branchTags = (p: PillarPos) => sideTags(p, 'branch');
        const stemTags = (p: PillarPos) => {
          const tags = sideTags(p, 'stem');
          if (c.sinsal.baekhoHits.includes(p)) tags.push({ name: '백호', label: t('sinsal.백호', { defaultValue: '백호' }) });
          if (c.sinsal.goegang && p === '일') tags.push({ name: '괴강', label: t('sinsal.괴강', { defaultValue: '괴강' }) });
          return tags;
        };
        // 원국에 적중하지 못한 신살(운에서 작동) — 표에 안 뜨므로 하단에 보존
        const hitNames = new Set(
          c.sinsal.sinsal.filter((s2) => s2.hits.some((h) => visiblePos.includes(h.pos))).map((s2) => s2.name),
        );
        const luckOnly = c.sinsal.sinsal
          .filter((s2) => !hitNames.has(s2.name))
          .map((s2) => `${t(`sinsal.${s2.name}`, { defaultValue: s2.name })}(${s2.glyphs.join('')})`);
        const renderRow = (label: string, kind: 'stem' | 'branch') => (
          <View style={styles.ssTableRow}>
            <Text style={styles.ssRowLabel}>{label}</Text>
            {visiblePos.map((p) => {
              const ch = kind === 'stem' ? P[p].stem : P[p].branch;
              const el = kind === 'stem' ? stemElement(ch) : branchElement(ch);
              const tags = kind === 'stem' ? stemTags(p) : branchTags(p);
              return (
                <View key={p} style={styles.ssCell}>
                  <Text style={[styles.ssCellGz, { color: elementColor[el] }]}>{ch}</Text>
                  {tags.length
                    ? tags.map((tg, i) => (
                        <Pressable key={i} onPress={() => setGlossary({ kind: 'sinsal', key: tg.name })}>
                          <Text style={styles.ssTagLink}>{tg.label}</Text>
                        </Pressable>
                      ))
                    : <Text style={styles.ssDim}>—</Text>}
                </View>
              );
            })}
          </View>
        );
        return (
          <>
            <View style={styles.ssTable}>
              <View style={styles.ssTableRow}>
                <Text style={styles.ssRowLabel} />
                {visiblePos.map((p) => <Text key={p} style={styles.ssColHead}>{p}주</Text>)}
              </View>
              {renderRow('천간', 'stem')}
              {renderRow('지지', 'branch')}
            </View>
            {/* 공망: 기준 2지지(오행색) + 원국 적중 자리 */}
            <View style={styles.ssGmRow}>
              <Pressable onPress={() => setGlossary({ kind: 'gongmang' })}><Text style={[styles.ssName, styles.linkText]}>{t('myeongsik.gongmang')}</Text></Pressable>
              <View style={styles.ssBranches}>
                {c.sinsal.gongmang.map((b) => (
                  <Text key={b} style={[styles.ssBranch, { color: elementColor[branchElement(b)] }]}>{b}</Text>
                ))}
              </View>
              {(() => {
                const gh = c.sinsal.gongmangHits.filter((p) => visiblePos.includes(p));
                return <Text style={gh.length ? styles.ssHit : styles.ssDim}>{gh.length ? `${gh.map((p) => `${p}주`).join('·')} ✓` : t('myeongsik.ssLuck')}</Text>;
              })()}
            </View>
            {luckOnly.length > 0 && (
              <Text style={styles.ssLuckLine}>{t('myeongsik.ssLuck')}: {luckOnly.join(' · ')}</Text>
            )}
          </>
        );
      })()}

      {/* 자미두수(보조) */}
      <Text style={styles.h}>{t('myeongsik.ziwei')}</Text>
      <Text style={styles.kv}>{c.ziwei.bureau} · {t('myeongsik.lifePalace')} {c.ziwei.lifePalaceBranch}</Text>

      <Text style={styles.note}>{t('myeongsik.note')}</Text>

      {onReading && (
        <Pressable style={styles.readingBtn} onPress={onReading}>
          <Text style={styles.readingBtnText}>{t('myeongsik.readingBtn')}</Text>
        </Pressable>
      )}
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
    </>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.bg },
  wrap: { padding: space(5), paddingBottom: space(10) },
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
  ssCellGz: { fontSize: 20, fontWeight: '800' },
  ssTag: { fontSize: 10, color: colors.ju, fontWeight: '600', textAlign: 'center' },
  ssGmRow: { flexDirection: 'row', alignItems: 'center', gap: space(2), marginTop: space(2.5) },
  ssLuckLine: { ...font.caption, color: colors.inkFaint, marginTop: space(2), lineHeight: 18 },
  ss12Tag: { fontSize: 11, color: colors.ink, fontWeight: '700', textAlign: 'center', textDecorationLine: 'underline', textDecorationStyle: 'dotted' },
  ss12Base: { fontSize: 8, color: colors.inkFaint, fontWeight: '400' },
  rootBadgeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2, flexWrap: 'wrap', justifyContent: 'center' },
  rootStem: { fontSize: 10, fontWeight: '800' },
  rootSuffix: { fontSize: 9, color: colors.inkFaint, marginLeft: 1 },
  luckScroll: { marginTop: space(2) },
  luckScrollC: { gap: space(1.5), paddingRight: space(2) },
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
  expColLuck: { backgroundColor: colors.juSoft, borderRadius: radius.sm },
  expLabel: { fontSize: 11, color: colors.inkFaint, marginBottom: 2, fontWeight: '600' },
  expTg: { fontSize: 11, color: colors.inkSoft, marginBottom: 2, fontWeight: '600' },
  expStage: { fontSize: 10, color: colors.inkFaint, fontWeight: '600', marginTop: 1 },   // 12운성
  expHidden: { alignItems: 'center', marginTop: 4 },
  expHiddenTx: { fontSize: 12, fontWeight: '700', lineHeight: 15 },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: space(2) },
  calHead: { width: '14.28%', textAlign: 'center', fontSize: 10, color: colors.inkFaint, paddingVertical: 3 },
  calCell: { width: '14.28%', alignItems: 'center', paddingVertical: space(1) },
  calDay: { fontSize: 10, color: colors.inkSoft },
  calGz: { fontSize: 13, fontWeight: '700', marginTop: 1 },
  row: { flexDirection: 'row', gap: space(2) },
  pillar: {
    flex: 1, alignItems: 'center', backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm,
    paddingVertical: space(2.5), paddingHorizontal: space(1),
  },
  pillarDay: { borderColor: colors.ju, borderWidth: 1.5, ...shadow.card }, // 일주 = '나'
  pillarMasked: { backgroundColor: colors.sunk, borderColor: colors.line },
  pos: { ...font.caption, color: colors.inkSoft, marginBottom: space(1), fontWeight: '700' },
  posDay: { color: colors.ju },
  tgSmall: { fontSize: 10, color: colors.inkSoft, marginVertical: space(0.5) },
  gzCell: { width: '88%', aspectRatio: 1.5, borderRadius: 5, alignItems: 'center', justifyContent: 'center', marginVertical: space(0.5) },
  gzText: { fontSize: 24, fontWeight: '800' },
  gzMasked: { fontSize: 26, fontWeight: '700', color: colors.inkFaint, lineHeight: 32 },
  maskedLabel: { ...font.caption, marginTop: space(1) },
  pillarDivider: { width: '70%', height: 1, backgroundColor: colors.line, marginVertical: space(1.5) },
  stage: { fontSize: 10, color: colors.inkSoft, fontWeight: '600' },
  hidden: { fontSize: 9, color: colors.inkFaint, marginTop: space(0.5), letterSpacing: 1 },
  rootBadge: {
    fontSize: 9, color: colors.bg, backgroundColor: colors.ju, fontWeight: '700',
    paddingHorizontal: space(1.5), paddingVertical: 1, borderRadius: radius.pill, marginTop: space(1),
    overflow: 'hidden',
  },
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
  tgSmallLink: { fontSize: 10, color: colors.inkSoft, marginVertical: space(0.5), textDecorationLine: 'underline', textDecorationStyle: 'dotted' },
  ssTagLink: { fontSize: 10, color: colors.ju, fontWeight: '600', textAlign: 'center', textDecorationLine: 'underline', textDecorationStyle: 'dotted' },
  linkText: { textDecorationLine: 'underline', textDecorationStyle: 'dotted' },
  // 팔자 카드 — 12운성·지장간·12신살 (각 탭 가능, 점선밑줄 힌트)
  stageLink: { fontSize: 10, color: colors.inkSoft, fontWeight: '600', textDecorationLine: 'underline', textDecorationStyle: 'dotted', marginTop: space(0.5) },
  hiddenRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 3, marginTop: space(0.5) },
  hiddenG: { fontSize: 11, fontWeight: '700', textDecorationLine: 'underline', textDecorationStyle: 'dotted' },
  pillarSinsal: { alignItems: 'center', marginTop: space(1) },
  pillarSsTx: { fontSize: 9, color: colors.ju, fontWeight: '600', lineHeight: 13, textAlign: 'center', textDecorationLine: 'underline', textDecorationStyle: 'dotted' },
  pillarSsBase: { fontSize: 7, color: colors.inkFaint, fontWeight: '400', textDecorationLine: 'none' },
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
