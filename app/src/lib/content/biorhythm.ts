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
