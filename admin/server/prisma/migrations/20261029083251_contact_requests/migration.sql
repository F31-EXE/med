-- CreateEnum
CREATE TYPE "ContactRequestStatus" AS ENUM ('NEW', 'PROCESSED');

-- CreateTable
CREATE TABLE "ContactRequest" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organization" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "comment" TEXT,
    "source" TEXT,
    "consentAt" TIMESTAMP(3) NOT NULL,
    "status" "ContactRequestStatus" NOT NULL DEFAULT 'NEW',
    "managerComment" TEXT,
    "processedAt" TIMESTAMP(3),
    "processedById" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContactRequest_status_createdAt_idx" ON "ContactRequest"("status", "createdAt");
