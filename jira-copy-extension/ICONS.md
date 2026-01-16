# Icon Files

The extension requires three icon files:
- `icon16.png` (16x16 pixels)
- `icon48.png` (48x48 pixels)
- `icon128.png` (128x128 pixels)

## Quick Icon Creation Options

### Option 1: Use an Online Generator

Visit [favicon.io](https://favicon.io/favicon-generator/) or similar tools:
1. Create a simple icon (e.g., letter "J" on blue background)
2. Download the generated files
3. Rename them to match the required sizes
4. Place them in the extension root directory

### Option 2: Create with ImageMagick (if installed)

```bash
# Create a simple blue square with white "J"
convert -size 128x128 xc:#0052CC -gravity center -pointsize 80 -fill white -annotate +0+0 'J' icon128.png
convert icon128.png -resize 48x48 icon48.png
convert icon128.png -resize 16x16 icon16.png
```

### Option 3: Use Existing Jira Icon

Find a Jira logo online and resize it to the required dimensions.

### Option 4: Simple Placeholder

Create simple colored squares as placeholders:
- Use any image editor
- Create 16x16, 48x48, and 128x128 pixel images
- Fill with blue (#0052CC)
- Save as PNG files

## Note

The extension will work without icons, but Chrome will show a default placeholder icon instead. For a professional look, create proper icons before deploying.
