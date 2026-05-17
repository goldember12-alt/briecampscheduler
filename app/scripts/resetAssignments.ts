import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const [camperAssignments, counselorAssignments] = await Promise.all([
    prisma.assignment.count(),
    prisma.counselorAssignment.count()
  ]);

  await prisma.$transaction([
    prisma.counselorAssignment.deleteMany(),
    prisma.assignment.deleteMany()
  ]);

  console.log(`Cleared ${camperAssignments} camper assignments and ${counselorAssignments} counselor assignments.`);
  console.log("Setup data was not changed.");
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
