// src/app/(app)/child.tsx — 콘텐츠 '자식운'(원국으로 보는 자녀 인연·기질·부모로서의 나, 프리미엄 포함)
// ─────────────────────────────────────────────────────────────────────────
// daniel 2026-07-02: 프리미엄 5번째 콘텐츠 — 프리미엄 명식이면 무료(자동생성), 비프리미엄은 개별 유료.
//   현재는 SINGLE-MODE(대표 명식 1인)만. 부부 교차(coupleCross)는 추후 배우자 입력 추가 예정 →
//   지금은 Edge가 coupleCross="" 반환, SpecialContentScreen이 빈 값 섹션을 자동으로 건너뜀.
//   Edge kind='child'(사주 차트만 사용 — buildBody 불필요). premiumCovered=true(프리미엄 무료해제·자동생성).
// ─────────────────────────────────────────────────────────────────────────
import { useTranslation } from 'react-i18next';
import { SpecialContentScreen } from '../../components/SpecialContentScreen';
import { colors } from '../../lib/theme';

export default function ChildRoute() {
  const { t } = useTranslation();
  return (
    <SpecialContentScreen
      kind="child"
      premiumCovered
      themeColor={colors.ju}
      title={t('child.title', '자식운')}
      sub={t('child.sub', '원국으로 보는 자녀 인연·기질·부모로서의 나')}
      genMsg={t('child.gen', '자녀 인연을 살피는 중…')}
      showExpiry
      sections={[
        { key: 'bigPicture', label: t('child.bigPicture', '자녀 인연의 큰 그림') },
        { key: 'childNature', label: t('child.childNature', '자녀의 기질') },
        { key: 'asParent', label: t('child.asParent', '부모로서의 나') },
        // 부부 자녀 인연 — 현재 single-mode에선 Edge가 "" 반환 → 빈 값이라 자동 미표시(배우자 입력 추가 시 노출).
        { key: 'coupleCross', label: t('child.coupleCross', '부부 자녀 인연') },
        { key: 'communication', label: t('child.communication', '소통·관계') },
        { key: 'timing', label: t('child.timing', '시기 흐름') },
        { key: 'talent', label: t('child.talent', '자녀의 재능') },
        { key: 'health', label: t('child.health', '건강 관리축') },
        { key: 'remedy', label: t('child.remedy', '개운·처방') },
      ]}
    />
  );
}
