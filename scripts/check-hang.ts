// scripts/check-hang.ts — '앱이 멈췄다' 부류를 전수로 찾는 하네스
// ─────────────────────────────────────────────────────────────────────────
// daniel 2026-07-31: "또 발생할수있는 수많은 예외 케이스를 찾아서 너가 대응해야하지 않을까?"
//
// ★배경: 같은 병이 이틀 연속 다른 문으로 터졌다.
//   07-30 IMG_8313 '쿠폰으로 열기' 멈춤 — 잔액/이용권 조회가 안 끝남
//   07-31 IMG_8314 '명식의 뿌리 진행 중…' 멈춤 — 권한 RPC(isAdminActing)가 안 끝남
//   둘 다 코드는 멀쩡해 보이고, 좋은 회선에서는 100% 정상 동작한다.
//
// ★★병의 구조(이걸 알아야 왜 검사하는지가 보인다):
//   화면들은 연타 방지로 잠금을 건다 → `setBusy(true)` / `xxxRef.current = true`.
//   그리고 네트워크를 **await** 한다. 정상이든 예외든 `finally` 가 잠금을 푼다 — 여기까진 완벽하다.
//   그런데 **응답이 영영 안 오면** await 가 끝나지 않아 `finally` 자체가 실행되지 않는다.
//   예외가 아니라 '아무 일도 안 일어남'이라 try/catch 로도 안 잡힌다 → 잠금이 영구히 남고
//   그 뒤 탭은 첫 줄 가드에서 즉시 반환된다 = **버튼 영구 사망**.
//   ⚠️supabase-js·fetch 에는 **기본 타임아웃이 없다**(RN 포함). 이 사실이 코드 어디에도 안 보인다.
//
// 검사 항목
//   H1 잠금 해제   — 잠금을 건 함수에 `finally` 가 있다(예외로도 풀린다)
//   H2 대기 상한   — 잠금 구간에서 기다리는 **네트워크 호출**이 상한(withTimeout)을 통과한다
//   H3 약속 누수   — Alert 로 만든 Promise 의 **모든 버튼이 resolve** 한다(안 하면 영구 대기)
//   H4 유틸 단일화 — withTimeout 정의가 한 곳뿐(두 벌이면 한쪽만 고쳐진다 — 실제로 그럴 뻔했다)
//
// 실행: npm run check:hang
// ─────────────────────────────────────────────────────────────────────────
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const strip = (x: string) => x.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

let fail = 0;
const bad = (m: string) => { console.error(`  ✗ ${m}`); fail++; };
const ok = (m: string) => console.log(`  ✓ ${m}`);
const warn = (m: string) => console.log(`  ⚠️ ${m}`);

const files: string[] = [];
(function walk(d: string) {
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) walk(p); else if (/\.tsx?$/.test(e)) files.push(p);
  }
})(join(ROOT, 'app/src'));
const rel = (f: string) => f.replace(ROOT, '').replace('app/src/', '');

/** 함수 본문 추출 — `async function name(...) {` 부터 중괄호 균형이 맞을 때까지. */
function bodies(src: string): { name: string; body: string }[] {
  const out: { name: string; body: string }[] = [];
  const re = /(?:async\s+function\s+(\w+)|const\s+(\w+)\s*=\s*async\s*\()/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const name = m[1] ?? m[2];
    const open = src.indexOf('{', m.index);
    if (open < 0) continue;
    let depth = 0, i = open;
    for (; i < src.length; i++) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}') { depth--; if (!depth) break; }
      if (i - open > 20000) break;      // 방어: 균형이 안 맞으면 포기
    }
    out.push({ name, body: src.slice(open, i + 1) });
  }
  return out;
}

