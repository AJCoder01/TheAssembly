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
  ["toc-oracle", "TOC Oracle"],
  ["rewind", "Rewind"],
  ["asim-tracker", "ASIM Tracker"],
  ["vscode-clone", "VS Code Clone"],
];

test("server-renders the contact-sheet loader and complete editorial journey", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();

  assert.match(
    html,
    /<title>Ayush Jha — Product Builder &amp; Developer<\/title>/i,
  );
  assert.match(html, /data-loader-phase="IDLE"/);
  assert.match(html, /contact-sheet/);
  assert.match(html, /aria-label="Loading progress"/);
  assert.match(html, /FRAME/);
  assert.match(html, /124/);
  assert.match(html, /ENTER WITH SOUND/);
  assert.match(html, /ENTER SILENT/);
  assert.match(html, /PRODUCT BUILDER \/ DEVELOPER/);
  assert.match(html, /SELECTED WORK/);
  assert.match(
    html,
    /I build products that make complex systems easier to understand and control/,
  );
  assert.match(html, /LET’S BUILD SOMETHING/);
  projects.forEach(([, title]) => assert.match(html, new RegExp(title)));
  assert.equal((html.match(/data-project-chapter="true"/g) ?? []).length, 4);
  assert.doesNotMatch(
    html,
    /scroll-corridor|film-loader__strips|projection-room|floating-screen/,
  );
});

test("work index is fast, conventional, and links meaningful routes", async () => {
  const response = await render("/work");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Work Index/);
  assert.match(html, /warm|work-index/i);
  for (const [slug, title] of projects) {
    assert.match(html, new RegExp(`/work/${slug}`));
    assert.match(html, new RegExp(title));
  }
  assert.doesNotMatch(html, /ENTER WITH SOUND|LET’S BUILD SOMETHING/);
});

test("meaningful project routes render distinct real case studies", async () => {
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
    assert.match(html, /media\/crops/);
    assert.doesNotMatch(
      html,
      /contact-loader|PRODUCT BUILDER \/ DEVELOPER|LET’S BUILD SOMETHING/,
    );
  }
});

test("legacy numeric project routes redirect to meaningful slugs", async () => {
  for (const [index, [slug]] of projects.entries()) {
    const response = await render(`/project/0${index + 1}`);
    assert.ok([301, 302, 307, 308].includes(response.status));
    assert.match(response.headers.get("location") ?? "", new RegExp(`/work/${slug}$`));
  }
});

test("ships real media with deliberate crop metadata", async () => {
  const originals = [
    "project-oracle.png",
    "rewind.png",
    "asim-tracker.png",
    "vscode-clone.png",
  ];
  for (const filename of originals) {
    const file = new URL(`../public/media/${filename}`, import.meta.url);
    await access(file);
    assert.ok((await stat(file)).size > 20_000);
  }

  for (const filename of [
    "toc-oracle-detail.jpg",
    "toc-oracle-wide.jpg",
    "rewind-detail.jpg",
    "rewind-wide.jpg",
    "asim-detail.jpg",
    "asim-wide.jpg",
    "vscode-detail.jpg",
    "vscode-wide.jpg",
  ]) {
    const file = new URL(`../public/media/crops/${filename}`, import.meta.url);
    await access(file);
    assert.ok((await stat(file)).size > 8_000);
  }

  const data = await readFile(
    new URL("../app/projectData.ts", import.meta.url),
    "utf8",
  );
  assert.match(data, /desktopPosition/);
  assert.match(data, /mobilePosition/);
  assert.match(data, /aspectRatio/);
  assert.match(data, /treatment/);
});

test("uses one native-scroll, DOM-first motion architecture", async () => {
  const [home, packageJson] = await Promise.all([
    readFile(new URL("../app/HomeExperience.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  assert.match(
    home,
    /"IDLE"\s*\|\s*"LOADING"\s*\|\s*"READY"\s*\|\s*"WAITING_FOR_ENTRY"\s*\|\s*"ENTERING"\s*\|\s*"COMPLETE"/,
  );
  assert.match(home, /loaderTimelineRef/);
  assert.match(home, /IntersectionObserver/);
  assert.match(home, /enteredOnceRef/);
  assert.match(home, /window\.sessionStorage\.setItem\("ayush:home-scroll"/);
  assert.doesNotMatch(home, /requestAnimationFrame\s*\([^)]*=>[^)]*setActiveProject/);
  assert.doesNotMatch(home, /ScrollTrigger|Lenis|WebGLStage|THREE/);
  assert.doesNotMatch(packageJson, /"lenis"|"three"|"@types\/three"/);
});

test("ships the resilient persistent two-deck audio architecture", async () => {
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
  assert.match(playlist, /Recording not yet supplied/);
  assert.match(playlist, /beethoven-moonlight-adagio/);
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
    assert.match(validator, new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});
