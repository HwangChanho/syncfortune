// app/src/lib/content/decisionToday.ts — 오늘의 결정 도우미(무료·온디바이스·결정론·API 0)
// ─────────────────────────────────────────────────────────────────────────
// daniel 07-25 코드 큐 '결정도우미(결정장애)'. "오늘 이 결정을 내려도 될까?"에 답하는 홈 블록.
//
// ★★새 명리 판정을 **하나도 만들지 않는다**(§3 — Claude 는 명리를 발명하지 않는다).
//   근거는 전부 이미 daniel 승인 로직인 `dailyEnergy()`(dailyFortune.ts)가 산출한 것을 그대로 읽는다:
//     · 공망  → dailyEnergy 가 이미 "붕 뜨는 자리라 **큰 결정은 미루면** 좋아요"로 판정·문장화해 둠
//     · 충·형 → 이미 "부딪힘이 있어 **서두르지 않는** 게 좋아요"
//     · 천을귀인/합 → 이미 "도와주는 사람이 붙는 날" / "매듭이 지어지는 결"
//     · score·caution → 이미 계산된 총운·주의 등급
//   즉 이 파일이 하는 일은 **판정이 아니라 그 재료를 '결정'이라는 질문으로 재배열**하는 것뿐이다.
//   (07-18 '오늘 기운 카드'가 dailyScore 의 버려지던 재료를 되살린 것과 같은 패턴.)
//
// ⚠️ 판정 기준 stance = daniel 권고안 A 채택: **일진(오늘 들어온 기운) 기반**.
//    이유 = 기존 '오늘의 행운/기운'이 전부 일진 기반이라 앱 전체가 한 기준으로 일관되고, 매일 바뀌어
//    리텐션에 맞는다. (대안 B=용신 고정 기반은 정적이라 매일 볼 이유가 약하고, 기존 일진 축과 어긋난다.)
//    개인화는 '넛지'에서만 — 억부 우호(favorGood)·강약(strengthType)으로 조언 톤을 바꾼다.
// ⚠️ 결정 유형별 민감 신호 매핑·문구 = Claude Code 초안 → ★daniel 검수 슬롯.
// ⚠️ §4 안전: 투자·법률 조언 아님. 단정·공포 금지 — '흐름·경향'과 '이렇게 해보세요'로만.
// ─────────────────────────────────────────────────────────────────────────
// ★**타입만** 가져온다(런타임 import 없음) — 이 모듈이 dailyFortune 런타임에 의존하지 않아야
//   하네스(check:decision)가 RN 체인(dailyFortune → i18n → react-native, Flow 문법이라 tsx 파싱 불가)
//   없이 순수 로직만 검증할 수 있다. 오늘 기운 산출은 **호출부**가 하고 결과를 넘긴다(의존성 역전).
import type { DailyEnergy, DailySignal } from './dailyFortune';

/** 결정 판정 3단계. go=밀어도 좋은 날 / hold=평범(작은 건 진행) / wait=큰 건 미루기. */
export type DecisionVerdict = 'go' | 'hold' | 'wait';

/** 결정 유형 — 사람들이 실제로 망설이는 카테고리(문구·매핑 daniel 검수 슬롯). */
export type DecisionKind = 'contract' | 'spend' | 'talk' | 'start' | 'move';

export type DecisionAdvice = {
  kind: DecisionKind;
  label: string;      // 표시명
  verdict: DecisionVerdict;
  tip: string;        // 한 줄 조언(§4 전향적)
};

export type DecisionToday = {
  verdict: DecisionVerdict;   // 오늘 전반 판정
  title: string;              // 한 줄 결론
  reason: string;             // 근거 한 줄(왜 그런지 — 이미 판정된 신호를 일상어로)
  score: number;              // dailyEnergy 총운(재사용·표시용)
  signals: DailySignal[];     // 근거 칩(그대로 재사용)
  items: DecisionAdvice[];    // 유형별 세부
};

/** 유형 정의 — 라벨만(★이모지 제거·daniel 2026-07-26 "이모지는 다 빼고"). */
const KINDS: { kind: DecisionKind; label: string }[] = [
  { kind: 'contract', label: '계약·서명' },
  { kind: 'spend', label: '큰 지출' },
  { kind: 'talk', label: '대화·담판' },
  { kind: 'start', label: '새로 시작' },
  { kind: 'move', label: '이동·약속' },
];

