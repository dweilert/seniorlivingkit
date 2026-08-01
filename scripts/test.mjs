import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const publicDir = resolve(import.meta.dirname, "..", "public");
const home = await readFile(resolve(publicDir, "index.html"), "utf8");
const form = await readFile(resolve(publicDir, "get-started.html"), "utf8");
const formScript = await readFile(resolve(publicDir, "forms.js"), "utf8");

assert.match(home, /Guiding You Home\./);
assert.match(home, /Senior housing guidance/i);
assert.match(form, /data-mock-form/);
assert.match(formScript, /not sent to a production provider/);
assert.doesNotMatch(formScript, /mailchimp|twilio|amazonaws|execute-api/i);

console.log("Unit checks passed.");
