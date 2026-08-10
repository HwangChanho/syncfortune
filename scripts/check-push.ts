// scripts/check-push.ts — 푸시 배선 상태를 **측정**한다 (추론 금지 · daniel 2026-08-11)
// ═══════════════════════════════════════════════════════════════════════════
// daniel: *"추론 하지말고 무조건 사실기반으로 결론을 도출해 하네스랑 메모리에 기록해"*
//
// ■ 이 하네스가 하는 일 = **읽어서 보고**한다. 추정하지 않는다.
//   푸시는 배선이 **두 쪽**이라 한쪽만 보면 늘 틀린 결론이 난다:
//     · 클라이언트 쪽 — 기기가 FCM 등록 토큰을 받을 수 있는가(`google-services.json` + gradle + app.json)
//     · 서버 쪽 — Expo 가 그 토큰으로 FCM 에 보낼 수 있는가(Expo 자격증명의 `androidFcm`)
//   2026-08-07 iOS 사고가 정확히 이거였다 — 엔타이틀먼트(클라)를 고쳤는데도 안 왔고,
//   실제 원인은 **Expo 에 APNs 키가 없던 것**(서버)이었다.
//
// ■ ★언제 실패시키는가 — "아직 안 함"과 "반쯤 하다 말았다"를 가른다
//   · 양쪽 다 없음  → ⏳ **통과**(미착수 · preflight 를 막지 않는다). 안내만 출력.
//   · 양쪽 다 있음  → ✅ 통과
//   · **한쪽만 있음** → ❌ **실패**. 이게 진짜 사고다 — 빌드는 되고 앱도 뜨는데 푸시만 조용히 안 간다.
//     (Boss 가 `google-services.json` 을 넣는 순간, 서버 키 누락을 이 하네스가 잡는다.)
//
// ■ 대조군 — iOS pushKey 를 같이 읽는다
//   Android 가 null 로 나올 때 "쿼리가 틀린 것"인지 "정말 없는 것"인지 가르려면
//   **있는 것이 있다고 나오는지**를 같이 봐야 한다([[build-artifact-verify-hermes]] 교훈).
//
// 실행: npm run check:push
// ═══════════════════════════════════════════════════════════════════════════
import fs from 'fs';
import os from 'os';
import path from 'path';

const EAS_PROJECT_ID = '72e189fd-50b9-45b1-b1a9-e0e89f37b3ef';   // app.json extra.eas.projectId

let bad = 0;
const say = (ok: boolean | null, msg: string) => {
  if (ok === null) { console.log(`   ⏳ ${msg}`); return; }
  if (!ok) bad++;
  console.log(`   ${ok ? '✅' : '❌'} ${msg}`);
};

console.log('\n🔔 푸시 배선 실측 (Android FCM · iOS APNs)\n');

// ── 클라이언트 쪽 — 기기가 토큰을 받을 수 있는 배선인가 ─────────────────────
const GS_PATHS = ['app/google-services.json', 'app/android/app/google-services.json'];
const gsFile = GS_PATHS.find((p) => fs.existsSync(p));

const appJson = JSON.parse(fs.readFileSync('app/app.json', 'utf8'));
const gsConfigured = !!appJson?.expo?.android?.googleServicesFile;

const gradlePaths = ['app/android/app/build.gradle', 'app/android/build.gradle'].filter((p) => fs.existsSync(p));
const gradleHasPlugin = gradlePaths.some((p) => /google-services|com\.google\.gms/.test(fs.readFileSync(p, 'utf8')));
const gradleExists = gradlePaths.length > 0;   // android/ 는 prebuild 산출물(.gitignore) — 없을 수 있다

console.log('  ■ 클라이언트(기기가 FCM 토큰을 받는 쪽)');
console.log(`     google-services.json : ${gsFile ?? '없음'}`);
console.log(`     app.json googleServicesFile : ${appJson?.expo?.android?.googleServicesFile ?? '없음'}`);
console.log(`     gradle google-services 플러그인 : ${gradleExists ? (gradleHasPlugin ? '있음' : '없음') : '(android/ 없음 — 대조 생략)'}`);

// ★정본은 `google-services.json` + `app.json` **둘뿐**이다.
//   `android/` 는 prebuild 산출물(.gitignore)이라 정본이 아니다 — 여기 섞으면
//   "정본은 다 됐는데 아직 prebuild 를 안 돌린" 상태가 **미착수로 뭉개진다**(첫 판이 실제로 그랬다).
const clientReady = !!gsFile && gsConfigured;
// prebuild 를 안 돌린 것은 **따로** 잡는다 — 산출물이 정본보다 오래된 전형적인 함정
//   ([[app-size-remote-images]] gradle generated/res stale 과 같은 계열).
const gradleStale = clientReady && gradleExists && !gradleHasPlugin;

