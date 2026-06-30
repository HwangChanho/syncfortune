// src/app/(app)/image.tsx — 콘텐츠 '비치는 나'(천간 인상, 사주만, 유료/쿠폰)
// 천간(특히 일간) → 남에게 보이는 첫인상·풍기는 분위기·관계에서 비치는 모습.
// 시각: 오행 5색 오라 모티프(빛/거울) + 보라 테마.
import { useTranslation } from 'react-i18next';
import { SpecialContentScreen } from '../../components/SpecialContentScreen';
import { ImageAura } from '../../components/contentMotifs';

export default function ImageRoute() {
  const { t } = useTranslation();
  return (
    // 유료 단일 풀이 → 생성일+1년 '보유 만료일' 표시(daniel #25)
    <SpecialContentScreen
      kind="image"
      showExpiry
      themeColor="#A78BFA"
      heroImage={require('../../../assets/icons/hero-image.jpg')}
      heroMotif={<ImageAura />}
      title={t('image.title', '비치는 나')}
      sub={t('image.sub', '남에게 비치는 첫인상과 분위기, 관계 속 내 모습을 짚어 드려요')}
      genMsg={t('image.generating', '비치는 인상을 그리는 중…')}
      sections={[
        { key: 'summary', label: t('image.summary', '한눈에') },
        { key: 'firstImpression', label: t('image.firstImpression', '첫인상') },
        { key: 'persona', label: t('image.persona', '드러나는 이미지') },
        { key: 'inRelationship', label: t('image.inRelationship', '관계 속 나') },
        { key: 'charm', label: t('image.charm', '매력 포인트') },
        { key: 'gap', label: t('image.gap', '겉과 속') },
        { key: 'advice', label: t('image.advice', '이렇게 보여 주세요') },
      ]}
    />
  );
}
