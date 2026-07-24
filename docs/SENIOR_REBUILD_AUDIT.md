# Senior design and motion rebuild audit

Date: 24 July 2026

## Before-state findings

The rendered contact-sheet build was inspected at loader start, midpoint,
ready, entered hero, and the beginning of the work sequence. The source was
also checked for fixed and sticky layers, motion callbacks, route behavior,
media repetition, audio persistence, and mobile structure.

The loader contained sixteen competing frames and described progress as
`FRAME 124 / 124`. Its dominant image was TOC Oracle, while the requested
portfolio hierarchy requires Rewind to lead. The same four screenshots were
repeated as algorithmic crops, which made the loader appear richer without
adding genuine product evidence.

After entry, the hero immediately identified TOC Oracle as `FRAME 001` and the
work sequence exposed Project 01 without an earned introduction. The hero and
loader were separate compositions, so entry read as a cut rather than a
continuous transformation.

The homepage also treated all four projects as peers. VS Code Clone therefore
competed with three much stronger systems projects instead of operating as an
honest early study.

## Motion and performance findings

- The contact-sheet loader used one GSAP timeline, but it animated sixteen
  independent frame elements.
- Project activation used IntersectionObserver rather than a React update on
  every frame. That is retained.
- No Lenis, WebGL canvas, Three.js renderer, or continuous camera loop remained.
- The existing work stage was sticky and native-scroll-driven.
- The page still had separate loader and hero media, unnecessary fixed-layer
  overlap, and four long homepage project chapters.

## Rebuild decisions

- One persistent three-panel reel now serves loader, hero, and prologue.
- Rewind owns the central dominant panel; TOC Oracle and ASIM are peripheral
  fragments.
- The loader retains an explicit idempotent state reducer and computes progress
  only from fonts, three featured images, and critical interface readiness.
- One finite GSAP loader timeline owns progress, ready, entry, and reveal.
- One ScrollTrigger timeline owns the earned hero prologue and is created once
  after entry, with separate desktop and mobile compositions.
- The first 20% of the prologue holds still. Identity, indices, and the selected
  work threshold arrive in ordered phases before Rewind becomes Project 01.
- The homepage contains only Rewind, TOC Oracle, and ASIM Tracker.
- VS Code Clone lives in `/archive` and remains available as a meaningful case
  route labelled “Early Study.”
- Case studies use one genuine screenshot and one disclosed crop, followed by a
  DOM system composition. Missing genuine states are recorded in
  `CONTENT_NEEDED.md`.
- The work index and About/Contact resolve onto warm ivory. The ASIM-to-About
  transition uses a curved ivory threshold to make the tonal change feel
  intentional.

## Runtime budget

- Native vertical scrolling
- One pinned/sticky prologue stage
- One sticky project-media stage
- One finite loader timeline
- One scoped prologue ScrollTrigger timeline
- IntersectionObserver for project activation
- No continuous rendering loop
- No WebGL
- No synthetic audio

## Verified rendered baseline

At 1280 × 720 after silent entry:

- 6,601 px document height
- 177 DOM nodes
- 9 images
- 0 canvas elements
- 4 fixed-position elements, including navigation and sound controls
- 5 sticky elements, including the authored prologue and work stages
- 1,280 px layout width with no horizontal overflow

The first 100 px of physical scrolling kept the center media at scale `1` and
the project indices at opacity `0`. At the middle checkpoint the indices were
visible while the Selected Work threshold remained hidden. The threshold
resolved near the end of the prologue, before Rewind became the first full
chapter.

The 320 px iframe audit reported a 320 px document width, no horizontal
overflow, a 145 svh normal-motion prologue, and one 76 vw dominant Rewind panel
with two 26 vw peripheral fragments. Reduced motion bypassed the prologue
timeline and kept all core content available.
