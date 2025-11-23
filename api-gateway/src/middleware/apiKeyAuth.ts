import { Request, Response, NextFunction } from "express";
import { prisma } from "../utils/prisma";

export const apiKeyAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const apiKey = req.header("x-api-key");

  if (!apiKey) {
    return res.status(401).json({
      ok: false,
      message: "Missing API key"
    });
  }

  // Look up API key
  const keyRecord = await prisma.aPIKey.findUnique({
    where: { key: apiKey }
  });

  if (!keyRecord) {
    return res.status(403).json({
      ok: false,
      message: "Invalid API key"
    });
  }

  // Attach authenticated webhook ID to request
  (req as any).webhookId = keyRecord.webhookId;

  next();
};
