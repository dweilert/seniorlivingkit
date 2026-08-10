import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export const CSA_LOCATOR_SOURCE = {
  id: "society-certified-senior-advisors-locator",
  name: "Society of Certified Senior Advisors CSA Locator",
  sourceOwner: "Society of Certified Senior Advisors",
  sourceSystem: "GeoDirectory WordPress public search",
  sourceUrl: "https://portal.csa.us/locator/",
  searchUrl: "https://portal.csa.us/search/",
  sourceDescription: "Public CSA Locator for verifying Certified Senior Advisor profiles and broad service categories.",
  exportNamePrefix: "csa-locator",
  parsingNotes: [
    "Public search result pages are paginated at /search/page/{n}/ with geodir_search=1, stype=gd_place, and s= query parameters.",
    "Listing cards are parsed for CSA name, certified-since date, location, main industry, profile URL, source page URL, and source post ID when present.",
    "Detail pages sampled during research often repeat public credential/location/industry fields but do not consistently expose email, phone, or company fields.",
    "Use this source as official credential verification and cross-match it to richer advisor/contact sources by name, location, website, email, or phone.",
    "Collector is intentionally throttled and supports --pages, --limit, and --delay-ms for controlled daily refreshes."
  ]
};

const DEFAULT_OUT_DIR = resolve(root, "data", "advisor-directory");
const DEFAULT_USER_AGENT = "FacilityCRMPrototype/0.3 csa-locator-collector";
const DEFAULT_DELAY_MS = 750;
const DEFAULT_TIMEOUT_MS = 20000;
const DEFAULT_PAGES = 1;
const ALL = "all";

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function normalizeText(value) {
  return String(value || "")
    .replaceAll(/&nbsp;/gi, " ")
    .replaceAll(/\s+/g, " ")
    .trim();
}

