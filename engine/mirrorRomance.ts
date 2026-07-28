// engine/mirrorRomance.ts — R60 경상명식(鏡像命式) L1 결정론 도출
// ─────────────────────────────────────────────────────────────────────────
// 스펙: R60-MIRROR-ROMANCE.md (daniel 2026-07-28 확정 · 구 R48 에서 번호 재배정)
//
// 원국 8자에 두 변환을 적용해 **두 개의 인물 프로파일 씨앗**을 만든다.
//   · 合鏡(HAP)  = 전 글자를 합신으로 → **이상형**(끌림·무의식적 지향)
//   · 沖鏡(CHUNG)= 전 글자를 충신으로 → **실배우자**(현실 인연·사건)
//
// ★여기는 **L1(결정론)만** 한다 — 표 치환과 유효성 보장까지. 프로파일 해석(L2)은 별도.
//   ⚠️경상명식은 **고전 원전에 없는 파생 기법**이다(스펙 §1.3). 사주 자체 판정(격국·용신)에
//     절대 개입시키지 않는다. romance 모듈 전용.
//
// ★★변환표를 **새로 만들지 않는다** — engine/structure.ts 의 합충표를 그대로 재사용한다.
//   같은 표가 두 벌이면 한쪽만 고쳐지는 날 조용히 갈라진다(이 프로젝트에서 반복된 사고 유형).
// ─────────────────────────────────────────────────────────────────────────
import { SIXHE, CHONG, TIANHE, TIANCHONG } from './structure';
import type { Stem, Branch, PillarPos } from '../spec/chart';

export type MirrorPillar = { stem: Stem; branch: Branch };
export type MirrorChart = Record<PillarPos, MirrorPillar>;

const POS: PillarPos[] = ['년', '월', '일', '시'];

/** 짝표에서 상대를 찾는다(양방향). 없으면 null. */
function partnerOf<T extends string>(pairs: [T, T, ...unknown[]][], x: T): T | null {
  for (const p of pairs) {
    if (p[0] === x) return p[1];
    if (p[1] === x) return p[0];
  }
  return null;
}

/** 천간 합신(오합) — 甲己 乙庚 丙辛 丁壬 戊癸. 완전 대합이라 항상 존재한다. */
export function hapStem(s: Stem): Stem {
  const r = partnerOf(TIANHE as unknown as [Stem, Stem][], s);
  if (!r) throw new Error(`천간 합신 없음: ${s}`);   // 오합은 전 간에 존재 — 없으면 표가 깨진 것
  return r;
}

/** 지지 합신(육합) — 子丑 寅亥 卯戌 辰酉 巳申 午未. 완전 대합. */
export function hapBranch(b: Branch): Branch {
  const r = partnerOf(SIXHE as unknown as [Branch, Branch][], b);
  if (!r) throw new Error(`지지 합신 없음: ${b}`);
  return r;
}

/** 지지 충신(육충) — 완전 대충. */
export function chungBranch(b: Branch): Branch {
  const r = partnerOf(CHONG as [Branch, Branch][], b);
  if (!r) throw new Error(`지지 충신 없음: ${b}`);
  return r;
}

/**
 * 천간 충신(칠충) — 甲庚 乙辛 丙壬 丁癸 **4쌍뿐**.
 * ★戊己(중앙토)는 충이 없다(거중무충) → 스펙 §2.1 폴백: 극(剋)하는 편관으로 대체(戊→甲 · 己→乙).
 * @returns [충신, 폴백여부] — 폴백이면 호출측이 플래그를 세워 L2 해설에 명시해야 한다.
 */
export function chungStem(s: Stem): [Stem, boolean] {
  const r = partnerOf(TIANCHONG as [Stem, Stem][], s);
  if (r) return [r, false];
  const FALLBACK: Partial<Record<Stem, Stem>> = { 戊: '甲', 己: '乙' };   // 甲剋戊 · 乙剋己(편관)
  const f = FALLBACK[s];
  if (!f) throw new Error(`천간 충신·폴백 모두 없음: ${s}`);
  return [f, true];
}

/** 합경(合鏡) — 이상형 씨앗. 모든 자리에 합신 적용. */
export function deriveHapMirror(natal: MirrorChart): MirrorChart {
  const out = {} as MirrorChart;
  for (const p of POS) out[p] = { stem: hapStem(natal[p].stem), branch: hapBranch(natal[p].branch) };
  return out;
}

/**
 * 충경(沖鏡) — 실배우자 씨앗. 모든 자리에 충신 적용.
 * @returns chart + flags(戊己 무충 폴백이 쓰인 자리) — flags 가 있으면 신뢰도를 낮추고(스펙 §2.3)
 *   L2 해설에 "이 자리는 충이 성립하지 않아 극 관계로 대체했다"를 반드시 노출한다.
 */
export function deriveChungMirror(natal: MirrorChart): { chart: MirrorChart; flags: string[] } {
  const out = {} as MirrorChart;
  const flags: string[] = [];
  for (const p of POS) {
    const [st, fell] = chungStem(natal[p].stem);
    if (fell) flags.push(`GAN_NO_CHUNG:${p}:${natal[p].stem}`);
    out[p] = { stem: st, branch: chungBranch(natal[p].branch) };
  }
  return { chart: out, flags };
}

/** SajuChart(엔진 산출) → MirrorChart 입력 형태로. */
export function toMirrorChart(saju: { pillars: Record<PillarPos, { stem: Stem; branch: Branch }> }): MirrorChart {
  const out = {} as MirrorChart;
  for (const p of POS) out[p] = { stem: saju.pillars[p].stem, branch: saju.pillars[p].branch };
  return out;
}

/** 표기용 — '甲戌 / 丁卯 / 辛丑 / 丁酉' */
export function formatMirror(c: MirrorChart): string {
  return POS.map((p) => `${c[p].stem}${c[p].branch}`).join(' / ');
}

// ── 유효성(스펙 §2.3) ─────────────────────────────────────────────────────
const STEMS: Stem[] = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const BRANCHES: Branch[] = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

/**
 * 60갑자 유효성 — 천간·지지 인덱스의 홀짝(음양)이 같아야 실재하는 간지다.
 * ★합·충 모두 음양 패리티를 보존하므로 두 경상명식은 **항상** 유효해야 한다.
 *   그래도 검사하는 이유: 표가 잘못 수정되면 여기서 즉시 걸린다(조용한 오염 방지).
 */
export function isValidGanji(stem: Stem, branch: Branch): boolean {
  const si = STEMS.indexOf(stem), bi = BRANCHES.indexOf(branch);
  if (si < 0 || bi < 0) return false;
  return si % 2 === bi % 2;
}

/** 경상명식 4주가 전부 실재 간지인가. */
export function allValid(c: MirrorChart): boolean {
  return POS.every((p) => isValidGanji(c[p].stem, c[p].branch));
}
