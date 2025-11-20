// api-gateway/src/controllers/registerWebhook.controller.ts

import { Request, Response } from "express";
import crypto from "crypto";
import { prisma } from "../utils/prisma";
import { RegisterWebhookInput } from "../validators/registerWebhook.schema";

export const registerWebhook = async (
  req: Request<{}, {}, RegisterWebhookInput>,
  res: Response
) => {
  const { url, name } = req.body;

  // Auto-generate secret for signing events
  const secret = crypto.randomBytes(32).toString("hex");

  const webhook = await prisma.webhook.create({
    data: {
      url,
      secret,
    },
  });

  res.json({
    ok: true,
    webhook,
  });
};
