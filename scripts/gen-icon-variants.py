#!/usr/bin/env python3
"""
앱 아이콘 **방향 후보** 생성 (daniel 2026-08-07 "디자인 너무 별론데")

■ 왜 후보를 여러 개 만드나
  1안이 별로였다. 이때 색만 바꿔 다시 내는 건 **틀린 변수를 만지는 것**이다
  (07-27 카드 이미지에서 팔레트만 바꿔 10장을 전패한 이력 — 문제는 구도·대비·의미였다).
  1안의 실제 약점은 색이 아니라:
    · 크림 배경 위 명조체 = '앱 아이콘'이 아니라 **책 페이지**처럼 보인다
    · 글자가 그냥 떠 있고 **도형/앵커가 없다** → 로고감 0
    · 니·내(브라운)와 운(골드)이 대등하게 싸워 **주인공이 없다**
    · 빈 공간이 많아 87px 에서 잔글씨처럼 보인다
  ⇒ 서로 **다른 변수**를 건드린 4안을 만들고 daniel 이 고른다.

■ 공통 제약(전 안)
  · daniel 지시 유지: 왼쪽 위아래 니·내 + 오른쪽 큰 운 · 밝은 색
  · PIL 결정론(생성모델 금지) · iOS 알파 금지(RGB) · 잉크 박스 기준 안전영역 자동 배치
  · 판정은 87px
"""
from PIL import Image, ImageDraw, ImageFont

SIZE = 1024
OUTDIR = 'app/assets/icon-variants'

MYEONGJO = ('/System/Library/AssetsV2/com_apple_MobileAsset_Font8/'
            '4c932c71d74fc9e4c1bd9cbf270374b0b3ee7519.asset/AssetData/NanumMyeongjo.ttc', 2)  # ExtraBold
GOTHIC = ('/System/Library/Fonts/AppleSDGothicNeo.ttc', 6)  # Bold


def font(spec, px):
    return ImageFont.truetype(spec[0], px, index=spec[1])


def centered(d, cx, cy, text, f, fill):
    """글자의 **실제 잉크 박스** 중심을 (cx,cy) 에 맞춘다(폰트 메트릭 기준이면 한글이 치우친다)."""
    l, t, r, b = d.textbbox((0, 0), text, font=f)
    d.text((cx - (l + r) / 2, cy - (t + b) / 2), text, font=f, fill=fill)


def vgrad(top, bottom):
    img = Image.new('RGB', (SIZE, SIZE), top)
    d = ImageDraw.Draw(img)
    for y in range(SIZE):
        k = y / (SIZE - 1)
        d.line([(0, y), (SIZE, y)], fill=tuple(round(top[i] + (bottom[i] - top[i]) * k) for i in range(3)))
    return img


def fit(bg, layer, ratio=0.82):
    """글자 레이어를 잉크 박스 기준으로 안전영역에 앉힌다(가장자리 잘림 방지)."""
    box = layer.getbbox()
    if not box:
        return bg
    art = layer.crop(box)
    safe = round(SIZE * ratio)
    k = min(safe / art.width, safe / art.height)
    art = art.resize((max(1, round(art.width * k)), max(1, round(art.height * k))), Image.LANCZOS)
    bg.paste(art, ((SIZE - art.width) // 2, (SIZE - art.height) // 2), art)
    return bg


def layer():
    l = Image.new('RGBA', (SIZE * 2, SIZE * 2), (0, 0, 0, 0))
    return l, ImageDraw.Draw(l), SIZE, SIZE


# ─────────────────────────────────────────────────────────────────────────
def variant_A():
    """A · 배지 — 골드 원 안에 크림 '운'. 도형이 앵커가 되어 '로고'로 보인다(1안의 최대 결점 보완)."""
    bg = vgrad((252, 249, 242), (243, 236, 222))
    l, d, cx, cy = layer()
    fs, fb = font(MYEONGJO, 300), font(MYEONGJO, 430)
    d.ellipse([cx + 40, cy - 330, cx + 700, cy + 330], fill=(160, 137, 72))  # 골드 원
    centered(d, cx + 370, cy, '운', fb, (252, 249, 242))
    centered(d, cx - 220, cy - 190, '니', fs, (60, 54, 44))
    centered(d, cx - 220, cy + 190, '내', fs, (60, 54, 44))
    return fit(bg, l, 0.86)


def variant_B():
    """B · 고딕 — 명조의 '책' 느낌을 없애고 굵은 산돌고딕으로. 작게 줄여도 획이 안 뭉개진다."""
    bg = vgrad((253, 250, 244), (244, 238, 226))
    l, d, cx, cy = layer()
    fs, fb = font(GOTHIC, 300), font(GOTHIC, 620)
    centered(d, cx - 300, cy - 200, '니', fs, (120, 110, 92))
    centered(d, cx - 300, cy + 200, '내', fs, (120, 110, 92))
    centered(d, cx + 200, cy, '운', fb, (146, 121, 58))
    return fit(bg, l, 0.84)


def variant_C():
    """C · 운 중심 — '운'이 압도적 주인공, 니·내는 곁다리로 아주 작게. 87px 에서 가장 또렷하다."""
    bg = vgrad((250, 246, 236), (238, 229, 209))
    l, d, cx, cy = layer()
    fs, fb = font(MYEONGJO, 210), font(MYEONGJO, 760)
    centered(d, cx - 470, cy - 250, '니', fs, (150, 138, 116))
    centered(d, cx - 470, cy + 250, '내', fs, (150, 138, 116))
    centered(d, cx + 90, cy, '운', fb, (150, 126, 62))
    return fit(bg, l, 0.88)


def variant_D():
    """D · 반전 — 밝은 골드 배경 + 크림 글자. '밝은색' 유지하면서 채도를 줘 홈 화면에서 눈에 띈다."""
    bg = vgrad((214, 179, 96), (188, 152, 72))
    l, d, cx, cy = layer()
    fs, fb = font(GOTHIC, 300), font(GOTHIC, 620)
    centered(d, cx - 300, cy - 200, '니', fs, (255, 252, 244))
    centered(d, cx - 300, cy + 200, '내', fs, (255, 252, 244))
    centered(d, cx + 200, cy, '운', fb, (255, 252, 244))
    return fit(bg, l, 0.84)


def main():
    import os
    os.makedirs(OUTDIR, exist_ok=True)
    for name, fn in [('A-badge', variant_A), ('B-gothic', variant_B),
                     ('C-focus', variant_C), ('D-gold', variant_D)]:
        img = fn()
        img.save(f'{OUTDIR}/{name}.png')
        img.resize((87, 87), Image.LANCZOS).save(f'{OUTDIR}/{name}-87.png')
        print(f'  ✓ {name}')
    # 87px 4안을 한 장에 나란히 — ★판정은 이 장으로 한다(실제 홈 화면 크기 비교)
    sheet = Image.new('RGB', (87 * 4 + 5 * 5, 87 + 10), (255, 255, 255))
    for i, name in enumerate(['A-badge', 'B-gothic', 'C-focus', 'D-gold']):
        sheet.paste(Image.open(f'{OUTDIR}/{name}-87.png'), (5 + i * 92, 5))
    sheet.resize((sheet.width * 3, sheet.height * 3), Image.NEAREST).save(f'{OUTDIR}/_compare-87.png')
    print(f'  ✓ {OUTDIR}/_compare-87.png (87px 비교 — 판정은 이걸로)')


if __name__ == '__main__':
    main()
