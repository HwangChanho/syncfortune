// app/src/lib/theme.ts — 디자인 토큰 (한지·먹·주 전통 모던 테마)
// ─────────────────────────────────────────────────────────────────────────
// 목적: 전 화면 비주얼을 단일 토큰으로 통일(색·라운드·간격·그림자·타이포).
//   인라인 하드코딩(#e65100 등) 제거 → 일관성·유지보수·테마 교체 용이(단일 출처).
// 무드: 한지(따뜻한 베이지) 바탕 + 먹(짙은 회흑) 텍스트/선 + 주색(朱, 전통 인주 빨강) 포인트.
//   ★ 주색 = 프리미엄·CTA·강조에만 한정 사용(남발 금지 — 절제가 곧 고급감).
// ─────────────────────────────────────────────────────────────────────────

// ── 색상 팔레트 ───────────────────────────────────────────────
// 미드나잇 테마(남색 밤하늘 + 골드) — 주신 이미지 무드에 맞춤(ADR-049).
//   토큰명은 유지(ju=강조)하고 값만 교체 → 전 화면 일괄 전환. ju=골드(주색 대체).
export const colors = {
  // 배경 계열 (남색 밤하늘)
  bg: '#15132E',        // 화면 바탕 — 딥 인디고
  card: '#221F44',      // 카드 표면 — 밝은 인디고(떠 보이게)
  sunk: '#1A1838',      // 눌림·비활성·세그먼트 바탕
  // 텍스트·선 (밝은 — 남색 배경 가독)
  ink: '#EDE7D6',       // 주 텍스트 — 크림(골드빛)
  inkSoft: '#ADA4C8',   // 보조 텍스트 — 옅은 보라회색
  inkFaint: '#6E6692',  // placeholder·캡션 — 흐린 보라
  line: '#332E58',      // 일반 테두리·구분선 — 남색 경계
  // 골드 계열 (포인트·프리미엄 — 주색 대체, 토큰명 ju 유지)
  ju: '#C9A14A',        // 골드 — 프리미엄·CTA·강조
  juDeep: '#A8843A',    // 눌린 골드(press 피드백)
  juSoft: '#2B2652',    // 프리미엄 카드 배경(보랏빛 남색)
  juLine: '#6B5A33',    // 골드 테두리(어둡게)
  // 보조
  gold: '#C9A14A',      // 길신·귀인 등 보조 포인트(=골드)
  white: '#FFFFFF',
} as const;

// ── 라운드(모서리) ───────────────────────────────────────────
export const radius = { sm: 10, md: 16, lg: 22, pill: 999 } as const;

// ── 간격(4pt 그리드) ─────────────────────────────────────────
//   space(2)=8, space(4)=16 … 일관 간격 유지용 헬퍼.
export const space = (n: number) => n * 4;

// ── 그림자(은은 — 한지 위 카드 부양감) ───────────────────────
export const shadow = {
  card: {
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2, // Android
  },
  soft: {
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
} as const;

// ── 타이포 (무게·자간으로 무드 표현) ─────────────────────────
//   ※ 한글 명조(serif)는 커스텀 폰트 파일 필요 — 추후 expo-font 로드 시
//      이 토큰에 fontFamily만 추가하면 전 화면 반영(현재는 시스템 폰트+굵기/자간).
export const font = {
  display: { fontSize: 30, fontWeight: '800' as const, color: colors.ink, letterSpacing: 0.3 },
  title: { fontSize: 22, fontWeight: '700' as const, color: colors.ink, letterSpacing: 0.2 },
  heading: { fontSize: 17, fontWeight: '700' as const, color: colors.ink },
  body: { fontSize: 15, fontWeight: '400' as const, color: colors.ink },
  label: { fontSize: 13, fontWeight: '600' as const, color: colors.inkSoft },
  caption: { fontSize: 12, fontWeight: '400' as const, color: colors.inkFaint },
} as const;
