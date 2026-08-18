// app/src/components/home/FreeTrioBlock.tsx — 홈 「무료로 체험해보세요!」 3열 (시안 p04)
// ═══════════════════════════════════════════════════════════════════════════
// ■ 무엇을 하는가
//   무료 온디바이스 콘텐츠(29종) 중 **오늘의 3장**을 골라 시안의 3열 카드로 보여준다.
//
// ■ ★2026-08-18 — **시안대로 3종 고정**(자미두수 · 타로 · 점성술)
//   처음엔 무료 29종을 날짜 시드로 돌렸다("3장 고정이면 나머지 26종이 홈에서 영영 안 보인다").
//   그런데 시안(p04·p13·p37…)은 **다섯 오행 세트 전부**에서 이 세 개로 고정이고,
//   Boss 가 그 자리에 쓸 **전용 아이콘을 오행별로** 만들어 줬다(`brand/f3-*`).
//   ⇒ 고정이 곧 디자인이다. 회전시키면 그림과 이름이 어긋난다.
//   ★나머지 무료 콘텐츠는 '운세' 탭이 통째로 맡는다 — 홈에서 다 보여 줄 이유가 없다.
//
// ■ 아이콘은 **테마 오행을 따라간다**
//   `freeTrioIcon(kind)` 가 지금 오행 색을 준다. 화면이 붉어지면 아이콘도 붉어진다.
// ═══════════════════════════════════════════════════════════════════════════
import { useRouter } from 'expo-router';
import { SectionTitle } from '../kit/SectionTitle';
import { freeTrioIcon } from '../../lib/ui/brandAsset';
import { TrioCards } from '../kit/TrioCards';
import { useTranslation } from 'react-i18next';

/**
 * 시안이 고정한 3종. `route` 는 우리 콘텐츠로 연결한다.
 * ⚠️여기 순서가 곧 화면 순서다(시안과 같게 유지).
 */
const TRIO = [
  { kind: 'ziwei' as const, labelKey: 'menu.ziwei', route: '/ziwei' },
  { kind: 'taro' as const,  labelKey: 'menu.taro',  route: '/taro' },
  { kind: 'astro' as const, labelKey: 'menu.astrology', route: '/astrology' },
];

export function FreeTrioBlock({ dateKey: _dateKey }: { dateKey?: string }) {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <>
      <SectionTitle sub={t('home.freeTrioSub')}>{t('home.freeTrio')}</SectionTitle>
      <TrioCards
        items={TRIO.map((it) => ({
          title: t(it.labelKey),
          image: freeTrioIcon(it.kind),
          cta: t('home.seeMore'),
          onPress: () => router.push(it.route as never),
        }))}
      />
    </>
  );
}