function decodeHtml(value) {
  return String(value || "")
    .replaceAll(/&amp;/g, "&")
    .replaceAll(/&lt;/g, "<")
    .replaceAll(/&gt;/g, ">")
    .replaceAll(/&quot;/g, "\"")
    .replaceAll(/&#39;/g, "'")
    .replaceAll(/&#x27;/gi, "'")
    .replaceAll(/&#8211;/g, "-")
    .replaceAll(/&#8212;/g, "-")
    .replaceAll(/&#8217;/g, "'")
    .replaceAll(/&#8220;/g, "\"")
    .replaceAll(/&#8221;/g, "\"");
}

function stripHtml(html) {
  return normalizeText(decodeHtml(String(html || "")
    .replaceAll(/<script[\s\S]*?<\/script>/gi, " ")
    .replaceAll(/<style[\s\S]*?<\/style>/gi, " ")
    .replaceAll(/<br\s*\/?>/gi, "\n")
    .replaceAll(/<\/(p|div|li|h[1-6]|span|a)>/gi, "\n")
    .replaceAll(/<[^>]+>/g, " ")));
}

function textLinesFromHtml(html) {
  return decodeHtml(String(html || "")
    .replaceAll(/<script[\s\S]*?<\/script>/gi, " ")
    .replaceAll(/<style[\s\S]*?<\/style>/gi, " ")
    .replaceAll(/<br\s*\/?>/gi, "\n")
    .replaceAll(/<\/(p|div|li|h[1-6]|span|a)>/gi, "\n")
    .replaceAll(/<[^>]+>/g, " "))
    .split("\n")
    .map((line) => normalizeText(line))
    .filter(Boolean);
}

function absoluteUrl(value, baseUrl) {
  try {
    return new URL(decodeHtml(value), baseUrl).toString();
  } catch {
    return "";
  }
}

function csvEscape(value) {
  const normalized = value && typeof value === "object" ? JSON.stringify(value) : value;
  return `"${String(normalized ?? "").replaceAll("\"", "\"\"")}"`;
}

function toCsv(records) {
  const columns = [
    "advisor_key",
    "source_record_id",
    "name",
    "certified_since",
    "location",
    "city",
    "state",
    "zip",
    "main_industry",
    "detail_url",
    "source_page_url",
    "source_id",
    "source_owner",
    "collected_at"
  ];
  return `${columns.join(",")}\n${records.map((record) => columns.map((column) => csvEscape(record[column])).join(",")).join("\n")}\n`;
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

function searchPageUrl(pageNumber) {
  if (pageNumber <= 1) return `${CSA_LOCATOR_SOURCE.searchUrl}?geodir_search=1&stype=gd_place&s=`;
  return `${CSA_LOCATOR_SOURCE.searchUrl}page/${pageNumber}/?geodir_search=1&stype=gd_place&s=`;
}

function extractClassAttr(tag) {
  return decodeHtml(tag.match(/\sclass=["']([^"']+)["']/i)?.[1] || "");
}

function hasAllClasses(className, classes) {
  const values = new Set(className.split(/\s+/).filter(Boolean));
  return classes.every((classValue) => values.has(classValue));
}

export function extractDivsWithClasses(html, classes) {
  const source = String(html || "");
  const starts = [];
  for (const match of source.matchAll(/<div\b[^>]*>/gi)) {
    if (hasAllClasses(extractClassAttr(match[0]), classes)) starts.push(match.index);
  }

  return starts.map((start) => {
    const divTags = [...source.slice(start).matchAll(/<\/?div\b[^>]*>/gi)];
    let depth = 0;
    for (const tag of divTags) {
      depth += tag[0].startsWith("</") ? -1 : 1;
      if (depth === 0) {
        const end = start + tag.index + tag[0].length;
        return source.slice(start, end);
      }
    }
    return source.slice(start);
  });
}

function labelValue(lines, label) {
  const normalizedLabel = label.toUpperCase();
  const index = lines.findIndex((line) => line.replace(/:$/, "").toUpperCase() === normalizedLabel);
  if (index < 0) return "";

  const values = [];
  for (const line of lines.slice(index + 1)) {
    const normalized = line.replace(/:$/, "").toUpperCase();
    if (["CERTIFIED SINCE", "LOCATION", "MAIN INDUSTRY"].includes(normalized)) break;
    if (/^VIEW DETAILS\b/i.test(line)) break;
    values.push(line);
  }

  return normalizeText(values.join(" ").replace(/\s+,/g, ","));
}

function parseLocation(value) {
  const location = normalizeText(value);
  const zip = location.match(/\b(\d{5})(?:-\d{4})?\b/)?.[1] || "";
  const stateMatch = location.match(/,\s*([A-Za-z .'-]+?)(?:\s+\d{5})?$/);
  const state = normalizeText(stateMatch?.[1] || "");
  const city = normalizeText(location.split(",")[0] || "");
  return { city, state, zip };
}

function advisorKey(record) {
  const base = record.detail_url || `${record.name}|${record.location}|${record.certified_since}`;
  return `${CSA_LOCATOR_SOURCE.id}:${sha256(base).slice(0, 16)}`;
}

export function parseCsaSearchPage(html, pageUrl) {
  const cards = extractDivsWithClasses(html, ["geodir-post", "gd_place"]);
  const records = [];

  for (const cardHtml of cards) {
    const lines = textLinesFromHtml(cardHtml);
    const titleMatch = cardHtml.match(/<h[1-6][^>]*>[\s\S]*?<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/h[1-6]>/i)
      || cardHtml.match(/<a[^>]+href=["']([^"']*csa-search[^"']*)["'][^>]*>([\s\S]*?)<\/a>/i);
    const detailUrl = titleMatch ? absoluteUrl(titleMatch[1], pageUrl) : "";
    const name = normalizeText(stripHtml(titleMatch?.[2] || lines[0] || ""));
    if (!name || /^view details$/i.test(name)) continue;

    const location = labelValue(lines, "LOCATION");
    const locationParts = parseLocation(location);
    const record = {
      advisor_key: "",
      source_record_id: cardHtml.match(/\bpost-(\d+)\b/)?.[1] || "",
      name,
      certified_since: labelValue(lines, "CERTIFIED SINCE"),
      location,
      city: locationParts.city,
      state: locationParts.state,
      zip: locationParts.zip,
      main_industry: labelValue(lines, "MAIN INDUSTRY"),
      detail_url: detailUrl,
      source_page_url: pageUrl,
      source_id: CSA_LOCATOR_SOURCE.id,
      source_owner: CSA_LOCATOR_SOURCE.sourceOwner,
      source_system: CSA_LOCATOR_SOURCE.sourceSystem,
      collected_at: "",
      raw_card_text: lines.join("\n"),
      raw_card_html_sha256: sha256(cardHtml)
    };
    record.advisor_key = advisorKey(record);
    records.push(record);
  }

  return records;
}

export function detectTotalPages(html) {
  const pageNumbers = [...String(html || "").matchAll(/\/search\/page\/(\d+)\//gi)]
    .map((match) => Number(match[1]))
    .filter(Number.isFinite);
  const textNumbers = textLinesFromHtml(html)
    .filter((line) => /^\d+$/.test(line))
    .map(Number)
    .filter((number) => number > 0 && number < 10000);
  const max = Math.max(1, ...pageNumbers, ...textNumbers);
  return max;
}

async function fetchSearchPage(pageNumber, { fetchImpl, userAgent, timeoutMs }) {
  const url = searchPageUrl(pageNumber);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      headers: { "user-agent": userAgent },
      redirect: "follow",
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`CSA Locator page ${pageNumber} request failed: ${response.status}`);
    const html = await response.text();
    return {
      page_number: pageNumber,
      requested_url: url,
      final_url: response.url || url,
      http_status: response.status,
      html,
      html_sha256: sha256(html)
    };
  } finally {
    clearTimeout(timeout);
  }
}

function dedupeRecords(records) {
  const found = new Map();
  for (const record of records) {
    const key = record.detail_url || record.advisor_key;
    if (!found.has(key)) found.set(key, record);
  }
  return [...found.values()];
}

export async function collectCsaLocator(options = {}) {
  const outDir = resolve(options.outDir ?? DEFAULT_OUT_DIR);
  const collectedAt = options.collectedAt ?? new Date().toISOString();
  const runId = collectedAt.replaceAll(":", "").replaceAll(".", "");
  const runDir = resolve(outDir, "runs", CSA_LOCATOR_SOURCE.id, runId);
  const delayMs = options.delayMs ?? DEFAULT_DELAY_MS;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const limit = options.limit ?? ALL;
  const userAgent = options.userAgent ?? DEFAULT_USER_AGENT;
  const rawPages = [];

  if (options.inputRawPath) {
    const raw = JSON.parse(await readFile(resolve(options.inputRawPath), "utf8"));
    for (const page of raw.pages || []) {
      rawPages.push({
        page_number: page.page_number,
        requested_url: page.requested_url,
        final_url: page.final_url,
        http_status: page.http_status,
        html: page.html,
        html_sha256: page.html_sha256 || sha256(page.html || ""),
        input_path: resolve(options.inputRawPath)
      });
    }
    if (!rawPages.length) throw new Error(`Input raw source file does not contain pages: ${options.inputRawPath}`);
  } else if (options.inputPath) {
    const html = await readFile(resolve(options.inputPath), "utf8");
    rawPages.push({
      page_number: 1,
      requested_url: resolve(options.inputPath),
      final_url: options.inputPageUrl || searchPageUrl(1),
      http_status: null,
      html,
      html_sha256: sha256(html),
      input_path: resolve(options.inputPath)
    });
  } else {
    const firstPage = await fetchSearchPage(1, { fetchImpl: options.fetchImpl ?? fetch, userAgent, timeoutMs });
    rawPages.push(firstPage);
    const detectedTotalPages = detectTotalPages(firstPage.html);
    const requestedPages = options.pages === ALL ? detectedTotalPages : (options.pages ?? DEFAULT_PAGES);
    const pagesToFetch = Math.min(requestedPages, detectedTotalPages);
    if (options.progress) console.error(`Fetched CSA Locator page 1/${pagesToFetch}`);

    for (let pageNumber = 2; pageNumber <= pagesToFetch; pageNumber += 1) {
      if (delayMs > 0) await sleep(delayMs);
      rawPages.push(await fetchSearchPage(pageNumber, { fetchImpl: options.fetchImpl ?? fetch, userAgent, timeoutMs }));
      if (options.progress) console.error(`Fetched CSA Locator page ${pageNumber}/${pagesToFetch}`);
    }
  }

  const recordsAll = dedupeRecords(rawPages.flatMap((page) => parseCsaSearchPage(page.html, page.final_url)));
  const selectedRecords = limit === ALL ? recordsAll : recordsAll.slice(0, limit);
  for (const record of selectedRecords) record.collected_at = collectedAt;

  const detectedTotalPages = detectTotalPages(rawPages[0]?.html || "");
  const recordHash = sha256(stableJson(selectedRecords));
  const exportStem = `${CSA_LOCATOR_SOURCE.exportNamePrefix}-${limit === ALL ? "all" : limit}`;
  const exportPayload = {
    generated_at: collectedAt,
    run_id: runId,
    source: {
      id: CSA_LOCATOR_SOURCE.id,
      name: CSA_LOCATOR_SOURCE.name,
      owner: CSA_LOCATOR_SOURCE.sourceOwner,
      system: CSA_LOCATOR_SOURCE.sourceSystem,
      url: CSA_LOCATOR_SOURCE.sourceUrl,
      search_url: CSA_LOCATOR_SOURCE.searchUrl,
      description: CSA_LOCATOR_SOURCE.sourceDescription
    },
    detected_total_pages: detectedTotalPages,
    fetched_pages: rawPages.length,
    record_count: selectedRecords.length,
    total_parsed_records: recordsAll.length,
    selected_records_sha256: recordHash,
    parsing_notes: CSA_LOCATOR_SOURCE.parsingNotes,
    records: selectedRecords
  };
  const manifest = {
    run_id: runId,
    generated_at: collectedAt,
    source_id: CSA_LOCATOR_SOURCE.id,
    source_url: CSA_LOCATOR_SOURCE.sourceUrl,
    source_owner: CSA_LOCATOR_SOURCE.sourceOwner,
    source_system: CSA_LOCATOR_SOURCE.sourceSystem,
    limit,
    requested_pages: options.inputPath || options.inputRawPath ? rawPages.length : (options.pages ?? DEFAULT_PAGES),
    detected_total_pages: detectedTotalPages,
    fetched_pages: rawPages.length,
    total_parsed_records: recordsAll.length,
    selected_records: selectedRecords.length,
    selected_records_sha256: recordHash,
    delay_ms: delayMs,
    timeout_ms: timeoutMs,
    pages: rawPages.map((page) => ({
      page_number: page.page_number,
      requested_url: page.requested_url,
      final_url: page.final_url,
      http_status: page.http_status,
      html_sha256: page.html_sha256,
      input_path: page.input_path
    })),
    outputs: {
      latest_json: resolve(outDir, `${exportStem}.json`),
      latest_csv: resolve(outDir, `${exportStem}.csv`),
      run_manifest: resolve(runDir, "manifest.json"),
      run_raw: resolve(runDir, "raw-source.json"),
      run_normalized_json: resolve(runDir, "normalized-records.json"),
      run_normalized_csv: resolve(runDir, "normalized-records.csv")
    },
    parsing_notes: CSA_LOCATOR_SOURCE.parsingNotes
  };

  await writeJson(resolve(runDir, "raw-source.json"), {
    retrieved_at: collectedAt,
    source: CSA_LOCATOR_SOURCE,
    pages: rawPages.map((page) => ({
      page_number: page.page_number,
      requested_url: page.requested_url,
      final_url: page.final_url,
      http_status: page.http_status,
      html_sha256: page.html_sha256,
      html: page.html
    }))
  });
  await writeJson(resolve(runDir, "normalized-records.json"), exportPayload);
  await writeFile(resolve(runDir, "normalized-records.csv"), toCsv(selectedRecords));
  await writeJson(resolve(runDir, "manifest.json"), manifest);
  await writeJson(resolve(outDir, `${exportStem}.json`), exportPayload);
  await writeFile(resolve(outDir, `${exportStem}.csv`), toCsv(selectedRecords));
  await writeJson(resolve(outDir, `${CSA_LOCATOR_SOURCE.id}-latest-manifest.json`), manifest);

  return manifest;
}

function parseArgs(argv) {
  const options = {};

  for (const arg of argv) {
    const [key, value] = arg.startsWith("--") ? arg.slice(2).split("=", 2) : [arg, undefined];
    if (key === "limit") options.limit = value === ALL ? ALL : Number(value);
    else if (key === "pages") options.pages = value === ALL ? ALL : Number(value);
    else if (key === "delay-ms") options.delayMs = Number(value);
    else if (key === "timeout-ms") options.timeoutMs = Number(value);
    else if (key === "progress") options.progress = value == null ? true : value !== "false";
    else if (key === "out-dir") options.outDir = value;
    else if (key === "input") options.inputPath = value;
    else if (key === "input-raw") options.inputRawPath = value;
    else if (key === "input-page-url") options.inputPageUrl = value;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  if (options.limit != null && options.limit !== ALL && (!Number.isInteger(options.limit) || options.limit < 1)) {
    throw new Error("--limit must be a positive integer or all");
  }
  if (options.pages != null && options.pages !== ALL && (!Number.isInteger(options.pages) || options.pages < 1)) {
    throw new Error("--pages must be a positive integer or all");
  }
  if (options.delayMs != null && (!Number.isFinite(options.delayMs) || options.delayMs < 0)) {
    throw new Error("--delay-ms must be a non-negative number");
  }
  if (options.timeoutMs != null && (!Number.isFinite(options.timeoutMs) || options.timeoutMs < 1)) {
    throw new Error("--timeout-ms must be a positive number");
  }

  return options;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const manifest = await collectCsaLocator(parseArgs(process.argv.slice(2)));
  console.log(JSON.stringify({
    run_id: manifest.run_id,
    source_id: manifest.source_id,
    detected_total_pages: manifest.detected_total_pages,
    fetched_pages: manifest.fetched_pages,
    selected_records: manifest.selected_records,
    selected_records_sha256: manifest.selected_records_sha256,
    latest_json: manifest.outputs.latest_json,
    latest_csv: manifest.outputs.latest_csv,
    run_manifest: manifest.outputs.run_manifest
  }, null, 2));
}
