/**
 * scripts/check-myeongtabs.ts — 만세력 **탭이 선언만 되고 안 그려지는 것**을 잡는다
 * ═════════════════════════════════════════════════════════════════════════
 * Boss 2026-08-25 *"만세력에서 일주론 탭도 활성화 시키자"* 를 붙이며 만들었다.
 *
 * ■ ★왜 눈으로 못 잡나
 *   탭을 목록(`MYEONG_TABS`)에만 넣고 **렌더 분기(`activeTab === 'x'`)를 빠뜨리면**
 *   탭은 멀쩡히 보이는데 **누르면 빈 화면**이 된다. 화면이 안 깨지므로 조용히 지나간다.
 *   (같은 종류의 사고가 이미 있었다 — `/chats` 를 만들고 `_layout` 등록을 잊어 흰 띠가 떴다.)
 *   ⚠️게다가 만세력은 **명식이 있어야** 열려서, 명식 없는 환경에서는 눈으로 확인조차 못 한다.
 *
 * ■ 무엇을 보나
 *   ①타입에 선언된 탭 id · ②목록(`MYEONG_TABS`)의 id · ③렌더 분기 — **셋이 맞는가**
 *   ④일주론 카드가 `/dayPillar` 와 **같은 자료**를 읽는가(문구를 베끼면 두 갈래가 된다)
 *
 * 실행: npm run check:myeongtabs   (preflight 에 포함)
 */
import { readFileSync } from 'node:fs';

const SCREEN = 'app/src/screens/MyeongsikScreen.tsx';
const CARD = 'app/src/components/IljuTabCard.tsx';

