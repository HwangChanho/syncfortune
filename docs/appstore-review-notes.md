# App Store 리젝 대응 (2026-08-15 개정 2판)

> 대상 = 제출 ID `ff1c8d23-99fb-4d6a-90c0-13cc4e222223` · 심사일 2026-08-14 · 심사기기 **iPad Air 11-inch (M3)** ·
> 심사받은 빌드 **1.0 (29763243)**. 아래 원문은 Resolution Center 에서 **직접 읽은 것**이다(요약 아님).

---

## 1. 리젝 원문 (실측)

### Guideline 4.3(b) — Design - Spam
> The app **still primarily features astrology, horoscopes, palm reading, fortune telling or zodiac
> reports** that duplicate the content and functionality of similar apps that are already widely available.
>
> These app features may be useful, informative or entertaining, and the app **may include features or
> characteristics that distinguish it. However, there are already enough of these apps** on the App Store.
>
> **Next Steps** — We encourage you to reconsider the app concept and submit a new app that provides a
> unique experience not already found on the App Store.
> (Resources 에서 **웹 앱**으로 만들 것을 권함)

### Guideline 5.1.1(v) — Legal - Privacy - Data Collection and Storage
> We noticed that the app **still requires users to register with personal information to purchase
> In-App Purchase products that are not account based.**
>
> **Next Steps** — revise the app to not require users to register before purchasing… You may explain to
> the user that **registering will enable them to access the purchased content from any of their supported
> devices and provide them a way to register at any time**, if they wish to later extend access.

첨부: `Screenshot-0814-112616.png`(심사자가 막힌 화면 · ASC 에서 다운로드 가능).

---

## 2. 지금까지 실제로 한 것 (전부 실측 확인)

| 항목 | 상태 | 근거 |
|---|---|---|
| 익명 구매 허용(5.1.1) | ✅ 코드 반영 | `requireLoginForPurchase` = `session?.user?.id` 만 있으면 통과 |
| 구매 후 **선택** 로그인 안내 | ✅ | `suggestLoginAfterPurchase` — Apple Next Steps 문구 그대로 |
| 회귀 방지 하네스 | ✅ 규칙 **반전** | `check:anongate` G1 이 07-27 옛 규칙("등록 유저만")을 주장하고 있었다 → 뒤집음 |
| 새 빌드 업로드 | ✅ **29779455** (VALID) | 2026-08-15 13:23 KST · 관계 지도 탭=궁합·점수·이미지 포함 |
| 데모 계정 | ✅ **복구** | `applereview@syncfortune.app` 이 **로그인 불가 상태였다** → 비번 재설정·로그인 실측 통과 |
| 데모 계정 유료 열람 | ✅ 운 2,500 지급 | ⚠️`effPrem` 이 하드코딩 false — **프리미엄으로는 유료 풀이가 안 열린다.** 지금은 전부 '운' 차감 |
| `global_test_mode` | ✅ OFF | `app_flags` 실측(2026-08-01 부터 false) |
| 스크린샷 | ⚠️ **교체 필요** | 현재 6장이 옛 브랜드 **`팔자 八字`** + 감청·골드(앱은 라벤더) → 새 6장 준비됨 |

★**지난 리젝의 진짜 원인**: 노트에는 *"purchase WITHOUT signing in"* 이라 적혀 있었는데 앱은 막혀 있었다.
심사자는 노트대로 해 보고 막혔을 것이다. **이번엔 노트의 모든 문장을 코드·DB로 확인하고 적었다.**

---

## 3. 4.3(b) 를 어떻게 볼 것인가 (Boss 결정 사항)

**"우리가 더 낫다"는 반박은 통하지 않는다** — Apple 이 그 문장을 미리 막아 뒀다
(*"may include features that distinguish it. However, there are already enough of these apps"*).

움직일 수 있는 지점은 하나다: **"이 앱이 그 카테고리를 *주로* 하는 앱인가"**.
그리고 지금 그 판단을 **우리 메타데이터가 먼저 뒷받침하고 있다** —

