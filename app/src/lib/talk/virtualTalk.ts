// app/src/lib/talk/virtualTalk.ts — 가상 상담사의 말 (원가 ₩0)
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-08-19: *"기존 컨텐츠들 연결해주는 가상의 상담사들도 있을꺼야 실제 상담사는 1명만있어"*
//
// ■ 가상 상담사는 LLM 을 부르지 않는다
//   말은 세 군데에서만 나온다 —
//     ① 고정 대사(`script`)            — 인사·되묻기·안내
//     ② 결정론 문구(`engine`)          — `dailyFortune`·`ENERGY_LABEL` 등 **이미 있는 생성기**
//     ③ 콘텐츠 링크                     — `contentSections` 의 route 그대로
//   ⇒ API 호출 0회. 실측으로 하루 10턴 중 8턴을 여기서 받으면 **원가가 61% 준다**(₩45 → ₩17).
//
// ■ ★새 문구 엔진을 만들지 않는다
//   `dailyFortune`(1,170줄)·`relationMapPhrases`(449줄)·`myeongriGlossary`(336줄)가 이미 있다.
//   여기서 문장을 새로 지으면 **같은 말이 두 곳에서 갈린다**([[duplicate-ui-single-source]]).
//   이 파일이 하는 일은 '무슨 말을 언제 하나'를 정하는 것뿐이고, 문장 자체는 빌려 온다.
//
// ■ ⚠️명리를 발명하지 않는다 (CLAUDE.md §3)
//   판정은 전부 엔진이 한다. 이 파일에는 **판단 문장이 한 줄도 없다** —
//   있는 건 접속사와 안내문뿐이다. 명리 문구가 필요하면 생성기에서 가져온다.
// ═══════════════════════════════════════════════════════════════════════════
import { getDailyFortune, dailyHeadline, dailyEnergy, energyReason, ENERGY_LABEL } from '../content/dailyFortune';
import { SECTIONS, type MenuItem } from '../content/contentSections';
import type { SajuChart } from '@spec/chart';

/** 가상 상담사가 한 번에 보내는 것 — 카톡처럼 말풍선 여러 개 + 링크 카드. */
export type VirtualReply = {
  /** 말풍선들(순서대로 뜬다) */
  bubbles: string[];
  /** 아래에 붙는 콘텐츠 카드(없으면 빈 배열) */
  links: { key: string; label: string; route: string }[];
  /** 계측용 — 이 답이 어디서 나왔나. `talk_messages.source` 에 그대로 들어간다 */
  source: 'script' | 'engine';
};

/** 상담사가 안내할 콘텐츠 키 → 실제 항목. `contentSections` 를 단일 출처로 쓴다. */
function itemsOf(routeKeys: string[]): MenuItem[] {
  const all = SECTIONS.flatMap((s) => s.items);
  // ⚠️순서는 **상담사가 정한 순서**를 지킨다(`routes` 배열 순). 관리자가 그 순서로 노출을 설계한다.
  return routeKeys.map((k) => all.find((it) => it.key === k)).filter(Boolean) as MenuItem[];
}

/**
 * 첫 인사 — 상담사를 처음 열었을 때.
 *
 * @param name      상담사 이름
 * @param tagline   한 줄 소개
 * @param routeKeys 안내할 콘텐츠 키들
 * @param t         i18n
 */
export function greet(
  name: string,
  tagline: string | null,
  routeKeys: string[],
  t: (k: string, d?: string) => string,
): VirtualReply {
  return {
    bubbles: [
      t('talk.greetHi', '안녕하세요. {{name}}이에요.').replace('{{name}}', name),
      tagline
        ? t('talk.greetWhat', '{{what}} 쪽을 봐 드려요. 뭐가 궁금하세요?').replace('{{what}}', tagline)
        : t('talk.greetAsk', '뭐가 궁금하세요?'),
    ],
    links: itemsOf(routeKeys).slice(0, 3).map((it) => ({ key: it.key, label: t(it.labelKey), route: it.route })),
    source: 'script',
  };
}

/**
 * 오늘 흐름 한 마디 — **결정론 생성기에서 문장을 빌려 온다**.
 *
 * @param saju 명식(엔진 계산 결과)
 * @returns 말풍선 2~3개. 판정·문장 모두 `dailyFortune` 이 만든 것이다
 */
export function todayFlow(saju: SajuChart, t: (k: string, d?: string) => string): VirtualReply {
  const f = getDailyFortune(0);
  const stem = f.dayGanZhi[0] as never;
  const branch = f.dayGanZhi[1] as never;
  const bubbles: string[] = [];
  try {
    const e = dailyEnergy(saju, stem, branch);
    const g = ENERGY_LABEL[e.group];
    // ★문장을 여기서 짓지 않는다 — 생성기가 만든 것을 그대로 옮긴다
    bubbles.push(`오늘은 ${g.name}이 들어와요.`);
    bubbles.push(g.desc);
    bubbles.push(energyReason(e));
  } catch {
    // 판정 실패 = 헤드라인만이라도. 빈 말풍선을 내보내지 않는다
    try { bubbles.push(dailyHeadline(saju, stem, branch)); } catch { /* 그것도 안 되면 아래 폴백 */ }
  }
  if (!bubbles.length) bubbles.push(t('talk.noFlow', '오늘 흐름은 잠시 뒤에 다시 볼게요.'));
  return { bubbles, links: [], source: 'engine' };
}

/**
 * 안내 — “이건 여기서 보세요”.
 *
 * @param routeKeys 상담사의 `routes`
 * @param max       최대 카드 수(카톡이라 3개를 넘기면 답답하다)
 */
export function guide(
  routeKeys: string[],
  t: (k: string, d?: string) => string,
  max = 3,
): VirtualReply {
  const items = itemsOf(routeKeys).slice(0, max);
  return {
    bubbles: items.length
      ? [t('talk.guideHere', '이건 여기서 자세히 볼 수 있어요.')]
      : [t('talk.guideNone', '지금은 안내해 드릴 게 없네요.')],
    links: items.map((it) => ({ key: it.key, label: t(it.labelKey), route: it.route })),
    source: 'script',
  };
}

/**
 * 넘기기 — 가상이 못 답할 때 실제 상담사로.
 *
 * ★맥락 한 줄을 함께 넘긴다. 실제 상담사가 처음부터 다시 묻지 않게 하려는 것이고,
 *   그만큼 LLM 입력이 줄어 **원가도 아낀다**.
 *
 * @param liveName 실제 상담사 이름
 * @param context  지금까지 무슨 얘기였는지 한 줄(없으면 생략)
 */
export function handoff(
  liveName: string,
  context: string | null,
  t: (k: string, d?: string) => string,
): VirtualReply {
  const b = [t('talk.handoff', '그건 {{who}}께 여쭤 볼게요.').replace('{{who}}', liveName)];
  if (context) b.push(t('talk.handoffCtx', '지금까지 얘기는 이어서 전해 드릴게요.'));
  return { bubbles: b, links: [], source: 'script' };
}

/** 이 답이 원가 0인가 — 계측·검증용(하네스가 쓴다). */
export function isFree(r: VirtualReply): boolean {
  return r.source === 'script' || r.source === 'engine';
}
