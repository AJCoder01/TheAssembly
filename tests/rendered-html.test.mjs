import assert from "node:assert/strict";
import { access, readFile, stat } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
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

test("server-renders Ayush's landing-first portfolio", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Ayush — Developer \/ Product Builder<\/title>/i);
  assert.match(html, />AYUSH</);
  assert.match(html, /Developer \/ Product Builder/);
  assert.match(html, /Enter with sound/);
  assert.match(html, /Enter muted/);
  assert.match(html, /Landing visual animation/);
  assert.match(html, /ayush-landing-loop\.mp4/);
  assert.match(html, /ayush-landing-poster\.webp/);
  assert.match(html, /Background music/);
  assert.match(html, /PROJECT NAME/);
  assert.equal((html.match(/class="scroll-panel"/g) ?? []).length, 7);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/i);
  assert.doesNotMatch(html, /react-loading-skeleton/);
});

test("serves real project routes with the same project language", async () => {
  for (const number of ["01", "02", "03", "04"]) {
    const response = await render(`/project/${number}`);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, new RegExp(`>${number}<`));
    assert.match(html, /PROJECT NAME/);
    assert.match(html, /CATEGORY/);
    assert.match(html, /YEAR/);
    assert.match(html, /VIEW/);
  }
});

test("ships only documented local project placeholders", async () => {
  const expected = ["01", "02", "03", "04"].map(
    (number) => `public/media/ayush-project-${number}-placeholder.webp`,
  );
  const sizes = await Promise.all(
    expected.map(async (relativePath) => {
      const file = new URL(`../${relativePath}`, import.meta.url);
      await access(file);
      return (await stat(file)).size;
    }),
  );
  sizes.forEach((size) => assert.ok(size > 0));

  const [manifest, packageJson, page, layout] = await Promise.all([
    readFile(new URL("../public/media/README.md", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  ]);

  expected.forEach((relativePath) => {
    const filename = relativePath.split("/").at(-1);
    assert.match(manifest, new RegExp(filename.replaceAll(".", "\\.")));
  });
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.doesNotMatch(page, /SkeletonPreview|codex-preview/);
  assert.doesNotMatch(layout, /Starter Project|codex-preview/);
  await assert.rejects(access(new URL("../app/_sites-preview", import.meta.url)));
  await access(root);
});

test("ships the original landing visual and sample-free score", async () => {
  const poster = new URL(
    "../public/media/ayush-landing-poster.webp",
    import.meta.url,
  );
  const loop = new URL(
    "../public/media/ayush-landing-loop.mp4",
    import.meta.url,
  );
  const score = new URL(
    "../public/audio/ayush-nocturne.mp3",
    import.meta.url,
  );
  const [posterStat, loopStat, scoreStat] = await Promise.all([
    stat(poster),
    stat(loop),
    stat(score),
  ]);

  assert.ok(posterStat.size > 10_000 && posterStat.size < 2_000_000);
  assert.ok(loopStat.size > 50_000 && loopStat.size < 5_000_000);
  assert.ok(scoreStat.size > 100_000 && scoreStat.size < 2_000_000);

  const [mediaManifest, audioManifest, experience, generator] =
    await Promise.all([
      readFile(new URL("../public/media/README.md", import.meta.url), "utf8"),
      readFile(new URL("../public/audio/README.md", import.meta.url), "utf8"),
      readFile(
        new URL("../app/PortfolioExperience.tsx", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL("../scripts/generate-score.mjs", import.meta.url),
        "utf8",
      ),
    ]);

  assert.match(mediaManifest, /ayush-landing-poster\.webp/);
  assert.match(mediaManifest, /ayush-landing-loop\.mp4/);
  assert.match(audioManifest, /original, sample-free composition/i);
  assert.match(experience, /\/audio\/ayush-nocturne\.mp3/);
  assert.match(generator, /const tempo = 54/);
});
