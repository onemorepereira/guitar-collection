#!/usr/bin/env bash
# Convert a screenshot for the feature pages: 1200x750 WebP, cropped from the
# top, all metadata (EXIF/XMP/GPS) stripped. Usage:
#   scripts/process-screenshot.sh <input.png|jpg> <name.webp>
# Writes src/assets/features/<name.webp>. Check the result for private details
# before committing it.
set -euo pipefail
in="$1"; name="$2"
out="src/assets/features/$name"
magick "$in" -auto-orient -resize '1200x750^' -gravity north -extent 1200x750 -strip -quality 82 "$out"
left=$(magick identify -format '%[EXIF:*]%[XMP:*]' "$out" 2>/dev/null || true)
if [ -n "$left" ]; then echo "metadata still present in $out" >&2; exit 1; fi
echo "$out: $(magick identify -format '%wx%h %b' "$out"), metadata stripped"
