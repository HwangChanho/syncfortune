// scripts/check-stance.ts — 상담가 판정이 **도착했는데 아무도 안 본 것**을 잡는다
// ═══════════════════════════════════════════════════════════════════════════
// 왜 만들었나 (2026-08-10 실사고 · 세 번 반복):
//   상담가 판정은 웹(ADR-060)에서 DB `rag_validation_items` 로 **조용히** 들어온다.
//   알림이 없다. 그래서 세 번 놓쳤다 —
//     · `verify-000c-structure` 14문항 : 08-03 판정 → 08-10 발견 (7일)
//     · `verify-000-rules`     11문항 : 08-04 판정 → 08-10 발견 (6일)
//     · `verify-000f-claim`     8문항 : 08-09 판정 → 08-10 발견 (1일, 같은 날 세션이 놓침)
//   그 사이 메모리·인계 문서에는 전부 **"daniel/상담가 판정 대기"** 로 적혀 있었다.
//   ★ 즉 "물어봤다"는 기억이 "답이 없다"는 사실로 굳어 버린다 — CLAUDE.md §5.5 그 자체.
//
// 무엇을 검사하나:
//   규칙 세트(`verify-000*`)의 **판정된 항목 전건**이 `knowledge/rules/STANCE_LEDGER.md` 에
//   `slug#seq` 키로 한 줄씩 적혀 있는가. 없으면 실패한다.
//   ⚠️'반영했는가'는 검사하지 않는다 — 대장에 `미반영`이라 적는 것도 정상 상태다(인지는 됐다).
//     기계가 잡으려는 것은 **인지 자체의 누락**이다. 반영 여부는 사람이 순서를 정한다.
//   ⇒ 그래서 `verify-000d-johu`·`verify-000e-attach` 에 답이 오는 순간 이 하네스가 **먼저** 운다.
//
// ★음성 테스트 필수(harness-judge-expression-not-name 교훈 — 첫 판이 6개 중 4개를 못 물었다):
//   `npx tsx scripts/check-stance.ts --selftest`
//   특히 **부분일치 함정**: 대장에 `#1` 이 있다고 `#11` 이 통과하면 안 된다.
// ═══════════════════════════════════════════════════════════════════════════
import fs from 'fs';
import path from 'path';

const LEDGER = 'knowledge/rules/STANCE_LEDGER.md';
const TIMEOUT_MS = 15_000;   // ★네트워크 기본 타임아웃 없음(session-2026-07-31-handoff) — 반드시 건다

/** 대장에서 뽑아낸 키 하나 = (세트 slug, 문항 번호). */
type Key = { slug: string; seq: number };

/**
 * 대장 마크다운 → 키 집합.
 *
 * 인식하는 표기(백틱 안에서만 — 산문에 우연히 섞인 글자를 키로 오인하지 않는다):
 *   `verify-000c-structure#3`            단건
 *   `verify-000b-romance#1~8,10,11`      범위 + 나열 (X 10건처럼 한 줄로 묶어 적을 때)
 *
 * ★번호는 **정확히** 파싱한다. 문자열 부분일치(`includes('#1')`)로 판정하면
 *   `#11`·`#18` 이 `#1` 로 통과해 버린다 — 하네스가 뚫리는 전형적인 방식이다.
 *
 * @param md 대장 파일 전문
 * @returns 키 집합 (`slug#seq` 문자열)
 */
export function parseLedger(md: string): Set<string> {
  const out = new Set<string>();
  // 백틱으로 감싼 `slug#숫자표기` 만 본다. 숫자표기 = 숫자 · `~`(범위) · `,`(나열) · 공백
  const re = /`(verify-[a-z0-9-]+)#([0-9]+(?:\s*[~,]\s*[0-9]+)*)`/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(md))) {
    const slug = m[1];
    for (const part of m[2].split(',')) {
      const seg = part.trim();
      if (!seg) continue;
      const range = /^([0-9]+)\s*~\s*([0-9]+)$/.exec(seg);
      if (range) {
        const [a, b] = [Number(range[1]), Number(range[2])];
        for (let i = Math.min(a, b); i <= Math.max(a, b); i++) out.add(`${slug}#${i}`);
      } else if (/^[0-9]+$/.test(seg)) {
        out.add(`${slug}#${Number(seg)}`);
      }
    }
  }
  return out;
}

