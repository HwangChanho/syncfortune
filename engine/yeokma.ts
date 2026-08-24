// engine/yeokma.ts — **역마 3레이어** 결정론 검출 (원국 · 대운 · 세운)
// ═══════════════════════════════════════════════════════════════════════════
// 출처: 전문가 케이스 노트 v2 (2026-08-24) §3 「역마 3레이어 모델」
//
// ■ 왜 만드나 — **같은 룰이 두 차트에서 반대로 틀렸다**
//   원국 지지의 인신사해 **개수**만 세던 판정이:
//     · 차트 A — 개수로는 저역마인데 **이동이 인생 최상위 테마**였다
//       (년지↔일지 **상호 역마** + 巳亥충 + 대운 재격발)
//     · 차트 B — 원국 역마 **0** 인데 실제 이동 이력이 있었다(세운 역마 연도에 발생)
//   ⇒ 개수가 아니라 **자리·충·상호구조**(원국) / **구간**(대운) / **연도**(세운) 로 나눈다.
//
// ■ ★★여기서 **점수를 매기지 않는다**
//   레이어별 가중치와 「주체형/이벤트형」 분류 임계는 노트가 **Daniel 컨펌 항목**으로 못 박았다.
//   내가 계수를 정하면 그건 판정이 아니라 **사후 변명 장치**가 된다
//   ([[attach-indicators-r-attach]] 에서 이미 당한 것 — "가중치를 내가 정하면 … raw 연속량만").
//   ⇒ 이 파일은 **날것만** 내보낸다. 유형 분류·가중은 판정이 도착한 뒤에 붙인다.
//
// ■ 사후검증 (노트 §0 · 실측 2026-08-24)
//   · A: 32세 `丁亥` 역마 대운 = 현재 대운 ↔ 2024–25 이주. 역마 세운에 **2025** 포함.
//   · B: 역마 세운에 **2004**(호주 유학)·**2007**(여수→서울) **둘 다** 있다 — 노트의 예측 적중.
//   ⇒ `check:yeokma` 가 이 값들을 잠근다.
// ═══════════════════════════════════════════════════════════════════════════
import type { SajuChart, PillarPos, Branch } from '../spec/chart';
import { twelveSinsalAt } from './sinsal';

/** 지지 충(육충) — 역마가 충을 맞으면 「역마봉충」으로 급이 오른다(노트 §3). */
const CHUNG: Record<string, Branch> = {
  子: '午', 午: '子', 丑: '未', 未: '丑', 寅: '申', 申: '寅',
  卯: '酉', 酉: '卯', 辰: '戌', 戌: '辰', 巳: '亥', 亥: '巳',
};

/** 원국 역마 한 건 — 어느 자리를 기준으로 어느 자리가 역마인가. */
export type YeokmaHit = {
  /** 기준지(이 자리의 삼합국이 기준) */
  base: PillarPos;
  baseBranch: Branch;
  /** 역마에 해당하는 자리 */
  at: PillarPos;
  branch: Branch;
  /** ★이 역마 글자가 원국 안에서 **충을 맞는가**(역마봉충 — 노트: 최상급) */
  chunged: boolean;
  /** 충 상대 자리(있으면) */
  chungWith: PillarPos | null;
};

export type YeokmaLayers = {
  /** L-원국 = 기질. **개수가 아니라** 자리·충·상호구조를 그대로 낸다 */
  natal: {
    hits: YeokmaHit[];
    /** ★두 자리가 **서로** 상대의 역마인 구조(노트: 차트 A 년지↔일지) */
    mutual: { a: PillarPos; b: PillarPos; branches: [Branch, Branch] }[];
    /** 역마봉충이 하나라도 있는가 */
    hasChungedYeokma: boolean;
    /** 역마가 걸린 자리들(중복 없이) — 궁위 가중은 **판정 도착 후**에 붙인다 */
    positions: PillarPos[];
  };
  /** L-대운 = 구간 */
  luck: { startAge: number; gz: string; branch: Branch; isCurrent: boolean }[];
  /** L-세운 = 트리거. 백테스트·예측 겸용 연도 목록 */
  annual: number[];
};

/**
 * 역마 3레이어 산출.
 *
 * ⚠️기준지는 **원국 네 지지 전부**를 쓴다 — daniel 2026-08-01 *"전부 산출 — 일지·년지만 X"*.
 *   시각 미상이면 시주를 뺀다(유령 子시가 기준이 되면 없는 역마를 만들어 낸다).
 *
 * @param saju      원국
 * @param yearFrom  세운 목록 시작 연도(기본 = 출생년)
 * @param yearTo    세운 목록 끝 연도(기본 = 출생년 + 90)
 * @returns 세 레이어의 **날것**. 점수·유형 분류는 하지 않는다(위 머리말)
 */
export function yeokmaLayers(saju: SajuChart, yearFrom?: number, yearTo?: number): YeokmaLayers {
  const POS: PillarPos[] = (saju as { timeUnknown?: boolean }).timeUnknown
    ? ['년', '월', '일'] : ['년', '월', '일', '시'];
  const br = (p: PillarPos) => saju.pillars[p].branch as Branch;

  // ── L-원국 ────────────────────────────────────────────────────────────
  const hits: YeokmaHit[] = [];
  for (const base of POS) for (const at of POS) {
    if (twelveSinsalAt(br(base), br(at)) !== '역마') continue;
    // 이 역마 글자가 원국의 **다른 자리**와 충하는가
    const foe = CHUNG[br(at)];
    const chungWith = POS.find((p) => p !== at && br(p) === foe) ?? null;
    hits.push({ base, baseBranch: br(base), at, branch: br(at), chunged: !!chungWith, chungWith });
  }
  // ★상호 역마 — a 기준으로 b 가 역마이면서 b 기준으로도 a 가 역마
  const mutual: YeokmaLayers['natal']['mutual'] = [];
  for (let i = 0; i < POS.length; i++) for (let j = i + 1; j < POS.length; j++) {
    const [a, b] = [POS[i], POS[j]];
    if (twelveSinsalAt(br(a), br(b)) === '역마' && twelveSinsalAt(br(b), br(a)) === '역마') {
      mutual.push({ a, b, branches: [br(a), br(b)] });
    }
  }

  // ── L-대운 ────────────────────────────────────────────────────────────
  const cycles = ((saju as { luckCycles?: unknown[] }).luckCycles ?? []) as {
    startAge: number; stem: string; branch: Branch; isCurrent?: boolean; annuals?: { year: number; branch: Branch }[];
  }[];
  const isYeokma = (b: Branch) => POS.some((p) => twelveSinsalAt(br(p), b) === '역마');
  const luck = cycles.filter((l) => isYeokma(l.branch))
    .map((l) => ({ startAge: l.startAge, gz: `${l.stem}${l.branch}`, branch: l.branch, isCurrent: !!l.isCurrent }));

  // ── L-세운 ────────────────────────────────────────────────────────────
  const years = new Set<number>();
  for (const l of cycles) for (const a of (l.annuals ?? [])) {
    if (yearFrom != null && a.year < yearFrom) continue;
    if (yearTo != null && a.year > yearTo) continue;
    if (isYeokma(a.branch)) years.add(a.year);
  }

  return {
    natal: {
      hits, mutual,
      hasChungedYeokma: hits.some((h) => h.chunged),
      positions: [...new Set(hits.map((h) => h.at))],
    },
    luck,
    annual: [...years].sort((a, b) => a - b),
  };
}
