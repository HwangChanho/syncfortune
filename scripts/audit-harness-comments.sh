#!/usr/bin/env bash
# 하네스가 **코드를 보는가, 내 주석을 보는가**를 가린다.
# ═══════════════════════════════════════════════════════════════════════════
# 왜 있나 — 실제로 두 번 물렸다(2026-08-24):
#   · `check:talknotes` ⑦ 가 **내가 쓴 설명 주석**을 조건 충족으로 읽었다
#   · `check:talkcoin` ① 이 주석 안의 `consultant_id` 를 코드로 읽었다
#   둘 다 «통과»라고 말했지만 실제 코드는 그 조건을 만족하지 않았다. **거짓 초록불**이다.
#
# 방법 — 감시 대상 파일의 **주석만** 걷어내고 다시 돌린다.
#   통과 유지 → 코드를 본다 ✅ / 갑자기 실패 → 주석에 의존한다 ❌
#   ⚠️주석 안의 마커를 **일부러** 검사하는 하네스는 여기서 ❌ 로 뜬다 — 그건 사람이 판단한다.
#
# ⚠️소스를 잠깐 고친다. 작업트리가 깨끗할 때만 돌고, 매번 `git checkout` 으로 되돌린다.
# 사용: bash scripts/audit-harness-comments.sh [하네스이름…]   (없으면 전부)
set -u
cd "$(dirname "$0")/.."
[ -z "$(git status --porcelain)" ] || { echo "❌ 작업트리가 더럽다 — 되돌릴 안전망이 없어 중단한다"; exit 1; }

TARGETS="${*:-}"
[ -z "$TARGETS" ] && TARGETS=$(grep -o '"check:[a-z0-9-]*"' package.json | tr -d '"' | sed 's/check://' | sort -u)

good=0; bad=0; skip=0; badlist=""
for n in $TARGETS; do
  sc="scripts/check-$n.ts"; [ -f "$sc" ] || { skip=$((skip+1)); continue; }
  files=$(grep -oE "'[a-zA-Z][a-zA-Z0-9/_.@-]+\.(ts|tsx)'" "$sc" | tr -d "'" | sort -u \
          | while read -r f; do [ -f "$f" ] && echo "$f"; done)
  [ -z "$files" ] && { printf "  %-18s ⏭  감시 파일 못 찾음(DB·산출물 검사일 수 있다)\n" "$n"; skip=$((skip+1)); continue; }
  npm run "check:$n" >/dev/null 2>&1 || { printf "  %-18s ⏭  원래부터 실패 — 먼저 고칠 것\n" "$n"; skip=$((skip+1)); continue; }
  for f in $files; do python3 scripts/strip-comments.py "$f"; done
  npm run "check:$n" >/dev/null 2>&1; after=$?
  git checkout -- $files 2>/dev/null
  if [ $after -eq 0 ]; then good=$((good+1))
  else bad=$((bad+1)); badlist="$badlist $n"
       printf "  %-18s ❌ 주석에 의존 — 주석을 지우니 실패한다\n" "$n"; fi
done
echo
echo "코드를 본다 $good · 주석 의존 $bad · 건너뜀 $skip"
[ -n "$(git status --porcelain)" ] && { echo "❌❌ 복원 실패 — git status 를 확인하라"; exit 2; }
[ $bad -eq 0 ] && echo "✅ 검사한 하네스 전부 실제 코드를 본다" || echo "→ 확인할 것:$badlist"
exit 0
