// scripts/gen-persona-share.ts — 성격유형 120종 표를 Edge(Deno) 복사본으로 생성
// ─────────────────────────────────────────────────────────────────────────
// 왜 복사본이 필요한가:
//   공유 링크는 **유형 키만** 담는다(`?p=辛卯&s=m`). 표시 문구를 URL 에 넣지 않는 이유 =
//   넣으면 누구나 임의 텍스트로 '팔자가 이렇게 말했다'는 브랜드 페이지를 만들 수 있다(콘텐츠 스푸핑).
//   그래서 문구는 **서버가 갖고** 있어야 하고, Deno 는 앱 코드를 그대로 import 할 수 없어 복사본을 둔다.
//
// ★복사본은 손으로 고치지 말 것. 문구(daniel 검수)는 `app/src/lib/engine/personaType.ts` 가 정본이고,
//   여기서 생성만 한다. 드리프트는 `npm run check:light` 가 매 preflight 마다 잡는다(정본과 전수 비교).
//
// 실행: npm run gen:persona-share
// ─────────────────────────────────────────────────────────────────────────
import { writeFileSync } from 'node:fs';
import { personaOf, allPersonaKeys } from '../app/src/lib/engine/personaType';
import type { Stem, Branch } from '../spec/chart';

const OUT = 'supabase/functions/_shared/personaShare.ts';

/**
 * 공유 페이지가 쓰는 최소 필드만 뽑는다.
 * ★요약은 **통째로** 쓴다 — 처음엔 첫 문장만 자르게 만들었는데, 실측하니 첫 문장이
 *   "늦겨울의 큰 나무 같은 사람이에요."(21자) = **유형명 반복**이라 티저로서 값이 0이었다.
 *   실제 내용은 두 번째 문장부터 나온다(정본 summary 전체가 70자 안팎이라 그대로 담을 수 있다).
 * ★PII 없음 — 생년월일·이름·시각을 담지 않는다. 유형명·키워드·요약뿐(생일 역산 차단).
 */
export function shareRowOf(key: string) {
  const p = personaOf(key[0] as Stem, key[1] as Branch);
  return { n: p.name, k: p.keywords.slice(0, 3), s: p.summary.trim() };
}

const keys = allPersonaKeys();
const rows = keys.map((k) => [k, shareRowOf(k)] as const);

// 생성물 통계 — 표가 예상 크기인지(120종·문구 비어있지 않음) 눈으로 확인할 수 있게 남긴다.
const maxSum = Math.max(...rows.map(([, r]) => r.s.length));
const empty = rows.filter(([, r]) => !r.n || !r.s || r.k.length === 0);

const body = rows
  .map(([k, r]) => `  '${k}': { n: ${JSON.stringify(r.n)}, k: ${JSON.stringify(r.k)}, s: ${JSON.stringify(r.s)} },`)
  .join('\n');

const src = `// supabase/functions/_shared/personaShare.ts — ★자동 생성물(직접 수정 금지)
// 생성: npm run gen:persona-share  ·  정본: app/src/lib/engine/personaType.ts
// ─────────────────────────────────────────────────────────────────────────
// 공유 링크(\`share?p=<유형키>&s=m|f\`)가 **서버에서** 렌더할 문구. URL 에 문구를 담지 않는 이유 =
//   담으면 임의 텍스트로 브랜드 페이지를 위조할 수 있다(콘텐츠 스푸핑). 서버가 표를 갖고 키만 받는다.
// 드리프트는 npm run check:light 가 정본과 전수 비교해 잡는다.
// ─────────────────────────────────────────────────────────────────────────

/** 유형 키(일간+월지) → 표시 문구. n=유형명 · k=키워드 3개 · s=요약 첫 문장 */
export const PERSONA_SHARE: Record<string, { n: string; k: string[]; s: string }> = {
${body}
};

/** 천간 로마자 — 이미지 파일명(persona 버킷)용. app/src/lib/content/personaImages.ts 와 같은 표. */
export const GAN_ROMA: Record<string, string> = { '甲': 'gap', '乙': 'eul', '丙': 'byeong', '丁': 'jeong', '戊': 'mu', '己': 'gi', '庚': 'gyeong', '辛': 'sin', '壬': 'im', '癸': 'gye' };
/** 지지 로마자 — 이미지 파일명용. */
export const JI_ROMA: Record<string, string> = { '子': 'ja', '丑': 'chuk', '寅': 'in', '卯': 'myo', '辰': 'jin', '巳': 'sa', '午': 'o', '未': 'mi', '申': 'sin', '酉': 'yu', '戌': 'sul', '亥': 'hae' };
`;

writeFileSync(OUT, src, 'utf8');
console.log(`✅ ${OUT} 생성 — ${rows.length}종 · 요약 최대 ${maxSum}자 · 빈 항목 ${empty.length}건`);
if (empty.length) { console.error('❌ 빈 문구가 있다 — 정본(personaType.ts) 확인 필요'); process.exit(1); }