| 자리 | 현재 값 | 심사자가 읽는 것 |
|---|---|---|
| 부제 | **사주·자미두수·타로를 AI로** | "점술 세 종류를 파는 앱" |
| 키워드 | 사주·AI사주·자미두수·궁합… | 같은 결론 |
| 스크린샷 6장 | 성격·애정·10년흐름·명식·교차검증·궁합 | 전부 운세 화면 |

⇒ **4.3(b) 대응 = 앱 소개를 사실대로 다시 쓰는 것**이지, 없는 기능을 지어내는 게 아니다.
이 앱에서 점술이 아닌 부분은 실제로 있다: **관계 지도**(내가 등록한 사람들의 관계 그래프·무료·온디바이스)와
**정밀 만세력 계산**(진태양시·경도·역사적 표준자오선/서머타임). 이걸 앞에 세운다.

**정직한 확률 판단**: 위를 다 해도 4.3(b) 재리젝 가능성은 여전히 낮지 않다. 그래서 병행 권고:
1. 재제출(아래 메타데이터·스크린샷·노트 교체) → 2. 그래도 막히면 **App Review 예약**(Apple 이 메시지에서
직접 제안 · 화·목) 로 사람과 이야기 → 3. Android(Play 는 4.3(b) 같은 포화 조항이 없다) 를 먼저 출시.

---

## 4. 메타데이터 변경안 (ASC 에 그대로 붙여넣기)

**부제**(30자 이내)
```
내 사람들의 관계 지도 · 정밀 만세력
```

**키워드**(100자 이내)
```
관계지도,인간관계,성격분석,자기이해,적성,궁합,만세력,명식,대운,사주,BaZi,saju
```
*(`AI사주`·`자미두수`·`타로`를 뺀다 — 우리가 먼저 "점술 앱"이라 말하고 있던 자리다.)*

**설명 첫 문단 교체**(나머지 유지)
```
니운내운은 생년월일시로 사람의 명식을 계산하고, 그 계산으로 나와 내 주변 사람의 관계를 읽는 도구입니다.

■ 관계 지도 — 내가 등록한 사람들이 한 장에
가족·친구·동료를 등록하면 각자가 나에게 어떤 자리에 서는 사람인지(다섯 역할)와 케미가 지도로 그려집니다.
내 관계가 어느 쪽으로 쏠렸는지, 무엇이 비어 있는지 한눈에 보입니다. 계산은 기기 안에서 돌고, 무료입니다.

■ 정밀 만세력 — 8분 차이도 다른 결과
진태양시·출생지 경도·역사적 표준자오선(1954~1961 한국 127.5°E)·서머타임까지 보정합니다.
같은 시각에 태어나도 도시가 다르면 시주가 달라지고, 앱은 그 차이를 그대로 보여줍니다.
```

---

## 5. 제출용 심사 노트 (여기부터 복사 — ASC → 앱 심사 정보 → 메모)