/** 규칙(stance) 세트인가 — `verify-<숫자>` 는 명식 세트라 코퍼스 대조(check:goldensync)가 맡는다. */
export function isRuleSet(slug: string): boolean {
  return !/^verify-\d+$/.test(String(slug ?? '').trim());
}

// ── 음성 테스트: 규칙을 깨뜨린 입력을 실제로 무는지 ──────────────────────────
function selftest(): number {
  let bad = 0;
  const t = (name: string, cond: boolean) => { console.log(`  ${cond ? '✓' : '✗'} ${name}`); if (!cond) bad++; };

  const has = (md: string, k: string) => parseLedger(md).has(k);

  // ① 단건이 잡힌다
  t('단건 `verify-000c-structure#3` 인식', has('| `verify-000c-structure#3` | O |', 'verify-000c-structure#3'));

  // ② ★부분일치 함정 — `#1` 이 있다고 `#11` 이 통과하면 안 된다
  t('`#1` 만 있을 때 `#11` 은 미인식(부분일치 방지)',
    !has('`verify-000-rules#1`', 'verify-000-rules#11'));
  t('`#1~8` 만 있을 때 `#18` 은 미인식',
    !has('`verify-000b-romance#1~8`', 'verify-000b-romance#18'));

  // ③ 범위·나열 확장
  const rangeMd = '`verify-000b-romance#1~8,10,11`';
  t('범위 `1~8` 이 8건으로 확장', [1, 2, 3, 4, 5, 6, 7, 8].every((i) => has(rangeMd, `verify-000b-romance#${i}`)));
  t('나열 `,10,11` 도 확장', has(rangeMd, 'verify-000b-romance#10') && has(rangeMd, 'verify-000b-romance#11'));
  t('범위 밖 `#9` 는 미인식', !has(rangeMd, 'verify-000b-romance#9'));

  // ④ 백틱 없는 산문은 키가 아니다(문서에 우연히 쓴 문장이 통과시키면 안 된다)
  t('백틱 없는 산문 "verify-000d-johu#1 은 대기" 는 미인식',
    !has('verify-000d-johu#1 은 대기 상태다', 'verify-000d-johu#1'));

  // ⑤ 다른 세트의 같은 번호가 통과시키면 안 된다
  t('다른 slug 의 같은 번호로는 통과 못 함',
    !has('`verify-000-rules#3`', 'verify-000c-structure#3'));

  // ⑥ 실제 대장에서 한 줄을 지우면 그 키가 사라진다(하네스가 실제로 무는지)
  if (fs.existsSync(LEDGER)) {
    const md = fs.readFileSync(LEDGER, 'utf8');
    const full = parseLedger(md);
    const probe = 'verify-000c-structure#11';
    t('실제 대장에 `#11` 이 있다(대조군)', full.has(probe));
    const broken = md.replace(/\| `verify-000c-structure#11` \|[^\n]*\n/, '');
    t('그 줄을 지우면 미인식 = 하네스가 문다', broken !== md && !parseLedger(broken).has(probe));
  }

  // ⑦ 규칙 세트 판별
  t('`verify-000c-structure` = 규칙 세트', isRuleSet('verify-000c-structure'));
  t('`verify-110` = 명식 세트(대상 아님)', !isRuleSet('verify-110'));
  return bad;
}

/** .env 파싱 — 다른 DB 스크립트(golden-ingest 등)와 같은 규약. */
function readEnv(): Record<string, string> {
  const p = path.join(process.cwd(), '.env');
  if (!fs.existsSync(p)) return {};
  return Object.fromEntries(
    fs.readFileSync(p, 'utf8').split('\n')
      .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
      .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')]; }),
  );
}

