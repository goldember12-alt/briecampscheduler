import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { PrismaClient } from "@prisma/client";

export type CsvValidationError = {
  file: string;
  row?: number;
  message: string;
};

type CsvRow = Record<string, string> & { __row: number };

const requiredFiles = {
  "campers.csv": ["camperId", "name", "active"],
  "counselors.csv": ["counselorId", "name", "active"],
  "users.csv": ["userId", "name", "role"],
  "activities.csv": ["activityId", "name", "defaultCamperCapacity", "defaultCounselorCapacity", "active", "activityFamily"],
  "schedule_blocks.csv": ["timeSlotId", "date", "label", "startTime", "endTime", "sortOrder", "displayTitle", "description"],
  "activity_offerings.csv": ["offeringId", "timeSlotId", "activityId", "camperCapacity", "counselorCapacity", "location", "notes"]
} as const;

const optionalFiles = {
  "camper_activity_rules.csv": ["ruleId", "camperId", "activityFamily", "ruleType", "rawValue", "notes"]
} as const;

const roles = new Set(["counselor", "admin"]);
const ruleTypes = new Set(["exclude", "requires_review", "preassigned_or_signed_up", "note"]);

export type CanonicalCsvData = {
  campers: CsvRow[];
  counselors: CsvRow[];
  users: CsvRow[];
  activities: CsvRow[];
  timeSlots: CsvRow[];
  offerings: CsvRow[];
  rules: CsvRow[];
};

export function loadAndValidateCanonicalCsvs(importDir: string): { data?: CanonicalCsvData; errors: CsvValidationError[] } {
  const errors: CsvValidationError[] = [];
  const parsed = new Map<string, CsvRow[]>();

  for (const [file, columns] of Object.entries(requiredFiles)) {
    const path = join(importDir, file);
    if (!existsSync(path)) {
      errors.push({ file, message: "Required file is missing." });
      continue;
    }

    const result = parseCsvFile(file, readFileSync(path, "utf8"), [...columns]);
    errors.push(...result.errors);
    parsed.set(file, result.rows);
  }

  for (const [file, columns] of Object.entries(optionalFiles)) {
    const path = join(importDir, file);
    if (!existsSync(path)) {
      parsed.set(file, []);
      continue;
    }

    const result = parseCsvFile(file, readFileSync(path, "utf8"), [...columns]);
    errors.push(...result.errors);
    parsed.set(file, result.rows);
  }

  if (errors.length > 0) {
    return { errors };
  }

  const data: CanonicalCsvData = {
    campers: parsed.get("campers.csv") ?? [],
    counselors: parsed.get("counselors.csv") ?? [],
    users: parsed.get("users.csv") ?? [],
    activities: parsed.get("activities.csv") ?? [],
    timeSlots: parsed.get("schedule_blocks.csv") ?? [],
    offerings: parsed.get("activity_offerings.csv") ?? [],
    rules: parsed.get("camper_activity_rules.csv") ?? []
  };

  validateUnique(data.campers, "campers.csv", "camperId", errors);
  validateUnique(data.counselors, "counselors.csv", "counselorId", errors);
  validateUnique(data.users, "users.csv", "userId", errors);
  validateUnique(data.activities, "activities.csv", "activityId", errors);
  validateUnique(data.timeSlots, "schedule_blocks.csv", "timeSlotId", errors);
  validateUnique(data.offerings, "activity_offerings.csv", "offeringId", errors);
  validateUnique(data.rules, "camper_activity_rules.csv", "ruleId", errors);

  for (const row of data.campers) {
    validateBoolean(row, "campers.csv", "active", errors);
  }
  for (const row of data.counselors) {
    validateBoolean(row, "counselors.csv", "active", errors);
  }
  for (const row of data.users) {
    if (!roles.has(row.role)) {
      errors.push({ file: "users.csv", row: row.__row, message: `role must be counselor or admin.` });
    }
  }
  for (const row of data.activities) {
    validateInteger(row, "activities.csv", "defaultCamperCapacity", { min: 0 }, errors);
    validateInteger(row, "activities.csv", "defaultCounselorCapacity", { min: 0 }, errors);
    validateBoolean(row, "activities.csv", "active", errors);
  }
  for (const row of data.timeSlots) {
    validateDate(row, "schedule_blocks.csv", "date", errors);
    validateTime(row, "schedule_blocks.csv", "startTime", errors);
    validateTime(row, "schedule_blocks.csv", "endTime", errors);
    validateInteger(row, "schedule_blocks.csv", "sortOrder", undefined, errors);
  }
  for (const row of data.offerings) {
    validateInteger(row, "activity_offerings.csv", "camperCapacity", { min: 0 }, errors);
    validateInteger(row, "activity_offerings.csv", "counselorCapacity", { min: 0 }, errors);
  }
  for (const row of data.rules) {
    if (!ruleTypes.has(row.ruleType)) {
      errors.push({ file: "camper_activity_rules.csv", row: row.__row, message: `ruleType must be one of ${[...ruleTypes].join(", ")}.` });
    }
  }

  const timeSlotIds = new Set(data.timeSlots.map((row) => row.timeSlotId));
  const activityIds = new Set(data.activities.map((row) => row.activityId));
  const camperIds = new Set(data.campers.map((row) => row.camperId));
  const activityFamilies = new Set(data.activities.map((row) => normalizeFamily(row.activityFamily)));

  for (const row of data.offerings) {
    if (!timeSlotIds.has(row.timeSlotId)) {
      errors.push({ file: "activity_offerings.csv", row: row.__row, message: `timeSlotId '${row.timeSlotId}' does not exist in schedule_blocks.csv.` });
    }
    if (!activityIds.has(row.activityId)) {
      errors.push({ file: "activity_offerings.csv", row: row.__row, message: `activityId '${row.activityId}' does not exist in activities.csv.` });
    }
  }

  for (const row of data.rules) {
    if (!camperIds.has(row.camperId)) {
      errors.push({ file: "camper_activity_rules.csv", row: row.__row, message: `camperId '${row.camperId}' does not exist in campers.csv.` });
    }
    if (!activityFamilies.has(normalizeFamily(row.activityFamily))) {
      errors.push({ file: "camper_activity_rules.csv", row: row.__row, message: `activityFamily '${row.activityFamily}' does not match activities.csv.` });
    }
  }

  return errors.length > 0 ? { errors } : { data, errors: [] };
}

