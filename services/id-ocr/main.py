"""
QuickIn Egyptian National ID OCR — StructOCR proxy.

The mobile apps POST the ID photo to THIS backend (same endpoints as before:
/scan and /scan-base64). The backend then calls StructOCR's pre-trained Egyptian
National ID model and returns a unified result. The StructOCR API key lives ONLY
here (env var) — never in the iOS/Android apps, per StructOCR's security guidance.

StructOCR:  POST https://api.structocr.com/v1/national-id
            headers: x-api-key: <key>, Content-Type: application/json
            body:    {"img": "data:image/jpeg;base64,<…>"}
            -> {"success": true, "data": {personal_number, surname, given_names,
                                          sex, date_of_birth, address, …}}

Only stdlib + Pillow are used (no requests/httpx; installs are throttled here).
"""

import io
import os
import re
import json
import base64
import logging
import urllib.request
import urllib.error
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, ExifTags
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Config (env-driven). Drop a `.env` file next to this script with:
#     STRUCTOCR_API_KEY=sk_live_…
# Get a key + 20 free credits at https://structocr.com (each ID scan = 2 credits).
# ---------------------------------------------------------------------------

def _load_dotenv() -> None:
    """Minimal .env loader (python-dotenv isn't installed). KEY=VALUE per line."""
    env_path = Path(__file__).with_name(".env")
    if not env_path.exists():
        return
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        os.environ.setdefault(key.strip(), val.strip().strip('"').strip("'"))


_load_dotenv()

STRUCTOCR_API_KEY = os.environ.get("STRUCTOCR_API_KEY", "").strip()
STRUCTOCR_API_URL = os.environ.get(
    "STRUCTOCR_API_URL", "https://api.structocr.com/v1/national-id"
).strip()
# StructOCR recommends images < 300 KB / ≤ 1920 px for sub-3 s responses.
MAX_DIM = int(os.environ.get("STRUCTOCR_MAX_DIM", "1920"))
JPEG_QUALITY = int(os.environ.get("STRUCTOCR_JPEG_QUALITY", "85"))
HTTP_TIMEOUT = int(os.environ.get("STRUCTOCR_TIMEOUT", "30"))

# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------