/**
 * 오늘의 결정 도우미 — **순수 함수**(이미 산출된 오늘 기운만 받아 재배열).
 *
 * 여기에 명리 판정이 없다는 것이 핵심이다: 입력 `e` 는 daniel 승인 로직 `dailyEnergy()` 의 결과이고,
 * 이 함수는 그 신호들을 '오늘 결정해도 되나?'라는 질문으로 **다시 배치**하기만 한다.
 * (순수 함수로 떼어 둔 덕에 하네스가 픽스처를 주입해 전 분기를 검증할 수 있다.)
 *
 * @param e 오늘 기운(dailyEnergy 산출물)
 * @returns 전반 판정 + 유형별 조언. 같은 입력 = 항상 같은 출력(결정론).
 */
export function decisionFromEnergy(e: DailyEnergy): DecisionToday {
  const has = (k: string) => e.signals.some((s) => s.key === k);
  const gongmang = has('gongmang');   // 이미 "큰 결정은 미루면 좋아요"로 판정된 신호
  const chung = has('chung');         // 이미 "서두르지 않는 게 좋아요"
  const cheoneul = has('cheoneul');   // 이미 "도와주는 사람이 붙는 날"
  const hap = has('hap');             // 이미 "매듭이 지어지는 결"
  const yeokma = has('yeokma');       // 이미 "움직임·이동이 생기는 결"

  // ── 전반 판정 — 기존 신호의 우선순위만 정한다(가중치는 daniel 튜닝 슬롯).
  //    공망은 '큰 결정 보류'가 이미 그 신호의 뜻이므로 최우선. 그다음 충·형(서두르지 않기).
  const verdict: DecisionVerdict =
    gongmang ? 'wait'
    : chung ? (e.score >= 60 ? 'hold' : 'wait')
    : (cheoneul || hap) && e.score >= 60 ? 'go'
    : e.score >= 68 ? 'go'
    : e.score >= 46 ? 'hold'
    : 'wait';

  const title =
    verdict === 'go' ? '오늘은 밀어도 좋은 날이에요'
    : verdict === 'hold' ? '작은 건 진행, 큰 건 한 번 더'
    : '큰 결정은 하루 미뤄도 좋아요';

  // 근거 한 줄 — 이미 판정·문장화된 신호를 그대로 인용(새 해석 없음). 없으면 억부 우호로 설명.
  const reason =
    gongmang ? '오늘은 붕 뜨는 자리라, 큰 건은 판단이 흐려지기 쉬워요.'
    : chung ? '부딪힘이 있는 날이라 서두르면 어긋나기 쉬워요.'
    : cheoneul ? '도와주는 사람이 붙는 날이라 이야기가 잘 풀려요.'
    : hap ? '어우러지고 매듭이 지어지는 결이라 마무리에 좋아요.'
    : e.favorGood ? '오늘 들어온 기운이 지금의 나와 잘 맞아떨어져요.'
    : '오늘 기운이 나를 좀 밀어붙이는 편이라 무리하지 않는 게 좋아요.';

  // ── 유형별 — 전반 판정을 기본으로 두고, *그 유형이 특히 민감한 신호*만 한 단계 조정한다.
  //    ⚠️매핑 근거는 기존 신호의 뜻 그대로: 공망=비움(문서·돈에 취약) / 충형=부딪힘(담판·이동에 취약)
  //      / 합=매듭(계약·대화에 유리) / 천을귀인=귀인(담판·시작에 유리) / 역마=이동(이동에 유리).
  const down = (v: DecisionVerdict): DecisionVerdict => (v === 'go' ? 'hold' : 'wait');
  const up = (v: DecisionVerdict): DecisionVerdict => (v === 'wait' ? 'hold' : 'go');

  const items: DecisionAdvice[] = KINDS.map(({ kind, label }) => {
    let v = verdict;
    let tip = '';
    if (kind === 'contract') {
      if (gongmang) { v = 'wait'; tip = '서명·확정은 내일로. 오늘은 조건만 정리해 두세요.'; }
      else if (hap) { v = up(v); tip = '매듭이 잘 지어지는 날 — 미뤄둔 계약을 마무리하기 좋아요.'; }
      else tip = v === 'go' ? '조건을 확인했다면 진행해도 좋아요.' : '문구를 한 번 더 읽고 결정하세요.';
    } else if (kind === 'spend') {
      if (gongmang) { v = 'wait'; tip = '큰 지출은 하루 미루면 후회가 줄어요.'; }
      else if (chung) { v = down(v); tip = '충동적으로 결제하기 쉬운 날 — 장바구니에 하루 두세요.'; }
      else tip = v === 'go' ? '계획했던 지출이면 무리 없어요.' : '필요한 것과 갖고 싶은 것을 나눠 보세요.';
    } else if (kind === 'talk') {
      if (cheoneul) { v = up(v); tip = '말이 잘 통하고 도와줄 사람이 붙어요 — 먼저 꺼내 보세요.'; }
      else if (chung) { v = down(v); tip = '말이 날카로워지기 쉬워요. 결론보다 듣기부터.'; }
      else tip = v === 'go' ? '하고 싶던 이야기를 꺼내기 좋아요.' : '감정이 실릴 것 같으면 한 박자 쉬세요.';
    } else if (kind === 'start') {
      // ⚠️공망을 **먼저** 본다(check:decision 이 잡은 버그): 예전엔 cheoneul/hap 분기가 앞서 있어
      //   공망+천을귀인이 겹치면 보류가 hold 로 승격돼 "큰 결정은 미루라"는 신호가 무시됐다.
      //   공망은 그 자체가 '큰 결정 보류' 신호라 다른 길신보다 우선한다(contract·spend 와 동일 순서).
      if (gongmang) { v = 'wait'; tip = '오늘 시작은 흐지부지되기 쉬워요. 준비만 해두세요.'; }
      else if (cheoneul || hap) { v = up(v); tip = '시작에 사람이 붙는 결 — 첫 발을 떼기 좋아요.'; }
      else tip = v === 'go' ? '작게라도 오늘 시작해 두면 흐름이 붙어요.' : '판을 키우기보다 준비를 다지세요.';
    } else {
      if (yeokma) { v = up(v); tip = '움직임이 붙는 날 — 이동·약속이 순조로워요.'; }
      else if (chung) { v = down(v); tip = '동선이 꼬이기 쉬워요. 여유 있게 출발하세요.'; }
      else tip = v === 'go' ? '약속을 잡거나 움직이기 좋아요.' : '무리한 일정은 줄이는 게 좋아요.';
    }
    return { kind, label, verdict: v, tip };
  });

  // ★판정별로 묶어서 반환(daniel 2026-07-26 "좋아요랑 미루기를 같이 묶어놔야지 — 번갈아가면서 안 나오게").
  //   좋아요 → 보통 → 미루기 순. 같은 판정 안에서는 KINDS 선언 순서가 유지된다(JS sort 는 안정 소트).
  //   ⚠️홈 카드·상세 화면이 둘 다 이 배열을 그대로 렌더하므로 정렬을 여기 한 곳에서만 한다(드리프트 0).
  const VORDER: Record<DecisionVerdict, number> = { go: 0, hold: 1, wait: 2 };
  items.sort((a, b) => VORDER[a.verdict] - VORDER[b.verdict]);

  return { verdict, title, reason, score: e.score, signals: e.signals, items };
}

