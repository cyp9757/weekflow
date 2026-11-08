from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
ASSETS.mkdir(exist_ok=True)

ACCENT = (231, 184, 124, 255)
SIZE = 1024


def rounded_mask(size, radius):
    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=255)
    return mask


def app_icon():
    img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    mask = rounded_mask(SIZE, 224)
    bg = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    pixels = bg.load()
    for y in range(SIZE):
        t = y / (SIZE - 1)
        r = int(38 * (1 - t) + 16 * t)
        g = int(35 * (1 - t) + 15 * t)
        b = int(31 * (1 - t) + 14 * t)
        for x in range(SIZE):
            glow = max(0.0, 1 - ((x - SIZE * 0.78) ** 2 + (y - SIZE * 0.16) ** 2) ** 0.5 / (SIZE * 0.75))
            pixels[x, y] = (
                min(255, r + int(26 * glow)),
                min(255, g + int(19 * glow)),
                min(255, b + int(9 * glow)),
                255,
            )
    img.paste(bg, (0, 0), mask)

    # Inner hairline.
    draw = ImageDraw.Draw(img)
    draw.rounded_rectangle((3, 3, SIZE - 4, SIZE - 4), radius=221, outline=(255, 255, 255, 18), width=3)

    bars = [300, 520, 405, 660]
    width = 84
    gap = 42
    total = len(bars) * width + (len(bars) - 1) * gap
    left = (SIZE - total) / 2
    baseline = 760
    layer = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    ldraw = ImageDraw.Draw(layer)
    for index, height in enumerate(bars):
        x = int(left + index * (width + gap))
        top = baseline - height
        alpha = [170, 220, 195, 255][index]
        ldraw.rounded_rectangle(
            (x, top, x + width, baseline),
            radius=width // 2,
            fill=(ACCENT[0], ACCENT[1], ACCENT[2], alpha),
        )
    glow = layer.filter(ImageFilter.GaussianBlur(32))
    img.alpha_composite(glow)
    img.alpha_composite(layer)

    # A small horizon line under the mark.
    draw.line((260, 840, 764, 840), fill=(255, 255, 255, 28), width=3)
    draw.ellipse((490, 870, 534, 914), fill=(231, 184, 124, 210))

    img.save(ASSETS / "icon.png")
    img.resize((512, 512), Image.LANCZOS).save(ASSETS / "icon-512.png")
    img.save(
        ASSETS / "icon.ico",
        sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )


def tray_icon():
    size = 64
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    bars = [14, 30, 22, 42]
    width = 7
    gap = 5
    total = len(bars) * width + (len(bars) - 1) * gap
    left = (size - total) / 2
    baseline = 50
    for index, height in enumerate(bars):
        x = int(left + index * (width + gap))
        draw.rounded_rectangle(
            (x, baseline - height, x + width, baseline),
            radius=3,
            fill=(231, 184, 124, [170, 220, 195, 255][index]),
        )
    img.save(ASSETS / "tray.png")


app_icon()
tray_icon()
print("icons written to", ASSETS)
