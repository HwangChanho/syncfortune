// app/src/lib/bizInfo.ts — **사업자 정보 단일 출처**
// ═══════════════════════════════════════════════════════════════════════════
// ■ 왜 앱 쪽에 두나
//   소비처가 셋인데 **가장 까다로운 소비처가 앱**이다(번들러를 타야 한다).
//   나머지 둘은 순수 node 라 이 파일을 **글자로 읽으면** 된다 —
//   `scripts/inject-og.mjs` 가 이미 `coinPrices.ts` 를 그렇게 읽고 있다(같은 관용구).
//     ① 앱 설정 화면      — `import { BIZ } from '../../lib/bizInfo'`
//     ② 웹 초기 HTML      — `scripts/inject-og.mjs` (정규식 파싱)
//     ③ 약관 사이트 문서  — `docs/legal/refund-*.md` (글자로 적고 하네스가 대조)
//   드리프트는 `npm run check:bizinfo` 가 잡는다.
//
// ■ ⚠️왜 이게 필요했나 (2026-09-04 실측)
//   값이 `inject-og.mjs` 안에만 있었고, 사람이 실제로 여는 `refund-ko.md` 는
//   **전부 「(기재 예정)」** 이었다(라이브 200 OK · 7회 노출).
//   「HTML 에 심었다」 ≠ 「사람이 볼 수 있다」 — 웹 정적 고지는 1×1 px 봇 전용이다.
//
// ⚠️값이 바뀌면 **여기만** 고치고 `npm run check:bizinfo` 를 돌린다(문서까지 같이 고치라고 알려 준다).
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 사업자등록증(213-12-37858) 기준 표시 정보 — 전자상거래법 제10조 필수 표시사항.
 *
 * ★전화번호 공개는 Boss 2026-09-04 승인 — 유선전화가 없어 휴대폰을 공개한다
 *   (법이 「전화번호」를 필수로 요구한다).
 * ⚠️`name` 은 **등록 상호**다. 서비스명(「니운내운」)·저장소명(syncfortune)과 다르다 —
 *   대외 표시는 반드시 등록 상호로 한다(PG 심사에서 상호 불일치는 흔한 반려 사유).
 */
export const BIZ = {
  name: '싱크코',
  owner: '황찬호',
  regNo: '213-12-37858',
  /**
   * 통신판매업 신고번호.
   * ⏳**아직 없다** — 저장소 전수 검색 결과 어디에도 값이 없다(2026-09-04 실측).
   *   빈 문자열이면 소비처는 아래 `MAIL_ORDER_PENDING` 문구로 **정직하게** 적는다
   *   (없는 번호를 지어내지 않는다 — [[no-fabrication-honesty]]).
   * ⚠️일반결제(PG) 입점 심사는 통상 통신판매업 신고증을 요구한다 = Boss 확인 항목.
   */
  mailOrderNo: '',
  addr: '(02255) 서울특별시 중랑구 답십리로 403-6, 101호',
  tel: '010-4593-2047',
  email: 'cksgh0316@gmail.com',
  hosting: 'Cloudflare, Inc. · Supabase, Inc.',
} as const;

/** 통신판매업 번호가 아직 없을 때 각 언어로 적을 말. ⚠️문서·앱·웹이 **같은 글자**를 써야 대조가 된다. */
export const MAIL_ORDER_PENDING = {
  ko: '신고 준비 중',
  en: 'Filing in progress',
  ja: '申告手続き中',
} as const;

/**
 * 통신판매업 신고번호 표기 — 값이 없으면 «있는 척» 하지 않는다.
 * @param lang 표기 언어(기본 ko)
 * @returns 화면·문서에 그대로 적을 문자열
 */
export const mailOrderLabel = (lang: keyof typeof MAIL_ORDER_PENDING = 'ko'): string =>
  BIZ.mailOrderNo || MAIL_ORDER_PENDING[lang] || MAIL_ORDER_PENDING.ko;
