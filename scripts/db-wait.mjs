import { composeArgs, dbConfig, run } from "./db-utils.mjs";

const attempts = Number(process.env.DB_WAIT_ATTEMPTS || 40);

for (let attempt = 1; attempt <= attempts; attempt += 1) {
  try {
    await run("docker", composeArgs([
      "exec",
      "-T",
      dbConfig.service,
      "pg_isready",
      "-U",
      dbConfig.user,
      "-d",
      dbConfig.database
    ]), { spawnOptions: { stdio: "ignore" } });
    console.log("Database is ready.");
    process.exit(0);
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

console.error(`Database was not ready after ${attempts} seconds.`);
process.exit(1);
