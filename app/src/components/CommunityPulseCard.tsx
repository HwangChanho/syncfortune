// app/src/components/CommunityPulseCard.tsx — '함께 보는 사람들'(소셜 프루프)
// ─────────────────────────────────────────────────────────────────────────
// 자리 변천:
//   · 07-26 ①"하단에 인원을 상단으로" ②"today 방문자수 느낌으로" → 홈 최상단 **카드**(라이브 점 + 큰 숫자)
//   · 07-27 ③"이거 디자인 이상해. 바로가기 라인 우측에 작게 몇 명 방문했는지 띄워줘"(IMG_8205)
//     → 카드를 없애고 **상단 컨트롤 행 우측의 한 줄**로. 카드가 블록 하나를 통째로 쓰면서
//       아래쪽이 비어 균형이 깨져 있었다(실물 스크린샷으로 확인).
//
// ★★수치는 부풀리지 않는다 — 07-26 에 "×10 정도 부풀리자" 요청을 거절하고 daniel 승인받은 원칙.
//   ⚠️단, 07-27 에 내가 **요청 자체를 바꿔 놓는 실수**를 했다: daniel 은 "오늘 방문자를 우측 상단에
//     작게" 라고 했는데, 나는 '오늘 2명은 초라해 보인다'는 내 판단으로 **누적 열람(351회)** 로 바꿔 달았다.
//     정직성 원칙이 지켜야 할 건 '숫자를 부풀리지 않는 것'이지 '작은 숫자를 감추는 것'이 아니다.
//     작아 보이는 것은 daniel 이 판단할 몫 → 요청대로 **오늘 방문자(명)** 를 그대로 표시한다.
//     (0명일 때만 숨긴다 — "오늘 0명"은 정보가 아니라 공백이라서.)
//
// 데이터: `get_public_stats()` RPC(집계 숫자만·개인정보 0·anon 허용). 실패하면 조용히 미표시.
// ⚠️문구 = Claude 초안 → ★daniel 검수 슬롯.
// ─────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { supabase } from '../lib/supabase';
import { useFontScale } from '../lib/ui/fontScale';
import { colors, space, font } from '../lib/theme';


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
 * 상단 컨트롤 행(홈 배치 편집·바로가기) **우측에 붙는 한 줄** — 오늘 방문자 수.
 * daniel 요청(07-27): "오늘 방문자 우측 상단에 작게".
 * 0명이면 그리지 않는다(공백 표시 방지) → 그 경우 행 레이아웃은 그대로 유지된다.
 */
export function CommunityPulseInline() {
  const { fs } = useFontScale();
  const s = usePublicStats();
  if (!s || s.visitors_today < 1) return null;
  return (
    <View style={styles.inline}>
      {/* 라이브 점 — '지금도 돌아간다'는 신호(방문자 카운터 관례). 의미색이라 액센트와 별개. */}
      <View style={styles.dot} />
      <Text style={[styles.inlineTx, { fontSize: fs(11.5) }]} numberOfLines={1}>
        오늘 {s.visitors_today.toLocaleString('ko-KR')}명
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
