// app/src/components/home/FreeTrioBlock.tsx — 홈 「무료로 체험해보세요!」 3열 (시안 p04)
// ═══════════════════════════════════════════════════════════════════════════
// ■ 무엇을 하는가
//   무료 온디바이스 콘텐츠(29종) 중 **오늘의 3장**을 골라 시안의 3열 카드로 보여준다.
//
// ■ 왜 '오늘의 3장'인가 (고정 3개가 아니라)
//   무료 카드가 29종인데 3장만 고정하면 나머지 26종은 홈에서 영영 안 보인다.
//   그렇다고 무작위로 뽑으면 **같은 날 화면을 다시 열 때마다 바뀌어** 방금 본 카드를 못 찾는다.
//   ⇒ 날짜(`dateKey`)를 시드로 쓰는 **결정론적 회전**: 하루 안에서는 고정, 날이 바뀌면 다음 3장.
//     서버도 난수도 필요 없고(API 0원), 어제 뭘 봤는지 저장할 필요도 없다.
//
// ■ 데이터 출처
//   `contentSections.SECTIONS` 하나뿐이다 — 홈이 따로 목록을 갖지 않는다.
//   새 무료 콘텐츠를 거기 추가하면 **여기 손대지 않아도** 회전에 자동으로 낀다([[duplicate-ui-single-source]]).
//
// ⚠️`creditKey` 가 붙은 카드는 제외한다 — 'love'처럼 `content: true` 이면서 유료인 것이 있어서,
//   `content` 만 보고 뽑으면 「무료로 체험해보세요!」 아래에 **유료 카드**가 앉는다(문구가 거짓이 된다).
// ═══════════════════════════════════════════════════════════════════════════
import { useMemo } from 'react';
import { useRouter } from 'expo-router';
import { SECTIONS, type MenuItem } from '../../lib/content/contentSections';
import { SectionTitle } from '../kit/SectionTitle';
import { TrioCards } from '../kit/TrioCards';
import { useTranslation } from 'react-i18next';

/** 홈에 세울 카드 수 — 시안이 3열이다. */
const SLOTS = 3;

/**
 * 무료·즉시열람 카드만 남긴다.
 * @returns 목록 순서 그대로의 무료 카드들(회전의 기준 순서가 되므로 정렬을 바꾸지 않는다)
 */
function freePool(): MenuItem[] {
  return SECTIONS.flatMap((s) => s.items).filter(
    (it) => it.content && !it.creditKey && it.ready && !it.hiddenInList,
  );
}

/**
 * 날짜 문자열을 회전 시작 위치로 바꾼다.
 * @param dateKey `2026-08-18` 같은 날짜 키
 * @param mod     풀 크기
 * @returns 0..mod-1 — 같은 날엔 항상 같은 값
 */
function seedOf(dateKey: string, mod: number): number {
  if (mod <= 0) return 0;
  let h = 0;
  for (let i = 0; i < dateKey.length; i++) h = (h * 31 + dateKey.charCodeAt(i)) >>> 0;
  return h % mod;
}

/**
 * 홈 「무료로 체험해보세요!」 블록.
 *
 * @param dateKey 오늘 날짜 키. 이 값이 바뀌면 다른 3장이 나온다(홈이 이미 갖고 있는 값을 넘겨 쓴다)
 */
export function FreeTrioBlock({ dateKey }: { dateKey: string }) {
  const router = useRouter();
  const { t } = useTranslation();

  const picks = useMemo(() => {
    const pool = freePool();
    if (!pool.length) return [];
    const start = seedOf(dateKey, pool.length);
    // 이어붙여 자르면 끝에서 앞으로 자연스럽게 감긴다(범위 계산을 손으로 하지 않는다)
    return [...pool, ...pool].slice(start, start + SLOTS);
  }, [dateKey]);

  if (picks.length < SLOTS) return null;   // 풀이 3장도 안 되면 그리지 않는다(빈 칸을 만들지 않는다)

  return (
    <>
      <SectionTitle sub={t('home.freeTrioSub')}>{t('home.freeTrio')}</SectionTitle>
      <TrioCards
        items={picks.map((it) => ({
          title: t(it.labelKey),
          image: it.image,
          cta: t('home.seeMore'),
          onPress: () => router.push(it.route as never),
        }))}
      />
    </>
  );
}
