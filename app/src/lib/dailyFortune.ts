// app/src/lib/dailyFortune.ts — 오늘의 운세: 일진 × 대표 명식 다층 룰 풀이 (무료, 온디바이스 결정론)
// ─────────────────────────────────────────────────────────────────────────
// 오늘 간지를 구하고, 대표 명식(SajuChart)과 엮어 분야별(통합·직업·재물·애정·건강) 풀이를 만든다.
// 내부 룰(전부 결정론·엔진 재사용): ①십신(일간×오늘 천간/지지) ②신강약(classifyStrength)
//   ③12운성(오늘 지지에서 일간 에너지) ④원국×오늘 합충형해(detectInteractionsAmong, 궁위 라우팅)
//   ⑤공망 ⑥신살(천을귀인·도화·역마·화개 — '운에서 들어옴') ⑦십신 부재 보충(원국에 없던 기운).
// ★출력 원칙(daniel): 본문에 한자·명리 용어 노출 금지 — 명리는 계산에만 쓰고 문장은 일상어.
// ★문구 stance 검수 = daniel 슬롯(통설 기반 초안). §4 가드: 흉 단정 금지(기조+처방), 건강은 관리축만.
// 서버·LLM 0 — 무료 티어 = 룰/템플릿 원칙(기획서 §9-5). LLM 딥 통변은 프리미엄 별개.
// ─────────────────────────────────────────────────────────────────────────
import { Solar } from 'lunar-javascript';
import { tenGod, branchTenGod } from '@engine/saju';
import { detectInteractionsAmong, classifyStrength, analyzeTenGods } from '@engine/structure';
import { twelveStage } from '@engine/twelve';
import { analyzeSinsal, gongmang, twelveSinsalAt } from '@engine/sinsal';
import type { SajuChart, Stem, Branch, PillarPos, ChartPosition } from '@spec/chart';

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

// ── 십신 10 → 5그룹 (오늘 들어오는 기운의 '결' — 내부 분류용, 화면 미노출) ──
type TgGroup = '비겁' | '식상' | '재성' | '관성' | '인성';
const GROUP: Record<string, TgGroup> = {
  비견: '비겁', 겁재: '비겁', 식신: '식상', 상관: '식상',
  정재: '재성', 편재: '재성', 정관: '관성', 편관: '관성', 정인: '인성', 편인: '인성',
};

export type DailyAreaKey = 'general' | 'work' | 'money' | 'love' | 'health';
export const DAILY_AREA_KEYS: DailyAreaKey[] = ['general', 'work', 'money', 'love', 'health'];

