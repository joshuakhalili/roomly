import { cp, mkdir, readFile, writeFile, readdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = fileURLToPath(new URL("../", import.meta.url));
const output = path.join(root, "dist");
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(path.join(root, "source"), output, { recursive: true });
await cp(path.join(root, "public"), output, { recursive: true });
const replacements = JSON.parse(
  await readFile(path.join(root, "content.json"), "utf8"),
);
// One longest-first pass: replacements never feed subsequent replacements.
const escaped = Object.keys(replacements)
  .sort((a, b) => b.length - a.length)
  .map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
const pattern = new RegExp(escaped.join("|"), "g");
let count = 0;
async function walk(dir) {
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, item.name);
    if (item.isDirectory()) {
      await walk(file);
      continue;
    }
    if (!/\.(html|mjs|js|json|css|xml|txt)$/.test(file)) continue;
    let value = await readFile(file, "utf8");
    value = value.replace(pattern, (s) => replacements[s]);
    if (file.endsWith(".html")) {
      value = value.replace(
        "</head>",
        '<link rel="stylesheet" href="/roomly.css"><script src="/roomly.js" defer></script></head>',
      );
      value = value.replace(
        /<body([^>]*)>/,
        '<body$1><a class="roomly-skip" href="#roomly-main">Skip to content</a>',
      );
    }
    await writeFile(file, value);
    count++;
  }
}
await walk(output);
console.log(`Built ${count} text assets from the preserved Framer mirror.`);
