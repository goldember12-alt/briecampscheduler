import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { prisma } from "../src/db";
import { loadAndValidateCanonicalCsvs, replaceSetupDataFromCanonicalCsvs } from "../src/services/canonicalCsv";
import { classifyChecklistValue } from "../src/services/rules";

const app = createApp();

type TestSeed = Awaited<ReturnType<typeof seedTestData>>;

beforeAll(async () => {
  await prisma.$connect();
});

beforeEach(async () => {
  await seedTestData();
});

async function reset() {
  await prisma.counselorAssignment.deleteMany();
  await prisma.assignment.deleteMany();
  await prisma.camperActivityRule.deleteMany();
  await prisma.activityOffering.deleteMany();
  await prisma.timeSlot.deleteMany();
  await prisma.activity.deleteMany();
  await prisma.user.deleteMany();
  await prisma.counselor.deleteMany();
  await prisma.camper.deleteMany();
}

async function seedTestData() {
  await reset();

  const campers = await Promise.all(
    ["Camper A", "Camper B", "Camper C", "Camper D", "Camper E", "Camper F", "Camper G"].map((name) =>
      prisma.camper.create({ data: { externalId: name.toLowerCase().replaceAll(" ", "_"), name, active: true } })
    )
  );

  const counselors = await Promise.all(
    ["Counselor A", "Counselor B", "Counselor C"].map((name) => prisma.counselor.create({ data: { externalId: name.toLowerCase().replaceAll(" ", "_"), name, active: true } }))
  );

  const counselorUser = await prisma.user.create({ data: { externalId: "test_user_counselor", name: "Counselor User", role: "counselor" } });
  const adminUser = await prisma.user.create({ data: { externalId: "test_user_admin", name: "Admin User", role: "admin" } });

  const [archery, fishing, horses, canoes, highRopes] = await Promise.all(
    [
      ["Archery", 2],
      ["Fishing", 2],
      ["Horses", 2],
      ["Canoes", 2],
      ["High Ropes", 2]
    ].map(([name, capacity]) =>
      prisma.activity.create({
        data: {
          externalId: `test_activity_${String(name).toLowerCase().replaceAll(" ", "_")}`,
          name: String(name),
          capacity: Number(capacity),
          defaultCamperCapacity: Number(capacity),
          defaultCounselorCapacity: 1,
          active: true,
          activityFamily: String(name)
        }
      })
    )
  );

  const timeSlot1 = await prisma.timeSlot.create({
    data: {
      date: new Date("2026-06-15T00:00:00.000Z"),
      externalId: "test_slot_activity_1",
      label: "Activity 1",
      startTime: "09:00",
      endTime: "10:00",
      sortOrder: 1,
      displayTitle: "Activity 1",
      description: "Morning block"
    }
  });
  const timeSlot2 = await prisma.timeSlot.create({
    data: {
      date: new Date("2026-06-15T00:00:00.000Z"),
      externalId: "test_slot_activity_2",
      label: "Activity 2",
      startTime: "10:15",
      endTime: "11:15",
      sortOrder: 2,
      displayTitle: "Activity 2",
      description: "Late morning block"
    }
  });

  const offerings = {
    archery1: await prisma.activityOffering.create({
      data: { externalId: "test_offer_archery_1", activityId: archery.id, timeSlotId: timeSlot1.id, camperCapacity: 2, counselorCapacity: 1, location: "Archery Range", notes: "" }
    }),
    fishing1: await prisma.activityOffering.create({
      data: { externalId: "test_offer_fishing_1", activityId: fishing.id, timeSlotId: timeSlot1.id, camperCapacity: 2, counselorCapacity: 1, location: "Dock", notes: "" }
    }),
    horses1: await prisma.activityOffering.create({
      data: { externalId: "test_offer_horses_1", activityId: horses.id, timeSlotId: timeSlot1.id, camperCapacity: 2, counselorCapacity: 2, location: "Stables", notes: "" }
    }),
    canoes1: await prisma.activityOffering.create({
      data: { externalId: "test_offer_canoes_1", activityId: canoes.id, timeSlotId: timeSlot1.id, camperCapacity: 2, counselorCapacity: 1, location: "Lake", notes: "" }
    }),
    highRopes1: await prisma.activityOffering.create({
      data: { externalId: "test_offer_high_ropes_1", activityId: highRopes.id, timeSlotId: timeSlot1.id, camperCapacity: 2, counselorCapacity: 2, location: "Ropes Course", notes: "" }
    }),
    archery2: await prisma.activityOffering.create({
      data: { externalId: "test_offer_archery_2", activityId: archery.id, timeSlotId: timeSlot2.id, camperCapacity: 2, counselorCapacity: 1, location: "Archery Range", notes: "" }
    }),
    lastSpot: await prisma.activityOffering.create({
      data: { externalId: "test_offer_last_spot", activityId: fishing.id, timeSlotId: timeSlot2.id, camperCapacity: 1, counselorCapacity: 1, location: "Dock", notes: "" }
    })
  };

  return {
    campers,
    counselors,
    users: { counselorUser, adminUser },
    activities: { archery, fishing, horses, canoes, highRopes },
    offerings
  };
}

