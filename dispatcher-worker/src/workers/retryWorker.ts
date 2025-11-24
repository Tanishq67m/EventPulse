// dispatcher-worker/src/workers/retryWorker.ts
import { Worker } from "bullmq";
import IORedis from "ioredis";
import axios from "axios";
import { signPayload } from "../utils/hmac";
import { prisma } from "../utils/prisma"; // your local prisma in dispatcher-worker/src/utils/prisma
import { RETRY_QUEUE_NAME } from "../queue/retryQueue";

const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

export function startRetryWorker() {
  // ensure we have a worker picking up jobs
  const worker = new Worker(
    RETRY_QUEUE_NAME,
    async job => {
      const { eventId, attempt, maxAttempts } = job.data as {
        eventId: number;
        attempt: number;
        maxAttempts: number;
      };

      console.log(`[RetryWorker] processing event ${eventId}, attempt ${attempt}`);

      // fetch event + webhook
      const event = await prisma.event.findUnique({
        where: { id: eventId },
        include: { webhook: true },
      });

      if (!event || !event.webhook) {
        console.warn(`[RetryWorker] missing event or webhook ${eventId}`);
        // There's nothing to retry: mark as dead (create DLQ entry)
        await prisma.dLQEntry.create({
          data: {
            eventId,
            reason: `missing event/webhook on retry attempt ${attempt}`,
          },
        });
        return;
      }

      // attempt delivery
      try {
        const signature = signPayload(event.webhook.secret, event);

        const res = await axios.post(event.webhook.url, event, {
          headers: {
            "X-EventPulse-Signature": signature,
            "Content-Type": "application/json",
          },
          timeout: 10000, // increased timeout for retries
        });

        // success
        await prisma.deliveryAttempt.create({
          data: {
            eventId: event.id,
            status: "success",
            responseCode: res.status,
            responseBody: JSON.stringify(res.data),
          },
        });

        console.log(`[RetryWorker] delivered event ${eventId} successfully.`);
      } catch (err: any) {
        // failed attempt
        const errMsg = err?.response?.data ? JSON.stringify(err.response.data) : err.message;
        await prisma.deliveryAttempt.create({
          data: {
            eventId: event.id,
            status: "failed",
            responseBody: errMsg,
            responseCode: err?.response?.status ?? null,
          },
        });

        console.warn(`[RetryWorker] delivery failed for event ${eventId}, attempt ${attempt}: ${err.message}`);

        if (attempt >= maxAttempts) {
          // move to DLQ
          await prisma.dLQEntry.create({
            data: {
              eventId,
              reason: `exceeded attempts (${attempt})`,
            },
          });
          console.warn(`[RetryWorker] moved event ${eventId} to DLQ after ${attempt} attempts`);
          return;
        }

        // enqueue next retry job
        const { enqueueRetryJob } = await import("../queue/retryQueue");
        await enqueueRetryJob(eventId, attempt + 1, maxAttempts);
      }
    },
    { connection }
  );

  worker.on("completed", job => {
    // noop
  });

  worker.on("failed", (job, err) => {
    console.error("[RetryWorker] job failed:", job?.id, err);
  });

  console.log("[RetryWorker] started");
}
