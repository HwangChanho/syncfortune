// src/app/(app)/roots.tsx — 콘텐츠 '명식의 뿌리'(통근·투출, 사주만, 유료/쿠폰)
// 지지 속 기운이 천간에 드러났나(투출)·뿌리내려 단단한가(통근) → 겉의 나·품은 힘·진짜 힘.
// 시각: 나무 모티프(가지=드러난 나 / 뿌리=품은 힘) + 초록(목) 테마.
import { useTranslation } from 'react-i18next';
import { SpecialContentScreen } from '../../components/SpecialContentScreen';
import { RootsTree } from '../../components/contentMotifs';
import { elementColor } from '../../lib/ohaeng';

export default function RootsRoute() {
  const { t } = useTranslation();
  return (
    <SpecialContentScreen
      kind="roots"
      themeColor={elementColor['木']}
      heroImage={require('../../../assets/icons/hero-roots.jpg')}
      heroMotif={<RootsTree />}
      title={t('roots.title', '명식의 뿌리')}
      sub={t('roots.sub', '겉으로 드러난 나와 속에 품은 힘, 그리고 진짜 단단한 기운을 짚어 드려요')}
      genMsg={t('roots.generating', '뿌리를 더듬는 중…')}
      sections={[
        { key: 'summary', label: t('roots.summary', '한눈에') },
        { key: 'surface', label: t('roots.surface', '드러난 나') },
        { key: 'depth', label: t('roots.depth', '속에 품은 힘') },
        { key: 'strength', label: t('roots.strength', '진짜 단단한 힘') },
        { key: 'gap', label: t('roots.gap', '겉과 속의 차이') },
        { key: 'advice', label: t('roots.advice', '이렇게 키워요') },
      ]}
    />
  );
}
