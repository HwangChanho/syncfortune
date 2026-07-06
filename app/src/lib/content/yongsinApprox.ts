// app/src/lib/content/yongsinApprox.ts — 경량 억부용신 (온디바이스·API 0) ★daniel 2026-07-06 스펙 동결(FROZEN) — 극/설/재 선택규칙·5분류·재생살·비겁감점 확정
// ─────────────────────────────────────────────────────────────────────────
// 엔진(buildSajuChart)은 L1 만세력만 채우고 용신(structure.usefulGod=L2)은 온디바이스에서 비어 있다.
//   무료 용신기반 티저(lifegraph·신년·취업 A·healing)가 용신을 필요로 하므로, 여기서 '억부용신'을
//   결정론으로 근사한다. ★핵심 계약: 이 모듈은 **Edge R2(용신)의 부분집합(억부만)** — 조후·통관·병약
//   미포함. Edge는 같은 선택규칙을 베이스로 import하고 그 위에 조후/통관/병약 보정만 얹는다(코드로 subset 보장).
//   두 결론이 갈리면 divergence — 무료엔 method:'억부근사' 태그, 유료 화면에서 "억부로는 X, 조후 보정으로 Y"로 서술.
//
// ▶ daniel 억부 선택규칙(旺者宜洩 = 억부 교과서 본문, 병약 레이어 아님):
//   신강 & 비겁過 주도:
//     IF 관살 기투출(천간급) 강도 ≥ 1.0:   # 극 루트 이미 포화 → 설기 전환
//         ★daniel 2026-07-06 정설 5분류(신강·비겁과다·설기용신 분기):
//           용신 食傷 / 희신 財(식상생재) / 기신 印(극용신+신강 이중흉) / 구신 官殺(생인+살중) /
//           한신 比劫(일간 오행) — 단, 비겁은 기신과 합치지 말고 별도 '과다 감점'(bigyeopExcessPenalty)으로 처리.
//         ★재생살(재+칠살)이어도 희신 財는 유지한다 — 곡선은 財=희신(+1.5)로 계산. 재생살은 edgeDefer(유료측 플래그)만.
//           (과거: 재생살 시 huisin=null 로 지웠던 것 = 버그. daniel: 희신 財 유지 + edgeDefer 만.)
//     ELSE:
//         용신 官殺 / 희신 財   # 기존(극 루트 미포화)
//   신강 & 인성過 주도 → 용신 財(재극인) / 희신 食傷
//   신약 → 용신 印 / 희신 比劫   (극신약 종격후보 = jonggyeokHold 플래그·판정보류→Edge)
//   중화 → 신강 로직의 약화판 + amplitudeScale ×0.5 (곡선 밋밋 = 정직)
//   기신 = 용신 극하는 오행 / 구신 = 기신 생하는 오행 (기계적 도출)
//
// ★검증 앵커(daniel 원국 甲戌·丁卯·辛丑·丁酉, 辛金): 신강·비겁過·관살(丁丁) 기투출 2.0≥1.0 → 설기
//   → 용신 水(食傷)·희신 木(財=식상생재)·기신 土(印)·구신 火(官殺)·한신 金(比劫, 과다감점 −1.25)·edgeDefer(재생살).
// ─────────────────────────────────────────────────────────────────────────
import { scoreStrength } from '@engine/structure';   // L1 신강약(온디바이스 유일 소스, personaType와 동일)
import { stemElement } from '../engine/ohaeng';        // 천간 → 오행(app-local lib/engine)
import type { SajuChart, Element, TenGod, PillarPos } from '@spec/chart';

// ── 오행 생/극 ──
const GEN: Record<Element, Element> = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' }; // X가 생하는 Y
const CTRL: Record<Element, Element> = { 木: '土', 火: '金', 土: '水', 金: '木', 水: '火' }; // X가 극하는 Y
const ALL_EL: Element[] = ['木', '火', '土', '金', '水'];
const genOf = (e: Element) => GEN[e];                                   // e가 생하는(= 식상)
const genBy = (e: Element) => ALL_EL.find((k) => GEN[k] === e)!;        // e를 생하는(= 인성)
const ctrlOf = (e: Element) => CTRL[e];                                 // e가 극하는(= 재성)
const ctrlBy = (e: Element) => ALL_EL.find((k) => CTRL[k] === e)!;      // e를 극하는(= 관살)

