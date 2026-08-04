import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const CONTACT_HARVESTER_VERSION = "website-contact-harvester-v1";
const DEFAULT_USER_AGENT = "FacilityCRMPrototype/0.2 contact-harvester";
const DEFAULT_MAX_PAGES = 4;
const CONTACT_LINK_PATTERN = /contact|about|team|staff|leadership|tour|sales|marketing|admission|community-relations|directions/i;
const HTML_CONTENT_TYPE_PATTERN = /text\/html|application\/xhtml\+xml/i;

export function normalizeWebsiteUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) throw new Error("Website URL is required");
  const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Website URL must use http or https");
  url.hash = "";
  return url;
}

function normalizeText(value) {
  return String(value || "").replaceAll(/\s+/g, " ").trim();
}

function decodeHtml(value) {
  return String(value || "")
    .replaceAll(/&amp;/g, "&")
    .replaceAll(/&lt;/g, "<")
    .replaceAll(/&gt;/g, ">")
    .replaceAll(/&quot;/g, "\"")
    .replaceAll(/&#39;/g, "'")
    .replaceAll(/&#x27;/gi, "'");
}

function unique(values) {
  return [...new Set(values.map((value) => normalizeText(value)).filter(Boolean))];
}

function stripHtml(html) {
  return decodeHtml(String(html || "")
    .replaceAll(/<script[\s\S]*?<\/script>/gi, " ")
    .replaceAll(/<style[\s\S]*?<\/style>/gi, " ")
    .replaceAll(/<[^>]+>/g, " "));
}

function snippetAround(text, value) {
  const normalized = normalizeText(text);
  const needle = normalizeText(value);
  const index = normalized.toLowerCase().indexOf(needle.toLowerCase());
  if (index < 0) return "";
  const start = Math.max(0, index - 70);
  const end = Math.min(normalized.length, index + needle.length + 70);
  return normalized.slice(start, end);
}

function safeAbsoluteUrl(value, baseUrl) {
  try {
    const url = new URL(decodeHtml(value), baseUrl);
    url.hash = "";
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : "";
  } catch {
    return "";
  }
}

function linkText(html) {
  return normalizeText(stripHtml(html));
}

function extractLinks(html, pageUrl) {
  return [...String(html || "").matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => ({
      url: safeAbsoluteUrl(match[1], pageUrl),
      text: linkText(match[2]),
      raw_href: decodeHtml(match[1])
    }))
    .filter((link) => link.url);
}

function parseJsonLd(html, pageUrl, visibleText) {
  const found = [];
  for (const match of String(html || "").matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const parsed = JSON.parse(decodeHtml(match[1]));
      const nodes = Array.isArray(parsed) ? parsed : [parsed, ...(Array.isArray(parsed?.["@graph"]) ? parsed["@graph"] : [])];
      for (const node of nodes.filter(Boolean)) {
        for (const [field, type] of [["email", "email"], ["telephone", "phone"]]) {
          const values = Array.isArray(node[field]) ? node[field] : [node[field]];
          for (const value of values.filter(Boolean)) {
            found.push({
              type,
              value: normalizeText(value),
              page_url: pageUrl,
              rule: `json_ld_${field}`,
              snippet: snippetAround(visibleText, value)
            });
          }
        }
      }
    } catch {
      found.push({
        type: "parser_warning",
        value: "Invalid JSON-LD block skipped",
        page_url: pageUrl,
        rule: "json_ld_parse_error",
        snippet: ""
      });
    }
  }
  return found;
}

export function parseContactPage(html, pageUrl) {
  const rawHtml = String(html || "");
  const withoutScripts = rawHtml.replaceAll(/<script[\s\S]*?<\/script>/gi, " ").replaceAll(/<style[\s\S]*?<\/style>/gi, " ");
  const visibleText = stripHtml(withoutScripts);
  const title = normalizeText(decodeHtml(withoutScripts.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || ""));
  const mailtoEmails = [...withoutScripts.matchAll(/href=["']mailto:([^"'?]+)[^"']*["']/gi)].map((match) => decodeURIComponent(match[1]));
  const textEmails = [...visibleText.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)].map((match) => match[0]);
  const telPhones = [...withoutScripts.matchAll(/href=["']tel:([^"']+)["']/gi)].map((match) => match[1]);
  const textPhones = [...visibleText.matchAll(/(?:\+1[\s.-]?)?(?:\([0-9]{3}\)|[0-9]{3})[\s.-]?[0-9]{3}[\s.-]?[0-9]{4}/g)].map((match) => match[0]);
  const links = extractLinks(withoutScripts, pageUrl);
  const contactLinks = links.filter((link) => CONTACT_LINK_PATTERN.test(`${link.url} ${link.text}`));
  const evidence = [
    ...mailtoEmails.map((value) => ({ type: "email", value, page_url: pageUrl, rule: "mailto_href", snippet: snippetAround(visibleText, value) })),
    ...textEmails.map((value) => ({ type: "email", value, page_url: pageUrl, rule: "email_text_regex", snippet: snippetAround(visibleText, value) })),
    ...telPhones.map((value) => ({ type: "phone", value, page_url: pageUrl, rule: "tel_href", snippet: snippetAround(visibleText, value) })),
    ...textPhones.map((value) => ({ type: "phone", value, page_url: pageUrl, rule: "phone_text_regex", snippet: snippetAround(visibleText, value) })),
    ...contactLinks.map((link) => ({ type: "contact_link", value: link.url, page_url: pageUrl, rule: "contact_link_keyword", snippet: link.text || link.raw_href })),
    ...parseJsonLd(rawHtml, pageUrl, visibleText)
  ];

  return {
    title,
    emails: unique([...mailtoEmails, ...textEmails, ...evidence.filter((item) => item.type === "email").map((item) => item.value)]).slice(0, 20),
    phones: unique([...telPhones, ...textPhones, ...evidence.filter((item) => item.type === "phone").map((item) => item.value)]).slice(0, 20),
    contact_links: unique(contactLinks.map((link) => link.url)).slice(0, 20),
    evidence: evidence.filter((item) => item.type !== "parser_warning" && item.value).slice(0, 60),
    parser_warnings: evidence.filter((item) => item.type === "parser_warning").map((item) => item.value)
  };
}

async function fetchHtmlPage(url, { fetchImpl, userAgent }) {
  const response = await fetchImpl(url, {
    headers: { "user-agent": userAgent },
    redirect: "follow"
  });
  const contentType = response.headers.get("content-type") || "";
  if (!response.ok) throw new Error(`Website request failed: ${response.status}`);
  if (!HTML_CONTENT_TYPE_PATTERN.test(contentType)) throw new Error(`Website did not return HTML: ${contentType || "unknown content type"}`);
  return {
    requested_url: url.toString(),
    final_url: response.url || url.toString(),
    http_status: response.status,
    content_type: contentType,
    html: await response.text()
  };
}

function nextUrlsFromPage(pageResult, baseUrl, maxPages) {
  const base = new URL(baseUrl);
  return extractLinks(pageResult.html, pageResult.final_url)
    .filter((link) => CONTACT_LINK_PATTERN.test(`${link.url} ${link.text}`))
    .filter((link) => {
      const candidate = new URL(link.url);
      return candidate.hostname === base.hostname;
    })
    .map((link) => link.url)
    .filter((url, index, links) => links.indexOf(url) === index)
    .slice(0, Math.max(0, maxPages - 1));
}

export async function harvestFacilityWebsite({
  facilityKey = "",
  websiteUrl,
  maxPages = DEFAULT_MAX_PAGES,
  fetchImpl = fetch,
  userAgent = DEFAULT_USER_AGENT,
  checkedAt = new Date().toISOString()
}) {
  const startUrl = normalizeWebsiteUrl(websiteUrl);
  const pages = [];
  const failures = [];
  const queue = [startUrl.toString()];
  const seen = new Set();

  while (queue.length && pages.length < maxPages) {
    const url = queue.shift();
    if (seen.has(url)) continue;
    seen.add(url);
    try {
      const page = await fetchHtmlPage(url, { fetchImpl, userAgent });
      pages.push(page);
      if (pages.length === 1) {
        for (const nextUrl of nextUrlsFromPage(page, startUrl, maxPages)) {
          if (!seen.has(nextUrl)) queue.push(nextUrl);
        }
      }
    } catch (error) {
      failures.push({ requested_url: url, error: error.message });
    }
  }

  const parsedPages = pages.map((page) => ({
    ...page,
    parsed: parseContactPage(page.html, page.final_url)
  }));
  const emails = unique(parsedPages.flatMap((page) => page.parsed.emails)).slice(0, 20);
  const phones = unique(parsedPages.flatMap((page) => page.parsed.phones)).slice(0, 20);
  const contactLinks = unique(parsedPages.flatMap((page) => page.parsed.contact_links)).slice(0, 20);
  const evidence = parsedPages.flatMap((page) => page.parsed.evidence).slice(0, 100);

  return {
    facility_key: facilityKey,
    checked_at: checkedAt,
    website_url: startUrl.toString(),
    final_url: pages[0]?.final_url || startUrl.toString(),
    parser_version: CONTACT_HARVESTER_VERSION,
    parser_rules: [
      "Fetch submitted website URL with redirects enabled.",
      "Parse homepage title, mailto links, email-looking text, tel links, U.S. phone-looking text, JSON-LD email/telephone fields, and links whose URL or text looks contact-related.",
      `Follow up to ${Math.max(0, maxPages - 1)} same-host contact/about/team/tour/sales/admissions pages found on the homepage.`,
      "Store evidence snippets, fetched page metadata, parser version, checked timestamp, and failures for future audit and refresh runs."
    ],
    extraction_methods: [
      "mailto_href",
      "email_text_regex",
      "tel_href",
      "phone_text_regex",
      "json_ld_email",
      "json_ld_telephone",
      "contact_link_keyword"
    ],
    title: parsedPages[0]?.parsed.title || "",
    emails,
    phones,
    contact_links: contactLinks,
    evidence,
    fetched_pages: parsedPages.map((page) => ({
      requested_url: page.requested_url,
      final_url: page.final_url,
      http_status: page.http_status,
      content_type: page.content_type,
      title: page.parsed.title,
      extracted_email_count: page.parsed.emails.length,
      extracted_phone_count: page.parsed.phones.length,
      extracted_contact_link_count: page.parsed.contact_links.length,
      html_sha256: createHash("sha256").update(page.html).digest("hex")
    })),
    failures,
    parsing_notes: [
      "This harvester does not execute JavaScript, submit forms, bypass bot protections, or infer contacts from images.",
      "Results should be human-reviewed before being treated as authoritative CRM contact data.",
      "Production runs should honor robots.txt, rate-limit per domain, and store raw HTML snapshots in object storage."
    ],
    source_note: "Website contact harvester parsed homepage and limited same-site contact pages."
  };
}

function parseArgs(argv) {
  const options = {
    outDir: resolve("data", "facilities", "contact-enrichment"),
    maxPages: DEFAULT_MAX_PAGES,
    websiteUrl: "",
    facilityKey: "",
    inputPath: ""
  };
  for (const arg of argv) {
    const [key, ...rest] = arg.replace(/^--/, "").split("=");
    const value = rest.join("=");
    if (key === "out-dir") options.outDir = resolve(value);
    if (key === "max-pages") options.maxPages = Number(value);
    if (key === "website-url") options.websiteUrl = value;
    if (key === "facility-key") options.facilityKey = value;
    if (key === "input") options.inputPath = resolve(value);
  }
  return options;
}

async function inputTargets(options) {
  if (options.inputPath) {
    const payload = JSON.parse(await readFile(options.inputPath, "utf8"));
    const records = Array.isArray(payload) ? payload : payload.records || payload.websites || [];
    return records
      .map((record) => ({
        facilityKey: record.facility_key || record.facilityKey || "",
        websiteUrl: record.website_url || record.websiteUrl || record.website || ""
      }))
      .filter((record) => record.websiteUrl);
  }
  if (!options.websiteUrl) throw new Error("Use --website-url or --input");
  return [{ facilityKey: options.facilityKey, websiteUrl: options.websiteUrl }];
}

export async function runContactHarvest(options = {}) {
  const targets = await inputTargets(options);
  const checkedAt = options.checkedAt || new Date().toISOString();
  const runId = checkedAt.replaceAll(/[^0-9A-Za-z]/g, "");
  const runDir = resolve(options.outDir, runId);
  await mkdir(runDir, { recursive: true });

  const results = [];
  for (const target of targets) {
    results.push(await harvestFacilityWebsite({
      facilityKey: target.facilityKey,
      websiteUrl: target.websiteUrl,
      maxPages: options.maxPages || DEFAULT_MAX_PAGES,
      checkedAt
    }));
  }

  const manifest = {
    run_id: runId,
    generated_at: checkedAt,
    parser_version: CONTACT_HARVESTER_VERSION,
    target_count: targets.length,
    success_count: results.filter((result) => result.fetched_pages.length > 0).length,
    failure_count: results.filter((result) => result.fetched_pages.length === 0).length,
    output_file: resolve(runDir, "contact-enrichment-results.json")
  };
  await writeFile(resolve(runDir, "contact-enrichment-results.json"), JSON.stringify({ manifest, results }, null, 2));
  await writeFile(resolve(runDir, "manifest.json"), JSON.stringify(manifest, null, 2));
  await writeFile(resolve(options.outDir, "latest-contact-enrichment.json"), JSON.stringify({ manifest, results }, null, 2));
  return { manifest, results };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await runContactHarvest(parseArgs(process.argv.slice(2)));
    console.log(JSON.stringify(result.manifest, null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
