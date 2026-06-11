// app/src/screens/CompatScreen.tsx — 1:1 궁합 (관계 유형별 일반인 통변 + 글자 작용 상세)
// ─────────────────────────────────────────────────────────────────────────
// daniel 개편(2026-06-11): ① 두 명식을 각각 슬롯으로 — '내 명식'은 골드 슬롯으로 따로 빼서 식별,
//   상대는 저장 명식 선택 또는 직접 입력. ② 통변 = 단순 합충 나열이 아니라 관계 유형(지인·친구/동업/
//   투자/연애/결혼)별로 핵심을 먼저 짚어 일반인이 읽게(Edge kind='compat', 쉬운 말). 합충 비교는 접이식 상세.
// 결정론(일간관계·교차합충)은 온디바이스 → 통변의 근거로 Edge에 전달(규칙2 사주 단독). 상대 PII=동의(규칙8).
// ─────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useMemo } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { computeChart } from '../lib/engine';
import { analyzeCompatibility } from '@engine/compatibility';
import { detectInteractionsAmong } from '@engine/structure';
import { stemElement, branchElement, elementColor, elementText } from '../lib/ohaeng';
import { colors, radius, space, shadow, font } from '../lib/theme';
import { formatBirthDate } from '../lib/sijin';
import { BirthPlacePicker } from '../components/BirthPlacePicker';
import { listCharts, getRepresentativeId, type SavedChart } from '../lib/myChart';
import { useAuth } from '../lib/useAuth';
import { useSubscription } from '../lib/subscription';
import { ensureServerChartId } from '../lib/prewarmReadings';
import { COMPAT_RELS, otherSig, loadCompatReadings, genCompatReading, type CompatReading } from '../lib/compatReadings';
import type { ChartInput } from '@spec/chart';

