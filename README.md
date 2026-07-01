# 팔자 · 八字 (SyncFortune)

> **AI-powered Korean fortune-telling app** built on a deterministic _Saju_ (四柱 · 八字, Four Pillars) engine with a RAG-grounded LLM interpretation layer.
> _사주(명리)를 핵심으로 자미두수·타로를 통합하는 AI 운세 앱. 앱 이름 **팔자(八字)** — 태어난 순간의 여덟 글자._

The thesis: **the calendar math is deterministic; only interpretation is generative.** The Four Pillars chart (palja), hidden stems, clashes/combinations, twelve life-stages, and sinsal are computed by a rule engine — never hallucinated. An LLM interprets _on top of_ that structured chart, grounded by a curated knowledge layer. This "encoded expert layer" is what separates the product from a generic LLM wrapper.

---

## 아키텍처 (Architecture)

```
 ┌─────────────────────────────────────────────────────────────────────┐
 │  L4 · App (React Native / Expo)                      app/            │
 │  명식 시각화 · 대운/세운/월운/일운 타임라인 · 일진 달력 · 궁합 · 타로  │
 │  · PII 는 기기에만(SecureStore) · 다국어(ko/en/ja)                    │
 └───────────────┬─────────────────────────────────────────────────────┘
                 │  NormalizedChart (PII 제외 — 비식별 구조만 서버로)
 ┌───────────────┴─────────────────────────────────────────────────────┐
 │  L3 · Backend (Supabase)                             [proprietary]   │
 │  Auth + RLS(PII 보호) · Edge Function(interpret) + 캐싱 · 건당 결제    │
 └───────────────┬─────────────────────────────────────────────────────┘
                 │
 ┌───────────────┴─────────────────────────────────────────────────────┐
 │  L2 · Interpretation Orchestrator (RAG + Claude)    [proprietary]    │
 │  P0 룰 용신후보 → P1 물상 → P2 용신판정 → P3 통변 → P4 비판루프 → P5 통합 │
 │  · RAG grounding: 골든 엔트리 + 명리 지식 레이어                       │
 │  · 비판 루프는 '구체성·반증가능성' 가중(적중률 단독 최적화=보상해킹 방지) │
 └───────────────┬─────────────────────────────────────────────────────┘
                 │  consumes
 ┌───────────────┴─────────────────────────────────────────────────────┐
 │  L1 · Deterministic Engine (TypeScript, on-device, no API)  engine/  │
 │  만세력(팔자·대운·세운·월운·일운) · 지장간·십신·통근/투출 ·            │
 │  합충형해·천간합충극 · 12운성 · 신살·공망 · 신강약·격국 · 자미두수      │
 └─────────────────────────────────────────────────────────────────────┘
```

이 레포는 **L1(엔진)·L4(앱) 코드 + 아키텍처 문서**를 공개합니다(포트폴리오 범위).
L2 해석 레이어의 **프롬프트·명리 지식 콘텐츠**, **골든 데이터셋**, **백엔드 함수**는 비공개(IP)이며 위 구조·설계만 기술합니다.

---

## L1 결정론 엔진 (`engine/`)

순수 TypeScript. **온디바이스에서 계산**되고 API 키가 필요 없습니다. 생년월일 평문은 기기 밖으로 나가지 않습니다.

| 모듈 | 산출 |
|---|---|
| `saju.ts` | 팔자(년·월·일·시 간지), 대운(순/역행)·세운(流年)·월운(流月)·일운(流日), 지장간(본·중·여기), 십신(정/편 10종), 통근 |
| `structure.ts` | 합충형해(육합·삼합·충·형·해·파)·천간 합/충/극 검출, 신강약 score(억부), 왕쇠 분류(신왕·신강·중화·신약 + 득령·득지·득세), 격국 후보, 십신 분포(부재·과다) |
| `twelve.ts` | 12운성(장생→양; 양간 순행·음간 역행) |
| `sinsal.ts` | 신살(도화·역마·화개·천을귀인·문창·양인·괴강·백호·홍염)·공망(순중공망) |
| `ziwei.ts` | 자미두수(iztro): 성반·12궁·생년사화·운한 — **보조 레이어**(블렌딩 없이 독립 산출 후 수렴 측정) |
| `compatibility.ts` · `triangulate.ts` | 궁합(두 차트 상호작용)·삼각통합 |

