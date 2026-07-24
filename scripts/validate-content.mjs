import { readFile, readdir } from "node:fs/promises";
import { extname, join } from "node:path";

const roots = ["app", "src"];
const prohibited = [
  ["PROJECT", "NAME"].join(" "),
  ["CATE", "GORY"].join(""),
  ["YE", "AR"].join(""),
  ["CASE", "STUDY"].join(" "),
  ["PLACE", "HOLDER"].join(""),
  ["LOREM", "IPSUM"].join(" "),
  ["YOUR", "EMAIL"].join(" "),
  ["EXAMPLE", ".COM"].join(""),
];
const extensions = new Set([".ts", ".tsx", ".js", ".jsx", ".css"]);
const failures = [];

async function visit(path) {
  const entries = await readdir(path, { withFileTypes: true });
  for (const entry of entries) {
    const next = join(path, entry.name);
    if (entry.isDirectory()) {
      await visit(next);
      continue;
    }
    if (!extensions.has(extname(entry.name))) continue;
    const content = await readFile(next, "utf8");
    for (const phrase of prohibited) {
      if (content.includes(phrase)) {
        failures.push(`${next}: ${phrase}`);
      }
    }
  }
}

await Promise.all(roots.map(visit));

if (failures.length) {
  console.error("Production content validation failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Production content validation passed.");
