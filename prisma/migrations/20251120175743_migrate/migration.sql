-- CreateTable
CREATE TABLE "Webhook" (
    "id" SERIAL NOT NULL,
    "url" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Webhook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "webhookId" INTEGER,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryAttempt" (
    "id" SERIAL NOT NULL,
    "eventId" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "responseBody" TEXT,
    "responseCode" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliveryAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DLQEntry" (
    "id" SERIAL NOT NULL,
    "eventId" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DLQEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "APIKey" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "APIKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "APIKey_key_key" ON "APIKey"("key");

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_webhookId_fkey" FOREIGN KEY ("webhookId") REFERENCES "Webhook"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryAttempt" ADD CONSTRAINT "DeliveryAttempt_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
