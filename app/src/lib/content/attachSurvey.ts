// src/lib/content/attachSurvey.ts — 성인 애착 **자체 문항** + 채점 (온디바이스 · API 0)
// ─────────────────────────────────────────────────────────────────────────
// 왜 자체 문항인가 (전문가 §9 확정):
//   ECR-R 한국판(김성현 36문항)은 **번안본 권리가 별개**라 상업 앱에 그대로 실을 수 없다.
//   → **제품 = 자체 문항 / 연구 = ECR-R(별도 허가)** 로 arm 을 나누고,
//     두 도구를 모두 응답한 **중첩 표본 150명**으로 상관을 확보해 "ECR-R 준거로 캘리브레이션"이라 말한다.
//   ⚠️그러므로 이 문항들은 **ECR-R 의 번역·번안이 아니다.** 문항을 고칠 때도 원척도 문장을 옮겨오지 말 것.
//
// ■ 회피 문항을 두 계열로 나눈 이유 (전문가 §6 — 이게 핵심 설계)
//   자기보고식 애착검사는 **회피 높은 사람을 안정형으로 잡아내는 경향**이 잘 알려져 있다.
//   특히 무식상 프로파일이면 "정서적 곤란 없음"에 체크하는 게 그 사람에겐 자연스러운 응답이라,
//   **원국 예측과 자기보고가 같은 원인으로 나란히 어긋난다.**
//   → 회피를 `solo`(혼자가 편하다) / `close`(가까워지면 불편하다) 두 계열로 태깅해 **응답 패턴 차이**를 따로 본다.
//     solo 만 높고 close 는 낮으면 = 자기표상은 긍정적인데 실제 거리두기는 있는 형태일 수 있다.
//
// ⚠️§4 안전: 이 문항들은 **진단이 아니다.** 임상 절단점을 두지 않고, 결과 화면도 유형을 선고하지 않는다.
// ─────────────────────────────────────────────────────────────────────────

/** 문항이 재는 축. */
export type AttachAxisKey = 'anxiety' | 'avoidance';
/** 회피 하위 계열(§6 편향 보정용). 불안 문항은 undefined. */
export type AvoidFamily = 'solo' | 'close';

export type AttachItem = {
  /** 안정 키 — 응답 저장·회귀 컬럼명. **문구를 고쳐도 이 키는 바꾸지 말 것**(과거 응답과 안 이어진다). */
  id: string;
  axis: AttachAxisKey;
  family?: AvoidFamily;
  /** 문항 문구(ko). ★상담가 검수 대상. */
  text: string;
};

/** 7점 리커트 — 1 전혀 아니다 … 7 매우 그렇다. */
export const SCALE_MIN = 1;
export const SCALE_MAX = 7;
export const SCALE_LABELS = ['전혀 아니다', '아니다', '조금 아니다', '보통', '조금 그렇다', '그렇다', '매우 그렇다'];

/**
 * 문항 12개 (불안 6 · 회피 6 = solo 3 + close 3).
 * ★분량을 12개로 묶은 이유: 앱에서 끝까지 응답할 수 있는 길이 + 축당 6문항이면 내적일관성을 볼 최소치는 된다.
 * ⚠️v0 한계 — **역채점 문항이 없다.** 무응답·일괄응답(전부 4번) 탐지가 약하다. 표본이 쌓이면 보강한다.
 */
