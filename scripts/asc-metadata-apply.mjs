// scripts/asc-metadata-apply.mjs — App Store 문구(부제·키워드·프로모·설명)를 **실제로 바꾼다**
// ═══════════════════════════════════════════════════════════════════════════
// ⚠️이 스크립트는 **쓰기(PATCH)** 다. `asc-review.mjs`(읽기 전용)와 성격이 다르다.
//   Boss 지시(2026-08-15 *"부제 키워드 설명도 니가 다 바꿔놔"*)로 만들었다.
//
// 왜 바꾸나 — 4.3(b) 리젝의 절반은 **우리 문구가 자초했다**:
//   부제가 *"사주·자미두수·타로를 AI로"* 였다. 심사자가 읽는 첫 줄이 "점술 세 종류를 파는 앱"인데
//   *"primarily features astrology… fortune telling"* 이라는 판정을 뒤집을 방법이 없다.
//   ⇒ 없는 기능을 지어내는 게 아니라, **점술이 아닌 실제 부분**(관계 지도 · 만세력 계산 엔진)을 앞에 세운다.
//   ★설명 첫 문장이 `운이는…` 이라 **앱 이름(니운내운)과도 달랐다** — 그것도 같이 맞춘다.
//
// 안전장치
//   · 바꾸기 전 **현재 값을 백업 출력**한다(되돌릴 수 있게).
//   · 길이 제한(부제 30 · 키워드 100 · 프로모 170 · 설명 4000)을 **보내기 전에** 검사한다.
//   · PATCH 후 **다시 GET 해서 실제 저장값을 찍는다**(응답 200 을 믿지 않는다 · CLAUDE.md §5.5).
//
// 실행: node scripts/asc-metadata-apply.mjs            (미리보기 — 아무것도 안 바꾼다)
//       node scripts/asc-metadata-apply.mjs --apply    (실제 반영)
// ═══════════════════════════════════════════════════════════════════════════
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';

const KEY_ID = 'L7GWWF9WVF';
const ISSUER = process.env.ASC_ISSUER_ID || '5f89581a-d0c6-46c2-9461-78d5c08448fa';
const P8 = `${os.homedir()}/.appstoreconnect/private_keys/AuthKey_${KEY_ID}.p8`;
const APP_ID = '6779321930';
const APPLY = process.argv.includes('--apply');

// ── 바꿀 값 ──────────────────────────────────────────────────────────────────
/** 부제(30자) — 첫 줄에서 '점술 묶음'이 아니라 '관계 + 계산'이 보이게. */
const SUBTITLE = '내 사람들의 관계 지도 · 정밀 만세력';

/** 키워드(100자) — `AI사주`·`자미두수`·`타로`를 뺀다(우리가 먼저 "점술 앱"이라 말하던 자리). */
const KEYWORDS = '관계지도,인간관계,성격분석,자기이해,적성,궁합,만세력,명식,대운,사주,오행,일주,BaZi,saju';

/** 프로모션 텍스트(170자) — 심사·스토어 상단 노출. 무료로 볼 수 있는 것부터 말한다. */
const PROMO = '등록한 사람들이 한 장의 지도가 됩니다. 각자가 나에게 어떤 자리에 서는지, 무엇이 비어 있는지 — 생년월일시로 계산한 명식으로 읽습니다. 지도와 케미는 무료·기기 안에서 계산합니다.';

/** 설명(4000자) — 관계 지도 → 계산 엔진 → 그 위에 얹는 것들 순서. */
const DESCRIPTION = `니운내운은 생년월일시로 사람의 명식(命式)을 계산하고, 그 계산으로 나와 내 주변 사람을 읽는 도구입니다.

■ 관계 지도 — 내가 등록한 사람들이 한 장에
가족·친구·동료를 등록하면 각자가 나에게 어떤 자리에 서는 사람인지(다섯 역할)와 케미가 지도로 그려집니다.
· 가까울수록 잘 맞는 사람 — 거리와 점수로 한눈에
· 점을 누르면 그 사람과 나의 궁합, 그리고 '왜 그 점수인지'까지
· 내 관계가 어느 쪽으로 쏠려 있는지, 무엇이 비어 있는지
지도·역할·케미는 전부 무료이고, 기기 안에서 계산합니다.

■ 정밀 만세력 — 8분 차이도 다른 결과
· 진태양시·출생지 경도 보정(국내 24 · 해외 25개 도시)
· 균시차(계절에 따라 ±16분), 역사적 표준자오선(1954~1961년 한국 127.5°E), 서머타임 구간
같은 시각에 태어나도 도시가 다르면 시주가 달라집니다. 앱은 그 차이를 숨기지 않고 그대로 보여줍니다.

■ 계산 위에 얹는 것들
· 나는 어떤 사람인가 — 성격·기질·강점
· 왜 내 관계는 반복되는가 — 애정 패턴과 인연의 결
· 어떤 일이 나에게 맞는가 — 적성·직업 성향
· 지금 어느 구간을 지나는가 — 대운·세운의 흐름
보조 관점으로 자미두수와 타로도 함께 볼 수 있습니다.

■ 누구에게나 같은 글이 아닙니다
열두 별자리 같은 분류함이 없습니다. 같은 문장을 두 사람이 받는 일이 없고,
모든 결과는 그 사람의 명식에서 계산돼 나옵니다.

※ 결과는 자기 이해를 돕는 참고용입니다. 의료·투자·법률 판단을 대신하지 않습니다.`;

