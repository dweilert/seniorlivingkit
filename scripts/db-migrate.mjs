import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { capture, composeArgs, dbConfig, psqlArgs, run } from "./db-utils.mjs";

const migrationsDir = resolve(import.meta.dirname, "..", "db", "migrations");
const migrations = (await readdir(migrationsDir))
  .filter((file) => file.endsWith(".sql"))
  .sort();

if (!migrations.length) {
  console.log("No migrations found.");
  process.exit(0);
}

const databaseExists = (await capture("docker", psqlArgs([
  "-At",
  "-c",
  `SELECT 1 FROM pg_database WHERE datname = '${dbConfig.database}'`
], { database: "postgres" }))).trim() === "1";

if (!databaseExists) {
  await run("docker", composeArgs([
    "exec",
    "-T",
    "-e",
    `PGPASSWORD=${dbConfig.password}`,
    dbConfig.service,
    "createdb",
    "-U",
    dbConfig.user,
    dbConfig.database
  ]));
}

for (const migration of migrations) {
  const containerPath = `/workspace/db/migrations/${migration}`;
  console.log(`Applying ${migration}`);
  await run("docker", psqlArgs(["-f", containerPath]));
}

console.log(`Applied ${migrations.length} migration file(s).`);
