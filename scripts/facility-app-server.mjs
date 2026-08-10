import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const appRoot = resolve(root, "apps", "facility-directory-prototype");
const dataRoot = resolve(root, "data");
const port = Number(process.env.PORT || 3200);
const host = process.env.HOST || "127.0.0.1";
const types = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".csv", "text/csv; charset=utf-8"]
]);
const maxBodyBytes = 8 * 1024 * 1024;

function safeJoin(base, pathname) {
  const requested = normalize(pathname);
  const file = join(base, requested);
  return file.startsWith(base) ? file : null;
}

async function readJsonBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBodyBytes) throw new Error("Request body too large");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

function mockBusinessCardExtraction(body) {
  const filename = String(body.filename || "");
  const normalized = filename.toLowerCase();
  const looksFacility = /community|facility|senior|living|care|home/.test(normalized);

  return {
    extracted_at: new Date().toISOString(),
    mode: "mock",
    confidence: 0.82,
    image: {
      filename,
      mime_type: body.mimeType || "",
      bytes: Number(body.bytes || 0)
    },
    contact: looksFacility
      ? {
          name: "Jordan Miller",
          title: "Community Relations Director",
          company: "Sample Senior Living Community",
          phone: "(512) 555-0160",
          email: "jordan.miller@example.com",
          website: "https://example.com",
          address: "1000 Wellness Way, Austin, TX 78746"
        }
      : {
          name: "Renee Ellis",
          title: "Family Contact",
          company: "",
          phone: "(512) 555-0198",
          email: "renee.ellis@example.com",
          website: "",
          address: "Austin, TX"
        },
    parsing_notes: [
      "Local prototype endpoint; no real OCR was performed.",
      "Production should store the uploaded image and call an OCR/contact extraction service.",
      "Human review should confirm extracted contact fields before saving to CRM."
    ]
  };
}

createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);
  const pathname = url.pathname !== "/" && url.pathname.endsWith("/")
    ? url.pathname.slice(0, -1)
    : url.pathname;

  if (req.method === "POST" && pathname === "/api/business-card/ocr") {
    try {
      const body = await readJsonBody(req);
      const result = mockBusinessCardExtraction(body);
      res.writeHead(200, {
        "cache-control": "no-store",
        "content-type": "application/json; charset=utf-8"
      });
      res.end(JSON.stringify(result));
    } catch (error) {
      res.writeHead(400, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: error.message }));
    }
    return;
  }

  const isDataRequest = pathname.startsWith("/data/");
  const base = isDataRequest ? dataRoot : appRoot;
  const requestPath = isDataRequest ? pathname.replace(/^\/data/, "") : (pathname === "/" ? "/index.html" : pathname);
  const file = safeJoin(base, requestPath);

  if (!file) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const info = await stat(file);
    const body = await readFile(info.isDirectory() ? join(file, "index.html") : file);
    res.writeHead(200, {
      "cache-control": "no-store",
      "content-type": types.get(extname(file)) || "application/octet-stream"
    });
    res.end(body);
  } catch {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
}).listen(port, host, () => {
  console.log(`Facility directory prototype running at http://${host}:${port}`);
});
