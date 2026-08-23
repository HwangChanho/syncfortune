/**
 * scripts/personas-push.ts — 말투 원본(`consultant-personas.ts`) → DB 반영
 * ═════════════════════════════════════════════════════════════════════════
 * ■ 왜 스크립트인가
 *   말투는 코드가 아니라 **DB 값**이라 관리자 콘솔에서도 고칠 수 있다. 그래서 원본이 어디인지가
 *   흐려지기 쉽다. ⇒ 원본은 `scripts/consultant-personas.ts` 하나, 반영은 이 스크립트 하나.
 *   (`--dry` 로 무엇이 바뀌는지 먼저 보고 나서 밀 수 있다.)
 *
 * ■ ⚠️`nossem` 은 건드리지 않는다
 *   실존 인물이고 대화 형식은 Boss 가 준다. 목록에 없으므로 손대지 않는다.
 *
 * ■ ⚠️`guardrails` 도 건드리지 않는다
 *   그건 **안전 가드**다(의료 단정 금지·투자 단정 금지 등 · CLAUDE.md §4). 말투 작업이
 *   안전 문구를 덮어쓰면 안 된다. 이 스크립트는 `persona` 컬럼만 쓴다.
 *
 * 실행: npm run personas:push -- --dry   (무엇이 바뀌는지만 본다)
 *       npm run personas:push            (실제 반영)
 */
import { readFileSync } from 'node:fs';
import { PERSONAS } from './consultant-personas';

const dry = process.argv.includes('--dry');

const env = readFileSync('.env', 'utf8');
const pick = (k: string) => (new RegExp(`^${k}=(.*)$`, 'm').exec(env)?.[1] ?? '').replace(/['"]/g, '').trim();
const URL_BASE = pick('SUPABASE_URL');
const SERVICE = pick('SUPABASE_SERVICE_ROLE_KEY');
if (!URL_BASE || !SERVICE) { console.log('\n⚠️ .env 에 SUPABASE_URL · SUPABASE_SERVICE_ROLE_KEY 가 필요합니다.\n'); process.exit(1); }

const H = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` };

/** 현재 DB 값을 읽어 온다(무엇이 바뀌는지 보여 주기 위해). */
const res = await fetch(`${URL_BASE}/rest/v1/consultants?select=id,name,persona`, { headers: H });
const rows = (await res.json()) as { id: string; name: string; persona: string | null }[];
const now = new Map(rows.map((r) => [r.id, r.persona ?? '']));

console.log(`\n🗣  상담가 말투 ${dry ? '비교(반영 안 함)' : '반영'}\n`);
let changed = 0, same = 0, failed = 0;

for (const p of PERSONAS) {
  const before = now.get(p.id);
  if (before === undefined) { failed++; console.log(`  ❌ ${p.name}(${p.id}) — DB 에 없는 id`); continue; }
  if (before.trim() === p.persona.trim()) { same++; console.log(`  ·  ${p.name.padEnd(8)} 그대로`); continue; }
  changed++;
  console.log(`  ${dry ? '→' : '✅'} ${p.name.padEnd(8)} 어미 ${p.endings.join(' ')}  (${before ? `${before.split('\n').length}줄` : '비어 있었음'} → ${p.persona.split('\n').length}줄)`);
  if (dry) continue;
  const up = await fetch(`${URL_BASE}/rest/v1/consultants?id=eq.${encodeURIComponent(p.id)}`, {
    method: 'PATCH',
    headers: { ...H, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ persona: p.persona }),   // ★persona 만 쓴다 — guardrails 는 안전 가드다
  });
  if (!up.ok) { failed++; console.log(`     ❌ 반영 실패 HTTP ${up.status} — ${(await up.text()).slice(0, 160)}`); }
}

// ★목록에 없는 사람은 **건드리지 않았다**고 분명히 말한다(조용히 빠뜨린 것과 구분).
const untouched = rows.filter((r) => !PERSONAS.some((p) => p.id === r.id));
if (untouched.length) {
  console.log(`\n  건드리지 않음: ${untouched.map((r) => `${r.name}(${r.persona?.trim() ? '말투 있음' : '비어 있음 — Boss 슬롯'})`).join(' · ')}`);
}

console.log(`\n   바뀜 ${changed} · 그대로 ${same}${failed ? ` · 실패 ${failed}` : ''}\n`);
if (failed) process.exit(1);
