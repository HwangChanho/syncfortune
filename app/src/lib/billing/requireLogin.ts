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

/**
 * 구매를 진행해도 되는가 — **익명 세션이면 통과한다**(2026-08-15 재수정).
 *
 * ★★왜 다시 여는가: 이 게이트 때문에 **5.1.1 로 두 번째 리젝**을 받았다(2026-08-14).
 *   Apple 원문: *"the app **still requires users to register** with personal information to purchase
 *   In-App Purchase products that **are not account based**"* ·
 *   *"revise the app to **not require users to register before purchasing**"*
 *
 *   즉 Apple 은 우리 코인(운)을 **계정형이 아니라고 본다.** 07-27 에 적어 둔 방어 논리
 *   ("구매 복원·기기 이전에 계정이 필요하므로 정당")는 **심사에서 받아들여지지 않았다.**
 *   두 번 같은 이유로 막혔으면 논리를 다시 세우는 게 아니라 요구를 따라야 한다.
 *
 * ■ 그래도 지켜지는 것 — 구매는 여전히 **uid 에 귀속**된다
 *   앱은 상시 **익명 세션**을 만든다(`useAuth.ensureAnonSession`). 익명도 안정 uid·profiles·RLS 격리를
 *   갖고, 로그인하면 `linkIdentity` 로 **같은 uid 를 승격**해 코인이 그대로 따라온다.
 *   ⇒ "로그인해야 복원된다"가 아니라 "**로그인하면 다른 기기에서도 쓸 수 있다**"가 정확한 설명이고,
 *     그건 Apple 이 Next Steps 에서 직접 권한 문구다.
 *
 * ⚠️07-27 daniel 지적("비회원인데 사주 풀이가 되잖아")과 충돌하는 것처럼 보이지만 다르다 —
 *   그때 막으려던 건 **공짜로 쓰는 것**이고, 여기는 **돈을 낸 사람**이다.
 *   무료 콘텐츠 경계는 이 파일이 아니라 각 화면의 게이트가 정한다(그건 손대지 않았다).
 *
 * @returns 구매 진행 가능하면 true. 세션 자체가 없으면(익명 생성 실패) 안내 후 false.
 */
export function requireLoginForPurchase(
  session: Session | null,
  goLogin: () => void,
  t: (k: string) => string,
): boolean {
  // ★익명 세션이어도 통과 — uid 만 있으면 구매를 그 uid 에 붙일 수 있다.
  if (session?.user?.id) return true;
  // 여기 오는 경우 = 익명 세션조차 못 만든 상태(네트워크 등). 그때는 로그인이 유일한 길이다.
  Alert.alert(t('purchase.loginTitle'), t('purchase.loginMsg'), [
    { text: t('common.cancel'), style: 'cancel' },
    { text: t('purchase.loginCta'), onPress: goLogin },
  ]);
  return false;
}

/**
 * 구매가 끝난 뒤 **한 번** 보여줄 안내 — "로그인하면 다른 기기에서도".
 *
 * ★Apple Next Steps 원문: *"You may explain to the user that registering will enable them to access
 *   the purchased content from any of their supported devices and **provide them a way to register at
 *   any time**"* — 강제하지 말고 **알려 주고 길을 열어 두라**는 뜻이다.
 * @returns 안내를 띄웠으면 true(등록 유저면 띄우지 않는다)
 */
export function suggestLoginAfterPurchase(goLogin: () => void, t: (k: string) => string): boolean {
  if (isRegisteredUser()) return false;          // 이미 등록 유저면 할 말이 없다
  Alert.alert(t('purchase.syncTitle'), t('purchase.syncMsg'), [
    { text: t('purchase.syncLater'), style: 'cancel' },
    { text: t('purchase.loginCta'), onPress: goLogin },
  ]);
  return true;
}
