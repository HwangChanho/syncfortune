// app/src/components/CommunityPulseCard.tsx — 홈 상단 '함께 보는 사람들'(소셜 프루프)
// ─────────────────────────────────────────────────────────────────────────
// daniel 2026-07-26: ①"하단에 인원을 상단으로 올려줘" ②"today 방문자수 느낌으로 디자인 바꾸고"
//   → 위치를 홈 **최상단**으로, 디자인을 **방문자 카운터 스타일**(라이브 점 + 큰 숫자)로 바꿨다.
//
// ★★수치는 부풀리지 않는다(원 요청은 "×10 정도 부풀리자" 였으나 거절 — 조작된 소셜 프루프는 구매 결정에
//   직접 영향을 주는 허위 표시라 표시광고법 소지 + 프로젝트 정직성 원칙 위반).
//   대신 **디자인은 요청하신 방문자 카운터 형태로, 숫자는 실제로 큰 지표로** 채운다:
//     · 오늘 방문자(실측 1명) ✗ — 그대로 쓰면 "오늘 1명" 이 되어 오히려 신뢰를 깎는다
//     · **누적 열람(실측 343회)** ✓ — 조작 없이 충분히 크고 단조 증가라 안정적 → 주 수치
//     · 오늘 방문자는 **TODAY_MIN 이상일 때만** 보조 칩으로 함께 표시(그날 규모가 실제로 붙으면 자동 등장)
//   전체 규모가 작으면(MIN_VIEWS) 카드 자체를 숨긴다 — 작은 숫자를 내보이는 역효과 방지.
//
// 데이터: `get_public_stats()` RPC(집계 숫자만·개인정보 0·anon 허용). 실패하면 조용히 미표시.
// ⚠️문구 = Claude 초안 → ★daniel 검수 슬롯.
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { supabase } from '../lib/supabase';
import { useFontScale } from '../lib/ui/fontScale';
import { colors, radius, space, font } from '../lib/theme';

/** 이 미만이면 카드를 아예 숨긴다 — 작은 수는 신뢰를 깎는다(부풀리는 대신 '숨긴다'). */
const MIN_VIEWS = 100;
/** 오늘 방문자는 이 이상일 때만 보조 칩으로 노출 — 1~2명이면 오히려 초라해 보인다. */
const TODAY_MIN = 5;

type Stats = { readings_total: number; views_total: number; visitors_today: number };

export function CommunityPulseCard() {
  const { fs } = useFontScale();
  const [s, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    let alive = true;
    // PostgrestBuilder 는 PromiseLike(.catch 없음) → async IIFE + try/catch 로 감싼다.
    (async () => {
      try {
        const { data, error } = await supabase.rpc('get_public_stats');
        if (!alive || error) return;
        const row = Array.isArray(data) ? data[0] : data;
        if (row) setStats({
          readings_total: Number(row.readings_total ?? 0),
          views_total: Number(row.views_total ?? 0),
          visitors_today: Number(row.visitors_today ?? 0),
        });
      } catch { /* 통계는 부가 정보 — 실패해도 홈에 영향 없음 */ }
    })();
    return () => { alive = false; };
  }, []);

  if (!s || s.views_total < MIN_VIEWS) return null; // 규모 미달·조회 실패 = 미노출
  const n = (v: number) => v.toLocaleString('ko-KR');

  return (
    <View style={styles.card}>
      {/* 라이브 점 + 라벨 — '지금도 돌아가고 있다'는 신호(방문자 카운터 관례) */}
      <View style={styles.head}>
        <View style={styles.dot} />
        <Text style={[styles.label, { fontSize: fs(11) }]}>함께 보는 사람들</Text>
      </View>
      {/* 큰 숫자 = 주 수치(누적 열람). 숫자만 강조하고 단위는 작게 — 카운터 느낌 */}
      <View style={styles.row}>
        <Text style={[styles.num, { fontSize: fs(26) }]}>{n(s.views_total)}</Text>
        <Text style={[styles.unit, { fontSize: fs(12) }]}>번 함께 봤어요</Text>
      </View>
      {/* 보조 칩 — 오늘 규모가 붙었을 때만 / 풀이 건수는 항상(작아도 '무엇을' 보여줌) */}
      <View style={styles.chips}>
        {s.visitors_today >= TODAY_MIN ? (
          <Text style={[styles.chip, { fontSize: fs(11) }]}>오늘 {n(s.visitors_today)}명</Text>
        ) : null}
        {s.readings_total > 0 ? (
          <Text style={[styles.chip, { fontSize: fs(11) }]}>풀이 {n(s.readings_total)}건</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // 홈 최상단 — 배너 다음에 오는 좁은 카드(주인공 블록을 밀어내지 않게 컴팩트하게)
  card: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.juLine, paddingVertical: space(4), paddingHorizontal: space(5), marginBottom: space(4) },
  head: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#2E9E5B' }, // 라이브 신호(의미색 — 액센트와 별개)
  label: { ...font.caption, color: colors.inkSoft, fontWeight: '800', letterSpacing: 0.4 },
  row: { flexDirection: 'row', alignItems: 'baseline', gap: space(1.5), marginTop: space(1) },
  num: { ...font.display, color: colors.ju, fontWeight: '900', letterSpacing: -0.5 },
  unit: { ...font.caption, color: colors.inkSoft, fontWeight: '700' },
  chips: { flexDirection: 'row', gap: space(2), marginTop: space(2) },
  chip: { ...font.caption, color: colors.inkSoft, backgroundColor: colors.sunk, borderRadius: 999, paddingVertical: space(1), paddingHorizontal: space(2.5), overflow: 'hidden', fontWeight: '700' },
});