let fail = 0, pass = 0;
const bad = (m: string) => { fail++; console.log(`  ❌ ${m}`); };
const ok = (m: string) => { pass++; console.log(`  ✅ ${m}`); };
// ⚠️★**줄 주석을 먼저** 걷는다(2026-08-27에 실제로 당했다).
//   블록 주석을 먼저 지우면, 줄 주석 안에 적힌 `/*`(예: 경로를 `copy/*.ts` 라고 쓴 것)이
//   **블록 주석 시작으로 읽혀** 그 뒤가 통째로 사라진다 — 실제로 탭 목록이 사라져
//   «그리는데 목록에 없다» 는 **거짓 빨간불**이 났다.
//   ⇒ 줄 주석 → 블록 주석 순서로 걷는다(다른 하네스들이 쓰는 순서와도 같다).
const strip = (s: string) => s
  .split('\n').filter((l) => !/^\s*(\/\/|\*)/.test(l)).join('\n')
  .replace(/\/\*[\s\S]*?\*\//g, '');

console.log('\n🗂  만세력 탭 하네스\n');

const src = strip(readFileSync(SCREEN, 'utf8'));

console.log('=== ① 선언 · 목록 · 렌더가 맞는가 ===');
{
  const declared = new Set([...(/type MyeongTab = ([^;]+);/.exec(src)?.[1] ?? '').matchAll(/'(\w+)'/g)].map((m) => m[1]));
  const listed = new Set([...src.matchAll(/\{\s*id:\s*'(\w+)'\s*,\s*label:/g)].map((m) => m[1]));
  const rendered = new Set([...src.matchAll(/activeTab === '(\w+)'/g)].map((m) => m[1]));

  if (!declared.size) { bad('탭 타입을 못 찾았다 — 하네스가 헛돈다'); }
  else ok(`선언 ${[...declared].join(' · ')}`);

  // 목록에 있는데 안 그리는 것 = **누르면 빈 화면**
  const listedNotRendered = [...listed].filter((k) => !rendered.has(k));
  if (listedNotRendered.length) bad(`★탭 목록에는 있는데 **안 그린다**: ${listedNotRendered.join(' · ')} — 누르면 빈 화면이다`);
  else ok('목록에 있는 탭은 전부 렌더 분기가 있다');

  // 그리는데 목록에 없는 것 = 도달 불가
  const renderedNotListed = [...rendered].filter((k) => declared.has(k) && !listed.has(k));
  if (renderedNotListed.length) bad(`★그리는데 목록에 없다(도달 불가): ${renderedNotListed.join(' · ')}`);
  else ok('렌더 분기는 전부 목록에 있다');

  // 타입에만 있고 목록에 없는 것은 **잔재**라 실패로 보지 않는다(`rel` 이 그렇다) — 다만 알려 준다
  const ghost = [...declared].filter((k) => !listed.has(k));
  if (ghost.length) console.log(`  ·  타입에만 남은 잔재: ${ghost.join(' · ')} (목록에 없어 도달 불가 — 정리 대상)`);
}

console.log('\n=== ② 일주론 탭 ===');
{
  if (/id: 'ilju'/.test(src)) ok('탭 목록에 일주론이 있다');
  else bad('★일주론이 탭 목록에 없다');
  if (/activeTab === 'ilju'/.test(src) && /<IljuTabCard/.test(src)) ok('일주론 탭이 카드를 그린다');
  else bad('★일주론 탭이 아무것도 안 그린다');

  // ★설명문(desc)이 있어야 한다 — 시트가 그걸 띄운다. 빠지면 빈 설명이 뜬다
  // ⚠️★설명이 **키**로 바뀌었다(2026-08-27 다국어). 길이를 재던 옛 검사는 «짧다» 며 울었다 —
  //   코드가 아니라 하네스가 낡은 것이다. ⇒ 그 키가 **copy 에 실제로 있는지**, 그리고
  //   그 문구가 충분히 긴지를 **copy 파일에서** 본다(설명은 이제 거기 있다).
  const key = /\{ id: 'ilju', label: '[^']*', desc: '([\w.]+)'/.exec(src)?.[1];
  const ko = readFileSync('app/src/copy/ko.ts', 'utf8');
  const leaf = key?.split('.').pop() ?? '';
  const val = leaf ? new RegExp(`${leaf}: '((?:[^'\\\\]|\\\\.)*)'`).exec(ko)?.[1] : null;
  if (key && val && val.length >= 20) ok(`탭 설명이 있다(${key} · ${val.length}자)`);
  else bad(`탭 설명이 비었거나 너무 짧다 — 키:${key ?? '없음'} 길이:${val?.length ?? 0}`);
}

console.log('\n=== ③ 자료를 베끼지 않았는가 ===');
{
  const card = readFileSync(CARD, 'utf8');
  if (/from '\.\.\/lib\/engine\/dayPillar'/.test(card)) ok('`/dayPillar` 와 **같은 자료**(`DAY_PILLAR`)를 읽는다');
  else bad('★자료를 따로 갖고 있다 — 문구가 두 갈래가 된다');

  // 60갑자 본문을 이 파일이 직접 들고 있으면 복제다(한자 간지 키가 여러 개 박혀 있는가)
  const gz = [...card.matchAll(/'[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]'/g)].length;
  if (gz > 3) bad(`★간지 문자열이 ${gz}개 박혀 있다 — 60갑자 본문을 복제한 것으로 보인다`);
  else ok('간지 본문을 복제하지 않았다');

  // 성별을 모르면 남/여 칸을 그리면 안 된다(모르는 걸 고르면 지어내는 것)
  if (/sex === '남'[\s\S]{0,80}sex === '여'/.test(card)) ok('성별이 있을 때만 남/여 칸을 그린다');
  else bad('★성별 없이도 남/여 칸을 그린다 — 모르는 것을 고르는 셈이다');

  if (/router\.push\('\/dayPillar'\)/.test(card)) ok('60갑자 전체는 원래 화면으로 보낸다');
  else bad('전체 목록으로 가는 길이 없다');
}

console.log(`\n   통과 ${pass} · 실패 ${fail}`);
if (fail) {
  console.log('\n   ⚠️ 만세력 탭이 어긋나 있다 — `MyeongsikScreen.tsx` 의 `MYEONG_TABS` 와 렌더 분기를 본다.');
  console.log('      ★탭을 목록에만 넣고 안 그리면 **누르면 빈 화면**이 된다(화면은 안 깨진다).\n');
  process.exit(1);
}
console.log('   🎯 통과 — 선언·목록·렌더 일치 · 일주론 배선 · 자료 단일 원본\n');
