#!/usr/bin/env python3
# daniel ⑥(2026-06-28) — TPR(태어난 시 찾기)·나라(내가 살기 좋은 곳)·선비 전용 이미지 재추출.
#   톤 레시피: 미드나잇 네이비 + 가는 골드 라인아트(타로풍, 천체·달·별·필리그리). image-asset-pipeline 재사용.
#   타일=세로 832×1216(홈 카드/배경), 히어로=가로 1344×768(콘텐츠 상단). 텍스트·글자 금지(negative).
#   PNG 로 저장 → 별도 sips 단계로 .jpg 변환(용량↓). idle 모델 언로드 대비 항목별 1회 재시도.
import urllib.request, json, base64, os, time

API = "http://127.0.0.1:7860/sdapi/v1/txt2img"
BASE = "/Users/danielhwang/Desktop/Projects/syncfortune/app/assets/icons"
os.makedirs(BASE, exist_ok=True)

PREFIX = ("tarot card illustration, thin delicate gold line art on deep midnight navy blue background, "
          "celestial mystical, crescent moon and scattered stars, constellation dots, ornate gold filigree, ")
NEG = ("photo, photograph, realistic, 3d, text, letters, words, numbers, watermark, signature, "
       "blurry, deformed, ugly, low quality, cluttered, frame within frame, human face closeup")

# (key, subject, width, height, out_png)
ITEMS = [
    ("timeResolve",  # TPR 홈/마켓 카드 타일(세로)
     "vertical format, a seated Korean scholar in a hat gazing up at a great celestial clock ring of twelve hour-houses, "
     "an ornate golden hourglass beside him, phases of the moon circling, faint golden threads tracing one hidden hour",
     832, 1216, "timeResolve.png"),
    ("timeResolve-hero",  # TPR 화면 히어로(가로)
     "a wide night sky with a ring of twelve golden zodiacal hour-houses encircling a crescent moon, "
     "a golden hourglass and a compass rose below, soft drifting mist, a single faint highlighted hour segment",
     1344, 768, "timeResolve-hero.png"),
    ("country",  # 나라 '내가 살기 좋은 곳' 세로 배경
     "vertical format, a serene auspicious landscape of rolling layered mountains, a calm winding river and a small peaceful "
     "village under a benevolent full moon, a faint golden world map and compass overlaid softly in the starry sky, harmony and belonging",
     832, 1216, "country.png"),
    ("seonbi",  # 선비 전용 타일(세로) — 산수화풍 밤 능선
     "vertical format, a lone Korean scholar seonbi in a wide-brimmed gat hat and flowing robe with a staff, walking a winding "
     "mountain ridge path at night, layered ink-wash peaks and drifting mist, a full moon and scattered stars, contemplative and elegant",
     832, 1216, "seonbi.png"),
]

def gen(key, subject, w, h, out_png):
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
    dest = os.path.join(BASE, out_png)
    with open(dest, "wb") as f:
        f.write(img)
    print(f"OK {key} ({w}x{h}) -> {out_png} [{len(img)} bytes]", flush=True)

ok, fail = 0, 0
for key, subj, w, h, out in ITEMS:
    for attempt in (1, 2):  # idle 모델 언로드 → 첫 호출 느림/실패 시 1회 재시도
        try:
            gen(key, subj, w, h, out); ok += 1; break
        except Exception as e:
            print(f"WARN {key} attempt{attempt}: {e}", flush=True)
            if attempt == 2: fail += 1
            time.sleep(3)

print(f"DONE content images 0628: ok={ok} fail={fail}", flush=True)
