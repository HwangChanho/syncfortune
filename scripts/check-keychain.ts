// scripts/check-keychain.ts — iOS 빌드 전, **키체인 검색목록이 멀쩡한지** 30초 안에 본다
// ═══════════════════════════════════════════════════════════════════════════
// 2026-08-13 vc93 빌드가 이것 때문에 죽었다. 같은 함정을 겪은 게 **이번이 세 번째**다.
//
// ■ 증상 (아주 헷갈리게 생겼다)
//   xcodebuild 가 10초 만에 죽으면서:
//     error: Revoke certificate: Your account already has an Apple Development signing certificate
//            for this machine, but its private key is not installed in your keychain.
//     error: No signing certificate "iOS Development" found ... with a private key was found.
//   ⇒ 문장은 "인증서가 없다"고 말하지만 **인증서는 멀쩡히 있다.**
//
// ■ 진짜 원인
//   EAS(또는 다른 도구)가 임시 키체인을 만들면서 **사용자 키체인 검색목록을 통째로 갈아치운다.**
//   그러면 `login.keychain-db` 가 목록에서 빠지고, 그 안에 있는 서명 키를 Xcode 가 못 본다.
//   실측(vc93): 검색목록에 `/private/tmp/eas-scratch.keychain-db` 와
//   `.../eas-build-<uuid>.keychain` 둘만 남아 있었고 login 이 없었다.
//   복구 직후 `find-identity` 가 **1개 → 3개**로 돌아왔다 — 사라진 게 아니라 안 보였던 것이다.
//
// ■ ★★절대 하지 말 것 — revoke
//   Xcode 가 친절하게 "revoke 하고 새로 만들까?" 를 권하는데, 그걸 누르면
//   **다른 기기·CI 의 서명까지 전부 깨진다**(2026-07-16 에 실제로 당했다).
//   고칠 곳은 인증서가 아니라 **검색목록**이다:
//     security list-keychains -d user -s ~/Library/Keychains/login.keychain-db /Library/Keychains/System.keychain
//
// ■ 판정 (이름이 아니라 **실제 상태**로)
//   ① 검색목록에 login.keychain 이 있는가
//   ② 코드사이닝 인증서가 실제로 보이는가(`find-identity` 가 1개 이상)
//   ③ 배포 인증서(Apple Distribution)가 있는가 — 개발용만 있으면 archive 가 못 넘어간다
//
// 실행: npm run check:keychain   (iOS 빌드 전에 먼저 돌린다)
// ═══════════════════════════════════════════════════════════════════════════
import { execSync } from 'node:child_process';
import { homedir } from 'node:os';

const sh = (cmd: string) => {
  try { return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }
  catch (e) { return String((e as { stdout?: string }).stdout ?? ''); }
};

let bad = 0;
const fail = (m: string) => { bad++; console.log(`   ❌ ${m}`); };
const pass = (m: string) => console.log(`   ✅ ${m}`);

console.log('\n🔑 iOS 서명 — 키체인 검색목록이 멀쩡한가\n');

// ── ① 검색목록 ────────────────────────────────────────────────────────────
const list = sh('security list-keychains -d user');
const hasLogin = /login\.keychain/.test(list);
const eas = (list.match(/eas[-\w]*\.keychain/g) ?? []).length;

if (hasLogin) pass(`검색목록에 login.keychain 있음${eas ? ` (EAS 임시 키체인 ${eas}개 공존 — 무해)` : ''}`);
else {
  fail('검색목록에서 **login.keychain 이 빠졌습니다** — 서명 키를 Xcode 가 못 봅니다');
  console.log('      현재 목록:');
  for (const l of list.trim().split('\n')) console.log(`        ${l.trim()}`);
  console.log('      ⚠️ Xcode 는 "Revoke certificate" 를 권하지만 **절대 revoke 하지 마십시오**');
  console.log('         (다른 기기·CI 서명까지 전부 깨집니다 — 2026-07-16 실제 사고).');
  console.log('      → 30초 복구:');
  console.log(`         security list-keychains -d user -s ${homedir()}/Library/Keychains/login.keychain-db /Library/Keychains/System.keychain`);
}

// ── ②③ 실제로 서명할 수 있는가 ────────────────────────────────────────────
const ids = sh('security find-identity -v -p codesigning');
const n = Number(ids.match(/(\d+) valid identities found/)?.[1] ?? 0);
if (n === 0) fail('코드사이닝 인증서가 **0개** — 위 검색목록부터 고치세요(인증서를 새로 만들지 마십시오)');
else pass(`코드사이닝 인증서 ${n}개 보임`);

// archive 는 배포(Distribution) 인증서를 요구한다 — 개발용만 있으면 통과 못 한다
if (n > 0) {
  if (/Apple Distribution|iPhone Distribution/.test(ids)) pass('배포 인증서(Apple Distribution) 있음');
  else fail('개발용 인증서만 있습니다 — archive 는 **Apple Distribution** 이 필요합니다');
}

console.log(bad ? '\n❌ check:keychain 실패 — 이대로 iOS 빌드를 돌리면 10초 만에 죽습니다\n'
  : '\n✅ check:keychain 통과 — 서명 준비됨\n');
if (bad) process.exitCode = 1;
