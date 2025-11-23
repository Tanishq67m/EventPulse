// api-gateway/src/index.ts

import express from "express";
import dotenv from "dotenv";
import { json } from "body-parser";
import { prisma } from "./utils/prisma";

// Controllers
import { registerWebhook } from "./controllers/registerWebhook.controller";
import { sendEvent } from "./controllers/sendEvent.controller";

// Validators
import { validate } from "./middleware/validate";
import { registerWebhookSchema } from "./validators/registerWebhook.schema";
import { sendEventSchema } from "./validators/sendEvent.schema";

// API Key Auth Middleware
import { apiKeyAuth } from "./middleware/apiKeyAuth";

dotenv.config();

const app = express();
app.use(json());

//-----------------------------
// Health Check
//-----------------------------
app.get("/health", (_req, res) => 
  res.json({ status: "ok", service: "api-gateway" })
);

//-----------------------------
// Public Routes
//-----------------------------
app.post(
  "/register-webhook",
  validate(registerWebhookSchema),
  registerWebhook
);

//-----------------------------
// PROTECTED ROUTES
// Require API Key
//-----------------------------
app.post(
  "/send-event",
  apiKeyAuth,                     // <-- API key validation added here
  validate(sendEventSchema),
  sendEvent
);

//-----------------------------
// DB Test Route (public)
//-----------------------------
app.get("/db-test", async (_req, res) => {
  try {
    const webhooks = await prisma.webhook.findMany();
    res.json({ ok: true, count: webhooks.length });
  } catch (error) {
    res.status(500).json({ ok: false, error: "Database error" });
  }
});

//-----------------------------
// Start Server
//-----------------------------
const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => console.log(`API Gateway listening on ${PORT}`));

