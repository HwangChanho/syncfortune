// src/app/(app)/ziwei.tsx — 자미두수 명반 + 상세 풀이(프리미엄)
// ─────────────────────────────────────────────────────────────────────────
// 대표 명식 기반 자미두수 12궁 명반(결정론·iztro). 궁·별 탭 → 의미(글로서리).
// 깊은 통합 풀이·운한(대한)은 프리미엄(LLM 패스) — 여기선 명반·성요까지 + 프리미엄 유도.
// ─────────────────────────────────────────────────────────────────────────
import { useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, Modal, StyleSheet } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Alert } from '../../lib/ui/alert'; // 커스텀 알림 — 자미 풀이 전 정확한 시간 안내(daniel)
import { useDeferredReady } from '../../lib/ui/useDeferredReady'; // 전환 멈칫 제거(daniel 2026-06-28)
import { ChartSkeleton } from '../../components/Skeleton';     // 그 사이 스켈레톤
import { computeChart } from '../../lib/engine/engine';
import { loadMyChart } from '../../lib/engine/myChart';
import { branchElement, elementColor } from '../../lib/engine/ohaeng';
import { lookupGlossary, GLOSSARY_KIND_LABEL, type GlossaryKind } from '../../lib/content/myeongriGlossary';
import { PALACE_DESC } from '../../lib/content/palaceDesc'; // 12궁 짧은 설명(공용 — 풀이 화면과 공유)
import { colors, radius, space, shadow, font } from '../../lib/theme';
import type { ChartInput } from '@spec/chart';

const LAYOUT = [['巳', '午', '未', '申'], ['辰', 'C', 'C', '酉'], ['卯', 'C', 'C', '戌'], ['寅', '丑', '子', '亥']];
const SIHWA_COL: Record<string, string> = { '化祿': '#3E8E5A', '化權': '#C0392B', '化科': '#3A6EA5', '化忌': '#7A7A7A' };
const BR_SYM: Record<string, string> = { '廟': '◎', '旺': '○', '得地': '△', '利': '△', '平': '△', '不得地': 'x', '陷': 'x' };

