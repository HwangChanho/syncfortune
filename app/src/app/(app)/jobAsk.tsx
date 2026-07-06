// src/app/(app)/jobAsk.tsx — '취업·이직, 언제 잘 풀릴까?' 무료 퍼널(온디바이스 취업 리치 → 유료 취업 풀이)
// ─────────────────────────────────────────────────────────────────────────
// FreeFunnel 셸에 취업 콘텐츠만 주입: 무료로 '취업 리치'(JobRich·결정론·API 0)를 보여주고
//   깊은 취업 풀이(유료 /job)로 유도. i18n 미등록이어도 렌더되게 t(key, 한글 fallback) 사용.
//   ★JobRich = 재회(ReunionRich)와 같은 결의 리치 본문(가능성 게이지 + 취업 운 신호 + JobTiming 달력 + 개운 티저 + 퍼널).
//     기존엔 JobTiming(달력)만 얇게 노출했으나, 무료를 결정론+비주얼로 풍부하게 해 유료 전환을 자연스럽게 유도(daniel 모델).
// ─────────────────────────────────────────────────────────────────────────
import { useTranslation } from 'react-i18next';
import { FreeFunnel } from '../../components/FreeFunnel';
import { JobRich } from '../../components/JobRich';   // 취업 무료 리치 본문(JobTiming 달력을 내부에 품음)
import { useLogContentVisit } from '../../lib/backend/contentVisit'; // 콘텐츠 방문 집계(daniel 2026-07-06) — 진입 1회 기록

export default function JobAskScreen() {
  useLogContentVisit('jobAsk'); // 진입 1회 방문 기록(daniel 2026-07-06)
  const { t } = useTranslation();
  return (
    <FreeFunnel
      heroImage={require('../../../assets/icons/job.jpg')}
      question={t('jobAsk.q', '취업·이직, 언제 잘 풀릴까?')}
      sub={t('jobAsk.sub', '취업·이직·합격의 문이 열리기 좋은 시기를 무료로 미리 짚어 드려요')}
      paidRoute="/job"
      paidCta={t('jobAsk.cta', '깊은 취업 풀이 보기')}
      render={(saju) => <JobRich saju={saju} />}
    />
  );
}
