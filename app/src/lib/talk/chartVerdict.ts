// app/src/lib/talk/chartVerdict.ts — 대화에 실을 **명리 판정 요약**
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-08-25 *"용신 강약 격국 신살 다 넣어"* · *"우리 모델을 전부 타게해"*
//
// ■ ★왜 필요했나 — 대화가 **날 차트만** 보고 있었다
//   실측(2026-08-25): 대화 프롬프트에 들어가던 것은 팔자·십신·합충·현재대운·자미 4궁뿐이었다.
//   **용신·강약·격국·신살·조후는 하나도 안 들어갔다.** 유료 풀이(`interpret`)는 용신을 쓰는데
//   대화만 안 썼다 ⇒ 명리 판정을 **모델이 자기 지식으로** 하고 있었다.
//   CLAUDE.md 가 경고한 *"해자가 비면 범용 LLM wrapper"* 바로 그 상태다.
//
// ■ ★왜 **앱에서** 계산해 보내나 (Edge 에서 안 하고)
//   ①Edge `_shared` 에는 강약·격국·신살이 **없다**. 옮기면 canonical ↔ Edge **복사본이 또 늘고**,
//     그 드리프트가 바로 2026-07-16 사고(앱 水 ↔ 엔진 土)의 원인이었다.
//   ②앱은 **이미 만세력 화면에서 같은 값을 계산해 보여 준다.** 그걸 그대로 보내면
//     화면과 대화가 **구조적으로 갈릴 수 없다**(같은 함수·같은 호출).
//   ⚠️보안 경계가 아니다 — 이건 **해석 재료**지 과금·권한 값이 아니다.
//     (과금은 서버가 `consultants.coin_cost` 로 정한다 — `check:talkcoin` ③이 지킨다.)
//
// ■ ⚠️없는 판정은 **비운다** — 지어내지 않는다
//   격이 안 서는 명식이 있고(표본 21%), 시각 미상이면 신살 기준지가 줄어든다.
//   빈 칸은 결함이 아니라 사실이다. 모델에게 "모른다"를 그대로 넘긴다.
// ═══════════════════════════════════════════════════════════════════════════
import type { SajuChart } from '@spec/chart';
import { classifyStrength, detectPattern } from '@engine/structure';
import { analyzeSinsal } from '@engine/sinsal';
import { computeYongsinApprox } from '../content/yongsinApprox';
import { elementPower } from '@engine/elementPower';

/**
 * 대화 프롬프트에 붙일 판정 요약 한 덩이.
 *
 * ★사람이 읽는 문장이 아니라 **모델이 읽는 재료**다 — 용어를 그대로 쓴다(화면 문구가 아니다).
 * @param saju 원국
 * @returns 여러 줄 문자열. 계산이 안 되면 빈 문자열(그러면 호출부가 안 붙인다)
 */
export function buildChartVerdict(saju: SajuChart): string {
  if (!saju?.pillars || !saju.dayMaster?.stem) return '';
  const out: string[] = [];

  // ── 용신 — **앱 화면(만세력 용신 카드)과 같은 함수**를 부른다 ──
  try {
    const y = computeYongsinApprox(saju);
    if (y?.yongsin) {
      out.push(`용신: ${y.yongsin}(${y.method}용신) · 희신: ${y.huisin ?? '—'} · 기신: ${y.gisin}`);
    }
  } catch { /* 못 내면 안 적는다 */ }

  // ── 강약 ──
  try {
    const sc = classifyStrength(saju);
    if (sc?.type) out.push(`강약: ${sc.type}`);
  } catch { /* */ }

  // ── 격국 — ⚠️격이 **안 서는** 명식이 있다(투간 없음). 그때는 적지 않는다 ──
  try {
    const p = detectPattern(saju);
    if (p?.name) out.push(`격국: ${p.name}`);
  } catch { /* */ }

  // ── 오행 세력 — 보정 없이(개수 축). 조후·궁성 보정은 화면 토글이라 기본값을 쓴다 ──
  try {
    const ep = elementPower(saju, { hap: false, johuGung: false });
    const t = (Object.values(ep.power) as number[]).reduce((a, b) => a + b, 0) || 1;
    const dist = (['木', '火', '土', '金', '水'] as const)
      .map((e) => `${e} ${Math.round((ep.power[e] / t) * 100)}%`).join(' · ');
    const labels = Object.entries(ep.labels).map(([e, l]) => `${e}=${l}`).join(' ');
    out.push(`오행: ${dist}${labels ? ` (${labels})` : ''}`);
  } catch { /* */ }

  // ── 신살 — 자리별로 **맞은 것만**. 열두 개를 다 흘리면 신호가 묻힌다 ──
  try {
    const sin = analyzeSinsal(saju);
    const hits = (sin.sinsal ?? []).filter((x) => x.hits?.length)
      .map((x) => `${x.name}(${x.hits.map((h) => h.pos).join('')})`);
    if (sin.goegang) hits.push('괴강');
    if (sin.baekhoHits?.length) hits.push(`백호(${sin.baekhoHits.join('')})`);
    if (hits.length) out.push(`신살: ${hits.join(' · ')}`);
    if (sin.gongmang?.length) {
      const gm = sin.gongmangHits?.length ? ` — 원국 ${sin.gongmangHits.join('')}에 걸림` : '';
      out.push(`공망: ${sin.gongmang.join('·')}${gm}`);
    }
    // 12신살은 자리별로 다르므로 **일지 기준**만 싣는다(전부 실으면 길어진다)
    const twelveDay = (sin.twelve?.['일'] ?? []).map((x) => x.name).join(',');
    if (twelveDay) out.push(`12신살(일지): ${twelveDay}`);
  } catch { /* */ }

  if (!out.length) return '';
  return [
    '[판정] ★아래는 **우리 엔진이 계산한 결과**다. 네가 다시 판정하지 말고 이것을 근거로 말해라.',
    ...out.map((l) => `- ${l}`),
    '⚠️비어 있는 항목은 "그 명식에 그것이 없다"는 뜻이다 — 지어내지 마라.',
  ].join('\n');
}
