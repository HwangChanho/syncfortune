#!/usr/bin/env tsx
/**
 * check:copy — 문구의 **단일 출처**를 지킨다.
 * ═══════════════════════════════════════════════════════════════════════════
 * 왜(daniel 2026-08-03 "문구들 다 직접 수정할 수 있게 한 곳에 모아줘"):
 *   문구가 세 곳에 흩어져 있었다 — ①i18n ②화면의 인라인 기본값 `t(키,'문구')` ③하드코딩 JSX.
 *   ②가 ①과 어긋나면 **어느 쪽이 보이는지 아무도 모른다.** 실제로 그 사고가 났다:
 *   07-28 화폐를 '운'으로 통일했는데 궁합 화면은 "이용권 1회 또는 결제"를 계속 보여 줬고,
 *   운을 차감하면서 다른 화폐를 표시하고 있었다(08-02 발견).
 *
 * 규칙
 *   C1 세 언어의 **키가 정확히 같다** — 하나만 고치면 다른 언어에서 키가 그대로 노출된다.
 *   C2 인라인 기본값이 copy/ko.ts 와 **다르면 실패** — 둘이 다르면 화면에 뭐가 뜰지 모른다.
 *   C3 값이 빈 문자열이 아니다 — 빈 문구는 화면에 공백으로 나간다.
 *
 * ★C2 는 '없으면' 이 아니라 '다르면' 실패다. 기본값 자체는 폴백으로 유용하다(i18n 로드 전).
 *
 * 사용: npm run check:copy
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const COPY = join(ROOT, 'app/src/copy');

function objOf(file: string, name: string): Record<string, unknown> {
  const src = readFileSync(join(COPY, file), 'utf8');
  const i = src.indexOf(`export const ${name} = {`);
  const s = src.indexOf('{', i);
  let d = 0, j = s;
  for (; j < src.length; j++) { const c = src[j]; if (c === '{') d++; else if (c === '}') { d--; if (!d) break; } }
  // 문구 파일은 순수 리터럴이라 평가해도 부수효과가 없다(import 도 없다).
  return eval('(' + src.slice(s, j + 1) + ')');
}
const flat = (o: any, p = ''): [string, unknown][] =>
  Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? flat(v, p + k + '.') : [[p + k, v] as [string, unknown]]));

const ko = flat(objOf('ko.ts', 'ko'));
const en = flat(objOf('en.ts', 'en'));
const ja = flat(objOf('ja.ts', 'ja'));
const koMap = new Map(ko);

const problems: string[] = [];
const ok = (m: string) => console.log(`  ✓ ${m}`);
const bad = (m: string) => { console.log(`  ✗ ${m}`); problems.push(m); };

console.log('\n📝 check:copy — 문구 단일 출처\n');

// ── C1 언어 간 키 일치 ─────────────────────────────────────────────────────
{
  const K = (a: [string, unknown][]) => new Set(a.map(([k]) => k));
  const kk = K(ko);
  for (const [name, arr] of [['en', en], ['ja', ja]] as const) {
    const s = K(arr);
    const missing = [...kk].filter((k) => !s.has(k));
    const extra = [...s].filter((k) => !kk.has(k));
    if (missing.length || extra.length) {
      bad(`[C1] ${name}: ko 대비 누락 ${missing.length}${missing.length ? ` (${missing.slice(0, 4).join(', ')})` : ''} · 잉여 ${extra.length}${extra.length ? ` (${extra.slice(0, 4).join(', ')})` : ''}`);
    } else ok(`[C1] ${name} 키가 ko 와 일치 (${s.size}개)`);
  }
}

// ── C3 빈 값 ───────────────────────────────────────────────────────────────
{
  const empties = ko.filter(([, v]) => typeof v === 'string' && !v.trim()).map(([k]) => k);
  if (empties.length) bad(`[C3] ko 에 빈 문구 ${empties.length}건: ${empties.slice(0, 5).join(', ')}`);
  else ok('[C3] 빈 문구 없음');
}

// ── C2 인라인 기본값 ↔ copy/ko.ts 불일치 ───────────────────────────────────
{
  const files: string[] = [];
  (function walk(d: string) {
    for (const n of readdirSync(d)) {
      if (n === 'node_modules' || n.startsWith('.')) continue;
      const p = join(d, n);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(p) && !p.includes('/copy/')) files.push(p);
    }
  })(join(ROOT, 'app/src'));

  const mismatch: string[] = [];
  const missing: string[] = [];   // C4: 화면이 쓰는데 copy 에 없는 키(=en/ja 가 한국어로 뜬다)
  // t('a.b', '문구')  ·  따옴표/백틱 모두. 템플릿(${})이 든 기본값은 동적이라 제외.
  const RE = /\bt\(\s*['"]([\w.]+)['"]\s*,\s*(['"`])((?:(?!\2)[^\\]|\\.)*)\2/g;
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(RE)) {
      const [, key, , def] = m;
      if (def.includes('${')) continue;                 // 동적 기본값
      // ★C4 화면이 쓰는데 사전에 **없는** 키 — 종전엔 여기서 `continue` 로 조용히 넘겼다.
      //   그래서 personal.expertNote 가 ko/en/ja 에서 통째로 지워졌는데도 하네스가 통과했다
      //   (한국어는 인라인 기본값으로 그대로 떠서 눈에도 안 띈다 —
      //    ⚠️망가지는 건 **영어·일본어 사용자**로, 그들에게 한국어가 뜬다).
      if (!koMap.has(key)) { missing.push(`${relative(ROOT, f)}:${src.slice(0, m.index!).split('\n').length}  ${key}`); continue; }
      const cur = koMap.get(key);
      if (typeof cur !== 'string') continue;
      const norm = (s: string) => s.replace(/\\n/g, '\n').trim();
      if (norm(cur) !== norm(def)) {
        const line = src.slice(0, m.index!).split('\n').length;
        mismatch.push(`${relative(ROOT, f)}:${line}  ${key}\n        copy: ${JSON.stringify(cur).slice(0, 70)}\n        화면: ${JSON.stringify(def).slice(0, 70)}`);
      }
    }
  }
  if (mismatch.length) {
    bad(`[C2] 인라인 기본값이 copy/ko.ts 와 다른 곳 ${mismatch.length}건 — 화면에 뭐가 뜰지 알 수 없다`);
    mismatch.slice(0, 12).forEach((x) => console.log(`      · ${x}`));
    if (mismatch.length > 12) console.log(`      … 외 ${mismatch.length - 12}건`);
  } else ok('[C2] 인라인 기본값이 전부 copy/ko.ts 와 일치');

  if (missing.length) {
    bad(`[C4] 화면이 쓰는데 copy/ko.ts 에 없는 키 ${missing.length}건 — en/ja 사용자에게 한국어가 뜬다`);
    missing.slice(0, 12).forEach((x) => console.log(`      · ${x}`));
    if (missing.length > 12) console.log(`      … 외 ${missing.length - 12}건`);
  } else ok('[C4] 화면이 쓰는 키가 전부 copy 에 있다');
}

// ── [C5] en/ja 에 **한국어가 그대로 남아 있는가**(daniel 2026-08-12 "다 고쳐") ────────────
//   [C1] 은 **키 개수**만 본다. 그래서 값이 한국어 그대로여도 통과했고,
//   실측 결과 en·ja 각각 **293건**(1413키의 21%)이 번역되지 않은 채 출시돼 있었다 —
//   `추가`·`확인`·`삭제`·`로그인` 같은 기본 단어까지. 영어·일본어 사용자에게 한국어가 떴다.
//   ⇒ "키가 맞는가"가 아니라 **"말이 그 언어인가"** 를 본다([[harness-judge-expression-not-name]]).
{
  const KO = /[가-힣]/;
  /** 한국어를 일부러 남기는 자리 — **이유 필수**(고유명사·원어 병기 등). 이유 없이 추가 금지. */
  const ALLOW: { lang: string; key: string; why: string }[] = [];
  const found: string[] = [];
  // ⚠️★2026-08-26 대조군에서 **구멍이 드러났다**: 종전 정규식은
  //     /^\s*'키':\s*'값',?\s*$/  ← **작은따옴표 + 줄 전체**만 봤다.
  //   그래서 `"큰따옴표 한국어"` 값과 뒤에 주석이 붙은 줄을 **통째로 놓쳤다**(심어서 확인).
  //   ⇒ ①주석을 먼저 지우고 ②따옴표 두 종류를 다 받고 ③줄 앵커를 풀었다.
  //   [[i18n-untranslated-shipped]] — "키가 맞는가" 가 아니라 "말이 그 언어인가".
  for (const lang of ['en', 'ja'] as const) {
    const raw = readFileSync(`app/src/copy/${lang}.ts`, 'utf8');
    // 주석 제거 — 주석에 적힌 한국어 설명은 잘못이 아니다(오탐 방지)
    const code = raw.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
    const lines = code.split('\n');
    let sec = '';
    lines.forEach((l, i) => {
      const ms = /^\s{2}([A-Za-z_][A-Za-z0-9_]*): \{/.exec(l);
      if (ms) { sec = ms[1]; return; }
      // 작은따옴표·큰따옴표 둘 다 · 줄 어디에 있어도
      for (const mv of l.matchAll(/'([A-Za-z0-9_.]+)'\s*:\s*(['"])((?:\\.|(?!\2).)*)\2/g)) {
        const val = mv[3];
        if (!KO.test(val)) continue;
        const key = `${sec}.${mv[1]}`;
        if (ALLOW.some((a) => a.lang === lang && a.key === key)) continue;
        found.push(`${lang}.ts:${i + 1}  ${key}  ${val.slice(0, 40)}`);
      }
    });
  }
  if (found.length) {
    bad(`[C5] en/ja 에 한국어가 남아 있음 ${found.length}건 — 그 언어 사용자에게 한국어가 뜬다`);
    found.slice(0, 12).forEach((x) => console.log(`      · ${x}`));
    if (found.length > 12) console.log(`      … 외 ${found.length - 12}건`);
  } else ok('[C5] en/ja 에 한국어가 남아 있지 않음');
}

if (problems.length) { console.error(`\n❌ check:copy 실패 ${problems.length}건\n`); process.exit(1); }
console.log('\n✅ check:copy 통과 — 문구 단일 출처 유지\n');
