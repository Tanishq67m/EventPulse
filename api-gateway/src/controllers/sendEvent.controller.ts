import { Request, Response } from "express";
import { prisma } from "../utils/prisma";
import { SendEventInput } from "../validators/sendEvent.schema";
import { getRedisClient } from "../utils/redis";

export const sendEvent = async (
  req: Request<{}, {}, SendEventInput>,
  res: Response
) => {
  const { type, payload } = req.body;

  // The webhook owner is identified by API key middleware
  const webhookId = (req as any).webhookId;

  // 1. Save event in DB
  const event = await prisma.event.create({
    data: {
      type,
      payload,
      webhookId,  // <--- The IMPORTANT LINE
    },
  });

  // 2. Push event into Redis Stream
  try {
    const redis = getRedisClient();

    if (redis.status !== "ready") {
      await redis.connect().catch(() => {});
    }

    await redis.xadd(
      "eventpulse:events",
      "*",
      "eventId",
      event.id.toString(),
      "type",
      type
    );
  } catch (error: any) {
    console.error("[Redis] Failed to push event:", error.message);
  }

  return res.json({ ok: true, event });
};
