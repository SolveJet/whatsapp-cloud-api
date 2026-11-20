# Assets

## social-preview.png

A 1280x640 image for the repository social preview. GitHub has no API for this setting, so a maintainer uploads it by hand under **Settings > General > Social preview**.

`social-preview.html` is the editable source. It is styled with Tailwind (Play CDN), uses [Lucide](https://lucide.dev) icons (ISC licence), and the Inter and JetBrains Mono fonts from Google Fonts (SIL Open Font License). All of them load from CDNs, so rendering needs network access. The image contains no WhatsApp or Meta logos.

To regenerate the PNG after editing the HTML, install Playwright outside the repo and run the render script:

```sh
npm install --prefix /tmp/pw playwright
npx --prefix /tmp/pw playwright install chromium
node docs/assets/render-social-preview.mjs
```

The script looks for Playwright in `/tmp/pw`. Set `PLAYWRIGHT_DIR` to use another location. It waits for fonts and icons, fails if an icon did not render, and writes `social-preview.png`. Keep the PNG under 1 MB. These files are not part of the npm package, which only ships `dist`.
