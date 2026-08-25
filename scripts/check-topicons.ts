/**
 * scripts/check-topicons.ts — **상단바 아이콘**이 글자 글리프로 되돌아가지 않게
 * ═════════════════════════════════════════════════════════════════════════
 * Boss 2026-08-24 *"앱 상단에 아이콘들 크기가 너무 작어"*.
 *
 * ■ ★왜 눈으로 못 잡나
 *   글리프는 **`fontSize` 를 크게 줘도 작게 그려진다.** 코드에는 `fontSize: 26` 이라 적혀 있어
 *   숫자만 읽으면 문제가 없어 보인다. 실제로 잰 잉크(=눈에 보이는 크기)는 이랬다:
 *
 *     ⌕ 돋보기  fontSize 26 →  12×12   (46%)   ⚙︎ 설정  fontSize 20 → 12×13  (65%)
 *     × 닫기    fontSize 26 →  12×13   (50%)   🔔 알림  fontSize 20 → 22×22 (110%)
 *     ⋮ 더보기  fontSize 26 →  4×19            ＋ 더하기 fontSize 26 → 13×13  (50%)
 *
 *   ⇒ ①글리프는 em 박스를 다 안 쓴다 ②이모지는 꽉 채운다 ⇒ **나란히 두면 크기가 안 맞는다**
 *     (`my` 화면의 🔔 22 와 ⚙︎ 12 가 나란히 있었다). 게다가 폰트마다 달라 웹에선 또 다르다.
 *
 * ■ 무엇을 잡나
 *   ①상단바 버튼이 **글자 글리프**를 그리고 있는가 → 실패
 *   ②`kit/Icon` 이 규격(24 박스 · 획 2)을 지키는가
 *   ③아이콘 크기가 상단바에서 **22 미만**으로 내려가 있는가(다시 작아지는 것)
 *
 * 실행: npm run check:topicons   (preflight 에 포함)
 */
import { readFileSync } from 'node:fs';

/** 상단바를 그리는 파일들. 늘리려면 여기 추가한다. */
const TOPBARS = [
  'app/src/components/talk/TalkList.tsx',
  'app/src/components/talk/ChatList.tsx',
  'app/src/app/(app)/my.tsx',
  'app/src/app/(app)/community.tsx',
];
const ICON = 'app/src/components/kit/Icon.tsx';

/** 아이콘으로 쓰면 안 되는 글자들 — 전부 잉크가 em 을 안 채우거나(글리프) 혼자 꽉 채운다(이모지). */
const GLYPHS = ['⌕', '⋮', '☰', '⚙', '🔔', '🗑', '＋', '✕'];

let fail = 0, pass = 0;
const bad = (m: string) => { fail++; console.log(`  ❌ ${m}`); };
const ok = (m: string) => { pass++; console.log(`  ✅ ${m}`); };

console.log('\n🔎 상단바 아이콘 하네스\n');

/** 주석을 걷어 낸다 — ★내가 *설명으로 적어 둔* 글리프를 코드로 오인한 적이 있다. */
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter((l) => !/^\s*(\/\/|\*)/.test(l)).join('\n');

