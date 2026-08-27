// app/src/lib/content/coinLedgerLabel.ts — 운 사용 내역 한 줄을 **그 나라 말로** 적는다
// ═══════════════════════════════════════════════════════════════════════════
// Boss 2026-08-25 *"운사용내역은 디테일하게 해당국가 언어로 노츌 돼야해"*.
//
// ■ 종전에 무엇이 나갔나
//   화면이 `coin_ledger.reason` 을 **서버 원문 그대로** 찍었다 — 값은 `spend`·`purchase`
//   같은 **코드**라서, 한국 사용자에겐 영어 코드가, 영어·일본어 사용자에겐 번역 안 된 값이 떴다.
//   그리고 «무엇에 썼는지» 가 없었다 — `spend` 만 봐서는 궁합인지 대화인지 알 수 없다.
//
// ■ 어떻게 고쳤나
//   `reason`(무슨 일이) × `kind`(무엇에) 를 **둘 다** 읽어 한 줄로 만든다.
//   ★콘텐츠 이름은 **`contentSections` 에서 가져온다** — 목록에 이미 있는 이름이다.
//     여기서 «궁합»을 또 적으면 목록 이름을 바꿔도 내역만 옛 이름으로 남는다.
//
// ■ 실측한 값 (2026-08-25 · `coin_ledger` 56행)
//   reason: spend · purchase · migrate · admin_gift · admin_grant · refund
//   kind  : 콘텐츠 키(compat·ziwei·love·crush·reading·newyear·roots·image·talk·timeline·jobfit)
//           \+ 상품 키(coin_100·coin_300·coin_600·adfree_30)
//   ⚠️모르는 값이 와도 화면이 비지 않게 **원문을 그대로** 보여 준다(빈 줄보다 낫다).
// ═══════════════════════════════════════════════════════════════════════════
import type { TFunction } from 'i18next';
import { SECTIONS } from './contentSections';

/** 상품 키 → 무엇을 샀나. 숫자는 키에서 뽑는다(표에 값을 두 번 적지 않게). */
function productLabel(kind: string, t: TFunction): string | null {
  const coin = /^coin_(\d+)$/.exec(kind);
  if (coin) return t('coinHistory.coinPack', '{{n}} 운').replace('{{n}}', Number(coin[1]).toLocaleString());
  const ad = /^adfree_(\d+)$/.exec(kind);
  if (ad) return t('coinHistory.adFree', '광고 제거 {{d}}일').replace('{{d}}', ad[1]);
  if (kind === 'adfree_forever') return t('coinHistory.adFreeForever', '광고 제거 (평생)');
  return null;
}

/** 콘텐츠 키 → 목록에 적힌 이름. 없으면 null. */
function contentLabel(kind: string, t: TFunction): string | null {
  for (const sec of SECTIONS) {
    const it = sec.items.find((x) => x.key === kind);
    if (it) return t(it.labelKey);
  }
  // 목록에 없는 것 둘 — 대화·풀이는 콘텐츠 카드가 아니라 화면이라 목록에 없다
  // ★목록에 없는 것들 — 화면이거나(대화·풀이·도우미) 운영용이라 콘텐츠 카드가 없다.
  //   ⚠️`check:coinhistory` H3 가 DB 를 훑어 **이 표에 없는 kind 를 문다** — 새 유료 화면을
  //     만들면 여기 한 줄을 더해야 내역에 «무엇에 썼는지» 가 뜬다.
  if (kind === 'talk') return t('coinHistory.kindTalk', '상담가 대화');
  if (kind === 'reading') return t('coinHistory.kindReading', '사주 풀이');
  if (kind === 'coach') return t('coinHistory.kindCoach', '팔자 도우미');
  if (kind === 'future10') return t('coinHistory.kindFuture10', '10년 흐름');
  if (kind === 'qa_topup') return t('coinHistory.kindQaTopup', '테스트 지급');
  return null;
}

/**
 * 내역 한 줄의 설명.
 *
 * @param reason `spend`·`purchase`·`refund`·`admin_gift`·`migrate` 등
 * @param kind   무엇에 썼나(콘텐츠 키·상품 키). 없을 수 있다
 * @param delta  증감(+면 늘어난 것) — reason 을 모를 때 방향으로 쓴다
 * @param t      i18next
 * @returns 사용자가 읽을 한 줄
 */
export function coinLedgerLabel(reason: string | null, kind: string | null, delta: number, t: TFunction): string {
  const k = String(kind ?? '').trim();
  const what = k ? (productLabel(k, t) ?? contentLabel(k, t)) : null;

  switch (String(reason ?? '').trim()) {
    case 'purchase':
      return what
        ? t('coinHistory.rPurchaseWhat', '{{what}} 충전').replace('{{what}}', what)
        : t('coinHistory.rPurchase', '운 충전');
    case 'spend':
      return what
        ? t('coinHistory.rSpendWhat', '{{what}}에 사용').replace('{{what}}', what)
        : t('coinHistory.rSpend', '운 사용');
    case 'refund':
      return what
        ? t('coinHistory.rRefundWhat', '{{what}} 환불').replace('{{what}}', what)
        : t('coinHistory.rRefund', '환불');
    case 'admin_gift':
    // ★`admin_grant` 도 같은 뜻이다 — 운영자가 넣어 준 운(2026-08-27에 실제로 쓰였다).
    //   ⚠️사유 이름이 둘로 갈린 채 **라벨이 하나만** 있으면 내역에 「운 사용/충전」으로 뭉개진다
    //     (`check:coinhistory` H2 가 그걸 잡았다). 뜻이 같으니 **한 줄로 모은다.**
    case 'admin_grant': return t('coinHistory.rGift', '선물 받은 운');
    case 'migrate':    return t('coinHistory.rMigrate', '이전 잔액 이관');
    default:
      // ⚠️모르는 reason — 방향만이라도 맞게 말하고, 무엇에 썼는지는 알면 붙인다
      if (what) return what;
      return delta >= 0 ? t('coinHistory.charge', '운 충전') : t('coinHistory.use', '운 사용');
  }
}
