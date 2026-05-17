import { PrismaClient } from "@prisma/client";
import { classifyChecklistValue } from "../server/src/services/rules";

const prisma = new PrismaClient();

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

async function main() {
  await reset();

  const campers = await Promise.all(
    [
      ["Ava Martin", true],
      ["Ben Carter", true],
      ["Chloe Nguyen", true],
      ["Diego Rivera", true],
      ["Ella Thompson", true],
      ["Finn Brooks", true],
      ["Grace Patel", true],
      ["Henry Wilson", true],
      ["Inactive Camper", false]
    ].map(([name, active], index) =>
      prisma.camper.create({
        data: { externalId: `demo_camper_${String(index + 1).padStart(3, "0")}`, name: String(name), active: Boolean(active) }
      })
    )
  );

  const counselors = await Promise.all(
    ["Maya Johnson", "Owen Smith", "Priya Shah", "Liam Anderson", "Sofia Lee"].map((name, index) =>
      prisma.counselor.create({ data: { externalId: `demo_counselor_${String(index + 1).padStart(3, "0")}`, name, active: true } })
    )
  );

  const [, adminUser] = await Promise.all([
    prisma.user.create({ data: { externalId: "demo_user_counselor", name: "Counselor Demo", role: "counselor" } }),
    prisma.user.create({ data: { externalId: "demo_user_admin", name: "Admin Demo", role: "admin" } })
  ]);

  const activities = await Promise.all(
    [
      ["demo_activity_archery", "Archery", 3, 1, "Archery"],
      ["demo_activity_fishing", "Fishing", 3, 1, "Fishing"],
      ["demo_activity_horses", "Horses", 2, 2, "Horses"],
      ["demo_activity_canoes", "Canoes", 2, 1, "Canoes"],
      ["demo_activity_high_ropes", "High Ropes", 2, 2, "High Ropes"],
      ["demo_activity_nature_art", "Nature Art", 4, 1, "Nature Art"]
    ].map(([externalId, name, camperCapacity, counselorCapacity, activityFamily]) =>
      prisma.activity.create({
        data: {
          externalId: String(externalId),
          name: String(name),
          capacity: Number(camperCapacity),
          defaultCamperCapacity: Number(camperCapacity),
          defaultCounselorCapacity: Number(counselorCapacity),
          activityFamily: String(activityFamily),
          active: true
        }
      })
    )
  );

  const [archery, fishing, horses, canoes, highRopes, natureArt] = activities;

  const mondayMorning = await prisma.timeSlot.create({
    data: {
      date: new Date("2026-06-15T00:00:00.000Z"),
      externalId: "demo_slot_2026_06_15_a1",
      label: "Activity 1",
      startTime: "09:00",
      endTime: "10:15",
      sortOrder: 1,
      displayTitle: "Monday Activity 1",
      description: "Morning activity block"
    }
  });

  const mondayMidday = await prisma.timeSlot.create({
    data: {
      date: new Date("2026-06-15T00:00:00.000Z"),
      externalId: "demo_slot_2026_06_15_a2",
      label: "Activity 2",
      startTime: "10:30",
      endTime: "11:45",
      sortOrder: 2,
      displayTitle: "Monday Activity 2",
      description: "Late morning activity block"
    }
  });

  const offeringSeed = [
    ["demo_offer_001", archery.id, mondayMorning.id, 2, 1, "Archery Range"],
    ["demo_offer_002", fishing.id, mondayMorning.id, 2, 1, "Dock"],
    ["demo_offer_003", horses.id, mondayMorning.id, 2, 2, "Stables"],
    ["demo_offer_004", canoes.id, mondayMorning.id, 2, 1, "Lake"],
    ["demo_offer_005", highRopes.id, mondayMorning.id, 2, 2, "Ropes Course"],
    ["demo_offer_006", natureArt.id, mondayMorning.id, 4, 1, "Craft Cabin"],
    ["demo_offer_007", archery.id, mondayMidday.id, 3, 1, "Archery Range"],
    ["demo_offer_008", fishing.id, mondayMidday.id, 3, 1, "Dock"],
    ["demo_offer_009", horses.id, mondayMidday.id, 2, 2, "Stables"],
    ["demo_offer_010", canoes.id, mondayMidday.id, 2, 1, "Lake"],
    ["demo_offer_011", highRopes.id, mondayMidday.id, 2, 2, "Ropes Course"],
    ["demo_offer_012", natureArt.id, mondayMidday.id, 4, 1, "Craft Cabin"]
  ];

  const offerings = await Promise.all(
    offeringSeed.map(([externalId, activityId, timeSlotId, camperCapacity, counselorCapacity, location]) =>
      prisma.activityOffering.create({
        data: {
          externalId: String(externalId),
          activityId: Number(activityId),
          timeSlotId: Number(timeSlotId),
          camperCapacity: Number(camperCapacity),
          counselorCapacity: Number(counselorCapacity),
          location: String(location),
          notes: ""
        }
      })
    )
  );

  const checklistRows = [
    { externalId: "demo_rule_001", camper: campers[0], activity: horses, column: "Horses", value: "NO Horses", row: 2 },
    { externalId: "demo_rule_002", camper: campers[1], activity: canoes, column: "Canoes", value: "NO Canoes", row: 3 },
    { externalId: "demo_rule_003", camper: campers[2], activity: highRopes, column: "High Ropes", value: "NO ROPES", row: 4 },
    { externalId: "demo_rule_004", camper: campers[3], activity: horses, column: "Horses", value: "needs waivers", row: 5 },
    { externalId: "demo_rule_005", camper: campers[4], activity: canoes, column: "Canoes", value: "Wednesday", row: 6 },
    { externalId: "demo_rule_006", camper: campers[5], activity: highRopes, column: "High Ropes", value: "DO NOT Discuss, Hugh will make decision in AM", row: 7 },
    { externalId: "demo_rule_007", camper: campers[6], activity: horses, column: "Horses", value: "176lb - Wed", row: 8 },
    { externalId: "demo_rule_008", camper: campers[7], activity: natureArt, column: "Nature Art", value: "check with cabin leader", row: 9 }
  ];

  await Promise.all(
    checklistRows.map((row) =>
      prisma.camperActivityRule.create({
        data: {
          externalId: row.externalId,
          camperId: row.camper.id,
          activityId: row.activity.id,
          activityNameRaw: row.column,
          activityFamily: row.activity.activityFamily,
          ruleType: classifyChecklistValue(row.value),
          rawValue: row.value,
          notes: "",
          sourceFile: "Camper Checklist 2025.xlsx",
          sourceRow: row.row
        }
      })
    )
  );

  await Promise.all(
    counselors.slice(0, 1).map((counselor) =>
      prisma.counselorAssignment.create({
        data: {
          counselorId: counselor.id,
          offeringId: offerings[0].id,
          timeSlotId: mondayMorning.id,
          createdByUserId: adminUser.id
        }
      })
    )
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
