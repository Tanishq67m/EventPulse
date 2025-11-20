

import { z } from "zod";

export const sendEventSchema = z.object({
  type: z.string().min(1, "Event type is required"),
  payload: z.record(z.string(), z.any()), // payload can be any JSON object
  webhookId: z.number().optional(),
});

export type SendEventInput = z.infer<typeof sendEventSchema>;
