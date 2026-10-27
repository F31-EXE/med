-- CreateEnum
CREATE TYPE "ParticipationFormat" AS ENUM ('OFFLINE', 'ONLINE', 'EXHIBITOR', 'SPEAKER');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('NEW', 'CONFIRMED', 'REJECTED');

-- CreateEnum
CREATE TYPE "RegistrationSource" AS ENUM ('SITE', 'MANUAL');

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "confirmationText" TEXT,
ADD COLUMN     "registrationFields" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "registrationFormats" "ParticipationFormat"[] DEFAULT ARRAY['OFFLINE', 'ONLINE']::"ParticipationFormat"[];

-- CreateTable
CREATE TABLE "Registration" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "middleName" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "specialtyId" TEXT,
    "specialtyName" TEXT NOT NULL,
    "workplace" TEXT,
    "position" TEXT,
    "city" TEXT NOT NULL,
    "format" "ParticipationFormat" NOT NULL,
    "snils" TEXT,
    "consentPersonalData" BOOLEAN NOT NULL,
    "consentAt" TIMESTAMP(3) NOT NULL,
    "consentMailing" BOOLEAN NOT NULL DEFAULT false,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'NEW',
    "statusChangedAt" TIMESTAMP(3),
    "statusChangedById" TEXT,
    "source" "RegistrationSource" NOT NULL DEFAULT 'SITE',
    "managerComment" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Registration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Registration_eventId_status_idx" ON "Registration"("eventId", "status");

-- CreateIndex
CREATE INDEX "Registration_createdAt_idx" ON "Registration"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Registration_eventId_email_key" ON "Registration"("eventId", "email");

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_specialtyId_fkey" FOREIGN KEY ("specialtyId") REFERENCES "Specialty"("id") ON DELETE SET NULL ON UPDATE CASCADE;
