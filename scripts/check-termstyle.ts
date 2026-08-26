// scripts/check-termstyle.ts — **용어는 쓰되 설명을 붙인다** (한 곳에서만 정한다)
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-08-26: *"아니 전문용어 말해도 된다니깐 대신 옆에 설명을 달아줘"*
//
// ■ 무엇이 문제였나 — **같은 금지가 서른 군데에 복제**돼 있었다
//   «명리 용어·한자를 한 글자도 쓰지 마라(괄호 병기도 금지)» 가 풀이·궁합·자미·타로·
//   오늘·직업·재물·애정… 콘텐츠마다 따로 적혀 있었다. 한 곳만 고치면 나머지 스물아홉이 이긴다.
//   ⇒ `TERM_STYLE` / `TERM_CHECK` **상수 하나**로 모았고, 이 하네스가 «다시 복제되는 것»을 막는다.
//   [[duplicate-ui-single-source]] · [[shared-block-eats-personality]]
//
// ■ ⚠️**바뀌면 안 되는 것** (용어 문제가 아니다 — 같이 풀리면 사고다)
//   · 건강: **오행 물질명·오행-장부 직역** 금지 = 의료 안전(CLAUDE.md §4)
//   · 내부 표지: R번호·P번호·'엔진'·'골든'·'룰'·'프롬프트'·'명반'·'iztro' = 우리 내부 사정
//
// ■ ★**소스가 아니라 «렌더된 문자열»** 을 본다
//   프롬프트는 템플릿 문자열이라 소스만 보면 `${TERM_STYLE}` 이 들어간 것처럼 보여도
//   실제로는 문자 그대로 남을 수 있다(템플릿 밖이면 그렇다). 그래서 **모듈을 실제로 불러** 본다.
//   [[build-artifact-verify-hermes]] 와 같은 이유.
//
// ★음성 테스트: `npx tsx scripts/check-termstyle.ts --selftest`
// ═══════════════════════════════════════════════════════════════════════════
import * as P from '../supabase/functions/_shared/prompts';

export type Fail = { rule: string; msg: string };

/** 안전·내부 규칙 줄인가 — 이건 «한 글자도 금지» 가 **맞다**. */
export function isProtectedBan(line: string): boolean {
  return /오행 물질명/.test(line)                       // 건강 안전(§4)
    || /내부 표지|R번호|명반|iztro/.test(line);          // 내부 사정
}

