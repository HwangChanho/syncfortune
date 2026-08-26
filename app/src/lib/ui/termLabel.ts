// app/src/lib/ui/termLabel.ts — 명리 **용어를 그 언어로 어떻게 적는가** (단일 원본)
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-08-27: *"명리 용어는 한자 그대로 두고 설명만 그 언어로"*
//
// ■ ★규칙
//   · **한국어** — 지금 그대로(비겁·식상·용신…). 한국 사용자가 읽던 말을 바꾸지 않는다.
//   · **그 밖의 언어** — **한자**(比劫·食傷·用神…). 번역하지 않는다.
//     「Peer star」 로 옮기면 우리 해자(용어)가 흐려지고, 되돌릴 말도 사라진다.
//
// ■ ★왜 한자인가 — 번역이 아니라 **고유명**이기 때문
//   십신·용신은 체계의 이름이지 뜻풀이가 아니다. 화학의 원소 기호를 언어마다 안 바꾸는 것과 같다.
//   못 읽는 사람을 위한 배려는 **설명**이 맡는다(그건 그 언어로 옮긴다).
//
// ■ ⚠️표는 여기서 **새로 만들지 않는다**
//   한자는 이미 `myeongriGlossary` 가 갖고 있다(검수를 거친 자료다).
//   여기서 또 적으면 «두 표가 다른 한자를 말하는» 날이 온다([[duplicate-ui-single-source]]).
// ═══════════════════════════════════════════════════════════════════════════
// ⚠️★언어를 **인자로 받는다** — i18next 를 여기서 import 하면
//   ①실행기에 따라 **다른 인스턴스**를 잡을 수 있고(실제로 테스트에서 한국어가 나왔다)
//   ②`lib/i18n` 을 물면 `react-native` 까지 딸려와 **단위 검증이 아예 막힌다**(실제로 막혔다).
//   ⇒ 이 저장소의 방식대로 «필요한 것을 받아 쓰는» 순수 함수로 둔다(`coinLedgerLabel(kind, t)` 와 같다).
// ★한자는 이 표들이 이미 갖고 있다 — 여기서 새로 적지 않는다
import { TENGOD_GLOSSARY, BASIC_GLOSSARY, GANGYAK_GLOSSARY, OHAENG_GLOSSARY } from '../content/myeongriGlossary';

/** 자리 이름(년·월·일·시) — 글로서리에 없는 것만 여기서 채운다. */
const PILLAR: Record<string, string> = {
  년: '年', 월: '月', 일: '日', 시: '時',
  // ⚠️글로서리에 **없는 것**만 여기 채운다. 「관살」 은 관성(正官)+편관(七殺)을 묶어 부르는 말이라
  //   글로서리에 항목이 없다 — 있는 것을 여기 또 적으면 두 표가 갈린다.
  관살: '官殺', 원국: '原局',
};

/**
 * 명리 용어의 **표시 글자**.
 *
 * @param ko   한국어 용어(예: `'비겁'`)
 * @param lang 지금 화면 언어(`i18n.language`). 한국어면 원문을 그대로 돌려준다
 * @returns 한국어면 그대로, 그 밖의 언어면 한자. 한자를 못 찾으면 **원문 그대로**(빈 칸보다 낫다)
 */
export function termLabel(ko: string, lang: string): string {
  const k = (ko ?? '').trim();
  if (!k) return ko;
  if ((lang || 'ko').startsWith('ko')) return ko;
  const pick = (o: unknown) => (o as Record<string, { hanja?: string }> | undefined)?.[k];
  const g = pick(BASIC_GLOSSARY) ?? pick(TENGOD_GLOSSARY) ?? pick(GANGYAK_GLOSSARY) ?? pick(OHAENG_GLOSSARY);
  return g?.hanja ?? PILLAR[k] ?? ko;
}
