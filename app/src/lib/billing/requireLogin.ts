// app/src/lib/requireLogin.ts — 결제 전 로그인 게이트
// ─────────────────────────────────────────────────────────────────────────
// 구매(프리미엄·건당)는 계정(RevenueCat appUserID=Supabase user.id)에 귀속돼야
//   다른 기기·재설치에서도 복원된다. 미로그인 시: '저장용' 안내 + 로그인 유도 → false.
//
// ★★2026-07-27 근본수정(daniel "비회원인데 사주 풀이가 되잖아 자꾸"):
//   기존 조건이 `session?.user` 였는데 **익명 세션도 user 를 갖는다**(앱은 상시 익명 세션을 만든다).
//   그래서 이 게이트는 사실상 아무도 막지 못했고, 비회원이 그대로 구매·생성까지 갔다.
//   ⇒ **등록 유저(익명 아님)** 로 판정한다. 위 주석에 적힌 원래 의도를 그제야 지키게 된다.
//
//   ⚠️심사 관점(중요): 이 앱은 5.1.1 로 리젝된 적이 있다(2026-07-08).
//   그래서 **무료·온디바이스 콘텐츠(명식·오늘운세·타로 등)는 계속 계정 없이** 쓸 수 있어야 한다(ADR-037·규칙5).
//   여기서 막는 것은 **구매·유료 생성뿐**이고, 그건 '구매 복원·기기 이전에 계정이 필요'라는
//   정당한 사유가 있어 5.1.1 상 방어 가능하다. 이 경계를 무료 콘텐츠로 넓히지 말 것.
// ─────────────────────────────────────────────────────────────────────────
import { Alert } from '../ui/alert'; // 커스텀 알림(앱 디자인)
import type { Session } from '@supabase/supabase-js';
import { isRegisteredUser } from '../useAuth'; // ★익명 세션과 등록 유저를 구분(session.user 만으로는 못 가른다)

/** 로그인됨 → true. 미로그인 → 안내 알림(로그인 유도) 후 false. */
export function requireLoginForPurchase(
  session: Session | null,
  goLogin: () => void,
  t: (k: string) => string,
): boolean {
  // ★`session?.user` 로 보면 익명도 통과한다 — 반드시 '등록 유저'로 판정할 것.
  if (session?.user && isRegisteredUser()) return true;
  Alert.alert(t('purchase.loginTitle'), t('purchase.loginMsg'), [
    { text: t('common.cancel'), style: 'cancel' },
    { text: t('purchase.loginCta'), onPress: goLogin },
  ]);
  return false;
}
