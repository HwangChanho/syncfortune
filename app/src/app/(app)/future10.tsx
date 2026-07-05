// src/app/(app)/future10.tsx — 콘텐츠 '10년 뒤 나의 모습'(대운·세운으로 보는 10년 뒤, 신규 유료·스페셜)
// ─────────────────────────────────────────────────────────────────────────
// daniel 2026-07-02: 지금의 명식에 대운·세운을 겹쳐 10년 뒤의 나(커리어·재물·관계·건강·성장)와 지금부터의 준비를 그려 줌.
//   Edge kind='future10'(사주 차트만 사용 — buildBody 불필요). 개별 유료(lifegraph·career와 동일 스페셜).
//   SpecialContentScreen 일반화: kind·제목·섹션만 주입(로드·게이트·캐시·히어로 공통).
// ─────────────────────────────────────────────────────────────────────────
import { useTranslation } from 'react-i18next';
import { SpecialContentScreen } from '../../components/SpecialContentScreen';
import { Future10Teaser } from '../../components/Future10Teaser'; // ★무료 온디바이스 티저(히어로 아래·항상 노출) — 10년 뒤 큰 흐름·부합도 → 유료 전환 후크
import { colors } from '../../lib/theme';

export default function Future10Route() {
  const { t } = useTranslation();
  return (
    <SpecialContentScreen
      kind="future10"
      themeColor={colors.ju}
      title={t('future10.title', '10년 뒤 나의 모습')}
      sub={t('future10.sub', '대운·세운으로 보는 10년 뒤의 나와 지금부터의 준비')}
      genMsg={t('future10.gen', '10년 뒤를 그리는 중…')}
      showExpiry
      // ★무료 온디바이스 훅(재회 ReunionTiming / 애정 LoveFlowGraph 와 동일 배치) — 10년 뒤 큰 흐름·용신 부합
      //   게이지를 히어로 아래·항상 노출(잠김/열림 무관). 깊은 통변(그때 구체 변화·준비)은 이 아래 유료.
      freeHook={(saju) => <Future10Teaser saju={saju} />}
      sections={[
        { key: 'bigPicture', label: t('future10.bigPicture', '10년 뒤 큰 그림') },
        { key: 'career', label: t('future10.career', '커리어·성취') },
        { key: 'wealth', label: t('future10.wealth', '재물·자산 흐름') },
        { key: 'relation', label: t('future10.relation', '관계·가정') },
        { key: 'health', label: t('future10.health', '건강 관리축') },
        { key: 'growth', label: t('future10.growth', '성장·내면 변화') },
        { key: 'prepare', label: t('future10.prepare', '지금부터 준비할 것') },
      ]}
    />
  );
}
