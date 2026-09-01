// scripts/check-surface.ts — **웹 · 태블릿 · 폰** 을 헷갈리지 않게 지킨다
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-09-01: *"패드는 지금 언어설정이 두군대나 있는데"* ·
//                  *"코드에서 웹 패드 모바일 다 다르게 분기처리해둬야할꺼 같은데"*
//
// ■ ★★무엇이 어긋났나 — 판단이 **둘**뿐이었다
//   `Platform.OS === 'web'`(웹이냐) 와 `isWideWidth`(넓으냐). 그 사이에
//   **아이패드**가 있다: 넓어서 사이드바는 서는데, «웹이 아니» 라서 폰용 요소가 같이 그려진다.
//   ⇒ 실측(iPad Pro 12.9"): **언어 칩이 둘**. 사이드바 것 + 홈 헤더 것.
//   ⚠️홈 화면 주석은 «둘이 된다» 를 이미 경고하고 있었다 — 그런데 **플랫폼으로** 갈라서
//     경고가 지키려던 것을 못 지켰다. 조건이 틀리면 주석은 아무것도 못 막는다.
//
// ■ ★언어가 **두 층**이라는 것도 같은 종류의 혼동이다
//   UI 언어 `APP_LANGS`(3) ≠ 풀이·대화 언어 `READING_LANGS`(9).
//   대화 화면이 `i18n.language`(UI)를 보내 **아홉 중 여섯은 서버에 닿지도 않았다.**
//
// 무엇을 지키나
//   S1 면 판단은 **`surfaceOf` 한 곳**에서 나온다(웹·태블릿·폰)
//   S2 홈의 언어 칩이 **사이드바 유무**로 갈린다(플랫폼으로 가르지 않는다)
//   S3 대화가 **`talkLang()`** 을 보낸다(`i18n.language` 가 아니다)
//   S4 서버가 **아홉 언어 전부**를 이름으로 안다(여섯이 조용히 한국어로 떨어지지 않게)
//
// ★음성 테스트: `npx tsx scripts/check-surface.ts --selftest`
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname ?? '.', '..');
const read = (p: string): string | null => { try { return readFileSync(join(ROOT, p), 'utf8'); } catch { return null; } };
type Finding = { rule: string; msg: string };
const out: Finding[] = [];
const fail = (rule: string, msg: string) => out.push({ rule, msg });

/** 면 판단이 셋으로 갈려 있는가. */
export function hasThreeWaySurface(src: string): boolean {
  return /export function surfaceOf/.test(src)
    && /'web'/.test(src) && /'tablet'/.test(src) && /'phone'/.test(src);
}

