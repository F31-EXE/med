-- CreateEnum
CREATE TYPE "EventDocumentSection" AS ENUM ('MAIN', 'RESULTS');

-- DropIndex
DROP INDEX "Document_eventId_eventSortOrder_idx";

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "eventSection" "EventDocumentSection" NOT NULL DEFAULT 'MAIN';

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "coverThumbUrl" TEXT,
ADD COLUMN     "coverUrl" TEXT,
ADD COLUMN     "resultsFacts" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "resultsLinks" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "resultsText" TEXT;

-- CreateTable
CREATE TABLE "EventImage" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "thumbUrl" TEXT NOT NULL,
    "caption" TEXT,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "EventImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventImage_eventId_idx" ON "EventImage"("eventId");

-- CreateIndex
CREATE INDEX "Document_eventId_eventSection_eventSortOrder_idx" ON "Document"("eventId", "eventSection", "eventSortOrder");

-- AddForeignKey
ALTER TABLE "EventImage" ADD CONSTRAINT "EventImage_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
