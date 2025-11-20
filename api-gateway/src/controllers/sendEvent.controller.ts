// api-gateway/src/controllers/sendEvent.controller.ts

import { Request, Response } from "express";
import { prisma } from "../utils/prisma";
import { sendEventSchema, SendEventInput } from "../validators/sendEvent.schema";
import { getRedisClient } from "../utils/redis";

export const sendEvent = async (
  req: Request<{}, {}, SendEventInput>,
  res: Response
) => {
  const { type, payload, webhookId } = req.body;

  // 1. Save event in DB
  const event = await prisma.event.create({
    data: {
      type,
      payload,
      webhookId: webhookId || null,
    },
  });

  // 2. Push event into Redis Stream (non-blocking)
  try {
    const redis = getRedisClient();
    
    // Ensure connection is established
    if (redis.status !== "ready") {
      await redis.connect().catch(() => {
        // Connection failed, but continue without Redis
      });
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
    // Log error but don't fail the request - event is already saved in DB
    console.error("[Redis] Failed to push event to stream:", error.message);
  }

  return res.json({ ok: true, event });
};
