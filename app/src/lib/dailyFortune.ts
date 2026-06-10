// app/src/lib/dailyFortune.ts — 오늘의 일진 + 5분야 룰 풀이 (무료, 온디바이스 결정론)
// ─────────────────────────────────────────────────────────────────────────
// lunar-javascript 로 오늘 간지를 계산하고, 대표 명식이 있으면 *내 일간* 대비 오늘
// 일진의 십신 관계를 구해 분야별(통합·직업·재물·애정·건강) 템플릿 풀이를 만든다.
// 서버·LLM 0 — 무료 티어 = 룰/템플릿 원칙(기획서 §9-5). LLM 딥 통변은 프리미엄 별개.
// ★ 십신 그룹 의미·문구 = 통설 기반 초안 — 명리 stance 검수는 daniel 슬롯(§3.3).
// §4 가드: 길흉 단정 금지(기조+처방 동반), 건강은 의료 단정 없이 '관리축'만.
// ─────────────────────────────────────────────────────────────────────────
import { Solar } from 'lunar-javascript';
import { tenGod, branchTenGod } from '@engine/saju';
import type { Stem, Branch, TenGod } from '@spec/chart';

export function getDailyFortune() {
  const d = new Date();
  const solar = (Solar as any).fromDate(d);
  const lunar = solar.getLunar();
  return {
    date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
    dayGanZhi: lunar.getDayInGanZhi() as string, // 오늘 일주 간지(干支)
    monthGanZhi: lunar.getMonthInGanZhi() as string,
    yearGanZhi: lunar.getYearInGanZhi() as string,
  };
}

// ── 십신 10 → 5그룹 (오늘 들어오는 기운의 '결') ──
type TgGroup = '비겁' | '식상' | '재성' | '관성' | '인성';
const GROUP: Record<string, TgGroup> = {
  비견: '비겁', 겁재: '비겁', 식신: '식상', 상관: '식상',
  정재: '재성', 편재: '재성', 정관: '관성', 편관: '관성', 정인: '인성', 편인: '인성',
};

export type DailyAreaKey = 'general' | 'work' | 'money' | 'love' | 'health';
export type DailyArea = { key: DailyAreaKey; reading: string };

