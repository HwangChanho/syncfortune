// src/app/(app)/job.tsx — 콘텐츠 '취업·이직운'(본인 명식 단일, 사주만, 유료/쿠폰)
// ─────────────────────────────────────────────────────────────────────────
// ⚠️ 기존 career(사업가 vs 직장인 적성)와 별개 — 이건 취업·이직·합격·시험의 '되는 시기'(timing)에 집중.
// daniel 표준 십신 draft(★검수): 관성 = 직장·취업·승진·합격 / 인성 = 자격·문서·시험·합격 /
//   식상 = 실력·면접·실무 / 재성 = 현실 성과·연봉. 운(대운·세운·월운)에서 관성·인성이 발동 = 취업·합격·이직 응기.
// §4 안전: 부정 증폭 금지·전향적(막힌 시기도 준비 구간으로), 의료/투자/특정 합격 단정 금지 — JOB_SYSTEM(LLM).
// ─────────────────────────────────────────────────────────────────────────
import { useTranslation } from 'react-i18next';
import { SpecialContentScreen } from '../../components/SpecialContentScreen';
import { JobTiming } from '../../components/JobTiming';
import { colors } from '../../lib/theme';

export default function JobRoute() {
  const { t } = useTranslation();
  return (
    // 유료 단일 풀이 → 생성일+1년 '보유 만료일' 표시(daniel #25). 개별 구매(프리미엄 미포함).
    <SpecialContentScreen
      kind="job"
      showExpiry
      themeColor={colors.ju}
      heroImage={require('../../../assets/icons/job.jpg')}
      // ★무료 온디바이스 훅 — 관성·인성 발동 '취업·합격운이 열리는 시기'(연 단위·히어로 아래·항상 노출). 깊은 통변은 이 아래 유료.
      freeHook={(saju) => <JobTiming saju={saju} />}
      title={t('job.title', '취업·이직운')}
      sub={t('job.sub', '취업·이직·합격·시험이 잘 풀리는 흐름과 시기, 맞는 직종·준비 법을 짚어 드려요')}
      genMsg={t('job.generating', '취업·합격의 기운과 흐름을 읽는 중…')}
      sections={[
        { key: 'flow', label: t('job.flow', '취업·이직 흐름') },
        { key: 'passLuck', label: t('job.passLuck', '합격·시험운') },
        { key: 'timing', label: t('job.timing', '좋은 시기') },
        { key: 'bestField', label: t('job.bestField', '맞는 직종·환경') },
        { key: 'tips', label: t('job.tips', '준비 팁') },
      ]}
    />
  );
}
