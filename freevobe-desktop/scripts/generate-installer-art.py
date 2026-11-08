#!/usr/bin/env python3
"""Genererar de mörka installationsbilderna till Freevobe.

Bilderna är medvetet ritade i kod i stället för att vara binärer utan källa: då kan de
återskapas och justeras när profilen ändras. Kör från freevobe-desktop:

    python3 scripts/generate-installer-art.py

Resultatet hamnar i apps/desktop/src-tauri/installer/ och används av tauri.conf.json
(NSIS-sidopanel/rubrik och DMG-bakgrund).
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "apps" / "desktop" / "src-tauri" / "installer"

BG_TOP = (20, 22, 28)
BG_BOTTOM = (9, 10, 14)
EMBER = (249, 115, 22)
MINT = (52, 211, 153)
TEXT = (226, 232, 240)
MUTED = (100, 116, 139)


def font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for candidate in (
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ):
        if Path(candidate).exists():
            return ImageFont.truetype(candidate, size)
    return ImageFont.load_default(size=size)


def gradient(width: int, height: int) -> Image.Image:
    image = Image.new("RGB", (width, height), BG_TOP)
    draw = ImageDraw.Draw(image)
    for y in range(height):
        ratio = y / max(1, height - 1)
        color = tuple(round(a + (b - a) * ratio) for a, b in zip(BG_TOP, BG_BOTTOM))
        draw.line([(0, y), (width, y)], fill=color)
    return image


def mark(draw: ImageDraw.ImageDraw, x: int, y: int, size: int, width: int = 3) -> None:
    """Freevobes märke: en rundad ruta med ett stiliserat F och en mint-punkt."""
    draw.rounded_rectangle(
        [x, y, x + size, y + size], radius=max(4, size // 5), outline=EMBER, width=width
    )
    unit = size / 10
    draw.rectangle(
        [x + unit * 3, y + unit * 2.5, x + unit * 3.6, y + unit * 7.5], fill=EMBER
    )
    draw.rectangle(
        [x + unit * 3, y + unit * 2.5, x + unit * 6.8, y + unit * 3.2], fill=EMBER
    )
    draw.rectangle(
        [x + unit * 3, y + unit * 4.6, x + unit * 6.1, y + unit * 5.3], fill=EMBER
    )
    radius = unit * 0.9
    draw.ellipse(
        [
            x + unit * 7.1 - radius,
            y + unit * 7.1 - radius,
            x + unit * 7.1 + radius,
            y + unit * 7.1 + radius,
        ],
        fill=MINT,
    )


def save_sidebar() -> Path:
    width, height = 164, 314
    image = gradient(width, height)
    draw = ImageDraw.Draw(image)
    draw.rectangle([0, 0, 3, height], fill=EMBER)
    mark(draw, 22, 34, 44, width=2)
    draw.text((22, 96), "Freevobe", font=font(20), fill=TEXT)
    draw.text((22, 124), "Prompt", font=font(12), fill=MUTED)
    draw.text((22, 140), "\u2192 klart", font=font(12), fill=EMBER)
    draw.line([22, height - 46, width - 22, height - 46], fill=(40, 44, 54), width=1)
    draw.text((22, height - 34), "Lokal-first", font=font(10), fill=MUTED)
    path = OUT / "sidebar.bmp"
    image.save(path, format="BMP")
    return path


def save_header() -> Path:
    width, height = 150, 57
    image = gradient(width, height)
    draw = ImageDraw.Draw(image)
    mark(draw, 10, 12, 32, width=2)
    draw.text((52, 16), "Freevobe", font=font(16), fill=TEXT)
    draw.text((52, 34), "0.4.0", font=font(9), fill=MUTED)
    path = OUT / "header.bmp"
    image.save(path, format="BMP")
    return path


def save_dmg_background() -> Path:
    width, height = 660, 400
    image = gradient(width, height)
    draw = ImageDraw.Draw(image)
    # Mjuk ember-glöd bakom märket, ritad som halvtransparenta lager.
    glow = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    for radius in range(140, 20, -6):
        alpha = max(0, round(10 * (140 - radius) / 120))
        glow_draw.ellipse(
            [width // 2 - radius, 96 - radius, width // 2 + radius, 96 + radius],
            fill=EMBER + (alpha,),
        )
    image = Image.alpha_composite(image.convert("RGBA"), glow).convert("RGB")
    draw = ImageDraw.Draw(image)
    mark(draw, width // 2 - 28, 62, 56, width=3)
    title = "Freevobe"
    title_font = font(28)
    title_width = draw.textlength(title, font=title_font)
    draw.text(((width - title_width) / 2, 138), title, font=title_font, fill=TEXT)
    hint = "Dra Freevobe till mappen Applications"
    hint_font = font(13)
    hint_width = draw.textlength(hint, font=hint_font)
    draw.text(((width - hint_width) / 2, 330), hint, font=hint_font, fill=MUTED)
    # Pil mellan appen (180,170) och Applications (480,170).
    draw.line([300, 178, 404, 178], fill=EMBER, width=2)
    draw.polygon([(404, 170), (418, 178), (404, 186)], fill=EMBER)
    path = OUT / "dmg-background.png"
    image.save(path, format="PNG")
    return path


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for saved in (save_sidebar(), save_header(), save_dmg_background()):
        with Image.open(saved) as check:
            print(f"{saved.relative_to(ROOT)}: {check.size[0]}x{check.size[1]} {check.format}")


if __name__ == "__main__":
    main()
