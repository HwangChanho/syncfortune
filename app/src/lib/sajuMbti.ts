// app/src/lib/sajuMbti.ts — 사주로 보는 MBTI(온디바이스·무료, 규칙5: LLM 없이 룰)
// ─────────────────────────────────────────────────────────────────────────
// 원국 십신 분포 + 일간 음양으로 MBTI 4축(E/I·S/N·T/F·J/P)을 점수화 → 16유형.
// ⚠️ stance(daniel★ 검수 대상): 십신↔MBTI 축 매핑은 명리 해석이라 가중치는 daniel이 조정한다.
//   Claude는 *기계(축 산출·유형 조립)*만 제공. 아래 매핑은 일반적 대응의 1안(검수 전 임시).
//   - E/I: 비겁·식상(밖으로 발산)+양 일간 = E / 인성·관성(안으로 수렴·절제)+음 일간 = I
//   - S/N: 재성·비겁(현실·직접경험) = S / 인성·식상(사유·상상) = N
//   - T/F: 관성·편재(원칙·계산) = T / 인성·식신·상관(공감·배려·표현) = F
//   - J/P: 정관·정재·정인(질서·계획) = J / 상관·편재·겁재·편인(유연·즉흥·변화) = P
// 무료 티어 = 결과·설명 모두 온디바이스 템플릿(API 0). 문구도 daniel★ 검수 슬롯.
// ─────────────────────────────────────────────────────────────────────────
import type { SajuChart, TenGod } from '@spec/chart';
import { analyzeTenGods } from '@engine/structure';

const YANG = new Set(['甲', '丙', '戊', '庚', '壬']); // 양 천간(나머지 음)

export type MbtiAxisKey = 'EI' | 'SN' | 'TF' | 'JP';
export type MbtiAxis = { key: MbtiAxisKey; letter: string; score: number; reason: string }; // score=오른쪽 글자(E/N/F/P 아님 — 아래 정의) 비율 0~100
export type SajuMbtiResult = {
  type: string;                 // 예: 'INTJ'
  nickname: string;             // 유형 별명(한글)
  summary: string;              // 한 줄 핵심
  axes: MbtiAxis[];             // 4축(글자 + 점수 + 근거)
};

// 십신 그룹 합(원국 천간·지지 분포)
function groups(detail: Record<string, number>) {
  const g = (ks: TenGod[]) => ks.reduce((s, k) => s + (detail[k] || 0), 0);
  return {
    bigeop: g(['비견', '겁재']), siksang: g(['식신', '상관']), jaeseong: g(['정재', '편재']),
    gwanseong: g(['정관', '편관']), inseong: g(['정인', '편인']),
    siksin: detail['식신'] || 0, sanggwan: detail['상관'] || 0,
    pyeonjae: detail['편재'] || 0, gyeopjae: detail['겁재'] || 0, pyeonin: detail['편인'] || 0,
    jeong: (detail['정관'] || 0) + (detail['정재'] || 0) + (detail['정인'] || 0), // 正(질서)
  };
}

// 양쪽 가중 → 오른쪽 글자 비율(0~100). 둘 다 0이면 50(중립).
function ratio(left: number, right: number): number { const t = left + right; return t > 0 ? Math.round((right / t) * 100) : 50; }

// 16유형 별명·한 줄(daniel★ 문구 검수 슬롯 — 일반 통용 별칭 기반)
const TYPE_INFO: Record<string, { nick: string; line: string }> = {
  INTJ: { nick: '용신을 그리는 전략가', line: '멀리 보고 판을 짜는, 조용한 설계자예요.' },
  INTP: { nick: '파고드는 사색가', line: '원리를 캐는 게 즐거운, 호기심의 사람이에요.' },
  ENTJ: { nick: '판을 이끄는 지휘관', line: '목표를 향해 사람을 모아 끌고 가는 추진가예요.' },
  ENTP: { nick: '아이디어 발명가', line: '새 가능성을 던지며 판을 흔드는 자유로운 토론가예요.' },
  INFJ: { nick: '뜻을 품은 조언자', line: '깊이 공감하며 사람의 길을 비춰주는 사람이에요.' },
  INFP: { nick: '이상을 품은 중재자', line: '따뜻한 가치를 지키는, 마음이 깊은 몽상가예요.' },
  ENFJ: { nick: '사람을 키우는 멘토', line: '주변을 북돋아 함께 성장시키는 따뜻한 리더예요.' },
  ENFP: { nick: '불을 지피는 활동가', line: '사람과 가능성에 설레는, 에너지의 사람이에요.' },
  ISTJ: { nick: '신뢰의 관리자', line: '맡은 일을 끝까지 해내는, 묵직한 현실가예요.' },
  ISFJ: { nick: '곁을 지키는 수호자', line: '조용히 챙기고 돌보는, 헌신적인 사람이에요.' },
  ESTJ: { nick: '체계를 세우는 관리자', line: '원칙과 질서로 일을 굴리는 추진형 실무가예요.' },
  ESFJ: { nick: '챙기는 외교관', line: '사람을 살피고 분위기를 데우는 다정한 사람이에요.' },
  ISTP: { nick: '문제 해결의 장인', line: '손으로 풀고 핵심만 보는, 군더더기 없는 사람이에요.' },
  ISFP: { nick: '감각의 예술가', line: '지금 이 순간의 아름다움을 느끼는 부드러운 사람이에요.' },
  ESTP: { nick: '판을 즐기는 모험가', line: '현장에서 빠르게 움직이는, 대담한 행동가예요.' },
  ESFP: { nick: '무대의 연예인', line: '함께 있으면 즐거운, 빛나는 분위기 메이커예요.' },
};