// ── 기조 템플릿: 분야 5 × 기운 그룹 5 (일상어 3문장 = 기조·전개·처방) ──
const AREA_TEMPLATES: Record<DailyAreaKey, Record<TgGroup, string>> = {
  general: {
    비겁: '내 페이스가 살아나는 날이에요. 추진력이 붙는 만큼 주변과 보폭을 맞추는 게 관건인데, 같은 목표를 가진 사람과는 시너지가 나고 괜한 자존심 싸움은 손해예요. 혼자 다 하려 하지 말고 역할을 나눠 보세요.',
    식상: '말과 아이디어가 잘 풀리는 날이에요. 머릿속에만 있던 생각을 꺼내 놓으면 반응이 오고, 새로운 시도를 가볍게 해 보기에도 좋아요. 떠오른 것들은 메모해 두고 하나는 오늘 바로 실행해 보세요.',
    재성: '결과와 실속을 챙기기 좋은 날이에요. 벌여 놓은 일을 마무리 짓고 눈에 보이는 성과로 연결하기 좋은 흐름이라, 이것저것보다 한 가지에 집중할 때 결실이 분명해져요. 오늘 끝낼 일 하나를 정하고 시작하세요.',
    관성: '해야 할 일이 또렷해지는 날이에요. 주변의 기대나 평가가 느껴질 수 있지만 부담보다는 기회에 가까워요. 새 일을 벌이기보다 맡은 일을 깔끔하게 매듭지으면 신뢰가 쌓입니다.',
    인성: '차분히 배우고 정리하기 좋은 날이에요. 속도를 내기보다 기반을 다지는 데 어울리는 흐름이라, 공부·문서·계획 같은 일이 잘 붙어요. 오늘 정리해 둔 것이 다음 며칠을 편하게 만들어 줍니다.',
  },
  work: {
    비겁: '혼자 끌고 가기보다 함께 갈 때 풀리는 날이에요. 동료나 파트너와 역할을 나누면 속도가 붙고, 경쟁 상대조차 자극제가 돼요. 다만 공을 나누는 데 인색하면 잡음이 생기니 먼저 인정해 주세요.',
    식상: '기획·제안·발표처럼 보여주는 일에 힘이 실리는 날이에요. 묵혀 둔 아이디어가 있다면 오늘 꺼내 보세요. 완벽하게 다듬는 것보다 일단 공유하는 쪽이 기회를 만듭니다.',
    재성: '실무가 손에 잘 잡히는 날이에요. 처리한 일을 눈에 보이는 결과물로 정리하면 평가로 이어지기 좋아요. 회의보다 실행, 말보다 결과로 보여주기에 알맞은 하루예요.',
    관성: '책임이 분명해지는 날이에요. 보고·마감·약속을 먼저 챙기면 압박이 오히려 기회로 바뀌어요. 윗사람이나 조직과 얽힌 일은 정공법이 가장 빠릅니다.',
    인성: '검토와 준비에 어울리는 날이에요. 새 일을 벌이기보다 문서·계약·계획을 차분히 들여다보면 놓친 것이 보여요. 배우는 자리나 조언을 구하는 자리도 도움이 됩니다.',
  },
  money: {
    비겁: '나가는 돈이 같이 움직이기 쉬운 날이에요. 모임이나 함께 쓰는 자리에서 예산을 미리 정해 두면 새지 않아요. 빌려주거나 보증 서는 일은 오늘은 미루는 게 좋아요.',
    식상: '벌이로 이어질 씨앗을 심는 날이에요. 내 아이디어나 재능이 수입이 될 수 있는 흐름이니 작게라도 시도해 보세요. 당장 큰돈보다 가능성을 확인하는 데 의미가 있어요.',
    재성: '돈 흐름이 또렷해지는 날이에요. 거래·정산·협상처럼 숫자가 오가는 일에 유리한데, 그만큼 충동구매 욕구도 같이 커져요. 큰 지출은 결제 전에 한 번만 더 생각하세요.',
    관성: '지킬 것을 지키는 게 돈 버는 길인 날이에요. 고정비·약정·세금 같은 것을 점검하기 좋고, 안정적인 선택이 결과적으로 이득이에요. 무리한 투자 권유는 한 걸음 물러나 보세요.',
    인성: '정보가 곧 돈이 되는 날이에요. 계약서나 증빙, 돈 계획을 정리해 두면 나중에 큰 차이를 만들어요. 결정보다 알아보고 비교하는 데 쓰기 좋은 하루예요.',
  },
  love: {
    비겁: '친구처럼 편안한 기류가 흐르는 날이에요. 함께 보내는 시간 자체가 관계를 단단하게 만들어요. 다만 이기려 드는 말투가 나오기 쉬우니 한 번씩 져 주는 여유를 보여 주세요.',
    식상: '마음 표현이 자연스러워지는 날이에요. 먼저 연락하고 먼저 말해 보세요 — 표현한 만큼 가까워져요. 혼자라면 새로운 만남의 자리에 나가 보기 좋은 흐름이에요.',
    재성: '챙겨 주는 마음이 통하는 날이에요. 거창한 이벤트보다 작은 선물이나 실질적인 배려가 상대의 마음을 움직여요. 말보다 행동으로 보여 주세요.',
    관성: '관계의 무게를 확인하게 되는 날이에요. 약속을 지키고 책임 있는 모습을 보이는 것이 가장 큰 매력이 돼요. 애매했던 관계라면 서로의 진심을 확인하기 좋은 타이밍이에요.',
    인성: '들어주는 것이 사랑이 되는 날이에요. 상대의 이야기를 끝까지 들어주는 것만으로 신뢰가 깊어져요. 오래된 추억을 함께 꺼내 보는 것도 관계를 따뜻하게 해요.',
  },
  health: {
    비겁: '몸을 움직이고 싶어지는 날이에요. 운동하기엔 좋지만 승부욕이 붙어 과해지기 쉬우니, 끝나는 시간을 미리 정해 두세요. 충분한 수분과 스트레칭도 잊지 마세요.',
    식상: '기분 전환이 곧 건강이 되는 날이에요. 가볍게 걷고 수다 떨고 웃는 것이 최고의 컨디션 관리예요. 다만 늦은 밤 야식이나 과식은 다음 날까지 무겁게 남아요.',
    재성: '에너지 소모가 큰 날이에요. 일정 사이사이 짧은 휴식을 끼워 넣어야 페이스가 유지돼요. 커피로 버티기보다 10분 눈 감는 쪽이 효과적이에요.',
    관성: '긴장이 몸에 쌓이기 쉬운 날이에요. 어깨와 목을 자주 풀어 주고, 압박감이 느껴질 땐 천천히 호흡을 골라 보세요. 퇴근 후엔 일 생각을 내려놓는 연습이 필요해요.',
    인성: '쉼이 보약인 날이에요. 잠과 휴식의 질을 챙기기 좋은 흐름이라, 일찍 쉬는 것이 내일의 능률로 돌아와요. 따뜻한 차 한 잔과 함께 하루를 정리해 보세요.',
  },
};

