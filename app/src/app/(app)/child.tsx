// src/app/(app)/child.tsx — 콘텐츠 '자식운'(원국으로 보는 자녀 인연·기질·부모로서의 나, 프리미엄 포함)
// ─────────────────────────────────────────────────────────────────────────
// daniel 2026-07-02: 프리미엄 5번째 콘텐츠 — 프리미엄 명식이면 무료 해제, 비프리미엄은 개별 유료(₩4,900).
//   solo 전용(daniel 2026-07-04 "부부는 빼고"): 대표 명식 1인만 본다. kind·category 는 항상 'child' 고정.
//     · premiumCovered=true → 프리미엄 명식은 무료 해제(자동생성 대신 '풀이 보기').
//     · autoGen=false → 프리미엄/관리자도 '풀이 보기' 버튼으로 생성(바로 자동생성하지 않음).
//     · showExpiry → 생성(구매)일 + 1년 '보유 만료일' 표시(유료 단일 풀이, daniel #25).
//   ※ 부부(child_couple) 모드는 제거됨. child_couple 은 백엔드 호환(CreditKind·Edge kind)으로만 남고
//     이 화면은 더 이상 사용하지 않는다 — 토글/배우자 선택/반값 업그레이드 UI 전부 삭제.
//   다른 단일 콘텐츠 래퍼(roots.tsx·image.tsx)와 동일한 최소 패턴: 헤더 prop + <SpecialContentScreen> 하나.
// ─────────────────────────────────────────────────────────────────────────
import { useTranslation } from 'react-i18next';
import { SpecialContentScreen } from '../../components/SpecialContentScreen';
import { ChildTeaser } from '../../components/ChildTeaser'; // 무료 티저(§4 민감 — 판정無 안전 퍼널·API 0)
import { colors } from '../../lib/theme';

export default function ChildRoute() {
  const { t } = useTranslation();
  return (
    // 프리미엄 포함 단일 콘텐츠(자식운) — 프리미엄 명식=무료 해제 / 비프리미엄=개별 유료(kind='child').
    //   category 는 SpecialContentScreen 기본값(=kind)으로 'child' 해석 → 명식별 캐시 키.
    <SpecialContentScreen
      kind="child"            // ★자식운 solo 고정 — SpecialContentScreen 이 이 kind 로 isUnlocked·useCredit·interpret 를 분기
      premiumCovered          // 프리미엄 명식이면 무료 해제
      autoGen={false}         // 프리미엄/관리자도 자동생성 대신 '풀이 보기'로 생성(소유 상태 뷰 → 공개)
      heroImage={require('../../../assets/icons/child.jpg')}
      themeColor={colors.ju}
      title={t('child.title', '자식운')}
      sub={t('child.sub', '원국으로 보는 자녀 인연·기질·부모로서의 나')}
      genMsg={t('child.gen', '자녀 인연을 살피는 중…')}
      // 무료 티저(§4 민감 — 판정 없이 전향적 안내·자녀궁 사실만)
      freeHook={(saju) => <ChildTeaser saju={saju} />}
      showExpiry
      sections={[
        { key: 'bigPicture', label: t('child.bigPicture', '자녀 인연의 큰 그림') },
        { key: 'childNature', label: t('child.childNature', '자녀의 기질') },
        { key: 'asParent', label: t('child.asParent', '부모로서의 나') },
        { key: 'communication', label: t('child.communication', '소통·관계') },
        { key: 'timing', label: t('child.timing', '시기 흐름') },
        { key: 'talent', label: t('child.talent', '자녀의 재능') },
        { key: 'health', label: t('child.health', '건강 관리축') },
        { key: 'remedy', label: t('child.remedy', '개운·처방') },
      ]}
    />
  );
}
