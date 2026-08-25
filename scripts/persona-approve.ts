#!/usr/bin/env tsx
/**
 * persona:approve — 말투 예시 초안을 **서비스에 켠다**(Boss 승인 행위).
 * ═══════════════════════════════════════════════════════════════════════════
 * Edge 는 `author='boss'` 인 예시만 싣는다. `0040` 마이그레이션이 넣은 33건은
 * `author='draft'` 라 **저장돼 있을 뿐 하나도 안 나갔다** — 2026-08-25 실측으로 드러났고,
 * Boss 가 느낀 *"선생님들만의 대화 개성이 제대로 적용 안된거 같어"* 의 원인이 이것이었다.
 *
 * ⚠️이 스크립트는 **Boss 가 읽고 «켜라» 고 했을 때만** 돌린다. 초안을 스스로 승격하면
 *   검수 관문이 있으나 마나가 된다.
 *
 * 사용: npm run persona:approve            (전체)
 *       npm run persona:approve -- <id…>   (일부만)
 *       npm run persona:approve -- --list  (무엇이 잠들어 있는지만 본다)
 */
import { readFileSync } from 'node:fs';

const env = readFileSync('.env', 'utf8');
const pick = (k: string) => (new RegExp(`^${k}=(.*)$`, 'm').exec(env)?.[1] ?? '').replace(/['"]/g, '').trim();
const URL_BASE = pick('SUPABASE_URL'), SERVICE = pick('SUPABASE_SERVICE_ROLE_KEY');
if (!URL_BASE || !SERVICE) { console.error('❌ .env 에 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 없다'); process.exit(1); }
const H = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' };

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const listOnly = process.argv.includes('--list');

const q = await fetch(`${URL_BASE}/rest/v1/consultant_examples?select=id,consultant_id,user_says,reply,weight,author&author=neq.boss&order=consultant_id,weight.desc`, { headers: H });
const rows = await q.json() as any[];
if (!Array.isArray(rows) || !rows.length) { console.log('✅ 잠들어 있는 초안이 없습니다(전부 켜져 있거나 비어 있습니다)'); process.exit(0); }

const targets = args.length ? rows.filter((r) => args.includes(r.consultant_id)) : rows;
const byC = new Map<string, any[]>();
for (const r of targets) byC.set(r.consultant_id, [...(byC.get(r.consultant_id) ?? []), r]);

console.log(`\n${listOnly ? '📋 잠들어 있는 말투 예시' : '🔓 켤 말투 예시'} — ${targets.length}건 · 상담가 ${byC.size}명\n`);
for (const [cid, list] of byC) {
  console.log(`── ${cid}`);
  for (const r of list) {
    console.log(`   회원: ${r.user_says}`);
    for (const line of String(r.reply).split('\n')) if (line.trim()) console.log(`   나  : ${line.trim()}`);
  }
  console.log();
}
if (listOnly) { console.log('→ 켜려면: npm run persona:approve'); process.exit(0); }

let done = 0;
for (const r of targets) {
  const res = await fetch(`${URL_BASE}/rest/v1/consultant_examples?id=eq.${r.id}`, {
    method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify({ author: 'boss' }),
  });
  if (res.ok) done++; else console.error(`  ❌ ${r.consultant_id} #${r.id} — HTTP ${res.status}`);
}
console.log(`✅ ${done}건을 켰습니다. 다음 대화부터 그 결로 말합니다.`);
console.log('   확인: npm run check:persona');