/** 홈의 언어 칩이 **플랫폼**이 아니라 **사이드바 유무**로 갈리는가. */
export function langChipBySurface(src: string): boolean {
  const chip = /\{\s*!?\s*sidebarShown\s*\?\s*<LangChip\s*\/>|\{\s*!sidebarShown\s*&&\s*<LangChip/.test(src);
  const byPlatform = /Platform\.OS\s*!==\s*'web'\s*\?\s*<LangChip/.test(src);
  return chip && !byPlatform;
}

/** 대화가 UI 언어가 아니라 대화 언어를 보내는가. */
export function chatSendsTalkLang(src: string): boolean {
  return /askLive\([^)]*talkLang\(\)/s.test(src) && !/askLive\([^)]*i18n\.language/s.test(src);
}

/** 서버가 아는 언어 이름의 수. */
export function serverLangCount(src: string): number {
  const m = /const LANG_NAME: Record<string, string> = \{([\s\S]*?)\};/.exec(src);
  if (!m) return 0;
  return (m[1].match(/:/g) ?? []).length;
}

function run() {
  const WIDE = 'app/src/lib/ui/wideLayout.ts';
  const w = read(WIDE);
  if (!w) fail('S1', `${WIDE} 를 못 읽었다 — **못 쟀다**`);
  else if (!hasThreeWaySurface(w)) {
    fail('S1', `${WIDE} 에 **세 갈래 면 판단(surfaceOf)이 없다**.\n        `
      + '⚠️둘(웹이냐·넓으냐)로는 **아이패드가 어디에도 안 맞는다** — 넓지만 웹이 아니다');
  }

  const HOME = 'app/src/app/(app)/index.tsx';
  const h = read(HOME);
  if (!h) fail('S2', `${HOME} 를 못 읽었다 — **못 쟀다**`);
  else if (!langChipBySurface(h)) {
    fail('S2', `홈의 언어 칩이 **플랫폼으로** 갈린다.\n        `
      + '⚠️`Platform.OS !== \'web\'` 은 「웹이 아니면 사이드바가 없다」 는 전제인데,\n        '
      + '**아이패드는 웹이 아니면서 사이드바가 선다** ⇒ 칩이 둘이 된다(2026-09-01 실측)');
  }

  const TALK = 'app/src/app/(app)/talk.tsx';
  const t = read(TALK);
  if (!t) fail('S3', `${TALK} 를 못 읽었다 — **못 쟀다**`);
  else if (!chatSendsTalkLang(t)) {
    fail('S3', '대화가 **UI 언어**를 보낸다.\n        '
      + '⚠️UI 는 3개(`APP_LANGS`)뿐인데 회원이 고르는 풀이 언어는 9개다 —\n        '
      + '**여섯 언어는 서버에 닿지도 못한다**(고른 언어로 답이 안 나온다)');
  }

  const EDGE = 'supabase/functions/talk/index.ts';
  if (!existsSync(join(ROOT, EDGE))) console.log('⏭  S4 건너뜀 — `supabase/` 가 없다(gitignore). **못 쟀다**');
  else {
    const n = serverLangCount(readFileSync(join(ROOT, EDGE), 'utf8'));
    const want = (read('app/src/lib/i18n.ts')?.match(/export const READING_LANGS = \[([^\]]*)\]/)?.[1].match(/'/g)?.length ?? 0) / 2;
    if (n < want) {
      fail('S4', `서버가 아는 언어가 **${n}개**인데 앱이 고르게 하는 건 **${want}개**다.\n        `
        + '⚠️모르는 언어는 조용히 **한국어로** 떨어진다 — 고른 사람은 이유를 알 수 없다');
    }
  }
}

if (process.argv.includes('--selftest')) {
  const cases = [
    { name: 'S1 셋으로 갈리면 통과', run: () => hasThreeWaySurface(`export function surfaceOf(){} 'web' 'tablet' 'phone'`) === true },
    { name: 'S1 ★태블릿이 없으면 문다', run: () => hasThreeWaySurface(`export function surfaceOf(){} 'web' 'phone'`) === false },
    { name: 'S2 사이드바로 갈리면 통과', run: () => langChipBySurface(`{!sidebarShown ? <LangChip /> : null}`) === true },
    { name: 'S2 ★플랫폼으로 갈리면 문다', run: () => langChipBySurface(`{Platform.OS !== 'web' ? <LangChip /> : null}`) === false },
    { name: 'S3 talkLang 을 보내면 통과', run: () => chatSendsTalkLang(`askLive(a, b, c, d, talkLang(), e)`) === true },
    { name: 'S3 ★i18n.language 면 문다', run: () => chatSendsTalkLang(`askLive(a, b, c, d, i18n.language, e)`) === false },
    { name: 'S4 아홉을 세면 9', run: () => serverLangCount(`const LANG_NAME: Record<string, string> = { a:1,b:2,c:3,d:4,e:5,f:6,g:7,h:8,i:9 };`) === 9 },
    { name: 'S4 ★표가 없으면 0', run: () => serverLangCount(`const fallback = 'ko'`) === 0 },
  ];
  let bad = 0;
  console.log('── 음성 테스트(깨뜨린 입력을 실제로 무는가) ──');
  for (const c of cases) { let ok = false; try { ok = c.run(); } catch { ok = false; } console.log(`  ${ok ? '✅' : '❌'} ${c.name}`); if (!ok) bad++; }
  if (bad) { console.error(`\n❌ 음성 테스트 ${bad}건 실패`); process.exit(1); }
  console.log('  → 전부 통과: 이 하네스는 실제로 문다\n');
} else {
  run();
  if (out.length) {
    console.error(`❌ check:surface — ${out.length}건`);
    for (const f of out) console.error(`  [${f.rule}] ${f.msg}`);
    process.exit(1);
  }
  console.log('✅ check:surface — 웹·태블릿·폰이 갈려 있고, 고른 언어가 대화까지 닿는다');
}
