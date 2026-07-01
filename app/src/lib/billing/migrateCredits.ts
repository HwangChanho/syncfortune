// app/src/lib/migrateCredits.ts — 비로그인 디바이스 구매 → 로그인 계정으로 이관(daniel H)
// ─────────────────────────────────────────────────────────────────────────
// 로그인(세션 생성) 시점에 1회 호출. 디바이스 로컬에 쌓인 구매 이용권이 있으면 사용자에게 물어보고,
//   '옮기기'를 누르면 서버(grant_credit)로 적립한 뒤 로컬을 비운다(중복 지급 방지).
//   ※ RevenueCat 영수증 자체는 Purchases.logIn(alias)로 자동 이관되므로 여기선 '서버 크레딧'만 옮긴다.
//   ※ 한 번 띄우면 충분 — 사용자가 '나중에'를 누르면 로컬 유지(다음 로그인에 다시 물어봄).
// ─────────────────────────────────────────────────────────────────────────
import { Alert } from '../ui/alert';
import { localCreditsAll, localClear } from './localCredits';
import { grantCredit, CREDIT_KINDS, type CreditKind } from './coupons';

let asked = false; // 세션 내 중복 표시 방지(로그인 이벤트 연타)

/** 로그인 직후 호출 — 디바이스 구매분이 있으면 이관 확인 알림. */
export async function migrateLocalCreditsOnLogin(): Promise<void> {
  if (asked) return;
  const local = await localCreditsAll();
  const entries = Object.entries(local).filter(([, v]) => v > 0) as [CreditKind, number][];
  if (!entries.length) return;
  asked = true;

  const label = (k: CreditKind) => CREDIT_KINDS.find((c) => c.key === k)?.ko ?? k;
  const summary = entries.map(([k, v]) => `${label(k)} ×${v}`).join(', ');

  Alert.alert(
    '이용권 이관',
    `이 기기에서 구매한 이용권(${summary})이 있어요. 지금 로그인한 계정으로 옮길까요?`,
    [
      { text: '나중에', style: 'cancel', onPress: () => { asked = false; } }, // 보류 → 다음 로그인에 다시 물어봄
      { text: '옮기기', onPress: async () => {
          for (const [kind, qty] of entries) await grantCredit(kind, qty); // 세션 있음 → 서버 적립
          await localClear();                                              // 이관 완료 → 로컬 비움(중복 방지)
          Alert.alert('이관 완료', '구매한 이용권이 계정으로 옮겨졌어요.');
        } },
    ],
  );
}
