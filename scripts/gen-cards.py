#!/usr/bin/env python3
# 카드 이미지 **본 생성기** — 평면 에디토리얼 + 구상 소재 (daniel 2026-07-27 "이 방향으로 가자")
# ─────────────────────────────────────────────────────────────────────────
# 파일럿 3차(gen-card-subjects.py)에서 승인된 방향을 그대로 굳힌 것. TONE/COMP/NEG 는 **손대지 말 것** —
# 65종이 한 가족으로 보이려면 소재만 바뀌고 나머지는 고정이어야 한다.
#
# ★여기까지 온 경위(같은 실수 반복 금지):
#   1차 파스텔 · 2차 담채/민화/금선 = **팔레트만 바꿔서 전부 실패**. daniel "다 별로야, 해당 컨텐츠에 대한 부각".
#   실제 렌더 크기(168×233 + 라벨 그라데이션, 54pt 썸네일)로 합성해 보고서야 원인이 보였다:
#     · 피사체가 **하단**이면 라벨 그라데이션(최하단 0.94)에 먹힌다
#     · **명도** 대비가 없으면(베이지 위 베이지) 카드 크기에서 소멸한다
#     · 예쁜 정물(책·매듭·학)은 "무슨 콘텐츠인지"를 말하지 않는다 ← daniel 이 지적한 핵심
#   3차에서 구도·대비·의미를 고쳐 6장 중 3장 성공(이전 10장은 0장). 그때 얻은 규칙:
#     ★**구상(알아볼 수 있는 사물·장면) > 상징(추상 도형)** — ⓐ안 3/3 성공, ⓑ안 3/3 실패.
#
# 지키는 규칙(전부 실측에서 나옴):
#   R1 피사체는 상단 절반 · 하단 1/3 비움      R2 배경과 **명도**가 다른 진한 단색 하나
#   R3 54pt 에서 읽히는 단일 실루엣            R4 소재는 장식이 아니라 **콘텐츠 표지판**
#   R5 글자 나오는 소재(책·문서·간판) 금지     R6 개수를 세야 하는 소재 회피(학 2마리 → 머리 3개)
#   R7 생성 후 **가장자리 5% 크롭** — 네거티브로 못 막는 액자가 계속 나온다(궁합ⓐ·시기ⓑ에서 실제 발생)
#
# ⚠️ 원본 미변경 — `_pilot/` 에만 저장하고, daniel 확인 후 별도로 교체한다.
# 실행: python3 scripts/gen-cards.py w1        (웨이브 지정)
#       python3 scripts/gen-cards.py --preview w1
# ─────────────────────────────────────────────────────────────────────────
import urllib.request, json, base64, os, sys

API = "http://127.0.0.1:7860/sdapi/v1/txt2img"
ROOT = "/Users/danielhwang/Desktop/Projects/syncfortune"
OUT = f"{ROOT}/app/assets/icons/_pilot"
os.makedirs(OUT, exist_ok=True)

# ── 고정 3종(승인된 값 — 변경 금지) ────────────────────────────────────────
TONE = (
    "clean flat illustration, warm cream background, "
    "the subject rendered in ONE deep saturated color with strong value contrast against the pale background, "
    "thin gold line accents, bold simple shapes, minimal interior detail, "
    "crisp silhouette, poster-like clarity, soft even lighting, matte paper texture"
)
COMP = ("vertical portrait composition, one single large subject filling the UPPER half of the frame, "
        "plain empty background in the lower third, "
        "read-at-a-glance icon-like clarity, large foreground subject: ")
NEG = (
    "text, letters, words, writing, calligraphy, typography, printed page, book, document, "
    "hangul, chinese characters, numbers, watermark, signature, "
    "extra heads, two heads, duplicate head, extra limbs, extra fingers, deformed hands, deformed, mutated, "
    "dark background, black background, midnight blue, night scene, gloomy, heavy shadows, "
    "photo, photograph, realistic, photorealistic, 3d render, cgi, "
    "frame, border, frame within frame, ornate frame, "
    "busy, cluttered, tiny details, low contrast, washed out, blurry, low quality"
)

