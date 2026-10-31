import base64
import io

import numpy as np
import pytest
from PIL import Image, ImageDraw, ImageFilter, ImageFont

from app.services import image_forensics as forensics

AMOUNT_BOX = (51, 299, 523, 363)


def _roundtrip(img, fmt, **kw):
    buf = io.BytesIO()
    img.save(buf, fmt, **kw)
    buf.seek(0)
    out = Image.open(buf)
    out.load()
    return out


def _receipt(amount="Rs 2,500.00", name="Ramesh Kumar", size=36):
    img = Image.new("RGB", (720, 1280), (250, 250, 250))
    draw = ImageDraw.Draw(img)
    font = ImageFont.load_default(size=size)
    draw.rectangle((0, 0, 720, 150), fill=(60, 40, 140))
    draw.text((40, 50), "Payment app", fill="white", font=font)
    for i, line in enumerate(["Payment successful", amount, f"To: {name}", "UPI ref 4021 8812 3390"]):
        draw.text((60, 200 + i * 110), line, fill=(30, 30, 30), font=font)
    return img


def _photo(seed, w=800, h=600):
    rng = np.random.default_rng(seed)
    x, y = np.broadcast_arrays(np.linspace(0, 1, w)[None, :, None], np.linspace(0, 1, h)[:, None, None])
    base = np.concatenate([x * 200 + 30, y * 180 + 40, (x + y) * 90 + 20], axis=2) + rng.normal(0, 6, (h, w, 3))
    return Image.fromarray(np.clip(base, 0, 255).astype("uint8")).filter(ImageFilter.GaussianBlur(1))


def _forwarded_and_edited(original_q, final_q, **receipt_kw):
    """A receipt screenshot compressed once (e.g. forwarded on WhatsApp), then either re-saved
    untouched or with the amount replaced in an editor, at final_q."""
    original = _roundtrip(_receipt(**receipt_kw), "JPEG", quality=original_q).convert("RGB")
    untouched = _roundtrip(original, "JPEG", quality=final_q)
    edited = original.copy()
    edited.paste(_receipt(amount="Rs 25,000.00", **receipt_kw).crop(AMOUNT_BOX), AMOUNT_BOX[:2])
    return untouched, _roundtrip(edited, "JPEG", quality=final_q)


@pytest.mark.parametrize("original_q", [70, 75, 80, 85])
def test_edited_receipt_exported_at_higher_quality_is_flagged(original_q):
    untouched, edited = _forwarded_and_edited(original_q, 95)

    clean = forensics.analyze(untouched)
    assert clean["verdict"] == "no_signs"
    assert clean["earlier_quality"] == original_q        # the earlier save is recovered exactly

    flagged = forensics.analyze(edited)
    assert flagged["verdict"] == "possible_editing"
    assert flagged["method"] == "jpeg_ghost"
    assert f"~{original_q}" in flagged["summary"]


@pytest.mark.parametrize("name,size", [("Priya Sharma", 30), ("Mohammed Ali", 44)])
def test_untouched_receipts_are_not_flagged(name, size):
    untouched, _ = _forwarded_and_edited(75, 95, name=name, size=size)
    assert forensics.analyze(untouched)["verdict"] == "no_signs"


@pytest.mark.parametrize("quality", [75, 90, 95])
def test_receipt_saved_once_is_not_assessed_rather_than_flagged(quality):
    # No earlier compression to compare against: say so instead of guessing.
    result = forensics.analyze(_roundtrip(_receipt(), "JPEG", quality=quality))
    assert result["verdict"] == "not_applicable"
    assert "saved only once" in result["summary"]


def test_edit_resaved_at_same_quality_is_never_called_genuine():
    # Known limit: no ghost is left. The verdict must not claim "no signs".
    _, edited = _forwarded_and_edited(80, 80)
    assert forensics.analyze(edited)["verdict"] != "no_signs"


@pytest.mark.parametrize("seed", [0, 1])
def test_photos_are_not_falsely_flagged(seed):
    result = forensics.analyze(_roundtrip(_photo(seed), "JPEG", quality=90))
    assert result["verdict"] in {"not_applicable", "no_signs"}


def test_png_screenshot_is_not_assessed():
    result = forensics.analyze(_roundtrip(_receipt(), "PNG"))
    assert result["verdict"] == "not_applicable"
    assert result["method"] is None and result["heatmap"] is None
    assert "lossless" in result["summary"]


def test_editing_software_in_exif_is_flagged():
    exif = Image.Exif()
    exif[0x0131] = "Adobe Photoshop 25.0 (Windows)"
    result = forensics.analyze(_roundtrip(_receipt(), "JPEG", quality=90, exif=exif))
    assert result["verdict"] == "possible_editing"
    assert any("Photoshop" in f for f in result["flags"])
    assert "metadata" in result["summary"]


def test_camera_software_is_not_flagged():
    exif = Image.Exif()
    exif[0x0131] = "HDR+ 1.0.540104767zd"          # a phone camera, not an editor
    assert forensics.analyze(_roundtrip(_photo(5), "JPEG", quality=90, exif=exif))["flags"] == []


def test_modified_after_capture_is_flagged():
    exif = Image.Exif()
    exif[0x0132] = "2026:10:31 18:05:00"
    exif.get_ifd(0x8769)[0x9003] = "2026:10:30 09:12:44"
    result = forensics.analyze(_roundtrip(_photo(6), "JPEG", quality=90, exif=exif))
    assert any("modified after" in f for f in result["flags"])


@pytest.mark.parametrize("quality", [50, 70, 85, 95])
def test_jpeg_quality_estimate(quality):
    assert forensics.estimate_jpeg_quality(_roundtrip(_receipt(), "JPEG", quality=quality)) == quality


def test_heatmap_is_a_bounded_png_data_url():
    _, edited = _forwarded_and_edited(75, 95)
    heatmap = forensics.analyze(edited)["heatmap"]
    assert heatmap.startswith("data:image/png;base64,")
    image = Image.open(io.BytesIO(base64.b64decode(heatmap.split(",", 1)[1])))
    assert image.width <= forensics.HEATMAP_MAX_WIDTH
