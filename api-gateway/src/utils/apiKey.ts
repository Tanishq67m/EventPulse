import crypto from "crypto";

export function generateApiKey() {
  // 32 bytes = 64 char hex string
  return crypto.randomBytes(32).toString("hex");
}
