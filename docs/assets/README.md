# Assets

## social-preview.png

A 1280x640 image for the repository social preview. GitHub has no API for this setting, so a maintainer uploads it by hand under **Settings > General > Social preview**.

`social-preview.svg` is the editable source. The image uses the system fonts DejaVu Sans and DejaVu Sans Mono (free licences), with Liberation fonts as fallbacks, and embeds no web fonts. It contains no WhatsApp or Meta logos.

To regenerate the PNG after editing the SVG:

```sh
rsvg-convert -w 1280 -h 640 docs/assets/social-preview.svg -o docs/assets/social-preview.png
```

`rsvg-convert` comes with librsvg. Any SVG renderer that outputs 1280x640 works. Keep the file under 1 MB. These files are not part of the npm package, which only ships `dist`.
