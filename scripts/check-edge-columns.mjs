#!/usr/bin/env node
// scripts/check-edge-columns.mjs — `.from('t').select('...')` 컬럼이 **실제 DB 스키마에 있는지** 검사
// ─────────────────────────────────────────────────────────────────────────
// ★왜 만들었나(2026-07-30 실사고):
//   AI 코치가 07-26~30 내내 죽어 있었다. 원인은 단 한 글자짜리 드리프트였다 —
//     supabase.from('charts').select('saju, ziwei, owner_id, label')
//   charts 에 평문 `label` 컬럼은 **없다**(암호화 `label_enc`). PostgREST 가 42703 을 돌려주고
//   `chartRow` 가 null 이 되는데, 코드가 그 null 을 "차트가 없다"로 읽어 **404**를 냈다.
//   에러 코드는 아무 데도 안 남아서, 원인을 3번 헛짚었다(네트워크·세션·앱빌드).
//
// ★★교훈(반복 유형): **이름으로 판단하지 말고 실제와 대조하라.**
//   컴파일러는 PostgREST 문자열을 검사하지 못한다 → 문자열을 검사하는 하네스가 필요하다.
//   이건 앱(app/src)에도 똑같이 적용된다 — 앱의 select 도 같이 본다.
//
// 스냅샷: scripts/db-columns.json (마이그레이션 후 `npm run snap:cols` 로 갱신)
//   ⚠️스냅샷에 없는 테이블은 **에러가 아니라 경고**로 둔다(뷰·신규 테이블·스냅샷 미갱신 가능성).
//     스냅샷을 정답으로 단정해 오탐을 내면 하네스를 아무도 안 믿게 된다(07-26 교훈).
// ─────────────────────────────────────────────────────────────────────────
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SNAP = JSON.parse(readFileSync(join(ROOT, 'scripts/db-columns.json'), 'utf8'));
const TABLES = SNAP.tables;

/** 스캔 대상 — Edge(서버)와 앱 클라이언트 둘 다 PostgREST 문자열을 쓴다. */
const SCAN_DIRS = ['supabase/functions', 'app/src', 'scripts'];
const EXT = /\.(ts|tsx|mjs|js)$/;

/** 디렉터리 재귀 수집(node_modules·빌드 산출물 제외). */
function walk(dir, out = []) {
  let entries;
  try { entries = readdirSync(dir); } catch { return out; }
  for (const e of entries) {
    if (e === 'node_modules' || e === '.expo' || e === 'dist' || e === 'build' || e === 'ios' || e === 'android') continue;
    const p = join(dir, e);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (EXT.test(e)) out.push(p);
  }
  return out;
}

/**
 * 주석 제거 — 주석 안의 예시 코드가 오탐을 만든 적이 두 번 있다(07-26·07-29).
 * 문자열 안의 `//` 는 건드리지 않도록 아주 단순한 상태기계로 처리한다.
 */
function stripComments(src) {
  let out = ''; let i = 0;
  let inS = null;         // 문자열 따옴표 종류
  let inLine = false, inBlock = false;
  while (i < src.length) {
    const c = src[i], n = src[i + 1];
    if (inLine) { if (c === '\n') { inLine = false; out += c; } else out += ' '; i++; continue; }
    if (inBlock) { if (c === '*' && n === '/') { inBlock = false; out += '  '; i += 2; } else { out += c === '\n' ? c : ' '; i++; } continue; }
    if (inS) {
      out += c;
      if (c === '\\') { out += src[i + 1] ?? ''; i += 2; continue; }
      if (c === inS) inS = null;
      i++; continue;
    }
    if (c === '/' && n === '/') { inLine = true; i += 2; continue; }
    if (c === '/' && n === '*') { inBlock = true; i += 2; continue; }
    if (c === '"' || c === "'" || c === '`') { inS = c; out += c; i++; continue; }
    out += c; i++;
  }
  return out;
}

/**
 * select 목록 파싱 → 컬럼명 배열.
 * PostgREST 문법에서 실제 '컬럼'만 뽑는다:
 *   - `*` · `count` 집계 → 스킵
 *   - `alias:col` → col
 *   - `rel(a,b)` → 임베디드 관계(다른 테이블) → 통째로 스킵(테이블을 특정할 수 없다 = 오탐 위험)
 *   - `col.eq.x` 같은 필터 문법은 select 에 안 온다
 */
function parseSelect(sel) {
  if (sel.includes('(')) return null;        // 임베디드 조인 포함 → 검사 포기(오탐 방지)
  const cols = [];
  for (let part of sel.split(',')) {
    part = part.trim();
    if (!part || part === '*') continue;
    if (part.includes(':')) part = part.split(':').pop().trim();   // alias:col
    part = part.replace(/::.*$/, '').trim();                        // 캐스팅 제거
    if (!/^[a-z_][a-z0-9_]*$/i.test(part)) return null;             // 예상 밖 문법 → 검사 포기
    cols.push(part);
  }
  return cols;
}

const errors = [];
const warns = [];

for (const d of SCAN_DIRS) {
  for (const file of walk(join(ROOT, d))) {
    const raw = readFileSync(file, 'utf8');
    const src = stripComments(raw);
    // `.from('table')` 다음에 나오는 첫 `.select('...')` 를 짝짓는다(체이닝 사이에 다른 호출이 끼어도 허용).
    const re = /\.from\(\s*['"]([a-z0-9_]+)['"]\s*\)([\s\S]{0,400}?)\.select\(\s*['"]([^'"]*)['"]/gi;
    let m;
    while ((m = re.exec(src))) {
      const [, table, between, sel] = m;
      if (between.includes('.from(')) continue;               // 다른 from 이 끼어들었으면 짝이 아니다
      const known = TABLES[table];
      if (!known) { warns.push(`${relative(ROOT, file)} — 스냅샷에 없는 테이블 '${table}' (뷰·신규? 스냅샷 갱신 확인)`); continue; }
      const cols = parseSelect(sel);
      if (!cols) continue;                                     // 파싱 불가 = 검사 포기(오탐 금지)
      const missing = cols.filter((c) => !known.includes(c));
      if (missing.length) {
        const line = src.slice(0, m.index).split('\n').length;
        errors.push(`${relative(ROOT, file)}:${line} — ${table} 에 없는 컬럼: ${missing.join(', ')}  (실제: ${known.join(', ')})`);
      }
    }
  }
}

if (warns.length) {
  console.log('⚠️  경고(참고만):');
  for (const w of warns) console.log('   ' + w);
}
if (errors.length) {
  console.error(`\n❌ 존재하지 않는 컬럼 select ${errors.length}건 — PostgREST 42703 → 런타임에 조용히 null/404 가 된다:`);
  for (const e of errors) console.error('   ' + e);
  process.exit(1);
}
console.log('✅ check:cols — 모든 .from().select() 컬럼이 실제 스키마에 존재합니다.');
