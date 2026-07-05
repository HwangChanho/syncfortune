// src/app/(app)/reunionAsk.tsx — '재회, 다시 이어질까?' 무료 퍼널(온디바이스 재회 타이밍 → 유료 재회 풀이)
// ─────────────────────────────────────────────────────────────────────────
// FreeFunnel 셸에 재회 콘텐츠만 주입: 무료로 '연락이 닿기 좋은 달'(ReunionTiming·결정론·API 0)을 보여주고
//   깊은 재회 풀이(유료 /reunion)로 유도. i18n 미등록이어도 렌더되게 t(key, 한글 fallback) 사용.
// ─────────────────────────────────────────────────────────────────────────
import { useTranslation } from 'react-i18next';
import { FreeFunnel } from '../../components/FreeFunnel';
import { ReunionTiming } from '../../components/ReunionTiming';

export default function ReunionAskScreen() {
  const { t } = useTranslation();
  return (
    <FreeFunnel
      heroImage={require('../../../assets/icons/reunion.jpg')}
      question={t('reunionAsk.q', '재회, 다시 이어질까?')}
      sub={t('reunionAsk.sub', '옛 인연과 다시 이어질 가능성과 연락이 닿기 좋은 달을 무료로 짚어 드려요')}
      paidRoute="/reunion"
      paidCta={t('reunionAsk.cta', '깊은 재회 풀이 보기')}
      render={(saju) => <ReunionTiming saju={saju} />}
    />
  );
}
