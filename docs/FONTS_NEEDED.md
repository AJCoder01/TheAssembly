# Typography sourcing

The production build bundles three open-source families locally through
Fontsource. It makes no runtime Google Fonts request:

- Display: Bodoni Moda Variable
- Interface: Instrument Sans Variable
- Metadata: IBM Plex Mono Regular

Bodoni Moda replaces the previous Instrument Serif display fallback. Its
variable optical-size and weight axes support the restrained regular/light
editorial setting used for Ayush Jha, project titles, About, and Contact.

No premium files were present in the repository, and no unlicensed substitutes
were downloaded.

If Ayush later supplies licensed brand fonts, put only the web-licensed weights
used by the site in `/public/fonts/` and connect them with `next/font/local`.
Preload only the above-the-fold display and interface weights. The current
families are legitimate production fonts and do not block deployment.
