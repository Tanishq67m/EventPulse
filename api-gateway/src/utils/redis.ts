
import Redis from "ioredis";

let client: Redis | null = null;
let connectionAttempted = false;

export function getRedisClient() {
  if (!client) {
    client = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        // Stop retrying after 5 attempts
        if (times > 5) {
          return null; // Stop retrying
        }
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      enableOfflineQueue: false,
      lazyConnect: true,
      showFriendlyErrorStack: false,
    });

    // Handle connection errors gracefully (only log once per connection attempt)
    client.on("error", (err) => {
      if (!connectionAttempted) {
        console.error("[Redis] Connection error:", err.message);
        console.error("[Redis] Make sure Redis is running. Start it with: docker-compose up redis -d");
        connectionAttempted = true;
      }
    });

    client.on("connect", () => {
      console.log("[Redis] Connected successfully");
      connectionAttempted = false; // Reset on successful connection
    });

    client.on("ready", () => {
      console.log("[Redis] Ready to accept commands");
    });

    client.on("close", () => {
      console.log("[Redis] Connection closed");
    });
  }
  return client;
}
