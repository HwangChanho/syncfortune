// app/src/lib/tarot.ts — 타로 메이저 아르카나 22 + 뽑기 (무료, 룰·온디바이스)
// ─────────────────────────────────────────────────────────────────────────
// 카드명은 영어(국제 표준), 키워드는 한국어(다국어는 추후 i18n). LLM·서버 0.
// 깊은 리딩(맥락 해석·스프레드)은 추후/프리미엄.
// ─────────────────────────────────────────────────────────────────────────
export type TarotCard = { id: number; name: string; keywords: string };

export const MAJOR_ARCANA: TarotCard[] = [
  { id: 0, name: 'The Fool', keywords: '새 시작·모험·순수' },
  { id: 1, name: 'The Magician', keywords: '의지·창조·기회' },
  { id: 2, name: 'The High Priestess', keywords: '직관·신비·내면' },
  { id: 3, name: 'The Empress', keywords: '풍요·모성·결실' },
  { id: 4, name: 'The Emperor', keywords: '권위·안정·질서' },
  { id: 5, name: 'The Hierophant', keywords: '전통·가르침·신념' },
  { id: 6, name: 'The Lovers', keywords: '사랑·선택·결합' },
  { id: 7, name: 'The Chariot', keywords: '의지·전진·승리' },
  { id: 8, name: 'Strength', keywords: '용기·인내·내면의 힘' },
  { id: 9, name: 'The Hermit', keywords: '성찰·고독·지혜' },
  { id: 10, name: 'Wheel of Fortune', keywords: '운명·전환·기회' },
  { id: 11, name: 'Justice', keywords: '균형·정의·인과' },
  { id: 12, name: 'The Hanged Man', keywords: '희생·관점 전환·기다림' },
  { id: 13, name: 'Death', keywords: '끝·변화·재생' },
  { id: 14, name: 'Temperance', keywords: '절제·조화·균형' },
  { id: 15, name: 'The Devil', keywords: '욕망·속박·집착' },
  { id: 16, name: 'The Tower', keywords: '붕괴·각성·급변' },
  { id: 17, name: 'The Star', keywords: '희망·영감·치유' },
  { id: 18, name: 'The Moon', keywords: '불안·환상·무의식' },
  { id: 19, name: 'The Sun', keywords: '성공·활력·기쁨' },
  { id: 20, name: 'Judgement', keywords: '부활·결단·각성' },
  { id: 21, name: 'The World', keywords: '완성·성취·통합' },
];

export function drawCard(): TarotCard & { reversed: boolean } {
  const card = MAJOR_ARCANA[Math.floor(Math.random() * MAJOR_ARCANA.length)];
  const reversed = Math.random() < 0.5; // 정/역방향
  return { ...card, reversed };
}
