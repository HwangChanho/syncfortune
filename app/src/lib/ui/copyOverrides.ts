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

export type CopyOverride = { key: string; ko?: string | null; en?: string | null; ja?: string | null; note?: string | null };

/**
 * 오버라이드를 읽어 i18n 에 얹는다. **앱 시작 시 1회**(루트 레이아웃) 호출.
 * @returns 적용된 건수(0 = 없음/실패 — 둘을 구분하지 않는다. 어느 쪽이든 번들 문구가 정답이다)
 * ⚠️상한 필수 — 부팅 경로라 응답이 늦으면 첫 화면이 늦어진다. 초과하면 그냥 번들 문구로 간다.
 */
export async function applyCopyOverrides(): Promise<number> {
  try {
    const res = await withTimeout(
      supabase.from('copy_overrides').select('key, ko, en, ja'),
      5000,
    );
    const rows = (res as { data?: CopyOverride[] } | undefined)?.data;
    if (!rows?.length) return 0;
    const byLang: Record<string, any> = { ko: {}, en: {}, ja: {} };
    for (const r of rows) {
      for (const lang of ['ko', 'en', 'ja'] as const) {
        const v = r[lang];
        if (typeof v === 'string' && v.trim()) merge(byLang[lang], nest(r.key, v));
      }
    }
    let n = 0;
    for (const lang of ['ko', 'en', 'ja'] as const) {
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
export async function listCopyOverrides(): Promise<CopyOverride[]> {
  const res = await withTimeout(supabase.from('copy_overrides').select('key, ko, en, ja, note').order('key'), 8000);
  return ((res as { data?: CopyOverride[] } | undefined)?.data) ?? [];
}

/**
 * 문구 하나를 덮어쓴다(관리자만 — 서버 RLS 가 강제).
 * @param key copy/ko.ts 의 평탄화 키(예: 'compat.genCta')
 * @returns 성공 여부. 실패 사유는 화면이 안내한다(권한/네트워크 구분은 하지 않는다 — 둘 다 '지금은 안 된다').
 */
export async function setCopyOverride(key: string, ko: string, note?: string): Promise<boolean> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return false;
  const res = await withTimeout(
    supabase.from('copy_overrides').upsert(
      { key, ko, note: note ?? null, updated_by: session.user.id, updated_at: new Date().toISOString() },
      { onConflict: 'key' },
    ),
    8000,
  );
  return !!res && !(res as { error?: unknown }).error;
}

/** 되돌리기 — 행을 지우면 번들 문구(copy/ko.ts)로 돌아간다. */
export async function clearCopyOverride(key: string): Promise<boolean> {
  const res = await withTimeout(supabase.from('copy_overrides').delete().eq('key', key), 8000);
  return !!res && !(res as { error?: unknown }).error;
}
