// scripts/check-ragwired.ts — **명리는 우리 RAG·엔진을 탄다** (모델이 스스로 세지 않는다)
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-08-26 · 실물 사고 두 개가 같은 뿌리였다.
//
//  ① 회원: *"1994 03 16 유시"* → 상담가: **"경오일주(庚午日)"**
//     엔진으로 계산하면 **신축(辛丑)** 이다(甲戌·丁卯·辛丑·丁酉). 모델이 만세력을 **암산**해서 틀렸다.
//     ★절기·진태양시·야자시가 걸려 있어 모델은 **그럴듯하게 틀린다.**
//       틀린 여덟 글자 위에 쌓은 통변은 **전부 거짓**이다. CLAUDE.md 절대규칙 1 위반.
//
//  ② Boss: *"무조껀 우리가만든 RAG 모델을 타야한다니깐 명리 검증은"*
//     골든 검색(`retrieveGolden`)이 `interpret` 안에만 있어서 **대화는 골든을 전혀 안 탔다.**
//     = 상담가가 명리를 **자기 지식으로** 말하고 있었다(CLAUDE.md §0 «해자가 비면 wrapper»).
//
// ⇒ 이 하네스는 **둘을 같이** 지킨다. 하나만 지키면:
//   · 계산만 막으면 → 골든 없이 «해석» 은 여전히 자기 지식이다
//   · RAG 만 붙이면 → 여전히 여덟 글자를 지어낸다
//
// ★음성 테스트: `npx tsx scripts/check-ragwired.ts --selftest`
// ═══════════════════════════════════════════════════════════════════════════
import fs from 'fs';

const TALK = 'supabase/functions/talk/index.ts';
const INTERPRET = 'supabase/functions/interpret/index.ts';
const SHARED = 'supabase/functions/_shared/goldenRag.ts';

export type Fail = { rule: string; msg: string };
export function codeOnly(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
}
const read = (p: string): string | null => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null);

