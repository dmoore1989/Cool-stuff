#!/bin/bash

# Script to convert icon.svg to PNG files at required sizes
# Requires ImageMagick or similar tool

echo "Creating icon files from icon.svg..."

# Check if convert command is available (ImageMagick)
if command -v convert &> /dev/null; then
    echo "Using ImageMagick to convert..."
    convert -background none icon.svg -resize 128x128 icon128.png
    convert -background none icon.svg -resize 48x48 icon48.png
    convert -background none icon.svg -resize 16x16 icon16.png
    echo "✓ Icons created successfully!"
    exit 0
fi

# Check if rsvg-convert is available
if command -v rsvg-convert &> /dev/null; then
    echo "Using rsvg-convert to convert..."
    rsvg-convert -w 128 -h 128 icon.svg -o icon128.png
    rsvg-convert -w 48 -h 48 icon.svg -o icon48.png
    rsvg-convert -w 16 -h 16 icon.svg -o icon16.png
    echo "✓ Icons created successfully!"
    exit 0
fi

# Check if inkscape is available
if command -v inkscape &> /dev/null; then
    echo "Using Inkscape to convert..."
    inkscape icon.svg -w 128 -h 128 -o icon128.png
    inkscape icon.svg -w 48 -h 48 -o icon48.png
    inkscape icon.svg -w 16 -h 16 -o icon16.png
    echo "✓ Icons created successfully!"
    exit 0
fi

echo "❌ No suitable converter found!"
echo ""
echo "Please install one of the following:"
echo "  - ImageMagick: brew install imagemagick (macOS) or apt-get install imagemagick (Linux)"
echo "  - librsvg: brew install librsvg (macOS) or apt-get install librsvg2-bin (Linux)"
echo "  - Inkscape: brew install inkscape (macOS) or apt-get install inkscape (Linux)"
echo ""
echo "Or create the icons manually - see ICONS.md for instructions"
exit 1
