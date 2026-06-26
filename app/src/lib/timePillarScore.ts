// app/src/lib/timePillarScore.ts — TPR 2단계: 사주 스코어링 (기획 §7.2~7.4, 온디바이스·결정론)
// ─────────────────────────────────────────────────────────────────────────
// 시주 후보 12개를 사용자 인생 사건(증거)에 대조해 정합성 점수로 좁힌다.
// engine/run-tpr-verify.ts 검증 하네스에서 daniel 케이스로 검증된 신호/매핑을 *일반화*해 이식.
//
// ★★ 역할 경계(CLAUDE.md §3.2·§6):
//   · 결정론 신호 추출(십이운성·신살·충합·강약) = 엔진 검수 룰 그대로(Claude).
//   · 사건유형↔구조 매핑·가중치(투자손실=재성충, 이사=원국충 등) = daniel golden stance → R7Config 슬롯.
//   ⚠️ 현재 가중치는 daniel 케이스(n=1) 기반 = 과적합 가능. **블라인드(시각 아는 타인) 검증 전엔 잠정.**
//   MVP(§14) = 사주 단독(자미 wZwds=0, 차기). 후보 시각마다 buildSajuChart로 12개 사주를 만들어 평가.
// ─────────────────────────────────────────────────────────────────────────
import type { ChartInput, Stem, Branch } from '@spec/chart';
import { buildSajuChart } from '@engine/saju';
import { dayMasterStages } from '@engine/twelve';
import { detectInteractions, detectInteractionsAmong } from '@engine/structure';
import type { TimePillarCandidate } from './timePillar';

// ── 증거 입력(기획 §6 문항) ──
export type BigEventType = '결혼' | '이혼' | '이직' | '창업' | '질병' | '사고' | '투자손실' | '이사' | '기타';
export type LifeEvent = { year: number; type: BigEventType };
export type TPREvents = {
  events?: LifeEvent[];                          // D1~D3: 연도+유형(앵커 핵심)
  hasChildren?: boolean;                         // A1
  childFirstYear?: number;                       // A4 (세운 앵커)
  temperament?: '계획형' | '즉흥형';              // C1
};

// ── R7 config — 가중치(daniel 검수 슬롯). 현재값은 daniel 케이스 캘리브레이션(잠정·과적합 주의). ──
export type R7Config = {
  wSaju: number; wZwds: number;                  // 사주 vs 자미(MVP: 1/0)
  strongStage: number;                           // 십이운성 강근(건록·제왕·장생·관대)
  johu: number;                                  // 조후 부합(시간 천간이 조후 오행)
  anchorChung: number; anchorHyeong: number; anchorHap: number; // 앵커 충/형·파·해/합 차등
  wealthHit: number;                             // 투자손실 ↔ 재성 직격(시주가 재성지 충)
  moveHit: number;                               // 이사·이동 ↔ 원국 충
  tauHigh: number; tauLow: number;               // 확정 판정 임계(§7.4)
};
export const R7_DEFAULT: R7Config = {
  wSaju: 1, wZwds: 0,
  strongStage: 1.0, johu: 0.8,
  anchorChung: 0.8, anchorHyeong: 0.2, anchorHap: 0.15,
  wealthHit: 1.2, moveHit: 0.6,
  tauHigh: 0.20, tauLow: 0.08,
};

export type ScoredCandidate = { candidate: TimePillarCandidate; score: number; prob: number; signals: string[] };
export type TPRVerdict = { kind: 'confirmed' | 'shortlist' | 'inconclusive'; top: ScoredCandidate[]; confidence: number };

