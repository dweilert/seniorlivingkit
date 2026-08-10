import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { FACILITY_SOURCES, summarizeRecords, validateRecords } from "./facility-collector.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_IN_DIR = resolve(root, "data", "facilities");

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function toCsv(records) {
  if (records.length === 0) return "";

  const columns = Object.keys(records[0]);
  const escape = (value) => {
    const normalized = value && typeof value === "object" ? JSON.stringify(value) : value;
    return `"${String(normalized ?? "").replaceAll("\"", "\"\"")}"`;
  };
  return `${columns.join(",")}\n${records.map((record) => columns.map((column) => escape(record[column])).join(",")).join("\n")}\n`;
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function readLatestSourceExport(inDir, sourceId) {
  const manifestPath = resolve(inDir, `${sourceId}-latest-manifest.json`);
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  let latestJson = manifest.outputs.latest_json;
  let payload;
  try {
    payload = JSON.parse(await readFile(latestJson, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    latestJson = resolve(inDir, basename(manifest.outputs.latest_json));
    payload = JSON.parse(await readFile(latestJson, "utf8"));
  }
  return { manifest, payload };
}

function compareFacilities(a, b) {
  return a.state.localeCompare(b.state)
    || a.city.localeCompare(b.city)
    || a.facility_name.localeCompare(b.facility_name)
    || a.facility_key.localeCompare(b.facility_key);
}

export async function exportCombinedFacilities(options = {}) {
  const inDir = resolve(options.inDir ?? DEFAULT_IN_DIR);
  const outDir = resolve(options.outDir ?? inDir);
  const sourceIds = options.sourceIds?.length ? options.sourceIds : Object.keys(FACILITY_SOURCES);
  const generatedAt = options.generatedAt ?? new Date().toISOString();

  const sourceExports = [];
  for (const sourceId of sourceIds) {
    sourceExports.push(await readLatestSourceExport(inDir, sourceId));
  }

  const sourceManifests = sourceExports.map(({ manifest }) => ({
    source_id: manifest.source_id,
    run_id: manifest.run_id,
    selected_records: manifest.selected_records,
    selected_records_sha256: manifest.selected_records_sha256,
    source_url: manifest.source_url,
    source_owner: manifest.source_owner
  }));
  const allRecords = sourceExports.flatMap(({ payload }) => payload.records).sort(compareFacilities);
  const activeRecords = allRecords.filter((record) => record.is_active);
  const allSummary = summarizeRecords(allRecords);
  const activeSummary = summarizeRecords(activeRecords);
  const allValidation = validateRecords(allRecords);
  const activeValidation = validateRecords(activeRecords);
  const allHash = sha256(stableJson(allRecords));
  const activeHash = sha256(stableJson(activeRecords));
  const baseSourcePayload = {
    generated_at: generatedAt,
    source_exports: sourceManifests,
    sources: sourceIds.map((sourceId) => {
      const source = FACILITY_SOURCES[sourceId];
      return {
        id: source.id,
        name: source.name,
        jurisdiction: source.jurisdiction,
        owner: source.sourceOwner,
        system: source.sourceSystem,
        url: source.sourceUrl
      };
    })
  };
  const allPayload = {
    ...baseSourcePayload,
    export_type: "all",
    record_count: allRecords.length,
    records_sha256: allHash,
    summary: allSummary,
    validation: allValidation,
    records: allRecords
  };
  const activePayload = {
    ...baseSourcePayload,
    export_type: "active",
    record_count: activeRecords.length,
    records_sha256: activeHash,
    summary: activeSummary,
    validation: activeValidation,
    records: activeRecords
  };
  const manifest = {
    generated_at: generatedAt,
    source_exports: sourceManifests,
    all_records: allRecords.length,
    active_records: activeRecords.length,
    all_records_sha256: allHash,
    active_records_sha256: activeHash,
    all_summary: allSummary,
    active_summary: activeSummary,
    all_validation: allValidation,
    active_validation: activeValidation,
    outputs: {
      combined_all_json: resolve(outDir, "combined-facilities-all.json"),
      combined_all_csv: resolve(outDir, "combined-facilities-all.csv"),
      combined_active_json: resolve(outDir, "combined-facilities-active.json"),
      combined_active_csv: resolve(outDir, "combined-facilities-active.csv"),
      combined_manifest: resolve(outDir, "combined-facilities-manifest.json")
    }
  };

  await writeJson(manifest.outputs.combined_all_json, allPayload);
  await writeFile(manifest.outputs.combined_all_csv, toCsv(allRecords));
  await writeJson(manifest.outputs.combined_active_json, activePayload);
  await writeFile(manifest.outputs.combined_active_csv, toCsv(activeRecords));
  await writeJson(manifest.outputs.combined_manifest, manifest);

  return manifest;
}

function parseArgs(argv) {
  const options = {};

  for (const arg of argv) {
    const [key, value] = arg.startsWith("--") ? arg.slice(2).split("=", 2) : [arg, undefined];
    if (key === "in-dir") options.inDir = value;
    else if (key === "out-dir") options.outDir = value;
    else if (key === "sources") options.sourceIds = value.split(",").map((source) => source.trim()).filter(Boolean);
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const manifest = await exportCombinedFacilities(parseArgs(process.argv.slice(2)));
  console.log(JSON.stringify({
    all_records: manifest.all_records,
    active_records: manifest.active_records,
    all_records_sha256: manifest.all_records_sha256,
    active_records_sha256: manifest.active_records_sha256,
    combined_manifest: manifest.outputs.combined_manifest
  }, null, 2));
}
