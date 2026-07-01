// app/src/components/ExpiryNote.tsx
// ─────────────────────────────────────────────────────────────────────────
// 풀이 보유 만료일 안내(공통) — "이 풀이는 YYYY.MM.DD까지 보유돼요 · 이후 재구매 필요".
//   ★공통 추출(daniel 07-01): 콘텐츠 풀이마다 중복되던 기간표시를 한 컴포넌트로 모아
//   가드·문구·스타일을 *한 곳에서* 수정 가능하게. 프리미엄(계정 or 이 명식 지정)이면 숨김.
//   각 화면은 expiry(생성일+1년 포맷 문자열)와 chartId만 넘긴다. expiry=null이면 미표시.
// ─────────────────────────────────────────────────────────────────────────
import { Text } from 'react-native';
import { useSubscription } from '../lib/billing/subscription';
import { isPremiumForChart } from '../lib/billing/premiumStore';
import { useFontScale } from '../lib/ui/fontScale';
import { colors, space } from '../lib/theme';

export function ExpiryNote({ expiry, chartId }: { expiry: string | null; chartId?: string | null }) {
  const { isPremium } = useSubscription();
  const { fs } = useFontScale();
  // 만료일 없거나(무료·미생성), 프리미엄 계정, 또는 이 명식이 프리미엄 지정 → 숨김(공통 가드 한 곳).
  if (!expiry || isPremium || isPremiumForChart(chartId)) return null;
  return (
    <Text style={{ fontSize: fs(12), color: colors.inkFaint, marginBottom: space(3), textAlign: 'center', lineHeight: 18 }}>
      이 풀이는 {expiry}까지 보유돼요 · 이후 다시 보려면 재구매가 필요해요
    </Text>
  );
}
