// src/app/(app)/jobfit.tsx — 콘텐츠 '나에게 어울리는 직업'(직업 적성 딥리포트, 본인 명식 단일, 사주만, 유료/쿠폰)
// ─────────────────────────────────────────────────────────────────────────
// ⚠️ 기존 job(취업·이직 timing)·career(사업가vs직장인 적성비교)와 별개 = 직업 *적성*(what suits me).
// ★EEL(Encoded Expert Layer): L1 결정론 엔진(careerReport.ts)이 3축(선호·능력·종합)·기능조합·오행 희기·용신·갭 라우팅·
//   대운 커리어 흐름·속성벡터를 *확정 코드*로 산출 → CAREERFIT_SYSTEM(L2)이 그 코드를 쉬운말로 *서술만*(판정 금지).
//   같은 차트 = 항상 같은 결론(유료 신뢰). 스펙: 신규컨텐츠기획문서/SyncFortune_Career_Report_Spec.md.
// §4 안전: 부정 증폭 금지·전향적(갭도 잇는 법으로)·기신 방향은 '피할 방향'으로 건설적·의료/투자 단정 금지 — CAREERFIT_SYSTEM(LLM).
// ─────────────────────────────────────────────────────────────────────────
import { useTranslation } from 'react-i18next';
import { SpecialContentScreen } from '../../components/SpecialContentScreen';
import { colors } from '../../lib/theme';

export default function JobfitRoute() {
  const { t } = useTranslation();
  return (
    // 유료 단일 풀이 → 생성일+1년 '보유 만료일' 표시(daniel #25). 개별 구매(프리미엄 미포함). 재통변 1년 후 가능.
    <SpecialContentScreen
      kind="jobfit"
      showExpiry
      themeColor={colors.ju}
      heroImage={require('../../../assets/icons/jobfit.jpg')}
      title={t('jobfit.title', '나에게 어울리는 직업')}
      sub={t('jobfit.sub', '타고난 적성으로 어떤 직업이 어울리는지, 끌림과 능력의 간극까지 짚어 드려요')}
      genMsg={t('jobfit.generating', '타고난 적성과 어울리는 직업을 읽는 중…')}
      // key = CAREERFIT_SYSTEM JSON 필드명과 1:1(headline은 SpecialContentScreen이 상단 요약으로 자동 렌더).
      sections={[
        { key: 'preference', label: t('jobfit.preference', '끌리는 것 (능력 아님)') },
        { key: 'ability', label: t('jobfit.ability', '실제 잘하는 것') },
        { key: 'workMode', label: t('jobfit.workMode', '일하는 결·모드') },
        { key: 'gap', label: t('jobfit.gap', '끌림과 능력의 간극') },      // 스펙 최고가치 섹션
        { key: 'yongsinFit', label: t('jobfit.yongsinFit', '알맞은 방향') },
        { key: 'workEnv', label: t('jobfit.workEnv', '잘 맞는 일터') },
        { key: 'recognition', label: t('jobfit.recognition', '인정받는 법·무대') },
        { key: 'jobs', label: t('jobfit.jobs', '어울리는 일') },
        { key: 'luckMap', label: t('jobfit.luckMap', '직업 인생 흐름') },
        { key: 'archetype', label: t('jobfit.archetype', '나의 직업 유형') },
      ]}
    />
  );
}
