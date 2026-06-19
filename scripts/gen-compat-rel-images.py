#!/usr/bin/env python3
# 궁합 관계 유형별 이미지 8종 (Draw Things 로컬). 미드나잇 네이비 + 골드 라인아트(타로풍).
#   key = COMPAT_RELS. 가로 배너(1344×768, CompatScreen 관계 배너).
#   ⚠️ 텍스트·글자 금지. 실패해도 항목별 건너뛰고 계속.
import urllib.request, json, base64, os, time

API = "http://127.0.0.1:7860/sdapi/v1/txt2img"
DEST = "/Users/danielhwang/Desktop/Projects/syncfortune/app/assets/icons/compat-rel"
os.makedirs(DEST, exist_ok=True)

PREFIX = ("tarot card illustration, thin delicate gold line art on deep midnight navy blue background, "
          "celestial mystical, crescent moon and scattered stars, ornate gold filigree, two figures, ")
NEG = ("photo, photograph, realistic, 3d, text, letters, words, numbers, watermark, signature, "
       "blurry, deformed, ugly, low quality, cluttered, frame within frame, explicit")

ITEMS = [
    ("friend",   "two friends laughing together side by side, casual warm companionship, shared joy"),
    ("family",   "a family bound together in a circle, generations and a warm hearth, kinship and care"),
    ("love",     "two lovers under the moon in a tender romantic embrace, glowing hearts and golden thread"),
    ("marriage", "a couple at a wedding union, two interlocked rings, building a home together"),
    ("coworker", "two colleagues collaborating at a shared desk, balanced teamwork and gears turning"),
    ("senior",   "a mentor extending a guiding hand to a junior, respect and hierarchy, a golden staff"),
    ("staff",    "a leader guiding a team member up a golden ladder, motivation and direction"),
    ("business", "two partners clasping hands over a shared venture, a balance scale and golden coins"),
]

def gen(key, subject):
    payload = {"prompt": PREFIX + subject, "negative_prompt": NEG,
               "steps": 28, "cfg_scale": 6.5, "width": 1344, "height": 768,
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
print(f"DONE compat-rel images: ok={ok} fail={fail}", flush=True)
