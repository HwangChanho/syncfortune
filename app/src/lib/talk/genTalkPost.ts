// app/src/lib/talk/genTalkPost.ts — 풀이 진행·완료를 **담당자의 말로 대화방에 남긴다**
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-08-31: *"또 이렇게나와 채팅창에서 나와야지"* (홈 배너로 뜨던 것)
//              + *"완료되면 서윤이가 메세지보내고 내가 그화면에 없으면 푸시알림도 와야지"*
//
// ■ 왜 홈 배너가 아니라 대화방인가
//   이 알림은 **사람의 답장**이라는 것이 원래 설계였다(Boss 2026-08-25 *"대표 인물이 카톡으로
//   답장해주는 식으로"*). 그런데 실제로는 홈 상단에만 떠서, 정작 **그 사람과의 방** 에는
//   아무 말도 남지 않았다 — 나중에 방을 열면 아무 일도 없던 것처럼 보인다.
//   ⇒ 방에 남긴다. 그러면 이력에도 남고, 읽지 않으면 배지·푸시가 자연히 따라온다.
//
// ■ ★새 표를 만들지 않는다
//   담당자 판정은 `genReplier`(=`consultants.routes` 를 뒤집어 찾는 그것)를 그대로 쓰고,
//   문구도 `replyLine` 을 그대로 쓴다. 여기서 다시 분류하면 배너와 방이 **다른 사람**을 말한다.
//
// ■ ⚠️1:1 방을 고르는 규칙은 `liveTalk` 와 **같아야** 한다 — `guest_ids = '{}'`.
//   이 필터를 빼면 다인방에 진행 알림이 끼어든다(같은 실수를 그쪽에서 이미 겪었다).
// ═══════════════════════════════════════════════════════════════════════════
import { supabase } from '../supabase';
import { replierFor, replyLine, type GenState } from '../content/genReplier';

/** 이 사람과의 **1:1 방**을 찾고, 없으면 만든다. 실패하면 null(조용히 포기 — 알림 하나 때문에 흐름을 막지 않는다). */
async function ensureSoloSession(consultantId: string, ownerId: string): Promise<string | null> {
  try {
    const found = await supabase
      .from('talk_sessions')
      .select('id')
      .eq('consultant_id', consultantId)
      .eq('guest_ids', '{}')          // ★1:1 방만 — 다인방도 consultant_id 를 갖고 있다
      .order('last_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const id = (found?.data as any)?.id as string | undefined;
    if (id) return id;

    const made = await supabase
      .from('talk_sessions')
      .insert({ owner_id: ownerId, consultant_id: consultantId, guest_ids: [], last_at: new Date().toISOString() })
      .select('id')
      .maybeSingle();
    return ((made?.data as any)?.id as string | undefined) ?? null;
  } catch {
    return null;
  }
}

/**
 * 풀이 진행·완료를 담당자의 말로 남긴다.
 *
 * @param route      진행 중인 풀이의 경로(담당자를 이 값으로 찾는다)
 * @param label      풀이 이름(예: '궁합')
 * @param state      `working` 시작 · `done` 완료
 * @param chartLabel 어느 명식인지(있으면 말머리에 붙는다)
 * @returns 남긴 방의 상담가 id(푸시를 이 방으로 보내려고). 못 남겼으면 null
 *
 * ★실패는 **조용히 삼킨다** — 알림 한 줄 때문에 풀이 흐름이 끊기면 안 된다.
 *   다만 «남겼다» 고 거짓말하지 않으려고 성공했을 때만 id 를 돌려준다.
 */
export async function postGenToTalk(
  route: string,
  label: string,
  state: GenState,
  chartLabel?: string,
): Promise<string | null> {
  try {
    const who = replierFor(route);
    if (!who) return null;                                   // 담당자가 없으면 남길 방도 없다

    const { data: auth } = await supabase.auth.getUser();
    const uid = auth?.user?.id;
    if (!uid) return null;                                   // 비로그인은 남길 곳이 없다

    const sid = await ensureSoloSession(who.id, uid);
    if (!sid) return null;

    const head = chartLabel ? `${chartLabel} — ` : '';
    const { error } = await supabase.from('talk_messages').insert({
      session_id: sid,
      owner_id: uid,
      role: 'assistant',
      body: head + replyLine(state, label),
      // ★`source` 로 «사람이 친 말이 아니다» 를 남긴다 — 나중에 통계·재생성에서 갈라 볼 수 있다
      source: 'gen',
    });
    if (error) return null;

    // 방의 시각을 올려 목록 맨 위로 — 안 올리면 새 말이 왔는데 목록에서 아래에 묻힌다
    void supabase.from('talk_sessions').update({ last_at: new Date().toISOString() }).eq('id', sid);
    return who.id;
  } catch {
    return null;
  }
}