async function currentSeed(): Promise<TestSeed> {
  const [campers, counselors, counselorUser, adminUser, archery, fishing, horses, canoes, highRopes] = await Promise.all([
    prisma.camper.findMany({ orderBy: { name: "asc" } }),
    prisma.counselor.findMany({ orderBy: { name: "asc" } }),
    prisma.user.findFirstOrThrow({ where: { name: "Counselor User" } }),
    prisma.user.findFirstOrThrow({ where: { name: "Admin User" } }),
    prisma.activity.findFirstOrThrow({ where: { name: "Archery" } }),
    prisma.activity.findFirstOrThrow({ where: { name: "Fishing" } }),
    prisma.activity.findFirstOrThrow({ where: { name: "Horses" } }),
    prisma.activity.findFirstOrThrow({ where: { name: "Canoes" } }),
    prisma.activity.findFirstOrThrow({ where: { name: "High Ropes" } })
  ]);

  const [archery1, fishing1, horses1, canoes1, highRopes1, archery2, lastSpot] = await Promise.all([
    prisma.activityOffering.findFirstOrThrow({ where: { activityId: archery.id, timeSlot: { label: "Activity 1" } } }),
    prisma.activityOffering.findFirstOrThrow({ where: { activityId: fishing.id, timeSlot: { label: "Activity 1" } } }),
    prisma.activityOffering.findFirstOrThrow({ where: { activityId: horses.id, timeSlot: { label: "Activity 1" } } }),
    prisma.activityOffering.findFirstOrThrow({ where: { activityId: canoes.id, timeSlot: { label: "Activity 1" } } }),
    prisma.activityOffering.findFirstOrThrow({ where: { activityId: highRopes.id, timeSlot: { label: "Activity 1" } } }),
    prisma.activityOffering.findFirstOrThrow({ where: { activityId: archery.id, timeSlot: { label: "Activity 2" } } }),
    prisma.activityOffering.findFirstOrThrow({ where: { activityId: fishing.id, timeSlot: { label: "Activity 2" } } })
  ]);

  return {
    campers,
    counselors,
    users: { counselorUser, adminUser },
    activities: { archery, fishing, horses, canoes, highRopes },
    offerings: { archery1, fishing1, horses1, canoes1, highRopes1, archery2, lastSpot }
  };
}

async function postCamper(camperId: number, offeringId: number, createdByUserId: number) {
  return request(app).post("/api/assignments").send({ camperId, offeringId, createdByUserId });
}

async function postCounselor(counselorId: number, offeringId: number, createdByUserId: number) {
  return request(app).post("/api/counselor-assignments").send({ counselorId, offeringId, createdByUserId });
}