// ── 12운성 → 오늘의 에너지 결 (운성명은 화면 미노출, 일상어만) ──
const STAGE_LINE: Record<string, string> = {
  장생: '전체적인 컨디션은 오름세예요 — 새로 시작하는 일에 활력이 붙어요.',
  관대: '전체적인 컨디션은 오름세예요 — 일을 벌이고 나서기에 좋은 기세예요.',
  건록: '컨디션이 탄탄한 날이에요 — 제 실력이 그대로 나와요.',
  제왕: '기세가 가장 좋은 날이에요 — 중요한 일을 오늘 앞쪽에 배치해 보세요.',
  목욕: '감정이 평소보다 출렁일 수 있어요 — 즉흥적인 결정만 조심하면 돼요.',
  태: '구상과 준비에 알맞은 날이에요 — 서두르지 않아도 괜찮아요.',
  양: '준비를 마치고 때를 기다리는 흐름이에요 — 내일을 위한 세팅에 좋아요.',
  쇠: '에너지를 아껴 쓰는 게 좋은 날이에요 — 무리한 약속은 줄여 보세요.',
  병: '컨디션 관리가 필요한 날이에요 — 일정을 가볍게 가져가세요.',
  사: '마무리에 어울리는 날이에요 — 새 일보다 매듭짓기에 힘을 쓰세요.',
  묘: '차분히 가라앉는 흐름이에요 — 정리하고 묵혀 두기에 좋은 날이에요.',
  절: '재충전이 필요한 날이에요 — 쉬어 가는 것이 곧 능률이에요.',
};
const LOW_ENERGY = new Set(['쇠', '병', '사', '묘', '절']); // 건강 분야 휴식 권고 트리거

// ── 합충형해 → 일상어 (궁위: 어느 기둥과 작용하느냐 → 삶의 어느 영역인지) ──
const POS_AREA: Record<string, string> = { 년: '웃어른·집안', 월: '직장·일터', 일: '가까운 사람', 시: '아랫사람·진행 중인 일' };
const linkLine = (type: string, posKo: string): string => {
  switch (type) {
    case '합': return `오늘은 ${posKo} 쪽과 죽이 잘 맞아요 — 부탁이나 협의를 꺼내기 좋은 타이밍이에요.`;
    case '충': return `${posKo} 쪽에 변동 기류가 있어요 — 일정이 바뀌거나 부딪힐 수 있으니 여유를 두고, 말은 한 박자 천천히 하세요.`;
    case '형': return `${posKo} 쪽 일이 살짝 꼬일 수 있어요 — 원칙과 절차를 지키는 것이 가장 빠른 길이에요.`;
    default: return `${posKo} 쪽에서 사소한 어긋남이 생길 수 있어요 — 크게 번질 일은 아니니 가볍게 넘기세요.`; // 해·파
  }
};

