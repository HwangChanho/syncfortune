#!/usr/bin/env python3
# 재물 딥리포트(kind='wealth') 히어로 이미지 생성 (Draw Things 로컬 HTTP API, A1111 호환).
#   톤 레시피 = gen-career-images.py 동일(미드나잇 네이비 + 가는 골드 라인아트·타로풍·천체). image-asset-pipeline 재사용.
#   ★§4 안전: 부(富) 과시·gaudy 금지 → '재물 그릇(vessel)에 빛·재물이 흘러들고 뿌리가 받치는' 은유(리포트 4축 = 그릇/유입/바탕).
#   산출 = 포트레잇 히어로 1장(832×1216) → app/assets/icons/wealth.png (jobfit.jpg 처럼 히어로+카드+마켓 공용).
#   ⚠️ 텍스트·글자 금지(negative). Draw Things 실행(7860) 후 실행: python3 scripts/gen-wealth-images.py
import urllib.request, json, base64, os, time

API = "http://127.0.0.1:7860/sdapi/v1/txt2img"
BASE = "/Users/danielhwang/Desktop/Projects/syncfortune/app/assets/icons"
os.makedirs(BASE, exist_ok=True)

# career 히어로와 동일 프리픽스(시각 일관 = 딥리포트 계열 톤 통일).
PREFIX = ("tarot card illustration, thin delicate gold line art on deep midnight navy blue background, "
          "celestial mystical, crescent moon and scattered stars, constellation dots, ornate gold filigree border, ")
NEG = ("photo, photograph, realistic, 3d, text, letters, words, numbers, watermark, signature, "
       "blurry, deformed, ugly, low quality, cluttered, frame within frame, human face closeup, "
       "gaudy, garish, piles of cash, dollar signs")  # §4: 노골적 부 과시 배제

# (key, subject, width, height, dest_paths[])
# 은유: 그릇(vessel)=재물 그릇 / 위에서 흘러드는 빛·재물=유입(시기) / 아래 뿌리·새싹=바탕·통근(그릇 형성).
ITEMS = [
    ("hero",
     "vertical format, a single ornate golden vessel resting on stone at center, "
     "a gentle stream of soft golden light and coins flowing down into it from a crescent moon above, "
     "small delicate roots and a young sprout growing at its base, serene and dignified, "
     "balanced composition, the vessel large and clearly the focal subject in the foreground",
     832, 1216, [os.path.join(BASE, "wealth.png")]),
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

print(f"DONE wealth images: ok={ok} fail={fail}", flush=True)
print("→ 다음: wealth.tsx heroImage + contentSections image + market CARD 배선 (Claude가 처리) + 앱 리빌드", flush=True)
