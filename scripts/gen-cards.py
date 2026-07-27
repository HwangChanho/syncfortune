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
  # ── w2 — 나머지 세로 타일 41종 ────────────────────────────────────────────
  #   설계 원칙(R4): 그 콘텐츠를 한 단어로 줄였을 때 떠오르는 **물건/장면 하나**.
  #   ★사람이 필요하면 실루엣(얼굴 금지) · 개수 세는 소재 회피(R6) · 글자 나오는 소재 금지(R5).
  #   ★색을 항목마다 명시해 65종이 한 가족으로 보이게 한다(인디고/틸/감/자주/청록 계열 + 금선).
  "w2": {
    "astrology":   "one large circular zodiac wheel disc with a ring of constellation marks, deep indigo disc with gold ring on cream",
    "bok":         "one plump traditional Korean silk fortune pouch with a drawstring, deep persimmon pouch with gold cord on cream",
    "career":      "one tall wooden ladder leaning and rising upward, deep teal ladder with gold rungs on cream",
    "celeb":       "one human silhouette standing under a single bright spotlight beam, deep indigo silhouette, gold light beam, cream background",
    "country":     "one large globe on a stand, continents in flat shapes, deep teal globe with gold meridian on cream",
    "crush":       "one human silhouette with a single red thread reaching out from the chest toward the edge, deep indigo silhouette on cream",
    "dayPillar":   "one round jade medallion with a simple engraved pattern, deep jade green medallion with gold rim on cream",
    "dream":       "one softly glowing doorway standing among round clouds, deep indigo clouds with gold doorway on cream",
    "egen":        "one human silhouette split down the middle into two contrasting colors, deep indigo and warm persimmon halves on cream",
    "followup":    "one large rounded speech bubble with a small gold spark inside, deep indigo bubble on cream",
    "future10":    "one long straight road receding toward a distant glowing gate, deep teal road with gold gate on cream",
    "gaeun":       "one ornate old key lying diagonally, deep indigo key with gold bow on cream",
    "gem":         "one large faceted gemstone, clean geometric facets, deep sapphire blue stone with gold outline on cream",
    "healing":     "one warm teacup with gentle steam curling upward, deep teal cup with gold steam lines on cream",
    "image":       "one human silhouette above its own reflection in still water, deep indigo silhouette on cream",
    "impression":  "one human silhouette standing in a beam of light through a narrow opening, deep indigo silhouette, gold light on cream",
    "job":         "one open door with bright light spilling through it, deep teal door with gold light on cream",
    "joseonjob":   "one silhouette wearing a traditional Korean wide-brimmed hat, no facial features, deep indigo silhouette on cream",
    "lifegraph":   "one continuous mountain ridge line rising and falling across, deep indigo ridge with a gold peak marker on cream",
    "lovestyle":   "one round paper lantern with a heart cut-out glowing inside, deep crimson lantern with gold glow on cream",
    "luck":        "one large four-leaf clover, deep jade green clover with gold veins on cream",
    "mbti":        "one human silhouette standing where a path forks into two, deep indigo silhouette and teal paths on cream",
    "mission":     "one archery target with a single arrow in the center, deep persimmon target with gold arrow on cream",
    "month":       "one large full moon with a few small clouds beneath, deep indigo moon with gold rim on cream",
    "name":        "one carved stone seal stamp standing upright, deep persimmon seal with gold top on cream",
    "newyear":     "one large sky lantern rising with a warm glow, deep persimmon lantern with gold light on cream",
    "numerology":  "one traditional wooden abacus with round beads, deep teal frame with gold beads on cream",
    "pastlife":    "one still water surface reflecting a different silhouette than the one above it, deep indigo on cream",
    "pet":         "one sitting cat silhouette seen from the side, deep indigo silhouette with a gold collar on cream",
    "relationPattern": "several thin threads converging into one central knot, deep indigo threads with a gold knot on cream",
    "reunion":     "one red thread that was cut and is now rejoined with a knot at the break, deep crimson thread on cream",
    "roots":       "one large tree with its deep root system spreading below, deep indigo roots with gold tips on cream",
    "selfAnalysis": "one large magnifying glass held upright over a small star, deep teal handle with gold lens rim on cream",
    "sokgunghap":  "one red silk ribbon tied around two joined rings, deep crimson ribbon with gold rings on cream, tasteful and restrained",
    "taegil":      "one elegant hourglass with sand falling, deep indigo frame with gold sand on cream",
    "talent":      "one bare branch with a single gold blossom opening at its tip, deep indigo branch on cream",
    "taro-health": "one single tarot card standing upright with a green leaf motif on its back, deep jade card with gold edges on cream",
    "taro-money":  "one single tarot card standing upright with a gold coin motif on its back, deep indigo card with gold edges on cream",
    "taro-work":   "one single tarot card standing upright with a compass motif on its back, deep teal card with gold edges on cream",
    "timeResolve": "one round pocket watch with its lid open, deep indigo watch with gold hands on cream",
    "zodiac":      "one round medallion with a single animal profile carved in it, deep persimmon medallion with gold rim on cream",
  },
  # ── w1x — 웨이브1 리롤(daniel 12종 검수 결과: 실패 2·약함 3) ──────────────
  #   실제 카드 크기 판정에서 걸린 것만 소재를 바꿔 다시 뽑는다. 통과 7종은 **건드리지 않는다**.
  "w1x": {
    # ❌자식운: '새싹'을 시켰는데 **아이가 화분 안에 앉은** 기괴한 그림이 나왔다 → 사람 금지 + 소재를 어린나무로
    "child":   ("one young tree seedling with a few broad leaves growing from a round ceramic pot, "
                "one tiny gold star above it, deep jade green leaves on cream",
                "person, people, child, kid, baby, human, face, doll"),
    # ❌자미두수: 만다라 장식으로 흘러 '성반'이 안 읽힘 → 큰 별 하나 + 궤도 링으로 단순화
    "ziwei":   ("one large eight-pointed star with two thin orbit rings circling around it, "
                "deep indigo star with gold rings on cream, clean and simple",
                "mandala, flower, floral, kaleidoscope, ornament"),
    # ⚠️사주: 큰 얼굴이 떠 있고 실루엣은 하단으로 내려가 라벨에 먹힘 → **실루엣 하나 안에 별하늘**로 통합
    "premium": ("one head-and-shoulders silhouette filled with a starry night sky inside it, "
                "no facial features at all, deep indigo silhouette with small gold stars, cream background",
                "face, facial features, eyes, nose, mouth, portrait, two figures, floating head"),
    # ⚠️애정: 붉은 천 추상으로 흘러 '인연'이 안 읽힘 → 하나의 붉은 끈이 **하트 매듭**으로 묶인 형태
    "love":    ("one single red cord tied into one heart-shaped knot, "
                "the cord ends trailing down, deep crimson cord on cream, clean and simple",
                "fabric, cloth, drapery, ribbon banner, abstract swirl"),
    # ⚠️만세력: 반원 추상 → 절기의 순환을 **사계절로 나뉜 나무 한 그루**로(시간의 이치)
    "manse":   ("one single tree whose round canopy is divided into four seasonal quarters — "
                "blossoms, green leaves, autumn leaves, bare branches, deep indigo trunk with gold division lines on cream",
                "four separate trees, grid, panels, mandala"),
  },
  # ── w1y — 2차 리롤(w1x 에서도 실패한 2종) ─────────────────────────────────
  "w1y": {
    # ⚠️사주: 얼굴 금지 네거티브를 **두 번** 뚫었다 → 사람 소재를 아예 버린다.
    #   사주=四柱(네 기둥)의 '기둥'을 쓰되 개수를 세지 않게 **하나의 큰 기둥**으로(R6).
    "premium": ("one tall carved stone pillar standing upright, small gold stars orbiting near its top, "
                "deep indigo pillar on cream, clean and monumental",
                "person, people, human, figure, silhouette, face, portrait, head, body"),
    # ❌만세력: 사계절 분할이 안 되고 그냥 나무 → roots(뿌리)와 소재 충돌. 시간 계산 도구인 **해시계**로.
    "manse":   ("one round sundial disc with a triangular gnomon casting a shadow across it, "
                "deep indigo dial with gold gnomon and hour lines on cream",
                "tree, plant, leaves, clock face, numbers, mandala"),
  },
  # w1r — 웨이브1 잔여분(중단 재개용). w1 과 **같은 문구**를 쓴다(가족 일관성).
  "w1r": {
    "taro":      "a fan of blank playing cards spread in an arc, backs facing viewer, "
                 "deep indigo card backs with gold edges on cream",
    "manse":     "one large circular disc split into a sun half and a moon half, "
                 "deep indigo and gold on cream, clean geometric",
    "persona":   "a single human silhouette seen from behind facing a tall oval mirror, "
                 "deep indigo silhouette, gold mirror rim, cream background",
  },
}

W, H = 832, 1216
CROP = 0.05   # R7 — 가장자리 5% 잘라 액자 제거


def gen(name: str, spec) -> None:
    """
    한 장 생성 → 가장자리 크롭 → `_pilot/<name>.png`. 구도 → 피사체 → 톤 순서 고정(07-19 교훈 ⓒ).
    @param spec 문자열(피사체) 또는 (피사체, 추가네거티브) 튜플.
      ★추가 네거티브를 **항목별**로 두는 이유: 전역 NEG 에 넣으면 이미 통과한 7종까지 흔들려 회귀한다.
        예) 자식운은 '아이가 화분 안에 앉는' 드리프트가 났으므로 그 항목에만 사람 금지를 건다.
    """
    subject, extra = (spec if isinstance(spec, tuple) else (spec, ""))
    payload = {
        "prompt": f"{COMP}{subject}, {TONE}",
        "negative_prompt": NEG + (", " + extra if extra else ""),
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
