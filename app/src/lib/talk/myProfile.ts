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
import { sizedImage } from '../media/imageUrl';   // 쓸 크기만큼만 받는다(2026-08-29)
import { withTimeout } from '../core/withTimeout';

export type MyProfile = { name: string | null; avatarUrl: string | null; coverUrl: string | null };
// ★`coverUrl` = 카카오톡식 프로필의 **배경 사진**(Boss 2026-08-26 *"배경이미지 사진이미지 있는창"*).
//   아바타와 **같은 버킷·같은 관용**을 쓴다(첫 칸이 내 uid · 같은 경로 덮어쓰기 + 버전 쿼리).

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
  return _cache ?? { name: null, avatarUrl: null, coverUrl: null };
}

/**
 * 서버에서 프로필을 읽는다.
 * @returns 이름·사진 URL. 못 읽으면 둘 다 null(호출측이 명식 이름으로 폴백)
 */
export async function loadMyProfile(): Promise<MyProfile> {
  const r = await withTimeout(
    supabase.from('profiles').select('display_name, avatar_path, cover_path').maybeSingle(),
    8000,
  );
  const row = r && !r.error ? (r.data as any) : null;
  _cache = {
    // ⚠️★이메일은 **이름이 아니다**(2026-08-20 실물에서 `cksgh0…` 로 떴다).
    //   `profiles.display_name` 은 로그인할 때 이메일이 자동으로 들어가는 자리라,
    //   사용자가 직접 정한 이름과 **섞여 있다**. `@` 가 있으면 안 쓴다 → 명식 이름으로 떨어진다.
    //   ⇒ 사용자가 설정에서 저장하면 그 값이 들어와 이 검사를 통과한다.
    name: displayNameOf(row?.display_name),
    avatarUrl: row?.avatar_path ? sizedImage(publicUrl(row.avatar_path), AVATAR_W) : null,
    coverUrl: row?.cover_path ? sizedImage(publicUrl(row.cover_path), COVER_W) : null,
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
 * 화면에 쓸 크기 — **원본을 그대로 내려받지 않는다**(Boss 2026-08-29 *"반응이 너무 느려"*).
 * 실측: 프로필 창 한 번에 **4.1MB**(avatar 1.4MB + cover 2.7MB)를 받고 있었다.
 * ★값의 근거: 아바타는 창에서 **폭의 22%**(≈100px) 로 그려 레티나 2배면 240 이면 충분하고,
 *   배경은 패널 폭 상한이 **460** 이라 1080 이면 2배를 넘긴다. 전체 보기는 `originalImage` 로 되돌린다.
 */
const AVATAR_W = 240;
const COVER_W = 920;   // = 패널 폭 상한 460 의 **정확히 2배**(레티나). 실측 516KB → 425KB

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
    .update({ display_name: v }).eq('id', user.id);
  if (error) return { ok: false, error: error.message };
  _cache = { ...profileSnapshot(), name: v };
  notify();
  return { ok: true };
}


/**
 * 올릴 것 — 웹은 `File`(Blob), 폰은 `pickImage()` 가 준 바이트.
 * ★한 타입으로 받아 **경로·정책·버전쿼리 규칙을 한 벌**로 유지한다
 *   (웹용·폰용 업로드를 따로 만들면 «첫 칸이 uid» 같은 규칙이 언젠가 갈린다).
 */
export type Uploadable = (Blob & { name?: string; type?: string }) | { data: Uint8Array; type: string; size: number };

/** 업로드 본체와 MIME·크기를 꺼낸다(웹 Blob / 폰 바이트 공통). */
function partsOf(f: Uploadable): { body: Blob | Uint8Array; type: string; size: number } {
  return 'data' in f
    ? { body: f.data, type: f.type || 'image/jpeg', size: f.size }
    : { body: f, type: f.type || 'image/jpeg', size: f.size };
}

/**
 * 사진 업로드.
 *
 * ★경로를 `<uid>/avatar.<ext>` 로 고정한다 — 바꿀 때마다 파일이 쌓이지 않고,
 *   Storage 정책이 '첫 칸이 내 uid' 를 요구하므로 남의 파일을 건드릴 수 없다.
 * ⚠️같은 경로에 덮어쓰면 CDN 캐시가 옛 사진을 계속 준다 → URL 에 버전 쿼리를 붙인다.
 *
 * @param file 웹은 `File`, 폰은 `pickImage()` 결과(2026-08-28부터 폰도 된다)
 */
export async function uploadMyAvatar(file: Uploadable): Promise<{ ok: boolean; url?: string; error?: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'unauthorized' };
  const { body, type, size } = partsOf(file);
  if (size > 2 * 1024 * 1024) return { ok: false, error: 'too_large' };
  const ext = type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : 'jpg';
  const path = `${user.id}/avatar.${ext}`;
  const up = await supabase.storage.from('avatars')
    .upload(path, body, { upsert: true, contentType: type });
  if (up.error) return { ok: false, error: up.error.message };
  const { error } = await supabase.from('profiles')
    .update({ avatar_path: path }).eq('id', user.id);
  if (error) return { ok: false, error: error.message };
  // ★버전 쿼리 — 같은 경로를 덮어썼으므로 이게 없으면 옛 사진이 계속 보인다
  const url = `${sizedImage(publicUrl(path), AVATAR_W)}&v=${Date.now()}`;
  _cache = { ...profileSnapshot(), avatarUrl: url };
  notify();
  return { ok: true, url };
}