# ── 소재 = 콘텐츠 표지판(R4). 키 = 교체할 에셋 파일명(확장자 제외) ──────────
#   ★설계 원칙: 그 콘텐츠를 한 단어로 줄였을 때 떠오르는 **물건/장면**을 고른다.
#     사람이 필요하면 **뒷모습·얼굴 없음**(손발 기형 미해결 — 07-19). 쌍이 필요하면 하나의 형태로(R6).
WAVES = {
  # 웨이브1 — 가장 많이 보이는 12종(프리미엄 5 + 인기·상시 7)
  "w1": {
    # 사주 원국풀이 = '나를 읽는다' → 한 사람 뒷모습 위로 이어지는 별자리
    "premium":   "a single human silhouette seen from behind, head and shoulders only, "
                 "constellation lines and stars connecting above the head, deep indigo silhouette on cream",
    # 자미두수 = 별 체계 → 큰 중심별이 있는 성반 원반(밝은 바탕·진한 별)
    "ziwei":     "one large circular star chart disc with a single bright star at its center, "
                 "concentric rings, deep indigo disc with gold rings on cream",
    # 궁합 = 두 사람이 이어짐(3차 승인안)
    "compat":    "two simple faceless human silhouettes seen from behind, shoulders close, "
                 "a single red thread linking them, deep indigo silhouettes on cream",
    # 타임라인 = 나아감·단계(3차 승인안)
    "timeline":  "a winding stone staircase climbing upward and curving, "
                 "deep teal steps on cream, one small gold marker at the top step",
    # 재물운 = 쌓임(3차 승인안)
    "wealth":    "a round earthenware jar overflowing with a heap of large gold coins, "
                 "deep persimmon jar, thick gold coin mass, cream background",
    # 자식운 = 어린 생명 → 화분의 새싹 하나 + 위에 작은 별
    "child":     "one small young sprout in a round ceramic pot, two broad leaves, "
                 "a tiny gold star above it, deep jade green sprout on cream",
    # 직업 적성 = 방향 찾기 → 큰 나침반 하나
    "jobfit":    "one large ornate compass seen from directly above, needle pointing up, "
                 "deep teal compass body with gold needle and ring, cream background",
    # 애정흐름 = 흐르는 인연 → 굽이치는 붉은 실 한 줄 + 끝 매듭
    "love":      "one long red thread flowing in a wide graceful curve, "
                 "ending in a single small knot, deep crimson thread on cream",
    # 오늘의 운세 = 하루의 시작 → 떠오르는 해와 구름 하나
    "today":     "a large rising sun disc partly behind one long cloud, "
                 "deep persimmon sun with gold rim on cream",
    # 타로 = 펼친 카드 → 부채꼴 카드 뭉치(개수 무관 덩어리)
    "taro":      "a fan of blank playing cards spread in an arc, backs facing viewer, "
                 "deep indigo card backs with gold edges on cream",
    # 만세력 = 시간의 이치 → 해와 달이 한 원반에(음양)
    "manse":     "one large circular disc split into a sun half and a moon half, "
                 "deep indigo and gold on cream, clean geometric",
    # 성격유형 = 자기 이해 → 거울 앞의 뒷모습
    "persona":   "a single human silhouette seen from behind facing a tall oval mirror, "
                 "deep indigo silhouette, gold mirror rim, cream background",
  },
}

W, H = 832, 1216
CROP = 0.05   # R7 — 가장자리 5% 잘라 액자 제거


def gen(name: str, subject: str) -> None:
    """한 장 생성 → 가장자리 크롭 → `_pilot/<name>.png`. 구도 → 피사체 → 톤 순서 고정(07-19 교훈 ⓒ)."""
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
    raw = base64.b64decode(res["images"][0].split(",", 1)[-1])
    tmp = os.path.join(OUT, f"{name}.png")
    with open(tmp, "wb") as f:
        f.write(raw)
    # R7 액자 제거 — 네거티브를 뚫고 나오므로 후처리로 확실히 잘라낸다
    from PIL import Image
    im = Image.open(tmp)
    dx, dy = int(im.width * CROP), int(im.height * CROP)
    im.crop((dx, dy, im.width - dx, im.height - dy)).resize((W, H), Image.LANCZOS).save(tmp)
    print(f"  ✓ {name}.png", flush=True)


def preview(names) -> str:
    """
    실제 카드 크기 대조표 — 그리드 168×233(@3x + 라벨 그라데이션) / 리스트 54pt(정사각 크롭).
    ★이 크기에서 안 읽히면 원본 품질은 의미가 없다. 판정은 반드시 여기서 한다.
    """
    from PIL import Image, ImageDraw
    GW, GH, LT, pad = 504, 699, 162, 20
    cells = []
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
        for y in range(int(GH * 0.55), GH):
            t = (y - GH * 0.55) / (GH * 0.45)
            d.line([(0, y), (GW, y)], fill=(11, 10, 26, int(255 * min(0.94, t * t * 0.94))))
        g = Image.alpha_composite(g.convert("RGBA"), ov).convert("RGB")
        m = min(im.width, im.height)
        sq = im.crop(((im.width - m) // 2, (im.height - m) // 2,
                      (im.width - m) // 2 + m, (im.height - m) // 2 + m)).resize((LT, LT), Image.LANCZOS)
        cells.append((n, g, sq))
    # 6열 격자로(가로로 길어지면 보기 어렵다)
    cols = 6
    rows = (len(cells) + cols - 1) // cols
    cw, ch = GW + pad + LT, GH + pad
    cv = Image.new("RGB", (cols * cw + pad, rows * ch + pad), (247, 243, 234))
    for i, (n, g, sq) in enumerate(cells):
        x = pad + (i % cols) * cw
        y = pad + (i // cols) * ch
        cv.paste(g, (x, y)); cv.paste(sq, (x + GW + pad // 2, y))
    dest = f"{OUT}/_cards_preview.png"
    cv.save(dest)
    return dest


if __name__ == "__main__":
    wave = next((a for a in sys.argv[1:] if not a.startswith("-")), "w1")
    items = WAVES[wave]
    if "--preview" not in sys.argv:
        try:
            urllib.request.urlopen("http://127.0.0.1:7860/sdapi/v1/options", timeout=4).read(1)
        except Exception:
            print("❌ Draw Things API(127.0.0.1:7860) 연결 불가 — 모든 설정 → 전체 → 맨 아래 'API 서버' 활성화(HTTP).")
            sys.exit(1)
        print(f"[{wave}] 카드 {len(items)}장 → {OUT}")
        for n, subj in items.items():
            gen(n, subj)
    print("실제 카드 크기 대조표:", preview(list(items)))
