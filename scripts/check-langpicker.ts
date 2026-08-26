// scripts/check-langpicker.ts — 언어 고르기가 **실제로 동작하는가** + 남은 한국어를 **센다**
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-08-27: *"서비스 홈에서 언어설정 가능하게 하자 자동으로 변경가능하게 하고
//                    모든 텍스트가 다 번역되게"*
//
// ■ ★왜 `check:copy` 로는 부족했나 — **초록불이 거짓이었다**
//   `check:copy` 는 **copy 파일끼리만** 본다(ko·en·ja 의 키가 맞는가, 값에 한국어가 남았는가).
//   그래서 화면(.tsx)에 **한국어가 통째로 박혀 있어도 늘 초록불**이었다.
//   실측(2026-08-27): 화면 238개에 **1,858곳**(문자열 리터럴 + 태그 사이 맨 한국어).
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
// ★세는 식은 `scripts/lib/ko-scan.ts` **한 곳**뿐이다 — `npm run dump:ko` 가 같은 식으로 자리를 찍는다.
//   (여기 다시 적으면 «하네스는 1573 인데 목록은 1600» 같은 어긋남이 생긴다.)
import { countHardcodedKo, strip as stripKo } from './lib/ko-scan.ts';

const ROOT = new URL('..', import.meta.url).pathname;   // ★형제 하네스와 같은 방식(ESM)
const read = (p: string) => { try { return readFileSync(`${ROOT}${p}`, 'utf8'); } catch { return null; } };
/** ★주석을 걷는다 — 안 걷으면 «내가 설명해 둔 문장»을 코드로 읽는다(오늘만 네 번 당했다). */
const strip = stripKo;

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
 * 번역 대상에서 **빼는 화면** — ⚠️조용히 빼지 않는다. 아래에서 **수와 이유를 찍는다**.
 *
 * ★기준은 «내가 귀찮아서» 가 아니라 **사용자가 볼 수 없는 화면인가** 다.
 *   빼려면 그 파일이 어디서도 안 열리거나(진입점 없음) 관리자 전용이어야 하고,
 *   그 근거를 여기 **한 줄로 적는다**. 근거를 못 적으면 빼지 않는다.
 */
const EXEMPT: Record<string, string> = {
  'app/src/app/(app)/coststable.tsx':
    '내부 검토용 · **어디서도 연결되지 않는다**(실측: `/coststable` 로 가는 링크 0개 — URL 을 직접 쳐야 들어간다)',
};

// ★baseline — 2026-08-27 실측. **줄이는 건 자유, 늘리는 건 실패.**
//   줄였으면 이 숫자를 내려 잠근다(안 내리면 다시 늘어날 여지를 남긴 것이다).
//
// ⚠️★1573 → 1593 으로 **올라간 적이 있다**(2026-08-27). 화면이 나빠진 게 아니라
//   **세는 식이 옳아진 것**이다: 종전엔 리터럴 뒤의 `:` 만 보고 열쇠로 뺐는데,
//   그러면 삼항 `ok ? '미상' : '확실'` 의 **앞쪽 116곳**이 통째로 빠졌다.
//   앞이 `{`·`,` 일 때만 열쇠로 보게 고치자 그 116곳이 드러났고,
//   동시에 «엔진 값 비교»(`=== '미상'`) 96곳이 정당하게 빠졌다.
//   ⇒ **기준은 그 검사 자신이 잰 값이어야 한다** — 손으로 센 숫자를 넣으면 또 어긋난다.
const BASELINE = 1593;

{
  const all = screens().map((p) => ({ path: p, src: read(p) ?? '' }));
  const files = all.filter((f) => !EXEMPT[f.path]);
  const counts = countHardcodedKo(files);
  // ★뺀 것을 **드러낸다** — 조용히 줄이면 «다 됐다» 로 읽힌다
  const exCounts = countHardcodedKo(all.filter((f) => EXEMPT[f.path]));
  const exTotal = [...exCounts.values()].reduce((a, b) => a + b, 0);
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  say(total <= BASELINE, 'L5 화면에 박힌 한국어가 안 늘었다',
    `${total}곳 / 기준 ${BASELINE} · 파일 ${counts.size}개`);
  if (total > BASELINE) console.log(`     ⇒ ${total - BASELINE}곳 늘었습니다. 새 문구는 copy/ko.ts 에 키로 넣으세요.`);
  if (total < BASELINE) console.log(`     ⇒ ${BASELINE - total}곳 줄었습니다. **BASELINE 을 ${total} 로 내려 잠그세요.**`);
  console.log(`     남은 큰 곳: ${top.map(([p, n]) => `${p.split('/').pop()}(${n})`).join(' · ')}`);
  for (const [p, why] of Object.entries(EXEMPT)) {
    console.log(`     ⏭  뺀 화면 ${p.split('/').pop()}(${exCounts.get(p) ?? 0}곳) — ${why}`);
  }
  if (exTotal) console.log(`     ⏭  뺀 것 합계 ${exTotal}곳(위 ${total} 에 안 들어 있다)`);
}

