#!/usr/bin/env python3
"""
앱 아이콘 생성 — '니운내운' 조합형 (daniel 2026-08-07)

■ daniel 지시
  "운 하나로 두고 왼쪽 위아래로 니 / 내 쓰고 오른쪽에 운 조금 크게" · "색상은 밝은색으로"
  ⇒ 왼쪽 세로 두 글자(니·내)가 오른쪽 큰 '운' 하나를 공유해 **니운 / 내운** 두 낱말이 동시에 읽힌다.
     브랜드 이름의 구조(니운+내운)를 글자 배치 자체로 보여 주는 게 이 아이콘의 뜻이다.

■ 왜 확산모델이 아니라 PIL 인가 (08-01 개명 때 확정한 방식)
  아이콘은 **글자가 정확해야** 한다. 생성모델은 한글을 매번 다르게 뭉갠다(획이 붙거나 없는 글자가 된다).
  PIL + 실제 폰트 = 결정론. 같은 입력이면 같은 출력이고, 획이 틀릴 일이 없다.

■ 판정 기준 (★중요)
  홈 화면의 실제 크기는 **87px 안팎**이다. 1024px 로 보면 다 예뻐 보이므로
  반드시 87px 로 줄여 보고 판정한다(작게 줄였을 때 뭉개지면 실패). 아래에서 미리보기를 함께 저장한다.

■ 색
  daniel "밝은색" → 라이트 테마의 카드/샌드 톤 배경 + 골드 글자(theme.ts 라이트 팔레트와 같은 결).
  ⚠️iOS 앱 아이콘은 **투명·알파 금지** → RGB 로만 저장한다.
"""
from PIL import Image, ImageDraw, ImageFont

SIZE = 1024
OUT = 'app/assets/icon.png'
PREVIEW = 'app/assets/icon-preview-87.png'

# ── 색 (theme.ts 라이트 팔레트 계열) ────────────────────────────────
BG_TOP = (250, 246, 236)     # 크림 — 위
BG_BOTTOM = (240, 232, 214)  # 옅은 샌드 — 아래(세로 그라데이션으로 밋밋함 방지)
GOLD = (160, 137, 72)        # colors.ju(라이트) #A08948 — 큰 '운'
INK = (60, 54, 44)           # 먹에 가까운 진한 브라운 — 작은 '니·내'(대비 확보)

FONT_PATH = '/System/Library/AssetsV2/com_apple_MobileAsset_Font8/4c932c71d74fc9e4c1bd9cbf270374b0b3ee7519.asset/AssetData/NanumMyeongjo.ttc'
FONT_INDEX = 2  # 나눔명조 ExtraBold (08-01 아이콘과 같은 굵기)


def font(px: int) -> ImageFont.FreeTypeFont:
    """지정 픽셀 크기의 나눔명조 ExtraBold."""
    return ImageFont.truetype(FONT_PATH, px, index=FONT_INDEX)


def draw_centered(d: ImageDraw.ImageDraw, cx: int, cy: int, text: str, f, fill) -> None:
    """
    글자의 **실제 잉크 박스** 기준으로 (cx, cy) 에 중심을 맞춘다.
    ★폰트 메트릭(ascent/descent)으로 맞추면 한글은 위아래가 치우친다 —
      글립마다 여백이 달라서, 눈에 보이는 획 덩어리를 기준으로 잡아야 가운데로 보인다.
    """
    l, t, r, b = d.textbbox((0, 0), text, font=f)
    d.text((cx - (l + r) / 2, cy - (t + b) / 2), text, font=f, fill=fill)