export const ATTACH_ITEMS: AttachItem[] = [
  // ── 불안 축: 상실 공포 · 과잉 근접추구 ──
  { id: 'anx1', axis: 'anxiety', text: '가까운 사람의 답장이 늦으면 내가 뭘 잘못했나 되짚어 본다' },
  { id: 'anx2', axis: 'anxiety', text: '상대가 요즘 좀 멀게 느껴지면 그 생각이 하루 종일 남는다' },
  { id: 'anx3', axis: 'anxiety', text: '내가 상대를 생각하는 만큼 상대도 그런지 확인하고 싶어진다' },
  { id: 'anx4', axis: 'anxiety', text: '관계가 잘 풀릴 때도 이게 언제 끝날지 모른다는 생각이 스친다' },
  { id: 'anx5', axis: 'anxiety', text: '상대의 기분이 안 좋아 보이면 나 때문일 가능성부터 떠오른다' },
  { id: 'anx6', axis: 'anxiety', text: '연락이 뜸해지면 내가 먼저 연락해 확인하는 편이다' },

  // ── 회피 축 A: '혼자가 편하다' 계열(solo) — 자기표상이 긍정적인 쪽으로 응답되기 쉬운 문항 ──
  { id: 'avo_s1', axis: 'avoidance', family: 'solo', text: '누구에게도 기대지 않고 스스로 해결할 때 마음이 편하다' },
  { id: 'avo_s2', axis: 'avoidance', family: 'solo', text: '힘든 일이 있어도 굳이 말로 꺼내지 않고 혼자 정리하는 편이다' },
  { id: 'avo_s3', axis: 'avoidance', family: 'solo', text: '오래 함께 있으면 혼자 있는 시간이 간절해진다' },

  // ── 회피 축 B: '가까워지면 불편하다' 계열(close) — 거리두기를 직접 묻는 문항 ──
  { id: 'avo_c1', axis: 'avoidance', family: 'close', text: '상대가 더 가까워지려 하면 나도 모르게 한 발 물러선다' },
  { id: 'avo_c2', axis: 'avoidance', family: 'close', text: '속마음까지 다 보여 주는 관계는 부담스럽다' },
  { id: 'avo_c3', axis: 'avoidance', family: 'close', text: '누군가 내게 깊이 의지하면 답답한 느낌이 든다' },
];

export type AttachAnswers = Record<string, number>; // id → 1..7

export type SurveyResult = {
  /** 0~1 정규화 점수(사주 축과 같은 눈금으로 비교하려고). */
  anxiety: number;
  avoidance: number;
  /** 회피 하위 계열 각각 — §6 편향 점검용. */
  avoidSolo: number;
  avoidClose: number;
  /**
   * §6 편향 신호. solo 는 높은데 close 는 낮은 폭(0~1).
   * ★해석을 여기서 하지 않는다 — 수치만 낸다. "이러면 회피형이다" 같은 판정은 데이터가 쌓인 뒤의 일이다.
   */
  soloCloseGap: number;
  /** 응답한 문항 수 / 전체. 미완이면 화면이 결과를 못 내게 막는 근거. */
  answered: number;
  total: number;
};

/** 1..7 평균 → 0..1. */
const norm = (vals: number[]) =>
  vals.length ? Math.round(((vals.reduce((a, b) => a + b, 0) / vals.length - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)) * 1000) / 1000 : 0;

/**
 * 응답 채점.
 * @param ans 문항 id → 1~7. 빠진 문항은 **평균에서 제외**한다(0 으로 치면 응답을 안 한 게 '전혀 아니다'가 된다).
 * @returns 0~1 로 정규화한 두 축 + 회피 하위 계열 + 진행률.
 */
export function scoreSurvey(ans: AttachAnswers): SurveyResult {
  const pick = (f: (i: AttachItem) => boolean) =>
    ATTACH_ITEMS.filter(f).map((i) => ans[i.id]).filter((v): v is number => typeof v === 'number');

  const avoidSolo = norm(pick((i) => i.family === 'solo'));
  const avoidClose = norm(pick((i) => i.family === 'close'));

  return {
    anxiety: norm(pick((i) => i.axis === 'anxiety')),
    avoidance: norm(pick((i) => i.axis === 'avoidance')),
    avoidSolo,
    avoidClose,
    soloCloseGap: Math.round(Math.max(0, avoidSolo - avoidClose) * 1000) / 1000,
    answered: ATTACH_ITEMS.filter((i) => typeof ans[i.id] === 'number').length,
    total: ATTACH_ITEMS.length,
  };
}
