// scripts/snap-columns.mjs — public 스키마 컬럼 스냅샷 갱신
// ═══════════════════════════════════════════════════════════════════════════
// check-edge-columns.mjs(check:cols)가 이 스냅샷을 기준으로 "없는 컬럼 select"를 잡는다.
// 종전엔 스냅샷 주석에 "`npm run snap:cols` 로 갱신할 것"이라 적혀 있었는데 **그 스크립트가 없었다**
//   (daniel 2026-08-03 celebrities 컬럼 추가 후 발견 — 마이그레이션은 했는데 갱신할 방법이 없었다).
//   안내는 있는데 도구가 없으면, 다음 사람은 하네스를 끄거나 스냅샷을 손으로 고치게 된다.
//
// 사용: npm run snap:cols   ← 마이그레이션(컬럼 추가/삭제) 직후 반드시 실행
// 출처: PostgREST OpenAPI(/rest/v1/) — 실제 서빙 스키마와 같은 것을 본다
//   (information_schema 를 직접 읽으면 PostgREST 캐시가 갱신되기 전 상태와 어긋날 수 있다).
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const env = Object.fromEntries(
  readFileSync(join(ROOT, '.env'), 'utf8').split('\n')
    .map((l) => l.match(/^(\w+)\s*=\s*(.*)$/)).filter(Boolean).map((m) => [m[1], m[2].trim()]),
);
const url = env.SUPABASE_URL, key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('❌ .env 에 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 필요합니다.'); process.exit(1); }

const res = await fetch(`${url}/rest/v1/`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
if (!res.ok) { console.error('❌ OpenAPI 조회 실패:', res.status); process.exit(1); }
const doc = await res.json();

const tables = {};
for (const [name, def] of Object.entries(doc.definitions ?? {})) {
  const cols = Object.keys(def.properties ?? {});
  if (cols.length) tables[name] = cols;
}
if (Object.keys(tables).length < 5) { console.error('❌ 테이블을 거의 못 읽었습니다 — 빈 스냅샷으로 덮지 않습니다.'); process.exit(1); }

const out = {
  _note: 'public 스키마 컬럼 스냅샷 — scripts/check-edge-columns.mjs 가 참조한다. 마이그레이션 후 npm run snap:cols 로 갱신할 것.',
  _generatedAt: new Date().toISOString(),
  tables,
};
const P = join(ROOT, 'scripts/db-columns.json');
const before = JSON.parse(readFileSync(P, 'utf8')).tables ?? {};
writeFileSync(P, JSON.stringify(out, null, 2) + '\n');

const added = Object.entries(tables).flatMap(([t, cs]) => cs.filter((c) => !(before[t] ?? []).includes(c)).map((c) => `${t}.${c}`));
const gone = Object.entries(before).flatMap(([t, cs]) => cs.filter((c) => !(tables[t] ?? []).includes(c)).map((c) => `${t}.${c}`));
console.log(`✅ 스냅샷 갱신 — 테이블 ${Object.keys(tables).length}개`);
if (added.length) console.log(`   + 추가 ${added.length}: ${added.slice(0, 12).join(', ')}${added.length > 12 ? ' …' : ''}`);
if (gone.length) console.log(`   − 사라짐 ${gone.length}: ${gone.slice(0, 12).join(', ')}${gone.length > 12 ? ' …' : ''}`);
if (!added.length && !gone.length) console.log('   변화 없음');
