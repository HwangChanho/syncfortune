#!/usr/bin/env python3
# O '나만의 힐링 방법' 이미지 생성 (Draw Things 로컬 HTTP API, A1111 호환).
#   톤 레시피: 미드나잇 네이비 + 가는 골드 라인아트(타로풍, 천체·달·별·필리그리). image-asset-pipeline 재사용.
#   타일 1장(832×1216) = 홈 카드(healing.png) / 오행 히어로 5장(832×1216) = healing.tsx 히어로(일간 오행별).
#   ⚠️ 텍스트·글자 금지(negative). 실패해도 항목별로 건너뛰고 계속.
import urllib.request, json, base64, os, time

API = "http://127.0.0.1:7860/sdapi/v1/txt2img"
BASE = "/Users/danielhwang/Desktop/Projects/syncfortune/app/assets/icons"
HEAL = os.path.join(BASE, "healing")
os.makedirs(HEAL, exist_ok=True)

PREFIX = ("tarot card illustration, thin delicate gold line art on deep midnight navy blue background, "
          "celestial mystical, crescent moon and scattered stars, constellation dots, ornate gold filigree border, "
          "serene peaceful calming mood, ")
NEG = ("photo, photograph, realistic, 3d, text, letters, words, numbers, watermark, signature, "
       "blurry, deformed, ugly, low quality, cluttered, frame within frame, human face closeup")

# (key, subject, width, height, dest_paths[]) — 전부 세로 타일(832×1216)
ITEMS = [
    ("tile", "vertical format, a serene resting figure under a crescent moon, soft glowing aura, lotus blossoms and gentle light, peaceful meditation and self-care",
     832, 1216, [os.path.join(BASE, "healing.png")]),
    ("wood", "vertical format, a peaceful figure resting beneath a flourishing golden tree, leaves and climbing vines, quiet forest serenity, green calm",
     832, 1216, [os.path.join(HEAL, "wood.png")]),
    ("fire", "vertical format, a warm figure beside a gentle glowing hearth, soft candlelight and radiant warmth, calm restful glow",
     832, 1216, [os.path.join(HEAL, "fire.png")]),
    ("earth", "vertical format, a grounded figure resting on stable earth before a cozy home and distant mountains, steady grounded calm",
     832, 1216, [os.path.join(HEAL, "earth.png")]),
    ("metal", "vertical format, a serene figure in a clean minimal moonlit space, ordered crystals and clear lines, white and gold clarity, tidy stillness",
     832, 1216, [os.path.join(HEAL, "metal.png")]),
    ("water", "vertical format, a tranquil figure resting by calm reflective water under the moon, gentle ripples, deep blue stillness and quiet",
     832, 1216, [os.path.join(HEAL, "water.png")]),
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

print(f"DONE healing images: ok={ok} fail={fail}", flush=True)
