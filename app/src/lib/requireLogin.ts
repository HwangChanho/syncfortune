// app/src/lib/requireLogin.ts — 결제 전 로그인 게이트
// ─────────────────────────────────────────────────────────────────────────
// 구매(프리미엄·건당)는 계정(RevenueCat appUserID=Supabase user.id)에 귀속돼야
//   다른 기기·재설치에서도 복원된다. 미로그인 시: '저장용' 안내 + 로그인 유도 → false.
// ─────────────────────────────────────────────────────────────────────────
import { Alert } from 'react-native';
import type { Session } from '@supabase/supabase-js';

/** 로그인됨 → true. 미로그인 → 안내 알림(로그인 유도) 후 false. */
export function requireLoginForPurchase(
  session: Session | null,
  goLogin: () => void,
  t: (k: string) => string,
): boolean {
  if (session?.user) return true;
  Alert.alert(t('purchase.loginTitle'), t('purchase.loginMsg'), [
    { text: t('common.cancel'), style: 'cancel' },
    { text: t('purchase.loginCta'), onPress: goLogin },
  ]);
  return false;
}