/** R1·R4 — 대화가 RAG 를 **타는가**, 그리고 **어디에** 싣는가. */
export function judgeTalk(src: string): Fail[] {
  const out: Fail[] = [];
  const code = codeOnly(src);

  // R1. 검색을 실제로 부르는가
  if (!/retrieveGolden\s*\(/.test(code)) {
    out.push({ rule: 'R1', msg: '★대화가 골든 RAG 를 **안 탄다** — 상담가가 명리를 자기 지식으로 말하게 된다' });
  }
  // R4. ⚠️캐시 접두사에 넣으면 매 턴 캐시가 깨진다(질문마다 검색 결과가 다르다)
  const parts = code.split(/\{\s*type:\s*'text'/).slice(1);
  const cached = parts.filter((b) => /cache_control/.test(b));
  const fresh = parts.filter((b) => !/cache_control/.test(b));
  if (cached.some((b) => /goldenGround/.test(b))) {
    out.push({ rule: 'R4', msg: '★골든 grounding 이 **캐시 접두사 안**에 있다 — 질문마다 달라지므로 매 턴 캐시가 깨진다(청구서로만 알게 된다)' });
  }
  if (!fresh.some((b) => /goldenGround/.test(b))) {
    out.push({ rule: 'R4', msg: '골든 grounding 이 «턴마다 달라지는» 블록에 없다 — 검색만 하고 안 쓴다' });
  }
  // R6. ★만세력을 모델이 직접 세지 못하게 막았는가
  if (!/여덟 글자\(만세력\)를 네가 계산하지 마라/.test(src)) {
    out.push({ rule: 'R6', msg: '★모델이 만세력을 **직접 계산**하는 것을 막지 않는다 — 실제로 «경오일주»(정답 신축)를 지어냈다' });
  }
  if (!/명식을 등록해 주시면/.test(src)) {
    out.push({ rule: 'R6', msg: '차트가 없을 때 **어디로 보낼지**가 없다 — 모델이 결국 스스로 센다' });
  }
  return out;
}

/** R2·R3 — 정의가 **한 곳에만** 있는가(사본 금지). */
export function judgeSingleSource(shared: string, interpret: string, talk: string): Fail[] {
  const out: Fail[] = [];
  if (!/export async function retrieveGolden/.test(shared)) {
    out.push({ rule: 'R3', msg: `${SHARED} 에 정의가 없다 — 공용 원본이 사라졌다` });
  }
  for (const [name, src] of [['interpret', interpret], ['talk', talk]] as const) {
    if (/function retrieveGolden/.test(codeOnly(src))) {
      out.push({ rule: 'R3', msg: `★${name} 이 retrieveGolden 을 **자기 안에 다시 정의**했다 — 사본은 반드시 갈린다(오늘 그것 때문에 대화가 RAG 를 못 탔다)` });
    }
    if (!/goldenRag\.ts/.test(src)) {
      out.push({ rule: 'R2', msg: `${name} 이 공용 RAG 모듈을 가져오지 않는다` });
    }
  }
  // R5. 골든은 **앵커가 아니라 stance 기준**이다(CLAUDE.md §1-4)
  if (!/베끼지 마라/.test(shared)) {
    out.push({ rule: 'R5', msg: '★골든 블록에 «베끼지 마라» 가 없다 — 남의 사주를 이 사람 것처럼 말하게 된다(골든=stance 기준, 앵커 아님)' });
  }
  return out;
}

if (process.argv.includes('--selftest')) {
  const talk = read(TALK) ?? '', inter = read(INTERPRET) ?? '', sh = read(SHARED) ?? '';
  const t = (l: string, v: boolean) => { console.log(`  ${v ? '✅' : '❌'} ${l}`); return v; };
  const has = (fs: Fail[], r: string) => fs.some((f) => f.rule === r);
  const r = [
    t('현재 배선은 통과', judgeTalk(talk).length === 0 && judgeSingleSource(sh, inter, talk).length === 0),
    t('대화에서 검색을 빼면 **잡는다**', has(judgeTalk(talk.replace(/retrieveGolden\s*\(/g, 'noop(')), 'R1')),
    t('grounding 을 캐시 블록으로 옮기면 **잡는다**',
      has(judgeTalk(talk.replace('${histBlock}${goldenGround}', '${histBlock}').replace('${chartBlock}', '${chartBlock}${goldenGround}')), 'R4')),
    t('만세력 금지를 지우면 **잡는다**', has(judgeTalk(talk.replace(/여덟 글자\(만세력\)를 네가 계산하지 마라/g, '어쩌고')), 'R6')),
    t('사본을 다시 만들면 **잡는다**',
      has(judgeSingleSource(sh, inter, talk + '\nasync function retrieveGolden(){}\n'), 'R3')),
    t('«베끼지 마라» 를 지우면 **잡는다**', has(judgeSingleSource(sh.replace(/베끼지 마라/g, '어쩌고'), inter, talk), 'R5')),
  ];
  const ok = r.every(Boolean);
  console.log(ok ? '✅ selftest 통과' : '❌ selftest 실패');
  process.exit(ok ? 0 : 1);
}

const talk = read(TALK), inter = read(INTERPRET), sh = read(SHARED);
const fails: Fail[] = [];
if (!talk || !inter || !sh) fails.push({ rule: 'R0', msg: 'Edge 파일을 못 찾는다 — 경로가 바뀌었으면 이 하네스를 고칠 것' });
else { fails.push(...judgeTalk(talk)); fails.push(...judgeSingleSource(sh, inter, talk)); }

if (!fails.length) {
  console.log('✅ check:ragwired — 대화·풀이 둘 다 공용 골든 RAG 를 탄다 · 만세력은 모델이 안 센다 · 정의는 한 곳뿐');
  process.exit(0);
}
console.error(`❌ check:ragwired — ${fails.length}건\n`);
for (const f of fails) console.error(`  [${f.rule}] ${f.msg}`);
process.exit(1);