// ── 결정론 헬퍼(일반화 — 어느 명식이든) ──
const STEM_ELEM: Record<Stem, string> = { 甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水' };
const BRANCH_BONGI: Record<Branch, Stem> = { 子: '癸', 丑: '己', 寅: '甲', 卯: '乙', 辰: '戊', 巳: '丙', 午: '丁', 未: '己', 申: '庚', 酉: '辛', 戌: '戊', 亥: '壬' };
const STRONG_STAGES = new Set(['장생', '관대', '건록', '제왕']);
const CHUNG = new Set(['子午', '午子', '丑未', '未丑', '寅申', '申寅', '卯酉', '酉卯', '辰戌', '戌辰', '巳亥', '亥巳']);
const isChung = (a: string, b: string) => CHUNG.has(a + b);
// 일간이 극하는 오행 = 재성. 그 오행을 본기로 갖는 지지 = 재성지(정/편재).
const CONTROLS: Record<string, string> = { 木: '土', 火: '金', 土: '水', 金: '木', 水: '火' };
const GEN: Record<string, string> = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' }; // 생(生)
// 일간 기준 십신 영역의 지지(재/관/인/식/비) — daniel stance: 충·해받는 글자의 십신=사건 영역.
function organBranches(dayStem: Stem, organ: '재' | '관' | '인' | '식' | '비'): Branch[] {
  const me = STEM_ELEM[dayStem];
  const target =
    organ === '재' ? CONTROLS[me] :                                                  // 내가 극 = 재성
    organ === '관' ? (Object.keys(CONTROLS) as string[]).find((k) => CONTROLS[k] === me)! : // 나를 극 = 관성
    organ === '인' ? (Object.keys(GEN) as string[]).find((k) => GEN[k] === me)! :    // 나를 생 = 인성
    organ === '식' ? GEN[me] : me;                                                   // 내가 생 = 식상 / 동일 = 비겁
  return (Object.keys(BRANCH_BONGI) as Branch[]).filter((b) => STEM_ELEM[BRANCH_BONGI[b]] === target);
}
const wealthBranches = (dayStem: Stem) => organBranches(dayStem, '재');
// 사건유형 → 십신 영역(daniel stance). 질병/사고=몸(일지·일간 충해), 이사=이동(충).
const EVENT_ORGAN: Partial<Record<BigEventType, '재' | '관' | '인' | '식' | '비'>> = {
  투자손실: '재', 창업: '재', 결혼: '재', 이직: '관', // (남 기준; 여=관·자녀=식상 등은 차기)
};
// 지지 해(害) — daniel: 충뿐 아니라 해도 신호(특히 건강).
const HAE = new Set(['子未', '未子', '丑午', '午丑', '寅巳', '巳寅', '卯辰', '辰卯', '申亥', '亥申', '酉戌', '戌酉']);
const isHae = (a: string, b: string) => HAE.has(a + b);
// 봄 금 등 조후 — MVP는 '월령이 木(봄)이고 일간이 金'일 때 火를 조후로 보는 golden 케이스만(일반 조후는 차기).
function isJohuFit(dayStem: Stem, hourStem: Stem, monthBranch: Branch): boolean {
  const cold = STEM_ELEM[BRANCH_BONGI[monthBranch]] === '木' && STEM_ELEM[dayStem] === '金';
  return cold && STEM_ELEM[hourStem] === '火';
}

const _STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'] as const;
const _BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'] as const;
function yearGZ(y: number): { stem: Stem; branch: Branch } {
  const i = ((y - 4) % 60 + 60) % 60;
  return { stem: _STEMS[i % 10], branch: _BRANCHES[i % 12] };
}
// 각 시지 중앙 시각(시계상; 진태양시 보정은 buildSajuChart가 birthPlace로 처리)
const HOUR_BY_BRANCH: Record<Branch, string> = {
  子: '00:30', 丑: '02:30', 寅: '04:30', 卯: '06:30', 辰: '08:30', 巳: '10:30',
  午: '12:30', 未: '14:30', 申: '16:30', 酉: '18:30', 戌: '20:30', 亥: '22:30',
};
function withHour(birthDateTime: string, hm: string): string {
  const date = birthDateTime.split(/[ T]/)[0];
  return `${date} ${hm}`;
}
function interKind(x: any): string { return String(x?.kind ?? x?.type ?? x?.relation ?? ''); }

/**
 * 시주 후보 스코어링 — 시 마스킹된 입력 + 사건 → 후보별 점수 → softmax → 확정 판정.
 * 결정론. 신호는 엔진 룰, 가중치/매핑은 config(daniel 검수 슬롯).
 */
export function scoreTimePillars(
  baseInput: ChartInput,
  events: TPREvents,
  config: R7Config = R7_DEFAULT,
): { ranked: ScoredCandidate[]; verdict: TPRVerdict } {
  const evs = events.events ?? [];
  const scored: ScoredCandidate[] = (Object.keys(HOUR_BY_BRANCH) as Branch[]).map((br) => {
    const saju = buildSajuChart({ ...baseInput, birthDateTime: withHour(baseInput.birthDateTime, HOUR_BY_BRANCH[br]) });
    const P = saju.pillars;
    const si = P['시'];
    const dayStem = P['일'].stem;
    const monthBranch = P['월'].branch;
    const natalBranches = [P['년'].branch, P['월'].branch, P['일'].branch];
    const sig: string[] = [];
    let s = 0;

    // 1) 십이운성(일간이 시지에서)
    const stage = dayMasterStages(saju)['시'];
    sig.push(`운성:${stage}`);
    if (STRONG_STAGES.has(stage)) s += config.strongStage;

    // 2) 충·합·형(시주 관여) — 엔진 검출
    for (const it of detectInteractions(saju).filter((i) => i.members.includes('시'))) {
      sig.push(`${interKind(it) || '합충'}:${it.members.join('')}`);
    }

    // 3) 조후(봄 금 → 火 — golden 케이스. 일반 조후는 차기)
    if (isJohuFit(dayStem, si.stem, monthBranch)) { sig.push('조후:火✓'); s += config.johu; }

    // 4) 앵커정합 — 사건 연도 세운 vs 시주: 충>형/파/해>합 차등
    for (const ev of evs) {
      const gz = yearGZ(ev.year);
      for (const x of detectInteractionsAmong([
        { pos: '시' as any, stem: si.stem, branch: si.branch },
        { pos: '세운' as any, stem: gz.stem, branch: gz.branch },
      ])) {
        const k = interKind(x);
        if (/충/.test(k)) { sig.push(`앵커:${ev.year}${gz.branch}충`); s += config.anchorChung; }
        else if (/형|파|해/.test(k)) s += config.anchorHyeong;
        else if (/합/.test(k)) s += config.anchorHap;
      }
    }

    // 5) 사건유형↔구조 매핑(daniel stance: 충·해받는 글자의 십신 = 사건 영역)
    for (const ev of evs) {
      const organ = EVENT_ORGAN[ev.type];
      if (organ && organBranches(dayStem, organ).some((t) => isChung(si.branch, t) || isHae(si.branch, t))) {
        sig.push(`★${organ}성직격(${ev.type})`); s += config.wealthHit;          // 재/관/인/식/비 직격
      }
      // 건강(몸) = 일지·일간을 충/해(daniel: 운에서 해·충 들면 몸이 아픔)
      if (/질병|사고/.test(ev.type) && (isChung(si.branch, P['일'].branch) || isHae(si.branch, P['일'].branch))) {
        sig.push('몸(건강↔일지충해)'); s += config.wealthHit * 0.8;
      }
    }
    // 이사·이동 = 원국 충(golden: "이동=卯酉충·丑戌형")
    if (evs.some((e) => e.type === '이사') && natalBranches.some((nb) => isChung(si.branch, nb))) {
      sig.push('이동충(이사↔충)'); s += config.moveHit;
    }

    return { candidate: { branch: br, stem: si.stem, hourRange: '' }, score: s, prob: 0, signals: sig };
  });

  // softmax → 확률(§7.4)
  const probs = softmax(scored.map((x) => x.score));
  scored.forEach((x, i) => { x.prob = probs[i]; });
  const ranked = [...scored].sort((a, b) => b.prob - a.prob);
  return { ranked, verdict: decideVerdict(ranked, config) };
}

function softmax(xs: number[]): number[] {
  if (!xs.length) return [];
  const max = Math.max(...xs);
  const exps = xs.map((x) => Math.exp(x - max));
  const sum = exps.reduce((a, b) => a + b, 0) || 1;
  return exps.map((e) => e / sum);
}

function decideVerdict(ranked: ScoredCandidate[], config: R7Config): TPRVerdict {
  const top1 = ranked[0];
  const margin = (top1?.prob ?? 0) - (ranked[1]?.prob ?? 0);
  const confidence = top1?.prob ?? 0;
  if (top1 && margin >= config.tauHigh) return { kind: 'confirmed', top: [top1], confidence };
  if (top1 && margin >= config.tauLow) return { kind: 'shortlist', top: ranked.slice(0, 3), confidence };
  return { kind: 'inconclusive', top: ranked.slice(0, Math.min(ranked.length, 4)), confidence };
}
