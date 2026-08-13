// scripts/check-busyleak.ts — **로딩은 어떤 경로로 나가든 꺼져야 한다**
// ═══════════════════════════════════════════════════════════════════════════
// daniel 태스크 #14("연애 풀이 로딩창이 도중에 사라짐")를 파다가 발견(2026-08-13).
//
// ■ 무엇이 문제였나
//   생성 화면들은 `isStale()`(= 그 사이 명식이 바뀌었나)로 **결과를 폐기하고 빠져나가는** 경로를
//   여럿 갖고 있다. love 만 해도 7곳. 그런데 그 return 들이 **`setBusy(false)` 없이** 나갔다.
//   ⇒ 명식을 바꾸거나 화면이 재로드되면 **로딩이 영영 안 사라진다.** 사용자에겐 '멈춘 앱'이다.
//   `finally` 는 잠금만 풀고(`releaseGen`) 로딩은 건드리지 않았다 — 딱 한 줄이 비어 있었다.
//
// ■ 왜 기계가 보나
//   이 종류는 **조용하다.** 크래시도 로그도 없다. 사용자는 앱을 껐다 켜고 만다.
//   그리고 화면을 하나 더 만들 때마다 같은 구멍이 생긴다 — 기억으론 못 막는다.
//
// ■ 판정 (이름이 아니라 **구조**로)
//   `setBusy(true)` 로 로딩을 켜는 화면은, 생성 함수의 `finally` 블록에서 **반드시 `setBusy(false)`** 를
//   해야 한다. finally 는 성공·실패·폐기를 모두 지나는 유일한 지점이라,
//   여기 한 줄이면 그 아래 return 이 몇 개든 전부 닫힌다.
//   ⚠️`try` 안이나 마지막 줄의 `setBusy(false)` 로는 통과시키지 않는다 — 중간 return 을 못 막는다.
//
// 실행: npm run check:busyleak
// ═══════════════════════════════════════════════════════════════════════════
import fs from 'fs';
import path from 'path';

const ROOTS = ['app/src/screens', 'app/src/app/(app)'];

/** 면제 — 로딩 상태를 쓰지 않거나, 생성 대기가 없는 화면. 사유 없이 넣지 말 것. */
const EXEMPT: Record<string, string> = {
  'community.tsx': '서버 생성을 기다리지 않는다',
};

const files: string[] = [];
for (const root of ROOTS) {
  if (!fs.existsSync(root)) continue;
  for (const f of fs.readdirSync(root)) {
    if (f.endsWith('.tsx')) files.push(path.join(root, f));
  }
}

let bad = 0, ok = 0, skip = 0;
console.log('\n⏳ 로딩이 어떤 경로로 나가든 꺼지는가\n');

/**
 * ★**주석을 걷어낸다.** 이게 없으면 코드에서 `setBusy(false)` 를 지워도
 *   주석에 남은 *글자* 가 하네스를 통과시킨다 — 실제로 이 파일이 그렇게 뚫렸다(2026-08-13 음성 테스트).
 *   [[harness-judge-expression-not-name]] 의 "주석의 단어가 통과시킨다" 가 정확히 재현된 것이다.
 *   문자열 리터럴 안의 `//` 를 지우는 부작용이 있지만, 이 검사는 **코드 구조**만 보므로 무해하다.
 */
const stripComments = (code: string) =>
  code.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n');

for (const f of files) {
  const src = stripComments(fs.readFileSync(f, 'utf8'));
  const base = path.basename(f);

  // 대상 = 로딩을 켜고(setBusy(true)) **폐기 경로(isStale)** 를 가진 화면
  if (!/setBusy\(true\)/.test(src) || !/isStale\s*\(/.test(src)) continue;
  if (EXEMPT[base]) { skip++; continue; }

  // ★**생성 함수의** finally 만 본다 — `releaseGen`(생성 잠금 해제)이 있는 블록이 그것이다.
  //   ⚠️2026-08-13 음성 테스트로 고쳤다: 처음엔 파일 안의 finally 를 **전부** 모아 `some()` 으로 봤는데,
  //     화면에는 finally 가 여러 개 있어서 **엉뚱한 블록 하나가 통과시켜 버렸다**(변조해도 초록불).
  //     "어딘가에 있다"가 아니라 "**그 자리에** 있다"로 판정해야 한다.
  const finallies = [...src.matchAll(/\}\s*finally\s*\{([\s\S]{0,800}?)\n\s*\}/g)].map((m) => m[1]);
  const genFinallies = finallies.filter((b) => /releaseGen\s*\(/.test(b));
  const closed = genFinallies.length > 0 && genFinallies.every((b) => /setBusy\(false\)/.test(b));

  // isStale 로 나가면서 로딩을 안 끄는 return 이 finally 밖에 있는가(락 점유 경로 등)
  const bareStale = [...src.matchAll(/if \(isStale\(\)[^)]*\)\s*return;/g)].length;

  if (closed) {
    ok++;
    console.log(`   ✅ ${base} — finally 에서 로딩을 끈다${bareStale ? ` (isStale 단순 return ${bareStale}곳은 finally 가 덮는다)` : ''}`);
  } else {
    bad++;
    console.log(`   ❌ ${base} — 생성 함수의 **finally 에 setBusy(false) 가 없습니다**`);
    console.log(`      isStale() 로 빠져나가는 return 이 ${bareStale}곳 있는데, 그 경로로 나가면 로딩이 안 꺼집니다.`);
    console.log(`      사용자에겐 '멈춘 앱'으로 보입니다(크래시도 로그도 남지 않아 조용합니다).`);
    console.log(`      ⇒ finally { releaseGen(...); setBusy(false); } 처럼 한 줄을 더하세요.`);
  }
}

console.log(`\n   대상 ${ok + bad + skip}곳 · 정상 ${ok} · 면제 ${skip} · 누수 ${bad}`);
console.log(bad ? '\n❌ check:busyleak 실패\n' : '\n✅ check:busyleak 통과 — 모든 경로에서 로딩이 닫힙니다\n');
if (bad) process.exitCode = 1;
