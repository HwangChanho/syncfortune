#!/usr/bin/env python3
# 궁합 등급별 이미지 6종 (Draw Things 로컬, A1111 호환). 미드나잇 네이비 + 골드 라인아트(타로풍).
#   등급 = compatScore.ts COMPAT_TIERS 의 key. 832×1216 세로 카드.
#   ⚠️ 텍스트·글자 금지(negative). 실패해도 항목별 건너뛰고 계속.
import urllib.request, json, base64, os, time

API = "http://127.0.0.1:7860/sdapi/v1/txt2img"
DEST = "/Users/danielhwang/Desktop/Projects/syncfortune/app/assets/icons/compat"
os.makedirs(DEST, exist_ok=True)

PREFIX = ("tarot card illustration, thin delicate gold line art on deep midnight navy blue background, "
          "celestial mystical, crescent moon and scattered stars, constellation dots, ornate gold filigree border, "
          "two figures, romantic relationship symbolism, ")
NEG = ("photo, photograph, realistic, 3d, text, letters, words, numbers, watermark, signature, "
       "blurry, deformed, ugly, low quality, cluttered, frame within frame, explicit")

ITEMS = [
    ("soulmate", "two intertwined figures merging under a full moon, two souls as one shared flame, hearts entwined with golden thread, profound harmony"),
    ("great",    "two figures dancing in graceful harmony, glowing golden threads connecting their hands, joyful radiant union"),
    ("good",     "two figures standing side by side holding hands, gentle warm light between them, balanced and content"),
    ("steady",   "two figures building a golden bridge toward each other, two hands reaching across a small gap, steady patient effort"),
    ("spark",    "two figures facing each other with crackling electric tension, fire and contrast between them, dynamic sparks and challenge"),
    ("opposite", "two figures back to back, one sun and one moon, yin and yang balance, opposites that complete each other"),
]

def gen(key, subject):
    payload = {"prompt": PREFIX + subject, "negative_prompt": NEG,
               "steps": 28, "cfg_scale": 6.5, "width": 832, "height": 1216,
               "sampler_name": "DPM++ 2M Karras", "batch_size": 1}
    req = urllib.request.Request(API, data=json.dumps(payload).encode(), headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=600) as r:
        res = json.load(r)
    img = base64.b64decode(res["images"][0])
    with open(os.path.join(DEST, f"{key}.png"), "wb") as f:
        f.write(img)
    print(f"OK {key} [{len(img)} bytes]", flush=True)

ok = fail = 0
for key, subj in ITEMS:
    if os.path.exists(os.path.join(DEST, f"{key}.png")):
        print(f"SKIP {key} (exists)", flush=True); ok += 1; continue
    for attempt in (1, 2):
        try:
            gen(key, subj); ok += 1; break
        except Exception as e:
            print(f"WARN {key} attempt{attempt}: {e}", flush=True)
            if attempt == 2: fail += 1
            time.sleep(3)
print(f"DONE compat images: ok={ok} fail={fail}", flush=True)
