import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

const databaseUrl = process.env.DATABASE_URL ?? "file:./dev.db";
const dbPath = databaseUrl.startsWith("file:") ? databaseUrl.slice("file:".length) : databaseUrl;
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const resolvedPath = resolve(dbPath.startsWith("./") ? resolve(projectRoot, "prisma", dbPath.slice(2)) : dbPath);

mkdirSync(dirname(resolvedPath), { recursive: true });

const db = new DatabaseSync(resolvedPath);
db.exec("PRAGMA foreign_keys = ON;");

db.exec(`
CREATE TABLE IF NOT EXISTS "Camper" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS "Counselor" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "name" TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS "User" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "name" TEXT NOT NULL,
  "role" TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS "Activity" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "name" TEXT NOT NULL,
  "capacity" INTEGER NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS "TimeSlot" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "date" DATETIME NOT NULL,
  "label" TEXT NOT NULL,
  "startTime" TEXT NOT NULL,
  "endTime" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS "ActivityOffering" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "activityId" INTEGER NOT NULL,
  "timeSlotId" INTEGER NOT NULL,
  "camperCapacity" INTEGER NOT NULL,
  "counselorCapacity" INTEGER NOT NULL,
  CONSTRAINT "ActivityOffering_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ActivityOffering_timeSlotId_fkey" FOREIGN KEY ("timeSlotId") REFERENCES "TimeSlot" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "Assignment" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "camperId" INTEGER NOT NULL,
  "offeringId" INTEGER NOT NULL,
  "timeSlotId" INTEGER NOT NULL,
  "createdByUserId" INTEGER NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "Assignment_camperId_fkey" FOREIGN KEY ("camperId") REFERENCES "Camper" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Assignment_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "ActivityOffering" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Assignment_timeSlotId_fkey" FOREIGN KEY ("timeSlotId") REFERENCES "TimeSlot" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Assignment_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "CounselorAssignment" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "counselorId" INTEGER NOT NULL,
  "offeringId" INTEGER NOT NULL,
  "timeSlotId" INTEGER NOT NULL,
  "createdByUserId" INTEGER NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "CounselorAssignment_counselorId_fkey" FOREIGN KEY ("counselorId") REFERENCES "Counselor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CounselorAssignment_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "ActivityOffering" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CounselorAssignment_timeSlotId_fkey" FOREIGN KEY ("timeSlotId") REFERENCES "TimeSlot" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CounselorAssignment_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "CamperActivityRule" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "camperId" INTEGER NOT NULL,
  "activityId" INTEGER,
  "activityNameRaw" TEXT NOT NULL,
  "ruleType" TEXT NOT NULL,
  "date" DATETIME,
  "rawValue" TEXT NOT NULL,
  "sourceFile" TEXT,
  "sourceRow" INTEGER,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "CamperActivityRule_camperId_fkey" FOREIGN KEY ("camperId") REFERENCES "Camper" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CamperActivityRule_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "Assignment_camperId_timeSlotId_key" ON "Assignment"("camperId", "timeSlotId");
CREATE UNIQUE INDEX IF NOT EXISTS "CounselorAssignment_counselorId_timeSlotId_key" ON "CounselorAssignment"("counselorId", "timeSlotId");
`);

db.exec(`DROP INDEX IF EXISTS "ActivityOffering_activityId_timeSlotId_key";`);

addColumn("Camper", "externalId", "TEXT");
addColumn("Counselor", "externalId", "TEXT");
addColumn("Counselor", "active", "BOOLEAN NOT NULL DEFAULT true");
addColumn("User", "externalId", "TEXT");
addColumn("Activity", "externalId", "TEXT");
addColumn("Activity", "defaultCamperCapacity", "INTEGER NOT NULL DEFAULT 0");
addColumn("Activity", "defaultCounselorCapacity", "INTEGER NOT NULL DEFAULT 0");
addColumn("Activity", "activityFamily", "TEXT NOT NULL DEFAULT ''");
addColumn("TimeSlot", "externalId", "TEXT");
addColumn("TimeSlot", "displayTitle", "TEXT");
addColumn("TimeSlot", "description", "TEXT");
addColumn("ActivityOffering", "externalId", "TEXT");
addColumn("ActivityOffering", "location", "TEXT");
addColumn("ActivityOffering", "notes", "TEXT");
addColumn("CamperActivityRule", "externalId", "TEXT");
addColumn("CamperActivityRule", "activityFamily", "TEXT NOT NULL DEFAULT ''");
addColumn("CamperActivityRule", "notes", "TEXT");

db.exec(`
UPDATE "Activity"
SET "defaultCamperCapacity" = CASE WHEN "defaultCamperCapacity" = 0 THEN "capacity" ELSE "defaultCamperCapacity" END,
    "activityFamily" = CASE WHEN "activityFamily" = '' THEN "name" ELSE "activityFamily" END;

UPDATE "TimeSlot"
SET "displayTitle" = CASE WHEN "displayTitle" IS NULL OR "displayTitle" = '' THEN "label" ELSE "displayTitle" END;

UPDATE "CamperActivityRule"
SET "activityFamily" = CASE WHEN "activityFamily" = '' THEN "activityNameRaw" ELSE "activityFamily" END;

CREATE UNIQUE INDEX IF NOT EXISTS "Camper_externalId_key" ON "Camper"("externalId");
CREATE UNIQUE INDEX IF NOT EXISTS "Counselor_externalId_key" ON "Counselor"("externalId");
CREATE UNIQUE INDEX IF NOT EXISTS "User_externalId_key" ON "User"("externalId");
CREATE UNIQUE INDEX IF NOT EXISTS "Activity_externalId_key" ON "Activity"("externalId");
CREATE UNIQUE INDEX IF NOT EXISTS "TimeSlot_externalId_key" ON "TimeSlot"("externalId");
CREATE UNIQUE INDEX IF NOT EXISTS "ActivityOffering_externalId_key" ON "ActivityOffering"("externalId");
CREATE UNIQUE INDEX IF NOT EXISTS "CamperActivityRule_externalId_key" ON "CamperActivityRule"("externalId");
`);

db.close();
console.log(`SQLite schema is ready at ${resolvedPath}`);

function addColumn(table: string, column: string, definition: string) {
  const existing = db.prepare(`PRAGMA table_info("${table}")`).all() as Array<{ name: string }>;
  if (!existing.some((row) => row.name === column)) {
    db.exec(`ALTER TABLE "${table}" ADD COLUMN "${column}" ${definition};`);
  }
}
