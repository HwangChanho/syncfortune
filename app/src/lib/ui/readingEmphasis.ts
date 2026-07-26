// app/src/lib/ui/readingEmphasis.ts — 풀이 본문 가독성 후처리(온디바이스·API 0)
// ─────────────────────────────────────────────────────────────────────────
// 풀이 가시성 개선 P0(축2 시각 위계 / 기획=[[reading-visibility-plan]] §2).
//   LLM 통변 본문은 **줄바꿈이 하나도 없는 통짜 텍스트**다(2026-07-26 DB 실측: readings.content 의
//   base/past/overlay/future/remedy 전 건 `\n` 개수 0 · 길이 240~460자). 그래서 화면에서 문단 구분이
//   생길 수가 없고 '벽 텍스트'로 읽힌다 → 여기서 **문장 단위로 문단을 만들고**, **시기·명리 핵심어를 강조**한다.
//
// 설계 원칙(중요):
//   1) **원문을 고치지 않는다.** 자르기·강조 위치만 계산해 돌려준다(명리 통변 내용 불변 = §3 stance 안전).
//   2) **API 0.** 전부 온디바이스 정규식 — 비용·지연 없음(절대 0 규칙).
//   3) **과밀 방지.** 같은 표현은 *첫 등장만* 강조한다. 온 화면이 볼드면 위계가 사라진다.
//   4) P1(구조화 출력)이 들어오면 문단화는 LLM 구분자가 대신하지만, **하위호환**(이미 저장된 통짜 풀이)
//      때문에 이 모듈은 계속 필요하다.
// ─────────────────────────────────────────────────────────────────────────

/** 문단 하나의 목표 길이(자). 이 길이를 넘기면 문장 경계에서 문단을 끊는다. */
const PARA_TARGET = 110;
/** 문단이 이보다 짧게 홀로 남으면 앞 문단에 붙인다(고아 문단 방지). */
const PARA_ORPHAN_MIN = 40;
/**
 * 한 문단에서 강조할 최대 개수.
 * 강조는 '위계'를 만들려고 하는 것이라 많아지면 목적이 뒤집힌다(전부 굵으면 아무것도 안 굵은 것과 같다).
 * check:prose 하네스가 강조 비율 25% 상한으로 이 값을 지킨다.
 */
const MAX_EM_PER_PARA = 4;

/**
 * 통짜 본문을 문장 단위로 끊어 문단 배열로 만든다.
 *
 * 왜 문장 기준인가: 본문에 줄바꿈이 없으므로(위 실측) `\n` 분리는 무의미하다. 한국어 통변은
 * 대부분 '~다.' '~요.' 로 끝나므로 종결부호를 경계로 삼으면 문장 중간이 잘리지 않는다.
 *
 * @param text 원문(통짜 또는 줄바꿈 포함)
 * @returns 문단 문자열 배열. 빈 입력이면 빈 배열.
 * @remarks 원문에 이미 줄바꿈이 있으면 **그 줄바꿈을 우선 존중**한다(P1 구조화 출력·기존 수기 문단 보존).
 */
export function toParagraphs(text: string): string[] {
  const src = (text ?? '').trim();
  if (!src) return [];

  // ① 원문이 이미 문단을 갖고 있으면(줄바꿈 존재) 그대로 존중 — 우리가 임의로 재편하지 않는다.
  if (src.includes('\n')) {
    return src.split(/\n{1,}/).map((s) => s.trim()).filter(Boolean);
  }

  // ② 줄바꿈 없는 통짜 → 문장 분리. 종결부호(.!?…) 뒤 공백을 경계로 삼되, 부호는 문장에 남긴다.
  const sentences = src.split(/(?<=[.!?…])\s+/).filter(Boolean);
  if (sentences.length <= 1) return [src]; // 한 문장뿐이면 나눌 것이 없다

  // ③ 문장을 누적하다 목표 길이를 넘으면 문단 종료(문장 중간은 절대 안 끊김).
  const paras: string[] = [];
  let buf = '';
  for (const s of sentences) {
    buf = buf ? `${buf} ${s}` : s;
    if (buf.length >= PARA_TARGET) { paras.push(buf); buf = ''; }
  }
  if (buf) {
    // 마지막 조각이 너무 짧으면 앞 문단에 흡수(한 줄짜리 고아 문단 방지)
    if (paras.length && buf.length < PARA_ORPHAN_MIN) paras[paras.length - 1] += ` ${buf}`;
    else paras.push(buf);
  }
  return paras;
}

