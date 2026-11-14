#!/usr/bin/env bash
# Convert a screenshot for the feature pages: 1200x750 WebP, all metadata
# (EXIF/XMP/GPS) stripped. Usage:
#   scripts/process-screenshot.sh [--fit] <input.png|jpg> <name.webp>
#   default: fill 1200x750, cropped from the top
#   --fit:   scale to fit inside 1200x750 and pad with the app's dark background
# Writes src/assets/features/<name.webp>. Check the result for private details
# before committing it.
set -euo pipefail
mode=fill
if [ "${1:-}" = "--fit" ]; then mode=fit; shift; fi
in="$1"; name="$2"
out="src/assets/features/$name"
if [ "$mode" = fit ]; then
  magick "$in" -auto-orient -resize '1136x686>' -background '#111827' -gravity center -extent 1200x750 -strip -quality 85 "$out"
else
  magick "$in" -auto-orient -resize '1200x750^' -gravity north -extent 1200x750 -strip -quality 82 "$out"
fi
left=$(magick identify -format '%[EXIF:*]%[XMP:*]' "$out" 2>/dev/null || true)
if [ -n "$left" ]; then echo "metadata still present in $out" >&2; exit 1; fi
echo "$out: $(magick identify -format '%wx%h %b' "$out"), metadata stripped"