describe("camper assignment rules", () => {
  it("assigns camper A to Archery in Activity 1", async () => {
    const seed = await currentSeed();
    const response = await postCamper(seed.campers[0].id, seed.offerings.archery1.id, seed.users.counselorUser.id);

    expect(response.status).toBe(201);
    expect(response.body.camperId).toBe(seed.campers[0].id);
  });

  it("rejects assigning camper A to Fishing in the same time slot", async () => {
    const seed = await currentSeed();
    await postCamper(seed.campers[0].id, seed.offerings.archery1.id, seed.users.counselorUser.id);

    const response = await postCamper(seed.campers[0].id, seed.offerings.fishing1.id, seed.users.counselorUser.id);

    expect(response.status).toBe(409);
    expect(response.body.error).toBe("Camper is already assigned during this time slot.");
  });

  it("allows assignments up to camper capacity and rejects one more", async () => {
    const seed = await currentSeed();

    expect((await postCamper(seed.campers[0].id, seed.offerings.archery1.id, seed.users.counselorUser.id)).status).toBe(201);
    expect((await postCamper(seed.campers[1].id, seed.offerings.archery1.id, seed.users.counselorUser.id)).status).toBe(201);

    const response = await postCamper(seed.campers[2].id, seed.offerings.archery1.id, seed.users.counselorUser.id);
    expect(response.status).toBe(409);
    expect(response.body.error).toBe("Activity offering is full.");
  });

  it("removing a camper frees one camper capacity spot", async () => {
    const seed = await currentSeed();
    const first = await postCamper(seed.campers[0].id, seed.offerings.archery1.id, seed.users.counselorUser.id);
    await postCamper(seed.campers[1].id, seed.offerings.archery1.id, seed.users.counselorUser.id);

    expect((await request(app).delete(`/api/assignments/${first.body.id}`)).status).toBe(200);
    expect((await postCamper(seed.campers[2].id, seed.offerings.archery1.id, seed.users.counselorUser.id)).status).toBe(201);
  });

  it("does not allow two concurrent requests to both take the last camper spot", async () => {
    const seed = await currentSeed();

    const results = await Promise.all([
      postCamper(seed.campers[0].id, seed.offerings.lastSpot.id, seed.users.counselorUser.id),
      postCamper(seed.campers[1].id, seed.offerings.lastSpot.id, seed.users.counselorUser.id)
    ]);

    expect(results.filter((result) => result.status === 201)).toHaveLength(1);
    expect(results.filter((result) => result.status === 409)).toHaveLength(1);
  });

  it("assigns the same camper to different non-overlapping time slots", async () => {
    const seed = await currentSeed();

    expect((await postCamper(seed.campers[0].id, seed.offerings.archery1.id, seed.users.counselorUser.id)).status).toBe(201);
    expect((await postCamper(seed.campers[0].id, seed.offerings.archery2.id, seed.users.counselorUser.id)).status).toBe(201);
  });
});

describe("counselor staffing rules", () => {
  it("assigns counselor A to Archery in Activity 1", async () => {
    const seed = await currentSeed();
    const response = await postCounselor(seed.counselors[0].id, seed.offerings.archery1.id, seed.users.adminUser.id);

    expect(response.status).toBe(201);
    expect(response.body.counselorId).toBe(seed.counselors[0].id);
  });

  it("rejects assigning counselor A to Fishing in the same time slot", async () => {
    const seed = await currentSeed();
    await postCounselor(seed.counselors[0].id, seed.offerings.archery1.id, seed.users.adminUser.id);

    const response = await postCounselor(seed.counselors[0].id, seed.offerings.fishing1.id, seed.users.adminUser.id);

    expect(response.status).toBe(409);
    expect(response.body.error).toBe("Counselor is already assigned during this time slot.");
  });

  it("allows assignments up to counselor capacity and rejects one more", async () => {
    const seed = await currentSeed();

    expect((await postCounselor(seed.counselors[0].id, seed.offerings.horses1.id, seed.users.adminUser.id)).status).toBe(201);
    expect((await postCounselor(seed.counselors[1].id, seed.offerings.horses1.id, seed.users.adminUser.id)).status).toBe(201);

    const response = await postCounselor(seed.counselors[2].id, seed.offerings.horses1.id, seed.users.adminUser.id);
    expect(response.status).toBe(409);
    expect(response.body.error).toBe("Counselor staffing capacity is full.");
  });

  it("removing a counselor frees one counselor capacity spot", async () => {
    const seed = await currentSeed();
    const first = await postCounselor(seed.counselors[0].id, seed.offerings.archery1.id, seed.users.adminUser.id);

    expect((await request(app).delete(`/api/counselor-assignments/${first.body.id}`)).status).toBe(200);
    expect((await postCounselor(seed.counselors[1].id, seed.offerings.archery1.id, seed.users.adminUser.id)).status).toBe(201);
  });
});

