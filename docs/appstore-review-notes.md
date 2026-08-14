# App Review Notes — 개정안 (2026-08-15)

> 2026-08-14 리젝(4.3(b) Spam · 5.1.1 Data Collection) 대응.
> **아래 「제출용 원문」을 ASC → 앱 심사 정보 → 메모에 그대로 붙여 넣으면 됩니다.**

---

## 무엇을 바꿨나 (붙여넣기 전에 읽어 주세요)

**① 노트와 앱이 달랐던 것을 바로잡았습니다.**
기존 노트에 *"purchase WITHOUT signing in (Guideline 5.1.1)"* 이라 적혀 있었지만, 07-27에 구매 게이트를
등록 유저만 통과하도록 좁히면서 **실제로는 막혀 있었습니다.** 심사자가 노트대로 시도했다면 그 자리에서
막혔을 것이고, 5.1.1 재리젝은 그 결과로 보입니다. 코드를 고쳤고(익명 세션으로 구매 가능), 이제 노트와
앱이 일치합니다.

**② 4.3(b)에는 "우리가 더 낫다"로 반박하지 않았습니다.**
그 논리는 통하지 않습니다(App Review Board도 포화 판단 자체는 잘 뒤집지 않습니다).
대신 **심사 빌드에 없던 기능**을 지목했습니다 — 관계 지도(Relationship Map)는 심사받은 빌드
29763243에 **존재하지 않습니다.** 이건 의견이 아니라 사실이고, 재심사에서 확인 가능한 지점입니다.

**③ Boss가 채워야 할 것**: 데모 계정(아래 `[ ]` 자리). 지금 ASC에 데모 계정이 비어 있습니다.
심사자가 명식 등록에서 막히면 "기능을 못 봤다"는 우리 주장이 무의미해집니다.

---

## 제출용 원문 (여기부터 복사)

```
Wooni — App Review Notes (updated Aug 2026)

DEMO ACCOUNT
Email: [ ]   Password: [ ]
(Sign-in is optional — see §3. Provided only so you can check cross-device sync quickly.)

1. WHAT THIS COMPUTES — NOT A HOROSCOPE FEED
This is a calculation engine, not a daily-horoscope reader. From an exact birth moment it
derives an individual chart using a perpetual-calendar implementation that accounts for
true solar time by birth longitude (24 domestic + 25 overseas cities), the equation of time
(seasonal, ±16 min), historical standard-meridian changes (Korea used 127.5E in 1954-1961),
and historical daylight-saving periods.

Two births 8 minutes apart in different cities produce different charts, and the app shows
that difference. There are no twelve zodiac buckets and no shared text anywhere — two users
never receive the same analysis. On top of the chart, 40+ codified classical rules are
applied; rules still under expert review are not shipped as assertions.

2. WHAT IS NEW SINCE THE REVIEWED BUILD (29763243)
The build you reviewed did not contain the feature that most distinguishes this app.

RELATIONSHIP MAP (new): everyone the user registers is placed on one map relative to the
user's own chart. Each person is classified into one of five structural roles derived from
the interaction between the two charts, adjusted by the elemental distribution of that
person's full chart — not by birth year or sign. The map reports what the user's network is
missing, and each relationship carries a caution and a concrete suggestion.
→ Home > "Relationship Map" card, or Readings tab > Love section.

INVITE FLOW (new): the user sends a link; the friend enters birth data on a web page (no app
install, no account) and appears on the map. The friend's data is deleted from the server as
soon as the user's device receives it; invites expire in 7 days.

We are not arguing this makes the app better than others. We are noting it was absent from
the build under review, and we are not aware of another App Store app that computes a
relationship network this way.

3. GUIDELINE 5.1.1 — FIXED IN THIS BUILD
You noted registration was still required before purchasing non-account-based IAP. That was
correct, and it contradicted our own earlier note — we opened this path in July and then
narrowed it again by mistake. Now:
· An anonymous session is created on launch. Coin packs are purchasable with NO sign-in.
· Purchases attach to that anonymous user id; entitlements work immediately.
· AFTER a purchase we show an optional notice that signing in lets the content open on
  another device. It is dismissible, and sign-in stays available in Settings at any time.
· Signing in later links the same user id, so nothing is lost.
To verify: fresh install, do not sign in, open Coins and purchase.

4. HOW TO EVALUATE QUICKLY (no account, no purchase)
1) Home > register a birth profile (date + time + city). Try the same time in two cities —
   the hour pillar can change.
2) Home > Relationship Map — add a second profile to see roles and chemistry.
3) Readings tab — most items are computed on-device and free.
4) Perpetual Calendar tab — raw chart, luck cycles, detected interactions.

5. SAFETY
No medical, diagnostic, or disease-prediction language (health content never names organs or
conditions). No investment or legal advice. Birth data is encrypted at rest — the server
cannot read chart contents. No gambling.

Thank you for the time already spent on this app. If anything is unclear, reply here and we
will point you at the exact screen.
```

---

## 함께 준비할 것

| | 항목 | 상태 |
|---|---|---|
| ☐ | **데모 계정** 생성 후 위 `[ ]` 채우기 | Boss만 가능 |
| ☐ | 심사 제출 빌드를 **관계 지도가 든 최신 빌드**로 교체 | 필수 — 노트 §2가 사실이 되려면 |
| ☐ | 스크린샷 1~2번째를 관계 지도로 | 심사자는 스크린샷부터 봅니다 |
| ☐ | `global_test_mode` OFF 확인 | 켜져 있으면 심사자에게 목업이 나갑니다 |

⚠️**노트 §2·§3은 새 빌드가 올라가야 사실이 됩니다.** 지금 심사에 붙은 빌드(29763243)에는
관계 지도도, 5.1.1 수정도 없습니다. 빌드 교체 없이 이 노트만 바꾸면 **두 번째로 노트와 앱이
어긋나는 것**이고, 그건 이번 리젝의 원인이었습니다.