async function main() {
  if (process.argv.includes('--selftest')) {
    console.log('🧪 check:stance — 음성 테스트');
    const bad = selftest();
    console.log(bad ? `\n❌ 음성 테스트 ${bad}건 실패 — 하네스가 못 문다` : '\n✅ 음성 테스트 전건 통과');
    process.exit(bad ? 1 : 0);
  }

  console.log('\n🔎 명리 stance 승격 대장 대조  (상담가 판정 DB ↔ STANCE_LEDGER.md)\n');

  if (!fs.existsSync(LEDGER)) {
    console.error(`❌ 대장이 없습니다: ${LEDGER}`);
    process.exit(1);
  }
  const ledger = parseLedger(fs.readFileSync(LEDGER, 'utf8'));

  const env = readEnv();
  const BASE = env.SUPABASE_URL || env.EXPO_PUBLIC_SUPABASE_URL;
  const KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.SERVICE_ROLE_KEY;
  if (!BASE || !KEY) {
    // CI·클론 직후처럼 자격증명이 없는 환경 — 검사를 못 하는 것과 통과는 다르다. 명시하고 건너뛴다.
    console.log('   ⏭️  .env 에 SUPABASE 자격증명이 없어 DB 대조를 건너뜁니다(로컬에서 실행하세요).');
    process.exit(0);
  }

  const q = async (p: string) => {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
    try {
      const r = await fetch(`${BASE}/rest/v1/${p}`, {
        headers: { apikey: KEY, Authorization: `Bearer ${KEY}` }, signal: ac.signal,
      });
      if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 160)}`);
      return r.json() as Promise<any[]>;
    } finally { clearTimeout(timer); }
  };

  let sets: any[], items: any[];
  try {
    [sets, items] = await Promise.all([
      q('rag_validation_sets?select=id,slug,title'),
      q('rag_validation_items?select=set_id,seq,verdict,judged_at&order=seq'),
    ]);
  } catch (e) {
    console.error(`❌ 판정 DB 조회 실패 — ${(e as Error).message}`);
    process.exit(1);
  }

  const missing: string[] = [];
  const pending: string[] = [];
  let judgedTotal = 0;

  for (const s of sets.filter((x) => isRuleSet(x.slug))) {
    const its = items.filter((i) => i.set_id === s.id);
    const judged = its.filter((i) => i.verdict && String(i.verdict).trim());
    judgedTotal += judged.length;
    if (!judged.length) { pending.push(`${s.slug} (${its.length}문항 · 미판정)`); continue; }
    const miss = judged.filter((i) => !ledger.has(`${s.slug}#${i.seq}`));
    const when = judged.map((i) => i.judged_at).filter(Boolean).sort().pop();
    console.log(`   ${miss.length ? '❌' : '✅'} ${s.slug.padEnd(24)} 판정 ${judged.length}/${its.length}`
      + `${when ? ` · ${String(when).slice(0, 10)}` : ''}${miss.length ? `  ← 대장 누락 #${miss.map((i) => i.seq).join(',#')}` : ''}`);
    miss.forEach((i) => missing.push(`${s.slug}#${i.seq} [${i.verdict}]`));
  }

  if (pending.length) {
    console.log('\n   ── 아직 판정 전(답이 오면 이 하네스가 먼저 운다) ──');
    pending.forEach((p) => console.log(`   ⏳ ${p}`));
  }

  // ── ★파일로만 있고 **DB 에 안 올라간 세트** (2026-08-25) ──────────────────
  //   이 하네스는 DB(`rag_validation_sets`)를 본다. 그래서 `knowledge/validation-sets/` 에
  //   파일을 만들어 두기만 하면 **여기 목록에 아예 안 뜬다** — 아무도 그 세트를 기다리지 않는다.
  //   ⚠️실제로 당했다: 개운 세트를 만들고 `check:stance` 를 돌렸는데 조용히 통과했다.
  //     올리지 않은 세트는 «없는 것»과 구분이 안 된다 — 물어보지도 않은 질문이 되는 것이다.
  //   ⇒ 로컬 파일의 slug 가 DB 에 없으면 **실패**시킨다. 초안 중이면 아직 커밋하지 않으면 된다.
  const unpushed: string[] = [];
  try {
    const dir = 'knowledge/validation-sets';
    const known = new Set(sets.map((x) => String(x.slug)));
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.set.json')) continue;
      const slug = f.slice(0, -'.set.json'.length);
      if (!known.has(slug)) unpushed.push(slug);
    }
  } catch { /* 폴더가 없으면 검사 생략 */ }
  if (unpushed.length) {
    console.error('\n❌ 판정 세트가 **파일로만** 있습니다 — 전문가에게 안 올라갔습니다.');
    unpushed.forEach((x) => console.error(`   · ${x}`));
    console.error('\n   → npm run rag:push <slug>');
    console.error('     올리지 않으면 이 하네스 목록에도 안 뜨고, 아무도 그 판정을 기다리지 않습니다.');
    process.exit(1);
  }

  // ── ★코드에 남은 '판정 대기 면제'가 유효한가 (2026-08-13) ─────────────────
  //   `verify` 는 판정이 없어 못 정하는 항목을 ⏳ 로 **면제**해 두고 통과한다
  //   (상시 빨간불이면 다른 회귀를 못 보기 때문). 그 면제는 **판정이 오는 순간 거짓말**이 된다.
  //   그런데 판정 도착은 아무도 알려주지 않는다 — 이미 세 번 놓쳤다([[stance-ledger-harness]]).
  //   ⇒ 면제가 어떤 세트를 기다리는지 코드에서 읽어, **그 세트에 판정이 오면 여기서 실패**시킨다.
  //     기억이 아니라 기계가 알아차리게 하는 장치다.
  const stale: string[] = [];
  try {
    const src = fs.readFileSync('engine/verify-fixture.ts', 'utf8');
    // 면제 목록에 달린 판정 세트 slug 를 코드에서 뽑는다(이름이 아니라 **실제 값**으로)
    const waited = new Set([...src.matchAll(/set:\s*'([a-z0-9-]+)'/g)].map((m) => m[1]));
    for (const slug of waited) {
      const set = sets.find((s) => s.slug === slug);
      if (!set) continue;
      const judged = items.filter((i) => i.set_id === set.id && i.verdict && String(i.verdict).trim());
      if (judged.length) stale.push(`${slug} — 판정 ${judged.length}건 도착 (verify 면제가 아직 코드에 남아 있습니다)`);
    }
  } catch { /* 파일이 없으면 검사 생략 — 이 하네스의 본업이 아니다 */ }

  console.log('\n   ── 요약 ──');
  console.log(`   판정된 규칙 항목 ${judgedTotal}건 · 대장 기재 ${ledger.size}건 · 누락 ${missing.length}건`);

  if (stale.length) {
    console.error('\n❌ 판정이 도착했는데 `verify` 가 아직 그 항목을 면제하고 있습니다.');
    stale.forEach((s) => console.error(`   · ${s}`));
    console.error('\n   → 판정대로 엔진을 고치고, engine/verify-fixture.ts 의 PENDING_STANCE 에서 해당 줄을 지우세요.');
    console.error('     면제를 남겨 두면 골든이 "통과"라고 말하지만 실제로는 검증되지 않은 상태입니다.');
    process.exit(1);
  }

  if (missing.length) {
    console.error('\n❌ 상담가 판정이 도착했는데 대장에 없습니다 — 아무도 안 본 판정입니다.');
    missing.forEach((k) => console.error(`   · ${k}`));
    console.error(`\n   → 내용을 읽고 ${LEDGER} 에 한 줄씩 적으세요.`);
    console.error('     반영하지 않기로 해도 `보류` + 사유로 적습니다(반영 여부가 아니라 *인지*를 검사합니다).');
    process.exit(1);
  }
  console.log('   ✅ 판정 전건이 대장에 기재돼 있습니다.\n');
}

main().catch((e) => { console.error('❌ check:stance 실패 —', e); process.exit(1); });
