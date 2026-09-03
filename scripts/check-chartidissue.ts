// scripts/check-chartidissue.ts — 「살 수 있는데도 감추지 마라」 불변식
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-09-03: *"신규 명식 등록하니깐 이번에 반영한 합충 보기가 안뜨네"*
//                  *"신규 등록하면 기존 페이지로 제대로 연동이 안되는거 같은데"*
//
// ■ 증상 둘이 **한 원인**이었다 — 갓 등록한 명식엔 `serverChartId` 가 없다.
//   유료 기능(충/합)은 (명식 × 기능) 단위라 **서버 id 가 열쇠**인데, 그게 없으니
//   만세력이 버튼을 아예 안 그렸다. 살 수 없는 버튼을 감춘 건 맞지만
//   **살 수 있게 만들 수 있는데도** 감춘 것이 틀렸다.
//
// ■ 지키는 것 넷
//   C1 서버 id 가 없으면 **발급한다**(`ensureServerChartIdForSaved`)
//   C2 ★발급은 «지금 보는 그 명식» 으로 — «대표» 로 대신 찾으면 **남의 명식에 결제를 건다**
//   C3 새로 등록하면(`reason === 'register'`) **그 명식으로 따라간다**
//   C4 그래도 못 사는 자리(친구 명식·미로그인)에는 여전히 안 그린다 — 눌러도 안 되는 버튼 금지
//
// ★판정은 «이름» 이 아니라 «무엇을 부르는가» 로 한다. 주석은 지우고 본다
//   (이 프로젝트에서 주석 속 낱말이 판정을 뒤집은 적이 여러 번 있다).
// ═══════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const SELFTEST = process.argv.includes('--selftest');
const CHARTS = path.join(ROOT, 'app/src/app/(app)/charts.tsx');
const MYEONG = path.join(ROOT, 'app/src/screens/MyeongsikScreen.tsx');

let bad = 0;
const fail = (tag: string, m: string) => { bad++; console.log(`  [${tag}] ${m}`); };

/** 주석을 **길이 보존**하며 지운다(줄 번호가 그대로 통하도록). */
function stripComments(s: string): string {
  const blank = (m: string) => m.replace(/[^\n]/g, ' ');
  return s.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/(^|[^:])(\/\/[^\n]*)/g, (_m, a, c) => a + blank(c));
}

function run(chartsSrc: string, myeongSrc: string) {
  const charts = stripComments(chartsSrc);
  const myeong = stripComments(myeongSrc);

  // ── C1 서버 id 가 없으면 발급한다 ──────────────────────────────────────────
  const issue = /ensureServerChartIdForSaved\s*\(/.exec(charts);
  if (!issue) {
    fail('C1', '★만세력 화면이 서버 명식 id 를 **발급하지 않는다** — 갓 등록한 명식에서 유료 기능이 영영 안 열린다');
  }

  // ── C2 발급 대상은 «지금 보는 그것» ────────────────────────────────────────
  if (issue) {
    const arg = charts.slice(issue.index + issue[0].length, issue.index + issue[0].length + 60);
    const target = arg.match(/^\s*(\w+)/)?.[1] ?? '';
    // ★«대표» 에서 끌어온 이름으로 발급하면 골라 본 명식과 어긋난다 = 남의 명식에 결제
    if (/^(rep|representative|me|myChart)/i.test(target)) {
      fail('C2', `★발급 대상이 \`${target}\` 다 — «대표» 로 발급하면 **골라 본 명식과 다른 명식에 결제**가 걸린다`);
    } else if (!target) {
      fail('C2', '발급 대상을 못 읽었다 — 인자를 변수 하나로 넘겨라(하네스가 대상을 확인할 수 있게)');
    }
  }

  // ── C3 새로 등록하면 그 명식으로 따라간다 ─────────────────────────────────
  const sub = /subscribeRepChange\s*\(\s*\(([^)]*)\)/.exec(charts);
  if (!sub) fail('C3', '`subscribeRepChange` 구독이 없다 — 등록·수정이 이 화면에 반영되지 않는다');
  else if (!sub[1].trim()) {
    fail('C3', "★구독이 **사유를 안 받는다** — 등록('register')과 고르기('user')를 구분해야 새 명식으로 따라간다");
  } else if (!/['"]register['"]/.test(charts)) {
    fail('C3', "★`'register'` 를 다루지 않는다 — 새로 등록해도 **옛 명식이 화면에 남는다**(Boss 2026-09-03)");
  }

  // ── C4 못 사는 자리에는 여전히 안 그린다 ──────────────────────────────────
  const gate = /const\s+swapSellable\s*=\s*([^;]+);/.exec(myeong);
  if (!gate) fail('C4', '`swapSellable` 게이트가 사라졌다 — 친구 명식·미저장 명식에 **눌러도 안 되는 버튼**이 생긴다');
  else {
    if (!/friendSaju/.test(gate[1])) fail('C4', '★친구 명식 제외가 빠졌다 — 남의 명식에 유료 버튼을 그린다');
    if (!/chartId/.test(gate[1])) fail('C4', '★서버 id 확인이 빠졌다 — id 없이 누르면 결제가 성립하지 않는다');
  }
}

if (SELFTEST) {
  // ★음성 테스트 — 규칙이 실제로 «잡는지» 본다
  const C = fs.readFileSync(CHARTS, 'utf8');
  const M = fs.readFileSync(MYEONG, 'utf8');
  const probe = (label: string, c: string, m: string, tag: string) => {
    const before = bad; const log = console.log; console.log = () => {};
    run(c, m);
    console.log = log;
    const caught = bad > before;
    if (!caught) console.log(`  ❌ ${label} — ${tag} 가 안 잡혔다`);
    return caught;
  };
  const cases = [
    probe('발급을 지우면', C.replace(/ensureServerChartIdForSaved/g, 'noop'), M, 'C1'),
    probe('대표로 발급하면', C.replace(/ensureServerChartIdForSaved\(shownChart/, 'ensureServerChartIdForSaved(repChart'), M, 'C2'),
    probe("'register' 를 지우면", C.replace(/'register'/g, "'other'"), M, 'C3'),
    probe('게이트를 지우면', C, M.replace(/const swapSellable = [^;]+;/, 'const swapSellable = true;'), 'C4'),
  ];
  bad = 0;
  const ok = cases.filter(Boolean).length;
  console.log(ok === cases.length ? `✅ selftest ${ok}/${cases.length}` : `❌ selftest ${ok}/${cases.length}`);
  process.exit(ok === cases.length ? 0 : 1);
}

run(fs.readFileSync(CHARTS, 'utf8'), fs.readFileSync(MYEONG, 'utf8'));
if (bad) { console.log(`\n❌ check:chartidissue — ${bad}건`); process.exit(1); }
console.log('✅ check:chartidissue — 서버 id 없으면 발급 · 발급은 보는 명식으로 · 등록하면 따라간다 · 못 사는 자리엔 안 그린다');
