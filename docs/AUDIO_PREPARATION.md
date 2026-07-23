# Audio preparation

Only recordings and Foley files that Ayush owns or has permission to publish
belong in `public/audio`.

The browser does not normalize recordings in real time. Prepare each approved
source with FFmpeg before deployment:

```bash
ffmpeg -i input.wav \
  -af "loudnorm=I=-16:LRA=11:TP=-1:print_format=summary" \
  -ar 44100 -c:a libmp3lame -b:a 192k output.mp3
```

For a two-pass result, run the filter once with `print_format=json`, then supply
the measured input values in a second `loudnorm` pass. Target:

- integrated loudness: approximately -16 LUFS
- true peak: no higher than -1 dBTP
- 44.1 kHz or 48 kHz sample rate

Expected music paths:

```text
public/audio/music/01-chopin-prelude-e-minor.mp3
public/audio/music/02-beethoven-moonlight-adagio.mp3
public/audio/music/03-rachmaninoff-elegie.mp3
public/audio/music/04-chopin-nocturne-c-sharp-minor.mp3
```

OGG versions with matching base names are preferred when supplied; MP3 remains
the fallback. Never synthesize or substitute a missing composition.

Expected Foley paths are documented in `src/audio/playlist.ts`. Missing Foley
fails silently and deliberately rather than being replaced with procedural
sound.