def main() -> None:
    img = Image.new('RGB', (SIZE, SIZE), BG_TOP)
    d = ImageDraw.Draw(img)

    # 배경 세로 그라데이션 — 단색이면 밝은 배경이 '빈 종이'처럼 보인다.
    for y in range(SIZE):
        k = y / (SIZE - 1)
        d.line(
            [(0, y), (SIZE, y)],
            fill=tuple(round(BG_TOP[i] + (BG_BOTTOM[i] - BG_TOP[i]) * k) for i in range(3)),
        )

    # ── 배치 = **A안 '골드 원 배지'**(daniel 2026-08-07 선택) ────────────────
    #  왼쪽 열: 니(위) / 내(아래) · 오른쪽: **골드 원 안에 크림 '운'**
    #  ★'운'을 세로 중앙에 두고 니·내를 그 위아래로 두면 **니운 / 내운** 두 낱말이 각각 한 줄로 읽힌다.
    #  ★원(도형)을 넣은 이유: 첫 판(글자만)이 "너무 별로"였고(daniel), 실제 약점은 색이 아니라
    #    **앵커가 없어 로고로 안 보이는 것**이었다. 도형이 시선을 잡고 '운'을 주인공으로 만든다.
    #  ★★크기·좌표를 손으로 맞추지 않는다 — 첫 판에서 '운'의 마지막 획이 오른쪽 끝에 붙어
    #    (iOS 는 모서리를 둥글게 깎는다) 잘릴 뻔했다. 다 그린 뒤 **잉크 박스를 재서**
    #    안전영역(SAFE)에 자동으로 앉히면 폰트·글자가 바뀌어도 여백이 보장된다.
    layer = Image.new('RGBA', (SIZE * 2, SIZE * 2), (0, 0, 0, 0))  # 여유 캔버스(넘쳐도 잘리지 않게)
    ld = ImageDraw.Draw(layer)
    F_BIG = font(430)    # 원 안의 '운'
    F_SMALL = font(300)  # 왼쪽 '니·내'

    cx, cy = SIZE, SIZE  # 여유 캔버스의 중앙
    R = 330                      # 배지 반지름
    badge_cx = cx + 370          # 배지 중심 x(오른쪽)
    ld.ellipse([badge_cx - R, cy - R, badge_cx + R, cy + R], fill=GOLD)
    draw_centered(ld, badge_cx, cy, '운', F_BIG, BG_TOP)   # 원 안은 배경색(크림)으로 파낸 듯이
    draw_centered(ld, cx - 220, cy - 190, '니', F_SMALL, INK)
    draw_centered(ld, cx - 220, cy + 190, '내', F_SMALL, INK)

    # 잉크 박스 → 안전영역에 비율 유지로 앉힌다.
    box = layer.getbbox()
    art = layer.crop(box)
    SAFE = round(SIZE * 0.86)  # A안(배지)은 원이 세로를 이미 채워 조금 더 크게 앉혀도 안전하다
    k = min(SAFE / art.width, SAFE / art.height)
    art = art.resize((max(1, round(art.width * k)), max(1, round(art.height * k))), Image.LANCZOS)
    img.paste(art, ((SIZE - art.width) // 2, (SIZE - art.height) // 2), art)

    img.save(OUT)
    print(f'✅ {OUT} {img.size}')

    # ★87px 미리보기 — 홈 화면 실제 크기. 이걸로 판정한다(1024 로는 판정하지 않는다).
    img.resize((87, 87), Image.LANCZOS).save(PREVIEW)
    print(f'✅ {PREVIEW} (87px — 홈 화면 실제 크기 판정용)')

    write_native(img, art)


def write_native(img: Image.Image, art: Image.Image) -> None:
    """
    ★네이티브 프로젝트의 아이콘을 **직접** 갈아 끼운다.
      `app/assets/icon.png` 는 expo prebuild 가 읽는 원본일 뿐이고, 이 저장소는 ios/android 를
      체크인해 쓴다 → assets 만 바꾸면 **빌드된 앱 아이콘은 그대로**다.
      prebuild 는 쓸 수 없다: `--clean` 이 프로젝트를 개명해 Fastfile 이 깨진다([[widget-prebuild-blocker]]).
    @param img 완성된 1024 아이콘(배경 포함)
    @param art 배경 없는 글자 레이어(RGBA) — Android 적응형 아이콘의 foreground 용
    """
    # ── iOS: 단일 1024 파일 ──
    ios = 'app/ios/SyncFortune/Images.xcassets/AppIcon.appiconset/App-Icon-1024x1024@1x.png'
    img.save(ios)
    print(f'  ✓ iOS {ios}')

    # ── Android: 해상도별 ic_launcher(전체 아이콘) + ic_launcher_foreground(적응형 전경) ──
    #   전경은 **안쪽 66% 안에** 들어가야 한다 — 런처가 원/스퀘어클 등으로 마스킹하며 바깥을 깎는다.
    DENS = {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}
    for d, px in DENS.items():
        base = f'app/android/app/src/main/res/mipmap-{d}'
        img.resize((px, px), Image.LANCZOS).save(f'{base}/ic_launcher.webp', 'WEBP', quality=95)

        fg_px = round(px * 2.25)  # 108/48 = 2.25 (적응형 아이콘 규격)
        fg = Image.new('RGB', (fg_px, fg_px), BG_TOP)
        inner = round(fg_px * 0.62)  # 마스킹 안전 영역
        k = min(inner / art.width, inner / art.height)
        a = art.resize((max(1, round(art.width * k)), max(1, round(art.height * k))), Image.LANCZOS)
        fg.paste(a, ((fg_px - a.width) // 2, (fg_px - a.height) // 2), a)
        fg.save(f'{base}/ic_launcher_foreground.webp', 'WEBP', quality=95)
    print(f'  ✓ Android {len(DENS)}개 해상도 × 2종(ic_launcher · foreground)')


if __name__ == '__main__':
    main()
