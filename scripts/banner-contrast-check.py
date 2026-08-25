#!/usr/bin/env python3
"""배너 일러스트 한 장이 **우리 하네스를 통과할지** 미리 재는 계측기.

★이 파일은 `scripts/measure-bannerart.py` + `scripts/check-bannerart.ts` 의 B4 를
  **한 파일로 합친 것**이다. 외부(이미지 작업 쪽)에 넘겨서 «같은 자»로 재게 하려고 만들었다.
  ⚠️두 원본이 바뀌면 여기도 같이 바꿔야 한다 — `check:bannerart` 가 정본이다.

왜 필요한가 — 2026-08-25:
  이미지 쪽이 «12px 창 평균»으로 재서 4.86 을 통과로 봤는데, 우리 하네스는
  **64×46 리사이즈 후 최암부**로 잰다. 창 크기가 다르면 숫자가 1.6 까지 벌어진다
  (같은 그림이 픽셀단위 3.27 ↔ 12px창 4.86). 자가 다르면 통과·탈락이 갈린다.

사용: python3 scripts/banner-contrast-check.py <이미지…>
"""
from PIL import Image
import statistics, sys

# ── 하네스가 쓰는 값 (check-bannerart.ts / measure-bannerart.py 와 일치해야 한다) ──
TEXT_ZONE = 0.58     # 글자 자리 = 그림의 좌측 58%
FIELD_BOX = 0.35     # 배너 왼쪽 색면이 될 색 = 좌상단 35%×35% 의 중앙값
TINT      = 0.22     # BANNER_TINT
# 다섯 오행 중 **가장 빡빡한** 조합(水). 이걸 넘기면 나머지 넷은 자동으로 넘는다.
JU, INK   = (0x39, 0x60, 0x9D), (0x1B, 0x2E, 0x3F)
HARD, WANT = 4.5, 5.5   # 하네스 하한 / 납품 목표

def lum(c):
    f = lambda v: (v/255)/12.92 if v/255 <= 0.03928 else (((v/255)+0.055)/1.055) ** 2.4
    return 0.2126*f(c[0]) + 0.7152*f(c[1]) + 0.0722*f(c[2])

def contrast(a, b):
    x, y = sorted([lum(a), lum(b)], reverse=True)
    return (x+0.05)/(y+0.05)

def over(base, veil, a):
    return tuple(round(base[i]*(1-a) + veil[i]*a) for i in range(3))

def _px(im):
    """Pillow 14 에서 getdata() 가 사라진다 — 원본 measure-bannerart.py 와 같은 방식으로 갈라 쓴다."""
    return list(im.get_flattened_data()) if hasattr(im, 'get_flattened_data') else list(im.getdata())

def check(path):
    """@return (통과여부, 대비, 최암부hex, 색면hex, 비율)"""
    im = Image.open(path).convert('RGB'); W, H = im.size
    # ① 배너 왼쪽 색면 색 — ★이 색이 **글자 자리 전체**를 칠한다
    fb = im.crop((0, 0, int(W*FIELD_BOX), int(H*FIELD_BOX))).resize((40, 40))
    px = _px(fb)
    field = tuple(int(statistics.median([q[i] for q in px])) for i in range(3))
    # ② 최암부 — ★64×46 리사이즈가 곧 «창 크기»다. 480px 폭이면 창 ≈ 7×6px
    band = im.crop((0, int(H*0.08), int(W*TEXT_ZONE), int(H*0.92))).resize((64, 46))
    dark = min(_px(band), key=lum)
    c = contrast(over(dark, JU, TINT), INK)
    return c >= HARD, c, '#%02X%02X%02X' % dark, '#%02X%02X%02X' % field, W/H

if __name__ == '__main__':
    bad = 0
    for p in sys.argv[1:]:
        ok, c, dk, fd, ar = check(p)
        mark = '✅' if c >= WANT else ('⚠️ 하한만 통과' if ok else '❌ 탈락')
        ratio = '' if abs(ar-1.6) < 0.04 else f'  ⚠️비율 {ar:.2f}(목표 1.60)'
        print(f'{p.split("/")[-1]:<22} 대비 {c:5.2f}  최암부 {dk}  색면 {fd}  {mark}{ratio}')
        if not ok: bad += 1
    sys.exit(1 if bad else 0)
