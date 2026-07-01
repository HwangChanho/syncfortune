// app/src/lib/celebrities.ts — 세계를 움직이는 사람들 사주 DB(daniel 기획 B, 2026-06-24)
// ─────────────────────────────────────────────────────────────────────────
// daniel: 본인 사주를 세계 유명인과 매칭 + 그들 운 흐름으로 시대 흐름 힌트.
// ⚠️ 안전(필수): ① *재미·추정 콘텐츠*(임상 아님) ② 실존 인물 명예 존중(부정 단정·비방 금지)
//   ③ **투자 단정 절대 금지** — 흐름의 '방향성·분위기'만, 종목·매매 조언 아님(CLAUDE.md §4 재테크 조언 금지).
// 생년월일=공개 정보. 출생 시각 미상이 많아 *시주 제외(시간 무관 통변)*로 다룬다(timeUnknown).
// ★ 인물 선정·생일 정확도·통변 stance = daniel 검수 슬롯.
// ─────────────────────────────────────────────────────────────────────────

import type { ChartInput } from '@spec/chart';

export type Celebrity = {
  id: string;
  name: string;
  flag: string;        // 국기 emoji
  role: string;        // 분야(정치·경제·기술 등)
  birth: string;       // YYYY-MM-DD (공개 정보). 시각 미상 → 시주 제외
  blurb: string;       // 한 줄 소개
};

// 공개된 생년월일 기준(시각 대부분 미상 → 시간 무관 통변). ★daniel 검수: 인물·날짜 확정.
export const CELEBRITIES: Celebrity[] = [
  { id: 'trump', name: '도널드 트럼프', flag: '🇺🇸', role: '정치', birth: '1946-06-14', blurb: '미국 정치를 흔드는 승부사' },
  { id: 'xi', name: '시진핑', flag: '🇨🇳', role: '정치', birth: '1953-06-15', blurb: '중국을 이끄는 장기 집권자' },
  { id: 'musk', name: '일론 머스크', flag: '🇺🇸', role: '기술·경제', birth: '1971-06-28', blurb: '전기차·우주·AI의 파괴적 혁신가' },
  { id: 'buffett', name: '워런 버핏', flag: '🇺🇸', role: '투자', birth: '1930-08-30', blurb: '오마하의 현인, 가치투자의 상징' },
  { id: 'putin', name: '블라디미르 푸틴', flag: '🇷🇺', role: '정치', birth: '1952-10-07', blurb: '러시아의 강성 장기 집권자' },
  { id: 'biden', name: '조 바이든', flag: '🇺🇸', role: '정치', birth: '1942-11-20', blurb: '오랜 정치 경력의 미국 대통령' },
  { id: 'jobs', name: '스티브 잡스', flag: '🇺🇸', role: '기술', birth: '1955-02-24', blurb: '애플을 세운 비전의 아이콘' },
  { id: 'gates', name: '빌 게이츠', flag: '🇺🇸', role: '기술·자선', birth: '1955-10-28', blurb: '마이크로소프트 창업·자선가' },
];

/** 시각 미상 유명인의 차트 입력(시주 제외 — timeAccuracy='미상'). computeChart 에 그대로 넣어 쓴다. */
export function celebChartInput(c: Celebrity): ChartInput {
  return {
    birthDateTime: `${c.birth} 12:00`, // 정오 기준(시각 미상이라 시주는 통변에서 제외)
    calendar: '양',
    timeAccuracy: '미상',               // 출생 시각 미상 → 시간 기반 통변 금지(시주 제외)
    sex: '남',                          // 현재 목록 전원 남성(여성 인물 추가 시 개별 지정)
    birthPlace: '서울',                 // 진태양시 보정 기본값(시주 제외라 영향 미미)
  };
}
