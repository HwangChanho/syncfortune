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
# 좌상단이 «깨끗한 종이톤 하나»인가 — 중앙값 대비 최암부의 낙폭.
# ★현행 13장 실측이 0.005~0.025 라 0.05 로 잡았다(최대치의 2배). 낙관·먹 서명 한 획이면 넘는다.
#   붉은 낙관은 색으로 거를 수 있지만 **먹으로 쓴 서명은 색으로 못 거른다** — 그래서 밝기로 잡는다.
CORNER_DROP = 0.05
# 좌측의 «세로 엣지» — 그림 안에 선 세로선이 색면과 만나 **가짜 이음매**로 읽힌다.
# ★게이트가 아니라 **순위 신호**다(현행 13장 0.002~0.065, n 이 너무 적어 합격선을 못 긋는다).
#   컷 3장 중 하나를 고를 때 낮은 쪽을 고르면 된다. 0.04 넘으면 눈으로 볼 것.
EDGE_WARN   = 0.04
TARGET_AR   = 1.60      # 비율. contain 이라 비율=높이 → 장마다 다르면 캐러셀에서 그림이 들썩인다

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
    """@return dict — 대비·최암부·색면·비율·좌상단 낙폭과 각 판정"""
    im = Image.open(path).convert('RGB'); W, H = im.size
    # ① 배너 왼쪽 색면 색 — ★이 색이 **글자 자리 전체**를 칠한다
    fb = im.crop((0, 0, int(W*FIELD_BOX), int(H*FIELD_BOX))).resize((40, 40))
    px = _px(fb)
    field = tuple(int(statistics.median([q[i] for q in px])) for i in range(3))
    # ①-b 그 구석이 **균일한가** — 낙관·서명·짙은 획이 걸리면 낙폭이 튄다.
    #     붉은 낙관은 색으로 거를 수 있어도 **먹으로 쓴 서명은 색으로 못 거른다** → 밝기로 잡는다
    Ls = [lum(q) for q in px]
    drop = statistics.median(Ls) - min(Ls)
    # ② 최암부 — ★64×46 리사이즈가 곧 «창 크기»다. 480px 폭이면 창 ≈ 7×6px
    band = im.crop((0, int(H*0.08), int(W*TEXT_ZONE), int(H*0.92))).resize((64, 46))
    dark = min(_px(band), key=lum)
    # ③-b 좌측 세로 엣지 — 열 평균밝기의 최대 급변
    eb = im.crop((0, int(H*0.08), int(W*TEXT_ZONE), int(H*0.92))).resize((58, 40))
    ep = _px(eb)
    cols = [sum(lum(ep[r*58+c]) for r in range(40))/40 for c in range(58)]
    edge = max(abs(cols[i+1]-cols[i]) for i in range(57))

    c = contrast(over(dark, JU, TINT), INK)
    return {'c': c, 'dark': '#%02X%02X%02X' % dark, 'field': '#%02X%02X%02X' % field,
            'ar': W/H, 'drop': drop, 'edge': edge, 'wh': (W, H)}

if __name__ == '__main__':
    strict = '--strict' in sys.argv          # 납품 검수(비율·목표대비까지 강제)
    bad = 0
    for p in [a for a in sys.argv[1:] if not a.startswith('--')]:
        r = check(p); why = []
        if r['c'] < HARD:                     why.append(f"대비 {r['c']:.2f} < {HARD} 하네스 탈락")
        elif strict and r['c'] < WANT:        why.append(f"대비 {r['c']:.2f} < 목표 {WANT}")
        if r['drop'] > CORNER_DROP:           why.append(f"좌상단 낙폭 {r['drop']:.3f} — 낙관·서명·짙은 획이 걸렸다")
        if strict and abs(r['ar']-TARGET_AR) > 0.04: why.append(f"비율 {r['ar']:.2f} ≠ {TARGET_AR}")
        edgemark = '  ⚠️세로엣지' if r['edge'] > EDGE_WARN else ''
        mark = '✅' if not why else '❌ ' + ' · '.join(why)
        print(f"{p.split('/')[-1]:<22} 대비 {r['c']:5.2f}  최암부 {r['dark']}  "
              f"색면 {r['field']}  낙폭 {r['drop']:.3f}  엣지 {r['edge']:.3f}{edgemark}  "
              f"{r['wh'][0]}x{r['wh'][1]}  {mark}")
        if why: bad += 1
    print(f"\n{'❌ ' + str(bad) + '장 탈락' if bad else '✅ 전량 통과'}"
          f"{' (--strict: 비율·목표대비까지 검사)' if strict else ''}")
    sys.exit(1 if bad else 0)
