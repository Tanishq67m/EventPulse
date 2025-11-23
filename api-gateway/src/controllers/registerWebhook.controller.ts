import { Request, Response } from "express";
import crypto from "crypto";
import { prisma } from "../utils/prisma";
import { RegisterWebhookInput } from "../validators/registerWebhook.schema";
import { generateApiKey } from "../utils/apiKey";

export const registerWebhook = async (
  req: Request<{}, {}, RegisterWebhookInput>,
  res: Response
) => {
  const { url, name } = req.body;

  // Generate webhook secret
  const secret = crypto.randomBytes(32).toString("hex");

  // Generate API key
  const apiKey = generateApiKey();

  // Create webhook + API key
  const webhook = await prisma.webhook.create({
    data: {
      url,
      name,
      secret,
      apiKeys: {
        create: {
          key: apiKey,
          name: `${name} - API Key`,
        },
      },
    },
    include: {
      apiKeys: true,
    },
  });

  return res.json({
    ok: true,
    webhook,
    apiKey
  });
};
