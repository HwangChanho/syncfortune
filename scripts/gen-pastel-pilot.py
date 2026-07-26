#!/usr/bin/env python3
# 파스텔+금선 톤 파일럿 (daniel 2026-07-26 "카드 이미지랑 배너 이미지가 테마랑 안맞고 너무 어두운거 같아 컨셉을 다시 잡아보자")
# ─────────────────────────────────────────────────────────────────────────
# 문제: 기존 레시피 PREFIX 에 `deep midnight navy blue background` 가 박혀 있어 전 이미지가 어둡다.
#   그런데 앱은 2026-07-15 에 **라이트(iOS 클린 + 일간 오행색)** 로 바뀌었다 → 흰 배경에 어두운 그림이 뜬다.
#   (그 부조화를 이미 `labelScrim` 을 거의 불투명하게 만들어 임시로 가려 왔다 = 근본은 이미지 톤.)
# 방향(daniel 선택): **파스텔 + 금선(상냥·귀여움)**.
#
# ★07-19 프롬프트 실패에서 얻은 규칙 3개를 반영한다(같은 실수 반복 금지):
#   ⓐ프리픽스에 강한 사물(crescent moon 등)을 넣으면 **그것이 피사체를 이긴다** → 프리픽스에서 제거
#   ⓑ`{피사체},{배경}` 동등 나열이면 사물형이 풍경에 묻힌다 → 피사체를 **전경·크게**로 못박는다
#   ⓒ**구도 지시는 프롬프트 맨 앞**에 둬야 먹는다(뒤에 두면 무시됨)
# ★어두워지는 것을 negative 로 직접 차단(dark/navy/midnight/black background).
#
# ⚠️ **원본을 덮지 않는다** — 파일럿은 `app/assets/icons/_pilot/` 에 저장하고, daniel 확인 후 교체한다.
# 실행: Draw Things 를 켜고(로컬 HTTP API 7860) `python3 scripts/gen-pastel-pilot.py`
# ─────────────────────────────────────────────────────────────────────────
import urllib.request, json, base64, os, sys

API = "http://127.0.0.1:7860/sdapi/v1/txt2img"
OUT = "/Users/danielhwang/Desktop/Projects/syncfortune/app/assets/icons/_pilot"
os.makedirs(OUT, exist_ok=True)

# 구도는 각 ITEM 이 맨 앞에서 지정한다(ⓒ). 여기는 **톤·재질**만 — 강한 사물 없음(ⓐ).
TONE = (
    "soft pastel illustration, delicate thin gold line accents, "
    "light airy background in warm cream and pale blush, gentle rounded shapes, "
    "storybook charm, soft even lighting, matte paper texture, "
    "small subtle gold filigree ornament in one corner only, generous negative space, "
    "calm and friendly, high key, bright"
)
# ★'어두움'을 명시적으로 배제 — 기존 레시피가 남긴 다크 편향을 뒤집는다.
NEG = (
    "dark, dark background, black background, deep navy, midnight blue, night scene, gloomy, "
    "heavy shadows, dramatic lighting, neon, oversaturated, gaudy, garish, "
    "photo, photograph, realistic, 3d render, text, letters, words, numbers, watermark, signature, "
    "blurry, deformed, ugly, low quality, cluttered, frame within frame, human face closeup"
)

# (파일명, 구도+피사체[맨 앞에 구도], 폭, 높이)
#   피사체를 '전경·크게·중앙'으로 못박아 배경에 묻히지 않게(ⓑ).
ITEMS = [
    # 콘텐츠 타일(세로) — 홈·풀이 탭 카드에서 가장 많이 보이는 4종
    ("premium", "vertical portrait composition, large centered foreground subject: "
                "an open almanac book with softly glowing pastel pages and tiny gold constellation marks above it", 832, 1216),
    ("compat",  "vertical portrait composition, large centered foreground subject: "
                "two slender cranes facing each other with a single thin gold thread linking them, pastel sky behind", 832, 1216),
    ("timeline","vertical portrait composition, large centered foreground subject: "
                "a gently winding pale path climbing through soft pastel hills, small gold milestone dots along it", 832, 1216),
    ("child",   "vertical portrait composition, large centered foreground subject: "
                "a small sprout in a pastel ceramic pot with one tiny bird perched on its rim, thin gold leaf accents", 832, 1216),
    # 하우스 광고 배너(가로) — 홈 최상단에서 가장 크게 보이는 자리
    ("banner_love", "horizontal wide composition, large foreground subject slightly left of center: "
                    "two pastel paper hearts tied by a thin gold ribbon, soft cream background with wide empty space on the right for text",
                    1344, 768),
]

def gen(name, subject, w, h):
    payload = {
        "prompt": subject + ", " + TONE,   # 구도·피사체 먼저(ⓒ), 톤은 뒤
        "negative_prompt": NEG,
        "steps": 28, "cfg_scale": 6.5, "width": w, "height": h,
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
    print(f"  ✓ {name}.png  ({w}x{h})  {len(img)//1024}KB")

if __name__ == "__main__":
    # Draw Things 가 떠 있는지 먼저 확인 — 안 켜져 있으면 무엇을 해야 하는지 알려준다.
    try:
        urllib.request.urlopen("http://127.0.0.1:7860/sdapi/v1/options", timeout=4).read(1)
    except Exception:
        print("❌ Draw Things 로컬 API(127.0.0.1:7860)에 연결할 수 없습니다.\n"
              "   Draw Things 앱을 켜고 설정에서 HTTP/API 서버를 활성화한 뒤 다시 실행해 주세요.")
        sys.exit(1)
    print(f"파스텔+금선 파일럿 {len(ITEMS)}장 → {OUT}")
    for it in ITEMS:
        gen(*it)
    print("\n완료. 원본은 건드리지 않았습니다 — _pilot/ 에서 톤을 확인한 뒤 교체 여부를 결정하세요.")
