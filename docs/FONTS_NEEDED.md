# Font files that can replace the legal fallbacks

The current build uses locally bundled, open-source fallbacks:

- Display: Instrument Serif Regular and Italic
- Interface: Instrument Sans Variable
- Metadata: IBM Plex Mono Regular

No premium files were present in the repository, so none were downloaded or
substituted from an unlicensed source.

When Ayush supplies licensed files, place only the weights used by the site in:

```text
/public/fonts/editorial-new/
  PPEditorialNew-Ultralight.woff2
  PPEditorialNew-Regular.woff2
  PPEditorialNew-Italic.woff2

/public/fonts/neue-montreal/
  NeueMontreal-Book.woff2
  NeueMontreal-Regular.woff2
  NeueMontreal-Medium.woff2

/public/fonts/suisse-mono/
  SuisseIntlMono-Regular.woff2
```

After the files and their web-embedding licences are confirmed, connect them
with `next/font/local` in `app/layout.tsx`. Preload only the display and
interface weights used above the fold.
