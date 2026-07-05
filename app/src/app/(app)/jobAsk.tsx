// src/app/(app)/jobAsk.tsx — '취업·이직, 언제 잘 풀릴까?' 무료 퍼널(온디바이스 취업 타이밍 → 유료 취업 풀이)
// ─────────────────────────────────────────────────────────────────────────
// FreeFunnel 셸에 취업 콘텐츠만 주입: 무료로 '취업·합격운이 열리는 시기'(JobTiming·결정론·API 0)를 보여주고
//   깊은 취업 풀이(유료 /job)로 유도. i18n 미등록이어도 렌더되게 t(key, 한글 fallback) 사용.
// ─────────────────────────────────────────────────────────────────────────
import { useTranslation } from 'react-i18next';
import { FreeFunnel } from '../../components/FreeFunnel';
import { JobTiming } from '../../components/JobTiming';

export default function JobAskScreen() {
  const { t } = useTranslation();
  return (
    <FreeFunnel
      heroImage={require('../../../assets/icons/job.jpg')}
      question={t('jobAsk.q', '취업·이직, 언제 잘 풀릴까?')}
      sub={t('jobAsk.sub', '취업·이직·합격의 문이 열리기 좋은 시기를 무료로 미리 짚어 드려요')}
      paidRoute="/job"
      paidCta={t('jobAsk.cta', '깊은 취업 풀이 보기')}
      render={(saju) => <JobTiming saju={saju} />}
    />
  );
}
