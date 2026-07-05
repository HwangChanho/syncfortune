// src/app/(app)/crush.tsx — 콘텐츠 '짝사랑 인연운'(본인 명식 단일, 사주만, 유료/쿠폰)
// ─────────────────────────────────────────────────────────────────────────
// daniel 표준 십신 draft(★검수): 인연星 = 재성(남명)/관성(여명), 도화(왕지 子午卯酉)·홍염 = 매력·끌림,
//   일지(배우자궁) 상태. 운(대운·세운·월운)에서 인연星·도화가 발동하는 시점 = 짝사랑/썸이 무르익는 시기.
//   → 내 crush가 이뤄질지·나에게 마음이 있을 사람의 결·시기·건강하게 다가가는 법을 본다.
// §4 안전: 스토킹성·집착 조장 금지, 상대 사생활 단정 금지 — 결·시기는 CRUSH_SYSTEM(LLM)이 경향·조언 톤으로.
// ─────────────────────────────────────────────────────────────────────────
import { useTranslation } from 'react-i18next';
import { SpecialContentScreen } from '../../components/SpecialContentScreen';
import { CrushTiming } from '../../components/CrushTiming';
import { colors } from '../../lib/theme';

export default function CrushRoute() {
  const { t } = useTranslation();
  return (
    // 유료 단일 풀이 → 생성일+1년 '보유 만료일' 표시(daniel #25). 개별 구매(프리미엄 미포함).
    <SpecialContentScreen
      kind="crush"
      showExpiry
      themeColor={colors.ju}
      heroImage={require('../../../assets/icons/crush.jpg')}
      // ★무료 온디바이스 훅 — 도화 발동 '매력·인연이 도는 달' 달력(히어로 아래·항상 노출). 깊은 통변은 이 아래 유료.
      freeHook={(saju) => <CrushTiming saju={saju} />}
      title={t('crush.title', '짝사랑 인연운')}
      sub={t('crush.sub', '지금 나의 매력과, 짝사랑·썸이 무르익기 좋은 시기, 다가가는 법을 짚어 드려요')}
      genMsg={t('crush.generating', '끌림의 기운과 인연의 흐름을 읽는 중…')}
      sections={[
        { key: 'myCharm', label: t('crush.myCharm', '지금 나의 매력') },
        { key: 'whoLikesMe', label: t('crush.whoLikesMe', '나에게 끌릴 사람') },
        { key: 'timing', label: t('crush.timing', '썸이 무르익는 시기') },
        { key: 'howToApproach', label: t('crush.howToApproach', '다가가는 법') },
        { key: 'caution', label: t('crush.caution', '조심할 점') },
      ]}
    />
  );
}