// 잠금을 거는 표현 · 네트워크 대기 표현
// ★LOCK 은 `setBusy(true)` 뿐 아니라 **값으로 잠그는 형태**(`setBusy(kind)`)도 잡아야 한다 —
//   마켓 buy() 가 `setBusy(kind)` 라서 종전 규칙이 통째로 빠져나갔다(daniel 2026-08-01 "구매하니깐 멈췄어").
//   해제(`setBusy(null|false)`)만 제외한다.
const LOCK = /(set(?:Flow)?Busy\((?!null|false)|\w*[Rr]ef\.current\s*=\s*true|acquireGen\()/;
const NET = /await\s+(supabase\.[\w.]*(?:from|rpc|functions|auth)|[\w.]*invoke\()/;
const BOUNDED = /withTimeout\s*\(|Promise\.race\s*\(/;

/**
 * ★**네트워크를 내부에서 하는 헬퍼**를 자동으로 찾아낸다.
 *
 * 왜 필요한가(2026-08-01 실제 사고): 마켓 buy() 는 `await ensureServerChartIdForSaved(...)` 를 불렀다.
 *   호출부만 보면 네트워크로 안 보이지만 그 함수는 안에서 supabase 왕복을 한다. 상한이 없어
 *   회선이 어정쩡하면 await 가 안 끝나고 → finally 가 실행되지 않아 → 버튼이 영구히 잠긴다.
 *   NET 정규식은 '직접 호출'만 보므로 이 부류를 통째로 놓쳤다.
 * 어떻게: lib 의 export 된 async 함수 중 **본문에 네트워크가 있고 상한이 없는 것**을 모은다.
 *   목록을 사람이 관리하지 않으므로(= 빠뜨릴 수 없다) 새 헬퍼가 생겨도 자동으로 포함된다.
 */
function unboundedNetHelpers(): Set<string> {
  const names = new Set<string>();
  for (const f of files) {
    if (!f.includes('/lib/')) continue;                       // 화면이 아니라 공용 헬퍼만
    const src = strip(readFileSync(f, 'utf8'));
    for (const { name, body } of bodies(src)) {
      if (!new RegExp(`export\\s+(?:async\\s+function\\s+${name}\\b|const\\s+${name}\\b)`).test(src)) continue;
      if (NET.test(body) && !BOUNDED.test(body)) names.add(name);
    }
  }
  return names;
}

// ── H1 잠금 해제 ─────────────────────────────────────────────────────────
console.log('\n[H1] 잠금을 건 함수는 finally 로 반드시 푼다');
{
  const miss: string[] = [];
  for (const f of files) {
    for (const { name, body } of bodies(strip(readFileSync(f, 'utf8')))) {
      if (!LOCK.test(body)) continue;
      // ★오탐을 좁힌다(이 프로젝트 반복 교훈): `finally` 가 없어도 **catch 뒤에서 해제**하면 안전하다.
      //   '해제가 아예 없는 것'만 누수로 본다. 오탐이 섞이면 하네스를 아무도 안 믿는다.
      const released = /finally\s*\{/.test(body)
        || /set(?:Flow)?Busy\(false\)/.test(body)
        || /\w*[Rr]ef\.current\s*=\s*(?:false|0)/.test(body)
        || /releaseGen\(/.test(body);
      if (!released) miss.push(`${rel(f)} · ${name}()`);
    }
  }
  if (!miss.length) ok('잠금 함수 전부 finally 보유');
  else { miss.slice(0, 12).forEach((m) => console.error(`      ${m}`)); bad(`finally 없는 잠금 함수 ${miss.length}건 — 예외가 나면 잠금이 영구히 남는다`); }
}

// ── H2 대기 상한 ─────────────────────────────────────────────────────────
console.log('\n[H2] 잠금 구간의 네트워크 대기에 상한이 있다 (★멈춤의 직접 원인)');
{
  const NET_HELPERS = unboundedNetHelpers();
  const unbounded: string[] = [];
  for (const f of files) {
    const src = strip(readFileSync(f, 'utf8'));
    for (const { name, body } of bodies(src)) {
      if (!LOCK.test(body)) continue;
      if (BOUNDED.test(body)) continue;                       // 상한 표현이 있으면 통과(오탐 억제 — 기존 규약 유지)
      // ①잠금 구간에서 **직접** 네트워크를 기다린다
      if (NET.test(body)) { unbounded.push(`${rel(f)} · ${name}()  [직접 호출]`); continue; }
      // ②잠금 구간에서 **네트워크 헬퍼**를 기다린다(호출부만 보면 네트워크로 안 보이는 부류)
      const via = [...NET_HELPERS].find((h) => new RegExp(`await\\s+${h}\\s*\\(`).test(body));
      if (via) unbounded.push(`${rel(f)} · ${name}()  [${via}() 내부가 네트워크]`);
    }
  }
  if (!unbounded.length) ok('잠금 구간의 직접 네트워크 대기 전부 상한 통과');
  else { unbounded.slice(0, 15).forEach((m) => console.error(`      ${m}`)); bad(`상한 없는 대기 ${unbounded.length}건 — 응답이 안 오면 버튼이 영구 사망한다`); }
}

// ── H3 약속 누수(Alert Promise) ──────────────────────────────────────────
console.log('\n[H3] Alert 로 만든 Promise 는 모든 버튼이 resolve 한다');
{
  const leak: string[] = [];
  for (const f of files) {
    const src = strip(readFileSync(f, 'utf8'));
    // ★`new Promise(` 부터 **괄호 균형이 맞는 지점**까지를 블록으로 자른다.
    //   종전엔 비탐욕 정규식으로 잘라서 본문이 중간에서 끊겼고, 그래서 마지막 인자(onDismiss)를 못 봤다.
    const re = /new Promise(?:<[^>]*>)?\(\s*\((\w+)\)\s*=>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) {
      const resolver = m[1];
      const open = src.indexOf('(', m.index + 'new Promise'.length);
      let depth = 0, i = open;
      for (; i < src.length && i - open < 6000; i++) {
        if (src[i] === '(') depth++;
        else if (src[i] === ')') { depth--; if (!depth) break; }
      }
      const blk = src.slice(open, i + 1);
      if (!/Alert\.alert/.test(blk)) continue;
      const buttons = [...blk.matchAll(/\{\s*text:[\s\S]{0,220}?\}/g)].map((b) => b[0]);
      const noResolve = buttons.filter((b) => !new RegExp(`${resolver}\\(`).test(b) && !/goCharge|router\./.test(b));
      const line = src.slice(0, m.index).split('\n').length;
      if (noResolve.length) leak.push(`${rel(f)}:${line} — resolve 없는 버튼 ${noResolve.length}개`);
      // ★★버튼을 **누르지 않고** 닫는 길(안드로이드 뒤로가기 = Modal onRequestClose)도 resolve 해야 한다.
      //   2026-08-01 실제 사고: 결제 게이트가 버튼 onPress 에서만 resolve 해서, 뒤로가기로 닫으면
      //   Promise 가 영원히 안 풀리고 화면 잠금(gatingRef)이 남아 **모든 유료 풀이 버튼이 죽었다**.
      //   판정: 버튼 배열 `]` 뒤에 4번째 인자(onDismiss) 화살표 함수가 붙어 있는가.
      if (!/\]\s*,\s*\(\s*\)\s*=>/.test(blk)) {
        leak.push(`${rel(f)}:${line} — onDismiss 없음(뒤로가기로 닫으면 영원히 대기)`);
      }
    }
  }
  if (!leak.length) ok('Alert Promise 누수 0건');
  else { leak.slice(0, 10).forEach((m) => console.error(`      ${m}`)); bad(`resolve 안 하는 버튼 ${leak.length}건 — 그 버튼을 누르면 영원히 대기한다`); }
}

// ── H4 유틸 단일화 ───────────────────────────────────────────────────────
console.log('\n[H4] withTimeout 정의는 한 곳뿐');
{
  const defs = files.filter((f) => /export\s+async\s+function\s+withTimeout|^async function withTimeout/m.test(strip(readFileSync(f, 'utf8'))));
  if (defs.length === 1) ok(`단일 정의: ${rel(defs[0])}`);
  else if (!defs.length) bad('withTimeout 정의가 없다 — 상한 규칙이 사라졌다');
  else bad(`정의가 ${defs.length}곳: ${defs.map(rel).join(', ')} — 한쪽만 고쳐지는 사고가 난다`);
}

// ── H5 SDK 대기 상한(광고 등) ────────────────────────────────────────────
// ★`.catch()` 는 **거부**만 잡는다 — SDK 가 응답 없이 매달리는 '무응답'은 못 잡는다.
//   광고 SDK 대기 중 잠금이 걸려 있으면 그 화면의 진입이 영구히 죽는다(ContentGrid 실사례).
console.log('\n[H5] 잠금 구간의 SDK 대기(광고)에도 상한이 있다');
{
  const risky: string[] = [];
  for (const f of files) {
    const src = strip(readFileSync(f, 'utf8'));
    for (const { name, body } of bodies(src)) {
      if (!LOCK.test(body)) continue;
      if (/await\s+show(?:Rewarded|Interstitial)Ad\(/.test(body) && !BOUNDED.test(body)) risky.push(`${rel(f)} · ${name}()`);
    }
  }
  if (!risky.length) ok('광고 대기 전부 상한 통과(또는 잠금 밖)');
  else { risky.forEach((m) => console.error(`      ${m}`)); bad(`상한 없는 광고 대기 ${risky.length}건 — SDK 무응답 시 잠금이 안 풀린다`); }
}

console.log(fail ? `\n❌ check:hang 실패 ${fail}건` : '\n✅ check:hang 통과 — 잠금해제·대기상한·약속누수·유틸단일화·SDK상한 OK');
process.exit(fail ? 1 : 0);
