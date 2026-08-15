#!/usr/bin/env python3
# 관계 지도 전용 이미지 6종 (Draw Things 로컬 · API 0원).
# ─────────────────────────────────────────────────────────────────────────
# daniel 2026-08-15: 관계 지도 "디자인 — 이미지 사용".
#   지금까지 지도는 색 원(dot)뿐이라 앱의 다른 화면(카드아트 278장)과 겉돌았다.
#   ★그림은 **문구의 비유를 그대로** 그린다 — relationMapPhrases 의 `image` 한 줄이 곧 프롬프트다.
#     (예: 인성 "마른 흙에 물이 스미듯" → 갈라진 땅에 물이 스미는 그림)
#     문구와 그림이 다른 말을 하면 이미지는 장식이 되고, 같은 말을 하면 설명이 된다.
#
# 톤 = 기존 코퍼스와 동일(미드나잇 네이비 + 골드 라인아트·타로풍) — [[image-asset-pipeline]].
#   ⚠️ 텍스트·글자 금지(SDXL 이 만드는 글자는 전부 깨진다). 실패해도 항목별 건너뛰고 계속.
#
# 실행: python3 scripts/gen-relmap-images.py   (Draw Things API 서버 켜져 있어야 함)
#   → PNG 저장 후 JPG q85 progressive 로 변환(`magick`), 업로드는 별도(Storage `assets/img/`).
# ─────────────────────────────────────────────────────────────────────────
import urllib.request, json, base64, os, time, subprocess

API = "http://127.0.0.1:7860/sdapi/v1/txt2img"
DEST = "/Users/danielhwang/Desktop/Projects/syncfortune/app/assets/icons/relmap"
os.makedirs(DEST, exist_ok=True)

# 가로 배너 프리픽스(기존 hero 레시피와 동일 계열)
PREFIX = ("mystical celestial illustration, thin delicate gold line art on deep midnight navy blue "
          "background, glowing stars and crescent moon, ornate gold filigree, horizontal banner "
          "composition, ")
NEG = ("photo, photorealistic, 3d render, text, letters, words, numbers, watermark, signature, "
       "bright saturated colors, white background, cluttered, blurry, deformed, low quality")

# key = 십신 slug(기존 lovestyle·bok·pastlife 와 같은 표기) / subject = 그 역할 문구의 비유
ITEMS = [
    ("inseong",   "rain soaking into dry cracked earth, a hand tilting a golden vessel to pour water "
                  "onto parched ground, nourishment flowing downward into roots"),
    ("bigeop",    "two identical tall trees standing side by side, branches mirroring each other, "
                  "twin silhouettes in quiet balance"),
    ("siksang",   "water flowing outward from a spring, a stream leaving the source and spreading "
                  "into many small channels, giving outward"),
    ("jaeseong",  "a hand reaching for ripe fruit hanging on a branch, harvest gathered into a "
                  "golden bowl, something solid to hold"),
    ("gwanseong", "a hammer striking glowing metal on an anvil, sparks scattering, a blade taking "
                  "its shape from the striking"),
    # 화면 최상단 히어로 — 지도 그 자체(가운데 나, 둘레에 사람들, 금실로 이어짐)
    ("hero",      "a single central robed figure surrounded by a wide circle of smaller robed "
                  "figures, all linked by fine golden threads, a constellation map of relationships"),
]


def gen(key: str, subject: str) -> None:
    """한 장 생성 → PNG 저장. 실패 시 예외(호출부가 재시도한다)."""
    payload = {"prompt": PREFIX + subject, "negative_prompt": NEG,
               "steps": 28, "cfg_scale": 6.5, "width": 1344, "height": 768,
               "sampler_name": "DPM++ 2M Karras", "batch_size": 1}
    req = urllib.request.Request(API, data=json.dumps(payload).encode(),
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=900) as r:
        res = json.load(r)
    img = base64.b64decode(res["images"][0])
    with open(os.path.join(DEST, f"{key}.png"), "wb") as f:
        f.write(img)
    print(f"OK {key} [{len(img)} bytes]", flush=True)


def to_jpg(key: str) -> None:
    """PNG → JPG q85 progressive (앱 이미지 코퍼스 규격 · 용량 사고 재발 방지)."""
    src, dst = os.path.join(DEST, f"{key}.png"), os.path.join(DEST, f"{key}.jpg")
    subprocess.run(["magick", src, "-quality", "85", "-interlace", "Plane", dst], check=True)
    os.remove(src)
    print(f"JPG {key} [{os.path.getsize(dst)} bytes]", flush=True)


ok = fail = 0
for key, subj in ITEMS:
    if os.path.exists(os.path.join(DEST, f"{key}.jpg")):
        print(f"SKIP {key} (exists)", flush=True); ok += 1; continue
    for attempt in (1, 2):
        try:
            gen(key, subj); to_jpg(key); ok += 1; break
        except Exception as e:
            print(f"WARN {key} attempt{attempt}: {e}", flush=True)
            if attempt == 2: fail += 1
            time.sleep(3)
print(f"DONE relmap images: ok={ok} fail={fail}", flush=True)
