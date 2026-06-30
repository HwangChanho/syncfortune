// src/app/(app)/talent.tsx — 콘텐츠 '나의 타고난 재능'(신규 유료, daniel 2026-06-23)
// 월지 중심축 백본: 타고난 재능 + 좋아하는 일 vs 해야 하는 일(중심축 십신) + 돈 쫓기 vs 돈이 옴(재성·재생살).
// Edge kind='talent' → TALENT_SYSTEM(+WOLJI_AXIS_BLOCK) + buildWoljiAxis 결정론 주입. SpecialContentScreen 재사용.
import { useTranslation } from 'react-i18next';
import { SpecialContentScreen } from '../../components/SpecialContentScreen';
import { colors } from '../../lib/theme';

export default function TalentRoute() {
  const { t } = useTranslation();
  return (
    // 유료 단일 풀이 → 생성일+1년 '보유 만료일' 표시(daniel #25)
    <SpecialContentScreen
      kind="talent"
      showExpiry
      themeColor={colors.ju}
      title={t('talent.title', '나의 타고난 재능')}
      sub={t('talent.sub', '무엇을 타고났는지, 좋아하는 일·해야 하는 일 중 어디서 빛나는지, 돈을 어떻게 다뤄야 하는지 짚어 드려요')}
      genMsg={t('talent.generating', '타고난 재능을 읽는 중…')}
      sections={[
        { key: 'summary', label: t('talent.summary', '한눈에') },
        { key: 'talent', label: t('talent.talent', '타고난 재능') },
        { key: 'drive', label: t('talent.drive', '좋아하는 일 vs 해야 하는 일') },
        { key: 'money', label: t('talent.money', '돈을 다루는 법') },
        { key: 'howToUse', label: t('talent.howToUse', '재능을 살리는 법') },
        { key: 'careers', label: t('talent.careers', '빛나는 일·분야') },
        { key: 'advice', label: t('talent.advice', '한마디') },
      ]}
    />
  );
}
