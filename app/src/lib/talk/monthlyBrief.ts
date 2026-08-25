// app/src/lib/talk/monthlyBrief.ts — 노쌤이 보내는 **이달의 총 흐름**
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-08-25 *"일간별운세 전에 총 운흐름내용 정리해서
//   «여러분의 운은 어떻게 될까요» 이런식으로 메세지 보내는거지 노쎔이"*
//
// ■ 구조 — 카톡 채널이 그렇다
//   ①노쌤이 **이번 달 전체 흐름**을 한 번 보낸다(누구에게나 같은 이야기)
//   ②끝에 *"여러분의 운은 어떻게 될까요?"* 로 **각자 운세**로 넘긴다
//   ③영상이 있으면 같이 붙는다(월별 운세 영상)
//   ⇒ 총평은 **공통**, 그다음이 **개인**. 이 순서가 «방송을 보고 내 것을 확인하는» 결이다.
//
// ■ ★한 달에 **한 번만** 온다
//   방을 열 때마다 오면 그건 공지가 아니라 잔소리다. 그 달 것을 봤으면 다시 안 띄운다.
//   ⚠️기기에만 기록한다 — 서버에 두면 «봤다»를 관리할 표가 하나 더 늘고, 그만한 값이 아니다.
//
// ■ 내용은 **운영자가 넣는다**(앱 배포 없이)
//   `app_config.monthly_brief` = { "2026-08": { "body": "…" } }
//   영상은 **별도 표**(`fortune_video`)에서 같은 달 키로 붙는다 — 주소를 두 곳에 두지 않는다.
//   ⚠️없으면 **아무것도 안 온다** — 빈 공지를 보내지 않는다.
// ═══════════════════════════════════════════════════════════════════════════
import * as SecureStore from 'expo-secure-store';
import { supabase } from '../supabase';
import { withTimeout } from '../core/withTimeout';

/**
 * 이 달 공지 한 건.
 * ⚠️영상 주소는 **여기 두지 않는다** — `app_config.fortune_video` 표 하나가 정본이고,
 *   `FortuneVideoCard` 가 그 달 키로 찾아 없으면 안 그린다. 두 곳에 두면 갈린다.
 */
export type MonthlyBrief = { periodKey: string; body: string };

/** 본 달을 기록하는 키 — 값은 `2026-08` 같은 달 문자열. */
const SEEN_KEY = 'monthly_brief_seen';

/** 이번 달 키(`YYYY-MM`). 절기가 아니라 **달력 달**이다 — 공지는 사람 달력으로 온다. */
export function thisPeriodKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * 아직 안 본 이달 공지를 가져온다.
 *
 * @returns 없거나 이미 봤으면 `null`
 */
export async function pendingMonthlyBrief(): Promise<MonthlyBrief | null> {
  const key = thisPeriodKey();
  try {
    const seen = await SecureStore.getItemAsync(SEEN_KEY);
    if (seen === key) return null;                        // 이 달 것은 이미 봤다
  } catch { /* 저장소를 못 읽으면 그냥 진행 — 한 번 더 보이는 편이 안 보이는 것보다 낫다 */ }
  try {
    const r = await withTimeout(
      supabase.from('app_config').select('value').eq('key', 'monthly_brief').maybeSingle(), 8000,
    ) as { data?: { value?: unknown } | null; error?: unknown } | undefined;
    if (!r || r.error) return null;
    const map = r.data?.value as Record<string, unknown> | undefined;
    const row = map && typeof map === 'object' ? (map[key] as Record<string, unknown> | undefined) : undefined;
    const body = typeof row?.body === 'string' ? row.body.trim() : '';
    if (!body) return null;                               // ★내용이 없으면 안 보낸다
    return { periodKey: key, body };
  } catch { return null; }
}

/** 봤다고 기록한다(그 달 다시 안 뜬다). */
export async function markBriefSeen(periodKey: string): Promise<void> {
  try { await SecureStore.setItemAsync(SEEN_KEY, periodKey); } catch { /* 기록 실패 = 한 번 더 뜬다 */ }
}
