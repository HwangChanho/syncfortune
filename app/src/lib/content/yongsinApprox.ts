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
import { scoreStrength, classifyStrength } from '@engine/structure'; // L1 신강약(온디바이스 유일 소스, personaType와 동일) + 종격 후보 flag
import { stemElement } from '../engine/ohaeng';        // 천간 → 오행(app-local lib/engine)
import type { SajuChart, Element, TenGod, PillarPos } from '@spec/chart';
// ★★용신 결정 = canonical 엔진 위임(daniel 2026-07-16 "용신 근사부터 고치기") ─────────────────────
//   문제: 이 파일의 구 경량 억부는 daniel 辛丑에 **水**를 냈다 — 그런데 canonical(골든 검증)은 **병약 → 土**이고,
//         전문가 재판정([[expert-review-2026-07-14]])도 "용신=정인(土) 고정 · 구 水동태 폐기"였다. 즉 앱만 폐기값을 냈다.
//   원인: 앱은 canonical의 복사본이 아니라 **별도 경량 구현**(07-06 "온디바이스 usefulGod 공란" 대응)이라
//         07-14 검수 반영 대상에서 구조적으로 빠졌다. check:prompts 도 이 드리프트를 못 잡는다.
//   해법: 용신·희기 **결정 자체**를 canonical 에 넘긴다 → 앱·Edge·골든이 한 답(단일 출처·명리 발명 없음).
//         앱 고유 파생(bigyeopExcessPenalty·amplitudeScale·edgeDefer·jonggyeokHold)은 소비자(lifeGraph 등)가
//         쓰므로 **기존 산식 그대로 유지**한다 = 호출부 9곳 무변경.
//   가능 근거: app/metro.config.js `watchFolders=[workspaceRoot]` → interpretation/ 도 번들된다(@engine/* 와 동일 방식).
import { yongsinApprox as canonicalYongsin, type YongsinInput } from '../../../../interpretation/engine/yongsinApprox';

/** scoreStrength verdict → canonical 5단계 어휘. ★'신왕'은 canonical 어휘에 없어 '신강'으로 접는다(엔진 골든과 동일 취급). */
const toCanonVerdict = (v: string): YongsinInput['verdict'] =>
  v.includes('극신강') ? '극신강'
    : v.includes('극신약') ? '극신약'
      : (v.includes('강') || v.includes('왕')) ? '신강'
        : v.includes('약') ? '신약'
          : '중화';