console.log('=== ① 상단바 버튼이 글자 글리프를 그리는가 ===');
for (const f of TOPBARS) {
  const src = stripComments(readFileSync(f, 'utf8'));
  // `<Text …>글리프</Text>` 형태만 본다(본문 산문에 섞인 글자는 아이콘이 아니다)
  // ⚠️★`u` 플래그가 **필수**다. 없으면 이모지가 서로게이트 쌍으로 쪼개져
  //   문자 클래스에 `\uD83D` 하나가 들어가고, 그 상위 서로게이트를 쓰는 **아무 이모지나** 걸린다
  //   (실제로 이 하네스 첫 판이 관계없는 이모지를 `�` 로 잡아냈다).
  const hits = [...src.matchAll(/<Text[^>]*>\s*\{?[^<{]*?([⌕⋮☰⚙🔔🗑＋✕])/gu)].map((m) => m[1]);
  if (hits.length) bad(`${f} — 아직 글자로 그린다: ${[...new Set(hits)].join(' ')} (fontSize 를 키워도 안 커진다)`);
  else ok(`${f.split('/').pop()} — 글자 글리프 없음`);
}

console.log('\n=== ② `kit/Icon` 규격 ===');
{
  const icon = readFileSync(ICON, 'utf8');
  if (/viewBox="0 0 24 24"/.test(icon)) ok('24×24 좌표계');
  else bad('viewBox 가 24×24 가 아니다 — 아이콘마다 크기가 갈린다');
  if (/const sw = \(2 \* size\) \/ 24/.test(icon)) ok('획 굵기가 size 에 비례한다(키워도 가늘어지지 않는다)');
  else bad('획 굵기가 size 를 안 따라간다');
  const names = /export type IconName = ([^;]+);/.exec(icon)?.[1] ?? '';
  const count = (names.match(/'/g) ?? []).length / 2;
  // 선언한 이름을 **전부 그리는가** — 이름만 늘리고 도형을 빠뜨리면 빈 칸이 뜬다
  const drawn = new Set([...icon.matchAll(/name === '(\w+)'/g)].map((m) => m[1]));
  if (drawn.size === count) ok(`선언한 ${count}종을 전부 그린다`);
  else bad(`선언 ${count}종 중 ${drawn.size}종만 그린다 — 나머지는 빈 칸으로 뜬다`);
}

console.log('\n=== ③ 누르는 아이콘이 다시 작아지지 않았는가 ===');
{
  /**
   * **누를 수 있는** 아이콘만 골라 크기를 잰다.
   *
   * ⚠️★장식 아이콘까지 같이 재면 안 된다 — 검색창 앞의 돋보기는 **글자 옆 장식**이라
   *   18 이 맞다. 첫 판이 그걸 22 미만이라고 물어서, 규칙을 *누를 수 있는가*로 좁혔다.
   *   (버튼은 손가락이 가는 자리라 커야 하고, 장식은 글자에 맞춰야 한다 — 기준이 다르다.)
   *
   * @param src 주석을 걷어 낸 소스
   * @returns 눌리는 자리에 있는 `<Icon>` 의 size 값들
   */
  const pressableIconSizes = (src: string): { size: number; hitSlop: number }[] => {
    const out: { size: number; hitSlop: number }[] = [];
    for (const m of src.matchAll(/<Icon[^>]*size=\{(\d+(?:\.\d+)?)\}/g)) {
      const before = src.slice(Math.max(0, m.index! - 400), m.index!);
      const openAt = before.lastIndexOf('<PressableScale');
      const closeAt = before.lastIndexOf('</PressableScale>');
      if (openAt < 0 || openAt <= closeAt) continue;                 // 버튼 안이 아니다
      // 그 버튼 태그에 붙은 hitSlop 을 읽는다(없으면 0)
      const tag = before.slice(openAt);
      const hs = /hitSlop=\{(\d+)\}/.exec(tag);
      out.push({ size: Number(m[1]), hitSlop: hs ? Number(hs[1]) : 0 });
    }
    return out;
  };

  let small = 0;
  for (const f of TOPBARS) {
    const src = stripComments(readFileSync(f, 'utf8'));
    for (const { size, hitSlop } of pressableIconSizes(src)) {
      // ★기준은 **손가락이 닿는 넓이**지 글자 크기가 아니다.
      //   배너의 작은 닫기(✕)까지 22 를 강요하면 그 줄이 뭉개진다 — 규칙이 화면을 망친다.
      //   ⇒ `hitSlop` 이 있으면 **실효 크기 = size + hitSlop×2** 로 본다(그게 실제 누르는 넓이다).
      //   ⚠️그래도 **16 아래는 막는다** — 아무리 hitSlop 을 줘도 눈으로 못 찾는다.
      const eff = size + hitSlop * 2;
      if (size < 16) { bad(`${f.split('/').pop()} — 누르는 아이콘 size ${size} (16 아래는 눈으로 못 찾는다)`); small++; }
      else if (eff < 40) { bad(`${f.split('/').pop()} — 누르는 자리가 ${eff}px (size ${size} + hitSlop ${hitSlop}) — 40 이상이어야 손가락이 닿는다`); small++; }
    }
  }
  if (!small) ok('누르는 아이콘이 전부 22 이상');

  // ★음성 테스트 — 규칙이 실제로 무는지, 그리고 **장식은 안 무는지**(둘 다 봐야 한다)
  const btn = '<PressableScale onPress={x}><Icon name="search" size={14} /></PressableScale>';
  if (pressableIconSizes(btn).length === 1 && pressableIconSizes(btn)[0].size === 14) ok('음성 테스트 — 버튼 안의 작은 값을 문다');
  else bad('음성 테스트 실패 — 버튼 안이 작아져도 통과한다');

  const deco = '<View style={s.box}><Icon name="search" size={18} /><TextInput /></View>';
  if (pressableIconSizes(deco).length === 0) ok('음성 테스트 — 장식 아이콘은 물지 않는다');
  else bad('음성 테스트 실패 — 장식까지 문다(검색창 돋보기가 22 를 강요당한다)');
}

console.log(`\n   통과 ${pass} · 실패 ${fail}`);
if (fail) {
  console.log('\n   ⚠️ 상단 아이콘이 다시 작아졌다. `components/kit/Icon.tsx` 로 그린다.');
  console.log('      ★글자 글리프는 fontSize 를 키워도 안 커진다(⌕ 는 26 을 줘도 12px 로 그려진다).\n');
  process.exit(1);
}
console.log('   🎯 통과 — 상단바 전부 SVG · 규격 일치 · 22 이상\n');
