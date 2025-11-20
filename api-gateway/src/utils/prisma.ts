import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import dotenv from "dotenv";
import path from "path";

// Load environment variables from project root
const envPath = path.resolve(__dirname, "../../../.env");
dotenv.config({ path: envPath });

// Create PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Create Prisma adapter for PostgreSQL
const adapter = new PrismaPg(pool);

// Initialize PrismaClient with adapter (required in Prisma 7)
export const prisma = new PrismaClient({ adapter });
