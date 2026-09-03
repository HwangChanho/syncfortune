// scripts/biz-info.mjs — 사업자 정보를 **앱 단일 출처에서 읽어 주는 어댑터**
// ═══════════════════════════════════════════════════════════════════════════
// 값은 여기 없다. `app/src/lib/bizInfo.ts` 한 곳에만 있고, 이 파일은 그것을 **글자로 읽는다.**
//   ⚠️import 하지 않는 이유: 소비처(`inject-og.mjs`·`check-bizinfo.mjs`)는 **순수 node** 이고
//     저쪽은 TS 다. `inject-og.mjs` 가 이미 `coinPrices.ts` 를 같은 방식으로 읽고 있다(같은 관용구).
//   ⚠️정규식이 못 읽으면 **조용히 빈 값으로 나가지 않는다** — 즉시 죽는다.
//     빈 사업자 정보가 배포되는 것이 «빌드 실패» 보다 훨씬 나쁘다.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
/** 단일 출처 파일 경로 — ⚠️앱에서 이 파일을 옮기면 여기와 `check:bizinfo` 도 같이 옮긴다. */
export const BIZ_SOURCE = 'app/src/lib/bizInfo.ts';
const src = readFileSync(path.join(ROOT, BIZ_SOURCE), 'utf8');

/**
 * `키: '값',` 한 줄을 뽑는다.
 * @param key 뽑을 필드 이름
 * @param allowEmpty 빈 문자열을 허용할지(통신판매업 번호처럼 «아직 없음» 이 정상인 것)
 * @returns 값 문자열
 */
const field = (key, allowEmpty = false) => {
  const m = src.match(new RegExp(`\\b${key}\\s*:\\s*'([^']*)'`));
  if (!m || (!allowEmpty && !m[1])) {
    console.error(`❌ ${BIZ_SOURCE} 에서 «${key}» 를 못 읽었다 — 사업자 정보가 빈 채로 나가면 심사에서 걸린다`);
    process.exit(1);
  }
  return m[1];
};

/** 사업자등록증 기준 표시 정보. ⚠️값을 고칠 곳은 여기가 아니라 `app/src/lib/bizInfo.ts` 다. */
export const BIZ = {
  name: field('name'),
  owner: field('owner'),
  regNo: field('regNo'),
  mailOrderNo: field('mailOrderNo', true),   // ⏳비어 있는 것이 «정상» 인 유일한 칸
  addr: field('addr'),
  tel: field('tel'),
  email: field('email'),
  hosting: field('hosting'),
};

/** 「신고 준비 중」류 문구도 같은 파일에서 읽는다 — 문서와 **글자가 같아야** 대조가 된다. */
export const MAIL_ORDER_PENDING = {
  ko: field('ko'),
  en: field('en'),
  ja: field('ja'),
};

/**
 * 통신판매업 신고번호 표기 — 값이 없으면 «있는 척» 하지 않는다.
 * @param lang 'ko'|'en'|'ja' (기본 ko)
 * @returns 문서·화면에 적을 문자열
 */
export const mailOrderLabel = (lang = 'ko') => BIZ.mailOrderNo || MAIL_ORDER_PENDING[lang] || MAIL_ORDER_PENDING.ko;

// ═══════════════════════════════════════════════════════════════════════════
// ★충전 팩 가격 — **채널을 넘겨서** 읽는다 (2026-09-04 실측 결함)
// ═══════════════════════════════════════════════════════════════════════════
// ⚠️웹 초기 HTML 의 「판매 상품 및 가격」이 **스토어 정가**(100운 9,900원)를 싣고 있었는데,
//   같은 사이트의 「운 충전」 화면은 **웹가**(100운 ₩7,200)를 청구한다 — 실측으로 갈렸다.
//   원인: 가격을 `COIN_PACKS.won` 에서만 뽑고 `PRICE_DIVERGENCE`(웹가)를 안 봤다.
//   ⇒ 고지된 가격 ≠ 청구 가격. PG 심사·표시광고 양쪽에 걸리는 종류다.
//   ★앱 `packPriceWon(id, 'web')` 과 **같은 규칙**을 여기서 재현한다(값의 출처는 그 파일 하나).
const PRICE_SOURCE = 'app/src/lib/billing/coinPrices.ts';

/**
 * 웹에서 실제로 청구하는 팩 목록.
 * @returns `[{ id, coins, won }]` — `won` 은 **웹 채널 가격**(차등이 있으면 그 값, 없으면 정가)
 * ⚠️못 읽으면 죽는다 — 가격이 빈 채로 나가는 것보다 빌드가 서는 편이 낫다.
 */
export const webPacks = () => {
  const src = readFileSync(path.join(ROOT, PRICE_SOURCE), 'utf8');
  const packs = [...src.matchAll(/\{\s*id:\s*'(coin_\d+)',\s*coins:\s*(\d+),\s*won:\s*(\d+)/g)]
    .map((m) => ({ id: m[1], coins: Number(m[2]), won: Number(m[3]) }));
  if (!packs.length) {
    console.error(`❌ ${PRICE_SOURCE} 에서 팩을 못 읽었다 — 상품 정보가 빈 채로 나가면 PG 심사에서 걸린다`);
    process.exit(1);
  }
  // 채널 차등표(`PRICE_DIVERGENCE`) — 웹가가 적힌 팩만 갈아 끼운다
  const web = new Map(
    [...src.matchAll(/(coin_\d+)\s*:\s*\{\s*web:\s*(\d+)/g)].map((m) => [m[1], Number(m[2])]),
  );
  return packs.map((p) => ({ ...p, won: web.get(p.id) ?? p.won }));
};
