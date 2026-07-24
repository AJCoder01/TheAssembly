# Current Site Audit

Date: 24 July 2026  
Audited build: `0dc87f18cc3089905768c5a69b2ebe1706b1b4de`

## Scope

The audit covers the deployed Projection Archive build and its local equivalent
before the Living Contact Sheet rebuild. The desktop loader, entry, every
homepage scene, direct project routes, project open/Back behavior, persistent
audio, mobile hero, reduced-motion fallback, source architecture, media
inventory, fonts, motion loops, fixed layers, and production checks were
inspected.

Reference study informed the rebuild without copying assets or layouts:

- Siena Film Foundation: contact-sheet pacing, image-led sequencing, and film
  frames used as editorial structure.
- Maël Ruffini — Portfolio 2025: media continuity between an index, project
  hero, and reverse route transition.
- 0110 Studio: clear stable states, deliberate desktop/mobile differentiation,
  and a final state that resolves instead of looping forever.
- Ethan & Tom: distinct immersive and conventional navigation modes.
- Pacôme Pertant: explicit sound permission, persistent music, and silence used
  as part of the rhythm.

## Recorded before-state

Audit captures are stored outside the source tree in the Codex visualization
workspace:

- Loader: initial, midpoint, and ready states.
- Entry and stable hero.
- Seven desktop scroll checkpoints from hero through Contact.
- Project opening and browser Back.
- Mobile hero at the browser's reliable mobile-width minimum.

At 1280 × 720 the homepage measured:

- 5,040 px document height.
- 1 WebGL canvas.
- 8 fixed-position elements.
- 0 sticky elements.
- 7 full-viewport scroll spacer chapters.

Physical wheel input advanced the authored scene state at roughly 600–640 px
per checkpoint, but the visual interpolation continued after each wheel event.
This creates the feeling that input and camera movement are separated.

## Loader glitches and composition problems

- The loader is three independent full-width film strips plus a fourth selected
  frame. The strips compete at the same visual weight instead of forming one
  composed contact sheet.
- The loader is nearly all black at every progress state, so progress changes
  are difficult to read without the counter.
- All 24 strip cells render project images immediately, despite only a few
  images being critical above the fold.
- The selected frame is another layer over the strips. At intermediate states
  the layers overlap and produce a visually muddy centre.
- The loader is controlled by several independent CSS transitions whose visual
  completion is inferred from a timeout. There is no explicit idempotent state
  reducer for `IDLE → LOADING → READY → WAITING_FOR_ENTRY → ENTERING →
  COMPLETE`.
- Entry is guarded by React phase state, but the transition, Foley timers, CSS
  strip movement, selected-frame expansion, and unmount visibility are not one
  master timeline.
- The loader has debug progress support and real critical-asset progress, which
  are useful and should be preserved conceptually.

## Scroll and motion architecture

There are two continuous callbacks on the global GSAP ticker:

1. `HomeExperience.tsx` adds a Lenis callback that calls `lenis.raf()`.
2. `WebGLStage.tsx` adds a render callback that updates the complete Three.js
   scene and calls `renderer.render()` every tick.

Other animation scheduling:

- `HomeExperience.tsx` uses `requestAnimationFrame` to move to READY, focus the
  Index close control, restore scroll, and coordinate route navigation.
- `ScrollTrigger.update()` runs from the Lenis scroll event even though the
  homepage creates no authored ScrollTrigger instance.
- Global `ScrollTrigger.getAll().forEach(kill)` runs during homepage teardown.
- `ResizeObserver` resizes the WebGL renderer.
- CSS transitions animate loader strips, the selected frame, navigation,
  project labels, Index, project-route media, and several overlays.
- Native View Transitions are invoked by homepage project opening and project
  route navigation.

Positive findings:

- Lenis uses the GSAP ticker instead of a second manual RAF.
- Both GSAP ticker callbacks are removed during teardown.
- Lenis is destroyed during teardown.
- Three.js textures, materials, geometries, observers, listeners, renderer, and
  canvas are disposed.
