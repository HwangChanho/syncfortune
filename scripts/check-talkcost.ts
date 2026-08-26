#!/usr/bin/env tsx
/**
 * check:talkcost — 상담사 톡의 **비용 장치**가 제자리에 있는가.
 * ═══════════════════════════════════════════════════════════════════════════
 * 왜 생겼나
 *   `check:talkfree` 는 "가상이 LLM 을 안 부르는가"를 지킨다. 이건 그 다음 문제 —
 *   **실제 상담사가 부를 때 얼마나 드는가**를 지킨다.
 *   이 경로의 원가는 코드 구조가 정한다. 그리고 **어느 장치가 빠져도 화면은 똑같이 동작한다** —
 *   답은 잘 나오고 사용자도 만족하는데 청구서만 5배가 된다. 눈으로는 절대 못 잡는다.
 *
 * 실측 근거 — ★**2026-08-20 프로덕션 실호출 2턴**(추정 아님. `api_usage` kind='talk')
 *   턴1: in 78 · out 197 · cache_write 6,996 → **₩23.08**
 *   턴2: in 317 · out 180 · cache_read 6,996 → **₩2.94**   ⇒ 10턴 ₩49.5
 *   C1 규칙블록 미탑재  : 실으면 프리픽스가 6.7배(46,876tok) → 10턴 ₩49.5 → ₩260대
 *   C2 캐시 breakpoint  : 없으면 매 턴 전액 입력(2턴째 ₩2.94 → ₩12.6)
 *   C3 1시간 TTL        : 5분이면 흩어진 10턴 ₩152.7 (1h 는 ₩49.5 — **68% 절감**)
 *   C4 max_tokens 상한  : ★무게중심이 턴마다 다르다 — 첫 턴은 캐시쓰기 93%,
 *                         이후 턴은 **출력 47%**. 길게 대화할수록 이 값이 원가를 정한다.
 *   C5 kind 서버검증    : 가상이 새어들면 원가 0 설계가 통째로 무너진다
 *   C6 하루 한도        : 한도가 없으면 상한도 없다
 *   C7 1h 캐시쓰기 단가 : `interpret` 의 4칸 표로 로깅하면 원가를 60% 적게 적는다
 *
 * 사용: npm run check:talkcost · 자가테스트: npx tsx scripts/check-talkcost.ts --selftest
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const P_FN = 'supabase/functions/talk/index.ts';
const P_BP = 'supabase/functions/_shared/buildUserPrompt.ts';

type Fail = { rule: string; msg: string };
/**
 * 주석을 걷어낸 소스 — '주석에 그렇게 적혀 있다'는 근거가 아니다.
 *
 * ⚠️★줄 **끝** 주석도 지운다. 처음엔 줄 맨앞 슬래시둘만(줄 전체 주석) 지웠는데,
 * (그 정규식을 여기 그대로 적으면 별+슬래시가 이 주석 블록을 닫아 버려서 풀어 썼다)
 *   실제 파일 역테스트에서 이게 하네스를 통째로 무력화하는 것이 잡혔다 —
 *   `import … // ★cache_control.ttl:'1h' 가 0.100 부터 …` 라고 **설명해 둔 주석**이 코드로 읽혀서,
 *   진짜 코드를 5m 으로 바꿔도 검사가 통과했다. 자가테스트는 멀쩡히 초록불이었다.
 *   ⇒ 하네스를 자기가 지키는 파일의 주석이 속일 수 있다. 반드시 **역테스트**로 확인할 것.
 * ⚠️`https://` 의 `//` 는 남긴다(`(?<!:)`) — 안 그러면 import 줄이 잘려 엉뚱한 판정이 된다.
 */
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(?<!:)\/\/.*$/gm, '');

/**
 * 톡 Edge 의 비용 장치를 검사한다.
 * @param fn `supabase/functions/talk/index.ts` 원문
 * @param bp `_shared/buildUserPrompt.ts` 원문
 */