describe("camper activity restrictions", () => {
  it("hides and rejects a camper with NO Horses for Horses offerings", async () => {
    const seed = await currentSeed();
    await createRule(seed.campers[0].id, seed.activities.horses.id, "Horses", "NO Horses");

    const search = await request(app).get(`/api/campers/search?offeringId=${seed.offerings.horses1.id}`);
    expect(search.body.map((camper: { id: number }) => camper.id)).not.toContain(seed.campers[0].id);

    const response = await postCamper(seed.campers[0].id, seed.offerings.horses1.id, seed.users.counselorUser.id);
    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Camper is excluded from this activity.");
  });

  it("excludes NO Canoes from Canoes but keeps the camper available elsewhere", async () => {
    const seed = await currentSeed();
    await createRule(seed.campers[1].id, seed.activities.canoes.id, "Canoes", "NO Canoes");

    const canoesSearch = await request(app).get(`/api/campers/search?offeringId=${seed.offerings.canoes1.id}`);
    expect(canoesSearch.body.map((camper: { id: number }) => camper.id)).not.toContain(seed.campers[1].id);

    const archerySearch = await request(app).get(`/api/campers/search?offeringId=${seed.offerings.archery1.id}`);
    expect(archerySearch.body.map((camper: { id: number }) => camper.id)).toContain(seed.campers[1].id);
  });

  it("excludes NO ROPES from High Ropes offerings", async () => {
    const seed = await currentSeed();
    await createRule(seed.campers[2].id, seed.activities.highRopes.id, "High Ropes", "NO ROPES");

    const search = await request(app).get(`/api/campers/search?offeringId=${seed.offerings.highRopes1.id}`);
    expect(search.body.map((camper: { id: number }) => camper.id)).not.toContain(seed.campers[2].id);
  });

  it("treats needs waivers as requires_review and rejects counselor assignment", async () => {
    const seed = await currentSeed();
    await createRule(seed.campers[3].id, seed.activities.horses.id, "Horses", "needs waivers");

    const search = await request(app).get(`/api/campers/search?offeringId=${seed.offerings.horses1.id}`);
    expect(search.body.map((camper: { id: number }) => camper.id)).not.toContain(seed.campers[3].id);

    const response = await postCamper(seed.campers[3].id, seed.offerings.horses1.id, seed.users.counselorUser.id);
    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Camper requires review before assignment to this activity.");
  });

  it("preserves raw imported values and keeps ambiguous imported values", async () => {
    const seed = await currentSeed();
    const ambiguous = await createRule(seed.campers[4].id, seed.activities.horses.id, "Horses", "check with Hugh");
    const noHorses = await createRule(seed.campers[5].id, seed.activities.horses.id, "Horses", "NO HORSES");

    expect(ambiguous.ruleType).toBe("note");
    expect(ambiguous.rawValue).toBe("check with Hugh");
    expect(noHorses.rawValue).toBe("NO HORSES");
  });
});

describe("schedule-first API", () => {
  it("lists dates and schedule blocks grouped by selected date", async () => {
    const dates = await request(app).get("/api/schedule/dates");
    expect(dates.status).toBe(200);
    expect(dates.body).toEqual(["2026-06-15"]);

    const blocks = await request(app).get("/api/schedule/dates/2026-06-15/time-slots");
    expect(blocks.status).toBe(200);
    expect(blocks.body.map((block: { label: string; offeringCount: number }) => [block.label, block.offeringCount])).toEqual([
      ["Activity 1", 5],
      ["Activity 2", 2]
    ]);
  });

  it("returns offerings for a selected timeSlotId and camper search remains scoped to the offering time block", async () => {
    const seed = await currentSeed();
    await postCamper(seed.campers[0].id, seed.offerings.archery1.id, seed.users.counselorUser.id);

    const offerings = await request(app).get(`/api/offerings?timeSlotId=${seed.offerings.archery1.timeSlotId}`);
    expect(offerings.status).toBe(200);
    expect(offerings.body.map((offering: { id: number }) => offering.id)).toContain(seed.offerings.archery1.id);

    const search = await request(app).get(`/api/campers/search?offeringId=${seed.offerings.fishing1.id}`);
    expect(search.status).toBe(200);
    expect(search.body.map((camper: { id: number }) => camper.id)).not.toContain(seed.campers[0].id);
  });
});

