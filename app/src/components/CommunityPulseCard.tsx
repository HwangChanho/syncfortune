// app/src/components/CommunityPulseCard.tsx — 홈 하단 '함께 보고 있어요'(소셜 프루프)
// ─────────────────────────────────────────────────────────────────────────
// daniel 2026-07-26: "홈에 오늘의 방문자수도 기록하자."
//
// ★★수치를 부풀리지 않는다(중요).
//   원 요청은 "×10 정도로 약간 부풀리자" 였으나, 조작된 소셜 프루프는 **구매 결정에 직접 영향**을 주는
//   허위 표시라 표시광고법·심사 리스크가 있고, 이 프로젝트의 정직성 원칙(가짜 수치 금지)과도 충돌한다.
//   → 대신 **실제로 큰 지표를 고르는** 방식으로 같은 목적을 달성한다:
//      · 오늘 방문자(실측 1명) ✗ — 작을 뿐 아니라 매일 요동친다
//      · **누적 열람(실측 328회)** ✓ — 조작 없이도 충분히 큰 수이고 단조 증가라 안정적
//   그리고 규모가 작을 땐 **아예 숨긴다**(MIN_VIEWS) — 작은 숫자를 보여주는 역효과를 피하면서,
//   서비스가 커지면 자동으로 노출된다.
//
// 데이터: `get_public_stats()` RPC(집계 숫자만·개인정보 0·anon 허용). 실패하면 조용히 미표시.
// 위치: 홈 스크롤 맨 아래(ListFooter) — 다 훑어본 뒤 만나는 신뢰 신호라 방해가 적다.
// ⚠️문구 = Claude 초안 → ★daniel 검수 슬롯.
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { supabase } from '../lib/supabase';
import { useFontScale } from '../lib/ui/fontScale';
import { colors, radius, space, font } from '../lib/theme';

/** 이 미만이면 노출하지 않는다 — 작은 수는 오히려 신뢰를 깎는다(부풀리는 대신 '숨긴다'). */
const MIN_VIEWS = 100;

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

  // 규모 미달·조회 실패 = 미노출
  if (!s || s.views_total < MIN_VIEWS) return null;

  const n = (v: number) => v.toLocaleString('ko-KR');
  return (
    <View style={styles.wrap}>
      <Text style={[styles.tx, { fontSize: fs(12) }]}>
        지금까지 <Text style={styles.num}>{n(s.views_total)}</Text>번 함께 봤어요
        {s.readings_total > 0 ? <Text> · 풀이 <Text style={styles.num}>{n(s.readings_total)}</Text>건</Text> : null}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // 은은하게 — 광고가 아니라 '신뢰 신호'라 카드가 아닌 한 줄로 둔다.
  wrap: { alignItems: 'center', paddingVertical: space(4), paddingHorizontal: space(4), marginTop: space(2), backgroundColor: colors.sunk, borderRadius: radius.md },
  tx: { ...font.caption, color: colors.inkSoft, textAlign: 'center' },
  num: { color: colors.ju, fontWeight: '900' },
});
