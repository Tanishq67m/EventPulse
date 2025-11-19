// dispatcher-worker/src/index.ts
import dotenv from "dotenv";
dotenv.config();

console.log("Dispatcher worker starting...");

import express from "express";
import client from "prom-client";

const app = express();
client.collectDefaultMetrics();

app.get("/health", (_req, res) => res.json({ status: "ok", service: "dispatcher-worker" }));

app.get("/metrics", async (_req, res) => {
  res.setHeader("Content-Type", client.register.contentType);
  res.end(await client.register.metrics());
});

const PORT = process.env.PORT ?? 4000;
app.listen(PORT, () => console.log(`Dispatcher worker HTTP server listening on ${PORT}`));
