// api-gateway/src/controllers/retry.controller.ts
import { Request, Response } from "express";
import { prisma } from "../utils/prisma";
import IORedis from "ioredis";

export const retryDLQ = async (req: Request, res: Response) => {
  const { dlqId } = req.params;

  const dlq = await prisma.dLQEntry.findUnique({
    where: { id: Number(dlqId) },
  });

  if (!dlq) {
    return res.status(404).json({ ok: false, message: "DLQ entry not found" });
  }

  // create a retry job by pushing to Redis stream again or enqueueing to Bull
  // We'll push it to the same Redis stream so it goes through worker flow
  const redis = new IORedis(process.env.REDIS_URL || "redis://localhost:6379");

  // Re-add entry to stream
  await redis.xadd("eventpulse:events", "*", "eventId", dlq.eventId.toString(), "retryFromDlq", "true");

  // Delete DLQ entry (or keep it and add a 'retriedAt')
  await prisma.dLQEntry.delete({ where: { id: dlq.id } });

  return res.json({ ok: true, message: "Requeued DLQ event" });
};
