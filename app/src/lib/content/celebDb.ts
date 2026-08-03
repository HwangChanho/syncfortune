// app/src/lib/content/celebDb.ts — 연예인 목록·검색(서버 DB `celebrities`)
// ═══════════════════════════════════════════════════════════════════════════
// daniel 2026-08-03 "세계인물 매칭은 검색도 가능해야 하고 연예인 기반으로 리스트업해줘.
//                     특히 요즘 유행하는 연예인들 위주로 상단 노출 돼야 해".
//
// ■ 왜 DB 인가
//   종전엔 `celebData.ts` 에 **16명**을 손으로 적어 뒀다(나폴레옹·모차르트·링컨…) — 역사 인물 위주라
//   "요즘 연예인"과는 거리가 멀었고, 늘리려면 생년월일을 사람이 옮겨 적어야 했다.
//   ★생년월일을 지어내면 안 된다 — 실존 인물이고, 하루만 틀려도 사주가 통째로 달라진다.
//   이미 수집해 둔 `celebrities` 표(위키데이터 기반 129,730명 · 생년월일·역할·지명도)를 쓴다.
//
// ■ '요즘 유행'을 어떻게 근사하나 (정직하게)
//   이 표에는 **실시간 인기 신호가 없다.** fame 은 위키데이터 문서 연결 수에 가까운 지명도 지표다.
//   그래서 '지금 뜨는'을 진짜로는 알 수 없고, 다음 세 조건으로 **근사**한다:
//     ① 한국(country_code='KR')  ② 배우·가수  ③ 1975년 이후 출생(현역 세대)
//   ★정렬은 **최근 30일 위키백과 조회수**(views_30d) — daniel 승인 후 수집기(celeb-trend)를 붙였다.
//     fame 은 '역사적 유명함'이라 지금 뜨는 사람과 어긋났다(실측: 싸이 fame 1위·조회수 9위 /
//     공유 fame 49·조회수 1위). 조회수는 '지금 사람들이 실제로 찾아본 정도'다.
//   ⚠️드라마 방영·사건에 출렁인다 — 그게 트렌드의 정의라 의도된 성질이다.
//
// ■ 사주는 온디바이스로 계산한다(비용 0)
//   표에 사주 기둥이 미리 들어 있지만 **쓰지 않는다** — 매칭은 기존 결정론 엔진(celebMatch)이
//   전체 차트로 해야 하고, 두 경로가 갈리면 값이 어긋난다. 여기선 이름·생일만 가져온다.
// ⚠️출생 시각은 공개 정보가 아니다 → 전부 `timeAccuracy: '미상'`(시주 제외 통변).
// ═══════════════════════════════════════════════════════════════════════════
import { supabase } from '../supabase';
import { withTimeout } from '../core/withTimeout';
import type { CelebEntry } from './celebData';

/** DB 행 → 기존 매칭 엔진이 먹는 형태. 필드 이름을 여기서 한 번만 맞춘다. */
type Row = { id: string; name_ko: string | null; name_en: string | null; role: string | null; birth_date: string; sex: string | null; country_code: string | null };

function toEntry(r: Row): CelebEntry | null {
  const name = (r.name_ko || r.name_en || '').trim();
  if (!name || !r.birth_date) return null;
  return {
    id: r.id,
    name,
    flag: r.country_code === 'KR' ? '🇰🇷' : FLAG[r.country_code ?? ''] ?? '🌏',
    role: r.role ?? '',
    birth: r.birth_date,                       // YYYY-MM-DD (공개 정보 · 시각은 미상)
    sex: r.sex === '여' ? '여' : '남',
    // ★한 줄 소개는 **지어내지 않는다**. 표에 있는 건 역할뿐이라 그걸 그대로 쓴다 —
    //   실존 인물에게 없는 서사를 붙이면 그게 곧 허위다(CLAUDE.md §4 명예 존중).
    blurb: r.role ? `${r.role}` : '',
  };
}

/** 국기 — 자주 나오는 나라만. 없으면 🌏(모르면 모른다고 표시). */
const FLAG: Record<string, string> = {
  KR: '🇰🇷', US: '🇺🇸', JP: '🇯🇵', CN: '🇨🇳', GB: '🇬🇧', FR: '🇫🇷', DE: '🇩🇪',
  IT: '🇮🇹', ES: '🇪🇸', CA: '🇨🇦', AU: '🇦🇺', IN: '🇮🇳', BR: '🇧🇷', RU: '🇷🇺',
};

const SELECT = 'id, name_ko, name_en, role, birth_date, sex, country_code';

/**
 * 상단 노출용 — 한국 배우·가수를 지명도 순으로.
 * @param limit 가져올 수(기본 40). 매칭은 온디바이스라 너무 많으면 첫 렌더가 느려진다.
 * ★실패하면 빈 배열 — 화면은 번들 목록(celebData)으로 폴백한다(빈 화면 금지).
 */
export async function listTrendingCelebs(limit = 40): Promise<CelebEntry[]> {
  const res = await withTimeout(
    supabase.from('celebrities').select(SELECT)
      .eq('country_code', 'KR').in('role', ['배우', '가수'])
      .not('name_ko', 'is', null).gte('birth_date', '1975-01-01')
      // ★정렬 기준 = **최근 30일 위키백과 조회수**(daniel 2026-08-03 승인 후 수집).
      //   fame(위키데이터 문서 연결 수)은 '역사적 유명함'이라 지금 뜨는 사람과 어긋났다 —
      //   실측: 노출 1위였던 싸이가 조회수로는 9위, 공유는 fame 49 인데 조회수 1위(11,261).
      //   아직 수집 안 된 사람은 뒤로(nullsFirst:false) 보내고, 화면은 fame 폴백 없이 그대로 둔다.
      .order('views_30d', { ascending: false, nullsFirst: false })
      .order('fame', { ascending: false })
      .limit(limit),
    8000,
  );
  const rows = (res as { data?: Row[] } | undefined)?.data ?? [];
  return rows.map(toEntry).filter(Boolean) as CelebEntry[];
}

/**
 * 이름 검색(한글·영문 모두). 서버에서 찾는다 — 12만 행을 앱에 담을 수 없다.
 * @param q 두 글자 이상. 짧으면 결과가 수천 건이라 의미가 없다.
 */
export async function searchCelebs(q: string, limit = 30): Promise<CelebEntry[]> {
  const s = q.trim();
  if (s.length < 2) return [];
  const esc = s.replace(/[%,]/g, ' ');                    // like 메타문자·PostgREST 구분자 제거
  const res = await withTimeout(
    supabase.from('celebrities').select(SELECT)
      .or(`name_ko.ilike.%${esc}%,name_en.ilike.%${esc}%`)
      .order('fame', { ascending: false }).limit(limit),
    8000,
  );
  const rows = (res as { data?: Row[] } | undefined)?.data ?? [];
  return rows.map(toEntry).filter(Boolean) as CelebEntry[];
}