엔진 라이브러리: [`lunar-javascript`](https://github.com/6tail/lunar-javascript)(만세력) · [`iztro`](https://github.com/SylarLong/iztro)(자미두수).

### 빠른 시작 — 엔진 데모 (API 키 불필요)

```bash
npm install
npm run example        # 익명 예시 입력으로 팔자·합충·12운성·신살·공망 출력
npm run verify:engine  # 엔진 자체 검증(결정론 정합)
npm run typecheck      # tsc --noEmit
```

---

## L4 앱 (`app/`)

React Native · Expo(expo-router). 무료 신뢰 훅 = **명식을 날것으로 풍부하게 시각화**.

- **명식**: 오행색 간지(木火土金水) · 천간십신·지지십신·12운성·지장간·통근 배지
- **합충형해 SVG 오버레이**: 천간 관계(팔자 위·점선)·지지 관계(아래·실선), ㄷ자 연결선 + 종류 라벨
- **대운·세운·월운·일운 인터랙티브 타임라인**: 대운 탭 → 세운 → 월운 → 일진 달력 드릴다운, 원국 옆 확장 명식
- **신강약 도넛** · **오행 분포** · **신살 표** · **궁합** · **타로**
- **다국어**(ko/en/ja) · **PII 온디바이스**(SecureStore 하드웨어 암호화)

### 앱 실행

```bash
cp app/.env.example app/.env     # Supabase 연결값 입력(선택 — 엔진/명식은 키 없이 동작)
cd app && npm install
npx expo start                   # iOS 시뮬: i / Android: a
```

엔진(`engine/`)·계약(`spec/chart.ts`)은 앱 폴더 밖에 있고 Metro `watchFolders` 로 번들됩니다(`app/metro.config.js`).

---

## 설계 원칙 (Design Principles)

1. **계산은 룰, 해석은 LLM** — 만세력은 결정론 엔진. LLM은 그 위에서 해석만.
2. **사주 · 자미두수 블렌딩 금지** — 독립 생성 후 *수렴(일치도)* 만 측정.
3. **차트는 날것 보존** — 글자·자리·지장간·합충·통근을 태그로 압축하지 않음(`spec/chart.ts`).
4. **무료 = 룰/템플릿/캐시, LLM = 유료** — 캐싱(chart × category)으로 비용 방어.
5. **비판 루프는 구체성·반증가능성 가중** — '적중률' 단독 최적화(보상해킹) 금지.
6. **안전 우선** — 의료·투자·법률 단정 금지, 부정 증폭 금지, 진단엔 처방 동반.

## 프라이버시 · 보안 (Privacy & Security)

- **생년월일(PII)은 기기에서만 평문** — 네이티브 `expo-secure-store`(하드웨어 암호화) / web `localStorage`.
- **서버 전송은 비식별 `NormalizedChart` 만** — 이름·생년월일 제외, '구조' 데이터만(`spec/chart.ts` 의 `ChartInput`↔`NormalizedChart` 타입 경계로 강제).
- **Supabase RLS** 로 사용자별 행 격리. 연결값은 레포에 박지 않고 `EXPO_PUBLIC_*`(`.env`, gitignore)로 주입.
- 이 퍼블릭 레포에는 골든 데이터셋·개인 픽스처·LLM 프롬프트·백엔드 시크릿이 **포함되지 않습니다**.

## 기술 스택 (Tech Stack)

TypeScript · React Native · Expo (expo-router, expo-secure-store, expo-localization) · Supabase (Auth · RLS · Edge Functions) · Anthropic Claude · lunar-javascript · iztro

## 공개 범위 (Repo Scope)

| 공개 | 비공개 (proprietary) |
|---|---|
| `engine/` 결정론 엔진 | 명리 지식 레이어 · 골든 데이터셋 |
| `app/` RN/Expo 앱 | L2 해석 프롬프트(P0–P5) · RAG 콘텐츠 |
| `spec/chart.ts` 타입 계약 | 백엔드 Edge 함수 · 마이그레이션 |
| 아키텍처 문서(이 README) | 전략·설계 문서 |

---

_사주 풀이는 자기이해를 돕는 참고 정보이며, 의료·법률·투자 판단을 대체하지 않습니다._
