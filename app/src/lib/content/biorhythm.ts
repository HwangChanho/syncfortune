// app/src/lib/content/biorhythm.ts — 바이오리듬(온디바이스·사주 무관 부가 재미·API 0)
// ─────────────────────────────────────────────────────────────────────────
// 07-21 코드 큐(daniel): 생년월일 기반 3주기 sine 곡선. 사주와 무관한 서양식 '부가 재미'.
//   · 신체(physical)   23일 주기
//   · 감정(emotional)  28일 주기
//   · 지성(intellectual) 33일 주기
//   값 = sin(2π × 경과일 / 주기) → -100~+100(%). +면 고조, -면 저조, 0 부근 = 전환(주의)일.
//
// ★계산 기준 = *양력 경과일*. 차트 input 이 음력('음')이면 lunar-javascript 로 양력 환산(만세력과 동일 라이브러리).
//   ⚠️음력 윤달은 Lunar.fromYmd 가 평달로 처리(부가 재미라 근사 허용·daniel 검수 슬롯).
// ⚠️명리 아님 = daniel stance 무관(순수 산술). 화면 문구(상태 라벨)만 검수 슬롯.
// ─────────────────────────────────────────────────────────────────────────
import { Lunar } from 'lunar-javascript';

export type BioValues = { physical: number; emotional: number; intellectual: number; days: number };

const CYCLE = { physical: 23, emotional: 28, intellectual: 33 } as const;

/** birthDateTime "YYYY-MM-DD HH:mm" + calendar('양'|'음') → 양력 생일 Date(실패 시 null). */
export function solarBirth(birthDateTime: string | undefined, calendar?: string): Date | null {
  const datePart = String(birthDateTime ?? '').split(/[ T]/)[0];        // 시각 버리고 날짜만
  const [y, m, d] = datePart.split('-').map((n) => parseInt(n, 10));
  if (!y || !m || !d) return null;
  let sy = y, sm = m, sd = d;
  if (calendar === '음' || calendar === '음력' || calendar === 'lunar') { // 음력 → 양력 환산(만세력 라이브러리 재사용)
    try { const s = Lunar.fromYmd(y, m, d).getSolar(); sy = s.getYear(); sm = s.getMonth(); sd = s.getDay(); } catch { /* 변환 실패 = 입력값 그대로(근사) */ }
  }
  return new Date(sy, sm - 1, sd);
}

/** 양력 생일 → 특정 날짜의 3주기 값(-100~+100). 생일 이전(days<0)이면 null. */
export function bioAt(birth: Date, day: Date): BioValues | null {
  const b = new Date(birth.getFullYear(), birth.getMonth(), birth.getDate());
  const t = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  const days = Math.round((t.getTime() - b.getTime()) / 86400000);
  if (!isFinite(days) || days < 0) return null;
  const v = (p: number) => Math.round(Math.sin((2 * Math.PI * days) / p) * 100);
  return { physical: v(CYCLE.physical), emotional: v(CYCLE.emotional), intellectual: v(CYCLE.intellectual), days };
}

/** 오늘 값(홈 카드). new Date()=앱 런타임(Workflow 아님). 실패 시 null(=미노출). */
export function bioToday(birthDateTime: string | undefined, calendar?: string): BioValues | null {
  const birth = solarBirth(birthDateTime, calendar);
  return birth ? bioAt(birth, new Date()) : null;
}

/** ±span일 창의 곡선 좌표(그래프용). 생일 이전 날짜는 0으로. */
export function bioSeries(birth: Date, center: Date, span = 14): { offsets: number[]; physical: number[]; emotional: number[]; intellectual: number[] } {
  const offsets: number[] = [];
  const physical: number[] = [], emotional: number[] = [], intellectual: number[] = [];
  for (let o = -span; o <= span; o++) {
    const d = new Date(center.getFullYear(), center.getMonth(), center.getDate() + o);
    const b = bioAt(birth, d);
    offsets.push(o);
    physical.push(b?.physical ?? 0); emotional.push(b?.emotional ?? 0); intellectual.push(b?.intellectual ?? 0);
  }
  return { offsets, physical, emotional, intellectual };
}

/** 값(-100~100) → 상태 라벨(일상어·daniel 검수 슬롯). 0 부근 = 전환(주의)일. */
export function bioState(v: number): '고조' | '양호' | '전환' | '저조' {
  if (v >= 60) return '고조';
  if (v >= 15) return '양호';
  if (v > -15) return '전환';
  return '저조';
}

// 축×상태 → 가벼운 결 문구(일상어·사주 무관 부가 재미·daniel 검수 슬롯).
const BIO_LINE: Record<'physical' | 'emotional' | 'intellectual', Record<ReturnType<typeof bioState>, string>> = {
  physical: {
    고조: '몸이 가볍고 활력이 넘쳐요 — 운동·활동·도전에 좋은 때예요.',
    양호: '체력이 무난해요 — 평소 페이스로 움직이기 좋아요.',
    전환: '컨디션 기복이 있는 때예요 — 무리 말고 페이스를 조절하세요.',
    저조: '체력이 떨어지는 때예요 — 휴식·회복을 먼저 챙기세요.',
  },
  emotional: {
    고조: '기분이 밝고 표현이 잘 돼요 — 만남·대화에 좋아요.',
    양호: '정서가 안정적이에요 — 마음이 편안한 때예요.',
    전환: '감정 기복·예민함이 있을 수 있어요 — 상하는 말은 흘려 보내요.',
    저조: '마음이 가라앉기 쉬운 때예요 — 혼자 재충전하는 게 좋아요.',
  },
  intellectual: {
    고조: '머리가 맑고 판단이 빨라요 — 공부·기획·결정에 좋아요.',
    양호: '사고가 무난해요 — 하던 일을 이어가기 좋아요.',
    전환: '집중이 흐트러지기 쉬운 때예요 — 중요한 결정은 잠시 미뤄요.',
    저조: '판단이 둔해지기 쉬운 때예요 — 큰 결정은 보류하세요.',
  },
};

/** 오늘 3주기 값 → 가벼운 풀이(축별 결 + 요약 한 줄). 사주 무관·문구=daniel 검수 슬롯. */
export function bioReading(v: BioValues): { physical: string; emotional: string; intellectual: string; summary: string } {
  const sP = bioState(v.physical), sE = bioState(v.emotional), sI = bioState(v.intellectual);
  // 요약 — 가장 높은 축은 활용, 가장 낮은(전환/저조) 축은 관리. 셋 다 좋으면 종합 긍정.
  const axes = [
    { key: '몸', v: v.physical }, { key: '마음', v: v.emotional }, { key: '생각', v: v.intellectual },
  ].sort((a, b) => b.v - a.v);
  const top = axes[0], bottom = axes[2];
  const summary = bottom.v >= 15
    ? `세 리듬이 다 올라 컨디션이 좋은 날이에요 — 하고 싶던 걸 밀어붙이기 좋아요.`
    : top.v < -15
    ? `세 리듬이 낮은 편이에요 — 오늘은 무리 없이 쉬어가는 날로 두세요.`
    : `오늘은 ‘${top.key}’이(가) 가장 올라 있고 ‘${bottom.key}’은(는) 낮은 편이에요 — ${top.key} 쪽 일을 앞세우고 ${bottom.key}은 무리하지 마세요.`;
  return { physical: BIO_LINE.physical[sP], emotional: BIO_LINE.emotional[sE], intellectual: BIO_LINE.intellectual[sI], summary };
}