// ── 길이 검사 — 보내기 전에 막는다(Apple 이 400 을 주기 전에 우리가 안다) ────
const LIMITS = [['부제', SUBTITLE, 30], ['키워드', KEYWORDS, 100], ['프로모', PROMO, 170], ['설명', DESCRIPTION, 4000]];
let over = 0;
for (const [name, v, max] of LIMITS) {
  const n = [...v].length;                       // 이모지·한글 안전하게 코드포인트로 센다
  console.log(`  ${name.padEnd(4)} ${String(n).padStart(4)}/${max} ${n > max ? '❌ 초과' : '✅'}`);
  if (n > max) over++;
}
if (over) { console.error('\n❌ 길이 초과 — 보내지 않았다'); process.exit(1); }

// ── ASC ─────────────────────────────────────────────────────────────────────
if (!fs.existsSync(P8)) { console.error(`❌ ASC 키 없음: ${P8}`); process.exit(1); }
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const t0 = Math.floor(Date.now() / 1000);
const head = `${b64({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' })}.${b64({ iss: ISSUER, iat: t0, exp: t0 + 1200, aud: 'appstoreconnect-v1' })}`;
const JWT = `${head}.${crypto.createSign('SHA256').update(head).sign({ key: fs.readFileSync(P8, 'utf8'), dsaEncoding: 'ieee-p1363' }).toString('base64url')}`;

async function api(method, path, body) {
  const r = await fetch(`https://api.appstoreconnect.apple.com${path}`, {
    method,
    headers: { Authorization: `Bearer ${JWT}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  const text = await r.text();
  if (!r.ok) { console.error(`❌ ${method} ${path} → ${r.status}\n${text.slice(0, 400)}`); process.exit(1); }
  return text ? JSON.parse(text) : {};
}

// 대상 찾기 — id 를 코드에 박지 않는다(버전이 바뀌면 그대로 틀린 곳을 고치게 된다)
const ver = (await api('GET', `/v1/apps/${APP_ID}/appStoreVersions?limit=1`)).data[0];
const vLoc = (await api('GET', `/v1/appStoreVersions/${ver.id}/appStoreVersionLocalizations`)).data.find((l) => l.attributes.locale === 'ko');
const info = (await api('GET', `/v1/apps/${APP_ID}/appInfos`)).data[0];
const iLoc = (await api('GET', `/v1/appInfos/${info.id}/appInfoLocalizations`)).data.find((l) => l.attributes.locale === 'ko');
console.log(`\n대상: 버전 ${ver.attributes.versionString} (${ver.attributes.appStoreState}) · locale ko`);

// ── 되돌릴 수 있게 현재 값을 남긴다 ──────────────────────────────────────────
const backup = {
  savedAt: new Date().toISOString(),
  subtitle: iLoc.attributes.subtitle,
  keywords: vLoc.attributes.keywords,
  promotionalText: vLoc.attributes.promotionalText,
  description: vLoc.attributes.description,
};
const bpath = `docs/release/asc-metadata-backup.json`;
fs.writeFileSync(bpath, JSON.stringify(backup, null, 2));
console.log(`백업: ${bpath}`);
console.log(`  이전 부제  : ${backup.subtitle}`);
console.log(`  이전 키워드: ${backup.keywords}`);

if (!APPLY) { console.log('\n(미리보기 — 아무것도 바꾸지 않았다. 반영하려면 --apply)'); process.exit(0); }

// ── 반영 ────────────────────────────────────────────────────────────────────
await api('PATCH', `/v1/appStoreVersionLocalizations/${vLoc.id}`, {
  data: { type: 'appStoreVersionLocalizations', id: vLoc.id,
    attributes: { keywords: KEYWORDS, promotionalText: PROMO, description: DESCRIPTION } },
});
await api('PATCH', `/v1/appInfoLocalizations/${iLoc.id}`, {
  data: { type: 'appInfoLocalizations', id: iLoc.id, attributes: { subtitle: SUBTITLE } },
});

// ── 검증 — 응답 200 이 아니라 **다시 읽은 값**으로 판정한다 ──────────────────
const v2 = (await api('GET', `/v1/appStoreVersionLocalizations/${vLoc.id}`)).data.attributes;
const i2 = (await api('GET', `/v1/appInfoLocalizations/${iLoc.id}`)).data.attributes;
const same = (a, b) => (a || '').trim() === (b || '').trim();
console.log('\n── 반영 후 실측 ──');
console.log(`  부제  : ${i2.subtitle}                 ${same(i2.subtitle, SUBTITLE) ? '✅' : '❌ 불일치'}`);
console.log(`  키워드: ${v2.keywords}                 ${same(v2.keywords, KEYWORDS) ? '✅' : '❌ 불일치'}`);
console.log(`  프로모: ${(v2.promotionalText || '').slice(0, 40)}…   ${same(v2.promotionalText, PROMO) ? '✅' : '❌ 불일치'}`);
console.log(`  설명  : ${[...(v2.description || '')].length}자 · 첫 줄 "${(v2.description || '').split('\n')[0].slice(0, 30)}…"  ${same(v2.description, DESCRIPTION) ? '✅' : '❌ 불일치'}`);
