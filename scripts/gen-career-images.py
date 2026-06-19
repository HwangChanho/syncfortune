#!/usr/bin/env python3
# K '사업가의 나 vs 직장인의 나' 카테고리 이미지 생성 (Draw Things 로컬 HTTP API, A1111 호환).
#   톤 레시피: 미드나잇 네이비 + 가는 골드 라인아트(타로풍, 천체·달·별·필리그리). image-asset-pipeline 재사용.
#   카테고리 6장 = 가로 배너(1344×768, career.tsx secImg cover) / 포트레잇 1장 = 홈 타일(career.png) + 화면 히어로(career/hero.png).
#   ⚠️ 텍스트·글자 금지(negative). 실패해도 항목별로 건너뛰고 계속.
import urllib.request, json, base64, os, time

API = "http://127.0.0.1:7860/sdapi/v1/txt2img"
BASE = "/Users/danielhwang/Desktop/Projects/syncfortune/app/assets/icons"
CAREER = os.path.join(BASE, "career")
os.makedirs(CAREER, exist_ok=True)

PREFIX = ("tarot card illustration, thin delicate gold line art on deep midnight navy blue background, "
          "celestial mystical, crescent moon and scattered stars, constellation dots, ornate gold filigree border, ")
NEG = ("photo, photograph, realistic, 3d, text, letters, words, numbers, watermark, signature, "
       "blurry, deformed, ugly, low quality, cluttered, frame within frame, human face closeup")

# (key, subject, width, height, dest_paths[])
ITEMS = [
    ("portrait", "vertical format, a lone figure standing at a crossroads under the moon, two diverging golden roads, one toward a bustling market of commerce and one toward a grand pillared hall",
     832, 1216, [os.path.join(BASE, "career.png"), os.path.join(CAREER, "hero.png")]),
    ("overview", "two diverging golden roads under a starry sky, a compass rose between them", 1344, 768, [os.path.join(CAREER, "overview.png")]),
    ("entrepreneur", "a single founder figure lighting a lantern, a small sapling growing into a strong tree, building alone", 1344, 768, [os.path.join(CAREER, "entrepreneur.png")]),
    ("employee", "a grand temple hall with many ordered golden columns, a steady figure within an organized structure", 1344, 768, [os.path.join(CAREER, "employee.png")]),
    ("lean", "an ornate golden balance scale weighing two small roads, one tipping slightly", 1344, 768, [os.path.join(CAREER, "lean.png")]),
    ("timing", "a golden hourglass surrounded by phases of the moon along a winding path", 1344, 768, [os.path.join(CAREER, "timing.png")]),
    ("strategy", "a golden chess knight piece standing on an unrolled map with a marked route and a small key", 1344, 768, [os.path.join(CAREER, "strategy.png")]),
]

def gen(key, subject, w, h, dests):
    payload = {
        "prompt": PREFIX + subject,
        "negative_prompt": NEG,
        "steps": 28, "cfg_scale": 6.5, "width": w, "height": h,
        "sampler_name": "DPM++ 2M Karras", "batch_size": 1,
    }
    data = json.dumps(payload).encode()
    req = urllib.request.Request(API, data=data, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=600) as r:
        res = json.load(r)
    img = base64.b64decode(res["images"][0])
    for d in dests:
        with open(d, "wb") as f:
            f.write(img)
    print(f"OK {key} ({w}x{h}) -> {', '.join(os.path.basename(d) for d in dests)} [{len(img)} bytes]", flush=True)

ok, fail = 0, 0
for key, subj, w, h, dests in ITEMS:
    for attempt in (1, 2):  # idle 모델 언로드 → 첫 호출 느림/실패 시 1회 재시도
        try:
            gen(key, subj, w, h, dests)
            ok += 1
            break
        except Exception as e:
            print(f"WARN {key} attempt{attempt}: {e}", flush=True)
            if attempt == 2:
                fail += 1
            time.sleep(3)

print(f"DONE career images: ok={ok} fail={fail}", flush=True)
