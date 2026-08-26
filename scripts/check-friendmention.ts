// scripts/check-friendmention.ts — **친구 명식을 @ 로 부를 때 남의 원국을 지어내지 않는지** 지킨다
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-08-26: *"@ 누르면 내가 여기서 친구추가한 인물의 명식도 호출가능해야해
//   그거는 다른식으로 표기 돼서 구분 가능하면 좋겠어"*
//
// ■ 배선 자체는 쉬웠다. **위험한 건 그 다음이다.**
//   내 명식은 매번 `computeChart` 로 새로 계산한다. 친구 것은 **그가 등록하던 날의 산출물**이다.
//   ⇒ 두 가지가 조용히 틀어진다:
//     ①★`timeUnknown` 필드는 2026-07-26 에 생겼다. **그 전에 저장된 원국엔 아예 없다.**
//        `=== true` 로만 보면 `undefined` 가 false 로 떨어져 **엔진이 만든 유령 子시를
//        실재 시주처럼** 싣는다 — 그것도 **남의 명식**에 대해. 최악의 조용한 실패다.
//     ②대운·세운이 «지금» 이 아니라 **그때** 값이다. «현재» 라고 적으면 그건 거짓말이다.
//
// ■ ★이 검사는 **실행해서 본다**
//   「소스에 snapshot 이라는 낱말이 있는가」로는 아무것도 증명 못 한다.
//   `buildMentionBlock` 을 **실제로 불러** 시주가 빠지는지, 문구가 «등록 당시» 인지 확인한다.
//
// 실행: npm run check:friendmention
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs';

const TALK = 'app/src/app/(app)/talk.tsx';
const SHEET = 'app/src/components/talk/ChartMentionSheet.tsx';
const MENTION = 'app/src/lib/talk/chartMention.ts';

/**
 * `chartMention.ts` 의 **시주를 실을지 정하는 식**을 소스에서 꺼내 실행 가능한 함수로 만든다.
 *
 * ★모듈을 통째로 import 하지 않는 이유: 앱 코드는 의존 사슬이 길어(tsconfig paths) 여기서 안 풀린다.
 *   그렇다고 판정식을 **베껴 쓰면** 진짜 코드가 바뀌어도 초록불이 남는다
 *   ([[shared-block-eats-personality]] 의 «같은 규칙의 사본» 함정).
 *   ⇒ **그 한 줄을 그대로 꺼내** 돌린다. 코드가 바뀌면 이 검사도 따라 바뀐다.
 */
export function unknownTimeFn(src: string): ((snap: boolean, saju: any) => boolean) | null {
  const m = /const unknownTime = ([^\n;]+);/.exec(src);
  if (!m) return null;
  try {
    // eslint-disable-next-line no-new-func
    return new Function('snap', 'saju', `return ${m[1]};`) as (s: boolean, j: any) => boolean;
  } catch { return null; }
}

/** 시주가 있는 최소 원국. `timeUnknown` 만 갈아 끼워 시험한다. */
function saju(timeUnknown: boolean | undefined) {
  const p = (stem: string, branch: string) => ({ stem, branch, stemTenGod: '비견', branchMainTenGod: '식신' });
  return {
    pillars: { 년: p('甲', '子'), 월: p('丙', '寅'), 일: p('庚', '午'), 시: p('丁', '亥') },
    dayMaster: { stem: '庚', element: '금' },
    interactions: [],
    currentLuck: { stem: '壬', branch: '申', startAge: 30 },
    annual: { stem: '丙', branch: '午' },
    ...(timeUnknown === undefined ? {} : { timeUnknown }),
  } as never;
}

