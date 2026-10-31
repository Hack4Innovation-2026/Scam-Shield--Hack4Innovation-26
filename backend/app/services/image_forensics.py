"""Heuristic image-tampering signals: a JPEG ghost check, plus metadata checks for any image.

JPEG ghosts (Farid, 2009): a JPEG that was saved before at a lower quality Q1 keeps a trace of it;
re-saving at exactly Q1 changes it less than nearby qualities do. A region pasted in afterwards
lacks that trace. The typical fake-receipt workflow (a forwarded, compressed screenshot, edited and
exported at a higher quality) leaves exactly this pattern.

Error Level Analysis was tried first and dropped: on synthetic tests it flagged about half of
untouched receipts (text re-compresses badly everywhere), while the ghost check flagged none and
caught every edit exported at a higher quality.

Limits (state them to users):
- It needs an earlier compression to compare against. Lossless images (PNG screenshots) and JPEGs
  saved only once can't be assessed; only their metadata is checked.
- An edit saved again at the same quality as the original leaves no detectable ghost.
- Calibrated on synthetic edits only. The result is a hint, never proof, and is kept out of the
  scam risk score.
"""
import base64
import io

import numpy as np
from PIL import Image

BLOCK = 16
MAX_PIXELS = 12_000_000          # skip compression checks on huge images (time and memory)
HEATMAP_MAX_WIDTH = 480

# JPEG ghosts
GHOST_MIN_Q, GHOST_STEP = 40, 6
GHOST_MIN_STRENGTH = 0.5         # image-wide dip needed to call it an earlier compression
GHOST_INCONCLUSIVE = 0.03        # share of informative blocks that lack the ghost
GHOST_POSSIBLE_EDIT = 0.08

EDITING_SOFTWARE = ("photoshop", "gimp", "snapseed", "picsart", "lightroom", "canva", "pixlr",
                    "affinity", "paint.net", "fotor", "polarr", "vsco", "facetune", "remini")

_EXIF_SOFTWARE, _EXIF_DATETIME, _EXIF_ORIENTATION = 0x0131, 0x0132, 0x0112
_EXIF_IFD, _EXIF_DATETIME_ORIGINAL = 0x8769, 0x9003
_ROTATE = {3: Image.Transpose.ROTATE_180, 6: Image.Transpose.ROTATE_270, 8: Image.Transpose.ROTATE_90}

# IJG standard luminance table, used to estimate the quality a JPEG was saved at.
_STD_LUMA = np.array([
    16, 11, 10, 16, 24, 40, 51, 61, 12, 12, 14, 19, 26, 58, 60, 55, 14, 13, 16, 24, 40, 57, 69, 56,
    14, 17, 22, 29, 51, 87, 80, 62, 18, 22, 37, 56, 68, 109, 103, 77, 24, 35, 55, 64, 81, 104, 113, 92,
    49, 64, 78, 87, 103, 121, 120, 101, 72, 92, 95, 98, 112, 100, 103, 99], dtype=np.float64)


