// scripts/check-mycard.ts — 「나의 카드」가 **입구**로 작동하는가
// ═══════════════════════════════════════════════════════════════════════════
// 「자기·타인 탐색 기획」(2026-08-25) §2 · Boss 2026-08-27 *"유형은 입구, 계산은 깊이 기획서 대로"*
//
// ■ 재는 것 — 기획서가 «빠졌다» 고 짚은 것들이 실제로 메워졌는가
//   M1  ★**새로 계산하지 않는다** — 각 화면이 쓰는 함수를 그대로 쓴다
//       (여기서 따로 판단하면 «카드의 나» 와 «상세의 나» 가 갈린다 = 유형이 아니라 오류)
//   M2  ★모든 칸이 **눌린다**(입구) — `route` 없는 칸이 있으면 그건 «분류함» 이지 입구가 아니다
//   M3  ★**저장한다**(기획서 §1-② — 기억되지 않으면 도구가 안 된다)
//   M4  ⚠️저장에 **원시 생년월일시가 안 들어간다**(공유 카드로 새어 나간다)
//   M5  ⚠️애착유형을 **안 넣는다**(설문이 필요 · 판정 대기 민감 분류 — 기획서 §5)
//   M6  ★「유형은 입구일 뿐」 이라는 **말이 화면에 있다**
//       — App Store 설명의 «분류함이 없습니다» 와 충돌하지 않으려면 이 말이 필요하다(기획서 §3)
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname;
const read = (p: string) => { try { return readFileSync(`${ROOT}${p}`, 'utf8'); } catch { return null; } };
/** ★주석을 걷는다 — 안 걷으면 «설명해 둔 문장» 을 코드로 읽는다. */
const strip = (s: string) => s.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

let fail = 0;
const say = (c: boolean, m: string, d = '') => {
  if (!c) fail++;
  console.log(`  ${c ? '✅' : '❌'} ${m.padEnd(44)} ${d}`);
};

console.log('\n🎴 check:mycard — 유형은 입구, 계산은 깊이\n');

const lib = strip(read('app/src/lib/content/myCard.ts') ?? '');
const scr = strip(read('app/src/app/(app)/mycard.tsx') ?? '');
const raw = read('app/src/app/(app)/mycard.tsx') ?? '';

// ── M1 각 화면의 함수를 **그대로** 쓴다 ────────────────────────────────────
{
  const need = ['personaOf', 'sajuMbti', 'egenTeto', 'bokType', 'DAY_PILLAR'];
  const miss = need.filter((f) => !new RegExp(`\\b${f}\\b`).test(lib));
  say(miss.length === 0, 'M1 각 축을 **그 화면의 함수**로 낸다',
    miss.length ? `안 쓰는 것: ${miss.join(', ')} — 새로 계산하면 카드와 상세가 갈린다`
      : `${need.length}개 축 전부`);
}

// ── M2 모든 칸이 눌린다 ────────────────────────────────────────────────────
{
  // `out.push({ ... route: '/xxx' })` — push 하는 객체마다 route 가 있어야 한다
  const pushes = [...lib.matchAll(/out\.push\(\{([\s\S]*?)\}\)/g)].map((m) => m[1]);
  const noRoute = pushes.filter((b) => !/route:\s*'/.test(b)).length;
  const tappable = /onPress=\{\(\) => router\.push\(s\.route/.test(scr);
  say(pushes.length > 0 && noRoute === 0 && tappable, 'M2 모든 칸이 **깊이로 들어간다**',
    pushes.length === 0 ? '칸을 만드는 곳을 못 찾았다 — 하네스가 헛돈다'
      : noRoute ? `${noRoute}칸에 route 가 없다 — 그건 «분류함» 이지 입구가 아니다`
        : tappable ? `${pushes.length}칸 전부` : '화면이 route 를 안 쓴다(눌러도 안 간다)');
}

// ── M3 저장한다 ────────────────────────────────────────────────────────────
{
  const saves = /from\('user_types'\)[\s\S]{0,80}?\.upsert\(/.test(lib);
  const called = /saveMyCard\(/.test(scr);
  say(saves && called, 'M3 유형을 **저장한다**',
    saves && called ? 'user_types 에 upsert' : `표에 씀:${saves} 화면이 부름:${called} — 기억 안 되면 도구가 안 된다`);
}

// ── M4 ⚠️원시 생년월일시를 저장하지 않는다 ─────────────────────────────────
{
  // upsert 로 넘기는 rows 를 만드는 구간만 본다
  const rows = /const rows = slots\.map\(\(s\) => \(\{([\s\S]*?)\}\)\)/.exec(lib)?.[1] ?? '';
  const leaky = /\b(ymd|birth|year|month|day|hour|minute|input|calendar)\b/i.test(rows);
  say(!!rows && !leaky, 'M4 저장에 **생년월일시가 없다**',
    !rows ? '저장 행을 못 찾았다 — 하네스가 헛돈다'
      : leaky ? `★원시 입력이 섞였다: ${rows.replace(/\s+/g, ' ').slice(0, 90)}` : '유형 결과만 담는다');
}

// ── M5 ⚠️애착유형을 안 넣는다 ──────────────────────────────────────────────
{
  const has = /'attach'|attachSurvey|spouseCapacityAxis/.test(lib);
  say(!has, 'M5 애착유형을 **카드에 안 올린다**',
    has ? '★설문이 필요한 축이라 빈 칸이 생기고, 판정 대기 민감 분류다(기획서 §5)'
      : '설문 없이는 안 나오는 축이라 제외');
}

// ── M6 「유형은 입구」 라는 말이 화면에 있는가 ───────────────────────────────
{
  // ⚠️주석이 아니라 **화면 문구**여야 한다 ⇒ strip 한 소스에서 t() 폴백을 본다
  const said = /입구/.test(scr) || /mycard\.(lead|foot)/.test(scr);
  const inCopy = /입구일 뿐/.test(read('app/src/copy/ko.ts') ?? '');
  say(said && inCopy, 'M6 「유형은 입구일 뿐」 을 **화면이 말한다**',
    said && inCopy ? 'lead·foot 문구에 있다'
      : `화면:${said} 문구:${inCopy} — 이 말이 없으면 App Store 설명의 «분류함이 없습니다» 와 충돌한다`);
}

// ── 자기검사 ───────────────────────────────────────────────────────────────
{
  const fakeNoRoute = `out.push({ kind: 'x', label: 'a', value: 'b', sub: 'c' })`;
  const p = [...fakeNoRoute.matchAll(/out\.push\(\{([\s\S]*?)\}\)/g)].map((m) => m[1]);
  const caught = p.length === 1 && !/route:\s*'/.test(p[0]);
  const fakeLeak = `const rows = slots.map((s) => ({ user_id: uid, birth: input.ymd }))`;
  const r = /const rows = slots\.map\(\(s\) => \(\{([\s\S]*?)\}\)\)/.exec(fakeLeak)?.[1] ?? '';
  const caught2 = /\b(ymd|birth)\b/i.test(r);
  say(caught && caught2, '자기검사 — route 누락·생일 유출을 잡아낸다',
    caught && caught2 ? '대조군 2개 통과' : `M2:${caught} M4:${caught2}`);
}

console.log(fail === 0 ? '\n✅ 유형이 입구로 작동하고, 저장되며, 생일이 안 샙니다\n'
  : `\n❌ ${fail}건\n`);
process.exit(fail === 0 ? 0 : 1);
