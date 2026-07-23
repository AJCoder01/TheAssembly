# Ayush portfolio audio

## Available local score

The repository currently contains one permission-cleared recording:

Ludwig van Beethoven, **Piano Sonata No. 14 in C-sharp minor, Op. 27 No. 2 —
I. Adagio sostenuto**, performed by **Paul Pitman for Musopen**.

- `music/02-beethoven-moonlight-adagio.ogg` is a locally normalized Opus/OGG
  deployment file.
- `music/02-beethoven-moonlight-adagio.mp3` is the 192 kbps MP3 fallback.
- Duration: approximately 5 minutes 36 seconds.
- Preparation target: approximately -16 LUFS and no higher than -1 dBTP.
- Recording status: **Public Domain (dedicated)**.

Licence and provenance:

- Wikimedia Commons:
  https://commons.wikimedia.org/wiki/File:Ludwig_van_Beethoven_-_sonata_no._14_in_c_sharp_minor_%27moonlight%27%2C_op._27_no._2_-_i._adagio_sostenuto.ogg
- IMSLP recording entry: Paul Pitman, Musopen, 2014, Public Domain (dedicated):
  https://imslp.org/wiki/Piano_Sonata_No.14,_Op.27_No.2_(Beethoven,_Ludwig_van)

## Playlist slots awaiting supplied recordings

The root two-deck player already includes the requested four-track order and
detects local files at runtime. It skips a missing source without interrupting
the experience. These recordings were not present and were not downloaded or
substituted:

- `01-chopin-prelude-e-minor`
- `03-rachmaninoff-elegie`
- `04-chopin-nocturne-c-sharp-minor`

Add only Ayush-owned or permission-cleared OGG/MP3 files. See
`docs/AUDIO_PREPARATION.md` for the exact paths and normalization workflow.

## Sound effects

No synthetic or oscillator-generated effects are used. Optional recorded Foley
files may be added under `audio/sfx/` using the names in
`src/audio/playlist.ts`. Missing effects deliberately remain silent.

The reserved projection-archive filenames are:

- `projector-start.mp3`
- `film-thread.mp3`
- `frame-stop.mp3`
- `projection-focus.mp3`
- `project-enter.mp3`
- `project-exit.mp3`
- `projector-stop.mp3`

Only use Ayush-owned or permission-cleared recordings.
