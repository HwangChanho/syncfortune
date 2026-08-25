#!/usr/bin/env bash
# 구글 드라이브에서 **전사 없이** 파일을 받는다.
# ═══════════════════════════════════════════════════════════════════════════
# 왜 있나 — 2026-08-25:
#   드라이브 MCP 의 `download_file_content` 는 내용을 **base64 문자열**로 돌려준다.
#   그걸 파일로 남기려면 내가 다시 타이핑해야 하는데, **그 경로는 두 번 깨졌다**
#   (27,005 vs 27,004 · 18,015 vs 18,016 — 각각 1바이트·1글자 누락).
#   ⇒ curl 로 받으면 바이트가 손을 안 거친다. v1 12장으로 **12/12 바이트 일치** 확인.
#
# 쓰는 법
#   1) 폴더 안의 파일 목록·id·크기는 드라이브 MCP `search_files` 로 얻는다:
#        parentId = '<폴더id>'
#   2) "<id> <파일명> <바이트수>" 를 한 줄씩 담은 목록을 만들어 넘긴다
#        ./scripts/drive-fetch.sh list.txt ./받을곳
#   ★바이트수를 같이 적는 게 핵심이다 — 그게 무결성 검증이다. 모르면 0 을 적는다(검증 건너뜀).
#
# ⚠️링크 공개가 안 된 파일은 HTML 안내 페이지가 내려온다 — mime 검사가 그걸 잡는다.
set -u
LIST="${1:?사용: drive-fetch.sh <목록파일> [받을곳]}"
OUT="${2:-.}"
mkdir -p "$OUT"
ok=0; bad=0
while read -r id name want; do
  [ -z "${id:-}" ] && continue
  curl -sL --max-time 60 "https://drive.google.com/uc?export=download&id=$id" -o "$OUT/$name"
  got=$(wc -c < "$OUT/$name" | tr -d ' ')
  mime=$(file -b --mime-type "$OUT/$name")
  # HTML 이 내려왔다 = 권한이 없거나 바이러스검사 경고 페이지다
  if [ "$mime" = "text/html" ]; then
    printf "%-24s ❌ 파일이 아니라 HTML — 링크 공개가 안 됐거나 용량 경고 페이지\n" "$name"; bad=$((bad+1)); continue
  fi
  if [ "${want:-0}" != "0" ] && [ "$got" != "$want" ]; then
    printf "%-24s ❌ %s 바이트 (기대 %s) — 받다 잘렸다\n" "$name" "$got" "$want"; bad=$((bad+1)); continue
  fi
  printf "%-24s ✅ %8s 바이트  %s\n" "$name" "$got" "$mime"; ok=$((ok+1))
done < "$LIST"
echo
echo "받음 $ok · 실패 $bad"
[ "$bad" -eq 0 ]
