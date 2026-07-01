// app/src/lib/pastLife.ts — '전생 이야기' 판정(온디바이스·무료·API 0)
// ─────────────────────────────────────────────────────────────────────────
// 가볍게 보기(secLight) 재미·공유 판타지. 사주 = 일간 오행(시대 분위기) × 가장 강한 십신군(신분) → 전생 이야기.
//   stance(Claude 초안 — daniel 검수 슬롯): 명리 진단 아닌 *재미 서사*. 오행→시대 무드, 십신군→신분.
//   관성=관리/장수 / 인성=선비/도사 / 식상=예인 / 재성=거상 / 비겁=무사. §4: 전향적·긍정.
// ─────────────────────────────────────────────────────────────────────────
import type { SajuChart, TenGod } from '@spec/chart';
import { analyzeTenGods } from '@engine/structure';
import { appLang } from '../i18n';

type G5 = '비겁' | '식상' | '재성' | '관성' | '인성';
type Lang = 'ko' | 'en' | 'ja';
const TO5: Record<string, G5> = {
  비견: '비겁', 겁재: '비겁', 식신: '식상', 상관: '식상',
  정재: '재성', 편재: '재성', 정관: '관성', 편관: '관성', 정인: '인성', 편인: '인성',
};

export type PastLifeResult = { emoji: string; era: string; role: string; story: string; hint: string; elem: string; group: string };

// 일간 오행 → 시대 무드(이름·도입). 재미 판타지 stance.
const ERA: Record<string, { ko: { name: string; intro: string }; en: { name: string; intro: string }; ja: { name: string; intro: string } }> = {
  木: { ko: { name: '푸른 숲의 시대', intro: '만물이 푸르게 자라나던 그 시절' }, en: { name: 'an Age of Green Forests', intro: 'In an era when all things grew lush and green' }, ja: { name: '青き森の時代', intro: '万物が青々と育っていたあの頃' } },
  火: { ko: { name: '불꽃의 난세', intro: '영웅과 전란이 교차하던 그 시절' }, en: { name: 'an Age of Flames', intro: 'In an era when heroes and wars crossed paths' }, ja: { name: '炎の乱世', intro: '英雄と戦乱が交差したあの頃' } },
  土: { ko: { name: '풍요의 태평성대', intro: '곳간이 넉넉하고 인심이 두텁던 그 시절' }, en: { name: 'a Golden Age of Plenty', intro: 'In an era of full granaries and warm hearts' }, ja: { name: '豊かな太平の世', intro: '蔵が満ち人情が厚かったあの頃' } },
  金: { ko: { name: '격변의 개화기', intro: '낡은 것이 무너지고 새것이 솟아나던 그 시절' }, en: { name: 'an Age of Upheaval', intro: 'In an era when the old fell and the new arose' }, ja: { name: '激変の開化期', intro: '古きが崩れ新しきが芽吹いたあの頃' } },
  水: { ko: { name: '문예의 시절', intro: '글과 노래가 강물처럼 흐르던 그 시절' }, en: { name: 'an Age of Arts & Letters', intro: 'In an era when words and songs flowed like rivers' }, ja: { name: '文芸の時代', intro: '文と歌が川のように流れたあの頃' } },
};