// ※ 진입점 래퍼(saju+일진 → 결과)를 여기 두지 않는 이유: 그러면 dailyEnergy 를 런타임 import 해야 하고
//   이 모듈이 다시 RN 체인에 묶여 하네스가 돌지 못한다. 호출부에서
//   `decisionFromEnergy(dailyEnergy(saju, stem, branch))` 로 조립한다(DecisionTodayCard 참고).

// ─────────────────────────────────────────────────────────────────────────
// ★모먼트(daniel 2026-07-26): "오늘의 결정" → 이름을 **모먼트**로. 그리고 판정만 있던 카드에
//   "오늘은 이런 게 좋아요" 같은 **설레는 제안 한 줄**을 얹는다(daniel 예시: "혼술바 가서 이성과 한잔").
//
// ★새 명리 판정 0 — 여기서도 `dailyEnergy` 가 이미 낸 신호만 쓴다:
//   · 도화   = 이미 "눈에 띄고 사람이 모이는 결"로 판정·문장화돼 있다 → 만남·새 인연의 축
//   · 합     = "어우러지고 매듭이 지어지는 결" → 관계를 잇는 축
//   · 천을귀인 = "도와주는 사람이 붙는 날" → 소개·자리
//   · 역마   = "움직임·이동이 생기는 결" → 나들이
//   · 충형/공망 = 이미 조심 신호 → 톤을 낮춘 제안으로
//   신호가 없으면 오늘 들어온 기운(group)의 성격으로 제안한다(ENERGY_LABEL 과 같은 결).
//
// ⚠️§4 안전: **음주를 권하지 않는다.** daniel 예시의 '한잔' 톤은 살리되 "분위기 좋은 자리"처럼
//   장소·분위기로 표현한다(연령 등급·건강 문제 회피). 단정·부담 금지 — '좋아요' 권유까지만.
// ⚠️문구 = Claude 초안 → ★daniel 검수 슬롯.
// ─────────────────────────────────────────────────────────────────────────