def _blocks(a: np.ndarray) -> np.ndarray:
    h, w = a.shape
    h, w = h - h % BLOCK, w - w % BLOCK
    return a[:h, :w].reshape(h // BLOCK, BLOCK, w // BLOCK, BLOCK).mean(axis=(1, 3))


def _resave(image: Image.Image, quality: int) -> Image.Image:
    buf = io.BytesIO()
    image.save(buf, "JPEG", quality=quality)
    buf.seek(0)
    return Image.open(buf)


def estimate_jpeg_quality(image: Image.Image) -> int | None:
    tables = getattr(image, "quantization", None)
    if not tables or 0 not in tables or len(tables[0]) != 64:
        return None
    # Inverse of the IJG scaling: table = std * S / 100, S = 5000/q (q < 50) or 200 - 2q.
    s = float(np.mean(np.asarray(tables[0], dtype=np.float64) / _STD_LUMA) * 100)
    q = 5000 / s if s > 100 else (200 - s) / 2
    return int(np.clip(round(q), 1, 100))


def ghost_map(image: Image.Image, final_quality: int) -> tuple[int, float, np.ndarray, np.ndarray] | None:
    """(Q1, image-wide dip strength, block mask of "lacks the ghost", informative-block mask), or None if the image shows
    no earlier compression. Per block, dip = err(Q1) / mean(err(Q1 - 6), err(Q1 + 6)): a ratio,
    so text and flat areas cancel out."""
    gray_image = image.convert("L")
    gray = np.asarray(gray_image, dtype=np.float32)
    qualities = range(GHOST_MIN_Q, final_quality - 3)
    errors = {q: _blocks((gray - np.asarray(_resave(gray_image, q), dtype=np.float32)) ** 2)
              for q in qualities}

    best = None
    for q in qualities:
        if q - GHOST_STEP not in errors or q + GHOST_STEP not in errors:
            continue
        ref = (errors[q - GHOST_STEP] + errors[q + GHOST_STEP]) / 2
        informative = ref > 2.0
        if informative.sum() < 20:
            continue
        dip = np.divide(errors[q], ref, out=np.ones_like(ref), where=informative)
        strength = float(1 - np.median(dip[informative]))
        if best is None or strength > best[1]:
            best = (q, strength, dip, informative)

    if best is None or best[1] < GHOST_MIN_STRENGTH:
        return None
    q, strength, dip, informative = best
    lacks = informative & (dip > 0.8)
    return q, strength, lacks, informative



def metadata_flags(image: Image.Image) -> list[str]:
    flags = []
    exif = image.getexif()
    software = str(exif.get(_EXIF_SOFTWARE) or image.info.get("Software") or image.info.get("software") or "")
    if any(name in software.lower() for name in EDITING_SOFTWARE):
        flags.append(f"Saved by editing software: {software.strip()[:60]}")

    modified = exif.get(_EXIF_DATETIME)
    taken = exif.get_ifd(_EXIF_IFD).get(_EXIF_DATETIME_ORIGINAL)
    if modified and taken and str(modified) != str(taken):
        flags.append(f"File modified after the photo was taken ({taken} → {modified})")
    return flags


def _heatmap(image: Image.Image, heat: np.ndarray) -> str:
    """Dimmed grayscale image with suspicious blocks (heat 0..1) tinted red, as a PNG data URL."""
    gray = np.asarray(image.convert("L"), dtype=np.float32)
    heat = np.kron(np.clip(heat, 0, 1), np.ones((BLOCK, BLOCK)))
    h, w = heat.shape
    base = gray[:h, :w] * 0.45 + 40
    rgb = np.stack([base + heat * (255 - base), base * (1 - heat * 0.6), base * (1 - heat * 0.6)], axis=2)
    out = Image.fromarray(np.clip(rgb, 0, 255).astype("uint8"))

    orientation = image.getexif().get(_EXIF_ORIENTATION)
    if orientation in _ROTATE:
        out = out.transpose(_ROTATE[orientation])
    if out.width > HEATMAP_MAX_WIDTH:
        out = out.resize((HEATMAP_MAX_WIDTH, round(out.height * HEATMAP_MAX_WIDTH / out.width)))
    buf = io.BytesIO()
    out.save(buf, "PNG", optimize=True)
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


def analyze(image: Image.Image) -> dict:
    """Tampering hints for one uploaded image."""
    flags = metadata_flags(image)
    result = {"method": None, "score": None, "jpeg_quality": None, "earlier_quality": None,
              "flags": flags, "heatmap": None}
    level = None                      # None | "inconclusive" | "possible_editing"

    is_jpeg = (image.format or "").upper() in {"JPEG", "MPO"}
    if is_jpeg and image.width * image.height <= MAX_PIXELS:
        quality = estimate_jpeg_quality(image) or 95
        result["jpeg_quality"] = quality
        ghost = ghost_map(image, quality)
        if ghost:
            earlier_q, _, lacks, informative = ghost
            share = float(lacks.sum() / informative.sum())
            result.update(method="jpeg_ghost", score=round(share, 3), earlier_quality=earlier_q)
            if share >= GHOST_INCONCLUSIVE:        # a map with nothing highlighted only adds noise
                result["heatmap"] = _heatmap(image, lacks.astype(float))
            if share >= GHOST_POSSIBLE_EDIT:
                level = "possible_editing"
            elif share >= GHOST_INCONCLUSIVE:
                level = "inconclusive"

    if flags:
        level = "possible_editing"
    if level:
        verdict = level
    elif result["method"]:
        verdict = "no_signs"
    else:
        verdict = "not_applicable"
    result["verdict"] = verdict
    result["summary"] = _summary(verdict, result, is_jpeg)
    return result


def _summary(verdict: str, r: dict, is_jpeg: bool) -> str:
    ghost_hit = r["method"] == "jpeg_ghost" and r["score"] >= GHOST_INCONCLUSIVE
    if verdict == "possible_editing":
        parts = []
        if ghost_hit:
            parts.append(f"the image was saved before at quality ~{r['earlier_quality']}, but the "
                         "highlighted regions lack that earlier compression, as if added later")
        if r["flags"]:
            parts.append("the file's metadata points to editing")
        return ("Possible editing: " + " and ".join(parts) +
                ". This is a hint, not proof; confirm with the sender, or in your bank or payment app.")
    if verdict == "inconclusive":
        return (f"Inconclusive: the image was saved before at quality ~{r['earlier_quality']}, and a few "
                "highlighted regions lack that earlier compression. This is weak evidence.")
    if verdict == "no_signs":
        return (f"No signs of editing found: the whole image carries the same earlier compression "
                f"(quality ~{r['earlier_quality']}). An edit saved again at that same quality would "
                "leave no trace, so this does not prove the image is genuine.")
    if is_jpeg:
        return ("Can't check this image for pasted-in regions: it shows no earlier compression to compare "
                "against (it was likely saved only once). Only its metadata was checked.")
    return ("Can't check this image for pasted-in regions: it is a lossless image (e.g. a PNG screenshot), "
            "which keeps no compression history. Only its metadata was checked.")