// ── 원국에 없던 기운이 오늘 들어올 때 (십신 부재 보충 — R3 결, 일상어) ──
const ABSENT_LINE: Record<TgGroup, string> = {
  비겁: '평소 혼자 해내던 일에 오늘은 함께할 사람이 생겨요 — 모처럼 기대도 괜찮아요.',
  식상: '평소 표현이 잘 안 됐다면 오늘은 말문이 트이는 날이에요 — 미뤄 둔 이야기를 꺼내 보세요.',
  재성: '평소 손에 잘 안 잡히던 실속이 오늘은 챙겨져요 — 작은 결실을 놓치지 마세요.',
  관성: '평소 애매하던 역할과 책임이 오늘은 또렷해져요 — 정리하기 좋은 기회예요.',
  인성: '평소 아쉽던 도움과 정보가 오늘은 들어와요 — 조언을 구하면 답이 보여요.',
};

// 신강약 × 오늘 기운 (우호=나를 돕는 결 / 비우호=내가 쓰는 결) → 일상어
const strengthLine = (strong: boolean, weak: boolean, favor: boolean): string => {
  if (strong) return favor
    ? '타고난 에너지가 강한 편인데 오늘 비슷한 기운이 더해져요 — 의욕이 과속이 되지 않게, 운동이나 몰입할 일에 힘을 풀어 주면 하루가 매끄러워요.'
    : '쌓아 둔 힘을 쓰기 좋은 날이에요 — 미뤄 둔 일을 오늘 처리하면 생각보다 수월하게 풀려요.';
  if (weak) return favor
    ? '평소보다 기운이 차오르는 날이에요 — 자신감이 붙을 때 중요한 일을 앞쪽에 배치해 보세요.'
    : '기운 소모가 좀 있는 날이에요 — 일정을 가볍게 잡고 중요한 것 한두 가지에만 집중하면 충분해요.';
  return '컨디션 균형이 좋은 날이에요 — 평소 페이스대로 가면 돼요.';
};

export type DailyAreaReading = { key: DailyAreaKey; paragraphs: string[] };

/**
 * 오늘 일진 × 대표 명식 → 분야별 다층 풀이 (결정론, 본문 일상어 — 명리 용어 미노출).
 * 합충 라우팅: 월지 작용→직업, 일지 작용→애정, 그 외(년·시·3자국)→통합. 도화→애정, 역마→직업,
 * 화개·천을귀인·공망·부재보충→통합(공망은 재물에도). 12운성→통합(+저에너지면 건강).
 */
