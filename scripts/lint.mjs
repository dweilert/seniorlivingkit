import { readFile, readdir } from "node:fs/promises";
import { extname, join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const requiredEnvKeys = [
  "NEXT_PUBLIC_SITE_URL",
  "CONTACT_PROVIDER",
  "MARKETING_PROVIDER",
  "SMS_PROVIDER",
  "SCHEDULING_PROVIDER",
  "QUIZ_PROVIDER",
  "MAILCHIMP_API_KEY",
  "TWILIO_AUTH_TOKEN",
  "AWS_REGION"
];

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else files.push(path);
  }
  return files;
}

const files = await walk(resolve(root, "public"));
const htmlFiles = files.filter((file) => extname(file) === ".html");
const envExample = await readFile(resolve(root, ".env.example"), "utf8");
const errors = [];

for (const key of requiredEnvKeys) {
  if (!envExample.includes(`${key}=`)) errors.push(`.env.example missing ${key}`);
}

for (const file of htmlFiles) {
  const html = await readFile(file, "utf8");
  if (!html.includes("<title>")) errors.push(`${file} is missing a title`);
  if (!html.includes('meta name="description"')) errors.push(`${file} is missing a meta description`);
  if (!html.includes('nav aria-label="Primary navigation"')) errors.push(`${file} is missing primary navigation`);
  if (html.includes(".html")) errors.push(`${file} should use extensionless local routes`);
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`Linted ${htmlFiles.length} HTML pages and environment template.`);
