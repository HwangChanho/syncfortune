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
 * **문장 골격** — 명식마다 갈리는 낱말(干支·십신·오행·판정어·자리·숫자·O/X)을 전부 `〇` 로 지운 나머지.
 *
 * 왜 필요한가(상담가 판정 2026-08-09 `verify-000f-claim`):
 *   · #5 (O) *"같은 격국이라도 명식마다 다른 말이 나와야 정상이다"*
 *   · #7 (O) *"엔진 계산 결과를 문항에 그대로 옮겨 적는 것은 골든 문장으로 부적절 — 그건 계산이지 통변이 아니다"*
 *   기존 `crossChartTemplateBodies` 는 **문자열이 완전히 같을 때만** 템플릿으로 잡았다.
 *   그런데 실제 코퍼스의 준중복은 干支만 갈린 형태라 문자열이 달라 빠져나갔다 —
 *     `격국은 건록국 이다 (월지 본기 기준 · 투간 여부로 격/국을 가름)`
 *     `격국은 편재격 이다 (월지 본기 기준 · 투간 여부로 격/국을 가름)`
 *   기계(임베딩)에는 코사인 0.99 인 같은 문장인데 우리 필터만 다르다고 본 것이다.
 *   ⇒ 골격으로 비교하면 이 둘이 한 틀임이 드러난다.
 *
 * ★마스킹은 '명식 고유 정보'를 지우는 방향으로만 한다 — 지우고 남은 게 곧 **내가 쓴 틀**이다.
 *   남은 골격이 여러 차트에 걸쳐 같다면, 그 문장은 명식이 아니라 틀을 말하고 있다는 뜻.
 *
 * @param {string} body 골든 본문(goldenBody 산출)
 * @returns {string} 골격 문자열
 */
export function skeletonOf(body) {
  return String(body ?? '')
    .replace(/[甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥木火土金水]/g, '〇')  // 干支·오행
    .replace(/비견|겁재|식신|상관|편재|정재|편관|정관|편인|정인|건록|양인|비겁|식상|재성|관성|인성/g, '〇')  // 십신·격
    .replace(/신강|신약|신왕|중화/g, '〇')                                        // 강약 판정어
    .replace(/[년월일시][지간]/g, '〇')                                            // 자리
    .replace(/\d+/g, '#')                                                          // 나이·개수
    .replace(/(?<=[\s(·])[OX](?=[\s)·]|$)/g, '〇')                                 // 득령 O / 득지 X
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * **엔진 계산의 재진술인가** — 상담가 `verify-000f-claim#7` (O).
 *
 * *"엔진 계산 결과(격국·강약·합충 목록)를 문항에 그대로 옮겨 적는 것은 골든 문장으로 부적절하다
 *   — 그건 계산이지 통변이 아니다."*
 *
 * 판정은 **표현식**으로 한다(이름이 아니라 — harness-judge-expression-not-name 교훈):
 *   근거 칸에 `엔진 <함수명>` 이라고 **내가 스스로 적어 둔 것**을 표식으로 쓴다.
 *   실제 코퍼스에 `근거: 엔진 detectPattern` · `엔진 classifyStrength` · `엔진 detectInteractions` 로 남아 있다.
 *
 * @param {{claim?:string, basis?:string}} item
 * @returns {boolean}
 */
export function isEngineRestatement(item) {
  const basis = plain(item?.basis);
  return /엔진\s+[A-Za-z_][A-Za-z0-9_]*/.test(basis);
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
 * @param {{skeleton?:boolean}} [opts] `skeleton:true` 면 干支·십신을 지운 **골격**으로 비교한다
 *        (신규 적재용 — 상담가 #5·#7). 기본값 false = 문자열 완전 일치(기존 동작·대조용).
 *        ★기본값을 유지하는 이유: 이미 적재된 72벡터는 **그대로 둔다**(상담가 `#8` O — "섞어도된다").
 *          대조 하네스가 옛 적재분을 갑자기 '고아'로 부르면 하네스가 상시 빨간불이 되어 아무도 안 믿는다.
 * @returns {Set<string>} 2개 이상 태그에 걸쳐 나타나는 **본문** 집합(골격 모드에서도 본문으로 돌려준다)
 */
export function crossChartTemplateBodies(tagged, opts = {}) {
  const keyOf = opts.skeleton ? (b) => skeletonOf(b) : (b) => b;
  const tagsByKey = new Map();      // 비교 키 → 태그 집합
  const bodiesByKey = new Map();    // 비교 키 → 원본 본문들(반환은 본문 단위라 되돌려야 한다)
  for (const { tag, item } of tagged) {
    const body = goldenBody(item);
    const k = keyOf(body);
    if (!tagsByKey.has(k)) { tagsByKey.set(k, new Set()); bodiesByKey.set(k, new Set()); }
    tagsByKey.get(k).add(tag);
    bodiesByKey.get(k).add(body);
  }
  const out = new Set();
  for (const [k, tags] of tagsByKey) if (tags.size > 1) for (const b of bodiesByKey.get(k)) out.add(b);
  return out;
}

/**
 * 적재 자격 판정 — **O 판정만** + base-rate 제외.
 *  ① verdict !== 'O' → 제외. 검증 안 된 내 추론을 적재하면 RAG 가 그걸 근거로 되먹임해
 *     해자가 아니라 **부채**가 된다(CLAUDE.md §3.2).
 *  ② base_rate === '예' → 제외. 누구에게나 참인 문장은 검색 변별력을 떨어뜨린다(코퍼스 희석).
 *  ③ (strict 한정) **엔진 계산의 재진술** → 제외. 상담가 `verify-000f-claim#7`(O):
 *     *"그건 계산이지 통변이 아니다."* 엔진이 이미 결정론으로 내는 값을 골든으로 또 넣으면
 *     검색이 그 문장을 근거랍시고 되돌려 준다 — 통변 근거가 아니라 자기 출력의 메아리가 된다.
 * @param {{verdict?:string, base_rate?:string, basis?:string}} item
 * @param {{strict?:boolean}} [opts] `strict:true` = **신규 적재** 판정(③까지 적용).
 *        기본값 false = 기존 적재분 대조용(①②만) — 상담가 `#8`(O) "이미 쌓인 골든은 그대로 둬도 된다".
 * @returns {{ok:boolean, reason?:string}} ok=false 면 reason 에 제외 사유
 */
export function ingestEligibility(item, opts = {}) {
  if (item.verdict !== 'O') return { ok: false, reason: `판정 '${item.verdict ?? '미판정'}'` };
  if (String(item.base_rate ?? '').trim() === '예') return { ok: false, reason: 'base-rate(누구에게나 참)' };
  if (opts.strict && isEngineRestatement(item)) return { ok: false, reason: '엔진 계산의 재진술(000f#7)' };
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