describe("canonical CSV validation and loading", () => {
  it("loads valid canonical CSVs successfully", async () => {
    const dir = makeCsvDir();
    writeValidCsvs(dir);

    const result = loadAndValidateCanonicalCsvs(dir);
    expect(result.errors).toEqual([]);
    expect(result.data).toBeDefined();
    await replaceSetupDataFromCanonicalCsvs(prisma, result.data!);

    expect(await prisma.camper.count()).toBe(3);
    expect(await prisma.activityOffering.count()).toBe(2);
    expect(await prisma.camperActivityRule.count()).toBe(1);
  });

  it("fails when a required file is missing", () => {
    const dir = makeCsvDir();
    writeValidCsvs(dir);
    rmSync(join(dir, "users.csv"));

    const result = loadAndValidateCanonicalCsvs(dir);
    expect(result.errors.some((error) => error.file === "users.csv" && error.message.includes("missing"))).toBe(true);
  });

  it("allows camper_activity_rules.csv to be omitted", () => {
    const dir = makeCsvDir();
    writeValidCsvs(dir);
    rmSync(join(dir, "camper_activity_rules.csv"));

    const result = loadAndValidateCanonicalCsvs(dir);
    expect(result.errors).toEqual([]);
    expect(result.data?.rules).toEqual([]);
  });

  it("fails when a required column is missing", () => {
    const dir = makeCsvDir();
    writeValidCsvs(dir);
    writeFileSync(join(dir, "campers.csv"), "camperId,name\ncamper_001,Alex\n");

    const result = loadAndValidateCanonicalCsvs(dir);
    expect(result.errors[0].message).toContain("Header must be exactly");
  });

  it("fails on duplicate IDs", () => {
    const dir = makeCsvDir();
    writeValidCsvs(dir);
    writeFileSync(join(dir, "campers.csv"), "camperId,name,active\ncamper_001,Alex,true\ncamper_001,Jordan,true\n");

    const result = loadAndValidateCanonicalCsvs(dir);
    expect(result.errors.some((error) => error.message.includes("duplicated"))).toBe(true);
  });

  it("fails on unknown foreign keys in activity_offerings.csv", () => {
    const dir = makeCsvDir();
    writeValidCsvs(dir);
    writeFileSync(join(dir, "activity_offerings.csv"), "offeringId,timeSlotId,activityId,camperCapacity,counselorCapacity,location,notes\noffer_001,slot_missing,activity_archery,2,1,Range,\n");

    const result = loadAndValidateCanonicalCsvs(dir);
    expect(result.errors.some((error) => error.message.includes("slot_missing"))).toBe(true);
  });

  it("fails on invalid boolean", () => {
    const dir = makeCsvDir();
    writeValidCsvs(dir);
    writeFileSync(join(dir, "campers.csv"), "camperId,name,active\ncamper_001,Alex,yes\n");

    const result = loadAndValidateCanonicalCsvs(dir);
    expect(result.errors.some((error) => error.message.includes("active must be true or false"))).toBe(true);
  });

  it("fails on invalid capacity", () => {
    const dir = makeCsvDir();
    writeValidCsvs(dir);
    writeFileSync(join(dir, "activities.csv"), "activityId,name,defaultCamperCapacity,defaultCounselorCapacity,active,activityFamily\nactivity_archery,Archery,-1,1,true,Archery\n");

    const result = loadAndValidateCanonicalCsvs(dir);
    expect(result.errors.some((error) => error.message.includes("defaultCamperCapacity must be at least 0"))).toBe(true);
  });

  it("fails on invalid date and time format", () => {
    const dir = makeCsvDir();
    writeValidCsvs(dir);
    writeFileSync(join(dir, "schedule_blocks.csv"), "timeSlotId,date,label,startTime,endTime,sortOrder,displayTitle,description\nslot_001,06/15/2026,Activity 1,9:00,25:00,1,Activity 1,\n");

    const result = loadAndValidateCanonicalCsvs(dir);
    expect(result.errors.some((error) => error.message.includes("date must use YYYY-MM-DD"))).toBe(true);
    expect(result.errors.some((error) => error.message.includes("startTime must use HH:mm"))).toBe(true);
    expect(result.errors.some((error) => error.message.includes("endTime must use HH:mm"))).toBe(true);
  });

  it("fails on invalid role", () => {
    const dir = makeCsvDir();
    writeValidCsvs(dir);
    writeFileSync(join(dir, "users.csv"), "userId,name,role\nuser_001,Avery,owner\n");

    const result = loadAndValidateCanonicalCsvs(dir);
    expect(result.errors.some((error) => error.message.includes("role must be counselor or admin"))).toBe(true);
  });

  it("fails on invalid camper activity rule type", () => {
    const dir = makeCsvDir();
    writeValidCsvs(dir);
    writeFileSync(join(dir, "camper_activity_rules.csv"), "ruleId,camperId,activityFamily,ruleType,rawValue,notes\nrule_001,camper_001,Archery,blocked,NO,\n");

    const result = loadAndValidateCanonicalCsvs(dir);
    expect(result.errors.some((error) => error.message.includes("ruleType must be one of"))).toBe(true);
  });

  it("does not modify the database when validation fails", async () => {
    await reset();
    await prisma.camper.create({ data: { externalId: "sentinel", name: "Sentinel Camper", active: true } });
    const dir = makeCsvDir();
    writeValidCsvs(dir);
    rmSync(join(dir, "activities.csv"));

    const result = loadAndValidateCanonicalCsvs(dir);
    expect(result.data).toBeUndefined();
    expect(await prisma.camper.findMany()).toHaveLength(1);
    expect((await prisma.camper.findFirstOrThrow()).name).toBe("Sentinel Camper");
  });
});

