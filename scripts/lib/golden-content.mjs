// scripts/lib/golden-content.mjs — 검증 판정(DB) → 골든 코퍼스 문자열의 **단일 출처**.
// ─────────────────────────────────────────────────────────────────────────
// 왜 모듈로 뺐나(2026-07-31):
//   `verifydb-to-ingest.mjs`(적재본 생성)와 `check-golden-sync.mjs`(적재 상태 대조)가
//   **같은 문자열 규칙**을 알아야 한다. 각자 구현하면 한쪽만 바뀌었을 때 하네스가
//   전건 불일치로 울고(오탐), 아무도 하네스를 안 믿게 된다.
//   ⇒ 조립·필터·태그 규칙을 여기 한 곳에만 둔다. 규칙을 바꾸면 두 소비처가 동시에 따라온다.
// ─────────────────────────────────────────────────────────────────────────

/** 마크다운 강조(**) 제거 + 트림 — 코퍼스에는 순수 텍스트만 넣는다(임베딩 잡음 제거). */
const plain = (s) => String(s ?? '').replace(/\*\*/g, '').trim();

/**
 * 검증 항목 → **본문**(태그 접두를 뗀 부분). 차트 정보가 실제로 담기는 자리다.
 * 서로 다른 명식에서 이 문자열이 같으면 = 그 문장은 명식 고유 정보가 없다는 뜻(아래 참조).
 * @param {{claim:string, basis?:string}} item
 * @returns {string}
 */
export function goldenBody(item) {
  const claim = plain(item.claim);
  const basis = plain(item.basis);
  return `${claim}${basis ? ` — 근거: ${basis}` : ''}`;
}

/**
 * 검증 항목 1건 → 코퍼스 content 문자열.
 * 형식: `[<tag> 골든 · <영역>] <주장> — 근거: <근거>`
 * ★접두 `[<tag> 골든 ·` 는 golden-ingest.mjs 의 --replace(멱등 삭제) 기준이라 절대 바꾸지 말 것.
 * @param {string} tag  차트 태그(예: 'chart-108')
 * @param {{section?:string, claim:string, basis?:string}} item  rag_validation_items 행
 * @returns {string} 코퍼스에 저장될 content
 */
export function goldenContent(tag, item) {
  return `[${tag} 골든 · ${item.section ?? '판정'}] ${goldenBody(item)}`;
}

/**
 * **명식 무관(템플릿) 문장 찾기** — 여러 차트에 글자 하나 안 바뀌고 들어가는 본문.
 *
 * 왜 필요한가(2026-07-31 실측):
 *   코퍼스를 39→50 벡터로 늘렸는데도 **다른 차트끼리 코사인 0.99** 인 벡터가 남았다.
 *   원인은 검증 세트의 claim 이 템플릿이라 干支만 갈리고 문장이 같다는 것 —
 *   실제로 `2026 세운 丙午는 … 세운이 조후 축 자체를 바꾸지는 못한다` 가 chart-101·108·110 에
 *   **완전히 동일하게** 3벌 들어가 있었다. 이런 문장은 어떤 쿼리에도 똑같이 걸려
 *   top-3 자리만 차지하고 **명식 고유 근거를 밀어낸다**(검색 변별력 = ADR-060 의 목적 그 자체).
 *
 * ★판정 기준은 기계적이다 — "여러 명식에 똑같이 쓰이는 문장 = 그 명식의 골든이 아니다."
 *   명리 판단이 아니라 정보이론이다. 내용이 틀렸다는 게 아니라(상담가가 O 를 준 참인 문장이다)
 *   **자리가 틀렸다**는 것 — 그런 문장은 전역 규칙(knowledge/rules)에 있어야 한다.
 *
 * @param {Array<{tag:string, item:object}>} tagged  명식 세트의 적재 자격 통과 항목 전부(태그 포함)
 * @returns {Set<string>} 2개 이상 태그에 걸쳐 동일하게 나타나는 본문 집합
 */
export function crossChartTemplateBodies(tagged) {
  const tagsByBody = new Map();
  for (const { tag, item } of tagged) {
    const body = goldenBody(item);
    if (!tagsByBody.has(body)) tagsByBody.set(body, new Set());
    tagsByBody.get(body).add(tag);
  }
  const out = new Set();
  for (const [body, tags] of tagsByBody) if (tags.size > 1) out.add(body);
  return out;
}

/**
 * 적재 자격 판정 — **O 판정만** + base-rate 제외.
 *  ① verdict !== 'O' → 제외. 검증 안 된 내 추론을 적재하면 RAG 가 그걸 근거로 되먹임해
 *     해자가 아니라 **부채**가 된다(CLAUDE.md §3.2).
 *  ② base_rate === '예' → 제외. 누구에게나 참인 문장은 검색 변별력을 떨어뜨린다(코퍼스 희석).
 * @param {{verdict?:string, base_rate?:string}} item
 * @returns {{ok:boolean, reason?:string}} ok=false 면 reason 에 제외 사유
 */
export function ingestEligibility(item) {
  if (item.verdict !== 'O') return { ok: false, reason: `판정 '${item.verdict ?? '미판정'}'` };
  if (String(item.base_rate ?? '').trim() === '예') return { ok: false, reason: 'base-rate(누구에게나 참)' };
  return { ok: true };
}

/**
 * 검증 세트 slug → 코퍼스 태그.
 * 규칙: `verify-<숫자>` 만 **명식 세트**로 보고 `chart-<숫자>` 태그를 준다.
 *   - `verify-000-rules`, `verify-000b-romance` 처럼 숫자로만 안 끝나는 slug = **규칙(stance) 세트**.
 *     이들의 판정은 특정 명식의 골든이 아니라 전역 규칙 재료라 코퍼스에 넣지 않는다
 *     → null 을 돌려주고, 호출부는 '코퍼스 대조 대상 아님'으로 취급한다.
 * @param {string} slug
 * @returns {string|null} 태그 또는 null(규칙 세트)
 */
export function tagForSlug(slug) {
  const m = /^verify-(\d+)$/.exec(String(slug ?? '').trim());
  return m ? `chart-${m[1]}` : null;
}
