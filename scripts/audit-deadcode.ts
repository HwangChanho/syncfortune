#!/usr/bin/env tsx
/**
 * audit:deadcode — 죽은 코드 전수조사 (daniel 2026-08-02 "죽은코드 전수조사 해봐")
 * ═══════════════════════════════════════════════════════════════════════════
 * 왜: 폐지된 프리미엄(`PREMIUM_ENABLED=false`)이 **광고 제거 약속을 조용히 깨뜨렸다**.
 *   죽은 코드는 안 돌아서 위험한 게 아니라, **살아 있는 척하면서 판단을 오염시켜서** 위험하다.
 *   "이 분기는 있으니 처리되겠지" 하고 넘어가면 그게 곧 버그다.
 *
 * 무엇을 보는가(5종):
 *   D1 상수로 굳은 게이트  — const X = false 를 조건으로 쓰는 곳(영원히 안 타는 분기)
 *   D2 호출처 0 export     — export 했는데 아무도 import 안 하는 심볼
 *   D3 고아 파일           — 어디서도 import 되지 않는 모듈(라우트 파일 제외)
 *   D4 폐지 개념 잔재      — 선언한 '폐지 목록' 이 아직 남아 있는 곳
 *   D5 도달 불가           — return/throw 뒤의 코드
 *
 * ⚠️**이 도구는 후보를 낸다. 판정은 사람이 한다.**
 *   동적 참조(문자열 라우트·require·리플렉션)는 정적으로 안 보인다 —
 *   지우기 전에 반드시 실제 참조를 확인할 것. 잘못 지우면 런타임에만 터진다.
 *
 * 사용: npm run audit:deadcode           (요약)
 *       npm run audit:deadcode -- --full (전체 목록)
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, basename } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const FULL = process.argv.includes('--full');
const SCAN = ['app/src', 'engine', 'interpretation', 'supabase/functions'].map((d) => join(ROOT, d));

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try { entries = readdirSync(dir); } catch { return out; }
  for (const n of entries) {
    if (n === 'node_modules' || n.startsWith('.')) continue;
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(p) && !/\.d\.ts$/.test(p)) out.push(p);
  }
  return out;
}
/**
 * 주석 제거 — ★**줄 수를 반드시 보존**한다.
 * 처음엔 주석을 공백 하나로 바꿨는데, 그러면 길이가 줄어 **행 번호가 전부 어긋났다**
 * (career.tsx:134 가 무관한 코드를 가리켰다). 블록 주석은 그 안의 줄바꿈을 그대로 남긴다.
 */
const strip = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
   .replace(/(^|[^:])\/\/.*$/gm, (_m, p1) => p1);
const rel = (p: string) => relative(ROOT, p);

const FILES = SCAN.flatMap((d) => walk(d));
const SRC = new Map<string, string>();      // 원본
const CODE = new Map<string, string>();     // 주석 제거본
for (const f of FILES) { const s = readFileSync(f, 'utf8'); SRC.set(f, s); CODE.set(f, strip(s)); }
const ALL_CODE = [...CODE.values()].join('\n');

// ★행 번호는 **주석 제거본 기준**으로 센다(줄 수를 보존하므로 원본과 1:1로 맞는다).
const line = (f: string, idx: number) => CODE.get(f)!.slice(0, idx).split('\n').length;

// ── D1 상수로 굳은 게이트 ──────────────────────────────────────────────────
type Finding = { file: string; line: number; what: string; note?: string };
const d1: Finding[] = [];
for (const f of FILES) {
  const code = CODE.get(f)!;
  for (const m of code.matchAll(/(?:^|\n)\s*(?:export\s+)?const\s+([A-Za-z_][\w]*)\s*(?::\s*boolean\s*)?=\s*(true|false)\s*;/g)) {
    const [, name, val] = m;
    // ★같은 파일 안에서만 센다(전역으로 세면 'admin' 같은 흔한 이름이 59곳으로 부풀어 무의미해진다).
    //   그리고 **조건절에 쓰이는지**를 본다 — 단순 대입/전달은 죽은 분기를 만들지 않는다.
    const own = code.split('\n');
    const condUses = own.filter((l, i) =>
      i + 1 !== line(f, m.index!) &&
      (new RegExp(`if\\s*\\([^)]*(?<![\\w.])${name}(?![\\w])`).test(l) ||
       new RegExp(`(?<![\\w.])${name}(?![\\w])\\s*(&&|\\|\\||\\?)`).test(l) ||
       new RegExp(`(&&|\\|\\|)\\s*!?(?<![\\w.])${name}(?![\\w])`).test(l)),
    ).length;
    if (condUses > 0) d1.push({ file: f, line: line(f, m.index!), what: `${name} = ${val}`, note: `같은 파일 조건절 ${condUses}곳 — ${val === 'false' ? '항상 거짓' : '항상 참'}` });
  }
}

