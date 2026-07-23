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

const projectTitles = [
  "TOC Oracle",
  "Rewind",
  "ASIM Tracker",
  "VS Code Clone",
];

test("server-renders the Memory Aperture and complete film corridor", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Ayush — Developer \/ Product Builder<\/title>/i);
  assert.match(html, /AYUSH/);
  assert.match(html, /JHA/);
  assert.match(html, /ENTER WITH SOUND/);
  assert.match(html, /ENTER SILENT/);
  assert.match(html, /LOADING EXPERIENCE/);
  assert.match(html, /Developer \/ Product Builder/i);
  assert.match(html, /SCROLL TO ENTER/);
  assert.match(html, /I build products that make complex systems clearer/);
  assert.match(html, /LET’S BUILD SOMETHING/);
  projectTitles.forEach((title) => assert.match(html, new RegExp(title)));
  assert.equal(
    (html.match(/class="scroll-corridor__chapter"/g) ?? []).length,
    7,
  );
  assert.doesNotMatch(
    html,
    /PROJECT NAME|CATEGORY|YEAR|CASE STUDY|codex-preview|Your site is taking shape/,
  );
});

test("project routes render independent, typed case studies", async () => {
  for (const [index, number] of ["01", "02", "03", "04"].entries()) {
    const response = await render(`/project/${number}`);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, new RegExp(projectTitles[index]));
    assert.match(html, new RegExp(`>${number}<`));
    assert.match(html, /GITHUB REPOSITORY/);
    assert.match(html, /Back to project journey/);
    assert.match(html, /THE WORK/);
    assert.doesNotMatch(html, /loader__aperture|scroll-corridor__chapter/);
    assert.doesNotMatch(
      html,
      /I build products that make complex systems clearer|LET’S BUILD SOMETHING/,
    );
  }
});

test("ships authentic local project media and removes prior placeholders", async () => {
  const expected = [
    "project-oracle.png",
    "rewind.png",
    "asim-tracker.png",
    "vscode-clone.png",
  ];
  for (const filename of expected) {
    const file = new URL(`../public/media/${filename}`, import.meta.url);
    await access(file);
    assert.ok((await stat(file)).size > 20_000);
  }

  const manifest = await readFile(
    new URL("../public/media/README.md", import.meta.url),
    "utf8",
  );
  expected.forEach((filename) => assert.match(manifest, new RegExp(filename)));
  assert.match(manifest, /Ayush’s own public\s+repositories/);

  for (const filename of [
    "ayush-landing-loop.mp4",
    "ayush-landing-poster.webp",
    "ayush-project-01-placeholder.webp",
    "ayush-project-02-placeholder.webp",
    "ayush-project-03-placeholder.webp",
    "ayush-project-04-placeholder.webp",
  ]) {
    await assert.rejects(
      access(new URL(`../public/media/${filename}`, import.meta.url)),
    );
  }
});

test("ships the requested resilient two-deck audio architecture", async () => {
  const ogg = new URL(
    "../public/audio/music/02-beethoven-moonlight-adagio.ogg",
    import.meta.url,
  );
  const mp3 = new URL(
    "../public/audio/music/02-beethoven-moonlight-adagio.mp3",
    import.meta.url,
  );
  const [oggStat, mp3Stat] = await Promise.all([stat(ogg), stat(mp3)]);
  assert.ok(oggStat.size > 5_000_000);
  assert.ok(mp3Stat.size > 5_000_000);

  const [manifest, provider, playlist] = await Promise.all([
    readFile(new URL("../public/audio/README.md", import.meta.url), "utf8"),
    readFile(new URL("../src/audio/AudioProvider.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/audio/playlist.ts", import.meta.url), "utf8"),
  ]);

  for (const stem of [
    "01-chopin-prelude-e-minor",
    "02-beethoven-moonlight-adagio",
    "03-rachmaninoff-elegie",
    "04-chopin-nocturne-c-sharp-minor",
  ]) {
    assert.match(playlist, new RegExp(stem));
  }
  assert.match(provider, /decksRef/);
  assert.match(provider, /CROSSFADE_SECONDS = 7/);
  assert.match(provider, /DEFAULT_VOLUME = 0\.32/);
  assert.match(provider, /MAX_VOLUME = 0\.55/);
  assert.match(provider, /visibilitychange/);
  assert.match(provider, /equalPowerCurve/);
  assert.doesNotMatch(provider, /createOscillator/);
  assert.match(manifest, /Paul Pitman for Musopen/i);
  assert.match(manifest, /Public Domain \(dedicated\)/i);
  assert.match(manifest, /were not present and were not downloaded/i);
});
