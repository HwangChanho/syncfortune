// app/src/components/talk/blockRegistry.tsx — 홈 블록 = 친구목록의 「친구」
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-08-19: *"기존 오늘의 운세같은건 친구목록에 오늘의 운세로 떠있게하고
//                    그거 탭하면 대화창에서 기존에 보여주던 내용들 보여줄꺼야"* · *"홈에있던것들 전부"*
//
// ■ ★기존 컴포넌트를 **그대로** 쓴다
//   홈 블록 열은 이미 각자 독립 컴포넌트다. 대화창에서 새로 그리면
//   같은 내용이 두 곳에서 갈린다([[duplicate-ui-single-source]] — 지도 65 ↔ 궁합 76 사고).
//   ⇒ 이 파일은 **레지스트리일 뿐** 화면을 그리지 않는다.
//
// ■ 왜 홈 블록이 '친구'인가
//   카톡에서 채널·봇이 친구 목록에 섞여 있는 것과 같다. 사용자에겐 둘 다 "탭하면 뭔가 말해 주는 것"이고,
//   우리에겐 **원가 0**이라는 공통점이 있다(전부 온디바이스 결정론이다).
//   ⇒ 실제 상담사(LLM)만 다른 종류다. 그래서 `kind` 는 여기서도 `virtual` 이다.
//
// ■ 순서
//   `homeOrder`(운영자·사용자가 정한 홈 순서)를 그대로 따른다.
//   ★여기서 새 순서를 만들지 않는다 — 관리자 콘솔이 이미 홈 순서를 정하는데,
//     친구목록이 딴 순서를 쓰면 운영자가 바꾼 게 반영이 안 된다.
// ═══════════════════════════════════════════════════════════════════════════
import type { ReactElement } from 'react';
import { HouseAdBanner } from '../HouseAdBanner';
import { FreeTrioBlock } from '../home/FreeTrioBlock';
import { BonusStrip } from '../home/BonusStrip';
import { TodayFortuneBlock } from '../home/TodayFortuneBlock';
import { MonthFortuneBlock } from '../home/MonthFortuneBlock';   // 이달의 운세(Boss 2026-08-25)
import { PersonaTypeHero } from '../PersonaTypeHero';
import { SelfUnderstandingHero } from '../SelfUnderstandingHero';
import { BiorhythmCard } from '../BiorhythmCard';
import { LuckyTodayCard } from '../LuckyTodayCard';
import { DecisionTodayCard } from '../DecisionTodayCard';
import { TodayRelationCard } from '../TodayRelationCard';
import { RelationMapCard } from '../RelationMapCard';
import { ZiweiBlock } from '../ZiweiBlock';
import { StudyBlock } from './StudyBlock';
import { HOME_BLOCK_LABEL, type HomeBlockKey } from '../../lib/ui/homeOrder';

/** 블록을 그리는 데 필요한 것 — 홈이 주던 것과 같다. */
export type BlockCtx = { reloadKey: number; dateKey: string; repName: string | null };

/**
 * 블록 키 → 화면.
 * ★`renderBlock`(홈)과 **같은 컴포넌트·같은 인자**다. 사본이 아니라 같은 것을 가리킨다.
 */
const RENDER: Record<HomeBlockKey, (c: BlockCtx) => ReactElement> = {
  today:     (c) => <TodayFortuneBlock reloadKey={c.reloadKey} dateKey={c.dateKey} />,
  month:     (c) => <MonthFortuneBlock reloadKey={c.reloadKey} dateKey={c.dateKey} />,
  banner:    () => <HouseAdBanner />,
  free3:     (c) => <FreeTrioBlock dateKey={c.dateKey} />,
  bonus:     (c) => <BonusStrip name={c.repName} />,
  persona:   (c) => <PersonaTypeHero reloadKey={c.reloadKey} />,
  self:      (c) => <SelfUnderstandingHero reloadKey={c.reloadKey} />,
  biorhythm: (c) => <BiorhythmCard reloadKey={c.reloadKey} />,
  luck:      (c) => <LuckyTodayCard reloadKey={c.reloadKey} />,
  decision:  (c) => <DecisionTodayCard reloadKey={c.reloadKey} />,
  relation:  (c) => <TodayRelationCard reloadKey={c.reloadKey} dateKey={c.dateKey} />,
  relmap:    (c) => <RelationMapCard reloadKey={c.reloadKey} />,
  // ★자미두수 — 최자미가 대화를 열 때 뜬다(종전엔 `luck`=오늘의 행운이 떠 있었다)
  ziwei:     (c) => <ZiweiBlock reloadKey={c.reloadKey} />,
  // ★공부하기 — 내용은 `myeongriGlossary`(검수본) 그대로다. 여기서 명리를 새로 쓰지 않는다
  studysaju:  () => <StudyBlock topic="saju" />,
  studyziwei: () => <StudyBlock topic="ziwei" />,
};

/**
 * 친구목록에 **띄우지 않을** 블록.
 * ★배너(하우스 광고)는 '친구'가 아니다 — 사람으로 위장한 광고가 되면 그건 속이는 것이다.
 *   보너스도 뺀다: 있을 때만 뜨는 블록이라 친구목록에 늘 있으면 대부분 빈 대화가 된다.
 */
const NOT_A_FRIEND: HomeBlockKey[] = ['banner', 'bonus'];

/** 이 블록을 친구로 띄우나. */
export const isFriendBlock = (k: HomeBlockKey): boolean => !NOT_A_FRIEND.includes(k);

/** 블록 화면을 만든다(없는 키면 null). */
export function renderTalkBlock(k: HomeBlockKey, ctx: BlockCtx): ReactElement | null {
  return RENDER[k]?.(ctx) ?? null;
}

/** 친구 이름 — ★홈 배치 편집에서 쓰는 라벨과 **같은 표**를 쓴다(두 곳에서 다른 이름이 되지 않게). */
export const blockName = (k: HomeBlockKey): string => HOME_BLOCK_LABEL[k];