// ── D2 호출처 0 export ─────────────────────────────────────────────────────
const d2: Finding[] = [];
const EXPORT_RE = /export\s+(?:async\s+)?(?:function|const|class)\s+([A-Za-z_][\w]*)/g;
for (const f of FILES) {
  // 라우트 파일의 default export 는 파일 경로가 곧 참조라 제외
  const code = CODE.get(f)!;
  for (const m of code.matchAll(EXPORT_RE)) {
    const name = m[1];
    // 자기 파일 밖에서 이 이름이 쓰이는가
    let used = 0;
    for (const [g, gc] of CODE) {
      if (g === f) continue;
      if (new RegExp(`(?<![\\w.])${name}(?![\\w])`).test(gc)) { used++; break; }
    }
    if (!used) d2.push({ file: f, line: line(f, m.index!), what: name });
  }
}

// ── D3 고아 파일 ───────────────────────────────────────────────────────────
// ★package.json 스크립트가 직접 실행하는 파일은 **살아 있다**(engine/run-*.ts 다수가 여기 해당).
//   이걸 안 보면 "아무도 import 안 함 = 죽음"으로 오판한다 — 진입점은 import 되지 않는다.
const PKG = readFileSync(join(ROOT, 'package.json'), 'utf8');
const d3: Finding[] = [];
for (const f of FILES) {
  const base = basename(f).replace(/\.tsx?$/, '');
  if (/\/app\/\(app\)\//.test(f) || /\/app\/[^/]+\.tsx$/.test(f)) continue; // expo-router: 경로가 참조
  if (/^(index|_layout)$/.test(base)) continue;
  if (/scripts\//.test(f)) continue;
  if (PKG.includes(rel(f)) || PKG.includes(`${base}.ts`)) continue;         // npm 스크립트 진입점
  let referenced = false;
  for (const [g, gc] of CODE) {
    if (g === f) continue;
    if (new RegExp(`from\\s+['"][^'"]*${base}['"]|require\\(['"][^'"]*${base}['"]`).test(gc)) { referenced = true; break; }
  }
  if (!referenced) d3.push({ file: f, line: 1, what: base });
}

// ── D6 미사용 import ───────────────────────────────────────────────────────
// 가장 순수한 죽은 코드다. 지워도 동작이 안 바뀌고, 남아 있으면 "이 기능이 여기 연결돼 있다"는
// 착시를 준다(예: 관리자 전체오픈을 폐지한 화면들이 isAdminActing 을 아직 import 하고 있는가).
//
// ⚠️★★2026-08-10 실측 — **D6 조차 절반이 오탐이었다.** 4건 중 2건이 실제로는 쓰이고 있었다:
//   · `app/src/lib/i18n.ts` `initReactI18next` → **`i18n.use(initReactI18next)` 로 사용 중**.
//     지웠으면 앱 전체 다국어가 죽는다(빌드는 통과했을 것이다 — 런타임에만 터진다).
//   · `app/src/lib/tarot.ts` `A` → **`A('tarot/m00.jpg')` 78장에서 사용 중**.
//   (진짜 미사용은 Edge 쪽 `STEM_YINYANG`·`STEM_TO_ELEM` 2건뿐이었고 그것만 제거했다.)
//   ⇒ "가장 순수한 죽은 코드"라는 위 문장을 **근거로 삼지 말 것.** D6 는 다른 항목과 똑같이
//     **한 건씩 실사용을 grep 해 확인한 뒤** 지운다. 원인(위 body 전처리의 과잉 제거로 추정)은 미규명.
const d6: Finding[] = [];
for (const f of FILES) {
  const code = CODE.get(f)!;
  // ★import 문만 정확히 걷어낸다. 처음엔 `import[\s\S]*?from ...` 를 썼는데 **여러 줄을 건너뛰며
  //   그 사이 코드까지 통째로 삼켜** 멀쩡히 쓰이는 심볼을 '미사용'으로 신고했다
  //   (실측: bok.tsx 의 font·Pressable — 실제로는 쓰인다). `from` 이 나오기 **전까지만** 먹는다.
  //   ★그리고 **스프레드(`...`)를 지운다.** `(?<![\w.])` 는 앞의 `.` 을 '속성 접근'으로 보고 거르는데,
  //     `{ ...font.body }` 의 `font` 도 바로 앞이 `.` 이라 걸러져 **쓰이는데 미사용으로 신고**됐다.
  //     테마 객체(font·shadow)가 거의 모든 화면에서 오탐으로 잡히던 정확한 이유다.
  const body = code
    .replace(/^\s*import\b(?:(?!\bfrom\b)[\s\S])*?\bfrom\s*['"][^'"]+['"];?/gm, '')
    .replace(/\.\.\./g, ' ');
  for (const m of code.matchAll(/^\s*import\s+(?:type\s+)?\{([^}]+)\}\s*from\s*['"][^'"]+['"]/gm)) {
    for (const raw of m[1].split(',')) {
      const name = raw.trim().split(/\s+as\s+/).pop()!.trim();
      if (!name || !/^[A-Za-z_]\w*$/.test(name)) continue;
      if (!new RegExp(`(?<![\\w.])${name}(?![\\w])`).test(body)) {
        d6.push({ file: f, line: line(f, m.index!), what: name });
      }
    }
  }
}

// ── D4 폐지 개념 잔재 ──────────────────────────────────────────────────────
// ★새 폐지가 생기면 **여기에 한 줄 추가**한다. 그게 이 목록의 용도다.
const ABOLISHED: { token: string; since: string; why: string }[] = [
  { token: 'isPremium',        since: '2026-07-28', why: '프리미엄 폐지 — PREMIUM_ENABLED=false 라 항상 거짓' },
  { token: 'purchasePremium',  since: '2026-07-30', why: '프리미엄 결제 경로 제거' },
  { token: 'premium_lifetime', since: '2026-07-28', why: '상품 자체가 스토어에 없음' },
  { token: 'VERIFY_ADS',       since: '2026-07-07', why: '출시 시 false 고정 — 전원 테스트광고 강제용 검증 스위치' },
];
const d4: Finding[] = [];
for (const a of ABOLISHED) {
  for (const f of FILES) {
    const code = CODE.get(f)!;
    for (const m of code.matchAll(new RegExp(`(?<![\\w.])${a.token}(?![\\w])`, 'g'))) {
      d4.push({ file: f, line: line(f, m.index!), what: a.token, note: `${a.since} 폐지 — ${a.why}` });
    }
  }
}

// ── D5 도달 불가 ───────────────────────────────────────────────────────────
const d5: Finding[] = [];
for (const f of FILES) {
  const lines = CODE.get(f)!.split('\n');
  for (let i = 0; i < lines.length - 1; i++) {
    const cur = lines[i].trim();
    if (!/^(return\b|throw\b|process\.exit\()/.test(cur)) continue;
    // ★첫 판은 여기서 **511건을 냈고 거의 전부 오탐**이었다 — `return (` 다음 줄의 JSX 를
    //   도달 불가로 읽었다. 여러 줄에 걸친 return 은 '문장이 안 끝난' 것이다.
    //   ⇒ 그 줄에서 문장이 **완결**돼야만(괄호 균형 + `;` 로 끝) 다음 줄을 따진다.
    if (!cur.endsWith(';')) continue;
    const open = (cur.match(/[([{]/g) ?? []).length;
    const close = (cur.match(/[)\]}]/g) ?? []).length;
    if (open !== close) continue;
    const next = lines[i + 1].trim();
    if (!next || /^[})\]]/.test(next) || /^(case\b|default\b)/.test(next)) continue;
    // 블록이 끝났는지(들여쓰기가 얕아졌는지)를 본다 — 얕아졌으면 다른 블록이라 도달 가능.
    const indCur = lines[i].search(/\S/);
    const indNext = lines[i + 1].search(/\S/);
    if (indNext < indCur) continue;
    d5.push({ file: f, line: i + 2, what: next.slice(0, 60) });
  }
}

