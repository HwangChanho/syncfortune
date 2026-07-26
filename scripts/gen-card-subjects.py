#!/usr/bin/env python3
# 카드 이미지 3차 파일럿 — **소재·구도**를 고친다 (daniel 2026-07-27 "다 별로야, 해당 컨텐츠에 대한 부각이 돼야 해")
# ─────────────────────────────────────────────────────────────────────────
# ★1·2차 파일럿이 왜 실패했나(실측으로 규명):
#   나는 **팔레트**(파스텔/담채/민화/금선)를 바꾸고 있었는데, 정작 틀린 건 **구도·대비·의미**였다.
#   실제 렌더 크기로 합성해 보고서야 보였다(scripts 로 168×233 + 라벨 그라데이션 + 54pt 재현):
#     · premium(책) → 피사체가 **하단**에 있어 라벨 그라데이션(최하단 0.94 불투명)에 그대로 먹힘
#     · D(금선)     → 베이지 배경 위 베이지 피사체 = 카드 크기에서 **소멸**(색상만 다르고 명도가 같았다)
#     · B(매듭)·학  → 예쁘지만 "무슨 콘텐츠인지" 를 전혀 말하지 않음
#     · 54pt 리스트 썸네일에서는 4장 전부 뭉개짐(정사각 크롭까지 겹친다)
#
# ★그래서 이번엔 실제 렌더 제약을 프롬프트의 1급 요구로 올린다:
#   R1 피사체는 **상단 55%** 안에(하단 45%는 라벨 그라데이션 영역 → 비운다)
#   R2 **명도 대비** — 배경과 밝기가 달라야 한다(색상 차이만으론 카드에서 사라진다)
#   R3 **54pt 에서 읽히는 단일 실루엣** — 아이콘 같은 큰 덩어리 하나. 가는 디테일 금지
#   R4 소재가 **콘텐츠를 지칭**해야 한다(장식이 아니라 표지판). 이게 daniel 이 말한 '부각'이다
#   R5 글자 들어가는 소재(책·문서·간판) **전면 금지** — 2차에서 3방향 × 책 3장 전부 가짜 글자가 나왔다.
#      네거티브 11개로도 못 막았다 = 프롬프트로 못 이긴다. 소재를 바꾸는 것만이 답.
#   R6 개수를 세야 하는 소재 회피(학 2마리 → 머리 3개). 쌍이 필요하면 '하나의 형태로 이어진 쌍'으로.
#
# 검증도 이번엔 **실제 크기로** 한다 — `--preview` 로 168×233(라벨 합성) + 54pt 를 함께 뽑는다.
# ⚠️ 원본 미변경 — `_pilot/` 에만 저장.
# 실행: python3 scripts/gen-card-subjects.py           (생성)
#       python3 scripts/gen-card-subjects.py --preview (기존 산출물을 실제 카드 크기로 합성만)
# ─────────────────────────────────────────────────────────────────────────
import urllib.request, json, base64, os, sys

API = "http://127.0.0.1:7860/sdapi/v1/txt2img"
ROOT = "/Users/danielhwang/Desktop/Projects/syncfortune"
OUT = f"{ROOT}/app/assets/icons/_pilot"
os.makedirs(OUT, exist_ok=True)

# ── 톤: 대비를 요구로 못박은 버전(R2) — 배경은 밝게, 피사체는 진한 단색 하나 + 금선 ────────
TONE = (
    "clean flat illustration, warm cream background, "
    "the subject rendered in ONE deep saturated color with strong value contrast against the pale background, "
    "thin gold line accents, bold simple shapes, minimal interior detail, "
    "crisp silhouette, poster-like clarity, soft even lighting, matte paper texture"
)

# 글자·개수·해부·사진풍·액자를 한꺼번에 막는다(1·2차에서 실제로 난 결함들)
NEG = (
    "text, letters, words, writing, calligraphy, typography, printed page, book, document, "
    "hangul, chinese characters, numbers, watermark, signature, "
    "extra heads, two heads, duplicate head, extra limbs, extra fingers, deformed hands, deformed, mutated, "
    "dark background, black background, midnight blue, night scene, gloomy, heavy shadows, "
    "photo, photograph, realistic, photorealistic, 3d render, cgi, "
    "frame, border, frame within frame, ornate frame, "
    "busy, cluttered, tiny details, low contrast, washed out, blurry, low quality"
)

# ── 구도 프리픽스: **상단 배치**를 맨 앞에 못박는다(R1·R3 / 07-19 교훈 ⓒ) ──────────────
#   이전엔 "centered" 였다 — 그래서 라벨 그라데이션에 먹혔다. 이제 상단으로 올리고 하단을 비운다.
COMP = ("vertical portrait composition, one single large subject filling the UPPER half of the frame, "
        "plain empty background in the lower third, "
        "read-at-a-glance icon-like clarity, large foreground subject: ")

