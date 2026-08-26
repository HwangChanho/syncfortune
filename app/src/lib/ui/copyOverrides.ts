// app/src/lib/ui/copyOverrides.ts — 문구를 **앱 재빌드 없이** 고치는 경로(daniel 2026-08-03)
// ═══════════════════════════════════════════════════════════════════════════
// 왜: 문구를 app/src/copy/ko.ts 한 파일로 모았지만(08-03) 그건 여전히 **빌드가 필요한** 경로다.
//   오타 하나 고치려고 App Store 심사를 다시 받는 건 말이 안 된다.
//   → 앱이 켜질 때 `copy_overrides` 표를 읽어 번들 문구 **위에 덮는다**.
//
// ★진실의 출처는 여전히 copy/ko.ts 다. 이 표는 덮어쓰기만 한다 —
//   행을 지우면 번들 문구로 돌아간다(되돌리기가 항상 가능해야 한다).
// ★실패하면 **조용히 번들 문구 그대로**. 문구 때문에 앱이 멈추면 안 된다.
// ★쓰기는 관리자만(RLS). 읽기는 익명 허용 — 로그인 전에도 문구가 필요하다.
// ═══════════════════════════════════════════════════════════════════════════
import i18n from 'i18next';
import { supabase } from '../supabase';
import { withTimeout } from '../core/withTimeout';
// ★언어 목록은 **여기서 정하지 않는다** — `lib/i18n.ts` 가 단일 출처다(Boss 2026-08-26 "하드코딩은 한곳으로 모아")
import { APP_LANGS, type AppLang } from '../i18n';

/** `a.b.c` 평탄화 키 → 중첩 객체. i18n 은 중첩 구조를 먹는다. */
function nest(key: string, value: string): Record<string, unknown> {
  const parts = key.split('.');
  const out: Record<string, unknown> = {};
  let cur = out;
  parts.forEach((p, i) => {
    if (i === parts.length - 1) cur[p] = value;
    else { cur[p] = {}; cur = cur[p] as Record<string, unknown>; }
  });
  return out;
}

/** 깊은 병합 — 같은 키는 나중 값이 이긴다. */
function merge(a: any, b: any): any {
  for (const k of Object.keys(b)) {
    if (b[k] && typeof b[k] === 'object' && a[k] && typeof a[k] === 'object') merge(a[k], b[k]);
    else a[k] = b[k];
  }
  return a;
}

/**
 * 서버 문구 오버라이드 한 줄.
 *
 * ⚠️★2026-08-26 구조를 바꿨다 — 종전엔 **언어가 컬럼**이었다(`{key, ko, en, ja}`).
 *   중국어·태국어·베트남어를 붙이려면 **언어마다 컬럼**을 추가해야 했고,
 *   앱·관리자·쿼리가 전부 그 이름을 알아야 했다(하드코딩 세 겹).
 *   ⇒ 지금은 **행 하나 = (키, 언어, 값)**. 언어를 늘려도 스키마도 이 파일도 안 바뀐다.
 *   [[i18n-untranslated-shipped]] · 마이그레이션 `0045`
 */
export type CopyOverride = { key: string; lang: string; value: string; note?: string | null };

/**
 * 오버라이드를 읽어 i18n 에 얹는다. **앱 시작 시 1회**(루트 레이아웃) 호출.
 * @returns 적용된 건수(0 = 없음/실패 — 둘을 구분하지 않는다. 어느 쪽이든 번들 문구가 정답이다)
 * ⚠️상한 필수 — 부팅 경로라 응답이 늦으면 첫 화면이 늦어진다. 초과하면 그냥 번들 문구로 간다.
 */
export async function applyCopyOverrides(): Promise<number> {
  try {
    const res = await withTimeout(
      // ★언어 컬럼이 아니라 **행**으로 받는다 — 언어가 늘어도 이 쿼리는 그대로다
      supabase.from('copy_overrides').select('key, lang, value'),
      5000,
    );
    const rows = (res as { data?: CopyOverride[] } | undefined)?.data;
    if (!rows?.length) return 0;
    // ★앱이 아는 언어만 얹는다 — 서버에 미리 넣어 둔 미지원 언어가 있어도 무시된다(무중단)
    const known = new Set<string>(APP_LANGS as readonly string[]);
    const byLang: Record<string, any> = {};
    for (const r of rows) {
      if (!known.has(r.lang) || typeof r.value !== 'string' || !r.value.trim()) continue;
      byLang[r.lang] = merge(byLang[r.lang] ?? {}, nest(r.key, r.value));
    }
    let n = 0;
    for (const lang of Object.keys(byLang) as AppLang[]) {
      if (!Object.keys(byLang[lang]).length) continue;
      // deep=true·overwrite=true — 기존 번들 위에 덮는다(없는 키는 그대로 둔다).
      i18n.addResourceBundle(lang, 'translation', byLang[lang], true, true);
      n++;
    }
    return rows.length;
  } catch {
    return 0;   // 문구는 부가 — 실패해도 앱은 번들 문구로 정상 동작
  }
}

/** 관리자 편집용 — 현재 오버라이드 전체. 실패는 빈 배열(화면이 '없음'으로 그린다). */
/**
 * 오버라이드 목록.
 * @param lang 한 언어만 볼 때(비우면 전 언어)
 */
export async function listCopyOverrides(lang?: AppLang): Promise<CopyOverride[]> {
  let q = supabase.from('copy_overrides').select('key, lang, value, note').order('key');
  if (lang) q = q.eq('lang', lang);
  const res = await withTimeout(q, 8000);
  return ((res as { data?: CopyOverride[] } | undefined)?.data) ?? [];
}

/**
 * 문구 하나를 덮어쓴다(관리자만 — 서버 RLS 가 강제).
 *
 * @param key   `copy/ko.ts` 의 평탄화 키(예: 'compat.genCta')
 * @param lang  ★어느 언어인지 **반드시 받는다** — 종전엔 한국어만 고칠 수 있었다.
 *              해외 타게팅이라 언어가 늘어난다(Boss 2026-08-26).
 * @param value 새 문구
 * @returns 성공 여부. 실패 사유는 화면이 안내한다(권한/네트워크를 구분하지 않는다 — 둘 다 '지금은 안 된다')
 */
export async function setCopyOverride(key: string, lang: AppLang, value: string, note?: string): Promise<boolean> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return false;
  const res = await withTimeout(
    supabase.from('copy_overrides').upsert(
      { key, lang, value, note: note ?? null, updated_by: session.user.id, updated_at: new Date().toISOString() },
      { onConflict: 'key,lang' },   // ★PK 가 (키, 언어) 다 — 한 언어만 고쳐도 다른 언어가 안 지워진다
    ),
    8000,
  );
  return !!res && !(res as { error?: unknown }).error;
}

/** 되돌리기 — 그 (키, 언어) 행을 지우면 **그 언어만** 번들 문구로 돌아간다. */
export async function clearCopyOverride(key: string, lang: AppLang): Promise<boolean> {
  const res = await withTimeout(
    supabase.from('copy_overrides').delete().eq('key', key).eq('lang', lang), 8000,
  );
  return !!res && !(res as { error?: unknown }).error;
}