export async function replaceSetupDataFromCanonicalCsvs(prisma: PrismaClient, data: CanonicalCsvData) {
  await prisma.$transaction(async (tx) => {
    await tx.counselorAssignment.deleteMany();
    await tx.assignment.deleteMany();
    await tx.camperActivityRule.deleteMany();
    await tx.activityOffering.deleteMany();
    await tx.timeSlot.deleteMany();
    await tx.activity.deleteMany();
    await tx.user.deleteMany();
    await tx.counselor.deleteMany();
    await tx.camper.deleteMany();

    const camperByExternalId = new Map<string, number>();
    const activityByExternalId = new Map<string, { id: number; activityFamily: string }>();
    const timeSlotByExternalId = new Map<string, number>();

    for (const row of data.campers) {
      const camper = await tx.camper.create({
        data: { externalId: row.camperId, name: row.name, active: parseBoolean(row.active) }
      });
      camperByExternalId.set(row.camperId, camper.id);
    }

    for (const row of data.counselors) {
      await tx.counselor.create({
        data: { externalId: row.counselorId, name: row.name, active: parseBoolean(row.active) }
      });
    }

    for (const row of data.users) {
      await tx.user.create({
        data: { externalId: row.userId, name: row.name, role: row.role as "counselor" | "admin" }
      });
    }

    for (const row of data.activities) {
      const activity = await tx.activity.create({
        data: {
          externalId: row.activityId,
          name: row.name,
          capacity: Number(row.defaultCamperCapacity),
          defaultCamperCapacity: Number(row.defaultCamperCapacity),
          defaultCounselorCapacity: Number(row.defaultCounselorCapacity),
          active: parseBoolean(row.active),
          activityFamily: row.activityFamily
        }
      });
      activityByExternalId.set(row.activityId, { id: activity.id, activityFamily: activity.activityFamily });
    }

    for (const row of data.timeSlots) {
      const timeSlot = await tx.timeSlot.create({
        data: {
          externalId: row.timeSlotId,
          date: new Date(`${row.date}T00:00:00.000Z`),
          label: row.label,
          startTime: row.startTime,
          endTime: row.endTime,
          sortOrder: Number(row.sortOrder),
          displayTitle: row.displayTitle,
          description: row.description
        }
      });
      timeSlotByExternalId.set(row.timeSlotId, timeSlot.id);
    }

    for (const row of data.offerings) {
      const activity = activityByExternalId.get(row.activityId);
      const timeSlotId = timeSlotByExternalId.get(row.timeSlotId);
      if (!activity || !timeSlotId) {
        throw new Error("Canonical CSV data was not validated before loading.");
      }

      await tx.activityOffering.create({
        data: {
          externalId: row.offeringId,
          timeSlotId,
          activityId: activity.id,
          camperCapacity: Number(row.camperCapacity),
          counselorCapacity: Number(row.counselorCapacity),
          location: row.location,
          notes: row.notes
        }
      });
    }

    for (const row of data.rules) {
      const camperId = camperByExternalId.get(row.camperId);
      const activity = [...activityByExternalId.values()].find((value) => normalizeFamily(value.activityFamily) === normalizeFamily(row.activityFamily));
      if (!camperId || !activity) {
        throw new Error("Canonical CSV data was not validated before loading.");
      }

      await tx.camperActivityRule.create({
        data: {
          externalId: row.ruleId,
          camperId,
          activityId: activity.id,
          activityNameRaw: row.activityFamily,
          activityFamily: row.activityFamily,
          ruleType: row.ruleType as "exclude" | "requires_review" | "preassigned_or_signed_up" | "note",
          rawValue: row.rawValue,
          notes: row.notes,
          sourceFile: "camper_activity_rules.csv",
          sourceRow: row.__row
        }
      });
    }
  });
}

