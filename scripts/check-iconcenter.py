#!/usr/bin/env python3
"""check:iconcenter — 앱 아이콘의 그림이 **가운데 있는지**, 사본이 원본과 **같은지** 지킨다.

왜 있나 (2026-08-25 · Boss «앱 로고 위치가 왼쪽 위로 치우쳐진거 같아»):
  실측하니 정말 치우쳐 있었다 — 여백 좌 18.0 / 우 20.3, 상 17.6 / 하 20.7.
  1024px 기준 왼쪽 13px · 위 18px 밀려 있었다. **눈이 맞았고 숫자로 확인됐다.**

  그리고 [[native-icon-copy-drift]] — 원본과 네이티브 사본이 어긋난 적이 있다.
  ⚠️`prebuild` 는 versionCode 를 1 로 되돌리므로 **파일을 직접** 고친다. 그러면 사본이
  조용히 갈릴 수 있다 — 그래서 여기서 **전부 같은 그림인지** 본다.

규칙
  C1 각 아이콘의 잉크 무게중심이 정중앙에서 **±1.2%p 안**
  C2 원본과 사본이 **같은 그림**(축소 후 픽셀 거리 6 이내 — webp 재인코딩 여유)
     ⚠️2026-08-26 — **파비콘은 예외**다. Boss 요청으로 «배경 네모 없이»(투명) + 여백을 잘라
       꽉 채웠다 ⇒ 원본과 픽셀이 **일부러** 다르다. 그래서 파비콘에는 C3 를 대신 적용한다.
  C3 (파비콘 전용) 그림이 비어 있지 않고, 잉크 색이 원본과 같은 계열인가
     ⚠️2026-08-27 — «투명이어야 한다» 는 뺐다(Boss 지시가 «파란 배경 + 흰 운» 으로 뒤집혔다)
     ★«같은 그림인가» 대신 «같은 브랜드에서 나온 것인가» 를 본다. 아무 그림이나 넣는 것은 여전히 막는다.

사용: npm run check:iconcenter
"""
from PIL import Image
import statistics, glob, math, sys, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = 'app/assets/icon.png'
# ★파비콘은 «같은 그림» 검사에서 뺀다 — 아래 C3 로 따로 본다(투명 배경이 정답이라 픽셀이 다르다)
FAVICON = 'app/assets/favicon.png'
COPIES = ['app/ios/SyncFortune/Images.xcassets/AppIcon.appiconset/App-Icon-1024x1024@1x.png'] \
         + sorted(glob.glob(os.path.join(ROOT, 'app/android/app/src/main/res/mipmap-*/ic_launcher.webp')))
MAX_OFF, MAX_DIFF = 1.2, 6.0   # 거리 6 = webp 재인코딩·축소 여유(같은 크기에서 잰다)

def _px(im):
    return list(im.get_flattened_data()) if hasattr(im, 'get_flattened_data') else list(im.getdata())

def load(p, s=192):
    im = Image.open(os.path.join(ROOT, p) if not p.startswith('/') else p).convert('RGBA')
    return im.resize((s, s), Image.LANCZOS)

def offset(sm, s=192):
    """잉크 무게중심이 정중앙에서 얼마나 벗어났나(%p)."""
    px = sm.load()
    cs = [px[2, 2], px[2, s-3], px[s-3, 2], px[s-3, s-3]]
    bg = [statistics.median([c[i] for c in cs]) for i in range(3)]
    tr = all(c[3] < 10 for c in cs)
    xs, ys = [], []
    for y in range(s):
        for x in range(s):
            r, g, b, a = px[x, y]
            if (a > 10) if tr else (a > 10 and abs(r-bg[0]) + abs(g-bg[1]) + abs(b-bg[2]) > 40):
                xs.append(x); ys.append(y)
    if not xs: return 0.0, 0.0
    return sum(xs)/len(xs)/s*100 - 50, sum(ys)/len(ys)/s*100 - 50

def diff(src_path, copy_path):
    """★사본의 **원래 크기**로 맞춰 비교한다.
    48px 아이콘을 192 로 늘려 원본과 대면 «확대 흐림»이 차이로 잡힌다(실측 8.9) —
    그건 그림이 다른 게 아니라 내가 잘못 잰 것이다."""
    b = Image.open(copy_path).convert('RGB')
    n = min(b.size)
    a = Image.open(src_path).convert('RGB').resize((n, n), Image.LANCZOS)
    b = b.resize((n, n), Image.LANCZOS)
    pa, pb = _px(a), _px(b)
    return sum(math.dist(x, y) for x, y in zip(pa, pb)) / len(pa)

fails = []
base = load(SRC)
dx, dy = offset(base)
if abs(dx) > MAX_OFF or abs(dy) > MAX_OFF:
    fails.append(f"[C1] {SRC} 가 가운데에서 벗어났다 — 가로 {dx:+.1f}%p · 세로 {dy:+.1f}%p (한계 ±{MAX_OFF})")
