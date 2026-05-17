import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const databaseUrl = process.env.DATABASE_URL ?? "file:./dev.db";
const dbPath = databaseUrl.startsWith("file:") ? databaseUrl.slice("file:".length) : databaseUrl;
const dbFile = resolve(dbPath.startsWith("./") ? resolve("prisma", dbPath.slice(2)) : dbPath);

if (!existsSync(dbFile)) {
  console.error(`Database file was not found: ${dbFile}`);
  console.error("Run LOAD-DATA.bat before creating a backup.");
  process.exit(1);
}

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupPath = resolve("../backups", `camp-assignments-${timestamp}.db`);

mkdirSync(dirname(backupPath), { recursive: true });
copyFileSync(dbFile, backupPath);

console.log(`Backup created: ${backupPath}`);
