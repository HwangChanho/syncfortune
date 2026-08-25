#!/usr/bin/env python3
"""배너 그림(bn-*.jpg)을 열어 **바탕색·글자영역 최암부·해시**를 잰다.

왜 파이썬인가: Node 쪽에 이미지 디코더가 없다(sharp 미설치). 이 스크립트는 개발자가
그림을 바꿨을 때만 돌리는 **재측정 도구**고, 검증 자체는 `check:bannerart`(tsx)가 한다 —
그래서 CI/preflight 는 파이썬에 의존하지 않는다.

사용: npm run measure:bannerart
"""
from PIL import Image
import hashlib, json, statistics, sys, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# ★폴더를 하드코딩하지 않는다 — brandAsset.ts 의 BRAND_DIR 을 따라간다
import re
_src = open(os.path.join(ROOT, 'app/src/lib/ui/brandAsset.ts'), encoding='utf-8').read()
_dir = (re.search(r"BRAND_DIR\s*=\s*'([^']+)'", _src) or [None, 'brand'])[1]
BRAND = os.path.join(ROOT, 'app/assets', _dir)
OUT = os.path.join(ROOT, 'scripts/data/banner-art-measured.json')
TEXT_ZONE = 0.58          # PromoBanner 의 TEXT_ZONE 과 같아야 한다

def lum(c):
    f = lambda v: (v/255)/12.92 if v/255 <= 0.03928 else (((v/255)+0.055)/1.055) ** 2.4
    return 0.2126*f(c[0]) + 0.7152*f(c[1]) + 0.0722*f(c[2])

def pixels(im):
    return list(im.get_flattened_data()) if hasattr(im, 'get_flattened_data') else list(im.getdata())

def measure(name):
    p = os.path.join(BRAND, f'bn-{name}.jpg')
    raw = open(p, 'rb').read()
    im = Image.open(p).convert('RGB'); W, H = im.size
    fb = im.crop((0, 0, int(W*0.35), int(H*0.35))).resize((40, 40))
    px = pixels(fb)
    field = tuple(int(statistics.median([q[i] for q in px])) for i in range(3))
    # ★그 구석이 **균일한가**. 낙관·먹 서명이 걸리면 낙폭이 튄다.
    #   왜 따로 재나 — 아래 `darkest` 밴드는 y 8~92% 만 본다. 그런데 `field` 는 y 0~35% 다.
    #   ⇒ **맨 위 8% 에 있는 서명은 대비 검사를 그대로 빠져나가면서** 색면만 어둡게 만든다
    #     (실측: 위 8% 에 먹 서명을 넣은 그림이 대비 7.75 로 통과, 낙폭 0.718 로만 잡혔다).
    Ls = [lum(q) for q in px]
    corner_drop = round(statistics.median(Ls) - min(Ls), 4)
    band = im.crop((0, int(H*0.08), int(W*TEXT_ZONE), int(H*0.92))).resize((64, 46))
    dark = min(pixels(band), key=lum)
    return {'sha256': hashlib.sha256(raw).hexdigest()[:16],
            'field': '#%02X%02X%02X' % field,
            'darkest': '#%02X%02X%02X' % dark,
            'cornerDrop': corner_drop}

names = sorted(f[3:-4] for f in os.listdir(BRAND) if f.startswith('bn-') and f.endswith('.jpg'))
arts = {n: measure(n) for n in names}
json.dump({'_설명': 'bn-*.jpg 를 실제로 열어 잰 값. check:bannerart 가 이 값으로 대비를 계산한다.',
           '_재측정': 'npm run measure:bannerart (그림을 바꾸면 sha256 이 어긋나 하네스가 실패한다)',
           '_글자자리': f'좌측 {int(TEXT_ZONE*100)}% = PromoBanner TEXT_ZONE',
           'arts': arts}, open(OUT, 'w'), ensure_ascii=False, indent=1)
print(f'✅ {len(arts)}장 재측정 → scripts/data/banner-art-measured.json')
