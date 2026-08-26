/**
 * app/src/lib/talk/groupTalk.ts: **다인 대화방** — 상담가 여럿을 한 방에 부른다
 * ═════════════════════════════════════════════════════════════════════════
 * Boss 2026-08-25 *"노쎔이랑 대화중에 다른 사람을 초대할수 있어야해 그러면 채팅방이
 *   새로 만들어지고 카카오톡처럼 노쎔, 한서윤 이런식으로 보이고 나 포함 총 인원수도 떠야해"*.
 *
 * ■ ★왜 «새 방»인가 (Boss 가 그렇게 말했고, 그게 맞다)
 *   기존 1:1 방에 사람을 밀어 넣으면 **지난 대화의 상대가 바뀐다.** 카톡도 그래서
 *   초대하면 새 방을 판다. 원래 방은 그대로 남아야 «노쌤과 단둘이 한 이야기»가 보존된다.
 *
 * ■ ⚠️★반드시 짝으로 지켜야 하는 불변식 — 안 지키면 **1:1 방이 사라진 것처럼 보인다**
 *   `loadThread(consultantId)` 는 «그 상담가의 가장 최근 세션»을 집는다. 그룹방도
 *   `consultant_id` 를 그대로 갖고 있으므로, 필터를 안 걸면 1:1 방을 열었는데 그룹방이 열린다.
 *   ⇒ **1:1 조회는 `guest_ids` 가 빈 것만** 본다(`guest_ids=eq.{}`).
 *   ⇒ **그룹 조회는 `guest_ids` 가 안 빈 것만** 본다.
 *   `check:grouptalk` 가 이 두 짝을 지킨다.
 *
 * ■ ★한 턴에 답하는 사람은 **하나**다
 *   둘이 같이 답하면 LLM 호출이 인원수만큼 늘고 운도 그만큼 나간다. 게다가 사람도
 *   단톡방에서 한꺼번에 말하지 않는다. ⇒ 서버가 «이번 질문에 누가 맞는가»를 골라 그 사람만 답한다.
 */
import { supabase } from '../supabase';
import { withTimeout } from '../core/withTimeout';

/** 다인방 하나. `primaryId` 는 방을 연 상담가, `guestIds` 는 초대된 사람들. */
export type GroupRoom = {
  sessionId: string;
  primaryId: string;
  guestIds: string[];
  lastAt?: string;
};

/** 방에 있는 상담가 전원(연 사람 + 초대된 사람). 순서는 카톡처럼 **연 사람 먼저**. */
export function roomConsultantIds(r: { primaryId: string; guestIds: string[] }): string[] {
  return [r.primaryId, ...r.guestIds.filter((g) => g && g !== r.primaryId)];
}

/**
 * 방 이름 — 카톡처럼 이름을 쉼표로 잇는다. ("노쌤, 한서윤")
 * @param names 상담가 이름들(순서 = `roomConsultantIds`)
 * @param max 너무 길면 자르고 «외 N» 을 붙인다(헤더가 밀리지 않게)
 */
export function roomTitle(names: string[], max = 3): string {
  const kept = names.slice(0, max);
  const rest = names.length - kept.length;
  return rest > 0 ? `${kept.join(', ')} 외 ${rest}` : kept.join(', ');
}

/**
 * 방에 있는 **사람 전부** — 나를 맨 앞에 두고 나머지를 잇는다.
 *
 * Boss 2026-08-27: *"채팅방에는 나도 있으니깐 포함 3명으로 하고 나, 노쎔, 한서... 이런식으로"*
 *
 * ⚠️★**제목과 인원수는 이 배열 하나에서 나온다.** 따로 세면 갈린다 — 실제로 갈려 있었다:
 *   대화방 머리는 `mates.length + 1`(상담가 전부)로 셌는데 목록은 `guestIds.length`(초대된 사람만)로 세서
 *   **같은 방이 머리에서는 3, 목록에서는 2** 였다. 게다가 둘 다 «나» 를 안 셌다.
 *   ⇒ 세는 함수(`memberCount`)를 없애고 **배열의 길이**를 쓴다. 길이는 거짓말을 못 한다.
 *   ([[duplicate-ui-single-source]] — 주석에 «같은 함수를 쓴다» 고 적혀 있었지만 인자가 달랐다.)
 *
 * @param meLabel 「나」 — 화면 언어를 탄 글자를 받는다(여기서 문구를 정하지 않는다)
 * @param others  나 말고 방에 있는 사람 이름들(상담가·친구 구분 없음)
 */
