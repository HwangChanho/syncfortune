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

사용: npm run check:iconcenter
"""
from PIL import Image
import statistics, glob, math, sys, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = 'app/assets/icon.png'
COPIES = ['app/assets/favicon.png',
          'app/ios/SyncFortune/Images.xcassets/AppIcon.appiconset/App-Icon-1024x1024@1x.png'] \
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
if fails:
    print(f"❌ check:iconcenter — {len(fails)}건")
    for f in fails: print(f"  {f}")
    sys.exit(1)
print(f"✅ check:iconcenter — 아이콘 {1+len([p for p in COPIES if os.path.exists(p if p.startswith('/') else os.path.join(ROOT,p))])}개가 가운데 있고 서로 같습니다")