export function CompatScreen({ me }: { me: ChartInput | null }) {
  const { t } = useTranslation();
  const { session } = useAuth();
  const { isPremium } = useSubscription();
  const [saved, setSaved] = useState<SavedChart[]>([]);
  const [meSel, setMeSel] = useState<SavedChart | null>(null);   // '내 명식' 슬롯(기본=대표). 저장 명식에서 변경 가능.
  const [mePick, setMePick] = useState(false);                    // 내 명식 변경 피커 펼침
  const [otherSel, setOtherSel] = useState<SavedChart | null>(null); // 상대(저장 명식) — 없으면 직접 입력
  const [oDate, setODate] = useState(''); const [oTime, setOTime] = useState('');
  const [oPlace, setOPlace] = useState('');
  // 통변(관계별) + 결정론 비교
  const [rel, setRel] = useState('love');                        // 선택 관계 유형(기본 연애)
  const [readings, setReadings] = useState<Record<string, CompatReading>>({});
  const [busy, setBusy] = useState<string | null>(null);         // 생성 중 관계 키
  const [pair, setPair] = useState<{ me: any; other: any } | null>(null);
  const [showDetail, setShowDetail] = useState(false);           // 글자 작용 상세 접이식
  const [active, setActive] = useState<Set<string>>(new Set());

  // 저장 명식 + 대표 로드 → 내 명식 슬롯 기본값 = 대표(없으면 me 입력)
  useEffect(() => {
    (async () => {
      const list = await listCharts(); setSaved(list);
      const repId = await getRepresentativeId();
      const rep = list.find((c) => c.id === repId) ?? list.find((c) => c.relation === 'self') ?? list[0] ?? null;
      setMeSel(rep);
    })();
  }, []);

  // 현재 '내 명식' input(슬롯 선택 우선, 없으면 라우트 me)
  const meInput: ChartInput | null = meSel?.input ?? me;
  const otherInput: ChartInput | null = useMemo(() => otherSel
    ? otherSel.input
    : (oDate ? { birthDateTime: `${oDate} ${oTime || '0:0'}`, calendar: '양', timeAccuracy: oTime ? '정확' : '미상', sex: '여', birthPlace: oPlace } : null),
    [otherSel, oDate, oTime, oPlace]);

  function toggleActive(key: string) {
    setActive((prev) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  }

  // 궁합 풀이 — 두 명식 결정론 계산(근거) → 서버차트 확보 → 관계 유형별 통변 로드/생성
  async function analyze() {
    if (!meInput || !otherInput || !session) return;
    const meC = computeChart(meInput), otherC = computeChart(otherInput);
    setPair({ me: meC.saju, other: otherC.saju }); setActive(new Set());
    if (!meSel) return; // 캐시는 저장 명식(serverChartId) 필요 — 대표가 없으면 비교만
    const chartId = await ensureServerChartId(meC, meInput, session, meSel);
    if (!chartId) return;
    const sig = otherSig(otherC.saju);
    // 교차작용(나↔상대) + 일간관계 = 통변 근거(쉬운 말로 번역하도록 Edge에 전달)
    const dx = analyzeCompatibility(meC.saju, otherC.saju);
    const cross = crossDetails(meC.saju, otherC.saju);
    const cached = await loadCompatReadings(chartId, sig);
    setReadings(cached);
    // 선택 관계가 없으면 생성(프리미엄은 즉시, 비프리미엄은 게이트 — 여기선 프리미엄 가정·메뉴가 프리미엄)
    for (const r of COMPAT_RELS) {
      if (cached[r.key]) continue;
      setBusy(r.key);
      const res = await genCompatReading(chartId, r.key, sig, otherC.saju, cross, dx.dayMasterRelation.detail);
      if (res) setReadings((prev) => ({ ...prev, [r.key]: res }));
    }
    setBusy(null);
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

  const cur = readings[rel];
  const slotLine = (input: ChartInput | null) => input ? `${String(input.birthDateTime).split(' ')[0]} · ${input.sex}` : '미선택';

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.wrap}>
      {/* ── 내 명식 슬롯(골드, 따로 빼서 식별) ── */}
      <Text style={styles.slotLabel}>{t('compat.mySlot')}</Text>
      <Pressable style={styles.meSlot} onPress={() => setMePick((v) => !v)}>
        <View style={{ flex: 1 }}>
          <Text style={styles.meSlotName}>{meSel?.label ?? t('compat.mySlot')}</Text>
          <Text style={styles.meSlotSub}>{slotLine(meInput)}</Text>
        </View>
        <Text style={styles.meSlotChange}>{t('compat.change')}</Text>
      </Pressable>
      {mePick && saved.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {saved.map((s) => {
            const on = meSel?.id === s.id;
            return <Pressable key={s.id} style={[styles.chip, on && styles.chipOn]} onPress={() => { setMeSel(s); setMePick(false); }}>
              <Text style={[styles.chipTx, on && styles.chipTxOn]}>{s.label}</Text></Pressable>;
          })}
        </ScrollView>
      )}

      {/* ── 상대 슬롯 ── */}
      <Text style={[styles.slotLabel, { marginTop: space(5) }]}>{t('compat.otherSlot')}</Text>
      {saved.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {saved.filter((s) => s.id !== meSel?.id).map((s) => {
            const on = otherSel?.id === s.id;
            return <Pressable key={s.id} style={[styles.chip, on && styles.chipOn]} onPress={() => setOtherSel(on ? null : s)}>
              <Text style={[styles.chipTx, on && styles.chipTxOn]}>{s.label}</Text></Pressable>;
          })}
        </ScrollView>
      )}
      <Text style={styles.orHint}>{t('compat.orDirect')}</Text>
      <TextInput style={[styles.input, otherSel && styles.inputDim]} editable={!otherSel} value={oDate} onChangeText={(v) => setODate(formatBirthDate(v))}
        placeholder={t('compat.otherDatePh')} placeholderTextColor={colors.inkFaint} keyboardType="number-pad" maxLength={10} />
      <TextInput style={[styles.input, otherSel && styles.inputDim]} editable={!otherSel} value={oTime} onChangeText={setOTime}
        placeholder={t('compat.otherTimePh')} placeholderTextColor={colors.inkFaint} />
      <View style={[styles.placeField, otherSel && styles.inputDim]} pointerEvents={otherSel ? 'none' : 'auto'}>
        <BirthPlacePicker value={oPlace} onSelect={(p) => setOPlace(p.name)} />
      </View>

      <Pressable style={[styles.btn, (!otherInput || !!busy) && styles.btnOff]} onPress={analyze} disabled={!otherInput || !!busy}>
        {busy ? <ActivityIndicator color={colors.bg} /> : <Text style={styles.btnText}>{t('compat.analyze')}</Text>}
      </Pressable>

      {/* ── 관계 유형별 통변 ── */}
      {pair && (
        <>
          <View style={styles.relChips}>
            {COMPAT_RELS.map((r) => (
              <Pressable key={r.key} style={[styles.relChip, rel === r.key && styles.relChipOn]} onPress={() => setRel(r.key)}>
                <Text style={[styles.relChipTx, rel === r.key && styles.relChipTxOn]}>{r.ko}</Text>
              </Pressable>
            ))}
          </View>
          {busy && !cur ? (
            <View style={styles.readCard}><ActivityIndicator color={colors.ju} /><Text style={styles.busyTx}>{t('compat.generating')}</Text></View>
          ) : cur ? (
            <View style={styles.readCard}>
              {cur.core ? <Text style={styles.coreTx}>✦ {cur.core}</Text> : null}
              {cur.base ? <View style={styles.sec}><Text style={styles.secLabel}>🤝 {t('compat.secBase')}</Text><Text style={styles.secBody}>{cur.base}</Text></View> : null}
              {cur.overlay ? <View style={styles.sec}><Text style={styles.secLabel}>⚖️ {t('compat.secDynamic')}</Text><Text style={styles.secBody}>{cur.overlay}</Text></View> : null}
              {cur.remedy ? <View style={[styles.sec, styles.remedySec]}><Text style={styles.secLabel}>💡 {t('compat.secAdvice')}</Text><Text style={styles.secBody}>{cur.remedy}</Text></View> : null}
            </View>
          ) : (
            <Text style={styles.note}>{t('compat.noReading')}</Text>
          )}

          {/* 글자 작용 자세히(접이식 — 근거·글라스박스) */}
          <Pressable style={styles.detailToggle} onPress={() => setShowDetail((v) => !v)}>
            <Text style={styles.detailToggleTx}>{showDetail ? '▾' : '▸'} {t('compat.detailToggle')}</Text>
          </Pressable>
          {showDetail && renderCrossDetail()}
        </>
      )}
    </ScrollView>
  );

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
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: space(2) }}>{miniChart(mineP, '나')}</ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>{miniChart(othersP, '상대')}</ScrollView>
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
                      <Pressable key={i} onPress={() => toggleActive(key)} style={[styles.cmLinkRow, on && { borderLeftColor: col, backgroundColor: colors.sunk }]}>
                        <Text style={styles.cmLink}>{on ? '◉ ' : '○ '}{pa.who}·{pa.label} <Text style={{ color: elementColor[isGan ? stemElement(ca) : branchElement(ca)], fontWeight: '800' }}>{ca}</Text>{'  ⟷  '}{pb.who}·{pb.label} <Text style={{ color: elementColor[isGan ? stemElement(cb) : branchElement(cb)], fontWeight: '800' }}>{cb}</Text>{'   '}<Text style={{ color: col, fontWeight: '800' }}>{it.type}{it.transformsTo ? ` ${it.transformsTo}` : ''}</Text></Text>
                      </Pressable>
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
  screen: { backgroundColor: colors.bg },
  wrap: { padding: space(5), paddingBottom: space(12) },
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
  orHint: { ...font.caption, color: colors.inkSoft, marginTop: space(2), marginBottom: space(1) },
  placeField: { marginTop: space(2) },
  input: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, padding: space(3), fontSize: 15, color: colors.ink, marginTop: space(2), ...shadow.soft },
  inputDim: { opacity: 0.4 },
  btn: { backgroundColor: colors.ju, borderRadius: radius.md, padding: space(3.5), alignItems: 'center', marginTop: space(4), ...shadow.card },
  btnOff: { opacity: 0.5 },
  btnText: { color: colors.white, fontSize: 15, fontWeight: '700' },
  // 관계 유형
  relChips: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2), marginTop: space(6), marginBottom: space(3) },
  relChip: { paddingHorizontal: space(3.5), paddingVertical: space(2), borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
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
  detailToggleTx: { ...font.body, color: colors.inkSoft, fontWeight: '700' },
  // 글자 작용 비교
  crossWrap: { marginTop: space(2) },
  cmTitle: { ...font.caption, color: colors.ju, fontWeight: '700', marginBottom: space(1) },
  cmRow: { flexDirection: 'row', gap: space(1) },
  cmCol: { alignItems: 'center', width: 36 },
  cmColLuck: { backgroundColor: colors.juSoft, borderRadius: radius.sm },
  cmLabel: { fontSize: 9, color: colors.inkFaint, marginBottom: 2 },
  cmCell: { width: 30, height: 30, borderRadius: 5, alignItems: 'center', justifyContent: 'center', marginVertical: 1 },
  cmCellHL: { borderWidth: 2.5, borderColor: colors.ju },
  cmTx: { fontSize: 17, fontWeight: '800' },
  cmHint: { ...font.caption, color: colors.inkFaint, marginTop: space(1), marginBottom: space(1) },
  crossList: { marginTop: space(2), padding: space(3), borderRadius: radius.sm, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  cmGroupHead: { ...font.caption, fontWeight: '800', marginBottom: space(1) },
  cmLinkRow: { borderLeftWidth: 3, borderLeftColor: 'transparent', borderRadius: radius.sm, paddingLeft: space(2) },
  cmLink: { ...font.body, color: colors.ink, paddingVertical: space(1) },
});