/** 앱 십신 그룹(관살·재성·인성) → canonical 그룹 키(관·재·인). 나머지는 동일. */
const CANON_KEY: Record<Group, '비겁' | '식상' | '재' | '관' | '인'> = { 비겁: '비겁', 식상: '식상', 재성: '재', 관살: '관', 인성: '인' };

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
  // ★canonical 산출 방법(2026-07-16 위임 후) — 구 '억부근사' 태그 폐기. 억부만이 아니라 조후·병약·격국까지 나온다.
  //   ※현재 이 필드를 읽는 소비자는 없다(디버그·표시용). 있으면 여기 타입을 먼저 좁힐 것.
  method: '억부' | '조후' | '병약' | '종격' | '통관';
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
  // ── canonical 입력용 십성 '개수' 집계(위 gstr 의 가중강도와 별개) — Edge careerReport 와 동일 방식 ──
  //   canonical 은 병약 성립 판정에 천간 투출/지지 통근을 **분리해서** 요구한다(합산 sipsinCount 로는 구분 불가).
  type CK = '비겁' | '식상' | '재' | '관' | '인';
  const cnt: Partial<Record<CK, number>> = {}; // 전체(천간+지지 본기)
  const cg: Partial<Record<CK, number>> = {};  // 천간 투출 수
  const jj: Partial<Record<CK, number>> = {};  // 지지 본기 통근 수
  const bumpCanon = (k: CK, isStem: boolean) => {
    cnt[k] = (cnt[k] ?? 0) + 1;
    const o = isStem ? cg : jj;
    o[k] = (o[k] ?? 0) + 1;
  };
  for (const p of posList) {
    const d = saju.pillars?.[p];
    if (!d) continue;
    const stg = d.stemTenGod;                         // 천간 십신(투출) — 일간 자신은 십신이 없어 자동 제외
    if (stg) {
      const g = GROUP_OF[stg]; gstr[g] += 1.0;
      if (g === '관살') gwansalCheongan += 1.0;
      if (g === '재성') hasJae = true;
      if (stg === '편관') hasPyeongwan = true;
      bumpCanon(CANON_KEY[g], true);
    }
    const btg = d.branchMainTenGod;                   // 지지 본기 십신
    if (btg) {
      const g = GROUP_OF[btg]; gstr[g] += 0.55;
      if (g === '재성') hasJae = true;
      if (btg === '편관') hasPyeongwan = true;
      bumpCanon(CANON_KEY[g], false);
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

  // ── ① 앱 고유 파생 플래그 — canonical 이 주지 않는 값. 소비자(lifeGraph·newyearGauge·newyearCategoryFlow)가
  //      쓰므로 **기존 산식을 그대로 유지**한다(용신 결정만 canonical 로 옮긴 것이지 이 값들의 의미는 안 바뀐다).
  let edgeDefer = false, jonggyeokHold = false;
  let amplitudeScale = 1.0;
  let bigyeopExcessPenalty = 0;                        // 설기·비겁과다 분기에서만 −1.25(비겁 대운 별도 감점), else 0
  if (isWeak) {
    // 극신약 종격 후보(일간 무근급: 인성·비겁이 거의 없어 부조 불가) → 판정 보류, Edge 위임
    if (gstr['인성'] + gstr['비겁'] < 0.8) { jonggyeokHold = true; edgeDefer = true; }
  } else {
    if (isMid) amplitudeScale = 0.5;                  // 중화=약한 억부(진폭 절반·곡선 밋밋=정직)
    const bigyeopLed = gstr['비겁'] >= gstr['인성'];   // 강약 원인 주도
    if (bigyeopLed && gwansalCheongan >= 1.0) {
      // 극 루트 포화 → 설기(旺者宜洩) ★daniel 2026-07-06 정설 5분류.
      //   한신 = 比劫(일간 오행)이지만 기신과 라벨을 합치지 않고 '과다 감점'으로 분리
      //   → 소비자(lifeGraph gzUsefulScore)가 비겁 오행 대운 score 에 이 감점을 더해 강도차·페어링을 유지.
      bigyeopExcessPenalty = -1.25;                   // 기본 −1.25(범위 −1.0~−1.5). daniel: 신강·비겁과다 → 비겁 대운 하강
      if (jaesaengsal) { edgeDefer = true; }          // 재생살(재+칠살) → 유료(Edge)에서 별도 서술
    }
  }

  // ── ② ★용신·희기 = canonical 엔진 결정(억부만이 아니라 **조후·병약·격국**까지) ─────────────────
  //   구 로직(이 자리에 있던 앱 자체 억부 5분류)은 daniel 辛丑에 水를 냈고 canonical 골든은 土(병약)였다 → 폐기.
  //   이제 앱·Edge·골든이 같은 답을 낸다. 파일 상단 주석 참조.
  const canon = canonicalYongsin({
    dayEl: dmEl,
    verdict: toCanonVerdict(verdict),
    monthBranch: saju.pillars?.['월']?.branch as YongsinInput['monthBranch'],
    jonggyeokCandidate: !!(classifyStrength(saju) as { jonggyeokCandidate?: boolean } | undefined)?.jonggyeokCandidate,
    sipsinCount: cnt, cheonganCount: cg, jijiRootCount: jj,
    natalBranches: posList.map((p) => saju.pillars?.[p]?.branch).filter(Boolean) as YongsinInput['natalBranches'],
    dayStem: dm as YongsinInput['dayStem'],
    // gukSipsin(삼합/방합 국)은 미주입 — Edge careerReport 와 동일(현재 병약 트리거는 천간 투출로 충분·daniel 앵커 검증됨).
  });
  const yongsin = canon.yongsin;
  // 앱 인터페이스는 '단일' 희신 — canonical 의 희신 집합(=용신+생조)에서 용신 자신을 뺀 첫 오행.
  const huisin: Element | null = [...canon.hui].find((e) => e !== yongsin) ?? null;
  const gisin = [...canon.gi][0] ?? ctrlBy(yongsin); // 기신 = 용신 극(종격이면 canonical 이 역전 판정하므로 집합을 우선)
  const gusin = genBy(gisin);                        // 구신 = 기신 생
  if (canon.method === '종격') jonggyeokHold = true; // canonical 이 종격 판정 → 온디바이스 신뢰도 낮춤(기존 의미 유지)

  // ── ③ ★비겁 감점 재판정 — 병약 프레임(daniel 2026-07-16 판정) ─────────────────────────────
  //   위 −1.25 는 **구 억부 '설기' 분기**(신강+비겁과다 → 비겁 자체를 부담으로 본)의 감점이다.
  //   canonical 이 병약으로 수렴하면 프레임이 달라진다:
  //     · 병(病) = 관살(일간을 극 = 필수기능 억압) — **비겁이 아니다**
  //     · 약(藥) = 인성(살인상생으로 살을 화한다)
  //     · 비겁은 그 인성이 생하는 대상(土生金) = **약의 수혜자**
  //   daniel 판정: "비겁이 여전히 병으로 남아있다면 감점 유지 / 인성이 약으로 작동하고 비겁이 약의 수혜자라면
  //                 감점 근거 약화 → 계수 제거." → **제거(0)**.
  //   ⚠️억부 설기 분기(비겁과다=병)에서는 위 −1.25 를 그대로 둔다 — 그땐 비겁이 실제로 병이다.
  if (canon.method === '병약' && yongsin === EL('인성')) bigyeopExcessPenalty = 0;
  return { yongsin, huisin, gisin, gusin, bigyeopExcessPenalty, method: canon.method, edgeDefer, jonggyeokHold, amplitudeScale, strengthVerdict: verdict };
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