// ── 강조 대상 ────────────────────────────────────────────────────────────
// ⚠️ 명리 용어 목록은 **표현 강조용**일 뿐 판정·해석에 관여하지 않는다(§3: Claude 는 명리를 발명하지 않는다).
//    새 용어 추가는 daniel 검수 대상.

/**
 * 시기 표현 — daniel 07-21 지시로 통변이 "구체적 시기 범위"를 쓰게 돼 있어(Edge timingDirective),
 * 사용자가 가장 찾고 싶어 하는 정보다. 긴 패턴을 먼저 둬야 짧은 패턴에 먹히지 않는다(예: '2026년 9월' > '9월').
 */
const TIME_PATTERNS: RegExp[] = [
  /\d{4}년(?:\s*\d{1,2}월)?/g,                                    // 2026년 / 2026년 9월
  /\d{1,2}\s*~\s*\d{1,2}월/g,                                     // 9~10월
  /\d{1,2}월(?:\s*(?:무렵|즈음|경|초|말|중순))?/g,                  // 9월 / 9월 무렵
  /(?:올|이번|다가오는|내년|내후년|다음)\s*(?:봄|여름|가을|겨울|해)(?:\s*(?:무렵|즈음|들머리|초|말))?/g,
  /(?:올해|내년|내후년|올\s*상반기|올\s*하반기|상반기|하반기)/g,
  /(?:이번|다음|현재)\s*(?:대운|세운|월운)/g,                        // 이번 대운 / 다음 세운
  // ★나이대(2026-07-26 하네스가 잡은 누락): 재물·직업 딥리포트는 시기를 **나이대로 콕** 짚게 프롬프트가
  //   지시한다(prompts.ts wealth timing "나이대로 콕"). 실측 본문이 "37세부터 66세까지"·"40~60대" 로
  //   가득한데 월/연 패턴만 있어 하나도 강조되지 않았다 → 상품 핵심 정보가 안 보이던 구멍.
  /\d{1,2}0\s*~\s*\d{1,2}0대/g,                                   // 40~60대 (범위가 단일 '60대'보다 먼저 잡히게 위에)
  /\d{1,3}세(?:\s*(?:부터|까지|무렵|즈음|이후|이전|전후))?/g,        // 37세부터 / 66세까지 / 67세 이후
  /\d{1,2}0대(?:\s*(?:초반|중반|후반|초|말))?/g,                    // 40대 / 50대 후반
];

/**
 * 명리 핵심어 — 십신·용신 계열. 유료값 체감(목표④ '근거가 보여야')의 핵심 단서라 눈에 걸리게 한다.
 * ※ P2(축4 용어 가독성)에서 한글 병기·툴팁으로 확장 예정 — 그때 이 목록이 매핑 키가 된다.
 */
const TERM_WORDS: string[] = [
  '용신', '희신', '기신', '구신', '한신',
  '정인', '편인', '인성', '정관', '편관', '칠살', '관성',
  '정재', '편재', '재성', '식신', '상관', '식상', '비견', '겁재', '비겁',
  '대운', '세운', '원국', '일간', '월지', '일지',
];

/** 명리어를 하나의 정규식으로(긴 단어 우선 — '인성'이 '정인'을 가리지 않도록 길이 내림차순). */
const TERM_PATTERN = new RegExp(
  [...TERM_WORDS].sort((a, b) => b.length - a.length).join('|'),
  'g',
);

/**
 * 강조 세그먼트 — em=true 면 볼드 렌더.
 * `term` 이 있으면 **글로서리에 뜻이 있는 명리 용어**라 탭하면 설명을 띄울 수 있다(가독성 P2).
 *   · 시기 표현(9~10월 등)은 강조만 하고 term 은 없다(설명할 게 없음).
 *   · term 값 = myeongriGlossary 의 조회 키. kind 는 소비자가 정한다(십신 10성 → 'tengod' / 그 외 → 'basic').
 */
