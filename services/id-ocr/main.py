import io
import re
import base64
import logging
from contextlib import asynccontextmanager
from typing import Optional

import cv2
import numpy as np
import easyocr
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, ExifTags
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# EasyOCR reader (downloads ~2 GB of models on first run — only once)
# ---------------------------------------------------------------------------

_reader: Optional[easyocr.Reader] = None


def get_reader() -> easyocr.Reader:
    global _reader
    if _reader is None:
        logger.info("Loading EasyOCR Arabic+English models (first run downloads ~2 GB)…")
        _reader = easyocr.Reader(["ar", "en"], gpu=False)
        logger.info("EasyOCR ready.")
    return _reader


@asynccontextmanager
async def lifespan(app: FastAPI):
    get_reader()          # warm up at startup so the first /scan isn't slow
    yield


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------

app = FastAPI(title="QuickIn Egyptian ID OCR", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Egyptian ID decoder — verified structure (4 independent GitHub decoders)
# ---------------------------------------------------------------------------

GOVERNORATES: dict[str, str] = {
    "01": "Cairo",          "02": "Alexandria",     "03": "Port Said",
    "04": "Suez",           "11": "Damietta",        "12": "Dakahlia",
    "13": "Ash Sharqia",    "14": "Kaliobeya",       "15": "Kafr El Sheikh",
    "16": "Gharbia",        "17": "Menoufia",        "18": "El Beheira",
    "19": "Ismailia",       "21": "Giza",            "22": "Beni Suef",
    "23": "Fayoum",         "24": "El Menia",        "25": "Assiut",
    "26": "Sohag",          "27": "Qena",            "28": "Aswan",
    "29": "Luxor",          "31": "Red Sea",         "32": "El Wadi El Gidid",
    "33": "Matruh",         "34": "North Sinai",     "35": "South Sinai",
    "88": "Foreign",
}

# Eastern Arabic ٠–٩  →  Western 0–9
_AR_TO_WEST = str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")

# Regex to find 14+ consecutive Eastern-Arabic digits directly in raw OCR text
_AR_DIGITS_RE = re.compile(r"[٠١٢٣٤٥٦٧٨٩]{14,}")


def decode_id(id_number: str) -> dict:
    century = int(id_number[0])
    year_prefix = "19" if century == 2 else "20"
    year  = year_prefix + id_number[1:3]
    month = id_number[3:5]
    day   = id_number[5:7]
    gov   = id_number[7:9]
    gender_digit = int(id_number[12])
    return {
        "id_number":        id_number,
        "birth_date":       f"{year}-{month}-{day}",
        "birth_year":       int(year),
        "birth_month":      int(month),
        "birth_day":        int(day),
        "governorate_code": gov,
        "governorate":      GOVERNORATES.get(gov, f"Unknown ({gov})"),
        "gender":           "Male" if gender_digit % 2 != 0 else "Female",
    }


# ---------------------------------------------------------------------------
# Image helpers
# ---------------------------------------------------------------------------

def _fix_exif_orientation(pil_img: Image.Image) -> Image.Image:
    """Rotate image so it matches the EXIF orientation tag (mobile photos)."""
    try:
        exif = pil_img._getexif()          # type: ignore[attr-defined]
        if exif is None:
            return pil_img
        ori_key = next(
            (k for k, v in ExifTags.TAGS.items() if v == "Orientation"), None
        )
        if ori_key is None:
            return pil_img
        rot = {3: 180, 6: 270, 8: 90}.get(exif.get(ori_key, 1))
        if rot:
            pil_img = pil_img.rotate(rot, expand=True)
    except Exception:
        pass
    return pil_img


def _order_pts(pts: np.ndarray) -> np.ndarray:
    rect = np.zeros((4, 2), dtype="float32")
    s    = pts.sum(axis=1)
    diff = np.diff(pts, axis=1)
    rect[0] = pts[np.argmin(s)]    # top-left
    rect[2] = pts[np.argmax(s)]    # bottom-right
    rect[1] = pts[np.argmin(diff)] # top-right
    rect[3] = pts[np.argmax(diff)] # bottom-left
    return rect


def _four_point_transform(image: np.ndarray, pts: np.ndarray) -> np.ndarray:
    rect = _order_pts(pts)
    tl, tr, br, bl = rect
    w = int(max(np.linalg.norm(br - bl), np.linalg.norm(tr - tl)))
    h = int(max(np.linalg.norm(tr - br), np.linalg.norm(tl - bl)))
    dst = np.array([[0, 0], [w - 1, 0], [w - 1, h - 1], [0, h - 1]], dtype="float32")
    M = cv2.getPerspectiveTransform(rect, dst)
    return cv2.warpPerspective(image, M, (w, h))


def detect_and_crop_card(image: np.ndarray) -> np.ndarray:
    """
    Find the largest 4-corner contour (the card boundary), deskew it, and
    return the cropped card.  Falls back to the full image if detection fails.
    """
    orig   = image.copy()
    gray   = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blur   = cv2.bilateralFilter(gray, 9, 75, 75)
    edged  = cv2.Canny(blur, 50, 150)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    edged  = cv2.dilate(edged, kernel, iterations=1)

    contours, _ = cv2.findContours(edged, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    contours = sorted(contours, key=cv2.contourArea, reverse=True)[:10]
    img_area = image.shape[0] * image.shape[1]

    for c in contours:
        peri  = cv2.arcLength(c, True)
        approx = cv2.approxPolyDP(c, 0.02 * peri, True)
        if len(approx) == 4 and cv2.contourArea(approx) > img_area * 0.10:
            return _four_point_transform(orig, approx.reshape(4, 2))

    return orig  # no card detected — return original


def _preprocess_variants(cv_img: np.ndarray) -> list[np.ndarray]:
    """
    Two pre-processed variants: original colour + CLAHE-enhanced grayscale.
    (4 variants were too slow on CPU — pushed processing past the 30 s mobile timeout.)
    """
    gray = cv2.cvtColor(cv_img, cv2.COLOR_BGR2GRAY)

    # 1. Original colour
    variants: list[np.ndarray] = [cv_img]

    # 2. CLAHE – adaptive histogram equalisation (best single improvement for uneven lighting)
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    clahe_gray = clahe.apply(gray)
    variants.append(cv2.cvtColor(clahe_gray, cv2.COLOR_GRAY2BGR))

    return variants


# ---------------------------------------------------------------------------
# OCR + ID extraction
# ---------------------------------------------------------------------------

def _normalize(text: str) -> str:
    """Translate Eastern Arabic digits → Western, then strip every non-digit."""
    return re.sub(r"\D", "", text.translate(_AR_TO_WEST))


def find_id_number(texts: list[str]) -> Optional[str]:
    """
    Search for a valid 14-digit Egyptian National ID in OCR output.

    Strategies (in order, strictest first):
      0 — raw Eastern-Arabic digit sequences (٠-٩) directly in each OCR token
      1 — per-token after Eastern→Western translation + non-digit strip
      2 — digits from each token individually joined (no cross-contamination between
          the 4 OCR variants), slide 14-char window with date validation
      3 — lenient: any 14-digit window starting with 2 or 3 (no date check);
          last resort when lighting/blur makes OCR produce imperfect dates
    """
    # Deduplicate texts (4 OCR variants produce identical or near-identical tokens)
    seen: set[str] = set()
    unique = [t for t in texts if not (t in seen or seen.add(t))]  # type: ignore[func-returns-value]

    # Strategy 0: raw Arabic-Indic sequences
    for text in unique:
        for m in _AR_DIGITS_RE.finditer(text):
            west = m.group().translate(_AR_TO_WEST)
            for i in range(len(west) - 13):
                cand = west[i:i+14]
                if _validate_id(cand):
                    return cand

    # Strategy 1: per-token Western digits
    for text in unique:
        norm = _normalize(text)
        for m in re.finditer(r"\d{14}", norm):
            if _validate_id(m.group()):
                return m.group()

    # Strategy 2: per-token digits joined (avoids pollution across variant repetitions)
    token_digits = "".join(_normalize(t) for t in unique)
    for i in range(len(token_digits) - 13):
        cand = token_digits[i:i+14]
        if _validate_id(cand):
            return cand

    # Strategy 3 (lenient): any window starting with 2 or 3, skip date validation.
    # Accepts partial OCR errors — user still confirms before the number is used.
    for i in range(len(token_digits) - 13):
        cand = token_digits[i:i+14]
        if cand[0] in ("2", "3") and cand.isdigit():
            return cand

    return None


def _validate_id(id_number: str) -> bool:
    if len(id_number) != 14:
        return False
    if id_number[0] not in ("2", "3"):
        return False
    try:
        month = int(id_number[3:5])
        day   = int(id_number[5:7])
        return 1 <= month <= 12 and 1 <= day <= 31
    except ValueError:
        return False


def process_image(image_bytes: bytes) -> dict:
    # Open + fix orientation
    pil = _fix_exif_orientation(Image.open(io.BytesIO(image_bytes)).convert("RGB"))
    cv_img = cv2.cvtColor(np.array(pil), cv2.COLOR_RGB2BGR)

    # Detect + deskew
    cropped = detect_and_crop_card(cv_img)

    reader = get_reader()
    all_texts: list[str] = []

    # Run OCR on every preprocessing variant; collect all tokens with conf > 0.1
    # (was 0.3 — the old threshold discarded many valid but low-confidence digits)
    for variant in _preprocess_variants(cropped):
        results = reader.readtext(variant, detail=1, paragraph=False)
        texts = [text for (_, text, conf) in results if conf > 0.1]
        all_texts.extend(texts)

    # Log what was found for diagnosis
    raw_digits = re.sub(r"\D", "", "".join(all_texts).translate(_AR_TO_WEST))
    logger.info("OCR raw_texts=%s", all_texts)
    logger.info("OCR raw_digits=%s", raw_digits)

    id_number = find_id_number(all_texts)

    if id_number:
        logger.info("OCR SUCCESS id=%s", id_number)
        return {"success": True, **decode_id(id_number), "raw_texts": all_texts}

    logger.info("OCR FAILED — no 14-digit ID found in digits: %s", raw_digits)
    return {
        "success":    False,
        "message":    "Could not detect a 14-digit national ID number. "
                      "Make sure the full card is visible and well-lit.",
        "raw_texts":  all_texts,
        "raw_digits": raw_digits,   # lets the client show what was found
    }


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/health")
def health():
    return {"status": "ok", "service": "QuickIn Egyptian ID OCR"}


@app.post("/scan")
async def scan_file(file: UploadFile = File(...)):
    """Upload the ID card image as multipart/form-data."""
    data = await file.read()
    if not data:
        raise HTTPException(400, "Empty file")
    return process_image(data)


class Base64Request(BaseModel):
    image: str   # base64-encoded image, optionally with data:image/… prefix


@app.post("/scan-base64")
async def scan_base64(req: Base64Request):
    """Send the ID card image as a base64 string (mobile-friendly)."""
    img_data = req.image
    if "," in img_data:          # strip data:image/jpeg;base64, prefix
        img_data = img_data.split(",", 1)[1]
    try:
        data = base64.b64decode(img_data)
    except Exception:
        raise HTTPException(400, "Invalid base64 image")
    return process_image(data)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=False)
