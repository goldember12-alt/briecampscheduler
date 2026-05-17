import type { PrismaClient } from "@prisma/client";
import { HttpError } from "../httpError";
import { KeyedMutex } from "./mutex";
import { camperRuleDecision } from "./rules";

const camperMutex = new KeyedMutex();
const counselorMutex = new KeyedMutex();

export async function assignCamper(
  prisma: PrismaClient,
  input: { camperId: number; offeringId: number; createdByUserId: number }
) {
  const offering = await prisma.activityOffering.findUnique({
    where: { id: input.offeringId },
    include: { activity: true }
  });

  if (!offering) {
    throw new HttpError(404, "Activity offering not found.");
  }

  return camperMutex.runExclusive(`offering:${input.offeringId}:camper`, async () => {
    return prisma.$transaction(async (tx) => {
      const [camper, user] = await Promise.all([
        tx.camper.findUnique({
          where: { id: input.camperId },
          include: { rules: true }
        }),
        tx.user.findUnique({ where: { id: input.createdByUserId } })
      ]);

      if (!camper || !camper.active) {
        throw new HttpError(400, "Camper is inactive or does not exist.");
      }

      if (!user) {
        throw new HttpError(400, "User does not exist.");
      }

      const ruleDecision = camperRuleDecision(camper.rules, offering.activity);
      if (ruleDecision.blocked) {
        throw new HttpError(400, ruleDecision.message ?? "Camper cannot be assigned to this activity.");
      }

      const existing = await tx.assignment.findUnique({
        where: {
          camperId_timeSlotId: {
            camperId: input.camperId,
            timeSlotId: offering.timeSlotId
          }
        }
      });

      if (existing) {
        throw new HttpError(409, "Camper is already assigned during this time slot.");
      }

      const used = await tx.assignment.count({
        where: { offeringId: input.offeringId }
      });

      if (used >= offering.camperCapacity) {
        throw new HttpError(409, "Activity offering is full.");
      }

      try {
        return await tx.assignment.create({
          data: {
            camperId: input.camperId,
            offeringId: input.offeringId,
            timeSlotId: offering.timeSlotId,
            createdByUserId: input.createdByUserId
          },
          include: {
            camper: true,
            offering: { include: { activity: true, timeSlot: true } }
          }
        });
      } catch (error) {
        if (typeof error === "object" && error && "code" in error && error.code === "P2002") {
          throw new HttpError(409, "Camper is already assigned during this time slot.");
        }
        throw error;
      }
    });
  });
}

export async function removeCamperAssignment(prisma: PrismaClient, assignmentId: number) {
  const existing = await prisma.assignment.findUnique({ where: { id: assignmentId } });
  if (!existing) {
    throw new HttpError(404, "Assignment not found.");
  }

  return prisma.assignment.delete({ where: { id: assignmentId } });
}

export async function assignCounselor(
  prisma: PrismaClient,
  input: { counselorId: number; offeringId: number; createdByUserId: number }
) {
  const offering = await prisma.activityOffering.findUnique({
    where: { id: input.offeringId }
  });

  if (!offering) {
    throw new HttpError(404, "Activity offering not found.");
  }

  return counselorMutex.runExclusive(`offering:${input.offeringId}:counselor`, async () => {
    return prisma.$transaction(async (tx) => {
      const [counselor, user] = await Promise.all([
        tx.counselor.findUnique({ where: { id: input.counselorId } }),
        tx.user.findUnique({ where: { id: input.createdByUserId } })
      ]);

      if (!counselor || !counselor.active) {
        throw new HttpError(400, "Counselor is inactive or does not exist.");
      }

      if (!user) {
        throw new HttpError(400, "User does not exist.");
      }

      const existing = await tx.counselorAssignment.findUnique({
        where: {
          counselorId_timeSlotId: {
            counselorId: input.counselorId,
            timeSlotId: offering.timeSlotId
          }
        }
      });

      if (existing) {
        throw new HttpError(409, "Counselor is already assigned during this time slot.");
      }

      const used = await tx.counselorAssignment.count({
        where: { offeringId: input.offeringId }
      });

      if (used >= offering.counselorCapacity) {
        throw new HttpError(409, "Counselor staffing capacity is full.");
      }

      try {
        return await tx.counselorAssignment.create({
          data: {
            counselorId: input.counselorId,
            offeringId: input.offeringId,
            timeSlotId: offering.timeSlotId,
            createdByUserId: input.createdByUserId
          },
          include: {
            counselor: true,
            offering: { include: { activity: true, timeSlot: true } }
          }
        });
      } catch (error) {
        if (typeof error === "object" && error && "code" in error && error.code === "P2002") {
          throw new HttpError(409, "Counselor is already assigned during this time slot.");
        }
        throw error;
      }
    });
  });
}

export async function removeCounselorAssignment(prisma: PrismaClient, assignmentId: number) {
  const existing = await prisma.counselorAssignment.findUnique({ where: { id: assignmentId } });
  if (!existing) {
    throw new HttpError(404, "Counselor assignment not found.");
  }

  return prisma.counselorAssignment.delete({ where: { id: assignmentId } });
}
