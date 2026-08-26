// scripts/check-personsheet.ts — **사람을 누르면 화면을 떠나지 않는지** · **남의 대운이 새지 않는지**
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-08-26 결정: *"사람 상세 패널로 가자"*
//
// ■ 무엇을 고쳤나 — **두 갈래로 갈려 있던 길**
//   내 이름   → `/charts`(만세력)      · 화면이 통째로 바뀐다
//   친구 이름 → `/friendcompat`(궁합)  · 그 사람 «명식» 을 보는 길은 따로 없었다
//   ⇒ 같은 «사람» 을 눌렀는데 목적지가 달랐고, 둘 다 대화 맥락을 끊었다.
//
// ■ ★★P4 가 이 검사에서 제일 중요하다 — **보안이다**
//   `showLuck` 은 친구에게 **false** 여야 한다. 대운은 성별에 따라 순역이 갈리고
//   시작 나이가 절기까지의 일수로 정해져 **생일을 역산하기 쉽게** 만든다.
//   여덟 글자만으로도 이미 사적인데 재료를 더 얹으면 안 된다
//   (`communityChart.ts`·`friendcompat.tsx` 가 같은 이유로 같은 선을 긋는다).
//   ⚠️이건 «표시 취향» 이 아니라 **정보 유출 폭**이다. 실수로 true 가 되면 아무도 모른다.
//
// ■ P3 — 명식을 **새로 그리지 않는다**
//   `SharedChart` 는 커뮤니티·친구궁합이 쓰는 그것이다. 여기서 새로 그리면
//   «무엇까지 보이나» 가 화면마다 갈리고, 그 갈림이 곧 유출 폭의 차이다.
//
// 실행: npm run check:personsheet
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs';

const SHEET = 'app/src/components/talk/PersonSheet.tsx';
const TALK = 'app/src/app/(app)/talk.tsx';

/** 주석을 걷어낸 «실행되는 코드». ★오늘만 두 번 주석에 속았다 — 이건 기본으로 둔다. */
export function codeOf(src: string): string {
  return src.replace(/\/\/[^\n]*/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ');
}

/** `<SharedChart … showLuck={X} …>` 의 X 를 꺼낸다(없으면 null). */
export function showLuckExpr(src: string): string | null {
  const m = /<SharedChart[^>]*showLuck=\{([^}]*)\}/.exec(codeOf(src));
  return m ? m[1].trim() : null;
}

const isMain = process.argv[1]?.includes('check-personsheet');
if (isMain) {
  console.log('\n👤 사람을 누르면 — 화면을 떠나는가 · 남의 대운이 새는가\n');
  let bad = 0;
  const say = (ok: boolean, name: string, note = '') => { if (!ok) bad++; console.log(`   ${ok ? '✅' : '❌'} ${name.padEnd(46)} ${note}`); };

  const sheet = readFileSync(SHEET, 'utf8');
  const talk = codeOf(readFileSync(TALK, 'utf8'));

  // ── P1 이름 클릭이 화면을 떠나지 않는다 ────────────────────────────────────
  const meLeaves = /onMe=\{\(\) => router\.push\('\/charts'\)\}/.test(talk);
  const frLeaves = /onOpenPerson=\{\(id\) => router\.push\(`\/friendcompat/.test(talk);
  say(!meLeaves && !frLeaves, 'P1 이름을 눌러도 화면이 안 바뀐다',
    meLeaves || frLeaves ? `아직 떠난다: ${[meLeaves && '내 이름', frLeaves && '친구'].filter(Boolean).join(' · ')}` : '');

  // ── P2 내 것과 친구가 **같은 패널**을 연다 ─────────────────────────────────
  const meOpens = /onMe=\{\(\) => setPerson\(\{ kind: 'me'/.test(talk);
  const frOpens = /setPerson\(\{ kind: 'friend'/.test(talk);
  say(meOpens && frOpens, 'P2 내 명식·친구가 **같은 패널**을 연다',
    meOpens && frOpens ? '' : `빠짐: ${[!meOpens && '내 것', !frOpens && '친구'].filter(Boolean).join(' · ')}`);
  // ★두 렌더 경로가 함께 그리는가 — `overlays` 묶음 안에 있어야 한다
  const inOverlays = /const overlays = \([\s\S]{0,1200}<PersonSheet/.test(talk);
  say(inOverlays, 'P2b 오버레이 묶음 안에 있다(두 갈래 화면 모두)',
    inOverlays ? '' : '★넓은 웹에서만 안 뜨는 상태가 됩니다(오늘 ＋ 버튼이 그랬다)');

  // ── P3 명식을 새로 그리지 않는다 ──────────────────────────────────────────
  const reuse = /<SharedChart/.test(codeOf(sheet)) && /toSharedSaju/.test(codeOf(sheet));
  say(reuse, 'P3 명식은 `SharedChart` 를 쓴다(새로 안 그린다)',
    reuse ? '커뮤니티·친구궁합과 같은 화이트리스트' : '★새로 그리면 «무엇까지 보이나» 가 화면마다 갈립니다');

  // ── P4 ★★친구에게 대운을 주지 않는다 (보안) ───────────────────────────────
  const expr = showLuckExpr(sheet);
  //   `isMe` 로 갈려 있어야 한다 — 상수 true 나 조건 없는 표시는 곧 유출이다
  const gated = expr === 'isMe';
  say(gated, 'P4 대운·세운은 **내 것만** 보여 준다',
    expr === null ? 'showLuck 을 안 넘긴다 — 기본이 무엇인지 코드로 못 읽는다'
      : gated ? `showLuck={${expr}}` : `★showLuck={${expr}} — 친구에게도 대운이 갑니다(생일 역산 재료)`);
  // 변환도 같은 값으로 가려야 한다: `toSharedSaju(saju, isMe)`
  const convGated = /toSharedSaju\(\s*data\.saju\s*,\s*isMe\s*\)/.test(codeOf(sheet));
  say(convGated, 'P4b 변환도 같은 조건으로 가린다',
    convGated ? '' : '★표시만 막고 데이터는 넘기면, 다음 사람이 그걸 그리게 된다');

  // ── 음성 테스트 — 상수 true 면 잡히는가 ────────────────────────────────────
  const fakeBad = sheet.replace(/showLuck=\{isMe\}/, 'showLuck={true}');
  say(showLuckExpr(fakeBad) !== 'isMe', '음성 테스트 — `showLuck={true}` 면 잡힌다',
    `가짜 소스에서 ${showLuckExpr(fakeBad)}`);

  if (bad) { console.log(`\n❌ ${bad}건 — 화면이 튕기거나, **남의 생일 역산 재료가 새어 나갑니다**.\n`); process.exit(1); }
  console.log('\n✅ 한 패널에서 열리고, 남의 대운은 안 나갑니다\n');
}
