"""Build the bundled icons from the original artwork.

art/source/<identifier>.(jpg|png|webp)  ->  assets/icons/<identifier>.webp (256x256)

Files ending in "-token" become transparent tokens: the near-black background
fades out so only the subject and its glow stay on the map.
Requires Pillow: python -m pip install pillow
"""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "art" / "source"
OUTPUT = ROOT / "assets" / "icons"
SIZE = (256, 256)


def transparent_background(image):
    image = image.convert("RGBA")
    pixels = image.load()
    width, height = image.size
    for y in range(height):
        for x in range(width):
            red, green, blue, _ = pixels[x, y]
            light = max(red, green, blue)
            alpha = 0 if light < 18 else 255 if light > 60 else int((light - 18) / 42 * 255)
            pixels[x, y] = (red, green, blue, alpha)
    return image


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for source in sorted(SOURCE.iterdir()):
        if source.suffix.lower() not in {".jpg", ".jpeg", ".png", ".webp"}:
            continue
        image = Image.open(source)
        if source.stem.endswith("-token"):
            image = transparent_background(image).resize(SIZE, Image.LANCZOS)
            quality = 85
        else:
            image = image.convert("RGB").resize(SIZE, Image.LANCZOS)
            quality = 82
        target = OUTPUT / f"{source.stem}.webp"
        image.save(target, "WEBP", quality=quality, method=6)
        print(f"{source.name} -> {target.relative_to(ROOT)} ({target.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
