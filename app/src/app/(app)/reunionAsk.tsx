// src/app/(app)/reunionAsk.tsx — '재회, 다시 이어질까?' 무료 퍼널(온디바이스 재회 리치 콘텐츠 → 유료 재회 풀이)
// ─────────────────────────────────────────────────────────────────────────
// FreeFunnel 셸에 재회 콘텐츠만 주입: 무료로 '재회 인연 게이지·배우자궁 개폐·방향/계절·연락이 열리는 달·개운
//   티저'(ReunionRich·결정론·API 0)를 시각적으로 보여주고 → 깊은 재회 풀이(유료 /reunion)로 자연 유도.
//   i18n 미등록이어도 렌더되게 t(key, 한글 fallback) 사용.
// ─────────────────────────────────────────────────────────────────────────
import { useTranslation } from 'react-i18next';
import { FreeFunnel } from '../../components/FreeFunnel';
import { ReunionRich } from '../../components/ReunionRich';
import { useLogContentVisit } from '../../lib/backend/contentVisit'; // 콘텐츠 방문 집계(daniel 2026-07-06) — 진입 1회 기록

export default function ReunionAskScreen() {
  useLogContentVisit('reunionAsk'); // 진입 1회 방문 기록(daniel 2026-07-06)
  const { t } = useTranslation();
  return (
    <FreeFunnel
      heroImage={require('../../../assets/icons/reunion.jpg')}
      question={t('reunionAsk.q', '재회, 다시 이어질까?')}
      sub={t('reunionAsk.sub', '옛 인연과 다시 이어질 가능성·시기·방향을 무료로 짚어 드려요')}
      paidRoute="/reunion"
      paidCta={t('reunionAsk.cta', '깊은 재회 풀이 보기')}
      render={(saju) => <ReunionRich saju={saju} />}
    />
  );
}
