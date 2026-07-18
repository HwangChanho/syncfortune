// scripts/celeb-fetch.ts — 위키데이터 인물 → 사주 파생값 추출 파이프 (API 0·결정론)
// ─────────────────────────────────────────────────────────────────────────
// 목적(daniel 2026-07-18): 세계인물 매칭을 16명 → 대규모(정계·연예인 중심)로 확장.
//   위키데이터 SPARQL 로 인물을 긁어 정제하고, **매칭에 필요한 사주 파생값을 미리 계산**해
//   JSON 으로 떨군다. 이 산출물을 supabase `celebrities` 테이블에 인제스트한다(celeb-ingest).
//
// ★왜 파생값을 미리 계산하나: 현재 앱은 `rankCelebs` 가 후보 **전원**을 클라에서 computeChart
//   재계산한다(16명이라 버텼음). 대규모에선 불가능 → 서버가 일주·오행분포·십신분포를 들고 있고
//   앱은 내 차트만 계산해 비교하는 구조로 간다.
//
// ⚠️ 출생 **시각 없음**(위키데이터 생일=날짜만) → celebData.ts 컨벤션 그대로
//   "날짜 + 12:00 + timeAccuracy:'미상'" 으로 계산하고 **시주는 매칭에서 배제**한다(daniel 승인).
//   오행 분포도 년·월·일 3주만 집계한다(celebMatch 의 PILLARS_NO_TIME 과 동일 기준).
//
// ⚠️ 외부 서비스 예절: User-Agent 필수(없으면 차단), 쿼리당 LIMIT, 요청 사이 지연.
//   OFFSET 페이징은 위키데이터에서 뒤로 갈수록 급격히 느려지므로 **생년(年) 단위로 분할**한다.
//
// 실행: npx tsx scripts/celeb-fetch.ts [--from 1920] [--to 2010] [--limit 4000] [--out <path>]
//       (기본: 정치인·배우·가수, 1920~2010년생)
// ─────────────────────────────────────────────────────────────────────────
import { writeFileSync } from 'node:fs';
import { buildSajuChart } from '../engine/saju';
import { analyzeTenGods } from '../engine/structure';
import type { ChartInput, PillarPos } from '../spec/chart';

const ENDPOINT = 'https://query.wikidata.org/sparql';
const UA = 'SyncFortune/1.0 (contact: cksgh0316@gmail.com) celeb-dataset';

// 직업 분류(daniel 우선순위: 정계 → 연예인. 방송인·BJ·유튜버는 생일 비공개가 많아 후순위)
const OCCUPATIONS: { qid: string; role: string }[] = [
  { qid: 'Q82955', role: '정치인' },
  { qid: 'Q33999', role: '배우' },
  { qid: 'Q177220', role: '가수' },
];

const SEX_MALE = 'Q6581097';   // 위키데이터 성별 항목
const SEX_FEMALE = 'Q6581072';

export type CelebRow = {
  id: string;              // 위키데이터 Q-id
  nameKo: string | null;
  nameEn: string;
  countryCode: string;     // ISO 3166-1 alpha-2
  role: string;
  birth: string;           // YYYY-MM-DD
  sex: '남' | '여';
  fame: number;            // wikibase:sitelinks — 유명도 프록시(리스트 정렬·품질 필터 기준)
  // 사주 파생(매칭용 — 시주 제외)
  dayStem: string; dayBranch: string;
  yearStem: string; yearBranch: string;
  monthStem: string; monthBranch: string;
  elemDist: Record<string, number>;    // 년·월·일 3주 오행 분포
  tenGodDist: Record<string, number>;  // 십신 5그룹 분포(본인 일간 기준)
};

/**
 * 한 해(year)에 태어난 특정 직업 인물을 **유명한 순서로** 가져온다.
 * ★유명도 = `wikibase:sitelinks`(그 인물이 실린 위키 프로젝트 수). 다국어 위키에 실릴수록 널리 알려진 인물이다.
 *   이 필터가 없으면 위키데이터에 **지방의원까지 통째로 등재된 나라**(핀란드·노르웨이 등)가 결과 앞을 다 차지해
 *   1688명 시범 추출에서 FI 542·NO 253인데 **KR 0명**이 나왔다(2026-07-18 실측). 매칭 콘텐츠로는 무의미하다.
 * ※ 생년 분할 + sitelinks 정렬 = OFFSET 페이징(뒤로 갈수록 급격히 느려짐)을 피하면서 상위 유명 인물부터 확보.
 */