// 가장 강한 십신군 → 신분(전생 역할).
const ROLE: Record<G5, { emoji: string; ko: { title: string; life: string; echo: string }; en: { title: string; life: string; echo: string }; ja: { title: string; life: string; echo: string } }> = {
  관성: { emoji: '🏯', ko: { title: '나라를 지키는 관리', life: '법과 질서를 세우고 사람들을 이끌며 이름을 남겼습니다.', echo: '책임을 지는 무게' }, en: { title: 'an official who guarded the realm', life: 'You upheld law and order, led others, and left your name.', echo: 'the weight of responsibility' }, ja: { title: '国を守る官吏', life: '法と秩序を立て人々を導き名を残しました。', echo: '責任を負う重み' } },
  인성: { emoji: '📜', ko: { title: '학문을 닦는 선비', life: '책과 사색 속에서 도를 구하고 후학을 길렀습니다.', echo: '배우고 가르치려는 마음' }, en: { title: 'a scholar of deep learning', life: 'You sought the Way in books and thought, and raised students.', echo: 'a heart that learns and teaches' }, ja: { title: '学問を修める士', life: '書と思索の中で道を求め後学を育てました。', echo: '学び教えようとする心' } },
  식상: { emoji: '🎭', ko: { title: '사람을 홀리는 예인', life: '재주와 흥으로 세상을 즐겁게 하고 이름을 떨쳤습니다.', echo: '타고난 끼와 재능' }, en: { title: 'an entertainer who enchanted crowds', life: 'You delighted the world with talent and flair, and won renown.', echo: 'innate flair and talent' }, ja: { title: '人を魅了する芸人', life: '才と興で世を楽しませ名を轟かせました。', echo: '生まれ持った才と個性' } },
  재성: { emoji: '💰', ko: { title: '거리를 누비는 거상', life: '물길과 장터를 오가며 재물을 모으고 베풀었습니다.', echo: '재물을 다루는 수완' }, en: { title: 'a great merchant of the roads', life: 'You roamed waterways and markets, amassing and sharing wealth.', echo: 'a knack for handling fortune' }, ja: { title: '街を巡る豪商', life: '水路と市を行き来し財を築き施しました。', echo: '財を扱う手腕' } },
  비겁: { emoji: '⚔️', ko: { title: '의리로 뭉친 무사', life: '뜻 맞는 이들과 어울려 약한 이를 돕고 의를 지켰습니다.', echo: '굽히지 않는 기개' }, en: { title: 'a warrior bound by loyalty', life: 'You gathered kindred spirits, helped the weak, and kept your honor.', echo: 'an unyielding spirit' }, ja: { title: '義で結ばれた武士', life: '志を同じくする者と弱きを助け義を守りました。', echo: '屈しない気概' } },
};

/** 사주 = 일간 오행(시대) × 가장 강한 십신군(신분) → 전생 이야기. 동률이면 우선순위(관>인>식상>재>비겁). */
export function pastLife(saju: SajuChart): PastLifeResult {
  const { detail } = analyzeTenGods(saju);
  const g5: Record<G5, number> = { 비겁: 0, 식상: 0, 재성: 0, 관성: 0, 인성: 0 };
  for (const [k, n] of Object.entries(detail)) if ((n as number) > 0) g5[TO5[k as TenGod]] += n as number;
  // 가장 강한 십신군 → 신분. 동률(흔함)이면 고정 우선순위가 다 '관성(관리)'으로 쏠리므로,
  //   동률 그룹은 차트 고유값(일간 + 총 십신수)으로 분산해 다양성을 준다(재미 콘텐츠 — 25종 고르게, daniel).
  const PRIORITY: G5[] = ['관성', '인성', '식상', '재성', '비겁'];
  const maxN = Math.max(...PRIORITY.map((g) => g5[g]));
  const tied = PRIORITY.filter((g) => g5[g] === maxN);          // 동률(최다) 그룹들
  const stemIdx = Math.max(0, '甲乙丙丁戊己庚辛壬癸'.indexOf(saju.dayMaster.stem));
  const totalN = PRIORITY.reduce((s, g) => s + g5[g], 0);
  const top: G5 = tied[(stemIdx + totalN) % tied.length];        // 차트별로 동률을 골고루 분산
  const element = saju.dayMaster.element ?? '木';
  const lang = appLang() as Lang;
  const era = (ERA[element] ?? ERA['木'])[lang] ?? ERA['木'].ko;
  const role = ROLE[top];
  const r = role[lang] ?? role.ko;
  // 언어별 한 토막 서사 + 현생 연결
  const story = lang === 'en'
    ? `${era.intro}, you lived as ${r.title}. ${r.life}`
    : lang === 'ja'
    ? `${era.intro}、あなたは${r.title}として生きました。${r.life}`
    : `${era.intro}, 당신은 ${r.title}(으)로 살았습니다. ${r.life}`;
  const hint = lang === 'en'
    ? `That '${r.echo}' still flows in you today.`
    : lang === 'ja'
    ? `その「${r.echo}」が今のあなたにも流れています。`
    : `그때의 '${r.echo}'이(가) 지금의 당신에게도 흐르고 있어요.`;
  return { emoji: role.emoji, era: era.name, role: r.title, story, hint, elem: element, group: top };
}