/** 사진 지우기 — 파일은 남기고 참조만 끊는다(되돌릴 여지). */
export async function clearMyAvatar(): Promise<{ ok: boolean; error?: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'unauthorized' };
  const { error } = await supabase.from('profiles')
    .update({ avatar_path: null }).eq('id', user.id);
  if (error) return { ok: false, error: error.message };
  _cache = { ...profileSnapshot(), avatarUrl: null };
  notify();
  return { ok: true };
}

/**
 * 배경 사진 올리기 — 아바타와 **같은 관용**이다(경로 첫 칸이 내 uid · 덮어쓰기 + 버전 쿼리).
 *
 * @param file 웹은 `File`, 폰은 `pickImage()` 결과(2026-08-28부터 폰도 된다)
 */
export async function uploadMyCover(file: Uploadable): Promise<{ ok: boolean; url?: string; error?: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'unauthorized' };
  const { body, type, size } = partsOf(file);
  // ⚠️배경은 가로로 넓어 아바타보다 크다 — 그래도 4MB 를 넘기지 않는다(느린 망에서 화면이 늦게 뜬다)
  if (size > 4 * 1024 * 1024) return { ok: false, error: 'too_large' };
  const ext = type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : 'jpg';
  const path = `${user.id}/cover.${ext}`;
  const up = await supabase.storage.from('avatars')
    .upload(path, body, { upsert: true, contentType: type });
  if (up.error) return { ok: false, error: up.error.message };
  const { error } = await supabase.from('profiles')
    .update({ cover_path: path }).eq('id', user.id);
  if (error) return { ok: false, error: error.message };
  const url = `${sizedImage(publicUrl(path), COVER_W)}&v=${Date.now()}`;
  _cache = { ...profileSnapshot(), coverUrl: url };
  notify();
  return { ok: true, url };
}

/** 배경 사진 지우기 — 파일은 남기고 참조만 끊는다(되돌릴 여지). */
export async function clearMyCover(): Promise<{ ok: boolean; error?: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'unauthorized' };
  const { error } = await supabase.from('profiles')
    .update({ cover_path: null }).eq('id', user.id);
  if (error) return { ok: false, error: error.message };
  _cache = { ...profileSnapshot(), coverUrl: null };
  notify();
  return { ok: true };
}