// 분야 × 십신그룹 템플릿 — 본문은 ko(타로 풀이와 동일 정책: 통변 본문 ko, 구조 라벨만 i18n).
//   각 문구 = 기조 1문장 + 처방 1문장(가드5: 묘사로 끝내지 않음). ★문구 stance 검수 = daniel.
const AREA_TEMPLATES: Record<DailyAreaKey, Record<TgGroup, string>> = {
  general: {
    비겁: '나와 같은 기운이 들어오는 날 — 주도권과 추진력이 살아납니다. 협력과 경쟁이 함께 오니, 같이 갈 사람과 페이스를 맞추면 성과가 커져요.',
    식상: '표현과 아이디어의 기운 — 말하고 만들고 보여주기 좋은 날입니다. 떠오른 생각을 메모로 남기고 하나는 실행으로 옮겨 보세요.',
    재성: '실리와 결과의 기운 — 일을 마무리 짓고 성과로 연결하기 좋은 날입니다. 우선순위를 정해 한 가지에 집중하면 결실이 분명해져요.',
    관성: '규율과 책임의 기운 — 역할이 분명해지고 평가가 오가는 날입니다. 무리한 확장보다 맡은 일을 깔끔히 매듭지으면 신뢰가 쌓여요.',
    인성: '배움과 정리의 기운 — 공부·문서·계획에 유리한 날입니다. 속도를 내기보다 기반을 다지는 데 시간을 쓰면 이후가 편해져요.',
  },
  work: {
    비겁: '동료·파트너와의 협업이 관건인 날입니다. 혼자 끌고 가기보다 역할을 나누면 일에 속도가 붙어요.',
    식상: '기획·제안·발표에 힘이 실리는 날입니다. 묵혀 둔 아이디어가 있다면 꺼내서 공유해 보세요.',
    재성: '실무 처리와 성과 정리에 좋은 날 — 결과물을 눈에 보이게 만들면 평가로 이어집니다.',
    관성: '책임이 또렷해지는 날입니다. 보고·마감·약속을 먼저 챙기면 압박이 오히려 기회로 바뀌어요.',
    인성: '검토와 학습의 날 — 새 일을 벌이기보다 문서·계획·계약 내용을 정리하면 든든해집니다.',
  },
  money: {
    비겁: '지출이 같이 움직이기 쉬운 날 — 모임·동업처럼 나눠 쓰는 자리의 예산을 미리 정해두면 새지 않아요.',
    식상: '벌이로 이어질 씨앗을 심는 날 — 아이디어와 재능이 수입원이 될 수 있으니 작게라도 시도해 보세요.',
    재성: '재물 기운이 또렷한 날 — 거래·정산·협상에 유리합니다. 다만 충동 지출도 함께 커지니 큰 결정은 한 번 더 확인을.',
    관성: '지킬 것을 지키는 날 — 고정비·약정·세금 점검에 좋습니다. 안정 위주의 선택이 결과적으로 이득이에요.',
    인성: '문서가 돈이 되는 날 — 계약서·증빙·계획서를 정리해 두세요. 정보가 곧 재물의 토대가 됩니다.',
  },
  love: {
    비겁: '친구 같은 편안함이 흐르는 날 — 함께 보내는 시간 자체가 관계를 다집니다. 경쟁심 섞인 말투만 조심하세요.',
    식상: '마음 표현이 자연스러운 날 — 먼저 연락하고 먼저 말해 보세요. 표현한 만큼 가까워집니다.',
    재성: '챙김이 통하는 날 — 작은 선물이나 실질적인 배려가 마음을 움직입니다.',
    관성: '관계의 무게를 확인하는 날 — 약속과 책임을 지키는 모습이 가장 큰 매력이 됩니다.',
    인성: '이해와 경청의 날 — 상대의 이야기를 끝까지 들어주는 것만으로 신뢰가 깊어져요.',
  },
  health: {
    비겁: '활동량이 늘기 쉬운 날 — 몸을 쓰기 좋지만 과로로 이어지기 쉬우니 끝나는 시간을 정해 두세요.',
    식상: '발산의 날 — 가볍게 움직이고 말하고 웃는 것이 컨디션 관리가 됩니다. 늦은 밤 과식만 주의하세요.',
    재성: '소모가 큰 날 — 일정 사이사이 짧은 휴식을 끼워 넣으면 페이스가 유지됩니다.',
    관성: '긴장이 쌓이기 쉬운 날 — 어깨와 목을 자주 풀어 주고, 압박을 느끼면 호흡을 고르세요.',
    인성: '회복의 날 — 잠과 휴식의 질을 챙기기 좋습니다. 일찍 쉬는 것이 내일의 능률이 돼요.',
  },
};

export const DAILY_AREA_KEYS: DailyAreaKey[] = ['general', 'work', 'money', 'love', 'health'];

/**
 * 오늘 일진이 '나'에게 갖는 의미 — 내 일간 기준 십신 + 5분야 풀이 (결정론).
 * @param myDayStem 대표 명식의 일간 / @param todayStem·todayBranch 오늘 일진 간지
 * @returns stemTg(천간 십신)·branchTg(지지 본기 십신)·group(기조 그룹)·areas(분야 5개 풀이)
 *   본문 기조 = *천간* 십신 그룹(드러난 기운) 기준. 지지 십신은 보조 표기용(글라스박스).
 */
export function dailyAreaReadings(myDayStem: Stem, todayStem: Stem, todayBranch: Branch): {
  stemTg: TenGod; branchTg: TenGod; group: TgGroup; areas: DailyArea[];
} {
  const stemTg = tenGod(myDayStem, todayStem);
  const branchTg = branchTenGod(myDayStem, todayBranch);
  const group = GROUP[stemTg];
  const areas = DAILY_AREA_KEYS.map((key) => ({ key, reading: AREA_TEMPLATES[key][group] }));
  return { stemTg, branchTg, group, areas };
}
