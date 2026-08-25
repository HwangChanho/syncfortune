#!/usr/bin/env bash
# 하네스가 **코드를 보는가, 내가 쓴 주석을 보는가**를 가린다.
# ═══════════════════════════════════════════════════════════════════════════
# 왜 있나 — 실제로 두 번 물렸다(2026-08-24):
#   · `check:talknotes` ⑦ 가 **내가 쓴 설명 주석**을 조건 충족으로 읽었다
#   · `check:talkcoin` ① 이 주석 안의 `consultant_id` 를 코드로 읽었다
#   둘 다 «통과»라 말했지만 실제 코드는 그 조건을 만족하지 않았다 — **거짓 초록불**이다.
#
# 방법 — 감시 대상의 **주석만** 걷어내고 다시 돌린다.
#   통과 유지 → 코드를 본다 ✅ / 갑자기 실패 → 주석에 의존한다 ❌
#   ⚠️주석 안의 마커를 **일부러** 검사하는 하네스는 여기서 ❌ 로 뜬다 — 사람이 판단한다.
#
# ⚠️⚠️소스를 잠깐 고친다. 복원이 이 스크립트의 **가장 중요한 책임**이다.
#   ★2026-08-25 사고: 처음엔 `git checkout` 으로 되돌렸는데, **추적 안 되는 파일이 목록에 섞이면
#     git 이 통째로 거부해 하나도 복원되지 않는다.** `supabase/` 가 gitignore 라서
#     Edge 함수 3개의 주석이 날아갔다(배포본을 내려받아 되살렸다 — 코드가 같아서 살았다).
#   ⇒ 이제 **파일 복사로 백업·복원**한다(추적 여부와 무관). 그리고 **해시로 복원을 증명**한다.
#
# 사용: bash scripts/audit-harness-comments.sh [하네스이름…]   (없으면 전부)
set -u
cd "$(dirname "$0")/.."
BK="$(mktemp -d)"
h() { shasum -a 256 "$1" | cut -d' ' -f1; }

# ★어떤 경로로 끝나든 반드시 되돌린다(Ctrl+C·오류 포함)
restore_all() {
  local failed=0
  for b in "$BK"/*.bak; do
    [ -e "$b" ] || continue
    local orig; orig=$(cat "${b%.bak}.path")
    cp "$b" "$orig" || failed=1
  done
  return $failed
}
trap 'echo; echo "⚠️ 중단됨 — 복원한다"; restore_all; rm -rf "$BK"; exit 130' INT TERM

TARGETS="${*:-}"
[ -z "$TARGETS" ] && TARGETS=$(grep -o '"check:[a-z0-9-]*"' package.json | tr -d '"' | sed 's/check://' | sort -u)

good=0; bad=0; skip=0; badlist=""; i=0
for n in $TARGETS; do
  sc="scripts/check-$n.ts"; [ -f "$sc" ] || { skip=$((skip+1)); continue; }
  files=$(grep -oE "'[a-zA-Z][a-zA-Z0-9/_.@-]+\.(ts|tsx)'" "$sc" | tr -d "'" | sort -u \
          | while read -r f; do [ -f "$f" ] && echo "$f"; done)
  [ -z "$files" ] && { printf "  %-18s ⏭  감시 파일 못 찾음(DB·산출물 검사일 수 있다)\n" "$n"; skip=$((skip+1)); continue; }
  npm run "check:$n" >/dev/null 2>&1 || { printf "  %-18s ⏭  원래부터 실패 — 먼저 고칠 것\n" "$n"; skip=$((skip+1)); continue; }

  # ── 백업(복사) + 원본 해시 기록 ──
  declare -a HASH=(); declare -a PATHS=()
  for f in $files; do
    i=$((i+1)); cp "$f" "$BK/$i.bak"; printf '%s' "$f" > "$BK/$i.path"
    HASH+=("$(h "$f")"); PATHS+=("$f")
  done
  for f in $files; do python3 scripts/strip-comments.py "$f"; done
  npm run "check:$n" >/dev/null 2>&1; after=$?

  # ── 복원 + **해시로 증명** ──
  restore_all
  for k in "${!PATHS[@]}"; do
    if [ "$(h "${PATHS[$k]}")" != "${HASH[$k]}" ]; then
      echo "❌❌ 복원 실패: ${PATHS[$k]} — 백업본은 $BK 에 있다. 즉시 손으로 되돌려라"; exit 2
    fi
  done

  if [ $after -eq 0 ]; then good=$((good+1))
  else bad=$((bad+1)); badlist="$badlist $n"
       printf "  %-18s ❌ 주석에 의존 — 주석을 지우니 실패한다\n" "$n"; fi
done

rm -rf "$BK"
echo
echo "코드를 본다 $good · 주석 의존 $bad · 건너뜀 $skip"
[ $bad -eq 0 ] && echo "✅ 검사한 하네스 전부 실제 코드를 본다" || { echo "→ 확인할 것:$badlist"; exit 1; }
