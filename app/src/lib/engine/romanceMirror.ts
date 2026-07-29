// app/src/lib/engine/romanceMirror.ts — R60 애정 이원분석 L1 산출(온디바이스)
// ─────────────────────────────────────────────────────────────────────────
// ★왜 앱에서 계산하나: R60 엔진(starPalace·mirrorRomance·mirrorProfile·mirrorConcordance)은
//   `engine/saju`·`engine/structure` 에 의존하는데, Edge(_shared)에는 그 둘의 사본이 없다.
//   전부 복사하면 표가 두 벌이 되어 **한쪽만 고쳐지는 날 조용히 갈라진다**(이 프로젝트 반복 사고).
//   → 자미두수(`ziwei`)를 앱에서 계산해 body 로 넘기는 **기존 패턴 그대로** 간다.
//   Edge 는 받은 산출로 프롬프트 블록만 만든다(판정은 전부 여기서 끝난다).
//
// ⚠️결과에 **개인정보가 없다** — 간지·십신·오행 코드뿐이라 서버 전송이 안전하다(ADR-005 PII 경계).
// ─────────────────────────────────────────────────────────────────────────
import { analyzeStarPalace } from '@engine/starPalace';
import { deriveHapMirror, deriveChungMirror, toMirrorChart } from '@engine/mirrorRomance';
import { profileOf } from '@engine/mirrorProfile';
import { concordanceOf } from '@engine/mirrorConcordance';
import type { Stem, PillarPos } from '@spec/chart';

const POS: PillarPos[] = ['년', '월', '일', '시'];

/** interpret body 에 실어 보낼 R60 산출(판정 완료본). */
export type RomanceMirrorPayload = {
  render: 'FULL' | 'DESCRIPTIVE_ONLY' | 'STAR_PALACE_ONLY';
  concordance: number;
  star: { primaryBranch: string | null; primaryTenGod?: string; transformedTo?: string; transformedTenGod?: string; contaminatedBy: string[] };
  palace: { branch: string; hidden: { stem: string; tenGod: string }[]; hasSpouseStar: boolean; johu: number; chungOpensTo: string[] };
  dualRelation: { pivot: string; toStar: string; toPalace: string } | null;
  ideal?: { ilgan: string; element: string; role: string; temp: number; top2: string[] };
  real?: { ilgan: string; element: string; role: string; temp: number; top2: string[] };
  flags: string[];
};

/**
 * 사주 원국 → R60 산출. 실패하면 null(호출측은 R60 없이 진행 — 통변을 막지 않는다).
 * @param saju computeChart(...).saju
 * @param sex  '남' | '여' — 배우자성이 갈린다(남=재성 · 여=관성)
 */
export function buildRomanceMirror(saju: any, sex: '남' | '여'): RomanceMirrorPayload | null {
  try {
    if (!saju?.pillars) return null;
    const P: any = {};
    for (const p of POS) {
      const cell = saju.pillars[p];
      if (!cell?.stem || !cell?.branch) return null;
      P[p] = { stem: cell.stem, branch: cell.branch };
    }
    const sp = analyzeStarPalace(P, sex);
    const natalStems = POS.map((p) => P[p].stem) as Stem[];
    const ideal = profileOf(deriveHapMirror(toMirrorChart({ pillars: P })), natalStems);
    const real = profileOf(deriveChungMirror(toMirrorChart({ pillars: P })).chart, natalStems);
    const c = concordanceOf(sp, ideal, real);

    // ★게이트가 STAR_PALACE_ONLY 면 경상 프로파일을 **애초에 실어 보내지 않는다**.
    //   Edge 프롬프트도 막지만, 값이 서버까지 가지 않는 편이 확실하다(§4.2).
    const withMirror = c.render !== 'STAR_PALACE_ONLY';
    const pack = (m: typeof ideal) => ({
      ilgan: m.ilgan, element: m.ilganElement, role: m.D2_ROLE, temp: m.D3_TEMP, top2: m.D4_TOP2 as string[],
    });

    return {
      render: c.render,
      concordance: c.score,
      star: {
        primaryBranch: sp.star.primaryBranch, primaryTenGod: sp.star.primaryTenGod,
        transformedTo: sp.star.transformedTo, transformedTenGod: sp.star.transformedTenGod,
        contaminatedBy: sp.star.contaminatedBy,
      },
      palace: {
        branch: sp.palace.branch,
        hidden: sp.palace.hidden.map((h) => ({ stem: h.stem, tenGod: h.tenGod })),
        hasSpouseStar: sp.palace.hasSpouseStar, johu: sp.palace.johu, chungOpensTo: sp.palace.chungOpensTo,
      },
      dualRelation: sp.dualRelation,
      ...(withMirror ? { ideal: pack(ideal), real: pack(real) } : {}),
      flags: [...sp.flags, ...c.flags],
    };
  } catch {
    return null;   // 산출 실패가 통변을 막지 않는다(R60 은 보조 레이어 — 스펙 §9-6)
  }
}