// ── 자기검사(음성 테스트) ───────────────────────────────────────────────────
{
  const c = countHardcodedKo([
    { path: 'a.tsx', src: `const x = '안녕';` },                        // ← 세야 한다
    { path: 'b.tsx', src: `t('k', '안녕')` },                            // ← 폴백이라 안 센다
    { path: 'c.tsx', src: `// 주석의 '안녕'\nconst y = 'hi';` },          // ← 주석이라 안 센다
    { path: 'd.tsx', src: `const z = 'hello';` },                        // ← 한국어 아님
    { path: 'e.tsx', src: `console.warn('대표 전환 실패', e);` },           // ← 로그라 안 센다
    { path: 'f.tsx', src: `<Text>다섯 기운이 이어</Text>` },                 // ← ★태그 사이 맨 한국어도 센다
    { path: 'g.tsx', src: `<Text>{t('k')}</Text>` },                      // ← 키로 뽑으면 안 센다
    { path: 'h.tsx', src: `const b = saju.pillars['일'].branch;` },        // ← ★자료구조 열쇠라 안 센다
    { path: 'i.tsx', src: `const label = '일';` },                         // ← 같은 글자라도 **값**이면 센다
    { path: 'j.tsx', src: `const m = { '천간 합': t('k') };` },             // ← ★열쇠라 안 센다
    { path: 'k.tsx', src: `const m = { a: '천간 합' };` },                  // ← 값이면 센다
    { path: 'l.tsx', src: `t(on ? 'a.b' : 'a.c', '즐겨찾기')` },            // ← ★삼항 키의 폴백도 안 센다
    { path: 'm.tsx', src: `foo(bar ? 1 : 2, '즐겨찾기')` },                 // ← t() 가 아니면 센다
    { path: 'n.tsx', src: `termLabel('용신', lang)` },                      // ← ★용어 열쇠라 안 센다
    { path: 'o.tsx', src: `label('용신', lang)` },                          // ← 다른 함수면 센다
    { path: 'p.tsx', src: `if (input.timeAccuracy === '미상') return null;` },  // ← ★엔진 값 비교라 안 센다
    { path: 'q.tsx', src: `const s = ok ? '미상' : '확실';` },                  // ← 삼항 «결과» 는 화면이라 센다(둘 다)
    { path: 'r.tsx', src: `const m = { a: 1, '천간 합': t('k') };` },            // ← 두 번째 속성의 열쇠도 안 센다
    { path: 's.tsx', src: 'const v = `(${t(\'ms.lunar\', \'음력\')})`;' },        // ← ★백틱 안 `${…}` 는 코드라 안 센다
    { path: 'u.tsx', src: 'const v = `${n}세 대운`;' },                          // ← 백틱의 **정적 부분**은 센다
    { path: 'v.tsx', src: `t('k', { n, defaultValue: '{{n}}운 필요' })` },       // ← ★자리표시자형 폴백도 안 센다
    { path: 'w.tsx', src: `f({ other: '{{n}}운 필요' })` },                      // ← defaultValue 가 아니면 센다
  ]);
  const good = c.get('a.tsx') === 1 && !c.has('b.tsx') && !c.has('c.tsx') && !c.has('d.tsx') && !c.has('e.tsx')
    && c.get('f.tsx') === 1 && !c.has('g.tsx')
    && !c.has('h.tsx') && c.get('i.tsx') === 1
    && !c.has('j.tsx') && c.get('k.tsx') === 1
    && !c.has('l.tsx') && c.get('m.tsx') === 1
    && !c.has('n.tsx') && c.get('o.tsx') === 1
    && !c.has('p.tsx') && c.get('q.tsx') === 2 && !c.has('r.tsx')
    && !c.has('s.tsx') && c.get('u.tsx') === 1
    && !c.has('v.tsx') && c.get('w.tsx') === 1;
  say(good, '자기검사 — 폴백·주석·로그는 빼고, **태그 사이 글자까지** 센다',
    good ? '대조군 22개 통과' : `실제: ${JSON.stringify([...c])}`);
}

console.log(fail === 0 ? '\n✅ 언어 고르기가 이어져 있고, 남은 한국어가 안 늘었습니다\n'
  : `\n❌ ${fail}건 — 언어를 골라도 «다 안 바뀌는» 상태입니다\n`);
process.exit(fail === 0 ? 0 : 1);
