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

test("server-renders the cinematic landing and continuous journey", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Ayush — Developer \/ Product Builder<\/title>/i);
  assert.match(html, />AYUSH JHA</);
  assert.match(html, /ENTER WITH MUSIC/);
  assert.match(html, /ENTER SILENT/);
  assert.match(html, /PORTFOLIO — 2026/);
  assert.match(html, /PRODUCT BUILDER \/ DEVELOPER/);
  assert.match(html, /SCROLL TO ENTER/);
  assert.match(html, /SOUND OFF/);
  assert.match(html, /PROJECT NAME/);
  assert.equal((html.match(/class="scroll-panel"/g) ?? []).length, 7);
  assert.doesNotMatch(html, /Landing visual animation|Enter muted/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/i);
});

test("serves all project routes with shared visual language", async () => {
  for (const number of ["01", "02", "03", "04"]) {
    const response = await render(`/project/${number}`);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, new RegExp(`>${number}<`));
    assert.match(html, /PROJECT NAME/);
    assert.match(html, /CATEGORY/);
    assert.match(html, /YEAR/);
    assert.match(html, /CASE STUDY/);
    assert.match(html, /Back to project journey/);
  }
});

test("preserves the documented local project placeholders", async () => {
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

test("ships the permission-checked real classical score without synthesis", async () => {
  const ogg = new URL(
    "../public/audio/music/moonlight-adagio.ogg",
    import.meta.url,
  );
  const mp3 = new URL(
    "../public/audio/music/moonlight-adagio.mp3",
    import.meta.url,
  );
  const [oggStat, mp3Stat] = await Promise.all([stat(ogg), stat(mp3)]);
  assert.ok(oggStat.size > 8_000_000);
  assert.ok(mp3Stat.size > 6_000_000);

  const [audioManifest, experience] = await Promise.all([
    readFile(new URL("../public/audio/README.md", import.meta.url), "utf8"),
    readFile(
      new URL("../app/PortfolioExperience.tsx", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(audioManifest, /Paul\s+Pitman for Musopen/i);
  assert.match(audioManifest, /Public Domain \(dedicated\)/i);
  assert.match(experience, /\/audio\/music\/moonlight-adagio\.ogg/);
  assert.match(experience, /\/audio\/music\/moonlight-adagio\.mp3/);
  assert.doesNotMatch(experience, /createOscillator|createBufferSource/);
  await assert.rejects(
    access(new URL("../public/audio/ayush-nocturne.mp3", import.meta.url)),
  );
  await assert.rejects(
    access(new URL("../scripts/generate-score.mjs", import.meta.url)),
  );
});
