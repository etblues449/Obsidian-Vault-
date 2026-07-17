# PWA Icons Setup

Your JARVIS Carousel is now a PWA! To complete the setup, you need to add icons to the `public/` directory.

## Required Icons

Create these PNG files in `public/`:

1. **icon-192.png** — 192×192 px (rounded square)
2. **icon-512.png** — 512×512 px (rounded square)
3. **icon-maskable-192.png** — 192×192 px (solid color, no transparency; for adaptive icons)
4. **icon-maskable-512.png** — 512×512 px (solid color, no transparency; for adaptive icons)
5. **screenshot-540x720.png** — 540×720 px (portrait, for app store)
6. **screenshot-1280x720.png** — 1280×720 px (landscape, for app store)

## Quick Icon Generation

### Using GIMP or Photoshop
1. Create a 512×512 design with JARVIS branding (coral #E07856 accent)
2. Export as PNG with rounded corners
3. Duplicate & resize to 192×192 for smaller icon
4. For maskable versions: ensure solid background, no transparency

### Using Online Tools
- [Favicon Generator](https://www.favicon-generator.org) — Upload your logo
- [PWA Icon Generator](https://www.pwabuilder.com/imageGenerator) — Generates all sizes at once
- [Maskable Icon Editor](https://maskable.app) — Test & create adaptive icons

### Using ImageMagick (CLI)
```bash
# Resize 512px icon to 192px
convert icon-512.png -resize 192x192 icon-192.png

# Create maskable version (solid background)
convert icon-512.png -background none -gravity center -extent 512x512 -fill "#1a1a1a" -colorize 50% icon-maskable-512.png
```

## Installation Instructions for Users

Once icons are in place, users can install JARVIS on their Fold 7:

**On Samsung:**
1. Open `https://jarvis-carousel.vercel.app` in Chrome/Samsung Internet
2. Tap the **+** icon (top-right menu) → "Add app to home screen"
3. Confirm
4. App appears on home screen as native app

**Features:**
- ✅ Full-screen mode (no URL bar)
- ✅ Offline support (cached slides)
- ✅ Fast load (cached assets)
- ✅ Works like native app

## Testing Locally

After adding icons, test PWA locally:

```bash
pnpm install
pnpm build
pnpm start
```

Then:
1. Open `http://localhost:3000`
2. Chrome DevTools → Application → Manifest
3. Verify all icons load
4. Test "Add to home screen" feature

## Deployment

Push your changes and deploy to Vercel:

```bash
git add .
git commit -m "feat: Add PWA support with manifest and icons"
git push origin claude/pake-cli-global-install-g52ma0
```

Vercel auto-deploys, and your PWA is live!

---

**Note:** Icons are the only remaining step. Everything else is configured.
