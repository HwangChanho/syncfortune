// src/app/(app)/astrology.tsx — 콘텐츠 '별자리 운세'(서양 네이탈, 신규 유료, daniel 2026-06-23)
// 앱(astrology.ts)이 출생 순간(일시+위경도)으로 네이탈 차트(행성·상승궁·어스펙트)를 결정론 산출 → Edge kind='astrology'(ASTROLOGY_SYSTEM)가 해석.
//   위경도는 출생지 피커에서 추출(birthLat/birthLon). 없으면(구버전 명식) 서울 기본 — 명식 재저장 시 정확해짐.
import { useTranslation } from 'react-i18next';
import { SpecialContentScreen, FreeBasics } from '../../components/SpecialContentScreen';
import { colors } from '../../lib/theme';
import { buildNatal } from '../../lib/astrology';

// 별자리 영문명 → 한글(무료 빅3 미리보기용). 통변(유료)은 Edge가 한글로 풀어줌.
const SIGN_KO: Record<string, string> = {
  Aries: '양자리', Taurus: '황소자리', Gemini: '쌍둥이자리', Cancer: '게자리', Leo: '사자자리', Virgo: '처녀자리',
  Libra: '천칭자리', Scorpio: '전갈자리', Sagittarius: '사수자리', Capricorn: '염소자리', Aquarius: '물병자리', Pisces: '물고기자리',
};

export default function AstrologyRoute() {
  const { t } = useTranslation();
  return (
    <SpecialContentScreen
      kind="astrology"
      themeColor={colors.ju}
      title={t('astrology.title', '별자리·점성술')}
      sub={t('astrology.sub', '내 별자리(태양별자리)와 점성술(네이탈 차트)을 한 번에 — 두 관점으로 깊이 풀이')}
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
      // 무료 티어(하이브리드) — 빅3(태양·달·상승궁)는 온디바이스로 먼저 무료, 깊은 해석은 유료 LLM
      freePreview={(ch) => {
        const [dp, tp] = (ch.input.birthDateTime ?? '').split(' ');
        const [y, mo, d] = dp.split('-').map(Number);
        const [h, mi] = (tp ?? '0:0').split(':').map(Number);
        const nat = buildNatal({ year: y, month: mo, day: d, hour: h || 0, minute: mi || 0, latitude: ch.input.birthLat ?? 37.5665, longitude: ch.input.birthLon ?? 126.978 });
        const ko = (s: string) => SIGN_KO[s] ?? s;
        return <FreeBasics title={t('special.freeBasics', '먼저 무료로 — 나의 빅3')} rows={[['태양', ko(nat.big3.sun)], ['달', ko(nat.big3.moon)], ['상승궁', ko(nat.big3.rising)]]} />;
      }}
      // 한 콘텐츠에 두 파트 분리(daniel): ①별자리(태양별자리·접근성) ②점성술(네이탈·심층). 둘 다 유료 LLM 통변.
      sections={[
        { key: 'signSummary', label: t('astrology.signSummary', '⭐ 별자리 — 내 태양별자리') },
        { key: 'signTraits', label: t('astrology.signTraits', '별자리 · 성격·기질') },
        { key: 'signLove', label: t('astrology.signLove', '별자리 · 연애 스타일') },
        { key: 'signStrength', label: t('astrology.signStrength', '별자리 · 강점·매력') },
        { key: 'big3', label: t('astrology.big3', '🔭 점성술 — 태양·달·상승궁') },
        { key: 'natalLove', label: t('astrology.natalLove', '점성술 · 사랑·욕구') },
        { key: 'natalWork', label: t('astrology.natalWork', '점성술 · 일·성취') },
        { key: 'strength', label: t('astrology.strength', '점성술 · 타고난 강점') },
        { key: 'challenge', label: t('astrology.challenge', '점성술 · 과제') },
        { key: 'advice', label: t('astrology.advice', '한마디') },
      ]}
    />
  );
}
