// app/src/lib/bokType.ts — '타고난 복(福) 유형' 판정(온디바이스·무료·API 0)
// ─────────────────────────────────────────────────────────────────────────
// 가볍게 보기(secLight) 재미·공유. 사주 십신 분포(원국)에서 가장 강한 십신군 → 타고난 복.
//   stance(Claude 초안 — daniel 검수 슬롯): 재성=재복 / 인성=귀인복(문서·배움) / 식상=식복(여유·재능) / 관성=관복(명예·직위) / 비겁=인복(사람·동료).
//   §4: 강점 중심·전향적. 정통 진단 아닌 재미 매핑. 살리는 법(처방) 동반(가드5).
// ─────────────────────────────────────────────────────────────────────────
import type { SajuChart, TenGod } from '@spec/chart';
import { analyzeTenGods } from '@engine/structure';
import { appLang } from './i18n';

type G5 = '비겁' | '식상' | '재성' | '관성' | '인성';
const TO5: Record<string, G5> = {
  비견: '비겁', 겁재: '비겁', 식신: '식상', 상관: '식상',
  정재: '재성', 편재: '재성', 정관: '관성', 편관: '관성', 정인: '인성', 편인: '인성',
};

export type BokResult = { group: G5; emoji: string; bok: string; desc: string; how: string };

type Loc = { bok: string; desc: string; how: string };
const DATA: Record<G5, { emoji: string; ko: Loc; en: Loc; ja: Loc }> = {
  재성: {
    emoji: '💰',
    ko: { bok: '재물복', desc: '돈과 기회가 따르는 복을 타고났어요. 재물을 모으고 굴리는 감각이 남달라, 노력한 만큼 손에 쥐는 힘이 있습니다.', how: '성실히 모으되 베풀 줄도 알면 재물복이 더 크게 돌아와요.' },
    en: { bok: 'Wealth Fortune', desc: 'Born with money and opportunity on your side — a sharp sense for building and growing wealth.', how: 'Save diligently but give too, and fortune returns greater.' },
    ja: { bok: '財運の福', desc: 'お金とチャンスが付いてくる福。財を築き回す感覚に優れ、努力した分だけ手にする力があります。', how: '堅実に貯めつつ施すことも知れば、財運がより大きく巡ります。' },
  },
  인성: {
    emoji: '📚',
    ko: { bok: '귀인복', desc: '도와주는 사람과 배움의 복을 타고났어요. 곁에 늘 든든한 어른·스승·후원자가 있고, 문서·자격운도 좋습니다.', how: '배움을 이어 가고 인연을 소중히 하면 귀인이 더 많이 따라요.' },
    en: { bok: 'Mentor Fortune', desc: 'Blessed with helpers and learning — steady elders, teachers, and patrons by your side, with luck in documents and credentials.', how: 'Keep learning and cherish your ties, and more mentors appear.' },
    ja: { bok: '貴人の福', desc: '助けてくれる人と学びの福。頼れる年長者・師・後援者が常にそばにおり、文書・資格運も良好。', how: '学びを続け縁を大切にすれば貴人がより多く付きます。' },
  },
  식상: {
    emoji: '🍀',
    ko: { bok: '식복(여유복)', desc: '먹을 복과 여유의 복을 타고났어요. 재능과 즐길 거리가 풍부해, 어디서든 굶지 않고 인생을 즐길 줄 압니다.', how: '재능을 나누고 표현할수록 즐거움과 복이 함께 커져요.' },
    en: { bok: 'Bounty Fortune', desc: 'Born with comfort and plenty — rich in talent and joys, you know how to enjoy life and never go hungry.', how: 'Share and express your gifts, and joy and fortune grow together.' },
    ja: { bok: '食の福（余裕の福）', desc: '食べる福と余裕の福。才能と楽しみが豊かで、どこでも食いはぐれず人生を楽しめます。', how: '才能を分かち表すほど、楽しみと福が共に大きくなります。' },
  },
  관성: {
    emoji: '🎖️',
    ko: { bok: '관복(명예복)', desc: '이름과 자리의 복을 타고났어요. 책임을 맡으면 빛나고, 인정받아 높은 자리에 오르는 힘이 있습니다.', how: '맡은 책임을 묵묵히 다하면 자리와 명예가 따라와요.' },
    en: { bok: 'Honor Fortune', desc: 'Born for name and position — you shine when given responsibility and rise to be recognized.', how: 'Quietly fulfill your duties, and rank and honor follow.' },
    ja: { bok: '官の福（名誉の福）', desc: '名と地位の福。責任を担うと輝き、認められて高い地位に上る力があります。', how: '担った責任を黙々と果たせば、地位と名誉が付いてきます。' },
  },
  비겁: {
    emoji: '🤝',
    ko: { bok: '인복(사람복)', desc: '사람과 동료의 복을 타고났어요. 힘들 때 함께해 줄 이들이 곁에 있고, 의리로 뭉친 내 편이 큰 자산입니다.', how: '의리를 지키고 먼저 손 내밀면 사람복이 더 두터워져요.' },
    en: { bok: 'People Fortune', desc: 'Blessed with friends and allies — people stand by you in hard times, and your loyal circle is a great asset.', how: 'Keep your word and reach out first, and your circle grows stronger.' },
    ja: { bok: '人の福（人脈の福）', desc: '人と仲間の福。辛い時に共にいてくれる人がそばにおり、義理で結ばれた味方が大きな財産です。', how: '義理を守り先に手を差し伸べれば、人の福がより厚くなります。' },
  },
};

/** 사주(원국) 십신 분포에서 가장 강한 십신군 → 타고난 복. 동률이면 우선순위(재>관>인>식상>비겁). */
export function bokType(saju: SajuChart): BokResult {
  const { detail } = analyzeTenGods(saju);
  const g5: Record<G5, number> = { 비겁: 0, 식상: 0, 재성: 0, 관성: 0, 인성: 0 };
  for (const [k, n] of Object.entries(detail)) if ((n as number) > 0) g5[TO5[k as TenGod]] += n as number;
  const PRIORITY: G5[] = ['재성', '관성', '인성', '식상', '비겁'];
  let top: G5 = '재성', max = -1;
  for (const g of PRIORITY) if (g5[g] > max) { max = g5[g]; top = g; }
  const d = DATA[top];
  const lang = appLang() as 'ko' | 'en' | 'ja';
  const loc = d[lang] ?? d.ko;
  return { group: top, emoji: d.emoji, bok: loc.bok, desc: loc.desc, how: loc.how };
}
