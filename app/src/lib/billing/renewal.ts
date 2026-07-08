// app/src/lib/billing/renewal.ts — 프리미엄 1주년 '모델 업그레이드 갱신' 흐름(daniel 2026-07-08 수익구조)
// ─────────────────────────────────────────────────────────────────────────
// 배경: interpret 재생성 게이트가 renewRequired(프리미엄 & 구매 1년 경과 & stale=새 분석 버전 있음)를 반환하면
//   풀이 화면(ReadingScreen·SpecialContentScreen)이 이 흐름을 호출한다:
//     ① '새로워진 점'(체인지로그) 안내 → ② premium_renew30(30% 할인) 구매 → ③ 웹훅이 구매일 리셋할 때까지 대기 → ④ 재생성 재시도(무료).
// ★daniel 원칙: "업그레이드된 내용을 유저가 인지할 수 있어야 한다" → 이 오퍼는 stale(진짜 L2_VER bump)일 때만 뜨고,
//   유저에게 '새로워진 점'을 명시한다. 빈 업그레이드(같은 내용 재판매) 구조적 방지.
// ─────────────────────────────────────────────────────────────────────────
import { Alert } from '../ui/alert'; // 커스텀 알림(큐 기반 크래시 방지) — RN Alert 호환 시그니처
import { supabase } from '../supabase';
import { purchasePremiumRenewalRC } from './purchases';
import { fetchPremiumPurchasedAt } from './premiumStore';
import { offerPremiumRenewal } from './repurchase';

/**
 * L2_VER(분석 버전) → '새로워진 점'(유저가 인지할 업그레이드 내용).
 * ★해자 강화로 분석 버전(interpret L2_VER)을 올릴 때마다 여기 항목을 추가한다 — 이게 갱신의 실질 가치이자 유저 인지 지점.
 *   예) 2: '혼인 시기 3레이어·입묘개고·자화발현 반영' — 실제 업그레이드 시 채운다. (현재 L2_VER=1, 항목 없음 = 갱신 게이트 미발동)
 */
export const L2_CHANGELOG: Record<number, string> = {
  // 1: 기본 버전(항목 없음). 2 이상부터 실제 업그레이드 내용을 적는다.
};

/**
 * 갱신 유도 → 구매 → (웹훅 구매일 리셋 대기) → onDone(재생성 재시도). 사용자 취소·미로그인·결제실패면 조용히 no-op.
 * @param opts.curL2Ver interpret 가 알려준 최신 분석 버전(체인지로그 조회 키)
 * @param opts.onDone   구매·리셋 완료 후 실행(=refreshReading 재호출: 이제 oneYearPassed=false 라 무료 재생성)
 */
export async function runPremiumRenewal(opts: { curL2Ver?: number; onDone: () => void }): Promise<void> {
  const whatsNew = opts.curL2Ver != null ? L2_CHANGELOG[opts.curL2Ver] : undefined;
  const body = whatsNew
    ? `그동안 AI가 더 정교해졌어요.\n\n새로워진 점 · ${whatsNew}\n\n30% 할인가로 더 깊은 풀이를 다시 받아보세요.`
    : '그동안 AI 모델이 업그레이드됐어요.\n30% 할인가로 더 깊은 풀이를 다시 받아보세요.';
  const ok = await new Promise<boolean>((resolve) => {
    Alert.alert('더 깊어진 AI로 다시 풀기', body, [
      { text: '다음에', style: 'cancel', onPress: () => resolve(false) },
      { text: '갱신하기', onPress: () => resolve(true) },
    ]);
  });
  if (!ok) return;
  try {
    const bought = await purchasePremiumRenewalRC();
    if (!bought) return;                                    // 사용자 취소
    // 웹훅이 premium_renew30 → 새 purchases 행(구매일 리셋)을 적재할 때까지 대기(최대 ~12s).
    //   그래야 재생성 재시도 시 interpret 의 oneYearPassed(최신 구매일)=false 라 게이트 통과. is_premium 은 원래 true(변화 없음).
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id) {
      for (let i = 0; i < 12; i++) {
        const iso = await fetchPremiumPurchasedAt(user.id);
        if (iso && !offerPremiumRenewal(iso, new Date())) break; // 최신 구매일이 1년 이내 = 리셋 완료
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
    opts.onDone();                                          // 재생성 재시도(구매일 리셋 → 게이트 통과)
  } catch (e: any) {
    Alert.alert('갱신', e?.message ?? '');
  }
}
