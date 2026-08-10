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

  const response = await fetch(`http://127.0.0.1:${port}/get-started`);
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /Book a free consultation with Kit/);
  assert.match(html, /data-mock-form/);

  const routes = new Map([
    ["/blog", /Senior Living Kit Blog/],
    ["/blog/", /Senior Living Kit Blog/],
    ["/services", /A Roadmap to Senior Living/],
    ["/process/", /Your Stress-Free Senior Living Plan/]
  ]);

  for (const [route, pattern] of routes) {
    const routeResponse = await fetch(`http://127.0.0.1:${port}${route}`);
    const routeHtml = await routeResponse.text();
    assert.equal(routeResponse.status, 200, route);
    assert.match(routeHtml, pattern, route);
  }

  const assetResponse = await fetch(`http://127.0.0.1:${port}/assets/images/wordmark-light.webp`);
  assert.equal(assetResponse.status, 200);
  assert.match(assetResponse.headers.get("content-type") || "", /image\/webp/);
  console.log("Browser smoke checks passed.");
} finally {
  server.kill("SIGTERM");
}
