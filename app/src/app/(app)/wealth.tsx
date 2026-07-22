// src/app/(app)/wealth.tsx — 콘텐츠 '재물 딥리포트'(재물 그릇·유형·시기·처방, 본인 명식 단일, 사주만, 유료/쿠폰)
// ─────────────────────────────────────────────────────────────────────────
// ⚠️ 기존 재물 영역 풀이(금전소득운/투자편재운/재물손재/사업운 = saju 카테고리)와 별개 = 재물 *전체 딥리포트*.
// ★EEL(Encoded Expert Layer): L1 결정론 엔진(wealthReport.ts·R44 재물시기·R54 재성)이 4축(그릇/유형/시기/처방)·
//   기능조합·오행 희기·용신·감당(신강약)을 *확정 코드*로 산출 → WEALTH_SYSTEM(L2)이 그 코드를 쉬운말로 *서술만*(판정 금지).
//   같은 차트 = 항상 같은 결론(유료 신뢰). jobfit(careerReport) 딥리포트와 동형 구조.
// §4 안전: 부자/가난 단정·부정 증폭 금지·투자조언 금지 · ★감당 CONDITIONAL(재관강=신약)이면 '관리·지킴' 프레임 — WEALTH_SYSTEM(LLM).
// ─────────────────────────────────────────────────────────────────────────
import { useTranslation } from 'react-i18next';
import { SpecialContentScreen } from '../../components/SpecialContentScreen';
import { WealthTeaser } from '../../components/WealthTeaser'; // 무료 온디바이스 재물 밑그림 티저(유료 전환 후크·API 0)
import { colors } from '../../lib/theme';

export default function WealthRoute() {
  const { t } = useTranslation();
  return (
    // 유료 단일 풀이 → 생성일+1년 '보유 만료일' 표시(daniel #25). 개별 구매(프리미엄 미포함). 재통변 1년 후 가능.
    <SpecialContentScreen
      kind="wealth"
      showExpiry
      themeColor={colors.ju}
      heroImage={require('../../../assets/icons/wealth.jpg')}
      title={t('wealth.title', '재물 딥리포트')}
      sub={t('wealth.sub', '타고난 재물 그릇과 유형, 언제 크게 들어오고 어떻게 지키는지까지 짚어 드려요')}
      genMsg={t('wealth.generating', '타고난 재물 그릇과 흐름을 읽는 중…')}
      // ★무료 온디바이스 티저(freeHook) — 히어로 아래·잠김/열림 무관 항상 노출. 재물 결 방향(wealthGauge 결정론) 미리보기 → 유료 전환.
      freeHook={(saju) => <WealthTeaser saju={saju} />}
      // key = WEALTH_SYSTEM JSON 필드명과 1:1(headline은 SpecialContentScreen이 상단 요약으로 자동 렌더).
      sections={[
        { key: 'vessel', label: t('wealth.vessel', '재물 그릇') },        // ① 얼마나 담고 감당하는 그릇
        { key: 'type', label: t('wealth.type', '재물 유형') },            // ② 모으는 결 vs 굴리는 결
        { key: 'howEarn', label: t('wealth.howEarn', '돈이 들어오는 결') }, // 만드는 힘 vs 운용하는 힘
        { key: 'timing', label: t('wealth.timing', '재물 시기') },        // ③ 언제 크게 유입되는지
        { key: 'flow', label: t('wealth.flow', '재물 인생 흐름') },       // 초·중·말 흐름
        { key: 'remedy', label: t('wealth.remedy', '재물 지킴·개운') },   // ④ 새지 않게 지키는 법
      ]}
    />
  );
}
