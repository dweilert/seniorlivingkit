import { spawn } from "node:child_process";

export const dbConfig = {
  service: process.env.POSTGRES_SERVICE || "db",
  database: process.env.POSTGRES_DB || "seniorlivingkit",
  user: process.env.POSTGRES_USER || "seniorlivingkit",
  password: process.env.POSTGRES_PASSWORD || "seniorlivingkit_dev"
};

export function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: options.input == null ? "inherit" : ["pipe", "inherit", "inherit"],
      env: { ...process.env, PGPASSWORD: dbConfig.password, ...(options.env || {}) },
      ...options.spawnOptions
    });
    if (options.input != null) {
      child.stdin.end(options.input);
    }
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} exited with ${code}`));
    });
  });
}

export function capture(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: options.input == null ? ["ignore", "pipe", "pipe"] : ["pipe", "pipe", "pipe"],
      env: { ...process.env, PGPASSWORD: dbConfig.password, ...(options.env || {}) },
      ...options.spawnOptions
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    if (options.input != null) {
      child.stdin.end(options.input);
    }
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`${command} ${args.join(" ")} exited with ${code}\n${stderr}`));
    });
  });
}

export function composeArgs(args) {
  return ["compose", ...args];
}

export function psqlArgs(args = [], options = {}) {
  return composeArgs([
    "exec",
    "-T",
    "-e",
    `PGPASSWORD=${dbConfig.password}`,
    dbConfig.service,
    "psql",
    "-v",
    "ON_ERROR_STOP=1",
    "-U",
    dbConfig.user,
    "-d",
    options.database || dbConfig.database,
    ...args
  ]);
}
