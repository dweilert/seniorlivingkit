import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const port = Number(process.env.PORT || 4173);
const server = spawn(process.execPath, ["scripts/dev-server.mjs"], {
  env: { ...process.env, PORT: String(port) },
  stdio: ["ignore", "pipe", "pipe"]
});

try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Server did not start")), 5000);
    server.stdout.on("data", (chunk) => {
      if (String(chunk).includes(`:${port}`)) {
        clearTimeout(timer);
        resolve();
      }
    });
    server.stderr.on("data", (chunk) => reject(new Error(String(chunk))));
    server.on("error", reject);
  });

  const response = await fetch(`http://127.0.0.1:${port}/get-started.html`);
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /Request consultation/);
  assert.match(html, /mock lead handler/i);
  console.log("Browser smoke checks passed.");
} finally {
  server.kill("SIGTERM");
}
