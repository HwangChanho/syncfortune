// src/app/(app)/celeb/[id].tsx — 유명인 1인 ↔ 나 사주 매칭 상세(daniel 기획 B)
// SpecialContentScreen 재사용: kind='celeb'(크레딧 공용) + category='celeb_{id}'(인물별 캐시). buildBody=유명인 차트(앱 산출)+메타.
// ⚠️ 재미·추정 — 투자/정치 단정 금지·명예 존중(CELEB_SYSTEM 가드).
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SpecialContentScreen } from '../../../components/SpecialContentScreen';
import { colors } from '../../../lib/theme';
import { computeChart } from '../../../lib/engine';
import { CELEBRITIES, celebChartInput } from '../../../lib/celebrities';

export default function CelebDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const celeb = CELEBRITIES.find((c) => c.id === id);
  if (!celeb) return null;
  const celebChart = computeChart(celebChartInput(celeb)); // 유명인 차트(공개 생일·시주 제외) — body로 Edge 전달
  return (
    <SpecialContentScreen
      kind="celeb"
      category={`celeb_${celeb.id}`}
      themeColor={colors.ju}
      title={`${celeb.flag} ${celeb.name}`}
      sub={`${celeb.role} · ${t('celeb.matchSub', '나와의 사주 매칭')}`}
      genMsg={t('celeb.generating', '두 사주를 견주는 중…')}
      buildBody={() => ({ celebChart, celebMeta: { name: celeb.name, role: celeb.role } })}
      sections={[
        { key: 'celebNature', label: t('celeb.nature', '이 사람의 기질·강점') },
        { key: 'match', label: t('celeb.match', '나와의 닮은꼴·궁합') },
        { key: 'learn', label: t('celeb.learn', '내가 배울 점') },
        { key: 'flow', label: t('celeb.flow', '지금 운의 흐름(재미로)') },
        { key: 'caution', label: t('celeb.caution', '재미로 보기') },
      ]}
    />
  );
}
