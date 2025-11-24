import { Request, Response } from "express";
import { prisma } from "../utils/prisma";

export const listEvents = async (req: Request, res: Response) => {
  const events = await prisma.event.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  res.json({ ok: true, events });
};

export const getEventAttempts = async (req: Request, res: Response) => {
  const eventId = Number(req.params.id);
  const attempts = await prisma.deliveryAttempt.findMany({
    where: { eventId },
    orderBy: { createdAt: "desc" },
  });
  res.json({ ok: true, attempts });
};
