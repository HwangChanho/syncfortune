// app/src/components/CommunityPulseCard.tsx — '함께 보는 사람들'(소셜 프루프)
// ─────────────────────────────────────────────────────────────────────────
// 자리 변천:
//   · 07-26 ①"하단에 인원을 상단으로" ②"today 방문자수 느낌으로" → 홈 최상단 **카드**(라이브 점 + 큰 숫자)
//   · 07-27 ③"이거 디자인 이상해. 바로가기 라인 우측에 작게 몇 명 방문했는지 띄워줘"(IMG_8205)
//     → 카드를 없애고 **상단 컨트롤 행 우측의 한 줄**로. 카드가 블록 하나를 통째로 쓰면서
//       아래쪽이 비어 균형이 깨져 있었다(실물 스크린샷으로 확인).
//
// ★★수치는 부풀리지 않는다 — 07-26 에 "×10 정도 부풀리자" 요청을 거절하고 daniel 승인받은 원칙.
//   ⚠️**단위를 '명'으로 쓰지 않는 이유(07-27 실측)**: daniel 요청 문구는 "몇 명 방문"이었지만
//     실제 값은 `visitors_total=6` · `visitors_today=2` 다. 큰 숫자 351 은 **열람 횟수**(사람 수 아님).
//     그래서 351 에 '명' 을 붙이면 **58배 부풀린 허위 표시**가 된다 → 단위를 '회'로 정확히 쓴다.
//     (사람 수를 그대로 쓰면 "6명"이라 초라해 소셜 프루프 효과가 없다. 숫자를 고르는 게 아니라
//      *큰 값에 맞는 정직한 단위*를 쓰는 것이 답이다.)
//
// 데이터: `get_public_stats()` RPC(집계 숫자만·개인정보 0·anon 허용). 실패하면 조용히 미표시.
// ⚠️문구 = Claude 초안 → ★daniel 검수 슬롯.
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { supabase } from '../lib/supabase';
import { useFontScale } from '../lib/ui/fontScale';
import { colors, space, font } from '../lib/theme';

/** 이 미만이면 아예 숨긴다 — 작은 수는 신뢰를 깎는다(부풀리는 대신 '숨긴다'). */
const MIN_VIEWS = 100;

type Stats = { readings_total: number; views_total: number; visitors_today: number };

/**
 * 공개 집계를 한 번 읽어 온다. 부가 정보라 실패는 조용히 삼킨다(홈 렌더에 영향 0).
 * @returns 집계 또는 null(로딩 중·실패·조회 불가)
 */
function usePublicStats(): Stats | null {
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
  return s;
}

/**
 * 상단 컨트롤 행(홈 배치 편집·바로가기) **우측에 붙는 한 줄** 소셜 프루프.
 * 규모가 작으면(MIN_VIEWS 미만) 아무것도 그리지 않는다 → 행 레이아웃이 그대로 유지된다.
 * ★단위는 '회'(열람 횟수) — 위 §수치 원칙 참조. '명'으로 바꾸려면 사람 수 값을 써야 한다.
 */
export function CommunityPulseInline() {
  const { fs } = useFontScale();
  const s = usePublicStats();
  if (!s || s.views_total < MIN_VIEWS) return null;
  return (
    <View style={styles.inline}>
      {/* 라이브 점 — '지금도 돌아간다'는 신호(방문자 카운터 관례). 의미색이라 액센트와 별개. */}
      <View style={styles.dot} />
      <Text style={[styles.inlineTx, { fontSize: fs(11.5) }]} numberOfLines={1}>
        {s.views_total.toLocaleString('ko-KR')}회 열람
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // marginLeft:'auto' = 같은 행의 칩들을 밀지 않고 **우측 끝에 붙는다**(행이 wrap 돼도 안전).
  inline: { flexDirection: 'row', alignItems: 'center', gap: space(1.5), marginLeft: 'auto', flexShrink: 1 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#2E9E5B' },
  inlineTx: { ...font.caption, color: colors.inkFaint, fontWeight: '700' },
});