export function roomMembers(meLabel: string, others: string[]): string[] {
  return [meLabel, ...others];
}

/**
 * 다인방을 **새로 만든다**.
 *
 * ⚠️이미 같은 조합의 방이 있으면 그것을 다시 쓴다 — 초대를 두 번 누를 때마다 방이
 *   늘어나면 목록이 금세 쓰레기가 된다(카톡도 같은 조합은 같은 방이다).
 *
 * @param primaryId 방을 연 상담가
 * @param guestIds  초대할 상담가들
 * @param chartId   이 방에서 볼 명식(1:1 방과 같은 것을 넘긴다)
 * @returns 세션 id. 실패하면 null (막지 않는다 — 화면은 1:1 로 남는다)
 */
export async function openGroupRoom(
  primaryId: string, guestIds: string[], chartId?: string | null,
): Promise<string | null> {
  const guests = [...new Set(guestIds.filter((g) => g && g !== primaryId))].sort();
  if (!guests.length) return null;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    // ★같은 조합이 이미 있나 — 정렬해 둔 배열이라 문자열 비교로 찾을 수 있다
    const found = await withTimeout(
      supabase.from('talk_sessions')
        .select('id, guest_ids').eq('consultant_id', primaryId).eq('owner_id', user.id)
        .not('guest_ids', 'eq', '{}').order('last_at', { ascending: false }).limit(20),
      8000,
    );
    const same = (found?.data as any[] ?? []).find(
      (r) => JSON.stringify([...(r.guest_ids ?? [])].sort()) === JSON.stringify(guests),
    );
    if (same?.id) return String(same.id);

    const { data, error } = await supabase.from('talk_sessions')
      .insert({ consultant_id: primaryId, guest_ids: guests, owner_id: user.id, chart_id: chartId ?? null })
      .select('id').single();
    if (error || !data) { console.warn('[group] 방 만들기 실패', error?.message); return null; }
    return String((data as any).id);
  } catch (e) {
    console.warn('[group] openGroupRoom 실패', e);
    return null;
  }
}

/**
 * 내 다인방 목록. ★`guest_ids` 가 **안 빈 것만** 본다(위 불변식).
 * @param limit 최대 개수
 */
export async function listGroupRooms(limit = 30): Promise<GroupRoom[]> {
  try {
    const r = await withTimeout(
      supabase.from('talk_sessions')
        .select('id, consultant_id, guest_ids, last_at')
        .not('guest_ids', 'eq', '{}')
        .order('last_at', { ascending: false }).limit(limit),
      8000,
    );
    if (!r || r.error || !Array.isArray(r.data)) return [];
    return (r.data as any[]).map((x) => ({
      sessionId: String(x.id),
      primaryId: String(x.consultant_id),
      guestIds: Array.isArray(x.guest_ids) ? x.guest_ids.map(String) : [],
      lastAt: x.last_at ?? undefined,
    }));
  } catch { return []; }
}

/**
 * 다인방의 지난 메시지를 읽는다.
 * @param sessionId 방 id
 */
export async function loadGroupThread(sessionId: string): Promise<
  { id: number; role: 'user' | 'assistant'; body: string; speaker?: string }[]
> {
  try {
    const m = await withTimeout(
      supabase.from('talk_messages')
        .select('id, role, body, speaker_id').eq('session_id', sessionId)
        .order('sent_at', { ascending: true }).limit(60),
      8000,
    );
    if (!m || m.error || !Array.isArray(m.data)) return [];
    return (m.data as any[]).map((x) => ({
      id: Number(x.id),
      role: x.role === 'user' ? 'user' as const : 'assistant' as const,
      body: String(x.body ?? ''),
      speaker: x.speaker_id ? String(x.speaker_id) : undefined,
    }));
  } catch { return []; }
}
