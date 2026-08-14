// app/src/components/RelationMapCard.tsx — 홈의 관계 지도 카드
// ═══════════════════════════════════════════════════════════════════════════
// daniel 2026-08-14: *"최초 진입은 어떻게해"*
//   실측해 보니 관계 지도로 가는 길이 **풀이탭 51개 중 카드 하나**뿐이었다 — 묻혀서 아무도 못 찾는다.
//   ⇒ 홈 블록으로 올린다. 홈은 순서를 바꿀 수 있는 블록 시스템이라, 원하면 내리거나 뺄 수 있다.
//
// ■ 언제 보이나
//   **상대가 1명 이상 있을 때만.** 나 혼자면 빈 지도를 광고하는 꼴이라 아예 안 그린다
//   (홈 카드들의 관례 — 각 카드가 스스로 미노출을 판단한다).
//
// ■ 무엇을 보여주나 — 숫자가 아니라 **한 장면**
//   "N명"만 적으면 들어갈 이유가 안 생긴다. 케미 상위 세 명을 점으로 띄우고
//   **가장 가까운 사람의 역할**을 한 줄로 적는다 — 그게 지도의 맛보기다.
//
// ⚠️계산은 온디바이스 엔진(명식 1개당 ~2ms)이라 가볍지만, 홈은 매번 그린다.
//   그래서 명식 목록이 바뀔 때만 계산한다(reloadKey).
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, InteractionManager } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { listCharts, getRepresentativeId } from '../lib/engine/myChart';
import { computeChart } from '../lib/engine/engine';
import { buildRelationMap } from '@engine/relationMap';
import { rolePhrase } from '../lib/content/relationMapPhrases';
import { appLang } from '../lib/i18n';
import { PressableScale } from './PressableScale';
import { colors, radius, space } from '../lib/theme';
import { useFontScale } from '../lib/ui/fontScale';
import type { Element } from '@spec/chart';

/** 지도 화면과 **같은 색표**를 쓴다 — 홈에서 본 점이 지도에서 다른 색이면 딴 화면처럼 보인다. */
const NODE_COLOR: Record<Element, string> = {
  木: '#5FA98B', 火: '#D97A93', 土: '#C9A06A', 金: '#9AA0B8', 水: '#6E8FD1',
};

type Top = { id: string; name: string; elem: Element; chemi: number; role: string };

/**
 * ★계산 결과 캐시 — 홈은 자주 다시 그려지고, 명식이 그대로면 답도 그대로다.
 *   실측(2026-08-14 daniel *"홈로딩도 갑자기 너무 오래걸려"*):
 *     명식 61개면 `buildSajuChart`×61 만 **163ms**(맥 기준·기기는 3~5배).
 *     `buildRelationMap` 자체는 3ms 로 싸다 — 비싼 건 **명식을 다시 세우는 것**이었다.
 *   키는 명식 목록의 지문(id+라벨). 사람이 추가·수정되면 키가 바뀌어 자동으로 다시 센다.
 */
let _cache: { key: string; count: number; tops: Top[]; lead: string } | null = null;

