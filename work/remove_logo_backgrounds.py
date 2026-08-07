from pathlib import Path

import numpy as np
from PIL import Image


ROOT = Path("/Users/thiegojesus/Documents/Codex/2026-07-15/re")
GOLD_SOURCE = Path("/Users/thiegojesus/Downloads/WhatsApp Image 2026-07-03 at 13.46.18.jpeg")
BLACK_SOURCE = Path("/Users/thiegojesus/Downloads/WhatsApp Image 2026-07-03 at 13.46.19.jpeg")


def smoothstep(values: np.ndarray, low: float, high: float) -> np.ndarray:
    scaled = np.clip((values - low) / (high - low), 0.0, 1.0)
    return scaled * scaled * (3.0 - 2.0 * scaled)


def gold_on_transparent() -> Image.Image:
    image = Image.open(GOLD_SOURCE).convert("RGB")
    rgb = np.asarray(image).astype(np.float32)
    intensity = rgb.max(axis=2)
    alpha = smoothstep(intensity, 7.0, 45.0)
    rgba = np.dstack((rgb.astype(np.uint8), np.rint(alpha * 255).astype(np.uint8)))
    rgba[rgba[:, :, 3] == 0, :3] = 0
    return Image.fromarray(rgba, "RGBA")


def black_on_transparent() -> Image.Image:
    image = Image.open(BLACK_SOURCE).convert("RGB")
    rgb = np.asarray(image).astype(np.float32)
    darkness = 255.0 - rgb.mean(axis=2)
    alpha = smoothstep(darkness, 5.0, 245.0)
    rgba = np.zeros((*darkness.shape, 4), dtype=np.uint8)
    rgba[:, :, 3] = np.rint(alpha * 255).astype(np.uint8)
    return Image.fromarray(rgba, "RGBA")


assets = ROOT / "src" / "assets"
public = ROOT / "public"

gold = gold_on_transparent()
gold.save(assets / "lima-mazzetti-logo-gold.png", optimize=True)

# Mesma área do monograma utilizada anteriormente na barra lateral.
gold_mark = gold.crop((192, 70, 552, 430))
gold_mark.save(assets / "lima-mazzetti-mark-gold.png", optimize=True)

black = black_on_transparent()
black.save(assets / "lima-mazzetti-logo-black.png", optimize=True)

# Recorte quadrado do monograma para o ícone do navegador.
black_mark = black.crop((201, 65, 531, 395))
black_mark.save(public / "favicon.png", optimize=True)

for path in (
    assets / "lima-mazzetti-logo-gold.png",
    assets / "lima-mazzetti-mark-gold.png",
    assets / "lima-mazzetti-logo-black.png",
    public / "favicon.png",
):
    with Image.open(path) as output:
        alpha = np.asarray(output.getchannel("A"))
        print(
            f"{path.name}: {output.size[0]}x{output.size[1]}, "
            f"alpha={alpha.min()}..{alpha.max()}, transparent_corners="
            f"{sum(alpha[y, x] == 0 for x, y in ((0, 0), (alpha.shape[1]-1, 0), (0, alpha.shape[0]-1), (alpha.shape[1]-1, alpha.shape[0]-1)))}/4"
        )
