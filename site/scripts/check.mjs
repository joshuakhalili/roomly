import "./build.mjs";
import { readFile, access, readdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const root = new URL("../", import.meta.url);
const map = JSON.parse(await readFile(new URL("content.json", root), "utf8"));
if (!Object.keys(map).length) throw Error("Missing editorial content");
const manifest = JSON.parse(
  await readFile(new URL("source/clone.json", root), "utf8"),
);
for (const route of manifest.pages)
  await access(
    new URL(
      "dist/" + (route === "/" ? "index.html" : route.slice(1) + "/index.html"),
      root,
    ),
  );
for (const name of await readdir(new URL("dist/assets/js/", root))) {
  if (/\.(mjs|js)$/.test(name))
    execFileSync(
      process.execPath,
      ["--check", fileURLToPath(new URL("dist/assets/js/" + name, root))],
      { stdio: "pipe" },
    );
}
execFileSync(
  process.execPath,
  ["--check", fileURLToPath(new URL("dist/roomly.js", root))],
  { stdio: "pipe" },
);
console.log("All 13 routes and transformed JavaScript parse successfully.");
