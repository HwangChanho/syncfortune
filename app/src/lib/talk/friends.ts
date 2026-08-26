// app/src/lib/talk/friends.ts — 사용자끼리의 친구 (RPC 래퍼)
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-08-20: *"친구추가도 카톡처럼… 등록한 명식을 다른 친구가 확인도 가능하고 궁합도"*
//
// ■ ★쓰기는 전부 **RPC** 다 — `friends` 테이블에 직접 쓰지 않는다
//   직접 insert 를 열면 **남을 임의로 친구로 만들 수 있고**, 그 순간 상대 명식이 열린다.
//   (`check:friendgate` F3 가 이 파일에 직접 쓰기가 생기는 것을 막는다.)
//
// ■ ⚠️명식이 보이려면 조건이 **둘 다** 필요하다
//   ①accepted 친구 ②상대가 공개에 동의(`share_consent`).
//   ⇒ 서버가 `my_friends()` 에서 이미 걸러 준다 — `chartId` 가 null 이면 못 보는 것이다.
//     화면이 다시 판단하지 않는다(판단이 두 곳에 있으면 언젠가 갈린다).
// ═══════════════════════════════════════════════════════════════════════════
import { supabase } from '../supabase';
import { withTimeout } from '../core/withTimeout';

/** 친구 한 명 — 서버 `my_friends()` 가 주는 그대로. */
export type Friend = {
  otherId: string;
  name: string | null;
  avatarUrl: string | null;
  status: 'pending' | 'accepted';
  /** 내가 신청한 것인가 — **수락 버튼은 받은 쪽에만** 보여야 한다 */
  requestedByMe: boolean;
  /** 상대가 명식 공개에 동의했나 */
  shares: boolean;
  /** 볼 수 있는 상대 명식. ★null = 못 본다(동의 없음). 화면은 이 값만 보면 된다 */
  chartId: string | null;
  /**
   * ★**내가 이 친구에게** 명식을 여는가(Boss 2026-08-27 *"친구별로 열고 닫을수 있게"*).
   * ⚠️`shares` 와 방향이 **반대**다 — `shares` 는 «상대가 나에게», 이건 «내가 상대에게».
   *   둘을 헷갈리면 토글이 남의 설정을 바꾸는 것처럼 보인다.
   */
  iShare: boolean;
};

/** 신청 결과 — 화면이 서로 **다른 말**을 하도록 사유를 나눈다. */
export type RequestResult = 'sent' | 'accepted' | 'already' | 'self' | 'notfound' | 'unauthorized' | 'failed';

/** 내 친구 코드(없으면 서버가 만든다). */
export async function myFriendCode(): Promise<string | null> {
  const r = await withTimeout(supabase.rpc('my_friend_code'), 8000);
  if (!r || r.error) { if (r?.error) console.warn('[friends] 코드 조회 실패', r.error.message); return null; }
  return (r.data as string) ?? null;
}

/**
 * 친구 코드로 신청한다.
 * ★대소문자·공백은 서버가 정리한다 — 사람이 손으로 치는 값이라 여기서 막지 않는다.
 */
export async function requestFriend(code: string): Promise<RequestResult> {
  const c = code.trim().toUpperCase();
  if (c.length < 4) return 'notfound';
  const r = await withTimeout(supabase.rpc('friend_request', { p_code: c }), 8000);
  if (!r) return 'failed';
  if (r.error) { console.warn('[friends] 신청 실패', r.error.message); return 'failed'; }
  return (r.data as RequestResult) ?? 'failed';
}

/** 신청 수락. ★받은 쪽만 성공한다(서버가 판단). */
export async function acceptFriend(otherId: string): Promise<boolean> {
  const r = await withTimeout(supabase.rpc('friend_accept', { p_other: otherId }), 8000);
  if (!r || r.error) { if (r?.error) console.warn('[friends] 수락 실패', r.error.message); return false; }
  return r.data === true;
}

/** 친구 해제 · 신청 취소 · 거절 — 셋 다 같은 동작이다(행을 지운다). */
export async function removeFriend(otherId: string): Promise<boolean> {
  const r = await withTimeout(supabase.rpc('friend_remove', { p_other: otherId }), 8000);
  if (!r || r.error) { if (r?.error) console.warn('[friends] 해제 실패', r.error.message); return false; }
  return r.data === true;
}

