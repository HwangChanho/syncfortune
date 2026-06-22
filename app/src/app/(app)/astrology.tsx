// src/app/(app)/astrology.tsx — 콘텐츠 '별자리 운세'(서양 네이탈, 신규 유료, daniel 2026-06-23)
// 앱(astrology.ts)이 출생 순간(일시+위경도)으로 네이탈 차트(행성·상승궁·어스펙트)를 결정론 산출 → Edge kind='astrology'(ASTROLOGY_SYSTEM)가 해석.
//   위경도는 출생지 피커에서 추출(birthLat/birthLon). 없으면(구버전 명식) 서울 기본 — 명식 재저장 시 정확해짐.
import { useTranslation } from 'react-i18next';
import { SpecialContentScreen } from '../../components/SpecialContentScreen';
import { colors } from '../../lib/theme';
import { buildNatal } from '../../lib/astrology';

export default function AstrologyRoute() {
  const { t } = useTranslation();
  return (
    <SpecialContentScreen
      kind="astrology"
      themeColor={colors.ju}
      title={t('astrology.title', '별자리 운세')}
      sub={t('astrology.sub', '태어난 순간 하늘로 보는 나 — 태양·달·상승궁과 행성들')}
      genMsg={t('astrology.generating', '별자리를 읽는 중…')}
      // 출생 일시 + 위경도 → 네이탈 차트. 위도 없으면 서울 기본(daniel: 출생지 피커서 추출하도록 보강함)
      buildBody={(ch) => {
        const [datePart, timePart] = (ch.input.birthDateTime ?? '').split(' ');
        const [y, mo, d] = datePart.split('-').map(Number);
        const [h, mi] = (timePart ?? '0:0').split(':').map(Number);
        return { natalChart: buildNatal({
          year: y, month: mo, day: d, hour: h || 0, minute: mi || 0,
          latitude: ch.input.birthLat ?? 37.5665, longitude: ch.input.birthLon ?? 126.978,
        }) };
      }}
      sections={[
        { key: 'summary', label: t('astrology.summary', '한눈에') },
        { key: 'big3', label: t('astrology.big3', '태양·달·상승궁') },
        { key: 'love', label: t('astrology.love', '사랑·욕구') },
        { key: 'work', label: t('astrology.work', '일·성취') },
        { key: 'strength', label: t('astrology.strength', '타고난 강점') },
        { key: 'challenge', label: t('astrology.challenge', '과제') },
        { key: 'advice', label: t('astrology.advice', '한마디') },
      ]}
    />
  );
}
