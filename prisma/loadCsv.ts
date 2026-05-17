import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { loadAndValidateCanonicalCsvs, replaceSetupDataFromCanonicalCsvs } from "../server/src/services/canonicalCsv";

const prisma = new PrismaClient();
const importDir = resolve(process.argv[2] ?? "data/import");

async function main() {
  console.log(`Reading canonical CSV setup files from ${importDir}`);
  const result = loadAndValidateCanonicalCsvs(importDir);

  if (!result.data) {
    console.error("CSV validation failed. Database was not modified.");
    for (const error of result.errors) {
      const row = error.row ? ` row ${error.row}` : "";
      console.error(`- ${error.file}${row}: ${error.message}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log("CSV validation passed.");
  console.log("Replacing setup data and clearing existing camper/counselor assignments for this local MVP load.");
  await replaceSetupDataFromCanonicalCsvs(prisma, result.data);
  console.log(
    `Loaded ${result.data.campers.length} campers, ${result.data.counselors.length} counselors, ${result.data.activities.length} activities, ${result.data.timeSlots.length} schedule blocks, ${result.data.offerings.length} offerings, and ${result.data.rules.length} camper activity rules.`
  );
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
