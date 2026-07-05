// src/app/(app)/crushAsk.tsx — '그 사람과 이어질까?' 무료 퍼널(온디바이스 짝사랑 리치 → 유료 짝사랑 풀이)
// ─────────────────────────────────────────────────────────────────────────
// FreeFunnel 셸에 짝사랑 콘텐츠만 주입: 무료로 짝사랑 리치 본문(CrushRich·결정론·API 0 — 성사 게이지 +
//   끌림 신호 + 매력·인연이 도는 달 + 개운 티저)을 보여주고 깊은 짝사랑 풀이(유료 /crush)로 유도.
//   ★재회 퍼널(reunionAsk→ReunionRich)과 동일 틀(규칙6·유지보수). i18n 미등록이어도 렌더되게 t(key, 한글 fallback) 사용.
// ─────────────────────────────────────────────────────────────────────────
import { useTranslation } from 'react-i18next';
import { FreeFunnel } from '../../components/FreeFunnel';
import { CrushRich } from '../../components/CrushRich';   // 짝사랑 무료 리치 본문(CrushTiming 달력을 내부에 품음)

export default function CrushAskScreen() {
  const { t } = useTranslation();
  return (
    <FreeFunnel
      heroImage={require('../../../assets/icons/crush.jpg')}
      question={t('crushAsk.q', '그 사람과 이어질까?')}
      sub={t('crushAsk.sub', '짝사랑·썸이 무르익어 마음이 통하기 좋은 달을 무료로 미리 짚어 드려요')}
      paidRoute="/crush"
      paidCta={t('crushAsk.cta', '깊은 짝사랑 풀이 보기')}
      render={(saju) => <CrushRich saju={saju} />}
    />
  );
}