/** 렌더된 문자열들을 판정한다. 음성 테스트가 가짜 코퍼스로 이 함수를 부른다. */
export function judge(entries: [string, string][]): Fail[] {
  const out: Fail[] = [];
  let withRule = 0, safety = 0, internal = 0;

  for (const [k, v] of entries) {
    // T1. 치환이 문자 그대로 남지 않았는가
    if (v.includes('${')) out.push({ rule: 'T1', msg: `${k} — 치환 안 된 \${…} 가 남았다(템플릿 문자열 밖에 넣은 것이다)` });
    // T2. 옛 금지가 되살아나지 않았는가
    for (const m of v.match(/[^\n]*한 글자도[^\n]*/g) ?? []) {
      if (isProtectedBan(m)) { if (/오행 물질명/.test(m)) safety++; else internal++; continue; }
      out.push({ rule: 'T2', msg: `${k} — 옛 «한 글자도» 금지가 되살아났다: ${m.trim().slice(0, 70)}…` });
    }
    if (v.includes('써도 된다 — 대신 처음 나올 때')) withRule++;
  }

  // T3. 새 규칙이 실제로 실려 있는가 (한 군데만 남고 나머지가 빠지면 종전과 같아진다)
  if (withRule < 15) out.push({ rule: 'T3', msg: `새 규칙이 실린 프롬프트가 ${withRule}개뿐이다 — 콘텐츠 대부분에 안 실렸다는 뜻이다` });
  // T4. 안전 규칙이 살아 있는가 — ★같이 풀리면 의료 사고다
  if (safety < 1) out.push({ rule: 'T4', msg: '★건강·오행 직역 금지가 사라졌다 — 이건 용어 규칙이 아니라 **안전 규칙**이다(CLAUDE.md §4)' });
  // T5. 내부 표지 금지가 살아 있는가
  if (internal < 1) out.push({ rule: 'T5', msg: '★내부 표지(R번호·엔진·골든) 금지가 사라졌다 — 그건 용어가 아니라 우리 내부 사정이다' });

  // T6. ★★JSON 출력 지시가 **온전한가** — 이게 깨지면 풀이 생성이 통째로 실패한다
  //   프롬프트는 「[필수 점검 …] 정확히 아래 JSON 객체 하나만 출력하라:」 모양이다.
  //   대괄호가 안 닫히거나 뒤 문장이 떨어져 나가면 모델이 JSON 을 안 낸다 —
  //   그런데 **화면에는 «생성 실패» 로만 보여** 원인이 안 보인다.
  //   ⚠️2026-08-26 용어 규칙을 상수로 바꾸며 이 블록 8곳을 통째로 치환했다. 그래서 여기서 지킨다.
  let jsonOk = 0, jsonBad = 0;
  for (const [k, v] of entries) {
    const open = (v.match(/\[필수 점검/g) ?? []).length;
    const paired = [...v.matchAll(/\[필수 점검[\s\S]{0,600}?\]\s*정확히 아래 JSON/g)].length;
    jsonOk += paired;
    if (open !== paired) { jsonBad++; out.push({ rule: 'T6', msg: `${k} — 점검 블록 ${open}개 중 ${paired}개만 «정확히 아래 JSON» 으로 이어진다. 프롬프트가 어그러졌다(생성이 통째로 실패한다)` }); }
  }
  if (jsonOk < 5 && !jsonBad) out.push({ rule: 'T6', msg: `JSON 출력 지시가 ${jsonOk}곳뿐이다 — 프롬프트 모양이 바뀌었으면 이 하네스를 고칠 것` });
  return out;
}

const entries = Object.entries(P).filter(([, v]) => typeof v === 'string') as [string, string][];

if (process.argv.includes('--selftest')) {
  const good = entries;
  const t = (l: string, v: boolean) => { console.log(`  ${v ? '✅' : '❌'} ${l}`); return v; };
  const rules = (fs: Fail[]) => new Set(fs.map((f) => f.rule));
  const r = [
    t(`현재 프롬프트는 통과 (상수 ${good.length}개)`, judge(good).length === 0),
    t('치환 잔여를 넣으면 **잡는다**', rules(judge([['X', '어쩌고 ${TERM_STYLE} 저쩌고']])).has('T1')),
    t('옛 금지를 되살리면 **잡는다**', rules(judge([['X', '십신명을 한 글자도 쓰지 마라(괄호 병기도 금지).']])).has('T2')),
    t('새 규칙을 빼면 **잡는다**', rules(judge([['X', '아무 내용']])).has('T3')),
    t('건강 안전 규칙을 지우면 **잡는다**',
      rules(judge(good.map(([k, v]) => [k, v.replace(/[^\n]*오행 물질명[^\n]*/g, '')] as [string, string]))).has('T4')),
    t('JSON 출력 지시를 깨뜨리면 **잡는다**',
      rules(judge(good.map(([k, v]) => [k, v.replace(/\]\s*정확히 아래 JSON/g, '] 어쩌고')] as [string, string]))).has('T6')),
    t('내부 표지 금지를 지우면 **잡는다**',
      rules(judge(good.map(([k, v]) => [k, v.replace(/[^\n]*(내부 표지|R번호|명반|iztro)[^\n]*/g, '')] as [string, string]))).has('T5')),
  ];
  const ok = r.every(Boolean);
  console.log(ok ? '✅ selftest 통과' : '❌ selftest 실패');
  process.exit(ok ? 0 : 1);
}

const fails = judge(entries);
if (!fails.length) {
  const withRule = entries.filter(([, v]) => v.includes('써도 된다 — 대신 처음 나올 때')).length;
  console.log(`✅ check:termstyle — 프롬프트 ${entries.length}개 · 새 규칙 ${withRule}개에 실림 · 안전·내부 금지 유지 · 치환 잔여 0`);
  process.exit(0);
}
console.error(`❌ check:termstyle — ${fails.length}건\n`);
for (const f of fails) console.error(`  [${f.rule}] ${f.msg}`);
process.exit(1);