export function audit(fn: string, bp: string): Fail[] {
  const out: Fail[] = [];
  const f = code(fn);

  // C1 — 규칙 블록(32,780자)을 대화에 싣지 않는다. 가장 큰 항목이다
  if (/\bMYEONGRI_RULES\b/.test(f)) {
    out.push({ rule: 'C1', msg: `${P_FN} 이 MYEONGRI_RULES 를 싣는다 — 10턴 원가가 ₩52 → ₩261(5배)이 된다. 깊은 판정은 interpret 로 보내라(거기선 캐시가 영구다)` });
  }

  // C2 — 캐시 breakpoint 가 있어야 한다(없으면 매 턴 전액 입력)
  const bps = (f.match(/cache_control/g) ?? []).length;
  if (bps < 2) out.push({ rule: 'C2', msg: `${P_FN} 의 cache_control 이 ${bps}개 — 공통·차트 최소 2개가 필요하다(없으면 턴당 ₩4.2 → ₩8.8)` });

  // C3 — 1시간 TTL(흩어진 사용이 실제 사용 패턴이다)
  if (!/ttl:\s*'1h'/.test(f)) {
    out.push({ rule: 'C3', msg: `${P_FN} 에 ttl:'1h' 가 없다 — 5분 캐시는 턴 간격이 벌어지면 매번 만료된다(흩어진 10턴 ₩52 → ₩103)` });
  }

  // C4 — 출력 상한이 **서버 값**이어야 한다(하드코딩하면 조일 손잡이가 없다)
  //   ⚠️2026-08-26 — 종전엔 `max_tokens: c.max_out_tok` 이라는 **문자열**을 찾았다.
  //     그런데 상한이 «사실 확인 / 그림 요구» 두 갈래가 되면서 `max_tokens: maxOut` 이 됐고,
  //     `maxOut` 은 **DB 두 컬럼에서 파생**되는데도 이 검사가 울었다.
  //     ★[[harness-judge-expression-not-name]] — 하네스는 **이름이 아니라 표현식**으로 판정해야 한다.
  //     ★[[harness-can-enforce-wrong-rule]] — 안 그러면 초록불이 **낡은 판단을 강제**한다.
  //   ⇒ 지금은 «그 값이 DB 컬럼에서 나오는가» 를 본다: `max_tokens:` 에 쓰인 이름을 꺼내
  //     그 이름이 `c.max_out_tok` / `c.deep_max_out_tok` 로부터 만들어지는지 확인한다.
  {
    const m = /max_tokens:\s*([A-Za-z_$][\w$.]*)/.exec(f);
    const name = m?.[1] ?? '';
    const fromDb = name === 'c.max_out_tok' || name === 'c.deep_max_out_tok'
      // 파생값이면 그 이름을 **정의하는 줄**이 DB 컬럼을 참조해야 한다
      || new RegExp(`(?:const|let)\\s+${name}\\s*=[\\s\\S]{0,300}?c\\.(?:deep_)?max_out_tok`).test(f);
    if (!name || !fromDb) {
      out.push({ rule: 'C4', msg: `${P_FN} 의 max_tokens(${name || '없음'})가 consultants.max_out_tok / deep_max_out_tok 에서 나오지 않는다 — 출력이 턴 원가의 76%다. 배포 없이 조일 수 있어야 한다` });
    }
  }

  // C5 — 가상 상담사가 이 경로로 새어들면 안 된다(서버가 거절)
  if (!/c\.kind\s*!==\s*'live'/.test(f)) {
    out.push({ rule: 'C5', msg: `${P_FN} 이 kind!=='live' 를 거절하지 않는다 — 가상이 새어들면 원가 0 설계가 무너지는데 화면은 똑같이 보인다` });
  }

  // C6 — 하루 한도(무료 한도 ≠ 절대 상한. 둘 다 있어야 한다)
  if (!/c\.daily_cap/.test(f)) out.push({ rule: 'C6', msg: `${P_FN} 에 daily_cap 상한이 없다 — 한도가 없으면 원가 천장도 없다` });
  if (!/c\.free_daily/.test(f)) out.push({ rule: 'C6', msg: `${P_FN} 에 free_daily 가 없다 — 무료 구간을 못 가른다` });

  // C7 — 1시간 캐시쓰기 단가를 따로 곱해야 한다(안 하면 로그가 원가를 60% 적게 적는다)
  if (!/ephemeral_1h_input_tokens/.test(f)) {
    out.push({ rule: 'C7', msg: `${P_FN} 이 ephemeral_1h_input_tokens 를 안 본다 — 1h 쓰기는 2.0x인데 5분(1.25x)으로 적히면 비용을 재려고 만든 로그가 착시가 된다` });
  }

  // C8 — 차트 블록은 질문과 **분리**돼 있어야 캐시가 맞는다
  if (!/export function buildTalkChartBlock/.test(code(bp))) {
    out.push({ rule: 'C8', msg: `${P_BP} 에 buildTalkChartBlock 이 없다 — 차트가 질문과 붙어 있으면 접두사가 매 턴 달라져 캐시가 한 번도 안 맞는다` });
  }
  // C9 — 검수 전 말투 초안이 서비스로 나가면 안 된다(비용이 아니라 **명리 stance** 문제다)
  if (/consultant_examples/.test(f) && !/eq\('author',\s*'boss'\)/.test(f)) {
    out.push({ rule: 'C9', msg: `${P_FN} 이 consultant_examples 를 author='boss' 로 거르지 않는다 — 검수 전 초안(draft)이 조용히 사용자에게 나간다(CLAUDE.md §3)` });
  }

  if (/buildCoachPrompt\s*\(/.test(f)) {
    out.push({ rule: 'C8', msg: `${P_FN} 이 buildCoachPrompt(질문 포함)를 쓴다 — 캐시가 죽는다. buildTalkChartBlock 을 써라` });
  }
  return out;
}

// ── 자가테스트 ─────────────────────────────────────────────
if (process.argv.includes('--selftest')) {
  const ok = `
    const system = [{ type:'text', text: TALK_COMMON, cache_control: { type:'ephemeral', ttl: '1h' } }];
    const b = buildTalkChartBlock(chartRow, owned);
    content: [{ type:'text', text: chartBlock, cache_control: { type:'ephemeral', ttl:'1h' } }]
    if (c.kind !== 'live') return json({ error:'virtual_is_offline' }, 400);
    if (used >= c.daily_cap) return json({ capped:true });
    const overFree = used >= c.free_daily;
    max_tokens: c.max_out_tok,
    const w1h = c.ephemeral_1h_input_tokens ?? 0;
  `;
  const bpOk = `export function buildTalkChartBlock(chart, owned) { return ''; }`;
  const cases: Array<[string, number]> = [
    ['정상', audit(ok, bpOk).length],
    ['규칙블록 탑재', audit(ok + `\ntext: MYEONGRI_RULES,`, bpOk).length],
    // ★실제 회귀는 cache_control **객체 통째로** 사라지는 모양이다(이름만 바꾸면 ttl 문자열이 남아
    //   C3 가 안 걸린다 — 자가테스트가 이걸 먼저 잡아 줬다). 픽스처를 실제 모양으로 둔다.
    ['캐시 breakpoint 없음', audit(ok.replace(/,?\s*cache_control: \{[^}]*\}/g, ''), bpOk).length],   // C2 + C3
    ['5분 TTL', audit(ok.replace(/ttl: ?'1h'/g, "ttl:'5m'"), bpOk).length],
    ['출력 하드코딩', audit(ok.replace('max_tokens: c.max_out_tok', 'max_tokens: 4000'), bpOk).length],
    ['kind 검증 없음', audit(ok.replace("c.kind !== 'live'", 'false'), bpOk).length],
    ['한도 없음', audit(ok.replace('c.daily_cap', 'X').replace('c.free_daily', 'Y'), bpOk).length],
    ['1h 단가 미분리', audit(ok.replace('ephemeral_1h_input_tokens', 'cache_creation_input_tokens'), bpOk).length],
    ['차트 블록 미분리', audit(ok, `export function other(){}`).length],
    ['코치 프롬프트 사용', audit(ok + `\nbuildCoachPrompt(row, q)`, bpOk).length],
    // ★주석에만 적힌 경우는 오탐이면 안 된다
    ['주석 속 MYEONGRI_RULES(정상)', audit(`// MYEONGRI_RULES 는 싣지 않는다\n` + ok, bpOk).length],
    // ★★실제 역테스트가 잡아낸 구멍 — **줄 끝** 주석이 코드로 읽혀 검사를 통과시켰다.
    //   ttl 을 5m 으로 바꿨는데 주석에 '1h' 가 적혀 있어 C3 가 안 걸렸다. 여기서 다시 못 열리게 잠근다.
    ['검수 전 초안 미필터', audit(ok + `\nfrom('consultant_examples').select('x')`, bpOk).length],
    ['검수 필터 있음(정상)', audit(ok + `\nfrom('consultant_examples').eq('author', 'boss')`, bpOk).length],
    ['줄끝 주석이 ttl 을 가장함', audit(
      ok.replace(/ttl: ?'1h'/g, "ttl:'5m'") + `\nimport X from 'https://esm.sh/x';   // cache_control.ttl:'1h' 설명`,
      bpOk).length],
  ];
  const want = [0, 1, 2, 1, 1, 1, 2, 1, 1, 1, 0, 1, 0, 1];
  let bad = 0;
  cases.forEach(([n, got], i) => {
    const okc = got === want[i];
    console.log(`  ${okc ? '✓' : '❌'} ${n} → ${got}건 (기대 ${want[i]})`);
    if (!okc) bad++;
  });
  console.log(bad ? `\n❌ 자가테스트 ${bad}건 실패` : `\n✅ check:talkcost 자가테스트 통과 (${cases.length}케이스)`);
  process.exit(bad ? 1 : 0);
}

let fn = '';
try { fn = readFileSync(join(ROOT, P_FN), 'utf8'); }
catch { console.log('⚠️  supabase/functions/talk 없음 — 스킵(이 저장소에서 Edge 는 gitignore 대상)'); process.exit(0); }
const fails = audit(fn, readFileSync(join(ROOT, P_BP), 'utf8'));
if (fails.length) {
  console.error(`❌ check:talkcost — ${fails.length}건 · 대화 원가가 조용히 뛴다(화면상 차이 없음)`);
  for (const f of fails) console.error(`  [${f.rule}] ${f.msg}`);
  process.exit(1);
}
console.log('✅ check:talkcost — 비용·검수 장치 9종 제자리(규칙블록 미탑재·캐시 1h·출력상한·kind검증·한도·단가분리·초안필터)');
