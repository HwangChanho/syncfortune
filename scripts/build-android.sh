#!/usr/bin/env bash
# scripts/build-android.sh — Android 릴리스 번들 빌드 (**함정 세 개를 막는다**)
# ═══════════════════════════════════════════════════════════════════════════
# 2026-08-12 vc75 빌드에서 **세 개가 동시에** 물렸다. 하나씩은 전에도 겪었는데 매번 다시 밟는다.
#
# ① `/usr/libexec/java_home -v 17` 이 **조용히 java 26 을 돌려준다**
#    17 이 등록돼 있지 않으면 오류가 아니라 **폴백**한다. 그래서
#    `JAVA_HOME=$(/usr/libexec/java_home -v 17)` 은 안전해 보이지만 아무것도 보장하지 않는다.
#    증상 = 2초 만에 `Error resolving plugin [id: 'com.facebook.react.settings'] > 26`.
#    실제 JDK17 은 homebrew 에 있고 java_home 은 그걸 모른다.
#    ⇒ **경로를 못박고, 정말 17 인지 실행해서 확인한다.**
#
# ② `gradlew ... | tail` 은 **gradle 의 종료코드를 가린다**(파이프의 exit 는 tail 것).
#    실제로 BUILD FAILED 인데 exit 0 으로 보고돼 "빌드 성공"이라 말할 뻔했다.
#    ⇒ 파이프하지 않고, 종료코드를 **그대로** 전달한다.
#
# ③ 실패해도 **옛 AAB 가 그 자리에 남아 있다.** 그걸 올리면 구버전을 배포한다
#    ([[build-artifact-verify-hermes]]·[[app-size-remote-images]] 계열 = 산출물 stale).
#    ⇒ 빌드 전에 **기존 산출물을 치우고**, 끝나면 새로 생겼는지 mtime 으로 실측한다.
#
# 사용: bash scripts/build-android.sh
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
AAB="$ROOT/app/android/app/build/outputs/bundle/release/app-release.aab"
JDK17="${JDK17:-/opt/homebrew/opt/openjdk@17}"

# ── ① JDK 17 을 **실측**한다 (경로가 있다는 것만으로 믿지 않는다)
if [ ! -x "$JDK17/bin/java" ]; then
  echo "❌ JDK 17 이 없습니다: $JDK17"
  echo "   설치: brew install openjdk@17   (또는 JDK17=<경로> 로 지정)"
  exit 1
fi
VER="$("$JDK17/bin/java" -version 2>&1 | head -1)"
case "$VER" in
  *'"17'*) : ;;                       # OK
  *) echo "❌ 17 이 아닙니다: $VER"; echo "   ★java_home 은 17 이 없으면 조용히 다른 버전을 줍니다."; exit 1 ;;
esac
export JAVA_HOME="$JDK17"
echo "☕ $VER"

# ── ③ 옛 산출물을 치운다 — 실패 시 stale 을 올리는 사고 방지
BEFORE=""
[ -f "$AAB" ] && BEFORE="$(stat -f %m "$AAB")" && rm -f "$AAB" && echo "🧹 옛 AAB 제거(mtime=$BEFORE)"

# ── ② 파이프 없이 실행 — 종료코드를 가리지 않는다
cd "$ROOT/app/android"
set +e
./gradlew bundleRelease --no-daemon
CODE=$?
set -e
if [ $CODE -ne 0 ]; then echo "❌ gradle 실패 (exit=$CODE)"; exit $CODE; fi

# ── 산출물 실측 — "성공했다"는 말이 아니라 **파일이 새로 생겼는지**로 판정한다
if [ ! -f "$AAB" ]; then echo "❌ gradle 은 0 을 반환했지만 AAB 가 없습니다"; exit 1; fi
echo "✅ $(ls -lh "$AAB" | awk '{print $5}')  $(stat -f '%Sm' "$AAB")"
echo "   $AAB"
