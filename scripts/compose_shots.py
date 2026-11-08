from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageChops

ROOT = Path(__file__).resolve().parent.parent
SHOTS = ROOT / "dist" / "screenshots"
OUT = ROOT / "dist" / "review"
OUT.mkdir(parents=True, exist_ok=True)

W, H = 1400, 1000


def wallpaper():
    base = Image.new("RGB", (W, H), (20, 24, 27))
    px = base.load()
    for y in range(H):
        for x in range(W):
            t = x / W
            u = y / H
            px[x, y] = (
                int(22 + 17 * t + 6 * u),
                int(27 + 20 * (1 - t) + 4 * u),
                int(31 + 14 * (1 - u) + 8 * t),
            )
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    draw.ellipse((-280, -360, 720, 660), fill=(80, 113, 104, 78))
    draw.ellipse((880, -260, 1660, 480), fill=(151, 111, 69, 72))
    draw.ellipse((380, 540, 1220, 1300), fill=(43, 57, 83, 110))
    overlay = overlay.filter(ImageFilter.GaussianBlur(120))
    base = Image.alpha_composite(base.convert("RGBA"), overlay)

    # Fake desktop windows, heavily out of focus, to read as a real desktop.
    win = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    wd = ImageDraw.Draw(win)
    wd.rounded_rectangle((70, 120, 760, 610), radius=24, fill=(19, 22, 24, 170), outline=(255, 255, 255, 16), width=2)
    wd.rounded_rectangle((420, 380, 1210, 800), radius=20, fill=(28, 27, 25, 120), outline=(255, 255, 255, 12), width=2)
    for i in range(6):
        wd.rounded_rectangle((108, 178 + i * 52, 108 + (330 + i * 37) % 580, 194 + i * 52), radius=8, fill=(255, 255, 255, 14))
    win = win.filter(ImageFilter.GaussianBlur(8))
    base = Image.alpha_composite(base, win)

    # Grain.
    noise = Image.effect_noise((W, H), 18).convert("L").point(lambda v: int(v * 0.12))
    grain = Image.new("RGBA", (W, H), (255, 255, 255, 0))
    grain.putalpha(noise)
    return Image.alpha_composite(base, grain).convert("RGB")


def compose(name):
    shot = Image.open(SHOTS / f"{name}.png").convert("RGBA")
    bg = wallpaper()
    x = W - shot.width - 70
    y = 40
    shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle(
        (x + 12, y + 20, x + shot.width + 12, y + shot.height + 20),
        radius=30,
        fill=(0, 0, 0, 150),
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(34))
    bg = Image.alpha_composite(bg.convert("RGBA"), shadow)
    bg.alpha_composite(shot, (x, y))
    bg.convert("RGB").save(OUT / f"{name}-desktop.jpg", quality=92)


for name in [
    "week",
    "week-empty",
    "week-tasks",
    "week-bonus",
    "week-paper",
    "nav-open",
    "appearance",
    "plans",
    "rewards",
    "rewards-pool",
    "settings",
    "settings-ai",
    "compact",
    "task-sheet",
    "plan-form",
    "plan-preview",
    "manual-plan",
    "draw-result",
    "task-editor",
    "reward-editor",
    "pool-editor",
]:
    compose(name)
print("composed to", OUT)