export function dailyChartReadings(saju: SajuChart, todayStem: Stem, todayBranch: Branch): DailyAreaReading[] {
  const me = saju.dayMaster.stem;
  const P = saju.pillars;

  // ① 십신 그룹 (천간=드러난 기운 기조, 지지=깔린 기운 — 둘 다 내부용)
  const group = GROUP[tenGod(me, todayStem)];
  const bGroup = GROUP[branchTenGod(me, todayBranch)];

  // ② 신강약 — 오늘 기운이 나를 돕는 결(비겁·인성)인지에 따라 과속/순풍 분기
  const sc = classifyStrength(saju);
  const strong = sc.type === '신왕' || sc.type === '신강';
  const weak = sc.type === '신약';
  const favor = group === '비겁' || group === '인성';

  // ③ 12운성 — 오늘 지지에서 내 일간의 에너지 레벨
  const stage = twelveStage(me, todayBranch);

  // ④ 원국 × 오늘 합충형해 (지지 레벨만 — 천간 결은 ①에 이미 반영) → 궁위별 분야 라우팅
  const POS: PillarPos[] = ['년', '월', '일', '시'];
  const items = [
    ...POS.map((p) => ({ pos: p as ChartPosition, stem: P[p].stem, branch: P[p].branch })),
    { pos: '일운' as ChartPosition, stem: todayStem, branch: todayBranch },
  ];
  const links = detectInteractionsAmong(items).filter(
    (it) => it.members.includes('일운') && it.level !== '천간'
  );
  const workLines: string[] = [], loveLines: string[] = [], generalLines: string[] = [];
  for (const it of links) {
    const others = it.members.filter((m) => m !== '일운') as string[];
    if (others.length >= 2) { // 오늘 기운까지 더해 3자 국 완성 — 큰 흐름
      generalLines.push('여러 기운이 한 방향으로 모이는 날이에요 — 흐름을 타면 평소보다 큰 진전이 있어요.');
      continue;
    }
    const pos = others[0];
    const line = linkLine(it.type, POS_AREA[pos] ?? '주변');
    if (pos === '월') workLines.push(line);
    else if (pos === '일') loveLines.push(line);
    else generalLines.push(line);
  }

  // ⑤ 공망 — 오늘 지지가 내 공망이면 '결과 잡기 어려움 → 정리·계획' 결
  const [g1, g2] = gongmang(P['일'].stem, P['일'].branch);
  const isGm = todayBranch === g1 || todayBranch === g2;

  // ⑥ 신살 — 오늘 지지가 운에서 가져오는 색채 (년지·일지 기준 12신살 + 천을귀인)
  const sin = analyzeSinsal(saju);
  const tw = new Set([twelveSinsalAt(P['년'].branch, todayBranch), twelveSinsalAt(P['일'].branch, todayBranch)]);
  const hasCheonEul = !!sin.sinsal.find((s) => s.name === '천을귀인')?.glyphs.includes(todayBranch);

  // ⑦ 십신 부재 보충 — 원국에 없던 그룹의 기운이 오늘 들어오면 강한 시그널(R3 결)
  const absent = analyzeTenGods(saju).absent;

  // ── 분야별 조립 (기조 → 개인화 시그널 → 색채 순) ──
  const general: string[] = [AREA_TEMPLATES.general[group]];
  if (bGroup !== group) general.push(`그 아래로는 ${AREA_SUB[bGroup]} 흐름도 함께 깔려 있어요.`);
  general.push(strengthLine(strong, weak, favor));
  general.push(STAGE_LINE[stage] ?? '');
  general.push(...generalLines);
  if (absent.includes(group)) general.push(ABSENT_LINE[group]);
  if (isGm) general.push('오늘은 애써도 결과가 손에 잘 안 잡히는 날일 수 있어요 — 욕심내기보다 정리하고 계획하는 데 쓰면 오히려 알차요.');
  if (hasCheonEul) general.push('도와주는 사람이 나타나기 쉬운 날이에요 — 막힌 일은 혼자 끙끙대지 말고 물어보세요.');
  if (tw.has('화개')) general.push('혼자만의 시간이 필요한 날이기도 해요 — 조용히 정리하면 머리가 맑아져요.');

  const work: string[] = [AREA_TEMPLATES.work[group], ...workLines];
  if (tw.has('역마')) work.push('외근·이동·출장처럼 움직이는 일이 오히려 기회가 되는 날이에요 — 자리만 지키기보다 직접 가서 보세요.');

  const money: string[] = [AREA_TEMPLATES.money[group]];
  if (group === '비겁' && strong) money.push('주변과 같이 쓰는 돈은 특히 새기 쉬워요 — 오늘만큼은 한도를 정해 두는 게 안전해요.');
  if (isGm) money.push('큰 지출이나 계약은 하루 미루는 편이 나아요 — 오늘은 알아보고 비교하는 데 쓰세요.');

  const love: string[] = [AREA_TEMPLATES.love[group], ...loveLines];
  if (tw.has('도화')) love.push('매력이 살아나고 시선이 모이는 날이에요 — 첫 만남이든 오랜 사이든 호감이 잘 통해요.');

  const health: string[] = [AREA_TEMPLATES.health[group]];
  if (LOW_ENERGY.has(stage)) health.push('몸이 보내는 신호에 평소보다 민감해지세요 — 오늘은 일찍 쉬는 것이 보약이에요.');

  const clean = (arr: string[]) => arr.filter(Boolean);
  return [
    { key: 'general', paragraphs: clean(general) },
    { key: 'work', paragraphs: clean(work) },
    { key: 'money', paragraphs: clean(money) },
    { key: 'love', paragraphs: clean(love) },
    { key: 'health', paragraphs: clean(health) },
  ];
}

// 지지에 깔린 기운의 결 — 통합 보조 문장용 (그룹명 미노출)
const AREA_SUB: Record<TgGroup, string> = {
  비겁: '사람들과 함께 가는',
  식상: '표현하고 펼치는',
  재성: '실속을 챙기는',
  관성: '책임을 다하는',
  인성: '배우고 정리하는',
};
