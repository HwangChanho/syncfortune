// app/src/lib/content/personaImages.ts — 성격유형 120종 × 남녀 = 240 카드 이미지 URL(Supabase Storage).
// ─────────────────────────────────────────────────────────────────────────
// Boss 결정(2026-07-20): 번들(require) 대신 **서버 fetch** — 이미지 교체 시 재빌드·심사 없이
//   스토리지 파일만 갈아끼우면 된다. 업로드 = scratchpad/upload_persona_storage.py → 공개 버킷 'persona'.
//   렌더는 components/PersonaImage 가 expo-image 로 URL 로드(자동 디스크캐시) + 실패/미상 시 오행색 폴백.
// ⚠️ base URL 하드코딩은 share.ts 의 SHARE_LINK_BASE 와 같은 패턴(프로젝트 ref 는 공개값·비밀 아님).
// ⚠️ 파일명 로마자 규칙은 upload_persona_storage.py / generate_persona_assets.py 와 **반드시 동일**해야 한다.
// ─────────────────────────────────────────────────────────────────────────

// 공개 스토리지 base — <일간로마자>-<월지로마자>-<f|m>.jpg 가 이어붙는다.
const STORAGE_BASE = 'https://zpslflbcxzalaikbbdzk.supabase.co/storage/v1/object/public/persona/';

// 천간·지지 → 로마자(파일명 규칙). 辛(sin)·申(sin)은 <일간>-<월지> 위치로 구분되어 충돌 없음.
const GAN_ROMA: Record<string, string> = { 甲: 'gap', 乙: 'eul', 丙: 'byeong', 丁: 'jeong', 戊: 'mu', 己: 'gi', 庚: 'gyeong', 辛: 'sin', 壬: 'im', 癸: 'gye' };
const JI_ROMA: Record<string, string> = { 子: 'ja', 丑: 'chuk', 寅: 'in', 卯: 'myo', 辰: 'jin', 巳: 'sa', 午: 'o', 未: 'mi', 申: 'sin', 酉: 'yu', 戌: 'sul', 亥: 'hae' };

/**
 * 일간·월지·성별 → 성격유형 카드 이미지 URL.
 * @returns URL 문자열, 또는 성별 미상·미지원 글자면 null(→ 오행색 간지 네모 폴백).
 */
export function personaImageUrl(dayStem: string, monthBranch: string, sex: '남' | '여' | undefined): string | null {
  if (!sex) return null; // 성별 미등록(구버전 차트 등) = 폴백
  const g = GAN_ROMA[dayStem];
  const j = JI_ROMA[monthBranch];
  if (!g || !j) return null; // 알 수 없는 글자 = 폴백
  return `${STORAGE_BASE}${g}-${j}-${sex === '여' ? 'f' : 'm'}.jpg`;
}
