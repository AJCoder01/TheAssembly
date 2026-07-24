import assert from "node:assert/strict";
import { access, readFile, stat } from "node:fs/promises";
import test from "node:test";

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${pathname}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${pathname}`, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

const projects = [
  ["rewind", "Rewind"],
  ["toc-oracle", "TOC Oracle"],
  ["asim-tracker", "ASIM Tracker"],
  ["vscode-clone", "VS Code Clone"],
];

test("server-renders the three-panel reel, stable hero, and three featured projects", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();

  assert.match(
    html,
    /<title>Ayush Jha — Product Builder &amp; Developer<\/title>/i,
  );
  assert.match(html, /data-loader-phase="IDLE"/);
  assert.match(html, /reel-panel--left/);
  assert.match(html, /reel-panel--center/);
  assert.match(html, /reel-panel--right/);
  assert.match(html, /aria-label="Loading progress"/);
  assert.match(html, /ENTER WITH SOUND/i);
  assert.match(html, /ENTER SILENT/i);
  assert.match(html, /<h1>Ayush Jha<\/h1>/);
  assert.match(html, /Product builder \/ developer/);
  assert.match(html, /Scroll to begin/);
  assert.match(html, /03 projects/i);
  assert.equal((html.match(/data-project-chapter="true"/g) ?? []).length, 3);
  assert.doesNotMatch(html, /contact-sheet|FRAME 124|ASSEMBLING FRAMES/);
  assert.doesNotMatch(html, /VS Code Clone/);
});

test("featured order is Rewind, TOC Oracle, ASIM Tracker", async () => {
  const html = await (await render()).text();
  assert.deepEqual(
    [...html.matchAll(/data-project="(\d)"/g)]
      .slice(0, 3)
      .map((match) => match[1]),
    ["0", "1", "2"],
  );
  const chapterTitles = [...html.matchAll(/<h2>(Rewind|TOC Oracle|ASIM Tracker)<\/h2>/g)]
    .slice(0, 3)
    .map((match) => match[1]);
  assert.deepEqual(chapterTitles, ["Rewind", "TOC Oracle", "ASIM Tracker"]);
});

test("work index is ivory, ordered, and labels the archive entry honestly", async () => {
  const response = await render("/work");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Work Index/);
  assert.match(html, /Early Study/);
  let previous = -1;
  for (const [slug, title] of projects) {
    assert.match(html, new RegExp(`/work/${slug}`));
    assert.match(html, new RegExp(title));
    const position = html.indexOf(title);
    assert.ok(position > previous);
    previous = position;
  }
  assert.doesNotMatch(html, /ENTER WITH SOUND|Let’s build something/);
});

test("archive owns the VS Code early study", async () => {
  const response = await render("/archive");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Archive \/ Early studies/i);
  assert.match(html, /Foundations before systems/);
  assert.match(html, /VS Code Clone/);
  assert.match(html, /Early Study/);
  assert.match(html, /\/work\/vscode-clone/);
  assert.doesNotMatch(html, /Rewind full recovery interface|TOC Oracle full/);
});

test("meaningful routes render distinct evidence-led case studies", async () => {
  for (const [slug, title] of projects) {
    const response = await render(`/work/${slug}`);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, new RegExp(title));
    assert.match(html, /GITHUB REPOSITORY/);
    assert.match(html, /Back to selected work/);
    assert.match(html, /THE PROBLEM/);
    assert.match(html, /THE DECISION/);
    assert.match(html, /THE RESULT/);
    assert.match(html, /TECHNICAL NOTE/);
    assert.match(html, /same captured state/);
    assert.match(html, /System \//);
    assert.match(html, /case-evidence__detail/);
    assert.match(html, /media\/crops\//);
    assert.doesNotMatch(html, /loader-ui|Product builder \/ developer/);
  }
});

test("legacy numeric routes follow the new editorial numbering", async () => {
  for (const [index, [slug]] of projects.entries()) {
    const response = await render(`/project/0${index + 1}`);
    assert.ok([301, 302, 307, 308].includes(response.status));
    assert.match(
      response.headers.get("location") ?? "",
      new RegExp(`/work/${slug}$`),
    );
  }
});

test("ships deliberate media without claiming crop variety", async () => {
  for (const filename of [
    "rewind.png",
    "project-oracle.png",
    "asim-tracker.png",
    "vscode-clone.png",
  ]) {
    const file = new URL(`../public/media/${filename}`, import.meta.url);
    await access(file);
    assert.ok((await stat(file)).size > 20_000);
  }

  const [caseStudy, contentNeeded] = await Promise.all([
    readFile(new URL("../app/ProjectCaseStudy.tsx", import.meta.url), "utf8"),
    readFile(new URL("../docs/CONTENT_NEEDED.md", import.meta.url), "utf8"),
  ]);
  assert.match(caseStudy, /gallery\[1\]/);
  assert.doesNotMatch(caseStudy, /project\.gallery\.map/);
  assert.match(caseStudy, /same captured state/);
  assert.match(contentNeeded, /second genuine/i);
  assert.match(contentNeeded, /Do not export 4K/i);
});

test("uses one native-scroll DOM motion architecture with scoped teardown", async () => {
  const [home, packageJson] = await Promise.all([
    readFile(new URL("../app/HomeExperience.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  assert.match(
    home,
    /"IDLE"\s*\|\s*"LOADING"\s*\|\s*"READY"\s*\|\s*"WAITING_FOR_ENTRY"\s*\|\s*"ENTERING"\s*\|\s*"COMPLETE"/,
  );
  assert.match(home, /loaderTimelineRef/);
  assert.match(home, /ScrollTrigger/);
  assert.match(home, /gsap\.context/);
  assert.match(home, /gsap\.matchMedia/);
  assert.match(home, /context\.revert/);
  assert.match(home, /IntersectionObserver/);
  assert.match(home, /enteredOnceRef/);
  assert.match(home, /window\.sessionStorage\.setItem\("ayush:home-scroll"/);
  assert.doesNotMatch(home, /gsap\.ticker|WebGL|THREE|setInterval/);
  assert.doesNotMatch(
    home,
    /requestAnimationFrame\s*\([^)]*=>[^)]*setActiveProject/,
  );
  assert.doesNotMatch(packageJson, /"lenis"|"three"|"@types\/three"/);
});

test("ships resilient persistent classical audio and compact controls", async () => {
  const [oggStat, mp3Stat] = await Promise.all([
    stat(
      new URL(
        "../public/audio/music/02-beethoven-moonlight-adagio.ogg",
        import.meta.url,
      ),
    ),
    stat(
      new URL(
        "../public/audio/music/02-beethoven-moonlight-adagio.mp3",
        import.meta.url,
      ),
    ),
  ]);
  assert.ok(oggStat.size > 5_000_000);
  assert.ok(mp3Stat.size > 5_000_000);

  const [provider, playlist, controls] = await Promise.all([
    readFile(new URL("../src/audio/AudioProvider.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/audio/playlist.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/audio/SoundControls.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(provider, /decksRef/);
  assert.match(provider, /CROSSFADE_SECONDS = 7/);
  assert.match(provider, /DEFAULT_VOLUME = 0\.38/);
  assert.match(provider, /MAX_VOLUME = 0\.6/);
  assert.match(provider, /equalPowerCurve/);
  assert.match(provider, /visibilitychange/);
  assert.doesNotMatch(provider, /createOscillator/);
  assert.match(controls, /max="60"/);
  assert.match(controls, /Sound options and music credit/);
  assert.doesNotMatch(controls, /padStart/);
  assert.match(playlist, /Recording not yet supplied/);
  assert.match(playlist, /beethoven-moonlight-adagio/);
});

test("bundles Bodoni Moda, Instrument Sans, and IBM Plex Mono locally", async () => {
  const [layout, packageJson, fontNotes] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../docs/FONTS_NEEDED.md", import.meta.url), "utf8"),
  ]);
  assert.match(layout, /@fontsource-variable\/bodoni-moda/);
  assert.match(layout, /@fontsource-variable\/instrument-sans/);
  assert.match(layout, /@fontsource\/ibm-plex-mono/);
  assert.doesNotMatch(layout, /instrument-serif/);
  assert.match(packageJson, /@fontsource-variable\/bodoni-moda/);
  assert.match(fontNotes, /no runtime Google Fonts request/i);
});

test("placeholder validation rejects production filler", async () => {
  const validator = await readFile(
    new URL("../scripts/validate-content.mjs", import.meta.url),
    "utf8",
  );
  for (const fragment of [
    '["PROJECT", "NAME"]',
    '["CATE", "GORY"]',
    '["PLACE", "HOLDER"]',
    '["LOREM", "IPSUM"]',
    '["YOUR", "EMAIL"]',
  ]) {
    assert.match(
      validator,
      new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    );
  }
});
