// scripts/lib/ko-scan.ts — 화면에 **박혀 있는 한국어**를 세는 단일 출처
// ═══════════════════════════════════════════════════════════════════════════
// ★왜 따로 뺐나
//   `check:langpicker` 가 세고, `scripts/dump-ko.ts` 가 **같은 자리를 찍어** 준다.
//   식을 두 벌 적으면 «하네스는 1573 인데 목록은 1600» 같은 어긋남이 생긴다
//   ([[harness-judge-expression-not-name]] — 이름이 아니라 **식**이 정본이다).
//   ⇒ 세는 식은 여기 한 곳뿐이고, 두 곳 다 이걸 부른다.
// ═══════════════════════════════════════════════════════════════════════════

/** ★주석을 걷는다 — **줄 주석을 먼저**(블록을 먼저 걷으면 줄 주석 안의 `/*` 를 블록 시작으로 읽는다). */
export const strip = (s: string) =>
  s.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

/** 한 곳 = 파일 안의 한 자리(줄 번호 + 무슨 글자인지). */
export type Spot = { line: number; text: string; kind: 'lit' | 'jsx' };

/** ⚠️★태그 사이 맨 한국어도 센다 — 이게 오히려 더 흔하다. */
const JSX_TEXT = />[^<>{}\n]*[가-힣][^<>{}\n]*</g;
const LIT = /(['"`])((?:\\.|(?!\1)[^\\])*)\1/g;
/** ★키가 **삼항**일 수도 있다: `t(faved ? 'a' : 'b', '즐겨찾기')` — 그것도 폴백이다. */
const FALLBACK = /t\(\s*(?:'[\w.]+'|[^,()]*\?\s*'[\w.]+'\s*:\s*'[\w.]+')\s*,\s*$/;
/** ★로그는 **화면이 아니다**. */
const LOG = /console\.(log|warn|error|info|debug)\([^)]*$/;
const KO = /[가-힣]/;

/**
 * 템플릿 문자열에서 `${…}` 를 **걷어낸다**(중괄호 짝을 세어 중첩까지 처리).
 * @returns 정적인 글자만 남은 문자열
 */
function stripInterp(v: string): string {
  let out = '', i = 0;
  while (i < v.length) {
    if (v[i] === '$' && v[i + 1] === '{') {
      let depth = 1; i += 2;
      while (i < v.length && depth > 0) {
        if (v[i] === '{') depth++;
        else if (v[i] === '}') depth--;
        i++;
      }
      continue;
    }
    out += v[i++];
  }
  return out;
}

/**
 * 화면 파일 하나에서 **번역이 안 된 자리**를 찾는다.
 *
 * @param src  파일 원문(주석 포함 — 안에서 걷는다)
 * @returns    자리 목록(줄 번호는 **주석을 걷은 뒤** 기준이 아니라 원문 기준)
 *
 * ⚠️주의: 열쇠·폴백·로그·용어(`termLabel`/`T`)는 **뺀다**. 그 근거는 각 분기 주석에.
 */
export function scanFile(src: string): Spot[] {
  // ★줄 번호를 원문 기준으로 유지하려고 «지우기» 가 아니라 «공백으로 바꾸기» 를 쓴다
  //   (줄바꿈은 남긴다 ⇒ 줄 수가 안 변한다)
  const blank = (m: string) => m.replace(/[^\n]/g, ' ');
  const s = src.replace(/\/\/.*$/gm, blank).replace(/\/\*[\s\S]*?\*\//g, blank);
  const lineOf = (i: number) => s.slice(0, i).split('\n').length;
  const out: Spot[] = [];

  for (const m of s.matchAll(LIT)) {
    // ★백틱 안의 `${…}` 는 **코드**지 글자가 아니다.
    //   `` ` (${t('ms.lunar', '음력')})` `` 처럼 «이미 번역을 태운» 자리가
    //   미번역으로 잡히던 것을 막는다 — 규칙을 지킬수록 수가 오르면 검사가 거꾸로 민다.
    const body = m[1] === '`' ? stripInterp(m[2]) : m[2];
    if (!KO.test(body)) continue;
    const before = s.slice(Math.max(0, m.index! - 120), m.index!);
    if (FALLBACK.test(before)) continue;
    // ★`t('k', { n, defaultValue: '…' })` 도 **폴백**이다 — 위치 인자 형(`t('k','…')`)과 같은 뜻인데
    //   `{{n}}` 같은 자리표시자를 쓸 때만 이 모양이 된다. 한쪽만 봐주면 «자리표시자를 쓰면 미번역» 이 된다.
    if (/\bdefaultValue:\s*$/.test(before)) continue;
    if (LOG.test(before)) continue;
    // ★`termLabel('용신')` · `T('비겁')` 의 인자는 **용어 열쇠**다(Boss 규칙을 이미 타는 자리)
    if (/\b(?:termLabel|T)\(\s*$/.test(before)) continue;
    // ⚠️★**비교 대상**은 UI 가 아니다 — `timeAccuracy === '미상'` · `gender === '남'` 의 오른쪽은
    //   엔진·DB 가 쓰는 **값**이지 화면에 뜨는 글자가 아니다. 번역하면 판정이 통째로 어긋난다
    //   (열쇠 규칙과 같은 계열이고, 마찬가지로 **문법으로** 판별된다 — 특정 파일 봐주기가 아니다).
    //   ★삼항의 «결과» 는 화면이므로 그대로 센다: `x ? '미상' : y` 는 앞에 비교 연산자가 없다.
    if (/(?:===|!==|==|!=)\s*$/.test(before)) continue;
    const after = s.slice(m.index! + m[0].length, m.index! + m[0].length + 2);
    // ⚠️★**속성 접근자**는 UI 가 아니다 — `pillars['일']` 은 엔진 자료구조의 열쇠다
    if (/\[\s*$/.test(before) && /^\s*\]/.test(after)) continue;
    // ⚠️★**객체의 열쇠**도 UI 가 아니다 — `{ '천간 합': t(...) }` 의 왼쪽
    //   ★뒤의 `:` 만 보면 **삼항**(`ok ? '미상' : '확실'`)의 앞쪽을 열쇠로 잘못 읽는다.
    //     열쇠는 «속성이 시작되는 자리» 에만 온다 ⇒ **앞이 `{` 나 `,`** 여야 한다.
    if (/^\s*:/.test(after) && /[{,]\s*$/.test(before)) continue;
    out.push({ line: lineOf(m.index!), text: body, kind: 'lit' });
  }
  for (const m of s.matchAll(JSX_TEXT)) {
    out.push({ line: lineOf(m.index!), text: m[0].slice(1, -1).trim(), kind: 'jsx' });
  }
  return out.sort((a, b) => a.line - b.line);
}

/**
 * 여러 파일을 한꺼번에 센다.
 * @returns 파일 경로 → 개수(0 인 파일은 아예 안 담는다)
 */
export function countHardcodedKo(files: { path: string; src: string }[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const f of files) {
    const n = scanFile(f.src).length;
    if (n) out.set(f.path, n);
  }
  return out;
}