- DPR is capped at 1.5 on desktop and 1.05 on mobile.
- The canvas stops rendering while the page is hidden.

Root problem:

Even though teardown is competent, the complete WebGL world still renders
continuously during ordinary reading. Camera position, look target, project
visibility, architecture opacity, project-specific meshes, route distortion,
pointer response, and contact convergence are all recalculated every frame.
This is unnecessary for mostly stable editorial content.

## WebGL costs

- Four projection groups remain resident in one scene.
- Each group includes a screen shader, architectural planes, beam, light, and
  project-specific geometry.
- Rewind adds echo shader layers.
- VS Code adds four shader fragments.
- ASIM updates four signal dots every frame.
- About and Contact retain canvas work even though they should be DOM-only.
- Every texture is eventually loaded into the shared scene.
- The design requires fixed DOM overlays to make basic text and links usable
  over the canvas.

Delete the scrolling WebGL stage. Basic project visibility must be DOM-owned.
If WebGL remains at all, restrict it to a short shared-image route transition
or another finite interaction that renders on demand.

## Route architecture

Current strengths:

- Project routes contain real typed project content.
- Direct `/project/01` through `/project/04` routes render independently.
- Project routes do not render loader, homepage hero, homepage projects,
  homepage About, or homepage Contact.
- Project open/Back restores the correct homepage project and its 1,440 px
  scroll position in the audited Rewind case.
- The persistent root audio provider remains mounted during client navigation.

Problems:

- Numeric URLs are less meaningful and less shareable than work slugs.
- There is no standalone `/work` index route.
- Shared-image continuity is approximated with a fixed route proxy plus native
  View Transitions; the selected homepage media and project hero are still
  separate visible elements during parts of the transition.
- The route hero repeats the same source image again in a three-image crop grid.
- Project media direction is not typed; object position, aspect ratio, and
  treatment live in generic CSS selectors.

Replace with:

- `/work`
- `/work/toc-oracle`
- `/work/rewind`
- `/work/asim-tracker`
- `/work/vscode-clone`

Keep redirects or compatibility handling for the existing numeric routes.

## Media loading

Current production media:

- Beethoven OGG: 7.57 MB.
- Beethoven MP3: 8.06 MB.
- Social image: 2.01 MB.
- Four project PNGs: approximately 52–64 KB each.
- No project videos are present.

Findings:

- Project screenshots are reasonably small but each project reuses one source
  as hero, alternate crop, detail crop, loader frame, index preview, and
  homepage texture.
- The loader preloads every project image even though only the hero and first
  project are critical.
- The audio availability check sends HEAD requests for every requested format
  in the four-track playlist.
- Missing playlist tracks fail safely and are skipped.
- No 4K media or continuously decoding video exists.

The rebuild should create typed crop metadata and use the existing images in
meaningfully different compositions instead of repeating the same generic crop
grid.

## Fonts

The current build legally ships:

- Instrument Serif 400 and 400 italic.
- Instrument Sans Variable.
- IBM Plex Mono 400.

The loading strategy uses local npm font packages imported from the root layout,
so no third-party font request or pirated file is involved. The families are
appropriate legal fallbacks. The problem is usage, not sourcing:

- Extremely large display type appears in nearly every section.
- Metadata is mostly 8 px uppercase mono with long letter spacing.
- Large type competes with large projected interface text.
- Route titles use text shadow and oversized overlap to stay readable over
  media.

Retain the three legal families, remove text shadows, reduce uppercase and
tracking, and use large display type selectively.

## Mobile problems

- Mobile still instantiates the same WebGL scene, with only a lower DPR and
  adjusted camera path.
- The hero uses very large split name fragments around a narrow projection mask.
  It remains visually dramatic but leaves little space for project
  communication.
- Project chapters are fixed overlays on the canvas instead of normal-flow
  media blocks.
- The design depends on the canvas being healthy; the DOM fallback is reserved
  for reduced motion or WebGL failure.
- Native scrolling is correctly used on mobile, and pointer effects are
  disabled.
- The loader is simplified to one strip, but it is still an adaptation of the
  desktop strip rather than a designed six-to-eight-cell contact sheet.

