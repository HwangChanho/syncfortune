// src/app/(app)/mission.tsx — 콘텐츠 '나의 사명'(사주 主 + 자미 보조 교차, 유료/쿠폰)
// 격국·재능·필요한 기운(사주)을 主로, 명궁·관록궁·복덕궁(자미)을 보조로 교차해 '무엇을 위해 태어났나'.
// 시각: 별자리 모티프(북극성=사명 / 작은 별=자미 보조) + 골드 테마.
import { useTranslation } from 'react-i18next';
import { SpecialContentScreen } from '../../components/SpecialContentScreen';
import { MissionStars } from '../../components/contentMotifs';
import { colors } from '../../lib/theme';

export default function MissionRoute() {
  const { t } = useTranslation();
  return (
    <SpecialContentScreen
      kind="mission"
      needsZiwei                                 // 사명 = 사주 + 자미 교차(자미 명반 body 전달)
      themeColor={colors.ju}
      heroImage={require('../../../assets/icons/hero-mission.jpg')}
      heroMotif={<MissionStars />}
      title={t('mission.title', '나의 사명')}
      sub={t('mission.sub', '타고난 그릇과 재능으로 본, 내가 무엇을 위해 태어났는지')}
      genMsg={t('mission.generating', '타고난 사명을 읽는 중…')}
      sections={[
        { key: 'summary', label: t('mission.summary', '한눈에') },
        { key: 'coreNature', label: t('mission.coreNature', '타고난 본질') },
        { key: 'calling', label: t('mission.calling', '나의 소명') },
        { key: 'strengths', label: t('mission.strengths', '타고난 무기') },
        { key: 'howToRealize', label: t('mission.howToRealize', '펼치는 길') },
        { key: 'careers', label: t('mission.careers', '어울리는 일·직무') },
        { key: 'environment', label: t('mission.environment', '빛나는 환경') },
        { key: 'lifeTheme', label: t('mission.lifeTheme', '인생 주제') },
        { key: 'crossInsight', label: t('mission.crossInsight', '함께 가리키는 방향') },
        { key: 'advice', label: t('mission.advice', '사명을 살아내는 법') },
      ]}
    />
  );
}
