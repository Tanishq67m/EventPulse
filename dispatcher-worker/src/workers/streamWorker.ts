// dispatcher-worker/src/workers/streamWorker.ts
import Redis from "ioredis";
import { prisma } from "../utils/prisma";
import axios from "axios";
import { signPayload } from "../utils/hmac";

const STREAM = "eventpulse:events";
const GROUP = "eventpulse_group";
const CONSUMER = "worker-1";

type StreamEntry = [id: string, fields: string[]];
type StreamReadResult = [stream: string, messages: StreamEntry[]][];

export async function startWorker() {
  const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

  // Create consumer group if it doesn't exist
  try {
    await redis.xgroup("CREATE", STREAM, GROUP, "0", "MKSTREAM");
    console.log("Created consumer group:", GROUP);
  } catch (err: any) {
    if (!err.message.includes("BUSYGROUP")) {
      console.error("Failed creating consumer group:", err);
      process.exit(1);
    }
  }

  console.log("Worker ready. Listening for events...");

  while (true) {
    try {
      const entries = (await (redis as any).xreadgroup(
        "GROUP",
        GROUP,
        CONSUMER,
        "BLOCK",
        5000, // 5 seconds
        "COUNT",
        1,
        "STREAMS",
        STREAM,
        ">"
      )) as StreamReadResult | null;

      if (!entries) continue;

      for (const [stream, messages] of entries) {
        for (const [id, fields] of messages) {
          await processMessage(redis, id, fields);
        }
      }
    } catch (err) {
      console.error("Worker loop error:", err);
    }
  }
}

async function processMessage(redis: Redis, id: string, fields: string[]) {
  console.log("Received message:", id, fields);

  // Convert Redis fields array → object
  const data: Record<string, string> = {};
  for (let i = 0; i < fields.length; i += 2) {
    data[fields[i]] = fields[i + 1];
  }

  const eventId = parseInt(data.eventId);

  // Fetch full event + webhook
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { webhook: true },
  });

  if (!event || !event.webhook) {
    console.error("⚠ Missing webhook or event:", eventId);
    await redis.xack("eventpulse:events", "eventpulse_group", id);
    return;
  }

  // Generate signature
  const signature = signPayload(event.webhook.secret, event);

  // Deliver webhook
  try {
    const res = await axios.post(event.webhook.url, event, {
      headers: {
        "X-EventPulse-Signature": signature,
        "Content-Type": "application/json",
      },
      timeout: 5000,
    });

    console.log("Webhook delivered:", res.status);

    // Log success
    await prisma.deliveryAttempt.create({
      data: {
        eventId: event.id,
        status: "success",
        responseCode: res.status,
        responseBody: JSON.stringify(res.data),
      },
    });

    // Ack message
    await redis.xack("eventpulse:events", "eventpulse_group", id);
  } catch (err: any) {
    console.error("❌ Webhook delivery failed:", err.message);
  
    await prisma.deliveryAttempt.create({
      data: {
        eventId: event.id,
        status: "failed",
        responseBody: err.message,
      },
    });

    const { enqueueRetryJob } = await import("../queue/retryQueue");
    await enqueueRetryJob(event.id, 1, 5); // maxAttempts = 5
    
  }
}