/** 내 친구 목록. 실패하면 빈 배열(화면을 막지 않는다). */
export async function listFriends(): Promise<Friend[]> {
  const r = await withTimeout(supabase.rpc('my_friends'), 8000);
  if (!r || r.error || !Array.isArray(r.data)) {
    if (r?.error) console.warn('[friends] 목록 실패', r.error.message);
    return [];
  }
  return (r.data as any[]).map((x) => ({
    otherId: String(x.other_id),
    // ⚠️이메일은 이름이 아니다(로그인 시 `display_name` 에 자동으로 들어간다)
    name: typeof x.name === 'string' && x.name.trim() && !x.name.includes('@') ? x.name.trim() : null,
    avatarUrl: x.avatar_path ? supabase.storage.from('avatars').getPublicUrl(x.avatar_path).data.publicUrl : null,
    iShare: x.i_share === true,
    status: x.status === 'accepted' ? 'accepted' : 'pending',
    requestedByMe: !!x.requested_by_me,
    shares: !!x.shares,
    chartId: x.chart_id ?? null,
  }));
}

/**
 * 내 명식 공개 동의를 켜고 끈다.
 *
 * ⚠️★이 스위치가 켜지면 **친구가 내 원국 여덟 글자를 본다**. 여덟 글자로 생년월일이 역산되므로
 *   화면은 반드시 그 사실을 적고 나서 물어야 한다(`check:friendgate` 가 서버 쪽을 지킨다).
 * @param on 켤지 끌지
 */
export async function setShareConsent(on: boolean): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { error } = await supabase.from('profiles')
    .upsert({ id: user.id, share_consent: on, share_consent_at: on ? new Date().toISOString() : null },
            { onConflict: 'id' });
  if (error) { console.warn('[friends] 동의 저장 실패', error.message); return false; }
  return true;
}

/** 지금 내가 공개에 동의했나. */
export async function getShareConsent(): Promise<boolean> {
  const r = await withTimeout(supabase.from('profiles').select('share_consent').maybeSingle(), 8000);
  return !!(r && !r.error && (r.data as any)?.share_consent);
}

/**
 * 친구의 명식을 읽는다.
 *
 * ★서버가 **이미 계산해 둔 `saju`** 를 그대로 쓴다 — 생년월일(`birth_enc`)은 암호화돼 있고
 *   우리에게 필요한 것도 아니다. 계산을 다시 하지 않으므로 원가도 0이다.
 * ⚠️RLS 가 두 조건(accepted + share_consent)을 모두 볼 때만 행을 준다.
 *   ⇒ 못 읽으면 **null**이고, 그건 오류가 아니라 "아직 안 열었다"는 뜻이다.
 *
 * @param chartId `my_friends()` 가 준 값. null 이면 애초에 못 보는 것이라 부르지 않는다
 */
export async function loadFriendChart(chartId: string): Promise<{ saju: any; ziwei: any } | null> {
  const r = await withTimeout(
    supabase.from('charts').select('saju, ziwei').eq('id', chartId).maybeSingle(),
    8000,
  );
  if (!r || r.error || !r.data) {
    if (r?.error) console.warn('[friends] 친구 명식 조회 실패', r.error.message);
    return null;
  }
  const d = r.data as any;
  return d.saju ? { saju: d.saju, ziwei: d.ziwei ?? null } : null;
}

/**
 * 이 친구에게 **내 명식을 열고/닫는다** (Boss 2026-08-27).
 *
 * ★전역 설정(`profiles.share_consent`)은 **기본값**으로 남는다 — 친구별 값이 없으면 그걸 따른다.
 *   그래서 이 기능이 생겨도 기존 사용자의 설정이 그대로 유지된다.
 * ⚠️쓰기는 RPC 로만 한다 — `friends` 에 직접 쓰면 **남의 칸**(상대가 나에게 여는 값)도 바꿀 수 있다.
 * @returns 성공 여부
 */
export async function setFriendShare(otherId: string, open: boolean): Promise<boolean> {
  const r = await withTimeout(supabase.rpc('set_friend_share', { p_other: otherId, p_open: open }), 8000);
  if (!r || r.error) { console.warn('[friends] 공개 설정 실패', r?.error?.message); return false; }
  return r.data === true;
}
