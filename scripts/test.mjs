import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const publicDir = resolve(import.meta.dirname, "..", "public");
const home = await readFile(resolve(publicDir, "index.html"), "utf8");
const styles = await readFile(resolve(publicDir, "styles.css"), "utf8");
const form = await readFile(resolve(publicDir, "get-started.html"), "utf8");
const formScript = await readFile(resolve(publicDir, "forms.js"), "utf8");

assert.match(home, /Guiding You Home\./);
assert.match(home, /Which Senior Living Option Is Right for You\?/);
assert.match(home, /assets\/images\/wordmark-light\.webp/);
assert.match(styles, /assets\/images\/home-hero\.jpg/);
assert.match(form, /data-mock-form/);
assert.match(formScript, /not sent to a production provider/);
assert.doesNotMatch(formScript, /mailchimp|twilio|amazonaws|execute-api/i);

for (const route of ["about", "services", "process", "blog", "contact", "team", "get-started"]) {
  const page = await readFile(resolve(publicDir, `${route}.html`), "utf8");
  assert.match(page, /Senior Living Kit/);
  assert.doesNotMatch(page, /\.html/);
}

console.log("Unit checks passed.");
