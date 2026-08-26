// scripts/check-langpicker.ts — 언어 고르기가 **실제로 동작하는가** + 남은 한국어를 **센다**
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-08-27: *"서비스 홈에서 언어설정 가능하게 하자 자동으로 변경가능하게 하고
//                    모든 텍스트가 다 번역되게"*
//
// ■ ★왜 `check:copy` 로는 부족했나 — **초록불이 거짓이었다**
//   `check:copy` 는 **copy 파일끼리만** 본다(ko·en·ja 의 키가 맞는가, 값에 한국어가 남았는가).
//   그래서 화면(.tsx)에 **한국어가 통째로 박혀 있어도 늘 초록불**이었다.
//   실측(2026-08-27): 화면 238개에 한국어 리터럴 **1,463곳** · 태그 사이 맨 한국어 **412곳**.
//   ⇒ «키가 맞는가» 와 «화면에 한국어가 없는가» 는 **다른 질문**이다([[i18n-untranslated-shipped]]
//     의 *"키가 맞는가 ≠ 말이 그 언어인가"* 와 같은 계열).
//
// ■ 이 하네스가 재는 것
//   L1  「자동」이 **값이 아니라 «값 없음»** 인가 (setAppLang(null) 이 저장을 지우는가)
//   L2  화면과 풀이를 **한 번에** 바꾸는 진입점이 있는가 (`setLang`)
//   L3  ⚠️칩을 눌렀을 때 **뜰 곳이 있는가** (`LangPickerHost` 가 루트에 렌더되는가)
//       — 이게 없으면 눌러도 아무 일이 없고 **오류도 안 난다**(＋ 버튼이 웹에서 죽어 있던 그 유형)
//   L4  홈에 진입점이 있는가
//   L5  ★**남은 한국어를 세고, 늘면 막는다**(baseline). 줄이는 건 자유, 늘리는 건 실패.
//
// ■ ★왜 «0» 이 아니라 «baseline» 인가
//   1,463곳을 한 번에 못 없앤다. 0 을 요구하면 이 검사는 **영구 빨간불**이 되어 아무도 안 본다.
//   ⇒ 지금 값을 못 박고 **늘어나는 것만** 막는다. 줄면 baseline 을 내려 잠근다.
//   ⚠️명리 용어(십신·지지·방위)는 **번역 대상이 아닐 수도** 있다 — 그건 Boss 판단 영역이라
//     여기서 단정하지 않고 **수만 보고**한다.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, readdirSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname;   // ★형제 하네스와 같은 방식(ESM)
const read = (p: string) => { try { return readFileSync(`${ROOT}${p}`, 'utf8'); } catch { return null; } };
/** ★주석을 걷는다 — 안 걷으면 «내가 설명해 둔 문장»을 코드로 읽는다(오늘만 네 번 당했다). */
const strip = (s: string) => s.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

let fail = 0;
const ok = (m: string, d = '') => console.log(`  ✅ ${m.padEnd(44)} ${d}`);
const bad = (m: string, d = '') => { fail++; console.log(`  ❌ ${m.padEnd(44)} ${d}`); };
const say = (c: boolean, m: string, d = '') => (c ? ok(m, d) : bad(m, d));

console.log('\n🌐 check:langpicker — 언어 고르기 · 남은 한국어\n');