export type Segment = { t: string; em: boolean; term?: string };

/**
 * 십신 10성(+칠살) — 기존 TENGOD_GLOSSARY 가 커버하는 키.
 * 나머지 명리어(용신 계열·묶음어·구조어)는 BASIC_GLOSSARY 소관이라 kind 가 다르다.
 * ※ 여기서 사전을 직접 import 하지 않는 이유: 이 모듈은 순수 문자열 처리(하네스가 RN 없이 돈다)를 유지한다.
 */
const TENGOD_KEYS = new Set(['정인', '편인', '정관', '편관', '칠살', '정재', '편재', '식신', '상관', '비견', '겁재']);

/** 용어 → 글로서리 kind. 소비자가 lookupGlossary(kind, term) 로 조회한다. */
export function glossaryKindOf(term: string): 'tengod' | 'basic' {
  return TENGOD_KEYS.has(term) ? 'tengod' : 'basic';
}

/**
 * 문단 텍스트를 강조 세그먼트로 쪼갠다.
 *
 * @param text  문단 원문
 * @param seen  이미 강조한 표현(호출자가 섹션 전체에 걸쳐 공유) — **같은 말 반복 강조 방지**.
 *              호출자가 넘긴 Set 을 직접 갱신한다(문단을 넘나드는 '첫 등장만' 판정).
 * @returns 순서대로 이어 붙이면 원문과 완전히 동일한 세그먼트 배열(내용 무손실).
 *
 * @remarks 매치가 겹치면(예: '2026년 9월' 과 '9월') **먼저 시작하고 더 긴 쪽**을 채택한다.
 */
export function emphasize(text: string, seen: Set<string>): Segment[] {
  if (!text) return [];

  // ① 후보 매치 수집(시기 + 명리어)
  type Hit = { start: number; end: number; s: string; term?: boolean };
  const hits: Hit[] = [];
  const collect = (re: RegExp, isTerm = false) => {
    re.lastIndex = 0; // g 플래그 정규식 재사용 시 상태 초기화(누락 버그 방지)
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      if (!m[0]) { re.lastIndex++; continue; } // 빈 매치 방어(무한루프 차단)
      hits.push({ start: m.index, end: m.index + m[0].length, s: m[0], term: isTerm });
    }
  };
  TIME_PATTERNS.forEach((re) => collect(re));
  collect(TERM_PATTERN, true); // 명리어만 term 표시 → 탭하면 글로서리(가독성 P2)
  if (!hits.length) return [{ t: text, em: false }];

  // ② 시작 위치 오름차순 · 같은 시작이면 긴 것 우선 → 겹치는 짧은 매치 제거
  hits.sort((a, b) => (a.start - b.start) || (b.end - a.end));
  const picked: Hit[] = [];
  let cursor = -1;
  for (const h of hits) {
    if (picked.length >= MAX_EM_PER_PARA) break; // ★문단당 상한 — 시기어가 몰린 문단이 통째로 볼드가 되는 것 방지
    if (h.start < cursor) continue;           // 앞 매치와 겹침 → 버림
    if (seen.has(h.s)) continue;              // ★첫 등장만 강조(과밀 방지)
    seen.add(h.s);                            // ※상한으로 버린 건 seen 에 넣지 않는다(다음 문단에서 강조될 기회 유지)
    picked.push(h);
    cursor = h.end;
  }
  if (!picked.length) return [{ t: text, em: false }];

  // ③ 세그먼트 조립 — 강조 구간과 사이 평문을 순서대로(원문 무손실)
  const out: Segment[] = [];
  let pos = 0;
  for (const h of picked) {
    if (h.start > pos) out.push({ t: text.slice(pos, h.start), em: false });
    // 명리어면 term 을 실어 보낸다 → 렌더러가 탭 가능하게 만들고 글로서리를 띄운다(P2).
    out.push(h.term ? { t: text.slice(h.start, h.end), em: true, term: h.s } : { t: text.slice(h.start, h.end), em: true });
    pos = h.end;
  }
  if (pos < text.length) out.push({ t: text.slice(pos), em: false });
  return out;
}
