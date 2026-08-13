#!/usr/bin/env bash
# scripts/deploy-admin.sh — 관리자 콘솔을 Cloudflare Pages 공개 URL 로 배포
# ═══════════════════════════════════════════════════════════════════════════
# daniel 2026-08-13: *"https://hairpin-admin.pages.dev/ 이거처럼 일반 url로 관리자 페이지 만들어"*
#
#   배포 주소: https://syncfortune-admin.pages.dev/
#
# ■ 왜 Cloudflare Pages 인가
#   Supabase 는 Edge·Storage 모두 `text/plain` + sandbox 를 강제해 **브라우저가 HTML 렌더를 거부**한다
#   ([[supabase-cannot-serve-html]]). GitHub Pages 도 되지만 주소가 `…github.io/syncfortune/admin/` 로
#   경로가 붙는다. Pages 는 **루트 도메인 하나**로 끝난다 — daniel 이 요청한 형태.
#
# ■ ★배포 전에 반드시 키 검사 (되돌릴 수 없기 때문)
#   이 페이지는 **누구나 여는 공개 주소**다. 로그인으로 화면은 잠기지만 **HTML 소스는 전부 읽힌다.**
#   service_role 키가 한 번 나가면 DB 전체가 열리고, 지워도 이미 읽혔다고 봐야 한다.
#   그래서 `check:adminkeys` 를 **먼저** 돌리고, 실패하면 배포 자체를 하지 않는다.
#
# ■ 이 스크립트가 막는 함정 (전부 이 프로젝트에서 실제로 당한 것)
#   ① **파이프가 exit code 를 가린다** — `cmd | tail` 은 tail 의 성공을 반환한다.
#      안드로이드 빌드가 실패했는데 exit 0 으로 보고된 적이 있다 ⇒ `PIPESTATUS` 로 실제 코드를 본다.
#   ② **배포됐다 ≠ 반영됐다** — 업로드 성공 메시지는 배포 완료를 뜻하지 않는다
#      ([[verify-facts-not-memory]] · Play API `completed` 함정) ⇒ 끝에 **실제 URL 을 받아 해시 대조**한다.
#   ③ **stale 산출물** — 옛 파일이 그대로 올라가는 사고 ⇒ 임시 디렉터리를 매번 새로 만든다.
#
# 실행: npm run deploy:admin
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail

cd "$(dirname "$0")/.."
SRC="docs/admin/index.html"
PROJECT="syncfortune-admin"
URL="https://${PROJECT}.pages.dev/"

[ -f "$SRC" ] || { echo "❌ $SRC 가 없습니다"; exit 1; }

# ── 1. 키 검사 (실패하면 여기서 멈춘다 — 비가역이므로 우회 경로를 두지 않는다) ──
echo "🔑 배포 전 키 검사…"
npm run --silent check:adminkeys || { echo "❌ 키 검사 실패 — 배포를 중단합니다."; exit 1; }

# ── 2. 깨끗한 임시 디렉터리로 복사 (stale 방지) ──────────────────────────────
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
cp "$SRC" "$STAGE/index.html"
LOCAL_HASH="$(shasum -a 256 "$STAGE/index.html" | cut -c1-16)"
echo "📦 배포할 내용 $(wc -c < "$STAGE/index.html" | tr -d ' ') bytes · $LOCAL_HASH"

# ── 3. 배포 (npx 캐시 권한 우회 — 이 환경의 기본 캐시는 EACCES) ──────────────
export npm_config_cache="${TMPDIR:-/tmp}/npmcache-admin"
set +e
npx --yes wrangler@latest pages deploy "$STAGE" \
  --project-name "$PROJECT" --branch main --commit-dirty=true 2>&1 | tail -6
RC=${PIPESTATUS[0]}          # ★ tail 이 아니라 wrangler 의 종료코드
set -e
[ "$RC" -eq 0 ] || { echo "❌ 배포 실패 (wrangler exit $RC)"; exit 1; }

# ── 4. ★실측 — 올라간 것이 정말 이 내용인가 (전파까지 최대 30초 기다린다) ─────
echo "🔍 실제 URL 에서 내용 확인 중…"
for i in $(seq 1 10); do
  REMOTE_HASH="$(curl -sL "$URL" | shasum -a 256 | cut -c1-16)"
  [ "$REMOTE_HASH" = "$LOCAL_HASH" ] && break
  sleep 3
done

CODE="$(curl -s -o /dev/null -w '%{http_code}' -L "$URL")"
if [ "$REMOTE_HASH" = "$LOCAL_HASH" ]; then
  echo "✅ 배포·반영 확인 — $URL ($CODE · $REMOTE_HASH)"
else
  echo "⚠️  업로드는 됐으나 URL 내용이 아직 다릅니다 (로컬 $LOCAL_HASH ≠ 원격 $REMOTE_HASH · HTTP $CODE)"
  echo "   CDN 전파 지연일 수 있습니다. 30초 뒤 다시 확인하십시오."
  exit 1
fi
