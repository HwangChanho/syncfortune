// app/src/lib/talk/myProfile.ts — 내 프로필 (친구목록 상단 "나")
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-08-20: *"설정에서 이름이랑 사진도 변경 가능해야해"*
//
// ■ 이름은 세 곳에 있다 — 헷갈리지 않게 여기 적어 둔다
//   · `profiles.display_name` — **친구목록의 나**. 이 파일이 다루는 값
//   · `profiles.nickname`     — 커뮤니티(전면 익명). 목적이 반대라 섞지 않는다
//   · `charts.label`          — 명식 이름('본인'·'엄마'처럼 관계어일 수 있다)
//   ★기본값은 명식 이름이다(아무것도 안 정한 사람에게 빈 자리를 보이지 않기 위해).
//     사용자가 한 번이라도 정하면 그때부터 `display_name` 이 이긴다.
//
// ■ 로그인 전에는 저장하지 않는다
//   프로필은 계정에 붙는다. 익명 상태에서 바꾸면 로그인 후 사라져 더 나쁘다.
// ═══════════════════════════════════════════════════════════════════════════
import { supabase } from '../supabase';
import { withTimeout } from '../core/withTimeout';

export type MyProfile = { name: string | null; avatarUrl: string | null };

let _cache: MyProfile | null = null;
const subs = new Set<() => void>();

/** 프로필 변경 알림 — 친구목록이 즉시 다시 그리게. */
export function subscribeProfile(fn: () => void): () => void {
  subs.add(fn);
  return () => { subs.delete(fn); };
}
const notify = () => subs.forEach((f) => f());

/** 지금 캐시된 값(동기 — 첫 렌더용). */
export function profileSnapshot(): MyProfile {
  return _cache ?? { name: null, avatarUrl: null };
}

/**
 * 서버에서 프로필을 읽는다.
 * @returns 이름·사진 URL. 못 읽으면 둘 다 null(호출측이 명식 이름으로 폴백)
 */
export async function loadMyProfile(): Promise<MyProfile> {
  const r = await withTimeout(
    supabase.from('profiles').select('display_name, avatar_path').maybeSingle(),
    8000,
  );
  const row = r && !r.error ? (r.data as any) : null;
  _cache = {
    // ⚠️★이메일은 **이름이 아니다**(2026-08-20 실물에서 `cksgh0…` 로 떴다).
    //   `profiles.display_name` 은 로그인할 때 이메일이 자동으로 들어가는 자리라,
    //   사용자가 직접 정한 이름과 **섞여 있다**. `@` 가 있으면 안 쓴다 → 명식 이름으로 떨어진다.
    //   ⇒ 사용자가 설정에서 저장하면 그 값이 들어와 이 검사를 통과한다.
    name: displayNameOf(row?.display_name),
    avatarUrl: row?.avatar_path ? publicUrl(row.avatar_path) : null,
  };
  notify();
  return _cache;
}

/** 이름으로 쓸 수 있는 값인가 — 이메일·빈 값은 이름이 아니다. */
function displayNameOf(v: unknown): string | null {
  const t = typeof v === 'string' ? v.trim() : '';
  if (!t || t.includes('@')) return null;
  return t;
}

/** Storage 경로 → 공개 URL. ★버킷이 public 이라 서명이 필요 없다. */
function publicUrl(path: string): string {
  return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
}

/**
 * 이름 저장.
 * @param name 빈 문자열이면 **지운다**(명식 이름으로 되돌아간다)
 * @returns 저장 성공 여부. ★실패 사유를 삼키지 않는다(호출측이 알려야 한다)
 */
export async function saveMyName(name: string): Promise<{ ok: boolean; error?: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'unauthorized' };
  const v = name.trim().slice(0, 20) || null;   // 20자 — 목록 한 줄에 들어가는 길이
  const { error } = await supabase.from('profiles')
    .upsert({ id: user.id, display_name: v }, { onConflict: 'id' });
  if (error) return { ok: false, error: error.message };
  _cache = { ...profileSnapshot(), name: v };
  notify();
  return { ok: true };
}

/**
 * 사진 업로드.
 *
 * ★경로를 `<uid>/avatar.<ext>` 로 고정한다 — 바꿀 때마다 파일이 쌓이지 않고,
 *   Storage 정책이 '첫 칸이 내 uid' 를 요구하므로 남의 파일을 건드릴 수 없다.
 * ⚠️같은 경로에 덮어쓰면 CDN 캐시가 옛 사진을 계속 준다 → URL 에 버전 쿼리를 붙인다.
 *
 * @param file 브라우저 File 객체(웹) — 모바일은 `expo-image-picker` 가 붙은 뒤에 지원한다
 */
export async function uploadMyAvatar(file: Blob & { name?: string; type?: string }): Promise<{ ok: boolean; url?: string; error?: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'unauthorized' };
  if (file.size > 2 * 1024 * 1024) return { ok: false, error: 'too_large' };
  const ext = (file.type ?? '').includes('png') ? 'png' : (file.type ?? '').includes('webp') ? 'webp' : 'jpg';
  const path = `${user.id}/avatar.${ext}`;
  const up = await supabase.storage.from('avatars')
    .upload(path, file, { upsert: true, contentType: file.type || 'image/jpeg' });
  if (up.error) return { ok: false, error: up.error.message };
  const { error } = await supabase.from('profiles')
    .upsert({ id: user.id, avatar_path: path }, { onConflict: 'id' });
  if (error) return { ok: false, error: error.message };
  // ★버전 쿼리 — 같은 경로를 덮어썼으므로 이게 없으면 옛 사진이 계속 보인다
  const url = `${publicUrl(path)}?v=${Date.now()}`;
  _cache = { ...profileSnapshot(), avatarUrl: url };
  notify();
  return { ok: true, url };
}

/** 사진 지우기 — 파일은 남기고 참조만 끊는다(되돌릴 여지). */
export async function clearMyAvatar(): Promise<{ ok: boolean; error?: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'unauthorized' };
  const { error } = await supabase.from('profiles')
    .upsert({ id: user.id, avatar_path: null }, { onConflict: 'id' });
  if (error) return { ok: false, error: error.message };
  _cache = { ...profileSnapshot(), avatarUrl: null };
  notify();
  return { ok: true };
}
