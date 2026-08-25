#!/usr/bin/env tsx
/**
 * check:coinhistory — 운 사용 내역이 **코드가 아니라 그 나라 말로** 나오는지 지킨다.
 * ═══════════════════════════════════════════════════════════════════════════
 * Boss 2026-08-25 *"운사용내역은 디테일하게 해당국가 언어로 노츌 돼야해"*.
 *
 * 종전엔 화면이 `coin_ledger.reason` 을 **원문 그대로** 찍었다. 그 값은 `spend`·`purchase`
 * 같은 **코드**라서 한국 사용자에겐 영어 코드가, 영어·일본어 사용자에겐 번역 안 된 값이 떴다.
 * 그리고 «무엇에 썼는지»(`kind`)가 없어 `spend` 만 봐서는 궁합인지 대화인지 알 수 없었다.
 *
 * 규칙
 *   H1 화면이 `reason` 을 직접 찍지 않는다(`coinLedgerLabel` 을 쓴다)
 *   H2 DB 에 **실제로 있는** reason 값이 전부 `coinLedgerLabel` 안에 있다
 *      ★새 reason 이 생기면 «운 사용/충전» 으로 뭉개진다 — 그때 여기서 운다
 *   H3 DB 에 실제로 있는 kind 가 전부 이름으로 바뀐다(목록 · 상품 규칙 · 예외 둘)
 *   H4 쓰는 문구 키가 ko·en·ja 에 모두 있다
 *
 * 사용: npm run check:coinhistory
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const P_SCREEN = 'app/src/app/(app)/coinhistory.tsx';
const P_LABEL = 'app/src/lib/content/coinLedgerLabel.ts';
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
const fails: string[] = [];

const screen = code(read(P_SCREEN));
const label = code(read(P_LABEL));

// ── H1 ────────────────────────────────────────────────────
if (!/coinLedgerLabel\s*\(/.test(screen)) fails.push(`[H1] ${P_SCREEN} 가 coinLedgerLabel() 을 안 쓴다`);
if (/\{\s*e\.reason\s*\|\|/.test(screen)) fails.push(`[H1] ${P_SCREEN} 가 아직 e.reason 을 그대로 찍는다 — 코드가 화면에 뜬다`);

// ── H4 문구 키 ────────────────────────────────────────────
const used = [...label.matchAll(/t\('([\w.]+)'/g)].map((m) => m[1]);
for (const lang of ['ko', 'en', 'ja']) {
  const c = read(`app/src/copy/${lang}.ts`);
  for (const k of used) {
    const leaf = k.split('.').pop()!;
    // ⚠️`'charge': …` 처럼 **따옴표 붙은 키**도 인정한다 — 안 그러면 있는 키를 «없다» 고 해서
    //   중복을 넣게 된다(2026-08-25 실제로 그랬다).
    if (!new RegExp(`(^|[\\s{,])'?${leaf}'?\\s*:`, 'm').test(c)) fails.push(`[H4] ${lang}.ts 에 '${k}' 가 없다 — 그 언어 사용자에게 키가 그대로 뜬다`);
  }
}

// ── H2·H3 DB 실측 ─────────────────────────────────────────
const env = readFileSync(join(ROOT, '.env'), 'utf8');
const pick = (k: string) => (new RegExp(`^${k}=(.*)$`, 'm').exec(env)?.[1] ?? '').replace(/['"]/g, '').trim();
const URL_BASE = pick('SUPABASE_URL'), SVC = pick('SUPABASE_SERVICE_ROLE_KEY');
if (!URL_BASE || !SVC) {
  console.log('  ·  service_role 키 없음 — DB 실측 생략(코드 검사만)');
} else {
  const r = await fetch(`${URL_BASE}/rest/v1/coin_ledger?select=reason,kind&limit=2000`,
    { headers: { apikey: SVC, Authorization: `Bearer ${SVC}` } });
  const rows = await r.json() as { reason: string | null; kind: string | null }[];
  if (Array.isArray(rows)) {
    const reasons = new Set(rows.map((x) => String(x.reason ?? '')).filter(Boolean));
    for (const rs of reasons) {
      if (!new RegExp(`case '${rs}'`).test(label)) fails.push(`[H2] reason '${rs}' 가 coinLedgerLabel 에 없다 — 「운 사용/충전」으로 뭉개진다`);
    }
    // 콘텐츠 목록의 키
    const sections = code(read('app/src/lib/content/contentSections.ts'));
    const known = new Set([...sections.matchAll(/\{ key: '([a-zA-Z_]+)',\s*labelKey:/g)].map((m) => m[1]));
    const kinds = new Set(rows.map((x) => String(x.kind ?? '')).filter(Boolean));
    for (const k of kinds) {
      if (/^coin_\d+$/.test(k) || /^adfree_\d+$/.test(k)) continue;   // 상품 규칙이 처리
      if (known.has(k)) continue;                                      // 목록에 이름이 있다
      if (new RegExp(`kind === '${k}'`).test(label)) continue;         // 예외로 적어 뒀다
      fails.push(`[H3] kind '${k}' 의 이름을 못 찾는다 — 내역에 «무엇에 썼는지» 가 안 뜬다`);
    }
    console.log(`  ·  DB 실측 — reason ${reasons.size}종 · kind ${kinds.size}종`);
  } else console.log('  ·  DB 조회 실패 — 생략');
}

if (fails.length) {
  console.error(`❌ check:coinhistory — ${fails.length}건`);
  for (const f of fails) console.error(`  ${f}`);
  process.exit(1);
}
console.log('✅ check:coinhistory — 내역이 코드가 아니라 그 나라 말로 나옵니다');