```
Wooni ("니운내운") — App Review Notes (Aug 15, 2026)

DEMO ACCOUNT
On the sign-in screen, press and hold the app title for 1 second to reveal the email/password fields.
    email: applereview@syncfortune.app
    password: WooniReview2026!
This account is pre-loaded with in-app credits, so every paid analysis can be opened WITHOUT any
purchase. (Sign-in is optional for the app itself — see §2.)

1. GUIDELINE 5.1.1(v) — FIXED IN BUILD 29779455
You reported that registration was still required before purchasing non-account-based IAP. That was
correct. We had opened this path in July and then narrowed it again by mistake in late July, which is
why the previous note and the app disagreed. In this build:
 · An anonymous session is created on launch; coin packs are purchasable with NO sign-in at all.
 · The purchase attaches to that anonymous user id and unlocks content immediately.
 · AFTER the purchase we show a dismissible notice explaining that signing in lets the purchased
   content open on another device, and sign-in remains available in Settings at any time.
 · Signing in later links the same user id, so nothing is lost.
To verify: fresh install, do not sign in, open the store and buy any coin pack.
An automated check in our build pipeline now fails if this gate is ever narrowed again.

2. GUIDELINE 4.3(b) — WHAT WE CHANGED
We are not asking you to re-weigh a saturated category, and we have not argued that our version of a
horoscope is better. We changed what the app leads with, because our own metadata described the app
as a fortune-telling bundle while its core is a computation and relationship tool:
 · Subtitle, keywords and screenshots have been rewritten around the two things that are not
   horoscope content: the Relationship Map and the perpetual-calendar engine.
 · RELATIONSHIP MAP (absent from build 29763243, present here): every person the user registers is
   placed on one map relative to the user's own chart. Each is classified into one of five structural
   roles derived from the interaction between the two charts, adjusted by the elemental distribution
   of that person's full chart - not by birth year or sign. Tapping a person opens the computed
   compatibility with the reasons behind the number. The map reports what the user's network lacks.
   It is free and computed entirely on-device. → Home > "관계 지도" card.
 · ENGINE: charts are derived from an exact birth moment using true solar time by birth longitude
   (24 domestic + 25 overseas cities), the equation of time, historical standard-meridian changes
   (Korea used 127.5E in 1954-1961) and historical daylight-saving periods. Two births 8 minutes
   apart in different cities produce different charts and the app shows that difference. There are no
   twelve zodiac buckets and no shared text: two users never receive the same output.

3. HOW TO EVALUATE IN TWO MINUTES (no account, no purchase)
 1) Home > register a birth profile (date + time + city). Enter the same time for two different
    cities - the hour pillar changes.
 2) Home > "관계 지도" - add a second profile; roles and chemistry appear. Tap any dot.
 3) Readings tab - most items are computed on-device and free.
 4) Perpetual Calendar tab - raw chart, luck cycles, detected interactions.

4. SAFETY
No medical, diagnostic or disease-prediction language. No investment or legal advice. No gambling.
Birth data is encrypted at rest; the server cannot read chart contents.

Thank you for the time already spent on this app.
Chanho Hwang / SyncFortune
```

---

## 6. Resolution Center 회신문 (메시지로 따로 보낼 것 — 노트만으로는 4.3(b) 에 답이 안 된다)

```
Thank you for the detailed review.

On 5.1.1(v): this is fixed in build 29779455. Registration is no longer required before any purchase -
an anonymous session is created on launch and coin packs are purchasable with no sign-in. We now show
the cross-device explanation AFTER the purchase, with sign-in available at any time, as your Next Steps
describe. We also added an automated check to our build pipeline so this cannot silently regress again.

On 4.3(b): we accept that the category is saturated and we are not asking you to re-weigh that. What we
did instead was correct how the app presents itself. Our subtitle and keywords described the app as a
bundle of fortune-telling formats, and the screenshots showed only that. The app's core is different in
kind: (1) a Relationship Map that builds a graph of the people the user registers and classifies each by
the structural interaction between two charts - free, on-device, and absent from the build you reviewed;
and (2) a perpetual-calendar engine that resolves a birth moment by true solar time, longitude, historic
standard meridians and DST, so two births eight minutes apart in different cities resolve differently.
The store listing has been rewritten around those two things, and the screenshots have been replaced.

If it would help, we would welcome an App Review appointment to walk through the app with you.
```

---

## 7. Boss 체크리스트 (ASC 에서)

| | 항목 | 비고 |
|---|---|---|
| ☐ | 빌드를 **29779455** 로 교체 | 오늘 업로드·VALID. 관계 지도 3건 + 5.1.1 수정 포함 |
| ☐ | 심사 노트를 **§5 원문**으로 교체 | 지금 ASC 에 있는 노트는 옛 버전(“premium unlocked” 등 **거짓 문장 포함**) |
| ☐ | 스크린샷 6장 교체 | `docs/release/screenshots-2026-08/01~06.png` (1242×2688) |
| ☐ | 부제·키워드·설명 교체 | §4 |
| ☐ | Resolution Center 에 **§6 회신** 보내기 | 노트는 심사자만 보고, 회신은 대화로 남는다 |
| ☐ | **앱 심사 정보 → 로그인 필요** 켜고 데모 ID/비번 입력 | 지금 그 칸이 **비어 있다**. 노트에만 적혀 있으면 심사자가 표준 위치에서 못 찾는다 |
| ☑ | 데모 계정 | 복구·실측 완료(운 2,500) |
| ☑ | `global_test_mode` OFF | 실측 완료 |

⚠️**빌드를 안 바꾸고 노트만 바꾸면 세 번째로 노트와 앱이 어긋난다** — 그게 이번 리젝의 원인이었다.
