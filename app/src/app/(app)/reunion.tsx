// src/app/(app)/reunion.tsx — 콘텐츠 '재회'(옛 인연과 다시 이어짐, 사주만, 유료/쿠폰)
// ─────────────────────────────────────────────────────────────────────────
// daniel 스탠스: 재회 연락 좋은 시기 = 도화(왕지 子午卯酉) 충 시점(특히 월운). 어느 '달'에 재회
//   연락 기회가 열리는지 콕 집는다. 보조=배우자궁(일지) 형충회합 개폐.
//
// ▶ funnel(무료 훅 → 유료 깊이): 히어로 아래에 무료 온디바이스 <ReunionTiming>(도화-충 '재회가
//   열리는 달' 달력)을 항상 보여주고(freeHook), 그 아래 유료 LLM 깊은 풀이(가능성·상대 마음·재회
//   후 흐름·개운법)로 전환 유도. love.tsx가 <LoveFlowGraph>를 히어로 아래 두는 배치를 공용화한 것.
//   (freeHook = SpecialContentScreen이 내부 대표 명식의 saju를 넘겨줌 → 명식 전환에도 자동 동기화.)
// ─────────────────────────────────────────────────────────────────────────
import { useTranslation } from 'react-i18next';
import { SpecialContentScreen } from '../../components/SpecialContentScreen';
import { ReunionTiming } from '../../components/ReunionTiming';
import { colors } from '../../lib/theme';

export default function ReunionRoute() {
  const { t } = useTranslation();
  return (
    // 유료 단일 풀이 → 생성일+1년 '보유 만료일' 표시(daniel #25). 개별 구매(프리미엄 미포함).
    <SpecialContentScreen
      kind="reunion"
      showExpiry
      themeColor={colors.ju}
      heroImage={require('../../../assets/icons/reunion.jpg')}
      // ★무료 온디바이스 훅 — 도화-충 '재회가 열리는 달' 달력(히어로 아래·항상 노출). 깊은 통변은 이 아래 유료.
      freeHook={(saju) => <ReunionTiming saju={saju} />}
      title={t('reunion.title', '재회운')}
      sub={t('reunion.sub', '옛 인연과 다시 이어질 가능성과, 연락이 닿기 좋은 시기를 짚어 드려요')}
      genMsg={t('reunion.generating', '다시 이어질 인연의 흐름을 읽는 중…')}
      sections={[
        { key: 'possibility', label: t('reunion.possibility', '다시 이어질 인연인지') },
        { key: 'timing', label: t('reunion.timing', '연락이 닿기 좋은 시기') },
        { key: 'theirResponse', label: t('reunion.theirResponse', '그때 상대의 마음') },
        { key: 'afterReunion', label: t('reunion.afterReunion', '다시 만난다면') },
        { key: 'caution', label: t('reunion.caution', '되돌아보면 좋은 점') },
        { key: 'remedy', label: t('reunion.remedy', '재회를 여는 법') },
      ]}
    />
  );
}
