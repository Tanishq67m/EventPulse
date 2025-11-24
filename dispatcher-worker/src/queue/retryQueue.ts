// dispatcher-worker/src/queue/retryQueue.ts
import { Queue } from "bullmq";
import IORedis from "ioredis";

const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

export const RETRY_QUEUE_NAME = "delivery-retries";

export const retryQueue = new Queue(RETRY_QUEUE_NAME, { connection });

// Helper to add a retry job with exponential backoff metadata
export async function enqueueRetryJob(eventId: number, attempt = 1, maxAttempts = 5) {
  // The job data
  const data = { eventId, attempt, maxAttempts };

  // Backoff strategy via delay (ms) — exponential
  const delay = computeBackoffMs(attempt);

  await retryQueue.add(String(eventId) + ":" + Date.now(), data, {
    attempts: 1, // we manage attempts in data
    delay,
    removeOnComplete: true,
    removeOnFail: false,
    // store attempts in job data so we can inspect
  });
}

function computeBackoffMs(attempt: number) {
  // simple exponential: 10s, 30s, 2m, 10m, 30m...
  const schedule = [10000, 30000, 120000, 600000, 1800000];
  return schedule[Math.min(attempt - 1, schedule.length - 1)];
}