function parseCsvFile(file: string, text: string, expectedColumns: string[]): { rows: CsvRow[]; errors: CsvValidationError[] } {
  const errors: CsvValidationError[] = [];
  const records = parseCsv(text);
  const header = records[0] ?? [];
  if (header.join(",") !== expectedColumns.join(",")) {
    errors.push({ file, row: 1, message: `Header must be exactly: ${expectedColumns.join(",")}.` });
    return { rows: [], errors };
  }

  const rows: CsvRow[] = [];
  for (let index = 1; index < records.length; index += 1) {
    const record = records[index];
    const rowNumber = index + 1;
    if (record.length === 1 && record[0] === "") {
      continue;
    }
    if (record.length !== expectedColumns.length) {
      errors.push({ file, row: rowNumber, message: `Expected ${expectedColumns.length} columns but found ${record.length}.` });
      continue;
    }

    const row = { __row: rowNumber } as CsvRow;
    expectedColumns.forEach((column, columnIndex) => {
      row[column] = record[columnIndex].trim();
    });
    rows.push(row);
  }

  return { rows, errors };
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  const normalized = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];
    const next = normalized[index + 1];

    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

function validateUnique(rows: CsvRow[], file: string, column: string, errors: CsvValidationError[]) {
  const seen = new Map<string, number>();
  for (const row of rows) {
    const value = row[column];
    if (!value) {
      errors.push({ file, row: row.__row, message: `${column} is required.` });
      continue;
    }
    const firstRow = seen.get(value);
    if (firstRow) {
      errors.push({ file, row: row.__row, message: `${column} '${value}' is duplicated; first seen on row ${firstRow}.` });
    } else {
      seen.set(value, row.__row);
    }
  }
}

function validateBoolean(row: CsvRow, file: string, column: string, errors: CsvValidationError[]) {
  if (row[column] !== "true" && row[column] !== "false") {
    errors.push({ file, row: row.__row, message: `${column} must be true or false.` });
  }
}

function validateInteger(row: CsvRow, file: string, column: string, options: { min?: number } | undefined, errors: CsvValidationError[]) {
  if (!/^-?\d+$/.test(row[column])) {
    errors.push({ file, row: row.__row, message: `${column} must be an integer.` });
    return;
  }

  const value = Number(row[column]);
  if (options?.min !== undefined && value < options.min) {
    errors.push({ file, row: row.__row, message: `${column} must be at least ${options.min}.` });
  }
}

function validateDate(row: CsvRow, file: string, column: string, errors: CsvValidationError[]) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(row[column])) {
    errors.push({ file, row: row.__row, message: `${column} must use YYYY-MM-DD.` });
    return;
  }

  const date = new Date(`${row[column]}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== row[column]) {
    errors.push({ file, row: row.__row, message: `${column} must be a real calendar date.` });
  }
}

function validateTime(row: CsvRow, file: string, column: string, errors: CsvValidationError[]) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(row[column])) {
    errors.push({ file, row: row.__row, message: `${column} must use HH:mm.` });
  }
}

function parseBoolean(value: string) {
  return value === "true";
}

function normalizeFamily(value: string) {
  return value.trim().toLowerCase();
}
