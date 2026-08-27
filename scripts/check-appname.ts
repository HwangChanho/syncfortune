// scripts/check-appname.ts — **앱 이름도 언어를 탄다**
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-08-27: *"앱 이름 니운내운도 번역이 돼야해"*
//
// ■ 무엇이 문제였나
//   `appName` 은 세 문구 파일에 **이미 있었는데**(en `Niunnaeun` · ja `ニウンネウン`),
//   워드마크·스플래시·온보딩·웹 랜딩 **다섯 곳이 한글을 직접 박고** 있었다.
//   ⇒ 영어로 골라도 «앱 이름만 한국어» 였다. 화면이 문구 파일을 안 보면 번역은 없는 것과 같다
//     ([[db-copy-not-translated]] 와 같은 계열 — 그때는 DB, 이번엔 화면 하드코딩).
//
// ■ 재는 것
//   A1  세 문구 파일에 `appName` 이 있고, **en/ja 값에 한글이 없다**
//   A2  화면(.tsx)이 이름을 **직접 적지 않는다**(주석·`t()` 폴백은 뺀다)
//   A3  ⚠️스플래시의 「니운.내운」 강조 분리는 **한국어일 때만** 쓴다
//       (다른 언어 이름엔 같은 글자가 두 번 나오는 구조가 없어, 쪼개면 뜻 없는 자리에 색이 든다)
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, readdirSync } from 'node:fs';
import { strip, scanFile } from './lib/ko-scan.ts';

const ROOT = new URL('..', import.meta.url).pathname;
const read = (p: string) => { try { return readFileSync(`${ROOT}${p}`, 'utf8'); } catch { return ''; } };

let fail = 0;
const say = (c: boolean, m: string, d = '') => {
  if (!c) fail++;
  console.log(`  ${c ? '✅' : '❌'} ${m.padEnd(44)} ${d}`);
};

console.log('\n🏷  check:appname — 앱 이름도 언어를 탄다\n');

/** 한국어 앱 이름 — `copy/ko.ts` 가 정본이다(여기 사본을 적지 않는다). */
const KO_NAME = /appName:\s*'([^']+)'/.exec(read('app/src/copy/ko.ts'))?.[1] ?? '';

// ── A1 세 파일에 있고 en/ja 는 한국어가 아니다 ─────────────────────────────
{
  const en = /appName:\s*'([^']+)'/.exec(read('app/src/copy/en.ts'))?.[1] ?? '';
  const ja = /appName:\s*'([^']+)'/.exec(read('app/src/copy/ja.ts'))?.[1] ?? '';
  const KO = /[가-힣]/;
  const ok = !!KO_NAME && !!en && !!ja && !KO.test(en) && !KO.test(ja);
  say(ok, 'A1 en/ja 에 **그 언어의 이름**이 있다',
    ok ? `ko「${KO_NAME}」· en「${en}」· ja「${ja}」`
      : `ko:${KO_NAME || '없음'} en:${en || '없음'} ja:${ja || '없음'} — 한글이 남으면 번역이 안 된 것이다`);
}

// ── A2 화면이 이름을 직접 적지 않는다 ──────────────────────────────────────
{
  const files: string[] = [];
  const walk = (d: string) => {
    let ents; try { ents = readdirSync(`${ROOT}${d}`, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      const p = `${d}/${e.name}`;
      if (e.isDirectory()) walk(p);
      // ⚠️★`+html.tsx` 는 뺀다 — 거기는 **화면이 아니라 `<head>`** 다(2026-08-27).
      //   OG·title 은 **크롤러가 읽는 정적 문서**라, 사용자가 고른 언어를 알 수 없는 자리다
      //   (빌드 시점에 한 벌만 만들어진다). 한국어 한 벌로 고정하는 것이 맞다.
      //   ★다국어 OG 가 필요해지면 그건 «언어별 정적 페이지» 라는 다른 일이다.
      else if (e.name.endsWith('.tsx') && e.name !== '+html.tsx') files.push(p);
    }
  };
  walk('app/src');

  // ★«박혀 있는가» 의 판정은 `ko-scan` 에 맡긴다 — 같은 식이라야 두 검사가 어긋나지 않는다.
  //   그래서 `t('k', '…니운내운…')` 같은 **폴백**은 여기서도 자동으로 빠진다(번역이 이미 있다).
  const bad: string[] = [];
  for (const f of files) {
    for (const spot of scanFile(read(f))) {
      if (!spot.text.includes(KO_NAME)) continue;
      // ★스플래시의 한국어 전용 분기는 A3 가 따로 본다
      if (/startsWith\('ko'\)/.test(strip(read(f)).split('\n')[spot.line - 1] ?? '')) continue;
      bad.push(`${f.replace('app/src/', '')}:${spot.line}`);
    }
  }
  say(bad.length === 0, 'A2 화면이 이름을 **직접 안 적는다**',
    bad.length ? `${bad.join(' · ')} — 여긴 영어로 골라도 한국어가 뜬다`
      : `${files.length}개 화면 전부 t('appName') 을 쓴다`);
}

// ── A3 강조 분리는 한국어일 때만 ───────────────────────────────────────────
{
  const sp = strip(read('app/src/components/TextSplash.tsx'));
  // 「니…운…내…운」 을 쪼개 그리는 자리가 **언어 분기 안**에 있는가
  const splits = sp.includes(`니<Text`);
  const guarded = /startsWith\('ko'\)[\s\S]{0,200}?니<Text/.test(sp);
  say(!splits || guarded, 'A3 이름 쪼개기는 **한국어일 때만**',
    !splits ? '쪼개는 자리가 없다'
      : guarded ? '언어 분기 안에 있다'
        : '★다른 언어 이름엔 그 구조가 없어, 쪼개면 뜻 없는 자리에 색이 든다');
}

// ── 자기검사(음성 테스트) ───────────────────────────────────────────────────
{
  const KO = /[가-힣]/;
  const caught1 = KO.test('니운내운');                       // en 값에 한글이면 잡혀야
  const fake = strip(`// 시안 니운내운.pdf\n<Text>니운내운</Text>`);
  const caught2 = fake.includes('니운내운') && !fake.includes('시안');   // 주석은 걷고 본문은 남는다
  say(caught1 && caught2, '자기검사 — 한글 잔존·하드코딩을 잡아낸다',
    caught1 && caught2 ? '대조군 2개 통과' : `A1:${caught1} A2:${caught2}`);
}

console.log(fail === 0 ? '\n✅ 앱 이름이 고른 언어로 나옵니다\n' : `\n❌ ${fail}건\n`);
process.exit(fail === 0 ? 0 : 1);
