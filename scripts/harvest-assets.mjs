import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { basename, extname, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const htmlDir = resolve(root, "docs/site-harvest/html");
const imageDir = resolve(root, "public/assets/images");
const fontDir = resolve(root, "public/assets/fonts");

const wantedImages = [
  ["wordmark-light.webp", "https://images.squarespace-cdn.com/content/v1/6814f30b374d3066c4498809/1be17f49-375d-4c98-a953-f71f112860a3/Senior+Living+Kit_wordmark+-light.png?format=1500w"],
  ["brand-mark.png", "https://images.squarespace-cdn.com/content/v1/6814f30b374d3066c4498809/7b60e0e2-523f-4254-b12d-1c2f8b72237f/Senior+Living+Kit+-+Working_mark2.png?format=500w"],
  ["home-hero.jpg", "https://images.squarespace-cdn.com/content/v1/6814f30b374d3066c4498809/1746205616450-E8HVMB560E7BYOI734JI/unsplash-image--cJjkNo8r7k.jpg?format=2500w"],
  ["services-hero.jpg", "https://images.squarespace-cdn.com/content/v1/6814f30b374d3066c4498809/1746207530891-082KYP39VG0SRT6KS9EP/unsplash-image-xp8F9vqF8Yw.jpg?format=2500w"],
  ["process-hero.webp", "https://images.squarespace-cdn.com/content/v1/6814f30b374d3066c4498809/1748873105426-UGVF41AMFJSXQGCQMUQR/unsplash-image-sRAWQyoUiVQ.jpg?format=2500w"],
  ["about-hero.jpg", "https://images.squarespace-cdn.com/content/v1/6814f30b374d3066c4498809/1748873867243-DMK9IP5OWHPK95N4SPBF/unsplash-image-zlA7c39DfFk.jpg?format=2500w"],
  ["get-started-hero.jpg", "https://images.squarespace-cdn.com/content/v1/6814f30b374d3066c4498809/1748877292243-NEO2KGHV6ET3QGV7UODA/unsplash-image-F98Mv9O6LfI.jpg?format=2500w"],
  ["kit-headshot-2025.jpeg", "https://images.squarespace-cdn.com/content/v1/6814f30b374d3066c4498809/7c53365e-6a83-437a-b3df-ed81f967cd4a/kit-headshot-2025.jpeg?format=1000w"],
  ["kit-headshot-resized.png", "https://images.squarespace-cdn.com/content/v1/6814f30b374d3066c4498809/1778183862258-BIRMV5UV6BNVC093EOGI/kit_headshot_resized2.png?format=1000w"],
  ["testimonial-lady.webp", "https://images.squarespace-cdn.com/content/v1/6814f30b374d3066c4498809/1783981782764-WQLGH79TC6JYID5AQFKD/lady+80.jpg?format=1500w"],
  ["blog-caregiver.jpg", "https://images.squarespace-cdn.com/content/v1/6814f30b374d3066c4498809/1748877981994-AKUAF1V2AB69CJ382WST/unsplash-image-CeZypKDceQc.jpg?format=1500w"],
  ["blog-home.jpg", "https://images.squarespace-cdn.com/content/v1/6814f30b374d3066c4498809/1748878275621-R6NQNT8SHHJ81GNQPLOF/unsplash-image-n5qYNk8JEBw.jpg?format=1500w"],
  ["blog-family.jpg", "https://images.squarespace-cdn.com/content/v1/6814f30b374d3066c4498809/1748879096853-30VV2UML1409V7ZPQKE9/unsplash-image-m-igXXn2eIg.jpg?format=1500w"],
  ["favicon.png", "https://images.squarespace-cdn.com/content/v1/6814f30b374d3066c4498809/d1057c2e-6c67-4c65-a42b-e90f881c5624/favicon.ico"]
];

const fontUrls = new Set();
const pageText = {};

function stripTags(value) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#124;/g, "|")
    .replace(/&mdash;/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

await mkdir(imageDir, { recursive: true });
await mkdir(fontDir, { recursive: true });

for (const file of await readdir(htmlDir)) {
  const html = await readFile(resolve(htmlDir, file), "utf8");
  const title = html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.replace(/&amp;/g, "&") || "";
  const description = html.match(/<meta name="description" content="([^"]*)"/i)?.[1]?.replace(/&amp;/g, "&") || "";
  const blocks = [...html.matchAll(/<div class="sqs-html-content"[^>]*>([\s\S]*?)<\/div>/g)]
    .map((match) => stripTags(match[1]))
    .filter(Boolean);
  pageText[file] = { title, description, blocks };

  for (const match of html.matchAll(/https:\/\/file\.squarespace-cdn\.com\/content\/v2\/namespaces\/fonts\/libraries\/sqsp\/assets\/[^'")]+\.woff2/g)) {
    fontUrls.add(match[0]);
  }
}

const fontDownloads = [...fontUrls].map((url) => {
  const parts = new URL(url).pathname.split("/");
  const filename = `${parts.at(-2)}-${parts.at(-1)}`;
  return [filename, url];
});

for (const [filename, url] of [...wantedImages, ...fontDownloads]) {
  const target = resolve(filename.endsWith(".woff2") ? fontDir : imageDir, filename);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed ${response.status} for ${url}`);
  await writeFile(target, Buffer.from(await response.arrayBuffer()));
}

const manifest = {
  harvestedAt: new Date().toISOString(),
  pages: pageText,
  images: Object.fromEntries(wantedImages.map(([filename, url]) => [filename, url])),
  fonts: Object.fromEntries(fontDownloads)
};

await writeFile(resolve(root, "docs/site-harvest/manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Downloaded ${wantedImages.length} images and ${fontDownloads.length} fonts.`);