function sparql(occQid: string, year: number, limit: number, minSitelinks: number, country?: string): string {
  return `SELECT ?p ?ko ?en ?birth ?cc ?sex ?sl WHERE {
  ?p wdt:P106 wd:${occQid} ;
     wdt:P569 ?birth ;
     wdt:P27 ?country ;
     wikibase:sitelinks ?sl .
  ?country wdt:P297 ?cc .
  FILTER(?sl >= ${minSitelinks})
  FILTER(YEAR(?birth) = ${year})${country ? `\n  FILTER(?cc = "${country}")` : ''}
  OPTIONAL { ?p wdt:P21 ?sex . }
  OPTIONAL { ?p rdfs:label ?ko FILTER(LANG(?ko) = "ko") }
  OPTIONAL { ?p rdfs:label ?en FILTER(LANG(?en) = "en") }
}
ORDER BY DESC(?sl)
LIMIT ${limit}`;
}

async function runQuery(query: string): Promise<any[]> {
  const url = `${ENDPOINT}?query=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { Accept: 'application/sparql-results+json', 'User-Agent': UA } });
  if (!res.ok) throw new Error(`SPARQL ${res.status} ${res.statusText}`);
  const json = await res.json();
  return json.results?.bindings ?? [];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── supabase 인제스트(--ingest) ──────────────────────────────────────────────
//   ★연도 단위로 수집하는 즉시 upsert 한다 — 전 구간이 6시간+ 라, 중간에 끊겨도 그때까지 넣은 건 남는다.
//   재실행 시 같은 Q-id 는 merge-duplicates 로 갱신되므로 중복 걱정 없이 이어서 돌리면 된다.
//   실행: npx tsx --env-file-if-exists=.env scripts/celeb-fetch.ts --ingest
const SB_URL = process.env.SUPABASE_URL ?? '';
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

/** CelebRow[] → celebrities 테이블 컬럼명으로 변환(snake_case). */
const toDbRow = (r: CelebRow) => ({
  id: r.id, name_ko: r.nameKo, name_en: r.nameEn, country_code: r.countryCode, role: r.role,
  birth_date: r.birth, sex: r.sex, fame: r.fame,
  day_stem: r.dayStem, day_branch: r.dayBranch, year_stem: r.yearStem, year_branch: r.yearBranch,
  month_stem: r.monthStem, month_branch: r.monthBranch, elem_dist: r.elemDist, tengod_dist: r.tenGodDist,
});

/** 500행씩 upsert. 실패해도 던지지 않고 개수만 돌려준다(장시간 실행이 한 배치로 죽지 않게). */
async function upsert(rows: CelebRow[]): Promise<number> {
  if (!SB_URL || !SB_KEY) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 없음 — --env-file-if-exists=.env 로 실행하세요');
  let ok = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500).map(toDbRow);
    try {
      const res = await fetch(`${SB_URL}/rest/v1/celebrities`, {
        method: 'POST',
        headers: {
          apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`,
          'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify(chunk),
      });
      if (res.ok) ok += chunk.length;
      else console.error(`  ⚠️ upsert ${res.status}: ${(await res.text()).slice(0, 160)}`);
    } catch (e) {
      console.error(`  ⚠️ upsert 예외: ${(e as Error).message}`);
    }
  }
  return ok;
}
const NO_TIME: PillarPos[] = ['년', '월', '일'];   // 시주 제외(출생 시각 미상)

/** 위키데이터 바인딩 1건 → 사주 파생값까지 채운 행. 계산 불가·필수값 결측이면 null. */
function toRow(b: any, role: string): CelebRow | null {
  const id = String(b.p?.value ?? '').split('/').pop();
  const nameEn = b.en?.value ?? null;
  const nameKo = b.ko?.value ?? null;
  const birthRaw = b.birth?.value ?? '';
  const cc = b.cc?.value ?? null;
  if (!id || !cc || !birthRaw) return null;
  if (!nameEn && !nameKo) return null;                      // 이름 없는 항목 제외
  const birth = birthRaw.slice(0, 10);                       // YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birth) || birth.endsWith('-00-00')) return null; // 연도만 아는 항목 제외
  const sexQ = String(b.sex?.value ?? '').split('/').pop();
  const sex: '남' | '여' = sexQ === SEX_FEMALE ? '여' : '남'; // 미상·기타는 남으로(위키 기본 분포)

  // celebData.ts 컨벤션: 날짜 + 정오 + timeAccuracy '미상'(진태양시 보정 스킵 → 시주는 무의미)
  const input: ChartInput = {
    birthDateTime: `${birth} 12:00`, calendar: '양', timeAccuracy: '미상', sex, birthPlace: '서울',
  } as ChartInput;

  let saju;
  try { saju = buildSajuChart(input, 2026); } catch { return null; }  // 연도 고정: 파생값은 원국만 쓰므로 재현성 우선

  // 오행 분포 — 천간·지지 각각 1점(시주 제외). celebMatch.ohaengDist 와 같은 기준.
  const elemDist: Record<string, number> = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
  for (const p of NO_TIME) {
    const d = saju.pillars[p];
    elemDist[stemElem(d.stem)]++;
    elemDist[branchElem(d.branch)]++;
  }
  const tenGodDist = analyzeTenGods(saju).distribution as unknown as Record<string, number>;

  return {
    id, nameKo, nameEn: nameEn ?? nameKo!, countryCode: cc, role, birth, sex,
    fame: Number(b.sl?.value ?? 0),
    dayStem: saju.pillars['일'].stem, dayBranch: saju.pillars['일'].branch,
    yearStem: saju.pillars['년'].stem, yearBranch: saju.pillars['년'].branch,
    monthStem: saju.pillars['월'].stem, monthBranch: saju.pillars['월'].branch,
    elemDist, tenGodDist,
  };
}

