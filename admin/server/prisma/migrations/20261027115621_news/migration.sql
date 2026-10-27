-- CreateEnum
CREATE TYPE "NewsStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateTable
CREATE TABLE "News" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "excerpt" TEXT,
    "body" TEXT,
    "coverUrl" TEXT,
    "coverThumbUrl" TEXT,
    "eventId" TEXT,
    "status" "NewsStatus" NOT NULL DEFAULT 'DRAFT',
    "publishAt" TIMESTAMP(3),
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "News_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsImage" (
    "id" TEXT NOT NULL,
    "newsId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "thumbUrl" TEXT NOT NULL,
    "caption" TEXT,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "NewsImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "News_slug_key" ON "News"("slug");

-- CreateIndex
CREATE INDEX "News_status_publishAt_idx" ON "News"("status", "publishAt");

-- CreateIndex
CREATE INDEX "News_deletedAt_idx" ON "News"("deletedAt");

-- CreateIndex
CREATE INDEX "NewsImage_newsId_idx" ON "NewsImage"("newsId");

-- AddForeignKey
ALTER TABLE "News" ADD CONSTRAINT "News_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NewsImage" ADD CONSTRAINT "NewsImage_newsId_fkey" FOREIGN KEY ("newsId") REFERENCES "News"("id") ON DELETE CASCADE ON UPDATE CASCADE;