app = FastAPI(title="QuickIn Egyptian ID OCR (StructOCR)", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Egyptian ID number decoder — used to enrich StructOCR's output with the
# governorate (which StructOCR doesn't return) and to cross-check birth/gender.
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

_AR_TO_WEST = str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")


def _digits14(value: Optional[str]) -> Optional[str]:
    """Normalise to a 14-digit Western string, or None if it isn't one."""
    if not value:
        return None
    digits = re.sub(r"\D", "", str(value).translate(_AR_TO_WEST))
    return digits if len(digits) == 14 and digits[0] in ("2", "3") else None


def decode_id(id_number: str) -> dict:
    """Derive birth date / governorate / gender from the 14-digit ID number."""
    century = int(id_number[0])
    year_prefix = "19" if century == 2 else "20"
    year  = year_prefix + id_number[1:3]
    month = id_number[3:5]
    day   = id_number[5:7]
    gov   = id_number[7:9]
    gender_digit = int(id_number[12])
    return {
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
    """Rotate so the image matches its EXIF orientation tag (mobile photos)."""
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


def _to_data_url(image_bytes: bytes) -> str:
    """Fix orientation, downscale ≤ MAX_DIM, JPEG-compress, return a data URL."""
    pil = _fix_exif_orientation(Image.open(io.BytesIO(image_bytes)).convert("RGB"))
    pil.thumbnail((MAX_DIM, MAX_DIM))
    buf = io.BytesIO()
    pil.save(buf, format="JPEG", quality=JPEG_QUALITY, optimize=True)
    b64 = base64.b64encode(buf.getvalue()).decode()
    logger.info("Prepared image: %dx%d, %d KB", *pil.size, len(buf.getvalue()) // 1024)
    return f"data:image/jpeg;base64,{b64}"


# ---------------------------------------------------------------------------
# StructOCR call
# ---------------------------------------------------------------------------

def _clean(value) -> Optional[str]:
    """StructOCR uses the literal string 'null' for empty fields — drop those."""
    if value is None:
        return None
    s = str(value).strip()
    return None if s == "" or s.lower() == "null" else s


class StructOCRError(Exception):
    """Carries a client-facing message plus a machine reason for the fallback."""
    def __init__(self, message: str, reason: str):
        super().__init__(message)
        self.message = message
        self.reason = reason          # 'quota' | 'http_error' | 'unreachable'


# Words that mean "you're out of credits / must pay" in StructOCR error bodies.
_QUOTA_WORDS = ("credit", "insufficient", "quota", "payment", "balance", "upgrade", "limit")


def _call_structocr(data_url: str) -> dict:
    """POST the image to StructOCR and return the parsed JSON (raises StructOCRError)."""
    payload = json.dumps({"img": data_url}).encode()
    req = urllib.request.Request(
        STRUCTOCR_API_URL,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "x-api-key": STRUCTOCR_API_KEY,
            "Accept": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=HTTP_TIMEOUT) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="replace")
        logger.warning("StructOCR HTTP %s: %s", e.code, body)
        try:
            parsed = json.loads(body)
            msg = parsed.get("error") or parsed.get("message") or body
        except Exception:
            msg = body or f"StructOCR returned HTTP {e.code}"
        # 402 Payment Required, or 401/403/429 whose body mentions credits/quota → out of credits.
        out_of_credits = e.code == 402 or (
            e.code in (401, 403, 429) and any(w in body.lower() for w in _QUOTA_WORDS)
        )
        if out_of_credits:
            raise StructOCRError(
                "Automatic scanning is temporarily unavailable. Please upload your ID for review.",
                "quota",
            ) from e
        raise StructOCRError(f"StructOCR error (HTTP {e.code}): {msg}", "http_error") from e
    except urllib.error.URLError as e:
        raise StructOCRError(f"Could not reach StructOCR: {e.reason}", "unreachable") from e


def process_image(image_bytes: bytes) -> dict:
    """Send the ID photo to StructOCR and return QuickIn's unified result shape."""
    if not STRUCTOCR_API_KEY:
        logger.error("STRUCTOCR_API_KEY is not set — cannot scan.")
        return {
            "success": False,
            "needs_manual": True,          # clients should offer manual upload
            "reason": "not_configured",
            "message": "Automatic scanning is unavailable right now. "
                       "Please upload your ID for manual review.",
        }

    data_url = _to_data_url(image_bytes)

    try:
        resp = _call_structocr(data_url)
    except StructOCRError as e:
        return {"success": False, "needs_manual": True, "reason": e.reason, "message": e.message}

    # StructOCR returns success as bool true or the string "true".
    ok = resp.get("success") in (True, "true", "True", 1)
    data = resp.get("data") or {}

    if not ok or not data:
        msg = _clean(resp.get("error")) or _clean(resp.get("message")) \
            or "Couldn't read the card automatically. You can upload it for manual review."
        logger.info("StructOCR FAILED: %s", msg)
        return {"success": False, "needs_manual": True, "reason": "unreadable", "message": msg}

    personal_number = _clean(data.get("personal_number"))
    id14 = _digits14(personal_number)

    surname     = _clean(data.get("surname"))
    given_names = _clean(data.get("given_names"))
    full_name   = " ".join(p for p in (given_names, surname) if p) or None

    sex_raw = (_clean(data.get("sex")) or "").upper()
    gender  = {"M": "Male", "F": "Female"}.get(sex_raw)

    result: dict = {
        "success":         True,
        "id_number":       id14 or personal_number,
        "document_number": _clean(data.get("document_number")),
        "full_name":       full_name,
        "first_name":      given_names,
        "last_name":       surname,
        "address":         _clean(data.get("address")),
        "nationality":     _clean(data.get("nationality")),
        "date_of_expiry":  _clean(data.get("date_of_expiry")),
        "birth_date":      _clean(data.get("date_of_birth")),
        "gender":          gender,
        "raw":             data,            # full StructOCR payload for debugging
    }

    # Enrich/cross-check from the 14-digit number (governorate isn't in StructOCR's
    # response; birth date & gender are recomputed as a fallback if StructOCR omits them).
    if id14:
        decoded = decode_id(id14)
        result["governorate"]      = decoded["governorate"]
        result["governorate_code"] = decoded["governorate_code"]
        result.setdefault("birth_date", None)
        result["birth_date"]  = result["birth_date"] or decoded["birth_date"]
        result["birth_year"]  = decoded["birth_year"]
        result["gender"]      = result["gender"] or decoded["gender"]

    logger.info("StructOCR SUCCESS id=%s name=%s gov=%s",
                result.get("id_number"), full_name, result.get("governorate"))
    return result


# ---------------------------------------------------------------------------
# Endpoints (unchanged paths — the iOS/Android apps keep calling /scan-base64)
# ---------------------------------------------------------------------------

@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "QuickIn Egyptian ID OCR (StructOCR)",
        "engine": "structocr",
        "api_key_configured": bool(STRUCTOCR_API_KEY),
        "endpoint": STRUCTOCR_API_URL,
    }


@app.post("/scan")
async def scan_file(file: UploadFile = File(...)):
    """Upload the ID card image as multipart/form-data."""
    data = await file.read()
    if not data:
        raise HTTPException(400, "Empty file")
    return process_image(data)


class Base64Request(BaseModel):
    image: str   # base64-encoded image, optionally with a data:image/… prefix


@app.post("/scan-base64")
async def scan_base64(req: Base64Request):
    """Send the ID card image as a base64 string (what the mobile apps use)."""
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
    if not STRUCTOCR_API_KEY:
        logger.warning("STRUCTOCR_API_KEY not set — scans will return a config error. "
                       "Add it to services/id-ocr/.env (see .env.example).")
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=False)