// 오행 매핑(엔진 내부 함수가 export 되지 않아 여기 최소 복제 — 표준표라 드리프트 위험 없음)
const STEM_E: Record<string, string> = { 甲:'木',乙:'木',丙:'火',丁:'火',戊:'土',己:'土',庚:'金',辛:'金',壬:'水',癸:'水' };
const BR_E: Record<string, string> = { 寅:'木',卯:'木',巳:'火',午:'火',辰:'土',戌:'土',丑:'土',未:'土',申:'金',酉:'金',亥:'水',子:'水' };
const stemElem = (s: string) => STEM_E[s] ?? '土';
const branchElem = (b: string) => BR_E[b] ?? '土';

async function main() {
  const arg = (k: string, d: number) => {
    const i = process.argv.indexOf(`--${k}`);
    return i >= 0 ? Number(process.argv[i + 1]) : d;
  };
  const from = arg('from', 1920), to = arg('to', 2010), limit = arg('limit', 4000);
  const outIdx = process.argv.indexOf('--out');
  const out = outIdx >= 0 ? process.argv[outIdx + 1] : 'celeb-dataset.json';

  const seen = new Map<string, CelebRow>();   // Q-id 중복 제거(여러 직업에 걸친 인물은 첫 직업 채택)
  let queries = 0, failures = 0;

  // 2패스 수집(2026-07-18 시범 추출에서 KR 0명이 나온 뒤 도입):
  //   ① 전역 패스 — sitelinks 높은 국제적 유명 인물(국가 무관)
  //   ② 국가 패스 — 앱 지원 언어권·주요 시장은 문턱을 낮춰 *그 나라 안에서 알려진* 인물까지 확보.
  //      daniel 요구 "리스트는 기기 국가 인물이 상단"을 채우려면 국가별 물량이 반드시 있어야 한다.
  const GLOBAL_MIN = 12;                                   // 국제적 유명(12개 이상 위키에 등재)
  const COUNTRY_MIN = 3;                                   // 자국 내 인지도
  const COUNTRIES = ['KR', 'JP', 'US', 'GB', 'CN', 'TW', 'FR', 'DE', 'IT', 'ES', 'CA', 'AU', 'IN', 'BR', 'RU'];

  const collect = async (label: string, q: string, role: string) => {
    try {
      const rows = await runQuery(q);
      queries++;
      let added = 0;
      for (const b of rows) {
        const r = toRow(b, role);
        if (r && !seen.has(r.id)) { seen.set(r.id, r); added++; }
      }
      if (added) console.log(`  ${label}: +${added} (누적 ${seen.size})`);
    } catch (e) {
      failures++;
      console.error(`  ⚠️ ${label} 실패: ${(e as Error).message}`);
    }
    await sleep(300);   // 외부 서비스 예절(초당 3~4건 이하)
  };

  const ingest = process.argv.includes('--ingest');
  let pushed = 0;
  for (const occ of OCCUPATIONS) {
    for (let year = from; year <= to; year++) {
      const before = seen.size;
      await collect(`${occ.role} ${year} 전역`, sparql(occ.qid, year, limit, GLOBAL_MIN), occ.role);
      for (const cc of COUNTRIES) {
        await collect(`${occ.role} ${year} ${cc}`, sparql(occ.qid, year, limit, COUNTRY_MIN, cc), occ.role);
      }
      // ★연도 하나가 끝날 때마다 그 증분만 즉시 저장(장시간 실행 중단 대비).
      if (ingest && seen.size > before) {
        const fresh = [...seen.values()].slice(before);
        pushed += await upsert(fresh);
        console.log(`  ↑ ${occ.role} ${year} 저장 — 누적 ${pushed}명 DB 반영`);
      }
    }
  }

  const list = [...seen.values()];
  writeFileSync(out, JSON.stringify(list, null, 0));
  console.log(`\n✅ ${list.length}명 → ${out} (쿼리 ${queries}건·실패 ${failures}건)`);
  const byCc = list.reduce<Record<string, number>>((a, r) => { a[r.countryCode] = (a[r.countryCode] ?? 0) + 1; return a; }, {});
  console.log('국가 상위:', Object.entries(byCc).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => `${k}:${v}`).join(' '));
  console.log('한국(KR):', byCc.KR ?? 0, '· 이름 한국어 보유:', list.filter((r) => r.nameKo).length);
}

main().catch((e) => { console.error(e); process.exit(1); });
