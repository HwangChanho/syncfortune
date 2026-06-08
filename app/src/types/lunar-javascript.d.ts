// app/src/types/lunar-javascript.d.ts — 타입 전용 보강
// ─────────────────────────────────────────────────────────────────────────
// lunar-javascript 는 순수 JS 만세력 라이브러리라 @types 패키지가 없다.
// 모듈 선언만 추가해 TS7016(implicit any) 에러를 제거한다 — 런타임/번들과 무관.
// 엔진(engine/saju.ts)이 이 라이브러리로 양/음력·간지·절기를 계산한다.
// ※ 추후 자주 쓰는 API(Solar/Lunar/EightChar)는 필요 시 여기에 시그니처를 점진 보강.
// ─────────────────────────────────────────────────────────────────────────
declare module 'lunar-javascript';
