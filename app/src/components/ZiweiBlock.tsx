// app/src/components/ZiweiBlock.tsx — 대화창 블록: **자미두수 명반**
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-08-26 *"최자미 … 대화 열면 오늘의 행운이 나오는데 자미두수가 나와야지"*.
//
// ■ 왜 새로 만들었나
//   최자미의 블록이 `luck`(오늘의 행운)이었다 — 자미두수 담당인데 사주 콘텐츠가 떴다.
//   자미두수 블록이 레지스트리에 **아예 없었다.**
//
// ■ ★내용을 새로 만들지 않았다
//   `ZiweiTeaser` 가 이미 있다(명궁 위치·주성 이름 = **구조 사실만**). 그걸 그대로 쓴다.
//   ⚠️CLAUDE.md §3.3 — 자미두수는 깊은 판정을 만들지 않는다. 여기서 별 뜻을 새로 쓰면 그 선을 넘는다.
//   이 파일이 하는 일은 **대표 명식을 읽어 티저에 넘기는 것**뿐이다.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { ZiweiTeaser } from './ZiweiTeaser';
import { loadRepChart } from '../lib/engine/myChart';
import { computeChart } from '../lib/engine/engine';
import { colors, space, font } from '../lib/theme';

/**
 * @param reloadKey 대표 명식이 바뀌면 다시 읽는다(다른 블록과 같은 관용)
 */
export function ZiweiBlock({ reloadKey }: { reloadKey: number }) {
  const [ziwei, setZiwei] = useState<any>(undefined);   // undefined=읽는 중 · null=없음

  useEffect(() => {
    let alive = true;
    void loadRepChart().then((sc) => {
      if (!alive) return;
      if (!sc?.input) { setZiwei(null); return; }
      // ⚠️계산이 실패해도 화면을 깨뜨리지 않는다 — 자미는 보조 콘텐츠다
      try { setZiwei((computeChart(sc.input) as any)?.ziwei ?? null); } catch { setZiwei(null); }
    }).catch(() => { if (alive) setZiwei(null); });
    return () => { alive = false; };
  }, [reloadKey]);

  if (ziwei === undefined) return <View style={styles.wrap}><ActivityIndicator color={colors.ju} /></View>;
  // ★없으면 **없다고 적는다**. 빈 자리로 두면 «고장인가»로 읽힌다
  if (!ziwei) return <View style={styles.wrap}><Text style={styles.none}>명식을 등록하면 자미두수 명반을 보여 드려요.</Text></View>;
  return <ZiweiTeaser ziwei={ziwei} />;
}

const styles = StyleSheet.create({
  wrap: { paddingVertical: space(4), alignItems: 'center' },
  none: { ...font.caption, color: colors.inkFaint },
});
