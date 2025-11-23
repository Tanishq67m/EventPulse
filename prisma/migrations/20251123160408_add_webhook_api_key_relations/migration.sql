/*
  Warnings:

  - Added the required column `webhookId` to the `APIKey` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `Webhook` table without a default value. This is not possible if the table is not empty.

*/

-- Step 1: Add `name` column to Webhook with a default value
ALTER TABLE "Webhook" ADD COLUMN "name" TEXT;

-- Step 2: Update existing Webhook rows with a default name
UPDATE "Webhook" SET "name" = 'Webhook ' || id::text WHERE "name" IS NULL;

-- Step 3: Make `name` column NOT NULL
ALTER TABLE "Webhook" ALTER COLUMN "name"
SET
NOT NULL;

-- Step 4: Add `webhookId` column to APIKey as nullable first
ALTER TABLE "APIKey" ADD COLUMN "webhookId" INTEGER;

-- Step 5: Assign existing APIKeys to the first webhook (if any exist)
-- This ensures all existing APIKeys have a webhookId before making it required
UPDATE "APIKey" 
SET "webhookId" = (SELECT id
FROM "Webhook"
ORDER BY id LIMIT 1) 
WHERE "webhookId"
IS NULL 
  AND EXISTS
(SELECT 1
FROM "Webhook" LIMIT
1);

-- Step 6: Make `webhookId` NOT NULL
-- Note: This will fail if there are APIKeys without a webhookId and no webhooks exist
ALTER TABLE "APIKey" ALTER COLUMN "webhookId"
SET
NOT NULL;

-- Step 7: Add foreign key constraint
ALTER TABLE "APIKey" ADD CONSTRAINT "APIKey_webhookId_fkey" FOREIGN KEY ("webhookId") REFERENCES "Webhook"("id")
ON DELETE RESTRICT ON
UPDATE CASCADE;