# ── 콘텐츠별 소재 = '표지판'(R4). 각 2안: ⓐ구상(무엇인지 즉시) / ⓑ상징(추상이지만 명확) ────
ITEMS = {
    # 궁합 — '두 사람이 이어짐'. 얼굴·손은 기형 위험(★07-19 미해결)이라 **뒷모습 실루엣**·손 미노출.
    "compat-a": "two simple faceless human silhouettes seen from behind, shoulders close, "
                "a single red thread linking them, deep indigo silhouettes on cream",
    # 쌍을 '하나의 형태'로(R6) — 겹친 두 원, 겹친 부분만 금색.
    "compat-b": "two large overlapping circles, the overlap filled with gold, "
                "deep indigo circles on cream, geometric and clean",

    # 재물운 — '쌓임'. 항아리+금화 덩어리(가는 디테일 없이 큰 덩어리로).
    "wealth-a": "a round earthenware jar overflowing with a heap of large gold coins, "
                "deep persimmon jar, thick gold coin mass, cream background",
    "wealth-b": "a tall stack of large gold coins forming one solid column, "
                "a few coins beside it, deep gold mass on cream",

    # 시기·흐름 — '나아감·단계'. 계단/길을 상단에서 굽히고 하단은 비움.
    "timing-a": "a winding stone staircase climbing upward and curving, "
                "deep teal steps on cream, one small gold marker at the top step",
    "timing-b": "five moon phases in a rising arc from crescent to full, "
                "deep indigo moons with gold rims on cream",
}

W, H = 832, 1216


def gen(name: str, subject: str) -> None:
    """한 장 생성. 구도(COMP) → 피사체 → 톤 순서 — 순서를 바꾸면 톤이 구도를 먹는다(07-19 교훈 ⓒ)."""
    payload = {
        "prompt": f"{COMP}{subject}, {TONE}",
        "negative_prompt": NEG,
        "steps": 28, "cfg_scale": 7.0, "width": W, "height": H,
        "sampler_name": "DPM++ 2M Karras", "batch_size": 1,
    }
    req = urllib.request.Request(API, data=json.dumps(payload).encode(),
                                headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=900) as r:
        res = json.loads(r.read())
    img = base64.b64decode(res["images"][0].split(",", 1)[-1])
    with open(os.path.join(OUT, f"{name}.png"), "wb") as f:
        f.write(img)
    print(f"  ✓ {name}.png  {len(img)//1024}KB", flush=True)


def preview(names) -> str:
    """
    실제 카드 크기로 합성해 한 장에 늘어놓는다 — **이 크기에서 안 읽히면 원본 품질은 의미가 없다.**
    그리드 168×233pt(@3x 504×699) + 라벨 그라데이션(하단 45%) / 리스트 54pt 정사각 크롭.
    @returns 저장 경로
    """
    from PIL import Image, ImageDraw
    GW, GH, LT, pad = 504, 699, 162, 24
    rows = []
    for n in names:
        p = os.path.join(OUT, f"{n}.png")
        if not os.path.exists(p):
            continue
        im = Image.open(p).convert("RGB")
        s = max(GW / im.width, GH / im.height)
        r = im.resize((int(im.width * s), int(im.height * s)), Image.LANCZOS)
        g = r.crop(((r.width - GW) // 2, (r.height - GH) // 2,
                    (r.width - GW) // 2 + GW, (r.height - GH) // 2 + GH))
        ov = Image.new("RGBA", (GW, GH), (0, 0, 0, 0)); d = ImageDraw.Draw(ov)
        for y in range(int(GH * 0.55), GH):                      # 라벨 그라데이션 재현
            t = (y - GH * 0.55) / (GH * 0.45)
            d.line([(0, y), (GW, y)], fill=(11, 10, 26, int(255 * min(0.94, t * t * 0.94))))
        g = Image.alpha_composite(g.convert("RGBA"), ov).convert("RGB")
        m = min(im.width, im.height)                              # 리스트 썸네일(정사각 크롭)
        sq = im.crop(((im.width - m) // 2, (im.height - m) // 2,
                      (im.width - m) // 2 + m, (im.height - m) // 2 + m)).resize((LT, LT), Image.LANCZOS)
        rows.append((g, sq))
    cw = GW + pad + LT
    cv = Image.new("RGB", (cw * len(rows) + pad * (len(rows) + 1), GH + pad * 2), (247, 243, 234))
    for i, (g, sq) in enumerate(rows):
        x = pad + i * (cw + pad)
        cv.paste(g, (x, pad)); cv.paste(sq, (x + GW + pad, pad))
    dest = f"{OUT}/_preview.png"
    cv.save(dest)
    return dest


if __name__ == "__main__":
    names = list(ITEMS)
    if "--preview" not in sys.argv:
        try:
            urllib.request.urlopen("http://127.0.0.1:7860/sdapi/v1/options", timeout=4).read(1)
        except Exception:
            print("❌ Draw Things API(127.0.0.1:7860) 연결 불가 — 모든 설정 → 전체 → 맨 아래 'API 서버' 활성화(HTTP).")
            sys.exit(1)
        print(f"카드 소재 파일럿 {len(ITEMS)}장 → {OUT}")
        for n, subj in ITEMS.items():
            gen(n, subj)
    print("실제 카드 크기 미리보기:", preview(names))
