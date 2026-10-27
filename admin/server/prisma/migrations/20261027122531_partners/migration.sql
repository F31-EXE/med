-- CreateEnum
CREATE TYPE "PartnerLevel" AS ENUM ('GENERAL', 'OFFICIAL', 'INFO');

-- CreateTable
CREATE TABLE "Partner" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT,
    "description" TEXT,
    "logoUrl" TEXT,
    "logoThumbUrl" TEXT,
    "showOnHome" BOOLEAN NOT NULL DEFAULT false,
    "homeSortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Partner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventPartner" (
    "eventId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "level" "PartnerLevel" NOT NULL,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "EventPartner_pkey" PRIMARY KEY ("eventId","partnerId")
);

-- CreateIndex
CREATE INDEX "Partner_name_idx" ON "Partner"("name");

-- AddForeignKey
ALTER TABLE "EventPartner" ADD CONSTRAINT "EventPartner_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventPartner" ADD CONSTRAINT "EventPartner_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
