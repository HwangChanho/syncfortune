// scripts/db-apply.mjs — `supabase/migrations/` 의 마이그레이션 **한 개**를 실서비스 DB 에 적용한다
// ═══════════════════════════════════════════════════════════════════════════
// ■ 왜 스크립트로 만드나
//   여태 DDL 은 **그때그때 만든 임시 스크립트**로 돌렸다. 그러면
//     ① 무엇을 돌렸는지 저장소에 안 남고
//     ② 무엇을 돌리려는지 **사람이 미리 볼 방법이 없다**(승인할 근거가 없다)
//   ⇒ 돌릴 파일을 `supabase/migrations/` 안으로 제한하고, **돌리기 전에 요약을 찍는다.**
//
// ■ 안전 장치
//   · 경로를 `supabase/migrations/` 로 못 박는다(상위 경로 `..` 차단)
//   · 표를 **지우는** 문장(drop table · truncate · delete from · drop schema)은 기본 거부.
//     정말 필요하면 `--allow-destructive` 를 손으로 붙인다 — 실수로는 못 지나가게.
//   · `--dry` 면 요약만 찍고 **아무것도 실행하지 않는다**(먼저 이걸로 본다).
//   ⚠️적용 자체는 되돌릴 수 없다. 되돌릴 마이그레이션이 필요하면 짝을 먼저 써 둘 것.
//
// ■ 자격증명
//   `~/.supabase/access-token`(관리 API) 또는 `.env` 의 `SUPABASE_ACCESS_TOKEN`.
//   프로젝트는 `.env` 의 `SUPABASE_PROJECT_REF`.
//
// 실행:  node scripts/db-apply.mjs supabase/migrations/<파일>.sql [--dry] [--allow-destructive]
// ═══════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const MIG_DIR = path.join(ROOT, 'supabase', 'migrations');

const args = process.argv.slice(2);
const dry = args.includes('--dry');
const allowDestructive = args.includes('--allow-destructive');
const target = args.find((a) => !a.startsWith('--'));

if (!target) {
  console.error('사용법: node scripts/db-apply.mjs supabase/migrations/<파일>.sql [--dry] [--allow-destructive]');
  process.exit(1);
}

// ── 경로 제한 — 마이그레이션 폴더 밖은 못 돌린다 ────────────────────────────
const abs = path.resolve(ROOT, target);
if (!abs.startsWith(MIG_DIR + path.sep)) {
  console.error(`❌ ${MIG_DIR} 안의 파일만 적용합니다 (받은 것: ${abs})`);
  process.exit(1);
}
if (!fs.existsSync(abs)) { console.error(`❌ 파일이 없습니다: ${abs}`); process.exit(1); }

const sql = fs.readFileSync(abs, 'utf8');

// ★주석만 걷어낸다. **줄 전체가 주석인 것만** 지우고 꼬리 주석은 남긴다 —
//   `--` 를 아무 데서나 잘라 내면 `'https://…'` 같은 문자열에서 잘려 **그 뒤 문장이 숨는다.**
//   위험 문장 판정은 «더 많이 남는 쪽» 이 안전하다(놓치는 것보다 헛되이 막는 편이 낫다).
const bare = sql.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*--.*$/gm, ' ').toLowerCase();
const DESTRUCTIVE = [/\bdrop\s+table\b/, /\btruncate\b/, /\bdelete\s+from\b/, /\bdrop\s+schema\b/, /\bdrop\s+database\b/];
const hits = DESTRUCTIVE.filter((re) => re.test(bare));

// ── 요약 ───────────────────────────────────────────────────────────────────
// ⚠️이 쪼개기는 **눈으로 보라고** 하는 것이다. 실제 전송은 파일 전문을 **통째로** 보낸다
//   (함수 본문의 `;` 까지 문장 경계로 세므로, 아래 목록은 정확한 문장 수가 아니다).
const statements = bare.replace(/--.*$/gm, ' ').split(';').map((s) => s.trim().replace(/\s+/g, ' ')).filter(Boolean);
console.log(`\n📄 ${path.relative(ROOT, abs)} · ${sql.length.toLocaleString()}자 · 문장 ${statements.length}개`);
for (const s of statements) console.log(`   · ${s.replace(/\s+/g, ' ').slice(0, 96)}`);

if (hits.length && !allowDestructive) {
  console.error(`\n❌ 표를 지우는 문장이 있습니다 — 확인 후 --allow-destructive 를 붙여 다시 실행하세요.\n`);
  process.exit(1);
}
if (dry) { console.log('\n🅳 --dry — 아무것도 실행하지 않았습니다.\n'); process.exit(0); }

// ── 자격증명 ───────────────────────────────────────────────────────────────
/** `.env` 에서 키 하나. ⚠️값에 `=` 가 들어갈 수 있어 **첫 `=` 에서만** 자른다. */
const envOf = (name) => {
  try {
    for (const line of fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split('\n')) {
      const i = line.indexOf('=');
      if (i > 0 && line.slice(0, i).trim() === name) return line.slice(i + 1).trim();
    }
  } catch { /* 없으면 없는 것 */ }
  return null;
};
let token = null;
try { token = fs.readFileSync(path.join(os.homedir(), '.supabase', 'access-token'), 'utf8').trim(); } catch { /* .env 로 */ }
token = token || envOf('SUPABASE_ACCESS_TOKEN');
const ref = envOf('SUPABASE_PROJECT_REF');
if (!token || !ref) { console.error('\n❌ 자격증명이 없습니다 — ~/.supabase/access-token 또는 .env 의 SUPABASE_ACCESS_TOKEN·SUPABASE_PROJECT_REF\n'); process.exit(1); }

// ── 적용 ───────────────────────────────────────────────────────────────────
const ac = new AbortController();
const timer = setTimeout(() => ac.abort(), 120_000);   // ⚠️상한 필수 — fetch 는 기본값이 없다
let res, body;
try {
  res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST', signal: ac.signal,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  body = await res.text();
} catch (e) {
  console.error(`\n❌ 요청 실패 — ${e.message}\n`); process.exit(1);
} finally { clearTimeout(timer); }

if (!res.ok) { console.error(`\n❌ 적용 실패 (HTTP ${res.status})\n${body.slice(0, 1200)}\n`); process.exit(1); }
console.log(`\n✅ 적용됨 (HTTP ${res.status}) ${body.slice(0, 300)}\n`);
console.log('   ★다음: 관련 하네스로 **결과를 실측**하십시오 (적용됐다 ≠ 뜻대로 됐다).\n');
