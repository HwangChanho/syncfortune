// scripts/check-readinglang.ts — **풀이를 다른 나라 말로 볼 때** 조용히 깨질 자리를 지킨다
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-08-26: *"풀이 결과들을 각국의 다른 언어로도 볼 수 있으면 좋겠어"*
//
// 이 기능은 **틀려도 아무 소리가 안 난다.** 그래서 하네스가 필요하다 —
// 세 가지가 어긋나면 사용자에게는 «골랐는데 그대로» 또는 «빈 화면» 으로만 보인다.
//
// ■ R1 «앱이 보내는 목록» 과 «서버가 아는 목록» 이 같은가
//   갈리면 앱은 `zh-Hant` 를 보내는데 서버는 몰라서 **말없이 한국어로 떨어뜨린다**.
//   ⇒ 화면에는 한국어 풀이가 뜬다. 오류가 아니라 «안 바뀐 것» 으로 보여서 원인을 못 찾는다.
//
// ■ R2 각 언어 지시문이 «JSON 키는 영어 그대로» 를 말하는가
//   이걸 빠뜨리면 모델이 키까지 그 언어로 번역한다 → 앱이 파싱을 못 해 **그 언어에서만 화면이 통째로 빈다.**
//   ★언어를 추가할 때 제일 잘 빠뜨리는 칸이다(값 번역에만 신경 쓰게 되므로).
//
// ■ R3 풀이 경로가 `appLang()` 이 아니라 `readingLang()` 을 쓰는가
//   한 곳만 남아도 **생성은 새 언어로, 조회는 앱 언어로** 갈린다 →
//   만들어 놓고 **영원히 못 보는** 풀이가 된다(그리고 돈은 나갔다).
//   ⚠️반대로 온디바이스 문구 사전(`taemongDict`·`joseonJob` 등)의 `appLang()` 은 **그대로 둬야 한다** —
//     그건 ko/en/ja 사전이라 풀이 언어를 따라가면 안 된다. 그래서 **두 패턴만** 본다.
//
// 실행: npm run check:readinglang
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const APP_I18N = 'app/src/lib/i18n.ts';
const SRV_LANGS = 'supabase/functions/_shared/langs.ts';

/** `export const READING_LANGS = [...] as const;` 에서 코드 목록을 꺼낸다. */
export function langsOf(src: string): string[] {
  const m = /export const READING_LANGS\s*=\s*\[([\s\S]*?)\]\s*as const/.exec(src);
  if (!m) return [];
  return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
}

/** 서버 `langDirective` 의 `case 'xx':` 다음 반환문 덩어리를 언어별로 잘라 낸다. */
export function directivesOf(src: string): Record<string, string> {
  const out: Record<string, string> = {};
  const body = src.slice(src.indexOf('export function langDirective'));
  const parts = body.split(/case\s+'([^']+)'\s*:/);
  // parts = [머리, 코드1, 본문1, 코드2, 본문2, ...]
  for (let i = 1; i < parts.length - 1; i += 2) out[parts[i]] = parts[i + 1];
  return out;
}

// ── 자기 검사(음성 테스트) ────────────────────────────────────────────────
function selftest(): boolean {
  const a = langsOf(`export const READING_LANGS = ['ko', 'en'] as const;`);
  const b = langsOf(`const NOPE = ['ko'];`);
  const d = directivesOf(`export function langDirective(l){switch(l){case 'en': return 'JSON keys'; case 'th': return 'no keys word';}}`);
  const ok = a.length === 2 && a[0] === 'ko' && b.length === 0
    && d.en?.includes('JSON') === true && d.th?.includes('JSON') === false;
  console.log(`   ${ok ? '✅' : '❌'} 자기검사 — 목록 ${a.length}개 · 가짜 ${b.length}개 · 지시문 en=${d.en?.includes('JSON')} th=${d.th?.includes('JSON')}`);
  return ok;
}

const isMain = process.argv[1]?.includes('check-readinglang');
if (isMain) {
  console.log('\n🌐 풀이 언어 — 조용히 깨질 자리 셋\n');
  let bad = 0;
  if (!selftest()) { console.log('\n❌ 하네스 자신이 고장났습니다\n'); process.exit(1); }
  const say = (ok: boolean, name: string, note = '') => { if (!ok) bad++; console.log(`   ${ok ? '✅' : '❌'} ${name.padEnd(46)} ${note}`); };

  const appSrc = readFileSync(APP_I18N, 'utf8');
  const srvSrc = readFileSync(SRV_LANGS, 'utf8');

  // ── R1 목록 일치 ─────────────────────────────────────────────────────────
  const appL = langsOf(appSrc), srvL = langsOf(srvSrc);
  const onlyApp = appL.filter((l) => !srvL.includes(l));
  const onlySrv = srvL.filter((l) => !appL.includes(l));
  say(appL.length > 0 && onlyApp.length === 0 && onlySrv.length === 0,
    'R1 앱 목록 = 서버 목록',
    onlyApp.length || onlySrv.length ? `앱에만 [${onlyApp}] · 서버에만 [${onlySrv}]` : `${appL.length}개 일치`);

  // ── R2 「JSON 키는 그대로」 ────────────────────────────────────────────────
  //   한국어는 프롬프트가 원래 한국어라 언어 지시 자체가 없다 → 면제.
  const dirs = directivesOf(srvSrc);
  const missing = srvL.filter((l) => l !== 'ko' && !(dirs[l] ?? '').includes('JSON'));
  say(missing.length === 0, 'R2 각 언어가 「JSON 키는 영어 그대로」를 말한다',
    missing.length ? `빠진 언어: ${missing.join(', ')}` : `${srvL.length - 1}개 언어 확인`);

  // ── R3 풀이 경로가 readingLang() ─────────────────────────────────────────
  const files: string[] = [];
  const walk = (d: string) => {
    let ents: string[]; try { ents = readdirSync(d); } catch { return; }
    for (const e of ents) {
      if (e === 'node_modules' || e.startsWith('.')) continue;
      const p = join(d, e);
      if (statSync(p).isDirectory()) walk(p); else if (/\.tsx?$/.test(e)) files.push(p);
    }
  };
  walk('app/src');
  const leaks: string[] = [];
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    src.split('\n').forEach((line, i) => {
      if (line.includes('lang: appLang()') || line.includes("eq('lang', appLang())")) leaks.push(`${f}:${i + 1}`);
    });
  }
  say(leaks.length === 0, 'R3 풀이 생성·조회가 readingLang() 을 쓴다',
    leaks.length ? `아직 appLang(): ${leaks.slice(0, 3).join(' · ')}${leaks.length > 3 ? ` 외 ${leaks.length - 3}` : ''}` : `${files.length}개 파일 확인`);

  // ── R4 라벨이 전 언어에 있다(서버 쪽 — 앱은 Record 라 컴파일러가 강제한다) ──
  const labelBlock = /READING_LANG_LABEL[^{]*\{([\s\S]*?)\n\};/.exec(srvSrc)?.[1] ?? '';
  const labeled = srvL.filter((l) => new RegExp(`['\"]?${l.replace(/[-]/g, '\\-')}['\"]?\\s*:`).test(labelBlock));
  say(labeled.length === srvL.length, 'R4 서버 라벨이 전 언어에 있다',
    `${labeled.length}/${srvL.length}`);

  if (bad) { console.log(`\n❌ ${bad}건 — 이 상태로 나가면 «골랐는데 그대로» 또는 «빈 화면» 이 됩니다.\n`); process.exit(1); }
  console.log(`\n✅ 풀이 언어 ${appL.length}개 — 앱·서버가 같은 목록을 봅니다\n`);
}
