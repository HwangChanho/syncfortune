// src/app/(app)/numerology.tsx — 콘텐츠 '수비학'(피타고리안, 신규 유료, daniel 2026-06-23)
// 앱(numerology.ts)이 생년월일로 수(생명수·생일수·개인해 등)를 결정론 산출 → Edge kind='numerology'(NUMEROLOGY_SYSTEM)가 해석.
//   도메인 지식은 Claude가 표준 피타고리안 레퍼런스로 인코딩(daniel 비전문). SpecialContentScreen.buildBody로 차트 전달.
import { useTranslation } from 'react-i18next';
import { SpecialContentScreen, FreeBasics } from '../../components/SpecialContentScreen';
import { colors } from '../../lib/theme';
import { buildNumerology } from '../../lib/numerology';

export default function NumerologyRoute() {
  const { t } = useTranslation();
  return (
    <SpecialContentScreen
      kind="numerology"
      themeColor={colors.ju}
      title={t('numerology.title', '수비학')}
      sub={t('numerology.sub', '생년월일에 담긴 수로 보는 나의 인생 방향·재능·올해 흐름')}
      genMsg={t('numerology.generating', '타고난 수를 읽는 중…')}
      // 생년월일 → 피타고리안 수 산출(이름 기반 3수는 로마자 필요 — v1은 날짜 기반)
      buildBody={(ch) => {
        const [datePart] = (ch.input.birthDateTime ?? '').split(' ');
        const [y, mo, d] = datePart.split('-').map(Number);
        return { numerologyChart: buildNumerology({ year: y, month: mo, day: d }) };
      }}
      // 무료 티어(하이브리드) — 핵심 수는 온디바이스로 먼저 무료, 깊은 해석은 유료 LLM
      freePreview={(ch) => {
        const [dp] = (ch.input.birthDateTime ?? '').split(' ');
        const [y, mo, d] = dp.split('-').map(Number);
        const n = buildNumerology({ year: y, month: mo, day: d });
        return <FreeBasics title={t('special.freeBasics', '먼저 무료로 — 나의 핵심 수')} rows={[['생명수', n.lifePath], ['생일수', n.birthday], ['올해 개인해', n.personalYear]]} />;
      }}
      sections={[
        { key: 'summary', label: t('numerology.summary', '한눈에') },
        { key: 'lifePath', label: t('numerology.lifePath', '생명수 — 인생 방향') },
        { key: 'innerYou', label: t('numerology.innerYou', '내면과 겉모습') },
        { key: 'talent', label: t('numerology.talent', '타고난 재능') },
        { key: 'thisYear', label: t('numerology.thisYear', '올해 흐름') },
        { key: 'advice', label: t('numerology.advice', '한마디') },
      ]}
    />
  );
}
