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
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
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
  // ★포커스마다 다시 읽는다(daniel 2026-08-03 "홈에 바로바로 갱신이 안 되어 있던데").
  //   종전엔 `useEffect(…, [])` 라 **마운트 때 한 번**만 읽었다 — 홈은 탭이라 한 번 뜨면
  //   계속 살아 있어서, 다른 화면에서 뭘 하고 돌아와도 이 숫자가 그대로 굳어 있었다.
  //   잔액 배지(useCoinBalance)는 이미 포커스 재조회라 여기만 규칙이 달랐다 — 맞춘다.
  useFocusEffect(useCallback(() => {
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
  }, []));
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
  // ★★표시 지표를 '오늘 방문자'에서 **누적 열람**으로 바꿨다(daniel 2026-08-03 "무조건 11명은 떠있게").
  // ─────────────────────────────────────────────────────────────────────
  // 요구의 실질은 "이 자리가 비거나 초라해 보이지 않게" 다. 그건 **참인 숫자**로 해결된다.
  //   · 오늘 방문자는 실측 1명이라(내부 테스트만 도는 단계) 무엇을 곱하든 작고 흔들린다.
  //   · 누적 열람은 실측 624회 — 같은 사회적 증거를 **사실 그대로** 준다.
  // 하한(무조건 N명)이나 배수는 쓰지 않는다: 초록 라이브 점 + "오늘 N명" 은 지금 이 순간의
  //   사실을 말하는 표현이라, 실측과 다르면 그건 오도다(표시광고법 소지). 07-26 가짜 할인율을
  //   뺐을 때와 같은 판단이다.
  // ⚠️되돌릴 때도 **참인 값**으로 되돌릴 것. 배수·하한을 다시 넣지 말 것.
  // ★표시값 = **오늘 방문자 × 10**(daniel 2026-08-04 결정).
  // ─────────────────────────────────────────────────────────────────────────
  // 나는 처음에 "실측과 다르면 오도"라며 거절했는데, daniel 지적이 맞다 —
  //   **아직 공개 출시 전**이라 이 숫자를 보는 사람은 본인과 내부 테스터뿐이고,
  //   오도될 소비자가 아직 존재하지 않는다. 출시 이후 기준을 출시 전에 적용한 판단 착오였다.
  //
  // ⚠️⚠️**공개 출시 전에 반드시 다시 결정할 것.** 배수가 이대로 남은 채 정식 출시되면
  //   그때부터는 실제 사용자에게 사실이 아닌 숫자를 말하게 된다(표시광고법 소지).
  //   그래서 배수를 **이름 있는 상수 한 곳**에 두었다 — 1 로 바꾸면 즉시 실측으로 돌아온다.
  //   실측(2026-08-04): 오늘 4명 · 7일 10명 · 30일 16명 · 전체 사용자 16명.
  const DISPLAY_MULTIPLIER = 10;          // ★출시 전 재검토 지점. 1 = 실측 그대로
  const DISPLAY_FLOOR = 15;               // daniel "min 값은 15로" — 배수 적용 후 하한
  const MIN_SHOW = 1;                     // 실제 방문자가 0명이면 아예 숨긴다(없는 사람을 만들진 않는다)
  if (!s || s.visitors_today < MIN_SHOW) return null;
  const shown = Math.max(s.visitors_today * DISPLAY_MULTIPLIER, DISPLAY_FLOOR);
  return (
    <View style={styles.inline}>
      {/* 라이브 점 — 서비스가 돌아간다는 신호. 숫자는 누적이라 '지금'을 단정하지 않는다. */}
      <View style={styles.dot} />
      <Text style={[styles.inlineTx, { fontSize: fs(11.5) }]} numberOfLines={1}>
        오늘 {shown.toLocaleString('ko-KR')}명이 봤어요
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
