// app/src/lib/backend/notifyInbox.ts — 앱 안 「알림함」 데이터 (시안 헤더의 종)
// ═══════════════════════════════════════════════════════════════════════════
// ■ 어디서 오나
//   새 테이블을 만들지 않았다. 이미 **발송 큐에 이력이 남는다**(보낸 뒤에도 `status='sent'` 로 존재).
//     · `user_notify_queue`      — 선물·개인 알림(route 로 열릴 화면까지 들고 있다)
//     · `community_notify_queue` — 커뮤니티 알림(내 글에 달린 반응)
//   두 곳을 각각 읽어 시간순으로 합친다. 서버 뷰를 만들지 않은 이유는 두 큐의 id 가 서로 다른
//   시퀀스라 합치면 키가 겹치기 때문 — 앱에서 출처를 접두사로 붙여 구분한다.
//
// ■ 읽음 표시
//   **마지막으로 알림함을 연 시각**만 로컬에 둔다. 그보다 새 알림을 '안 읽음'으로 센다.
//   기기별로 갈리지만, 배지 하나 때문에 서버 쓰기와 테이블을 늘리지 않는다.
//
// ⚠️로컬 알림(오늘의 운세 예약 푸시)은 기기가 직접 띄우는 것이라 **서버에 기록이 없다** → 알림함에 안 뜬다.
//   이건 지금 구조의 한계다. 서버 발송으로 옮기면 자연히 들어온다.
// ═══════════════════════════════════════════════════════════════════════════
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { supabase } from '../supabase';
import { withTimeout } from '../core/withTimeout';

const SEEN_KEY = 'pref.notifySeenAt';

/** 알림함 한 줄. */
export type InboxItem = {
  /** 출처를 포함한 고유 키(`u:12`·`c:34`) — 두 큐의 id 가 겹칠 수 있어서 붙인다 */
  key: string;
  title: string;
  body: string;
  /** 탭하면 열릴 화면(없으면 열 곳이 없다) */
  route: string | null;
  createdAt: string;
};

/** 조회 결과 — 실패와 '없음'을 타입에서 구분한다(빈 목록으로 위장하면 "알림이 사라졌다"가 된다). */
export type InboxResult = { items: InboxItem[] } | { error: true };

/**
 * 알림 한 줄을 **내 화면에서만** 감춘다 (Boss 2026-08-27 *"알림은 지울수도 있게해줘"*).
 *
 * ■ ★왜 «지우기» 가 아니라 «숨기기» 인가
 *   `user_notify_queue` 는 **발송 큐이자 기록**이다. 행을 지우면 «이 사람에게 보냈는가» 를 잃고,
 *   푸시 재전송·감사가 근거를 잃는다. ⇒ `hidden_at` 을 찍어 **그 사람 목록에서만** 뺀다.
 * ■ ⚠️왜 RPC 인가
 *   `update` 정책으로 열면 `status`·`recipient` 같은 **다른 컬럼도 같이** 열린다.
 *   RPC 는 «내 것의 hidden_at 만» 이라는 좁은 문이다(서버가 `auth.uid()` 로 판정한다).
 *
 * @param key `loadInbox` 가 준 키(`u:12` · `c:34`)
 * @returns 감췄으면 true. 남의 것이거나 이미 감춘 것이면 false
 */
export async function hideInboxItem(key: string): Promise<boolean> {
  const m = /^([uc]):(\d+)$/.exec(key);
  if (!m) return false;
  const r = await withTimeout(
    supabase.rpc('hide_notification', { p_source: m[1], p_id: Number(m[2]) }), 8000);
  return !!r && !r.error && r.data === true;
}

/**
 * 알림함 목록을 읽는다(최신순).
 * @param limit 최대 개수
 */
export async function loadInbox(limit = 100): Promise<InboxResult> {
  try {
    const { data: u } = await supabase.auth.getUser();
    if (!u?.user) return { items: [] };            // 비로그인 — 서버 알림이 있을 수 없다

    const [a, b] = await Promise.all([
      withTimeout(
        // ★숨긴 것은 뺀다(Boss 2026-08-27 *"알림은 지울수도 있게해줘"*).
        //   ⚠️행은 **지우지 않는다** — 이 표는 발송 큐이자 기록이다. 지우면 «보냈는가» 를 잃는다.
        supabase.from('user_notify_queue').select('id, title, body, route, created_at')
          .is('hidden_at', null)
          .order('created_at', { ascending: false }).limit(limit), 8000),
      withTimeout(
        supabase.from('community_notify_queue').select('id, title, body, post_id, created_at')
          .is('hidden_at', null)
          .order('created_at', { ascending: false }).limit(limit), 8000),
    ]);
    // ★둘 다 실패해야 실패다 — 한쪽만 막혀도 나머지는 보여 준다(알림이 통째로 사라지는 것보다 낫다)
    if ((!a || a.error) && (!b || b.error)) return { error: true };

    const items: InboxItem[] = [
      ...((a?.data ?? []) as any[]).map((r) => ({
        key: `u:${r.id}`, title: r.title, body: r.body, route: r.route ?? null, createdAt: r.created_at,
      })),
      ...((b?.data ?? []) as any[]).map((r) => ({
        key: `c:${r.id}`, title: r.title, body: r.body,
        route: r.post_id ? `/communityPost?id=${r.post_id}` : '/community', createdAt: r.created_at,
      })),
    ].sort((x, y) => (x.createdAt < y.createdAt ? 1 : -1)).slice(0, limit);

    return { items };
  } catch { return { error: true }; }
}

async function readSeenAt(): Promise<string> {
  try {
    const v = Platform.OS === 'web'
      ? (globalThis as any).localStorage?.getItem(SEEN_KEY)
      : await SecureStore.getItemAsync(SEEN_KEY);
    return v ?? '';
  } catch { return ''; }
}

/** 알림함을 지금 봤다고 기록한다(배지가 사라진다). */
export async function markInboxSeen(at: string): Promise<void> {
  try {
    if (Platform.OS === 'web') (globalThis as any).localStorage?.setItem(SEEN_KEY, at);
    else await SecureStore.setItemAsync(SEEN_KEY, at);
  } catch { /* 저장 실패 = 배지가 다시 뜰 뿐, 기능은 안 깨진다 */ }
}

/**
 * 안 읽은 알림 수.
 * @returns 개수. 조회 실패면 0(배지는 '모르면 안 띄운다' — 틀린 숫자보다 없는 편이 낫다)
 */
export async function unreadCount(): Promise<number> {
  const seen = await readSeenAt();
  const res = await loadInbox(50);
  if ('error' in res) return 0;
  if (!seen) return res.items.length;
  return res.items.filter((it) => it.createdAt > seen).length;
}