/** 오늘의 모먼트 — 설레는 제안 한 줄. */
export type MomentPick = {
  key: string;    // 어떤 신호에서 나왔는지(하네스·디버그용)
  title: string;  // 한 줄 제안
  body: string;   // 왜/어떻게
};

/**
 * 오늘 기운 → 모먼트 제안 1건. 신호 우선순위로 하나만 고른다(결정론).
 * @param e dailyEnergy 산출물
 */
export function momentFromEnergy(e: DailyEnergy): MomentPick {
  const has = (k: string) => e.signals.some((s) => s.key === k);

  // 조심 신호가 강한 날은 먼저 톤을 낮춘다 — 설렘을 권하다 부담이 되지 않게(§4).
  if (has('gongmang')) {
    return { key: 'gongmang', title: '오늘은 가볍게, 부담 없이', body: '붕 뜨는 자리라 큰 고백·큰 약속은 미루고 짧은 차 한잔 정도가 좋아요.' };
  }
  if (has('chung')) {
    return { key: 'chung', title: '조용한 자리에서 둘이서', body: '말이 날카로워지기 쉬운 날이라 시끄러운 곳보다 조용한 데서 천천히 얘기하는 게 좋아요.' };
  }
  // 길신 — 사람이 붙고 어우러지는 날
  if (has('dohwa')) {
    return { key: 'dohwa', title: '오늘은 눈에 띄는 날 — 나가 보세요', body: '사람이 모이고 시선이 붙는 결이라, 분위기 좋은 바나 카페에서 새 인연이 스칠 만해요.' };
  }
  if (has('cheoneul')) {
    return { key: 'cheoneul', title: '소개받기 좋은 날', body: '도와주는 사람이 붙어요. 누가 자리를 만들어 준다면 마다하지 말고 나가 보세요.' };
  }
  if (has('hap')) {
    return { key: 'hap', title: '미뤄둔 사람에게 먼저 연락', body: '어우러지는 결이라, 연락이 끊겼던 사람과도 오늘은 말이 잘 붙어요.' };
  }
  if (has('yeokma')) {
    return { key: 'yeokma', title: '짧게라도 나가는 날', body: '움직임이 붙어요. 가까운 데라도 함께 다녀오면 기분이 확 풀립니다.' };
  }
  // 신호 없음 — 오늘 들어온 기운의 성격으로(새 판정 아님)
  switch (e.group) {
    case '비겁': return { key: 'group-비겁', title: '아는 사람과 편한 한잔', body: '나와 결이 같은 기운이 들어와요. 오래 본 사람과 편한 자리가 잘 맞습니다.' };
    case '식상': return { key: 'group-식상', title: '취향을 보여주는 자리', body: '표현이 살아나는 날이라, 좋아하는 걸 함께 하며 얘기 나누기 좋아요.' };
    case '재성': return { key: 'group-재성', title: '맛있는 걸 함께', body: '누리는 기운이 들어와요. 좋은 곳에서 잘 먹는 데 쓰면 만족이 큽니다.' };
    case '관성': return { key: 'group-관성', title: '단정한 자리가 잘 맞아요', body: '격이 잡히는 날이라, 차분하고 예의 있는 만남에서 좋은 인상이 남아요.' };
    default:     return { key: 'group-인성', title: '조용한 공간에서 깊은 대화', body: '마음이 차분해지는 기운이라, 소란한 곳보다 이야기가 남는 자리가 좋아요.' };
  }
}

/** 판정 → 표시 색상 키(테마색 대신 의미색). 카드·칩 공용. */
export const VERDICT_STYLE: Record<DecisionVerdict, { label: string; hex: string }> = {
  go: { label: '좋아요', hex: '#2E9E5B' },
  hold: { label: '보통', hex: '#C79A2E' },
  wait: { label: '미루기', hex: '#C4694A' },
};
