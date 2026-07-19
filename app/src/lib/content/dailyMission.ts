// src/lib/content/dailyMission.ts — 오늘의 한 가지(미션) · 무료·온디바이스·API 0
// ─────────────────────────────────────────────────────────────────────────
// 리텐션 Phase 1(daniel 2026-07-19 승인) ③ — "오늘 하면 좋은 구체 행동 1개"를 주고 체크하게 한다.
//   운세를 *읽고 끝*이 아니라 *하고 체크*로 바꿔 매일 돌아올 이유를 만든다(기록이 daily_logs 에 쌓인다).
//
// ★새 명리 판정을 만들지 않는다 — dailyEnergy()(=dailyScore 와 같은 계산)가 이미 낸
//   ①십신 그룹 ②신살·작용(천을귀인·합·충형·공망·도화·역마) ③억부 우호 를 **행동 문장에 매핑만** 한다.
//   우선순위: 그날 특이점(신살·작용) > 기운 그룹 기본. 특이점이 있는 날은 그게 더 '오늘다운' 행동이라서.
//
// ⚠️§4 안전: 미션은 전부 **본인이 통제 가능한 행동**만(운을 사거나 액막이하는 행위·소비 유도 금지).
//   '조심' 계열도 회피·공포가 아니라 *속도 조절*로 쓴다. 의료·투자 행위 지시 금지.
// ⚠️문구는 Claude Code 초안 = daniel 검수 슬롯(★). 명리 판정이 아니라 '행동 번역'이다.
// ─────────────────────────────────────────────────────────────────────────
import type { SajuChart, Stem, Branch } from '@spec/chart';
import { dailyEnergy } from './dailyFortune';

export type DailyMission = {
  key: string;   // 저장·집계용 식별자(daily_logs.mission_key). 문구가 바뀌어도 통계가 이어지도록 문구와 분리.
  text: string;  // 화면에 보이는 한 문장
};

// 그날 특이점(신살·작용)별 미션 — dailyEnergy.signals 의 key 와 1:1.
//   '오늘만의 결'이라 기운 그룹보다 우선한다.
const BY_SIGNAL: Record<string, string> = {
  cheoneul: '도움 청하기 미뤄 뒀던 사람에게 먼저 연락해 보세요.',
  hap:      '어중간하게 걸쳐 둔 일 하나를 오늘 매듭지어 보세요.',
  dohwa:    '평소보다 한 끗 신경 써서 나가 보세요. 눈에 띄는 날이에요.',
  yeokma:   '늘 다니던 길 말고 다른 길로 한 번 움직여 보세요.',
  chung:    '오늘 큰 결정은 한 박자 늦춰 두세요. 대신 사실 확인을 한 가지 해 두면 좋아요.',
  gongmang: '새로 벌이기보다, 미뤄 둔 정리 한 가지를 끝내 보세요.',
};

// 기운 그룹(십신)별 기본 미션 — 특이점이 없는 날.
//   각 그룹이 '무엇을 하는 힘'인지에서 행동을 뽑았다(ENERGY_LABEL 과 같은 결).
const BY_GROUP: Record<string, string> = {
  비겁: '남에게 미루던 일 하나를 오늘은 직접 처리해 보세요.',
  식상: '머릿속에만 있던 걸 하나 밖으로 꺼내 보세요. 메시지든 글이든 말이든요.',
  재성: '미뤄 둔 정산·정리 한 가지를 오늘 끝내 보세요.',
  관성: '다가오는 약속이나 마감 하나를 먼저 확인해 두세요.',
  인성: '10분만 배우거나 읽는 시간을 가져 보세요.',
};

/**
 * 그날의 미션 1개(결정론·API 0).
 * @param saju   대표 명식
 * @param stem   그날 일진 천간
 * @param branch 그날 일진 지지
 * @returns key(저장용) + text(화면). 산출 실패 시 null 대신 기본 미션을 준다(화면이 비지 않게).
 */
export function dailyMission(saju: SajuChart, stem: Stem, branch: Branch): DailyMission {
  try {
    const e = dailyEnergy(saju, stem, branch);
    // ① 그날 특이점 우선 — signals 는 dailyEnergy 가 이미 우선순위대로 담아 준다(길신 먼저, 주의 나중).
    //    '주의' 계열(충·공망)이 있으면 그것을 먼저 고른다: 속도를 늦추라는 게 그날 가장 쓸모 있는 행동이라서.
    const care = e.signals.find((s) => s.kind === 'care' && BY_SIGNAL[s.key]);
    const good = e.signals.find((s) => s.kind === 'good' && BY_SIGNAL[s.key]);
    const picked = care ?? good;
    if (picked) return { key: `signal:${picked.key}`, text: BY_SIGNAL[picked.key] };
    // ② 특이점 없는 날 = 그날 들어온 기운 그룹의 기본 행동
    return { key: `group:${e.group}`, text: BY_GROUP[e.group] ?? BY_GROUP.비겁 };
  } catch {
    // 엔진 실패해도 화면은 비지 않게(무해한 기본값)
    return { key: 'fallback', text: '오늘 하나만 정해서 끝내 보세요. 작은 것도 좋아요.' };
  }
}
