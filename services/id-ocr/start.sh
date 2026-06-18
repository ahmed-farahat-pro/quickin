#!/bin/bash
set -e
cd "$(dirname "$0")"

# Create virtualenv if it doesn't exist yet
if [ ! -d ".venv" ]; then
  echo "Creating virtual environment…"
  python3 -m venv .venv
fi

source .venv/bin/activate

# Install/upgrade dependencies
pip install --quiet --upgrade pip
pip install --quiet -r requirements.txt

echo ""
echo "Starting QuickIn Egyptian ID OCR service on http://0.0.0.0:8000"
echo "  POST /scan          — multipart file upload"
echo "  POST /scan-base64   — JSON { image: base64 }"
echo "  GET  /health        — liveness check"
echo ""
echo "Note: first startup downloads EasyOCR models (~2 GB). Subsequent starts are fast."
echo ""

python main.py
