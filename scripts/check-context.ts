// scripts/check-context.ts — 풀이 상황(context) 배선 하네스
// ─────────────────────────────────────────────────────────────────────────
// daniel 2026-07-28: "풀이가 너무 직장인에만 포커스 되어있는데"
//
// ★왜 하네스인가: 이 배선의 고장은 **아무 에러 없이 조용히** 일어난다.
//   앱이 situation:'parent' 를 보내도 Edge 화이트리스트에 없으면 그냥 무시된다 —
//   크래시도, 로그도, 빈 화면도 없다. 사용자는 "골랐는데 왜 그대로지"만 겪는다.
//   실제로 이 프로젝트에서 `ChartContext` 타입이 **사용처 0인 채로** 오래 남아 있었고,
//   R39 는 그 필드를 전제로 쓰였는데 아무도 몰랐다. 조용한 고장은 하네스로만 잡힌다.
//
// 지키는 것:
//   X1 키 정합 — 앱 칩 키 == Edge SITUATION_LABEL 키(양방향, 하나라도 어긋나면 무시된다)
//   X2 저장 — 등록 화면이 situation 을 context 에 실제로 담는다
//   X3 전달 — 풀이 호출이 savedChart.context 를 body 에 싣는다(주요 화면)
//   X4 기본값 차단 — 공통 문체에 '직장인 기본값 금지'가 살아 있다
//   X5 인젝션 — 상황은 **고정 키만** 라벨링된다(자유 텍스트가 라벨로 새지 않는다)
//
// 실행: npm run check:context
// ─────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname;
const read = (p: string) => { try { return readFileSync(`${ROOT}${p}`, 'utf8'); } catch { return null; } };
/** 주석을 걷어낸다 — 주석 처리된 코드를 '살아 있다'고 읽는 오탐 방지(K3·K7 에서 두 번 겪음). */
const strip = (x: string) => x.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

let fail = 0;
const bad = (m: string) => { console.error(`  ✗ ${m}`); fail++; };
const ok = (m: string) => console.log(`  ✓ ${m}`);

const reg = read('app/src/screens/ChartRegisterScreen.tsx');
const bup = read('supabase/functions/_shared/buildUserPrompt.ts');
const prm = read('supabase/functions/_shared/prompts.ts');

