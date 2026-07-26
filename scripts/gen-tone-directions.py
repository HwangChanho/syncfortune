#!/usr/bin/env python3
# 톤 방향 비교 파일럿 (daniel 2026-07-27 "다른 방향도 보자")
# ─────────────────────────────────────────────────────────────────────────
# 왜: 앱이 2026-07-15 에 라이트(한지 크림 + 먹 + 깊은 골드)로 바뀌었는데 카드/배너 이미지는 아직
#   미드나잇 다크라 톤이 어긋난다. A(파스텔+금선)를 먼저 뽑았고, 이제 **성격이 다른 3방향**을 비교한다.
#
# ★비교가 되게 만드는 규칙: **같은 소재 2개를 전 방향에 공통으로** 쓴다. 소재가 다르면 '그림이 예쁜지'를
#   보게 되고 '톤이 앱과 맞는지'를 못 본다. 그래서 소재는 고정하고 톤만 바꾼다.
#
# ★07-19 프롬프트 교훈 3개 유지:
#   ⓐ프리픽스에 강한 사물을 넣으면 그것이 피사체를 이긴다 → 톤 문구에 사물 없음
#   ⓑ피사체를 '전경·크게·중앙'으로 못박는다(배경에 묻힘 방지)
#   ⓒ구도 지시는 프롬프트 맨 앞
#
# ★07-27 파일럿에서 실제로 난 결함을 소재·네거티브로 막는다:
#   · premium(책)에 **가짜 글자**가 렌더됨 → 소재를 "완전히 빈 페이지"로 못박고 글자 계열 네거티브 대폭 강화
#   · compat(학 2마리)에 **머리가 3개** → 개수를 세야 하는 소재를 버리고 **매듭(단일 사물)**로 교체.
#     SDXL 은 "two X" 를 자주 틀린다. 세지 않아도 되는 소재를 고르는 것이 프롬프트로 싸우는 것보다 확실하다.
#   · banner 가 **사진풍 3D**로 나옴 → 이번엔 세로 타일만 뽑아 스타일을 먼저 확정한다(배너는 확정 후).
#
# ⚠️ 원본을 덮지 않는다 — `app/assets/icons/_pilot/` 에 `<방향>-<소재>.png` 로만 저장.
# 실행: python3 scripts/gen-tone-directions.py   (Draw Things API 서버 ON 필요)
# ─────────────────────────────────────────────────────────────────────────
import urllib.request, json, base64, os, sys

API = "http://127.0.0.1:7860/sdapi/v1/txt2img"
OUT = "/Users/danielhwang/Desktop/Projects/syncfortune/app/assets/icons/_pilot"
os.makedirs(OUT, exist_ok=True)

# ── 방향별 톤·재질 문구(사물 없음 — ⓐ) ────────────────────────────────────
DIRECTIONS = {
    # B. 한지 수묵 담채 — 사주/명리에 가장 native. 앱의 '한지+먹' 테마와 직결.
    "B-damchae": (
        "traditional Korean ink wash painting on warm hanji paper, sumi-e brushwork, "
        "soft muted color washes of celadon green and pale indigo, dry-brush texture, "
        "visible paper fiber, generous empty space, one thin gold accent line, "
        "serene and refined, light airy background, high key"
    ),
    # C. 조선 민화 — 개성이 가장 강하고 기억에 남는다. 납작한 장식적 화면.
    "C-minhwa": (
        "Korean minhwa folk painting style, flat decorative shapes, bold clean outlines, "
        "earthy mineral pigments of persimmon orange, jade green, indigo and ochre on cream ground, "
        "naive charming composition, auspicious and symbolic, no shading, poster-like clarity, "
        "warm and friendly"
    ),
    # D. 금선 미니멀 — 일관성 유지가 가장 쉽고 오래 안 낡는다. 프리미엄 인상.
    "D-goldline": (
        "minimal fine gold line art on plain warm cream ground, single-weight elegant contour lines, "
        "almost no fill, vast negative space, quiet luxury, editorial refinement, "
        "subtle debossed paper texture, no shading, very light background"
    ),
}