export function RelationMapCard({ reloadKey }: { reloadKey?: number }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { fs } = useFontScale();
  const styles = mkStyles(fs);
  const lang = appLang() as 'ko' | 'en' | 'ja';

  const [count, setCount] = useState(0);
  const [tops, setTops] = useState<Top[]>([]);
  const [lead, setLead] = useState<string>('');

  useEffect(() => {
    let alive = true;
    // ★홈 **첫 페인트를 막지 않는다.** 전환·애니메이션이 끝난 뒤에 계산한다 —
    //   이 카드 하나 때문에 앱이 느려 보이면 안 된다(카드는 늦게 떠도 된다).
    const task = InteractionManager.runAfterInteractions(() => {
      void (async () => {
      const [list, rep] = await Promise.all([listCharts(), getRepresentativeId()]);
      const meId = rep ?? list[0]?.id;
      const me = list.find((c) => c.id === meId);
      if (!me) return;
      const others = list.filter((c) => c.id !== meId && c.relation !== 'pet');
      if (!others.length) return;                      // 나 혼자면 안 그린다

      // 같은 명식 구성이면 다시 세지 않는다
      const key = `${meId}|${list.map((c) => `${c.id}:${c.label ?? ''}`).sort().join(',')}`;
      if (_cache && _cache.key === key) {
        if (!alive) return;
        setCount(_cache.count); setTops(_cache.tops); setLead(_cache.lead);
        return;
      }

      const meChart = computeChart(me.input).saju;
      const built = buildRelationMap(
        meChart,
        others.map((c) => { try { return { id: c.id, chart: computeChart(c.input).saju }; } catch { return null; } })
          .filter(Boolean) as { id: string; chart: any }[],
      );
      if (!alive || !built.nodes.length) return;

      const nameOf = (id: string) => list.find((c) => c.id === id)?.label ?? '';
      const topList: Top[] = built.nodes.slice(0, 3).map((n) => ({
        id: n.id, name: nameOf(n.id), elem: n.dayElem, chemi: n.chemi, role: rolePhrase(lang, n.role).name,
      }));
      setCount(built.nodes.length);
      setTops(topList);
      const first = built.nodes[0];
      const leadTx = t('relmapCard.lead', '{{name}}님은 {{role}}이에요', {
        name: nameOf(first.id), role: rolePhrase(lang, first.role).name,
      });
      setLead(leadTx);
      _cache = { key, count: built.nodes.length, tops: topList, lead: leadTx };
      })().catch(() => {});
    });
    return () => { alive = false; task.cancel?.(); };
  }, [reloadKey, lang, t]);

  if (!count) return null;   // 상대가 없으면 홈에서 통째로 빠진다

  return (
    <PressableScale style={styles.card} onPress={() => router.push('/relationmap')}>
      <View style={styles.head}>
        <Text style={styles.title}>{t('relmapCard.title', '관계 지도')}</Text>
        <Text style={styles.count}>{t('relmap.count', '{{n}}명', { n: count })}</Text>
      </View>

      {/* 케미 상위 3명 — 지도의 맛보기 */}
      <View style={styles.dots}>
        {tops.map((p) => (
          <View key={p.id} style={styles.person}>
            <View style={[styles.dot, { backgroundColor: NODE_COLOR[p.elem] }]}>
              <Text style={styles.dotTx}>{p.elem}</Text>
            </View>
            <Text style={styles.name} numberOfLines={1}>{p.name}</Text>
            <Text style={styles.chemi}>{p.chemi}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.lead} numberOfLines={2}>{lead}</Text>
      <Text style={styles.more}>{t('relmapCard.more', '지도에서 전부 보기 ›')}</Text>
    </PressableScale>
  );
}

const mkStyles = (fs: (n: number) => number) => StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.md, padding: space(4), marginTop: space(3) },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: colors.ink, fontSize: fs(16), lineHeight: fs(24), fontWeight: '800' },
  count: { color: colors.inkSoft, fontSize: fs(12), lineHeight: fs(18) },
  dots: { flexDirection: 'row', gap: space(4), marginTop: space(4) },
  person: { alignItems: 'center', width: 60 },
  dot: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  dotTx: { color: '#fff', fontSize: fs(14), lineHeight: fs(18), fontWeight: '800' },
  name: { color: colors.ink, fontSize: fs(11), lineHeight: fs(16), marginTop: space(1) },
  chemi: { color: colors.ju, fontSize: fs(12), lineHeight: fs(18), fontWeight: '800' },
  lead: { color: colors.ink, fontSize: fs(14), lineHeight: fs(22), marginTop: space(4) },
  more: { color: colors.ju, fontSize: fs(13), lineHeight: fs(20), fontWeight: '700', marginTop: space(2) },
});
