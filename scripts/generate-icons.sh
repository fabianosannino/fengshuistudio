#!/bin/bash
# Generate PWA icons from SVG
# Requires: npm install -g svgexport OR use an online tool
#
# If you don't have svgexport, use any of these alternatives:
# 1. https://realfavicongenerator.net (upload the SVG)
# 2. https://www.pwabuilder.com/imageGenerator
# 3. Figma/Canva export
#
# Place the generated files as:
#   public/icons/icon-192.png (192x192)
#   public/icons/icon-512.png (512x512)

echo "Generating PWA icons..."

if command -v npx &> /dev/null; then
  npx svgexport public/icons/icon.svg public/icons/icon-192.png 192:192 2>/dev/null || echo "svgexport not available"
  npx svgexport public/icons/icon.svg public/icons/icon-512.png 512:512 2>/dev/null || echo "svgexport not available"
fi

echo ""
echo "If icons were not generated, create them manually:"
echo "  1. Open public/icons/icon.svg in a browser"
echo "  2. Screenshot or export as PNG at 192x192 and 512x512"
echo "  3. Save as public/icons/icon-192.png and icon-512.png"