// ── 출력 ───────────────────────────────────────────────────────────────────
function show(title: string, why: string, rows: Finding[], cap = 12) {
  console.log(`\n■ ${title} — ${rows.length}건`);
  console.log(`   ${why}`);
  const list = FULL ? rows : rows.slice(0, cap);
  for (const r of list) console.log(`   · ${rel(r.file)}:${r.line}  ${r.what}${r.note ? `   — ${r.note}` : ''}`);
  if (!FULL && rows.length > cap) console.log(`   … 외 ${rows.length - cap}건 (--full 로 전체)`);
}

console.log(`\n🧹 죽은 코드 전수조사 — 대상 ${FILES.length}개 파일`);
show('D1 상수로 굳은 게이트', '값이 상수라 한쪽 분기가 영원히 안 탄다. 폐지 사고의 근원.', d1);
show('D4 폐지 개념 잔재', '폐지했는데 남아 있는 참조. 살아 있는 척하며 판단을 오염시킨다.', d4, 8);
show('D2 호출처 0 export', '밖에서 아무도 안 쓰는 export. ⚠️동적 참조는 안 보이니 지우기 전 확인.', d2);
show('D3 고아 파일', '어디서도 import 되지 않는 모듈. ⚠️라우트/동적 로드는 제외했지만 오탐 가능.', d3);
show('D5 도달 불가 코드', 'return/throw 뒤에 남은 문장.', d5);
show('D6 미사용 import', '가장 순수한 죽은 코드. 남아 있으면 "이 기능이 여기 연결돼 있다"는 착시를 준다.', d6, 20);

console.log(`\n요약: D1 ${d1.length} · D4 ${d4.length} · D2 ${d2.length} · D3 ${d3.length} · D5 ${d5.length} · D6 ${d6.length}`);
console.log('⚠️ 후보 목록이다. **판정은 사람이 한다** — 동적 참조는 정적으로 안 보인다.\n');
