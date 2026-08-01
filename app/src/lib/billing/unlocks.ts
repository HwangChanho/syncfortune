// app/src/lib/unlocks.ts — 통변 unlock 영속(차감 후 재차감/재잠금 방지)
// ─────────────────────────────────────────────────────────────────────────
// daniel(2026-06): "한번 unlock 하면 풀려야." 쿠폰·광고·결제로 한번 차감하면 그 (차트×종류)는
//   영구 무료 재생성이 되어야 한다. invoke(LLM)가 강제종료·홈이동·네트워크로 중단돼 일부만
//   생성됐어도, 재진입 시 재차감 없이 이어서 생성(돈 두 번 안 나감).
//   ※ 기기 로컬(SecureStore) 저장 — chart_id 는 서버 귀속이라 사실상 계정 단위로 동작한다.
//     비로그인 구매 이관(H)을 붙일 때 서버 테이블로 승격 가능(키 포맷 유지).
// ─────────────────────────────────────────────────────────────────────────
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { supabase } from '../supabase';

const key = (chartId: string, kind: string) => `unlock_${chartId}_${kind}`;

// 서버 조회 대상 판별 — reading_unlocks.chart_id 는 uuid 다. 'timeresolve' 처럼 차트가 아닌 키로 부르는
//   호출자가 있어(TPR_UNLOCK), uuid 가 아니면 서버를 때리지 않는다(불필요한 400·왕복 제거).
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * (차트×종류) unlock(차감 완료) 여부 — true 면 재차감 없이 무료 생성/재생성.
 * ★로컬 우선, 없으면 **서버 권위**(reading_unlocks)까지 확인한다.
 *   왜(daniel 2026-08-01 신고 "구매 → 풀이 도중 홈으로 → 배너로 재진입하면 또 결제"):
 *   로컬 스탬프(markUnlocked)는 **생성 성공 후에만** 찍힌다. 결제 직후 생성이 중단되면 로컬은 비어 있어
 *   로컬만 보는 게이트가 **결제창을 다시 띄운다**. Edge 는 차감 즉시 reading_unlocks 에 기록하므로 그걸 읽는다.
 *   (실제 차감은 서버가 하니 돈은 안 빠졌지만, 사용자에겐 '또 사라'로 보였다 — 그 화면을 없앤다.)
 */
export async function isUnlocked(chartId: string, kind: string): Promise<boolean> {
  try {
    const local = Platform.OS === 'web'
      ? (globalThis as any).localStorage?.getItem(key(chartId, kind)) === '1'
      : (await SecureStore.getItemAsync(key(chartId, kind))) === '1';
    if (local) return true;
  } catch { /* 저장소 접근 실패 → 서버로 폴백(잠금 단정하지 않는다) */ }
  if (!UUID_RE.test(chartId)) return false;      // 차트 id 가 아닌 키는 로컬 전용
  return isReadingUnlocked(chartId, kind);        // 서버 권위(조회 실패 = false, Edge 가 최종 판정)
}

/** 차감(쿠폰·광고·결제) 성공 직후 호출 — 그 (차트×종류)를 영구 unlock 으로 도장. */
export async function markUnlocked(chartId: string, kind: string): Promise<void> {
  try {
    if (Platform.OS === 'web') (globalThis as any).localStorage?.setItem(key(chartId, kind), '1');
    else await SecureStore.setItemAsync(key(chartId, kind), '1');
  } catch { /* 저장 실패는 조용히 — 다음 차감 때 다시 시도(최악=재차감 1회, 크래시는 없음) */ }
}

// ── 서버 권위 세트 언락(보안 P3, daniel 2026-06) — saju/ziwei/timeline 세트 단위 ──────────────
// Edge interpret 가 (크레딧 차감 후) reading_unlocks 에 기록한다. 클라는 *읽기만* — '이미 열림'이면
//   재결제 없이 바로 재생성. (로컬 markUnlocked 와 달리 서버 진실의 원천 → 기기 바뀌어도 유지.)
//   kind = 'reading'(saju) | 'ziwei' | 'timeline'.
export async function isReadingUnlocked(chartId: string, kind: string): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('reading_unlocks').select('chart_id').eq('chart_id', chartId).eq('kind', kind).maybeSingle();
    return !!data;
  } catch { return false; } // 조회 실패 = 잠김(보수적, Edge 가 최종 판정)
}
