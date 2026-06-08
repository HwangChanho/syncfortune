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
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { computeChart } from '../lib/engine';
import type { ChartInput, PillarPos } from '@spec/chart';
import { colors, radius, space, shadow, font } from '../lib/theme';
import { stemElement, branchElement, elementColor, elementText } from '../lib/ohaeng';
import { HIDDEN, computeMonthDays } from '@engine/saju';   // 지장간 표 + 일운(流日) 생성
import Svg, { Path, Rect, Circle, Text as SvgText, G } from 'react-native-svg';

// 전통 표기 — 오른쪽이 년주: 시(왼) ← 일 ← 월 ← 년(오른쪽)
const POS: PillarPos[] = ['시', '일', '월', '년'];

export function MyeongsikScreen({ input, onReading }: { input: ChartInput | null; onReading?: () => void }) {
  const { t } = useTranslation();
  const c = useMemo(() => (input ? computeChart(input) : null), [input]);
  if (!c) return <View style={styles.center}><Text style={font.body}>{t('myeongsik.noChart')}</Text></View>;

  const timeUnknown = input?.timeAccuracy === '미상'; // 시각 모름 → 시주 마스킹
  const P = c.saju.pillars;
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
  const maxElem = Math.max(...Object.values(elem), 1);
  // 합충형해 선 (원국 — members 2개 기둥, 둘 다 표시 중)
  const [rowW, setRowW] = useState(0);
  const luckCycles: any[] = (c.saju as any).luckCycles ?? [];          // 전체 대운(과거~미래)
  const curLuckIdx = Math.max(0, luckCycles.findIndex((l) => l.isCurrent));
  const [selLuck, setSelLuck] = useState(curLuckIdx);                  // 선택된 대운 → 세운 드릴다운
  const [selSeun, setSelSeun] = useState(0);                          // 선택된 세운 → 원국 확장 명식
  const [selMonth, setSelMonth] = useState(0);                        // 선택된 월운 → 확장 명식
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
                  <Text style={styles.tgSmall}>{d.stemTenGod}</Text>
                  <View style={[styles.gzCell, { backgroundColor: elementColor[stemElement(d.stem)] }]}>
                    <Text style={[styles.gzText, { color: elementText[stemElement(d.stem)] }]}>{d.stem}</Text>
                  </View>
                  <View style={[styles.gzCell, { backgroundColor: elementColor[branchElement(d.branch)] }]}>
                    <Text style={[styles.gzText, { color: elementText[branchElement(d.branch)] }]}>{d.branch}</Text>
                  </View>
                  <Text style={styles.tgSmall}>{d.branchMainTenGod}</Text>
                  <View style={styles.pillarDivider} />
                  <Text style={styles.stage}>{c.stages[p]}</Text>
                  <Text style={styles.hidden}>{d.hiddenStems.map((h) => h.stem).join(' ')}</Text>
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

      {/* 오행 분포 (오행색 막대) */}
      <Text style={styles.h}>{t('myeongsik.elements')}</Text>
      {(['木', '火', '土', '金', '水'] as const).map((el) => (
        <View key={el} style={styles.elemRow}>
          <Text style={[styles.elemLabel, { color: elementColor[el] }]}>{el}</Text>
          <View style={styles.elemTrack}>
            <View style={[styles.elemFill, { width: `${(elem[el] / maxElem) * 100}%`, backgroundColor: elementColor[el] }]} />
          </View>
          <Text style={styles.elemCount}>{elem[el]}</Text>
        </View>
      ))}

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
                <View style={[styles.gzCellSm, { backgroundColor: elementColor[stemElement(col.stem)] }]}><Text style={[styles.gzTextSm, { color: elementText[stemElement(col.stem)] }]}>{col.stem}</Text></View>
                <View style={[styles.gzCellSm, { backgroundColor: elementColor[branchElement(col.branch)] }]}><Text style={[styles.gzTextSm, { color: elementText[branchElement(col.branch)] }]}>{col.branch}</Text></View>
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
                <View style={[styles.gzCellSm, { backgroundColor: elementColor[stemElement(l.stem)] }]}><Text style={[styles.gzTextSm, { color: elementText[stemElement(l.stem)] }]}>{l.stem}</Text></View>
                <View style={[styles.gzCellSm, { backgroundColor: elementColor[branchElement(l.branch)] }]}><Text style={[styles.gzTextSm, { color: elementText[branchElement(l.branch)] }]}>{l.branch}</Text></View>
                <Text style={styles.luckTg}>{l.stemTenGod}</Text>
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
                    <View style={[styles.gzCellXs, { backgroundColor: elementColor[stemElement(a.stem)] }]}><Text style={[styles.gzTextXs, { color: elementText[stemElement(a.stem)] }]}>{a.stem}</Text></View>
                    <View style={[styles.gzCellXs, { backgroundColor: elementColor[branchElement(a.branch)] }]}><Text style={[styles.gzTextXs, { color: elementText[branchElement(a.branch)] }]}>{a.branch}</Text></View>
                    <Text style={styles.seunTg}>{a.stemTenGod}</Text>
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
                    <View style={[styles.gzCellXs, { backgroundColor: elementColor[stemElement(m.stem)] }]}><Text style={[styles.gzTextXs, { color: elementText[stemElement(m.stem)] }]}>{m.stem}</Text></View>
                    <View style={[styles.gzCellXs, { backgroundColor: elementColor[branchElement(m.branch)] }]}><Text style={[styles.gzTextXs, { color: elementText[branchElement(m.branch)] }]}>{m.branch}</Text></View>
                    <Text style={styles.seunTg}>{m.stemTenGod}</Text>
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
      {/* 공망: 기준 2지지(오행색) + 원국 적중 자리 */}
      <View style={styles.ssRow}>
        <Text style={styles.ssName}>{t('myeongsik.gongmang')}</Text>
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
      {/* 신살 리스트: 신살명 + 기준글자(오행색) + 적중 ✓ / 운 */}
      {c.sinsal.sinsal.map((s2, i) => {
        const hits = s2.hits.filter((p) => visiblePos.includes(p));
        const on = hits.length > 0;
        return (
          <View key={`${s2.name}-${s2.branch}-${i}`} style={styles.ssRow}>
            <Text style={styles.ssName}>{t(`sinsal.${s2.name}`)}</Text>
            <Text style={[styles.ssBranch, { color: elementColor[branchElement(s2.branch)] }]}>{s2.branch}</Text>
            <Text style={on ? styles.ssHit : styles.ssDim}>
              {on ? `${hits.map((p) => `${p}주`).join('·')} ✓` : t('myeongsik.ssLuck')}
            </Text>
          </View>
        );
      })}
      {/* 괴강·백호 — 해당 시만 */}
      {c.sinsal.goegang && (
        <View style={styles.ssRow}>
          <Text style={styles.ssName}>{t('sinsal.괴강')}</Text>
          <Text style={styles.ssHit}>{t('myeongsik.dayPillar')} ✓</Text>
        </View>
      )}
      {c.sinsal.baekhoHits.filter((p) => visiblePos.includes(p)).length > 0 && (
        <View style={styles.ssRow}>
          <Text style={styles.ssName}>{t('sinsal.백호')}</Text>
          <Text style={styles.ssHit}>{c.sinsal.baekhoHits.filter((p) => visiblePos.includes(p)).map((p) => `${p}주`).join('·')} ✓</Text>
        </View>
      )}

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
  luckSub: { ...font.caption, color: colors.ju, marginTop: space(3), marginBottom: space(1) },
  seunCard: { alignItems: 'center', paddingVertical: space(1.5), paddingHorizontal: space(2), borderRadius: radius.sm, backgroundColor: colors.sunk, minWidth: 52 },
  seunCur: { borderWidth: 1.5, borderColor: colors.ju },
  seunYear: { fontSize: 9, color: colors.inkFaint },
  seunGz: { fontSize: 14, fontWeight: '700' },
  seunTg: { fontSize: 8, color: colors.inkSoft },
  gzCellSm: { width: 34, height: 34, borderRadius: 6, alignItems: 'center', justifyContent: 'center', marginVertical: 1.5 },
  gzTextSm: { fontSize: 20, fontWeight: '800' },
  gzCellXs: { width: 30, height: 30, borderRadius: 6, alignItems: 'center', justifyContent: 'center', marginVertical: 1.5 },
  gzTextXs: { fontSize: 17, fontWeight: '700' },
  expCol: { alignItems: 'center', paddingHorizontal: space(0.75), paddingVertical: space(0.5) },
  expColLuck: { backgroundColor: colors.juSoft, borderRadius: radius.sm },
  expLabel: { fontSize: 11, color: colors.inkFaint, marginBottom: 2, fontWeight: '600' },
  expTg: { fontSize: 11, color: colors.inkSoft, marginBottom: 2, fontWeight: '600' },
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
  elemRow: { flexDirection: 'row', alignItems: 'center', gap: space(2), marginTop: space(1.5) },
  elemLabel: { fontSize: 15, fontWeight: '800', width: 20 },
  elemTrack: { flex: 1, height: 12, borderRadius: 6, backgroundColor: colors.sunk, overflow: 'hidden' },
  elemFill: { height: '100%', borderRadius: 6 },
  elemCount: { ...font.caption, color: colors.inkSoft, width: 16, textAlign: 'right' },
  note: { ...font.caption, marginTop: space(6) },
  readingBtn: {
    backgroundColor: colors.ju, borderRadius: radius.md, paddingVertical: space(3.5),
    alignItems: 'center', marginTop: space(5), ...shadow.card,
  },
  readingBtnText: { color: colors.bg, fontSize: 15, fontWeight: '700' },
});