# ── 공통 네거티브 ─────────────────────────────────────────────────────────
#   글자 계열을 대폭 강화(파일럿에서 책 페이지에 가짜 글자가 나왔다).
#   개수/해부 오류도 명시(학 머리 3개 재발 방지 — 소재 교체와 이중 방어).
NEG = (
    "text, letters, words, writing, handwriting, calligraphy, typography, printed page, "
    "hangul, chinese characters, japanese characters, numbers, watermark, signature, logo, "
    "extra heads, two heads, duplicate head, extra limbs, extra legs, deformed, mutated, "
    "dark, dark background, black background, deep navy, midnight blue, night scene, gloomy, "
    "heavy shadows, dramatic lighting, neon, oversaturated, garish, "
    "photo, photograph, realistic, photorealistic, 3d render, cgi, plastic, "
    "blurry, low quality, cluttered, frame within frame, border, human face closeup"
)

# ── 공통 소재 2개(구도 맨 앞 — ⓒ / 전경·크게 — ⓑ) ─────────────────────────
SUBJECTS = {
    # 프리미엄 타일 — '풀이'를 상징. ★페이지를 '완전히 비어 있음'으로 못박아 가짜 글자를 원천 차단.
    "book": ("vertical portrait composition, large centered foreground subject: "
             "an open old book, both pages completely blank and empty with no writing at all, "
             "a few tiny stars floating above it"),
    # 궁합 타일 — ★개수를 세야 하는 '학 두 마리'를 버리고 **매듭 하나**로. 하나의 끈이 이어져 맺히는 형태.
    "knot": ("vertical portrait composition, large centered foreground subject: "
             "a single traditional Korean decorative cord knot made from one continuous silk cord, "
             "symmetrical, tassel hanging below"),
}

W, H = 832, 1216


def gen(name: str, prompt: str) -> None:
    """한 장 생성해 `_pilot/<name>.png` 로 저장한다. 실패는 예외로 올려 전체를 멈춘다(부분 결과 혼동 방지)."""
    payload = {
        "prompt": prompt,
        "negative_prompt": NEG,
        "steps": 28, "cfg_scale": 6.5, "width": W, "height": H,
        "sampler_name": "DPM++ 2M Karras", "batch_size": 1,
    }
    req = urllib.request.Request(API, data=json.dumps(payload).encode(),
                                headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=900) as r:
        res = json.loads(r.read())
    img = base64.b64decode(res["images"][0].split(",", 1)[-1])
    dest = os.path.join(OUT, f"{name}.png")
    with open(dest, "wb") as f:
        f.write(img)
    print(f"  ✓ {name}.png  {len(img)//1024}KB", flush=True)


if __name__ == "__main__":
    try:
        urllib.request.urlopen("http://127.0.0.1:7860/sdapi/v1/options", timeout=4).read(1)
    except Exception:
        print("❌ Draw Things API(127.0.0.1:7860) 연결 불가.\n"
              "   Draw Things → 모든 설정 → '전체' 탭 → 거의 맨 아래 'API 서버' → 활성화(프로토콜 HTTP).")
        sys.exit(1)
    total = len(DIRECTIONS) * len(SUBJECTS)
    print(f"톤 방향 비교 {total}장 → {OUT}")
    for dkey, tone in DIRECTIONS.items():
        for skey, subject in SUBJECTS.items():
            # 구도·피사체 먼저(ⓒ), 톤은 뒤 — 순서를 바꾸면 톤이 구도를 먹는다.
            gen(f"{dkey}-{skey}", f"{subject}, {tone}")
    print("\n완료. 원본 미변경 — _pilot/ 에서 A(파스텔)와 나란히 비교하세요.")