for p in COPIES:
    rel = p.replace(ROOT + '/', '')
    if not os.path.exists(p if p.startswith('/') else os.path.join(ROOT, p)): continue
    sm = load(p)
    ox, oy = offset(sm)
    if abs(ox) > MAX_OFF or abs(oy) > MAX_OFF:
        fails.append(f"[C1] {rel} 가 가운데에서 벗어났다 — 가로 {ox:+.1f}%p · 세로 {oy:+.1f}%p")
    d = diff(os.path.join(ROOT, SRC), p if p.startswith('/') else os.path.join(ROOT, p))
    if d > MAX_DIFF:
        fails.append(f"[C2] {rel} 가 원본과 **다른 그림**이다(픽셀 거리 {d:.1f} > {MAX_DIFF}) — 원본만 고치고 사본을 안 옮겼나?")
# ── C3 파비콘 — «배경이 투명한가 · 잉크가 같은 브랜드 색인가» ──────────────────
#   Boss 2026-08-26 *"앱스토어처럼 우리 로고도 네모칸이 없게 뜨면 좋겠어"*
#   ⇒ 배경을 지우고 여백을 잘라 꽉 채웠다. 원본과 픽셀이 다른 게 **정답**이다.
#   그래도 «아무 그림» 은 막아야 하므로, **불투명 부분의 평균 색**이 원본의 잉크색과 가까운지 본다.
_fav = os.path.join(ROOT, FAVICON)
if os.path.exists(_fav):
    fv = Image.open(_fav).convert('RGBA')
    a = fv.getchannel('A')
    opaque = sum(1 for v in a.getdata() if v > 200) / (fv.width * fv.height)
    # ⚠️★2026-08-27 — «투명이어야 한다» 를 **뺐다.** Boss 지시가 뒤집혔기 때문이다.
    #   08-26: *"배경 네모 없이"* → 그때 로고는 **투명 배경 + 갈색 획**이라 그게 맞았다.
    #   08-27: *"로고를 파란배경에 흰색 운"* → 흰 획은 **밝은 탭 배경에서 안 보인다.**
    #     실제로 색만 바꿨더니 파비콘이 불투명 23%(획만)로 남아 탭에서 사라졌다.
    #   ⇒ 지금은 **배경이 있어야 맞다.** 대신 아래 «잉크 색이 원본과 같은가» 는 그대로 지킨다
    #     ([[harness-can-enforce-wrong-rule]] — 외부 판정이 뒤집히면 **코드보다 하네스를 먼저**).
    #   ★그래도 «완전히 비어 있는»(획이 없는) 파비콘은 잡는다 — 그건 사고다.
    if opaque < 0.02:
        fails.append(f"[C3] {FAVICON} 그림이 **거의 비어 있다**(불투명 {opaque*100:.0f}%) — 탭에 아무것도 안 보인다")
    # ★배경색은 **원본에서 잰다**(2026-08-27).
    #   종전엔 «밝은 크림»(>235,230,225)을 배경으로 **박아** 뒀다. 그래서 로고를
    #   파란 배경 + 흰 획으로 바꾸자 파랑이 잉크로 섞여 «다른 그림» 이라고 울었다 —
    #   **코드는 옳은데 빨간불**([[harness-can-enforce-wrong-rule]]).
    #   ⇒ 원본 모서리를 배경으로 보고 그것과 가까운 화소를 뺀다. 로고를 또 바꿔도 따라온다.
    _src_im = Image.open(os.path.join(ROOT, SRC)).convert('RGBA')
    _bg = _src_im.getpixel((2, 2))[:3]

    # 잉크 평균색 — 원본에서 «배경이 아닌» 화소들의 평균과 견준다
    def ink(im):
        px = [p for p in im.convert('RGBA').getdata() if p[3] > 200]
        # 배경은 뺀다 — 잉크만 남긴다(거리 60 안쪽이면 배경으로 본다)
        px = [p for p in px if math.dist(p[:3], _bg) > 60]
        if not px: return None
        n = len(px)
        return (sum(p[0] for p in px)/n, sum(p[1] for p in px)/n, sum(p[2] for p in px)/n)
    a_ink, b_ink = ink(_src_im), ink(fv)
    if a_ink and b_ink:
        d = math.dist(a_ink, b_ink)
        if d > 40:
            fails.append(f"[C3] {FAVICON} 잉크 색이 원본과 다르다(거리 {d:.0f} > 40) — 다른 그림을 넣었나?")

if fails:
    print(f"❌ check:iconcenter — {len(fails)}건")
    for f in fails: print(f"  {f}")
    sys.exit(1)
print(f"✅ check:iconcenter — 아이콘 {1+len([p for p in COPIES if os.path.exists(p if p.startswith('/') else os.path.join(ROOT,p))])}개가 가운데 있고 서로 같습니다")
