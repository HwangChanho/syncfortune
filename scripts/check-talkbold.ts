// scripts/check-talkbold.ts — **`**강조**` 가 별표째 보이지 않는지** 지킨다
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-08-26: *"대화에서 강조를 ** 이걸로하는데 이걸로 그대로나오는데 이게 Bold 처리가 돼야지"*
//
// ■ 원인 둘
//   ① 말풍선이 파서를 **한 번도 안 거쳤다** — `<Text>{m.body}</Text>` 한 줄
//   ② ★볼드 유틸(`emph`)은 **이미 있었는데** 홑별표 `*…*` 만, 그것도 **한글로 시작할 때만** 잡았다.
//      LLM 은 **겹별표**를 쓰고 한자·괄호도 강조한다(`**경오일주(庚午日)**`) ⇒ 하나도 안 잡힌다.
//      «유틸이 있으니 갖다 쓰면 된다» 로 끝냈으면 **여전히 별표가 보였을** 자리다.
//
// ■ ★왜 새로 만들지 않았나
//   화면마다 파서를 두면 **같은 글이 화면마다 다르게** 보인다([[duplicate-ui-single-source]]).
//   대신 기존 유틸에 겹별표를 **더했다**. 홑별표 규칙(한글 시작)은 **그대로 뒀다** —
//   그건 온디바이스 콘텐츠용이고, 그 제약이 각주·불릿·곱셈 오변환을 막고 있다.
//
// ■ 검사 (소스의 정규식을 **꺼내 실제로 돌린다** — 사본을 만들지 않는다)
//   B1 말풍선이 `emph()` 를 쓴다(원문 그대로 그리지 않는다)
//   B2 겹별표가 잡히고 **별표가 남지 않는다**
//   B3 ★기존 홑별표가 여전히 잡힌다(회귀)
//   B4 ★각주 별표(`* 안내…`)를 강조로 **오변환하지 않는다**
//
// 실행: npm run check:talkbold
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs';

const RICH = 'app/src/lib/ui/richText.tsx';
const THREAD = 'app/src/components/talk/TalkThread.tsx';

/** 소스의 `EMPH_RE` 리터럴을 꺼낸다. */
export function emphRe(src: string): RegExp | null {
  const m = /const EMPH_RE = \/((?:[^/\\\n]|\\.)+)\/([gimsuy]*)/.exec(src);
  return m ? new RegExp(m[1], m[2]) : null;
}

/** `richText.tsx` 의 splitEmphasis 와 **같은 방식**으로 조각낸다(캡처 둘 다 받는다). */
export function segs(input: string, re: RegExp): Array<{ bold: boolean; text: string }> {
  const out: Array<{ bold: boolean; text: string }> = [];
  let last = 0, m: RegExpExecArray | null;
  re.lastIndex = 0;
  while ((m = re.exec(input)) !== null) {
    if (m.index > last) out.push({ bold: false, text: input.slice(last, m.index) });
    out.push({ bold: true, text: m[1] ?? m[2] ?? '' });
    last = m.index + m[0].length;
    if (m[0].length === 0) re.lastIndex++;
  }
  if (last < input.length) out.push({ bold: false, text: input.slice(last) });
  return out;
}

const isMain = process.argv[1]?.includes('check-talkbold');
if (isMain) {
  console.log('\n**  대화에서 별표가 그대로 보이는가\n');
  let bad = 0;
  const say = (ok: boolean, name: string, note = '') => { if (!ok) bad++; console.log(`   ${ok ? '✅' : '❌'} ${name.padEnd(44)} ${note}`); };

  const thread = readFileSync(THREAD, 'utf8');
  const rich = readFileSync(RICH, 'utf8');

  // B1 — 말풍선이 파서를 거치는가
  const raw = /<Text style=\{m\.role === 'user' \? styles\.mineTx : styles\.themTx\}>\{m\.body\}<\/Text>/.test(thread);
  const wired = /emph\(m\.body/.test(thread) && /from '.*richText'/.test(thread);
  say(wired && !raw, 'B1 말풍선이 `emph()` 를 거친다',
    raw ? '원문을 그대로 그립니다 — 별표가 보입니다' : wired ? '' : 'emph 를 안 씁니다');

  const RE = emphRe(rich);
  say(!!RE, 'B1b `EMPH_RE` 를 소스에서 꺼냈다', RE ? String(RE) : '못 찾음');
  if (!RE) { console.log('\n❌ 정규식을 못 읽어 나머지를 검사할 수 없습니다.\n'); process.exit(1); }

  const render = (t: string) => segs(t, RE).map((s) => (s.bold ? `«${s.text}»` : s.text)).join('');
  const anyBold = (t: string) => segs(t, RE).some((s) => s.bold);

  // B2 — 겹별표
  const dbl = ['너는 **경오일주**야', '**경오일주(庚午日)** 입니다', '**하나** 그리고 **둘**'];
  const dblBad = dbl.filter((t) => !anyBold(t) || render(t).includes('*'));
  say(dblBad.length === 0, 'B2 겹별표가 굵게 되고 별표가 안 남는다',
    dblBad.length ? `실패: ${dblBad.map((t) => `「${t}」→${render(t)}`).join(' · ')}` : `${dbl.length}개 통과`);

  // B3 — 홑별표 회귀
  const single = '*서늘하고 물이 가까운 곳* 이에요';
  say(anyBold(single) && !render(single).includes('*'), 'B3 기존 홑별표가 여전히 잡힌다(회귀)', render(single));

  // B4 — 각주 오변환 금지
  const foot = '* 경향 안내입니다';
  say(!anyBold(foot), 'B4 각주 별표를 강조로 안 바꾼다', render(foot));

  // B5 — 짝이 안 맞으면 손대지 않는다(원문 보존)
  const odd = '**열렸는데 안 닫힘';
  say(!anyBold(odd) && render(odd) === odd, 'B5 짝이 안 맞으면 원문 그대로', render(odd));

  if (bad) { console.log(`\n❌ ${bad}건 — 별표가 화면에 그대로 보이거나, 엉뚱한 것이 굵어집니다.\n`); process.exit(1); }
  console.log('\n✅ 겹별표는 굵게 · 홑별표 회귀 없음 · 각주 안전\n');
}
