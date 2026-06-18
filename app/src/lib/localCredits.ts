// app/src/lib/localCredits.ts — 비로그인(디바이스) 구매 이용권 저장 + 로그인 시 계정 이관(daniel H)
// ─────────────────────────────────────────────────────────────────────────
// daniel(2026-06): "비로그인 상태일 땐 디바이스별로 구매상품을 정리하고, 그 상태에서 로그인하면
//   사용자한테 물어보고 (계정으로) 이관되게 한다."
//   · RevenueCat 영수증(구매 자체)은 익명→로그인 alias(Purchases.logIn)로 자동 따라온다.
//   · 서버 크레딧(entitlement_credits)은 owner(uid) 전용이라, 비로그인 구매분은 여기(로컬)에 쌓고
//     로그인 시 grant_credit 으로 서버에 옮긴 뒤 로컬을 비운다(중복 지급 방지).
//   · kind 별 잔여 수를 SecureStore(JSON)에 보관 — 사용(localUse)·지급(localGrant)·조회·초기화.
// ─────────────────────────────────────────────────────────────────────────
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { CreditKind } from './coupons';

const KEY = 'local_credits_v1'; // { [kind]: remaining }

async function read(): Promise<Record<string, number>> {
  try {
    const raw = Platform.OS === 'web' ? (globalThis as any).localStorage?.getItem(KEY) : await SecureStore.getItemAsync(KEY);
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch { return {}; }
}
async function write(m: Record<string, number>): Promise<void> {
  try {
    const s = JSON.stringify(m);
    if (Platform.OS === 'web') (globalThis as any).localStorage?.setItem(KEY, s);
    else await SecureStore.setItemAsync(KEY, s);
  } catch { /* 저장 실패는 조용히(최악=구매분 1회 손실, 크래시 없음) */ }
}

/** 비로그인 구매 성공 시 로컬 크레딧 +qty. */
export async function localGrant(kind: CreditKind, qty = 1): Promise<void> {
  const m = await read();
  m[kind] = (m[kind] ?? 0) + qty;
  await write(m);
}

/** 비로그인 사용 시 로컬 크레딧 1 차감 — 있으면 true(무료 진행), 없으면 false. */
export async function localUse(kind: CreditKind): Promise<boolean> {
  const m = await read();
  if ((m[kind] ?? 0) <= 0) return false;
  m[kind] -= 1;
  if (m[kind] <= 0) delete m[kind];
  await write(m);
  return true;
}

/** 로컬 보유 크레딧 전체(kind→수량) — 게이트 표시·이관 판단용. */
export async function localCreditsAll(): Promise<Record<string, number>> {
  const m = await read();
  return Object.fromEntries(Object.entries(m).filter(([, v]) => v > 0));
}

/** 이관 완료 후 로컬 비우기(중복 지급 방지). */
export async function localClear(): Promise<void> {
  await write({});
}
