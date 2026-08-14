// scripts/check-homecost.ts — **홈 카드가 첫 페인트를 막지 않는가**
// ═══════════════════════════════════════════════════════════════════════════
// daniel 2026-08-14: *"홈로딩도 갑자기 너무 오래걸려"*
//
// ■ 무엇이 있었나 (실측)
//   전날 넣은 `RelationMapCard` 가 홈에서 **명식 전부를 다시 계산**하고 있었다.
//   daniel 은 명식이 61개 — `buildSajuChart`×61 만 **163ms**(맥 기준, 기기는 3~5배).
//   그게 홈 첫 화면을 붙들었다.
//   ⚠️`buildRelationMap` 자체는 3ms 로 쌌다 — 비싼 건 **명식을 다시 세우는 것**이었다.
//     "무거워 보이는 쪽"을 찍지 말고 재 볼 것([[engine-lazy-months-perf]] 의 첫 가설도 틀렸다).
//
// ■ 규칙 — 홈 카드가 **명식 목록 전체**를 건드리면 첫 페인트 뒤로 미룬다
//   홈은 앱의 첫인상이다. 카드 하나는 조금 늦게 떠도 되지만, 홈이 늦게 뜨면 앱이 느린 앱이 된다.
//   ⇒ `listCharts()` 를 쓰는 홈 카드는 `InteractionManager.runAfterInteractions` 안에서 계산해야 한다.
//
//   ⚠️판정은 **이름이 아니라 짝**으로 한다 — `listCharts` 를 쓰면서 `InteractionManager` 가 없을 때만 운다.
//     한 명만 계산하는 카드(TodayRelationCard 는 목록만 읽고 선택된 1명만 계산)는 통과해야 하므로
//     `computeChart` 가 **반복문 안**에 있는지까지 본다.
//
// 실행: npm run check:homecost
// ═══════════════════════════════════════════════════════════════════════════
import fs from 'fs';
import path from 'path';

const DIR = 'app/src/components';
const INDEX = 'app/src/app/(app)/index.tsx';

const src = (f: string) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '');
/** 주석을 걷어낸다 — 주석 속 단어가 통과시키는 사고를 막는다([[harness-judge-expression-not-name]]). */
const strip = (c: string) => c.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n');

// 홈이 실제로 그리는 컴포넌트만 대상 — index.tsx 가 부르는 것들
const home = strip(src(INDEX));
const rendered = new Set([...home.matchAll(/<([A-Z][A-Za-z]+)\s*(?:reloadKey|\/|\s)/g)].map((m) => m[1]));

let bad = 0, ok = 0;
console.log('\n🏠 홈 카드가 첫 페인트를 막지 않는가\n');

if (!fs.existsSync(DIR) || !rendered.size) {
  console.log('   ⏭  홈 렌더 목록을 못 읽었습니다(경로 변경?)');
  process.exit(0);
}

for (const name of [...rendered].sort()) {
  const p = path.join(DIR, `${name}.tsx`);
  const code = strip(src(p));
  if (!code) continue;
  if (!/listCharts\s*\(/.test(code)) continue;           // 명식 목록을 안 건드리면 대상 아님

  // 목록 전체를 도는가 — map/for 안에서 computeChart 를 부르는 형태
  // ⚠️`[^)]*` 로 인자를 건너뛰려 했더니 `.map((c) => …)` 의 **닫는 괄호에서 막혀** 못 잡았다
  //   (2026-08-14 음성 테스트: 실제로 전량 계산하는 카드를 '안 함'으로 통과시켰다).
  //   ⇒ `.map(`·`for(` 부터 `computeChart(` 까지 **거리로만** 본다. 넓게 잡되 300자로 제한한다.
  const loops = /(\.map\(|\.forEach\(|for\s*\()[\s\S]{0,300}?computeChart\s*\(/.test(code);
  if (!loops) { ok++; console.log(`   ✅ ${name} — 목록은 읽되 전량 계산은 안 함`); continue; }

  if (/InteractionManager\.runAfterInteractions/.test(code)) {
    ok++; console.log(`   ✅ ${name} — 전량 계산하지만 첫 페인트 뒤로 미룸`);
  } else {
    bad++;
    console.log(`   ❌ ${name} — **명식 전부를 첫 페인트에서 계산합니다**`);
    console.log(`      명식이 60개면 명식 재구성만 150ms 를 넘고(기기는 3~5배), 그동안 홈이 안 뜹니다.`);
    console.log(`      ⇒ InteractionManager.runAfterInteractions(() => { … }) 안으로 옮기세요.`);
    console.log(`         결과를 모듈 캐시에 담아 두면 재방문은 0ms 입니다.`);
  }
}

console.log(`\n   홈 카드 중 명식 목록 사용 ${ok + bad}개 · 정상 ${ok} · 첫 페인트 차단 ${bad}`);
console.log(bad ? '\n❌ check:homecost 실패\n' : '\n✅ check:homecost 통과 — 홈이 무거운 계산에 붙들리지 않습니다\n');
if (bad) process.exitCode = 1;
