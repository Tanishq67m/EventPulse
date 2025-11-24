import { Request, Response } from "express";
import { prisma } from "../utils/prisma";

export const listDLQ = async (_req: Request, res: Response) => {
  const rows = await prisma.dLQEntry.findMany({ orderBy: { createdAt: "desc" } });
  res.json({ ok: true, dlq: rows });
};
