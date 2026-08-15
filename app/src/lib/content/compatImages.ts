// app/src/lib/content/compatImages.ts — 궁합 이미지 표(등급·관계 카테고리)
// ─────────────────────────────────────────────────────────────────────────
// 왜 파일로 뺐나: 관계 지도의 **궁합 미리보기**(2026-08-15)가 같은 등급 이미지를 쓴다.
//   화면마다 표를 복사하면 등급을 하나 추가했을 때 한쪽만 고쳐지고, 그건 주석으로 못 막는다
//   ([[duplicate-ui-single-source]] — "주석의 '같다'는 보장이 아니다").
//
// ⚠️이 표는 `compatScore.ts` 에 두지 않는다 — 거기는 `scripts/check-compat.ts` 가 tsx 로 직접
//   불러 쓰는 모듈이라, RN 런타임(remoteAsset→supabase)을 물면 그 하네스가 죽는다.
// ─────────────────────────────────────────────────────────────────────────
import { A, type RemoteSource } from '../ui/remoteAsset';

/** 등급 이미지 — key = `COMPAT_TIERS[].key`. */
export const COMPAT_TIER_IMG: Record<string, RemoteSource> = {
  soulmate: A('icons/compat/soulmate.jpg'),
  great: A('icons/compat/great.jpg'),
  good: A('icons/compat/good.jpg'),
  steady: A('icons/compat/steady.jpg'),
  spark: A('icons/compat/spark.jpg'),
  opposite: A('icons/compat/opposite.jpg'),
};

/** 관계 카테고리 배너(daniel: 각 카테고리에 맞는 이미지) — key = 궁합 관계 키. */
export const COMPAT_REL_IMG: Record<string, RemoteSource> = {
  friend: A('icons/compat-rel/friend.jpg'),
  family: A('icons/compat-rel/family.jpg'),
  love: A('icons/compat-rel/love.jpg'),
  marriage: A('icons/compat-rel/marriage.jpg'),
  coworker: A('icons/compat-rel/coworker.jpg'),
  senior: A('icons/compat-rel/senior.jpg'),
  staff: A('icons/compat-rel/staff.jpg'),
  business: A('icons/compat-rel/business.jpg'),
};