export default function ZiweiRoute() {
  const router = useRouter();
  const [me, setMe] = useState<ChartInput | null>(null);
  const [loading, setLoading] = useState(true);
  const [glossary, setGlossary] = useState<{ kind: GlossaryKind; key?: string } | null>(null);
  const ready = useDeferredReady(); // 전환 멈칫 제거 — 전환 끝난 뒤 computeChart(자미 성반 산출)·렌더

  useFocusEffect(useCallback(() => {
    let alive = true;
    loadMyChart().then((ch) => { if (alive) { setMe(ch); setLoading(false); } });
    return () => { alive = false; };
  }, []));

  if (loading) return <ChartSkeleton />;
  if (!me) return (
    <View style={styles.center}>
      <Text style={[font.body, { color: colors.ink, marginBottom: space(3) }]}>등록된 명식이 없습니다.</Text>
      <Pressable style={styles.btn} onPress={() => router.push('/register')}><Text style={styles.btnText}>명식 등록</Text></Pressable>
    </View>
  );
  if (!ready) return <ChartSkeleton />; // 명식 있음 + 전환 중 → 스켈레톤(아래 computeChart 지연)

  const c = computeChart(me);
  const z = c.ziwei;
  const dm = c.saju.dayMaster;
  const byBr: Record<string, any> = {};
  (z.palaces as any[]).forEach((pl) => { byBr[pl.branch] = pl; });

  return (
    <>
      <ScrollView style={styles.screen} contentContainerStyle={styles.wrap}>
        <Text style={styles.h}>자미두수 명반</Text>
        <Text style={styles.kv}>{z.bureau} · 명궁 {z.lifePalaceBranch} · 일간 {dm.stem}({dm.element})</Text>
        <View style={styles.grid}>
          {LAYOUT.map((row, r) => (
            <View key={r} style={styles.row}>
              {row.map((cell, ci) => {
                if (cell === 'C') {
                  const info = r === 1 && ci === 1 ? { t: '일간', v: dm.stem }
                    : r === 1 && ci === 2 ? { t: '명궁', v: z.lifePalaceBranch }
                    : r === 2 && ci === 1 ? { t: '국', v: z.bureau.replace('五局', '') }
                    : { t: '오행', v: dm.element };
                  return <View key={ci} style={styles.center2}><Text style={styles.cT}>{info.t}</Text><Text style={styles.cV}>{info.v}</Text></View>;
                }
                const pl = byBr[cell];
                return (
                  <View key={ci} style={styles.cell}>
                    <View style={styles.top}>
                      {pl ? <Pressable onPress={() => setGlossary({ kind: 'palace', key: pl.name })}><Text style={[styles.pname, styles.link]}>{pl.name}</Text></Pressable> : <Text style={styles.pname} />}
                      <Text style={[styles.br, { color: elementColor[branchElement(cell)] }]}>{cell}</Text>
                    </View>
                    {pl && PALACE_DESC[pl.name] ? <Text style={styles.pdesc}>{PALACE_DESC[pl.name]}</Text> : null}
                    {pl?.majorStars?.map((st: any, i: number) => (
                      <Pressable key={i} onPress={() => setGlossary({ kind: 'star', key: st.name })}>
                        <Text style={[styles.major, styles.link]}>{st.name}<Text style={styles.bright}>{BR_SYM[st.brightness] ?? ''}</Text>{(st.transforms ?? []).map((tr: string, j: number) => <Text key={j} style={[styles.sihwa, { color: SIHWA_COL[tr] ?? colors.ink }]}> {tr.slice(-1)}</Text>)}</Text>
                      </Pressable>
                    ))}
                    {pl?.minorStars?.map((s: any, k: number) => (
                      <Pressable key={`m${k}`} onPress={() => setGlossary({ kind: 'star', key: s.name })}><Text style={[styles.minor, styles.link]}>{s.name}</Text></Pressable>
                    ))}
                  </View>
                );
              })}
            </View>
          ))}
        </View>
        <Text style={styles.hint}>궁·별을 탭하면 의미가 나옵니다.</Text>

        <View style={styles.premCard}>
          <Text style={styles.premTitle}>자미두수 상세 풀이 (프리미엄)</Text>
          <Text style={styles.premDesc}>12궁 통합 해석과 운한(대한) 흐름 풀이는 프리미엄에서 제공됩니다.</Text>
          {/* 자미두수 전용 풀이(/reading?kind=ziwei) — 대표 명식 12궁 통변. input 생략 → serverChartId 캐시 연결 */}
          <Pressable style={styles.btn} onPress={() => {
            // 자미두수는 시(時)에 따라 명반이 크게 바뀌므로, 풀이 전 정확한 시간 안내 + 명식 수정 유도(daniel)
            Alert.alert(
              '자미두수는 정확한 시간이 필요해요',
              '태어난 시(時)에 따라 명반(命盤)이 크게 달라집니다. 명식의 출생 시간이 정확한지 먼저 확인해 주세요.',
              [
                { text: '명식 확인·수정', onPress: () => router.push('/charts') },
                { text: '풀이 보기', onPress: () => router.navigate({ pathname: '/reading', params: { kind: 'ziwei' } }) },
              ],
            );
          }}><Text style={styles.btnText}>프리미엄 풀이 보기</Text></Pressable>
        </View>
      </ScrollView>

      <Modal visible={!!glossary} transparent animationType="slide" onRequestClose={() => setGlossary(null)}>
        <Pressable style={styles.sheetOverlay} onPress={() => setGlossary(null)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            {glossary && (() => {
              const e = lookupGlossary(glossary.kind, glossary.key);
              if (!e) return <Text style={styles.sMeaning}>{glossary.key}</Text>;
              return (
                <>
                  <View style={styles.sHandle} />
                  <Text style={styles.sKind}>{GLOSSARY_KIND_LABEL[glossary.kind]}</Text>
                  <Text style={styles.sTitle}>{e.ko}{e.hanja ? `   ${e.hanja}` : ''}</Text>
                  <Text style={styles.sMeaning}>{e.meaning}</Text>
                  <View style={styles.sChips}>{e.keywords.map((k, i) => <Text key={i} style={styles.sChip}>{k}</Text>)}</View>
                  <Pressable style={styles.sClose} onPress={() => setGlossary(null)}><Text style={styles.sCloseTx}>닫기</Text></Pressable>
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg, padding: space(5) },
  h: { ...font.heading, marginBottom: space(2) },
  kv: { ...font.body, color: colors.ink, marginBottom: space(2) },
  hint: { ...font.caption, marginTop: space(2) },
  grid: { marginTop: space(2), borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm },
  row: { flexDirection: 'row' },
  cell: { flex: 1, minHeight: 78, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, padding: 3 },
  center2: { flex: 1, minHeight: 78, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.sunk },
  cT: { fontSize: 9, color: colors.inkFaint },
  cV: { fontSize: 15, color: colors.ju, fontWeight: '800' },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  pname: { fontSize: 8, color: colors.inkFaint, fontWeight: '600' },
  pdesc: { fontSize: 7, color: colors.inkSoft, lineHeight: 9, marginTop: 1 },
  br: { fontSize: 13, fontWeight: '800' },
  major: { fontSize: 11, color: colors.ink, fontWeight: '700', marginTop: 1, lineHeight: 14 },
  bright: { fontSize: 8, color: colors.inkFaint, fontWeight: '400' },
  sihwa: { fontSize: 9, fontWeight: '800' },
  minor: { fontSize: 8, color: colors.inkSoft, marginTop: 1, lineHeight: 12 },
  link: { textDecorationLine: 'underline', textDecorationStyle: 'dotted' },
  premCard: { marginTop: space(5), padding: space(4), borderRadius: radius.md, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.ju, ...shadow.card },
  premTitle: { ...font.body, color: colors.ju, fontWeight: '800' },
  premDesc: { ...font.caption, color: colors.inkSoft, marginTop: space(1.5), lineHeight: 19 },
  btn: { backgroundColor: colors.ju, borderRadius: radius.md, paddingVertical: space(3), paddingHorizontal: space(5), alignItems: 'center', marginTop: space(3) },
  btnText: { color: colors.bg, fontSize: 15, fontWeight: '700' },
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.card, borderTopLeftRadius: radius.md, borderTopRightRadius: radius.md, padding: space(5), paddingBottom: space(9) },
  sHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.line, marginBottom: space(3) },
  sKind: { ...font.caption, color: colors.ju, fontWeight: '700', marginBottom: space(1) },
  sTitle: { ...font.heading, color: colors.ink, marginBottom: space(2.5) },
  sMeaning: { ...font.body, color: colors.ink, lineHeight: 24 },
  sChips: { flexDirection: 'row', flexWrap: 'wrap', gap: space(1.5), marginTop: space(3.5) },
  sChip: { ...font.caption, color: colors.ink, backgroundColor: colors.sunk, paddingHorizontal: space(2.5), paddingVertical: space(1), borderRadius: radius.pill, overflow: 'hidden' },
  sClose: { marginTop: space(4), alignItems: 'center', paddingVertical: space(2.5), borderRadius: radius.sm, backgroundColor: colors.sunk },
  sCloseTx: { ...font.body, color: colors.inkSoft, fontWeight: '700' },
});
