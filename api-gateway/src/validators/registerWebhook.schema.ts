import { z } from "zod";

export const registerWebhookSchema = z.object({
  url: z.string().url("Invalid URL format"),
  name: z.string().min(1, "Webhook name is required"),
});

export type RegisterWebhookInput = z.infer<typeof registerWebhookSchema>;
