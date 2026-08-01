import { cp, mkdir, readdir, rm } from "node:fs/promises";
import { basename, extname, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const publicDir = resolve(root, "public");
const distDir = resolve(root, "dist");
await rm(resolve(root, "dist"), { recursive: true, force: true });
await mkdir(distDir, { recursive: true });
await cp(publicDir, distDir, { recursive: true });

const entries = await readdir(publicDir, { withFileTypes: true });
for (const entry of entries) {
  if (!entry.isFile() || extname(entry.name) !== ".html" || entry.name === "index.html") continue;
  const routeName = basename(entry.name, ".html");
  const routeDir = resolve(distDir, routeName);
  await mkdir(routeDir, { recursive: true });
  await cp(resolve(publicDir, entry.name), resolve(routeDir, "index.html"));
}

console.log("Built static site to dist/");