async function createRule(camperId: number, activityId: number, activityNameRaw: string, rawValue: string) {
  return prisma.camperActivityRule.create({
    data: {
      externalId: `test_rule_${camperId}_${activityId}_${rawValue.toLowerCase().replaceAll(" ", "_")}`,
      camperId,
      activityId,
      activityNameRaw,
      activityFamily: activityNameRaw,
      ruleType: classifyChecklistValue(rawValue),
      rawValue,
      notes: "",
      sourceFile: "test-checklist.csv",
      sourceRow: 10
    }
  });
}

function makeCsvDir() {
  const dir = join(tmpdir(), `camp-csv-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function writeValidCsvs(dir: string) {
  writeFileSync(join(dir, "campers.csv"), "camperId,name,active\ncamper_001,Alex,true\ncamper_002,Jordan,true\ncamper_003,Sam,true\n");
  writeFileSync(join(dir, "counselors.csv"), "counselorId,name,active\ncounselor_001,Avery,true\n");
  writeFileSync(join(dir, "users.csv"), "userId,name,role\nuser_001,Avery,counselor\nuser_002,Morgan,admin\n");
  writeFileSync(
    join(dir, "activities.csv"),
    "activityId,name,defaultCamperCapacity,defaultCounselorCapacity,active,activityFamily\nactivity_archery,Archery,2,1,true,Archery\nactivity_horses,Horses,2,1,true,Horses\n"
  );
  writeFileSync(
    join(dir, "schedule_blocks.csv"),
    "timeSlotId,date,label,startTime,endTime,sortOrder,displayTitle,description\nslot_001,2026-06-15,Activity 1,09:00,10:00,1,Activity 1,Morning\n"
  );
  writeFileSync(
    join(dir, "activity_offerings.csv"),
    "offeringId,timeSlotId,activityId,camperCapacity,counselorCapacity,location,notes\noffer_001,slot_001,activity_archery,2,1,Range,\noffer_002,slot_001,activity_horses,2,1,Stables,\n"
  );
  writeFileSync(join(dir, "camper_activity_rules.csv"), "ruleId,camperId,activityFamily,ruleType,rawValue,notes\nrule_001,camper_001,Horses,exclude,NO Horses,\n");
}