type Group = '비겁' | '식상' | '재성' | '관살' | '인성';
const GROUP_OF: Record<TenGod, Group> = {
  비견: '비겁', 겁재: '비겁', 식신: '식상', 상관: '식상',
  정재: '재성', 편재: '재성', 정관: '관살', 편관: '관살', 정인: '인성', 편인: '인성',
};
// 일간 오행 기준 각 그룹의 오행
const groupElement = (dmEl: Element, g: Group): Element =>
  g === '비겁' ? dmEl : g === '식상' ? genOf(dmEl) : g === '재성' ? ctrlOf(dmEl)
    : g === '관살' ? ctrlBy(dmEl) : genBy(dmEl);

export interface YongsinApprox {
  yongsin: Element;               // 용신(오행)
  huisin: Element | null;         // 희신(오행) — daniel 2026-07-06: 전 분기 non-null(재생살 null 처리 폐기). 타입은 하위호환 위해 |null 유지.
  gisin: Element;                 // 기신 = 용신 극
  gusin: Element;                 // 구신 = 기신 생
  bigyeopExcessPenalty: number;   // ★비겁 과다 감점(설기·비겁과다 분기에서만 −1.25[범위 −1.0~−1.5], else 0). 소비자가 비겁(일간 오행) 대운 score에 적용. 기신 土와 라벨 분리(daniel 2026-07-06).
  method: '억부근사';             // ★Edge R2 부분집합 태그(유료에서 divergence 서술)
  edgeDefer: boolean;             // 재생살 등 억부로 못 정하는 부분 → Edge 위임
  jonggyeokHold: boolean;         // 극신약 종격 후보 → 온디바이스 판정 보류(Edge)
  amplitudeScale: number;         // 중화=0.5(진폭 절반), else 1.0
  strengthVerdict: string;        // 신강/신왕/중화/신약(디버그·표시)
}

type Opts = { timeUnknown?: boolean };