// ── L1 「자동」 = 저장을 지운다 ─────────────────────────────────────────────
{
  const src = strip(read('app/src/lib/i18n.ts') ?? '');
  // 이름이 아니라 **식**으로 본다: setAppLang 이 null 을 받고, null 일 때 지우는 분기가 있는가
  const m = /export async function setAppLang\(([\s\S]*?)\n\}/.exec(src);
  const body = m?.[1] ?? '';
  const takesNull = /lng:\s*AppLang\s*\|\s*null/.test(body);
  const clears = /removeItem|deleteItemAsync/.test(body);
  const usesDevice = /deviceAppLang\(\)/.test(body);
  say(takesNull && clears && usesDevice, 'L1 「자동」이 «값 없음»이다',
    takesNull && clears && usesDevice
      ? 'null → 저장 삭제 + 기기 언어로 되돌림'
      : `null 받음:${takesNull} 저장삭제:${clears} 기기언어:${usesDevice}`);

  // ── L2 하나로 바꾸는 진입점 ─────────────────────────────────────────────
  const sl = /export async function setLang\(([\s\S]*?)\n\}/.exec(src)?.[1] ?? '';
  const both = /setAppLang\(/.test(sl) && /setReadingLang\(/.test(sl);
  say(both, 'L2 화면·풀이를 **한 번에** 바꾼다',
    both ? 'setLang() 이 둘 다 부른다' : '한쪽만 바꾸면 «영어로 골랐는데 화면은 한국어»가 남는다');
}

// ── L3 ⚠️눌렀을 때 뜰 곳이 있는가 ──────────────────────────────────────────
{
  const layout = strip(read('app/src/app/_layout.tsx') ?? '');
  const rendered = /<LangPickerHost\s*\/>/.test(layout) && /LangPickerHost/.test(layout.split('\n').filter((l) => /^import/.test(l)).join('\n'));
  say(rendered, 'L3 목록 호스트가 앱 루트에 있다',
    rendered ? '_layout 에 <LangPickerHost />'
      : '★호스트가 없으면 칩을 눌러도 **아무 일도 안 난다 — 오류도 없다**(＋ 버튼이 웹에서 죽어 있던 그 유형)');
}

// ── L4 홈 진입점 ───────────────────────────────────────────────────────────
{
  const home = strip(read('app/src/app/(app)/index.tsx') ?? '');
  const has = /<LangChip[\s/>]/.test(home);
  say(has, 'L4 홈에 언어 진입점이 있다',
    has ? '헤더에 <LangChip />' : 'Boss 지시: *"서비스 홈에서 언어설정 가능하게"*');
}

// ── L6 ★DB 문구(상담가 이름·소개)도 그 언어로 나오는가 ─────────────────────
//   2026-08-27 실측: 영어로 바꿔도 **상담가 이름·소개가 한국어 그대로**였다.
//   화면 문구(`copy/*.ts`)를 아무리 번역해도 안 바뀐다 — **DB 값**이기 때문이다.
//   ⇒ 셋이 다 있어야 한다: ①번역을 태우는 배선 ②캐시가 번역을 굽지 않음 ③언어 바뀌면 다시 그림
{
  const c = strip(read('app/src/lib/talk/consultants.ts') ?? '');
  const wired = /name:\s*tr\(/.test(c) && /tagline:\s*r\.tagline\s*\?\s*tr\(/.test(c);
  say(wired, 'L6 상담가 이름·소개가 번역을 탄다',
    wired ? 'copy_overrides 의 consultant.<id>.* 를 쓴다' : 'DB 값을 그대로 내보내면 **영어 화면에 한국어 이름**이 남는다');

  // ★캐시가 **매핑된 결과**를 담으면 언어를 바꿔도 옛 언어가 남는다 — 원문을 담아야 한다
  const lazy = /_raw\s*\.map\(fromRow\)/.test(c) && !/_raw\s*=\s*r\.data\.map\(/.test(c);
  say(lazy, 'L6b 캐시가 번역을 **굽지 않는다**',
    lazy ? '원문을 담고 읽을 때 매핑한다' : '캐시에 번역이 구워지면 언어를 바꿔도 그대로 남는다');

  const layout = strip(read('app/src/app/_layout.tsx') ?? '');
  const remount = /<Stack\s+key=\{[A-Za-z_$][\w$]*[Ll]ang\}/.test(layout);
  say(remount, 'L6c 언어가 바뀌면 화면을 **다시 읽는다**',
    remount ? '<Stack key={언어}> 로 리마운트' : 'state 에 담아 둔 서버 문구가 옛 언어로 남는다');
}

// ── L5 ★남은 한국어 — 세고, 늘면 막는다 ────────────────────────────────────
/** 화면 파일 전부. */
function screens(dir = 'app/src'): string[] {
  const out: string[] = [];
  const rec = (d: string) => {
    let ents; try { ents = readdirSync(`${ROOT}${d}`, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      const p = `${d}/${e.name}`;
      if (e.isDirectory()) rec(p); else if (e.name.endsWith('.tsx')) out.push(p);
    }
  };
  rec(dir); return out;
}

/**
 * 화면 파일에 **박혀 있는 한국어**를 센다.
 *
 * ★`t('key', '한국어')` 의 두 번째 인자는 **세지 않는다** — 그건 폴백이고 번역이 이미 있다.
 * @returns 파일별 개수
 */
export function countHardcodedKo(files: { path: string; src: string }[]): Map<string, number> {
  const LIT = /(['"`])((?:\\.|(?!\1)[^\\])*)\1/g;
  const FALLBACK = /t\(\s*'[\w.]+'\s*,\s*$/;
  // ★로그는 **화면이 아니다** — `console.warn('… 실패', e)` 를 번역하라는 건 말이 안 된다.
  //   («번역 대상» 의 정의를 «화면에 닿는 글자» 로 못 박는다. 이 줄이 없으면 진단 로그를 늘릴 때마다
  //    이 검사가 빨간불이 되어, 결국 «로그를 안 남기는» 잘못된 방향으로 사람을 민다.)
  const LOG = /console\.(log|warn|error|info|debug)\([^)]*$/;
  const KO = /[가-힣]/;
  const out = new Map<string, number>();
  for (const f of files) {
    const s = strip(f.src);
    let n = 0;
    for (const m of s.matchAll(LIT)) {
      if (!KO.test(m[2])) continue;
      const before = s.slice(Math.max(0, m.index! - 120), m.index!);
      if (FALLBACK.test(before)) continue;
      if (LOG.test(before)) continue;
      n++;
    }
    if (n) out.set(f.path, n);
  }
  return out;
}

// ★baseline — 2026-08-27 실측. **줄이는 건 자유, 늘리는 건 실패.**
//   줄였으면 이 숫자를 내려 잠근다(안 내리면 다시 늘어날 여지를 남긴 것이다).
const BASELINE = 1459;

{
  const files = screens().map((p) => ({ path: p, src: read(p) ?? '' }));
  const counts = countHardcodedKo(files);
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  say(total <= BASELINE, 'L5 화면에 박힌 한국어가 안 늘었다',
    `${total}곳 / 기준 ${BASELINE} · 파일 ${counts.size}개`);
  if (total > BASELINE) console.log(`     ⇒ ${total - BASELINE}곳 늘었습니다. 새 문구는 copy/ko.ts 에 키로 넣으세요.`);
  if (total < BASELINE) console.log(`     ⇒ ${BASELINE - total}곳 줄었습니다. **BASELINE 을 ${total} 로 내려 잠그세요.**`);
  console.log(`     남은 큰 곳: ${top.map(([p, n]) => `${p.split('/').pop()}(${n})`).join(' · ')}`);
}

// ── 자기검사(음성 테스트) ───────────────────────────────────────────────────
{
  const c = countHardcodedKo([
    { path: 'a.tsx', src: `const x = '안녕';` },                        // ← 세야 한다
    { path: 'b.tsx', src: `t('k', '안녕')` },                            // ← 폴백이라 안 센다
    { path: 'c.tsx', src: `// 주석의 '안녕'\nconst y = 'hi';` },          // ← 주석이라 안 센다
    { path: 'd.tsx', src: `const z = 'hello';` },                        // ← 한국어 아님
    { path: 'e.tsx', src: `console.warn('대표 전환 실패', e);` },           // ← 로그라 안 센다
  ]);
  const good = c.get('a.tsx') === 1 && !c.has('b.tsx') && !c.has('c.tsx') && !c.has('d.tsx') && !c.has('e.tsx');
  say(good, '자기검사 — 폴백·주석·로그는 빼고 화면 글자만 센다',
    good ? '대조군 5개 통과' : `실제: ${JSON.stringify([...c])}`);
}

console.log(fail === 0 ? '\n✅ 언어 고르기가 이어져 있고, 남은 한국어가 안 늘었습니다\n'
  : `\n❌ ${fail}건 — 언어를 골라도 «다 안 바뀌는» 상태입니다\n`);
process.exit(fail === 0 ? 0 : 1);