// ── X1 키 정합 ───────────────────────────────────────────────────────────
console.log('\n[X1] 앱 상황 칩 키 == Edge 화이트리스트 키');
{
  if (!reg) { bad('ChartRegisterScreen.tsx 를 못 읽음'); }
  else if (!bup) { console.log('  – supabase/ 없음 — 스킵(gitignore 대상)'); }
  else {
    // 앱: [['study', t(...)], ['work', …]] 형태의 칩 배열에서 키만
    const chipBlock = strip(reg).match(/setSituation\(on \? '' : v\)[\s\S]{0,80}/) ? strip(reg) : '';
    const appKeys = new Set(
      [...(chipBlock.match(/\[\[?'(study|work|biz|free|home|seek|retire|etc)'[\s\S]*?\]\]/)?.[0] ?? '')
        .matchAll(/'([a-z]+)',\s*t\(/g)].map((m) => m[1]),
    );
    const edgeKeys = new Set(
      [...(strip(bup).match(/SITUATION_LABEL:\s*Record<string,\s*string>\s*=\s*\{[\s\S]*?\n\};/)?.[0] ?? '')
        .matchAll(/^\s{2}([a-z]+):\s*'/gm)].map((m) => m[1]),
    );
    if (appKeys.size < 4) bad(`앱 칩 키를 ${appKeys.size}개밖에 못 읽었다 — 패턴이 바뀌어 하네스가 헛돈다(역검증 실패)`);
    if (edgeKeys.size < 4) bad(`Edge 화이트리스트 키를 ${edgeKeys.size}개밖에 못 읽었다 — 패턴이 바뀌어 하네스가 헛돈다`);
    if (appKeys.size >= 4 && edgeKeys.size >= 4) {
      const onlyApp = [...appKeys].filter((k) => !edgeKeys.has(k));
      const onlyEdge = [...edgeKeys].filter((k) => !appKeys.has(k));
      if (onlyApp.length) bad(`앱에만 있는 상황 키: ${onlyApp.join(', ')} — 서버가 **조용히 무시**한다(에러 없이 안 먹는다)`);
      if (onlyEdge.length) bad(`Edge 에만 있는 상황 키: ${onlyEdge.join(', ')} — 아무도 고를 수 없는 죽은 라벨`);
      if (!onlyApp.length && !onlyEdge.length) ok(`${appKeys.size}종 일치(${[...appKeys].join(' · ')})`);
    }
  }
}

// ── X2 저장 ──────────────────────────────────────────────────────────────
console.log('\n[X2] 등록 화면이 situation 을 context 에 담는다');
{
  if (!reg) bad('파일 없음');
  else {
    const s = strip(reg);
    if (/context:\s*\([\s\S]{0,200}?situation/.test(s) && /\{\s*situation:\s*situation\s*\|\|\s*undefined/.test(s)) ok('context 에 situation 포함');
    else bad('situation 이 저장 payload 에 없다 — 칩을 골라도 아무 데도 안 간다');
  }
}

// ── X3 전달 ──────────────────────────────────────────────────────────────
console.log('\n[X3] 풀이 호출이 명식 context 를 실어 보낸다');
{
  const targets = ['app/src/screens/ReadingScreen.tsx', 'app/src/app/(app)/today.tsx', 'app/src/app/(app)/newyear.tsx'];
  let miss = 0;
  for (const f of targets) {
    const src = read(f);
    if (!src) { bad(`${f} 없음`); miss++; continue; }
    if (!/context:\s*(savedChart|saved)\??\.context/.test(strip(src))) { bad(`${f}: context 를 body 에 안 싣는다 — 이 화면 풀이만 상황을 모른다`); miss++; }
  }
  if (!miss) ok(`${targets.length}개 화면 전달 확인`);
}

// ── X4 직장인 기본값 차단 ────────────────────────────────────────────────
console.log('\n[X4] 공통 문체에 직장인 기본값 금지가 살아 있다');
{
  if (!prm) console.log('  – supabase/ 없음 — 스킵');
  else {
    const s = strip(prm);
    // ★'회의에서…'는 **금지 목록 안에 1회** 나오는 게 정상이다(그게 규칙 본문). 그 밖에서 나오면
    //   '이렇게 쓰라'는 *긍정 예시*이므로 위반이다. 첫 역검증에서 이 구분이 없어 자기 규칙을 스스로 위반으로 읽었다.
    const hits = [...s.matchAll(/회의에서 의견을 낼 때/g)].length;
    const inBanList = /금지:[^\n]*회의에서 의견을 낼 때/.test(s);
    if (!/직장인 기본값 금지/.test(s)) bad("공통 문체에서 '직장인 기본값 금지'가 사라졌다 — 상황 미입력 사용자가 다시 직장인 취급된다");
    else if (hits > (inBanList ? 1 : 0)) bad("'회의에서 의견을 낼 때'가 **긍정 예시로** 남아 있다 — 이 예시가 모델에게 '구체적 장면=사무실'을 가르친다");
    else ok('규칙 존재 + 사무실 예시는 금지 목록에만');
  }
}

// ── X5 인젝션 ────────────────────────────────────────────────────────────
console.log('\n[X5] 상황은 고정 키만 라벨링(자유 텍스트 통과 금지)');
{
  if (!bup) console.log('  – supabase/ 없음 — 스킵');
  else {
    const s = strip(bup);
    if (/SITUATION_LABEL\[String\(context\.situation/.test(s)) ok('화이트리스트 조회로만 라벨 생성');
    else bad('situation 을 화이트리스트 없이 문자열로 쓴다 — 프롬프트 인젝션 표면');
  }
}

console.log(fail ? `\n❌ check:context 실패 ${fail}건` : '\n✅ check:context 통과 — 키정합·저장·전달·기본값차단·인젝션 OK');
process.exit(fail ? 1 : 0);