/**
 * 사주(원국)의 십신 분포 + 일간 음양으로 MBTI 4축·16유형 산출(온디바이스).
 * 각 축은 (왼글자 가중, 오른글자 가중) → 비율. 동률·무자료는 중립(왼글자 채택).
 */
export function sajuMbti(saju: SajuChart): SajuMbtiResult {
  const { detail } = analyzeTenGods(saju);
  const g = groups(detail);
  const isYang = YANG.has(saju.dayMaster.stem);

  // E/I: 발산(비겁+식상)+양 = E(오른) / 수렴(인성+관성)+음 = I(왼)
  const eW = g.bigeop + g.siksang + (isYang ? 2 : 0);
  const iW = g.inseong + g.gwanseong + (isYang ? 0 : 2);
  const ei = ratio(iW, eW); const eiL = ei >= 50 ? 'E' : 'I';
  // S/N: 현실(재성+비겁) = S(왼) / 직관(인성+식상) = N(오른)
  const sW = g.jaeseong + g.bigeop;
  const nW = g.inseong + g.siksang;
  const sn = ratio(sW, nW); const snL = sn >= 50 ? 'N' : 'S';
  // T/F: 원칙(관성+편재) = T(왼) / 공감(인성+식신+상관) = F(오른)
  const tW = g.gwanseong + g.pyeonjae;
  const fW = g.inseong + g.siksin + g.sanggwan;
  const tf = ratio(tW, fW); const tfL = tf >= 50 ? 'F' : 'T';
  // J/P: 질서(정관·정재·정인) = J(왼) / 유연(상관+편재+겁재+편인) = P(오른)
  const jW = g.jeong;
  const pW = g.sanggwan + g.pyeonjae + g.gyeopjae + g.pyeonin;
  const jp = ratio(jW, pW); const jpL = jp >= 50 ? 'P' : 'J';

  const type = `${eiL}${snL}${tfL}${jpL}`;
  const info = TYPE_INFO[type] ?? { nick: '나만의 유형', line: '여러 기운이 고루 섞인 균형형이에요.' };

  // 각 축 근거(쉬운 말 — 십신/음양 용어 노출 최소화. daniel★ 검수)
  const axes: MbtiAxis[] = [
    { key: 'EI', letter: eiL, score: ei, reason: eiL === 'E' ? '기운을 밖으로 펼치고 사람·활동에서 힘을 얻는 결이 강해요.' : '안으로 차분히 채우고 혼자만의 시간에서 힘을 얻는 결이 강해요.' },
    { key: 'SN', letter: snL, score: sn, reason: snL === 'S' ? '눈앞의 현실·경험·실리를 먼저 챙기는 감각형이에요.' : '의미·가능성·상상을 먼저 떠올리는 직관형이에요.' },
    { key: 'TF', letter: tfL, score: tf, reason: tfL === 'T' ? '원칙과 결과로 또렷하게 판단하는 편이에요.' : '사람의 마음과 관계를 먼저 헤아리는 편이에요.' },
    { key: 'JP', letter: jpL, score: jp, reason: jpL === 'J' ? '계획을 세워 질서 있게 밀고 가는 걸 편해해요.' : '상황에 맞춰 유연하게 즉흥적으로 움직이는 걸 편해해요.' },
  ];

  return { type, nickname: info.nick, summary: info.line, axes };
}
