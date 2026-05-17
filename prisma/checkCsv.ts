import { resolve } from "node:path";
import { loadAndValidateCanonicalCsvs } from "../server/src/services/canonicalCsv";

const importDir = resolve(process.argv[2] ?? "data/import");
const result = loadAndValidateCanonicalCsvs(importDir);

console.log(`Checking canonical CSV setup files in ${importDir}`);

if (result.errors.length > 0) {
  console.error("CSV validation failed. Database was not modified.");
  for (const error of result.errors) {
    const row = error.row ? ` row ${error.row}` : "";
    console.error(`- ${error.file}${row}: ${error.message}`);
  }
  process.exit(1);
}

console.log("CSV validation passed. Database was not modified.");
console.log(
  `Found ${result.data?.campers.length ?? 0} campers, ${result.data?.counselors.length ?? 0} counselors, ${result.data?.activities.length ?? 0} activities, ${result.data?.timeSlots.length ?? 0} schedule blocks, ${result.data?.offerings.length ?? 0} offerings, and ${result.data?.rules.length ?? 0} camper activity rules.`
);