const isMain = process.argv[1]?.includes('check-friendmention');
if (isMain) {
  console.log('\n👥 친구 명식을 @ 로 부를 때\n');
  let bad = 0;
  const say = (ok: boolean, name: string, note = '') => { if (!ok) bad++; console.log(`   ${ok ? '✅' : '❌'} ${name.padEnd(46)} ${note}`); };

  const mention = readFileSync(MENTION, 'utf8');
  const ut = unknownTimeFn(mention);
  say(!!ut, 'F0 판정식을 소스에서 꺼냈다', ut ? '' : '`const unknownTime = …` 을 못 찾음');
  if (!ut) { console.log('\n❌ 판정식을 못 읽어 나머지를 검사할 수 없습니다.\n'); process.exit(1); }

  // ── F1 ★**실행** 검사: `timeUnknown` 이 없을 때 스냅샷은 시주를 빼는가 ────────
  say(ut(true, saju(undefined)) === true, 'F1 스냅샷 + `timeUnknown` 없음 → **시주를 안 싣는다**',
    ut(true, saju(undefined)) ? '' : '★유령 子시를 남의 명식으로 내보냅니다');
  // ★내 명식 경로는 **바뀌면 안 된다**(회귀) — 거긴 매번 계산해서 필드가 늘 있다
  say(ut(false, saju(undefined)) === false, 'F1b 내 명식 경로는 그대로(회귀 없음)',
    ut(false, saju(undefined)) ? '★내 명식에서도 시주가 사라집니다 — 과잉 방어' : '');

  // ── F2 «시각을 안다» 면 스냅샷도 싣는다 ─────────────────────────────────────
  say(ut(true, saju(false)) === false, 'F2 스냅샷이어도 «시각을 안다» 면 시주를 싣는다', '');
  say(ut(true, saju(true)) === true, 'F2b «시각 미상» 이면 당연히 뺀다', '');

  // ── F3 대운·세운 문구 ──────────────────────────────────────────────────────
  say(/등록 당시/.test(mention) && /snap \? '등록 당시' : '현재'/.test(mention),
    'F3 스냅샷은 «등록 당시» 라고 적는다',
    /snap \? '등록 당시' : '현재'/.test(mention) ? '' : '«현재» 라고 적으면 그건 거짓말이 됩니다');

  // ── F4 배선 ────────────────────────────────────────────────────────────────
  const talk = readFileSync(TALK, 'utf8');
  const wired = /friends[\s\S]{0,400}source: 'friend'/.test(talk) && /loadFriendChart/.test(talk);
  say(wired, 'F4 친구가 @ 후보에 들어간다', wired ? '' : '배선이 없습니다');
  // ★친구 경로가 `computeChart` 를 타면 안 된다 — 생일을 모르므로 계산 자체가 불가능하다
  const friendBranch = /if \(m\.source === 'friend'\)([\s\S]{0,400}?)continue;/.exec(talk)?.[1] ?? '';
  say(friendBranch.length > 0 && !/computeChart/.test(friendBranch),
    'F5 친구 경로가 `computeChart` 를 안 탄다',
    friendBranch ? '' : '분기를 못 찾았습니다');
  say(/snapshot: true/.test(friendBranch), 'F6 친구 블록에 `snapshot` 을 단다', '');

  // ── F7 화면 구분 — 색만이 아니라 «글자로» ─────────────────────────────────
  const sheet = readFileSync(SHEET, 'utf8');
  const sectioned = /내 명식/.test(sheet) && /친구가 공개한 명식/.test(sheet);
  say(sectioned, 'F7 시트가 **섹션 둘**로 갈라 보여 준다', sectioned ? '' : '색만으로 가르면 색약인 사람에게 안 보입니다');
  say(/비공개/.test(sheet) && /disabled/.test(sheet), 'F8 공개 안 한 친구도 **보여 주되 못 고른다**',
    '숨기면 «왜 안 보이지» 가 됩니다');

  if (bad) { console.log(`\n❌ ${bad}건 — 남의 원국을 지어내거나, 구분이 안 됩니다.\n`); process.exit(1); }
  console.log('\n✅ 친구 명식을 **있는 그대로** 싣고, 모르는 것은 안 싣습니다\n');
}
