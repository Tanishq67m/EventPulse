// api-gateway/src/index.ts
import express from "express";
import dotenv from "dotenv";
import { json } from "body-parser";
import { prisma } from "./utils/prisma";
import { registerWebhook } from "./controllers/registerWebhook.controller";
import { sendEvent } from "./controllers/sendEvent.controller";
import { validate } from "./middleware/validate";
import { registerWebhookSchema } from "./validators/registerWebhook.schema";
import { sendEventSchema } from "./validators/sendEvent.schema";
dotenv.config();
const app = express();
app.use(json());

app.get("/health", (_req, res) => res.json({ status: "ok", service: "api-gateway" }));

// temporary placeholders
app.post("/register-webhook", validate(registerWebhookSchema), registerWebhook);
app.post("/send-event", validate(sendEventSchema), sendEvent);

app.get("/db-test", async (_req, res) => {
    try {
      const webhooks = await prisma.webhook.findMany();
      res.json({ ok: true, count: webhooks.length });
    } catch (error) {
      res.status(500).json({ ok: false, error: "Database error" });
    }
  });
  

const PORT = process.env.PORT ?? 3000;

app.listen(PORT, () => console.log(`API Gateway listening on ${PORT}`));