## Audio

Strengths to preserve:

- One persistent `AudioProvider` in the root layout.
- Two audio decks with equal-power seven-second crossfade.
- Track index, playback position, volume, sound preference, and route continuity
  are persisted.
- Explicit sound/silent entry is required.
- Music remained enabled when navigating in the audited session.
- Beethoven Movement I is a real permission-cleared local recording.
- Missing recordings do not break silent mode.
- No oscillator or procedurally generated music exists.
- Optional Foley files fail silently when absent.

Problems:

- Default volume is 32%, slightly below the requested 35–40% target.
- The existing filename convention differs from the new expected shorthand
  paths, though the current files are valid and documented.
- The loader and scene-change Foley calls are more numerous than the new system
  needs.
- Audio HEAD checks are part of loader readiness even though only one available
  score is needed to enter.

Retain the provider, raise the default to 38%, keep the 0–60% accessible range,
and reduce Foley events to authored state changes.

## Accessibility

Strengths:

- Skip link.
- Semantic headings and project regions.
- Accessible sound toggle, slider, and credits.
- Keyboard-focusable Index.
- Escape closes the Index.
- Reduced-motion DOM fallback.
- Direct project links remain available without the canvas.
- Missing WebGL preserves content.

Problems:

- Hidden homepage scenes remain in the accessibility tree; only their links are
  removed from tab order.
- Loader entry uses `aria-hidden` while its disabled controls remain mounted.
- The Index is hidden with `aria-hidden` rather than `inert`, so focus
  containment relies on manual tab-index changes.
- Multiple full-screen fixed layers make reading order and visible order
  difficult to compare.
- 8 px metadata is too small for comfortable reading.
- The mobile design has little tolerance for text scaling.

## Fixed and global layers

The current homepage uses eight fixed-position layers:

- Skip link.
- WebGL or reduced-motion stage.
- Loader.
- Global navigation.
- Sound dock.
- Work Index overlay.
- Scene overlay.
- Route transition proxy.

There are no sticky elements. The rebuild should replace this stack with:

- One loader overlay that unmounts.
- One sticky DOM media stage.
- Minimal navigation and sound controls.
- One finite route-transition layer only while navigation is active.

## Placeholder and duplication audit

- No production-visible placeholder email, lorem ipsum, fake project title,
  empty project description, or generic image alt text was found.
- The production validation already rejects several old placeholder strings.
- Project routes do not duplicate homepage sections.
- The validation should be expanded to the new forbidden-string list and new
  route architecture.

## Preserve

- Typed real project facts and case-study writing.
- Four authentic project screenshots.
- Repository links and real email.
- Persistent audio provider and public-domain Beethoven recording.
- Sound/silent entry and accessible volume control.
- Scroll-position and active-project restoration logic.
- Direct route rendering and no-script fallback.
- Instrument Serif, Instrument Sans, and IBM Plex Mono.
- Production build content validation.
- Sites/Vercel deployment structure.

## Delete or replace

- `WebGLStage.tsx` as the homepage rendering authority.
- Projection room, camera path, walls, floor, beams, fog, and floating screens.
- Three-strip film loader.
- Fixed scene overlay plus empty seven-viewport corridor.
- Lenis as the default scroll authority.
- Unused ScrollTrigger integration.
- Numeric routes as the primary public URLs.
- Repeated one-image route crop grid.
- Dark background for every project and route.
- Continuous pointer-driven shader response.
- Continuous contact convergence.
- Route text shadows and oversized title overlap.

## Rebuild decision

The new homepage will be DOM-first:

1. A composed moving contact sheet with one finite GSAP loader timeline.
2. A stable contact-sheet-derived hero.
3. One sticky editorial media stage with normal-flow project chapters.
4. Native vertical scroll as the only scroll authority.
5. Authored state transitions that settle instead of continuous camera motion.
6. DOM-only warm About and split Contact ending.
7. A conventional warm `/work` index.
8. Meaningful project slugs with typed crop metadata.
9. No continuous WebGL render loop.

