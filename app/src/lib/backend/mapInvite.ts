// app/src/lib/backend/mapInvite.ts — 관계 지도 초대(링크 만들기 · 친구가 넣은 것 회수)
// ═══════════════════════════════════════════════════════════════════════════
// daniel 2026-08-14: *"공유해서 서로 입력하면서 공유 가능하게"*
//
// ■ 흐름
//   ① `createInvite()` — 초대장 1개를 만들고 **공유할 링크**를 돌려준다
//   ② 친구가 웹(docs/join)에서 이름·생년월일을 넣는다
//   ③ `collectEntries()` — 내 앱이 그걸 **내 명식으로 저장**하고 **서버 행을 지운다**
//
// ■ ★③ 에서 지우는 것이 핵심이다
//   서버에 남의 생년월일이 평문으로 있는 시간을 최소로 만드는 게 이 설계의 전부다.
//   저장에 성공한 것만 지운다 — 저장이 실패했는데 지우면 친구가 넣은 게 **영영 사라진다**
//   (다시 넣어 달라고 부탁해야 한다). 그래서 순서가 **저장 → 삭제**다.
//
// ■ 로그인이 필요하다
//   초대장은 `owner_id` 로 묶이므로 비로그인은 만들 수 없다. 화면이 먼저 안내해야 한다.
// ═══════════════════════════════════════════════════════════════════════════
import { supabase } from '../supabase';
import { withTimeout } from '../core/withTimeout';
import { addChart, listCharts } from '../engine/myChart';
import { logEvent } from './logger';

/** 친구가 여는 웹 페이지. GitHub Pages(main/docs) — Supabase 는 HTML 을 못 서빙한다. */
const JOIN_BASE = 'https://hwangchanho.github.io/syncfortune/join/';
const NET_TIMEOUT_MS = 12_000;

export type InviteLink = { token: string; url: string };

/**
 * 초대장을 만들고 공유용 링크를 돌려준다.
 *
 * @param ownerLabel 친구 화면에 보일 내 표시명(닉네임 등). 없으면 '친구'로 뜬다.
 * @returns 링크 · 로그인 안 됐거나 실패면 null
 */
export async function createInvite(ownerLabel?: string): Promise<InviteLink | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) return null;                    // 화면이 로그인 안내를 띄운다

  const res = await withTimeout(
    supabase.from('map_invites')
      .insert({ owner_id: session.user.id, owner_label: (ownerLabel ?? '').trim() || null })
      .select('id').single(),
    NET_TIMEOUT_MS,
  );
  if (!res || res.error || !res.data) {
    logEvent('map_invite_create_fail', { message: res?.error?.message ?? 'timeout' }, 'error');
    return null;
  }
  const token = String(res.data.id);
  logEvent('map_invite_created', {});
  return { token, url: `${JOIN_BASE}?t=${token}` };
}

/**
 * 친구들이 넣은 것을 **내 명식으로 회수**한다.
 *
 * @returns 새로 담은 사람 수(0이면 조용히 지나간다 — 화면이 매번 알릴 필요는 없다)
 *
 * ★같은 사람이 두 번 눌러 두 번 들어왔을 수 있다 — 생년월일이 같으면 **한 번만** 담는다.
 *   이미 갖고 있는 명식과도 대조한다(초대 링크를 두 번 뿌린 경우).
 */
export async function collectEntries(): Promise<number> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) return 0;

  const res = await withTimeout(
    supabase.from('map_invite_entries')
      .select('id, display_name, birth_datetime, calendar, sex, time_unknown, birth_place')
      .order('created_at', { ascending: true }).limit(50),
    NET_TIMEOUT_MS,
  );
  if (!res || res.error || !res.data?.length) return 0;

  // 이미 있는 명식의 지문(생일+성별+역법) — 중복 등록 방지
  const existing = new Set((await listCharts()).map(
    (c) => `${c.input?.birthDateTime ?? ''}|${(c.input as any)?.sex ?? ''}|${(c.input as any)?.calendar ?? ''}`,
  ));

  const saved: number[] = [];
  let added = 0;
  for (const e of res.data as any[]) {
    const input = {
      birthDateTime: String(e.birth_datetime),
      calendar: (e.calendar === '음' ? '음' : '양') as '양' | '음',
      // 친구가 "시각을 몰라요"를 눌렀으면 그대로 실어야 한다 — 아는 척하면 시주가 허수인 채로 풀린다
      // ⚠️계약은 '정확'|'추정'|**'미상'** 이다('모름' 이 아니다 — 2026-08-14 에 그렇게 썼다가 실측으로 잡았다).
      //   addChart(input: any) 라 **tsc 가 못 잡는다** — 계약 값은 spec/chart.ts 를 열어 확인할 것.
      timeAccuracy: (e.time_unknown ? '미상' : '정확') as '정확' | '추정' | '미상',
      sex: e.sex ?? undefined,
      birthPlace: e.birth_place ?? '서울특별시',   // 앱 등록 폼과 같은 기본값(진태양시 보정용)
      label: String(e.display_name).slice(0, 24),
      relation: 'friend',
    };
    const fp = `${input.birthDateTime}|${input.sex ?? ''}|${input.calendar}`;
    if (existing.has(fp)) { saved.push(e.id); continue; }   // 이미 있음 → 저장은 건너뛰되 서버에선 지운다
    try {
      await addChart(input);
      existing.add(fp);
      saved.push(e.id);
      added++;
    } catch (err) {
      // ★저장 실패한 것은 **지우지 않는다** — 지우면 친구가 넣은 게 영영 사라진다
      logEvent('map_invite_save_fail', { message: (err as Error).message }, 'error');
    }
  }

  // 저장에 성공(또는 이미 보유)한 것만 서버에서 제거 — 평문 체류 시간을 줄이는 게 이 설계의 핵심
  if (saved.length) {
    await withTimeout(supabase.from('map_invite_entries').delete().in('id', saved), NET_TIMEOUT_MS)
      ?.catch?.(() => {});
  }
  if (added) logEvent('map_invite_collected', { added });
  return added;
}
