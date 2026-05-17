import { Router } from "express";
import type { NextFunction, Request, Response } from "express";
import type { Server as SocketServer } from "socket.io";
import { prisma } from "../db";
import { HttpError, getErrorMessage } from "../httpError";
import { assignCamper, assignCounselor, removeCamperAssignment, removeCounselorAssignment } from "../services/assignments";
import { camperRuleDecision } from "../services/rules";

export function createApiRouter(io?: SocketServer) {
  const router = Router();

  router.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  router.get("/campers", async (_req, res, next) => {
    try {
      res.json(await prisma.camper.findMany({ orderBy: { name: "asc" } }));
    } catch (error) {
      next(error);
    }
  });

  router.get("/counselors", async (_req, res, next) => {
    try {
      res.json(await prisma.counselor.findMany({ orderBy: { name: "asc" } }));
    } catch (error) {
      next(error);
    }
  });

  router.get("/users", async (_req, res, next) => {
    try {
      res.json(await prisma.user.findMany({ orderBy: { id: "asc" } }));
    } catch (error) {
      next(error);
    }
  });

  router.get("/activities", async (_req, res, next) => {
    try {
      res.json(await prisma.activity.findMany({ orderBy: { name: "asc" } }));
    } catch (error) {
      next(error);
    }
  });

  router.get("/time-slots", async (_req, res, next) => {
    try {
      res.json(await prisma.timeSlot.findMany({ orderBy: [{ date: "asc" }, { sortOrder: "asc" }] }));
    } catch (error) {
      next(error);
    }
  });

  router.get("/schedule/dates", async (_req, res, next) => {
    try {
      const timeSlots = await prisma.timeSlot.findMany({
        select: { date: true },
        orderBy: { date: "asc" }
      });
      const dates = [...new Set(timeSlots.map((slot) => slot.date.toISOString().slice(0, 10)))];
      res.json(dates);
    } catch (error) {
      next(error);
    }
  });

  router.get("/schedule/dates/:date/time-slots", async (req, res, next) => {
    try {
      const date = req.params.date;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        throw new HttpError(400, "date must use YYYY-MM-DD.");
      }

      const start = new Date(`${date}T00:00:00.000Z`);
      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 1);

      const slots = await prisma.timeSlot.findMany({
        where: { date: { gte: start, lt: end } },
        include: { _count: { select: { offerings: true } } },
        orderBy: [{ sortOrder: "asc" }, { startTime: "asc" }]
      });

      res.json(
        slots.map((slot) => ({
          ...slot,
          offeringCount: slot._count.offerings
        }))
      );
    } catch (error) {
      next(error);
    }
  });

  router.get("/offerings", async (req, res, next) => {
    try {
      const timeSlotId = req.query.timeSlotId ? Number(req.query.timeSlotId) : undefined;
      const offerings = await prisma.activityOffering.findMany({
        where: timeSlotId ? { timeSlotId } : undefined,
        include: {
          activity: true,
          timeSlot: true,
          assignments: { include: { camper: true }, orderBy: { camper: { name: "asc" } } },
          counselorAssignments: { include: { counselor: true }, orderBy: { counselor: { name: "asc" } } }
        },
        orderBy: [{ timeSlot: { date: "asc" } }, { timeSlot: { sortOrder: "asc" } }, { activity: { name: "asc" } }]
      });

      res.json(
        offerings.map((offering) => ({
          ...offering,
          camperCapacityUsed: offering.assignments.length,
          camperCapacityRemaining: offering.camperCapacity - offering.assignments.length,
          counselorCapacityUsed: offering.counselorAssignments.length,
          counselorCapacityRemaining: offering.counselorCapacity - offering.counselorAssignments.length
        }))
      );
    } catch (error) {
      next(error);
    }
  });

  router.get("/assignments", async (_req, res, next) => {
    try {
      res.json(
        await prisma.assignment.findMany({
          include: { camper: true, offering: { include: { activity: true, timeSlot: true } } },
          orderBy: { createdAt: "asc" }
        })
      );
    } catch (error) {
      next(error);
    }
  });

  router.get("/counselor-assignments", async (_req, res, next) => {
    try {
      res.json(
        await prisma.counselorAssignment.findMany({
          include: { counselor: true, offering: { include: { activity: true, timeSlot: true } } },
          orderBy: { createdAt: "asc" }
        })
      );
    } catch (error) {
      next(error);
    }
  });

  router.get("/camper-activity-rules", async (_req, res, next) => {
    try {
      res.json(
        await prisma.camperActivityRule.findMany({
          include: { camper: true, activity: true },
          orderBy: [{ camper: { name: "asc" } }, { activityNameRaw: "asc" }]
        })
      );
    } catch (error) {
      next(error);
    }
  });

  router.get("/campers/search", async (req, res, next) => {
    try {
      const offeringId = Number(req.query.offeringId);
      const search = String(req.query.q ?? "").trim().toLowerCase();
      if (!Number.isInteger(offeringId)) {
        throw new HttpError(400, "offeringId is required.");
      }

      const offering = await prisma.activityOffering.findUnique({
        where: { id: offeringId },
        include: { activity: true }
      });
      if (!offering) {
        throw new HttpError(404, "Activity offering not found.");
      }

      const assignedInTimeSlot = await prisma.assignment.findMany({
        where: { timeSlotId: offering.timeSlotId },
        select: { camperId: true }
      });
      const assignedIds = new Set(assignedInTimeSlot.map((assignment) => assignment.camperId));

      const campers = await prisma.camper.findMany({
        where: {
          active: true,
          name: search ? { contains: search } : undefined
        },
        include: { rules: true },
        orderBy: { name: "asc" }
      });

      const eligible = campers.filter((camper) => {
        if (assignedIds.has(camper.id)) {
          return false;
        }

        return !camperRuleDecision(camper.rules, offering.activity).blocked;
      });

      res.json(eligible);
    } catch (error) {
      next(error);
    }
  });

  router.get("/counselors/search", async (req, res, next) => {
    try {
      const offeringId = Number(req.query.offeringId);
      const search = String(req.query.q ?? "").trim().toLowerCase();
      if (!Number.isInteger(offeringId)) {
        throw new HttpError(400, "offeringId is required.");
      }

      const offering = await prisma.activityOffering.findUnique({ where: { id: offeringId } });
      if (!offering) {
        throw new HttpError(404, "Activity offering not found.");
      }

      const assignedInTimeSlot = await prisma.counselorAssignment.findMany({
        where: { timeSlotId: offering.timeSlotId },
        select: { counselorId: true }
      });
      const assignedIds = new Set(assignedInTimeSlot.map((assignment) => assignment.counselorId));

      const counselors = await prisma.counselor.findMany({
        where: { active: true, name: search ? { contains: search } : undefined },
        orderBy: { name: "asc" }
      });

      res.json(counselors.filter((counselor) => !assignedIds.has(counselor.id)));
    } catch (error) {
      next(error);
    }
  });

  router.post("/assignments", async (req, res, next) => {
    try {
      const assignment = await assignCamper(prisma, {
        camperId: Number(req.body.camperId),
        offeringId: Number(req.body.offeringId),
        createdByUserId: Number(req.body.createdByUserId)
      });

      io?.emit("assignments:changed", { timeSlotId: assignment.timeSlotId });
      res.status(201).json(assignment);
    } catch (error) {
      next(error);
    }
  });

  router.delete("/assignments/:id", async (req, res, next) => {
    try {
      const assignment = await removeCamperAssignment(prisma, Number(req.params.id));
      io?.emit("assignments:changed", { timeSlotId: assignment.timeSlotId });
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  router.post("/counselor-assignments", async (req, res, next) => {
    try {
      const assignment = await assignCounselor(prisma, {
        counselorId: Number(req.body.counselorId),
        offeringId: Number(req.body.offeringId),
        createdByUserId: Number(req.body.createdByUserId)
      });

      res.status(201).json(assignment);
    } catch (error) {
      next(error);
    }
  });

  router.delete("/counselor-assignments/:id", async (req, res, next) => {
    try {
      await removeCounselorAssignment(prisma, Number(req.params.id));
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  router.get("/export/schedule.csv", async (_req, res, next) => {
    try {
      const offerings = await prisma.activityOffering.findMany({
        include: {
          activity: true,
          timeSlot: true,
          assignments: { include: { camper: true }, orderBy: { camper: { name: "asc" } } },
          counselorAssignments: { include: { counselor: true }, orderBy: { counselor: { name: "asc" } } }
        },
        orderBy: [{ timeSlot: { date: "asc" } }, { timeSlot: { sortOrder: "asc" } }, { activity: { name: "asc" } }]
      });

      const rows = [
        [
          "date",
          "timeSlotLabel",
          "startTime",
          "endTime",
          "activityName",
          "camperCapacity",
          "camperCapacityUsed",
          "counselorCapacity",
          "counselorCapacityUsed",
          "camperName",
          "counselorNames"
        ]
      ];

      for (const offering of offerings) {
        const counselorNames = offering.counselorAssignments.map((assignment) => assignment.counselor.name).join("; ");
        const base = [
          offering.timeSlot.date.toISOString().slice(0, 10),
          offering.timeSlot.label,
          offering.timeSlot.startTime,
          offering.timeSlot.endTime,
          offering.activity.name,
          String(offering.camperCapacity),
          String(offering.assignments.length),
          String(offering.counselorCapacity),
          String(offering.counselorAssignments.length)
        ];

        if (offering.assignments.length === 0) {
          rows.push([...base, "", counselorNames]);
        } else {
          for (const assignment of offering.assignments) {
            rows.push([...base, assignment.camper.name, counselorNames]);
          }
        }
      }

      res.header("Content-Type", "text/csv");
      res.header("Content-Disposition", "attachment; filename=\"camp-schedule.csv\"");
      res.send(rows.map((row) => row.map(csvCell).join(",")).join("\n"));
    } catch (error) {
      next(error);
    }
  });

  router.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof HttpError) {
      res.status(error.status).json({ error: error.message });
      return;
    }

    res.status(500).json({ error: getErrorMessage(error) });
  });

  return router;
}

function csvCell(value: string) {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}
