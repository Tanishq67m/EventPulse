import { defineConfig } from "@prisma/config";
import { config } from "dotenv";
import path from "path";

// Load environment variables from project root
const envPath = path.resolve(__dirname, "../.env");
config({ path: envPath });

export default defineConfig({
  schema: "../prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL || "",
  },
});

