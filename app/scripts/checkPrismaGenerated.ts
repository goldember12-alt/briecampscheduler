import { existsSync } from "node:fs";
import { join } from "node:path";

const clientDir = join(process.cwd(), "node_modules", ".prisma", "client");
const missing: string[] = [];

checkFile(join(process.cwd(), "node_modules", "@prisma", "client", "default.js"), "node_modules/@prisma/client/default.js");
checkFile(join(clientDir, "index.js"), "node_modules/.prisma/client/index.js");
checkFile(join(clientDir, "schema.prisma"), "node_modules/.prisma/client/schema.prisma");

if (process.platform === "win32") {
  checkFile(join(clientDir, "query_engine-windows.dll.node"), "node_modules/.prisma/client/query_engine-windows.dll.node");
}

if (missing.length > 0) {
  console.error("This app package is missing generated Prisma files.");
  console.error("Rebuild the release package on a machine with internet access, or run the repair/generate step from an allowed network.");
  console.error("");
  console.error("Missing files:");
  for (const file of missing) {
    console.error(`- ${file}`);
  }
  process.exit(1);
}

function checkFile(path: string, label: string) {
  if (!existsSync(path)) {
    missing.push(label);
  }
}