/** 경량 억부용신 근사. lifegraph·신년·취업 A·healing 이 소비. */
export function computeYongsinApprox(saju: SajuChart, opts?: Opts): YongsinApprox {
  const timeUnknown = opts?.timeUnknown ?? (saju as any)?.timeUnknown === true;
  const posList: PillarPos[] = timeUnknown ? ['년', '월', '일'] : ['년', '월', '일', '시'];
  const dm = saju.dayMaster.stem;
  const dmEl = stemElement(dm) as Element; // stemElement은 string 반환(실제 오행) → Element 캐스트

  // ── 원국 그룹별 발동강도(천간 투출 1.0 + 지지 본기 0.55) + 관살 천간강도 + 재생살 재료 ──
  const gstr: Record<Group, number> = { 비겁: 0, 식상: 0, 재성: 0, 관살: 0, 인성: 0 };
  let gwansalCheongan = 0;   // 관살 '기투출'(천간급) 강도 — 극 루트 포화 판정
  let hasJae = false;        // 원국 재성 존재
  let hasPyeongwan = false;  // 원국 편관(칠살) 존재 — 재생살 판정
  for (const p of posList) {
    const d = saju.pillars?.[p];
    if (!d) continue;
    const stg = d.stemTenGod;                         // 천간 십신(투출)
    if (stg) {
      const g = GROUP_OF[stg]; gstr[g] += 1.0;
      if (g === '관살') gwansalCheongan += 1.0;
      if (g === '재성') hasJae = true;
      if (stg === '편관') hasPyeongwan = true;
    }
    const btg = d.branchMainTenGod;                   // 지지 본기 십신
    if (btg) {
      const g = GROUP_OF[btg]; gstr[g] += 0.55;
      if (g === '재성') hasJae = true;
      if (btg === '편관') hasPyeongwan = true;
    }
  }
  const jaesaengsal = hasJae && hasPyeongwan;          // 재생살 구조(재가 살을 생) — 희신 財 제거 트리거

  // ── 신강약 verdict(온디바이스 유일 소스) ──
  const verdict = String(scoreStrength(saju)?.verdict ?? '중화');
  const isStrong = verdict.includes('강') || verdict.includes('왕');  // 신강·신왕
  const isWeak = verdict.includes('약');                              // 신약
  const isMid = !isStrong && !isWeak;                                 // 중화

  // 그룹 오행 헬퍼
  const EL = (g: Group) => groupElement(dmEl, g);

  let yongsin: Element, huisin: Element | null, edgeDefer = false, jonggyeokHold = false;
  let amplitudeScale = 1.0;
  let bigyeopExcessPenalty = 0;                        // 설기·비겁과다 분기에서만 −1.25(비겁 대운 별도 감점), else 0

  if (isWeak) {
    // ── 신약 → 용신 印 / 희신 比劫 ──
    yongsin = EL('인성'); huisin = EL('비겁');
    // 극신약 종격 후보(일간 무근급: 인성·비겁이 거의 없어 부조 불가) → 판정 보류, Edge 위임
    if (gstr['인성'] + gstr['비겁'] < 0.8) { jonggyeokHold = true; edgeDefer = true; }
  } else {
    // ── 신강/신왕/중화 → 비겁過 vs 인성過 주도로 극/설/재 선택 ──
    if (isMid) amplitudeScale = 0.5;                  // 중화=약한 억부(진폭 절반)
    const bigyeopLed = gstr['비겁'] >= gstr['인성'];   // 강약 원인 주도
    if (bigyeopLed) {
      if (gwansalCheongan >= 1.0) {
        // ── 극 루트 포화 → 설기(旺者宜洩) 분기 ★daniel 2026-07-06 정설 5분류 ──
        //   용신 食傷 / 희신 財(식상생재) — 재생살이어도 희신 財 유지(곡선 財=희신 +1.5).
        yongsin = EL('식상'); huisin = EL('재성');
        //   한신 = 比劫(일간 오행)이지만 기신(印=土)과 라벨을 합치지 않고 '과다 감점'으로 분리.
        //     → 소비자(lifeGraph gzUsefulScore)가 비겁 오행 대운 score 에 이 감점을 더해 강도차·페어링을 깔끔히 유지.
        bigyeopExcessPenalty = -1.25;                 // 기본 −1.25(범위 −1.0~−1.5). daniel: 신강·비겁과다 → 비겁 대운 하강
        //   재생살(재+칠살): 재가 살을 키우는 구조 → 유료(Edge)에서 별도 서술. edgeDefer 만 세우고 희신 財는 지우지 않음.
        if (jaesaengsal) { edgeDefer = true; }
      } else {
        // 극 루트 미포화 → 극: 용신 官殺 / 희신 財
        yongsin = EL('관살'); huisin = EL('재성');
      }
    } else {
      // 인성過 주도 → 재극인: 용신 財 / 희신 食傷
      yongsin = EL('재성'); huisin = EL('식상');
    }
  }

  const gisin = ctrlBy(yongsin);   // 용신을 극하는 오행
  const gusin = genBy(gisin);      // 기신을 생하는 오행
  return { yongsin, huisin, gisin, gusin, bigyeopExcessPenalty, method: '억부근사', edgeDefer, jonggyeokHold, amplitudeScale, strengthVerdict: verdict };
}

/** 임의 오행을 이 억부 결과 기준 5분류(용신/희신/한신/기신/구신)로 룩업 — lifegraph/신년/job 5분류 재사용. */
export type HuiGiClass = '용신' | '희신' | '한신' | '기신' | '구신';
export function yongsinToClass5(el: Element, y: YongsinApprox): HuiGiClass {
  if (el === y.yongsin) return '용신';
  if (y.huisin && el === y.huisin) return '희신';
  if (el === y.gisin) return '기신';
  if (el === y.gusin) return '구신';
  return '한신';
}
