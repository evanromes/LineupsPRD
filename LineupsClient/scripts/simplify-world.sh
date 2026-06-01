#!/bin/bash
# Simplifies the vendored Natural Earth GeoJSON files and converts them to
# TopoJSON in-place. Reads from the .geojson.bak originals (which the user
# should create from the current admin{0,1}.json files before running this).
#
# Why we do this:
#   - The raw 10m admin1.json is ~22 MB and contains coordinate precision the
#     mobile globe never needs. Simplifying to ~12% vertex retention drops the
#     file to ~1–3 MB with no visible quality difference at 320 px.
#   - TopoJSON shares boundaries between adjacent features and is 30–50%
#     smaller again. The runtime cost to convert back to GeoJSON via
#     topojson-client is negligible.

set -e

cd "$(dirname "$0")/.."

ADMIN1_IN=assets/world/admin1.geojson.bak
ADMIN1_OUT=assets/world/admin1.json
ADMIN0_IN=assets/world/admin0.geojson.bak
ADMIN0_OUT=assets/world/admin0.json
CONTINENTS_OUT=assets/world/continents.json

if [ ! -f "$ADMIN1_IN" ] || [ ! -f "$ADMIN0_IN" ]; then
  echo "Missing backup files. Run these first:"
  echo "  cp $ADMIN0_OUT $ADMIN0_IN"
  echo "  cp $ADMIN1_OUT $ADMIN1_IN"
  exit 1
fi

# Clean up any accidental output from previous broken runs.
rm -f assets/world/admin0.geojson.json assets/world/admin1.geojson.json

echo "─── admin1 (states/provinces): 12% retention, quantization 1e4 ───"
npx mapshaper "$ADMIN1_IN" -simplify visvalingam weighted 12% keep-shapes -o format=topojson quantization=1e4 "$ADMIN1_OUT" force

echo
echo "─── admin0 (countries): 10% retention, quantization 1e4 ───"
# Admin0 is what MiniGlobe shows on the profile card.
npx mapshaper "$ADMIN0_IN" -simplify visvalingam weighted 10% keep-shapes -o format=topojson quantization=1e4 "$ADMIN0_OUT" force

echo
echo "─── continents (dissolved by CONTINENT): 15% retention, quantization 1e4 ───"
# Dissolve internal country borders so we have ~7 continent polygons instead
# of ~250 country polygons. This is what ProfileGlobe renders during drag —
# fewer features → fewer geoPath() calls per frame → smoother gesture.
npx mapshaper "$ADMIN0_IN" -dissolve CONTINENT -simplify visvalingam weighted 15% keep-shapes -o format=topojson quantization=1e4 "$CONTINENTS_OUT" force

echo
echo "─── Result ───"
ls -lh assets/world/