// ── 서버 쪽 — Expo 가 FCM 으로 보낼 수 있는가 ──────────────────────────────
//   ⚠️Expo 세션이 없으면 **모른다**고 말한다. 없는데 "없다"고 단정하지 않는다.
const statePath = path.join(os.homedir(), '.expo', 'state.json');
let serverFcm: boolean | null = null;
let serverApns: boolean | null = null;

const main = async () => {
  console.log('\n  ■ 서버(Expo 가 FCM/APNs 로 보내는 쪽)');
  if (!fs.existsSync(statePath)) {
    console.log('     ⏭  ~/.expo/state.json 없음 — Expo 미로그인이라 서버 쪽은 **모름**(단정하지 않는다)');
  } else {
    const tok = JSON.parse(fs.readFileSync(statePath, 'utf8'))?.auth?.sessionSecret;
    if (!tok) {
      console.log('     ⏭  Expo 세션 토큰 없음 — 서버 쪽은 **모름**');
    } else {
      const q = {
        query: `query($id:String!){ app{ byId(appId:$id){ fullName
                  androidAppCredentials{ applicationIdentifier androidFcm{ id } }
                  iosAppCredentials{ pushKey{ keyIdentifier } } } } }`,
        variables: { id: EAS_PROJECT_ID },
      };
      try {
        const r = await fetch('https://api.expo.dev/graphql', {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'expo-session': tok }, body: JSON.stringify(q),
        });
        const j: any = await r.json();
        const app = j?.data?.app?.byId;
        if (!app) { console.log(`     ⏭  Expo 응답을 못 읽었다 — 서버 쪽은 **모름** (${JSON.stringify(j).slice(0, 120)})`); }
        else {
          serverFcm = !!app.androidAppCredentials?.[0]?.androidFcm;
          serverApns = !!app.iosAppCredentials?.[0]?.pushKey;
          console.log(`     프로젝트 : ${app.fullName}`);
          console.log(`     androidFcm : ${serverFcm ? '있음' : 'null(없음)'}`);
          console.log(`     iosPushKey : ${serverApns ? `있음(${app.iosAppCredentials[0].pushKey.keyIdentifier})` : 'null(없음)'}`);
        }
      } catch (e) {
        console.log(`     ⏭  Expo 조회 실패 — 서버 쪽은 **모름** (${(e as Error).message.slice(0, 80)})`);
      }
    }
  }

  // ── 대조군 — 방법 자체가 유효한지 ────────────────────────────────────────
  console.log('\n  ■ 판정');
  if (serverApns === true) {
    say(true, '대조군: iOS pushKey 는 **있다고** 나온다 — 이 조회 방법이 유효하다');
  } else if (serverApns === false) {
    say(false, '⚠️대조군이 무너졌다: iOS pushKey 도 없다고 나온다 — 08-07 에 올린 APNs 키가 사라졌거나 조회가 틀렸다');
  }

  // 정본은 배선됐는데 산출물(android/)이 따라오지 않은 경우 — prebuild 미실행
  if (gradleStale) {
    say(false, '★google-services.json 은 있는데 **android/ 에 google-services 플러그인이 없다** — prebuild 를 안 돌렸다. '
      + '이대로 빌드하면 앱에 FCM 이 안 들어가고, 파일은 있으니 겉보기엔 다 된 것처럼 보인다.');
  }

  // ── 두 쪽을 함께 본다 — "반쯤 하다 만 것"만 실패시킨다 ────────────────────
  if (serverFcm === null) {
    say(null, `Android: 클라이언트 배선 ${clientReady ? '완료' : '미완'} · 서버 쪽은 **모름**(Expo 미로그인) → 판정 보류`);
  } else if (!clientReady && !serverFcm) {
    say(null, 'Android FCM **미착수** — 클라이언트·서버 둘 다 비어 있다(정상적인 미완 상태 · preflight 를 막지 않는다)');
    console.log('        남은 일(측정 기준):');
    console.log('        1) Firebase Console → 프로젝트에 Android 앱(com.syncfortune.app) 추가 → google-services.json 내려받기');
    console.log('        2) 그 파일을 app/ 에 두고 app.json 의 expo.android.googleServicesFile 로 배선 → prebuild/재빌드');
    console.log('        3) Firebase 서비스계정 JSON 을 Expo 에 업로드(eas credentials -p android → FCM V1)');
  } else if (clientReady && serverFcm) {
    say(true, 'Android FCM 양쪽 배선 완료');
  } else {
    say(false, `★**반쯤 배선됐다** — 클라이언트 ${clientReady ? '있음' : '없음'} / 서버 ${serverFcm ? '있음' : '없음'}. `
      + '이 상태가 가장 위험하다: 빌드도 되고 앱도 뜨는데 **푸시만 조용히 안 간다**(08-07 iOS 사고와 같은 모양).');
  }

  console.log(bad ? '\n❌ check:push 실패\n' : '\n✅ check:push 통과\n');
  if (bad) process.exitCode = 1;
};

void main();
