/*
  Warnings:

  - You are about to drop the column `assembledThumbnailUrl` on the `Video` table. All the data in the column will be lost.
  - You are about to drop the column `assembledVideoUrl` on the `Video` table. All the data in the column will be lost.
  - You are about to drop the column `assemblyErrorMessage` on the `Video` table. All the data in the column will be lost.
  - You are about to drop the column `assemblyJobId` on the `Video` table. All the data in the column will be lost.
  - You are about to drop the column `assemblyStatus` on the `Video` table. All the data in the column will be lost.
  - You are about to drop the column `duration` on the `Video` table. All the data in the column will be lost.
  - You are about to drop the column `hasNarration` on the `Video` table. All the data in the column will be lost.
  - You are about to drop the column `narrationUrl` on the `Video` table. All the data in the column will be lost.
  - You are about to drop the column `scenePrompt` on the `Video` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `Video` table. All the data in the column will be lost.
  - You are about to drop the column `videoUrl` on the `Video` table. All the data in the column will be lost.
  - You are about to drop the column `prompt` on the `VideoScene` table. All the data in the column will be lost.
  - You are about to drop the column `s3InputUrl` on the `VideoScene` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Video_status_idx";

-- DropIndex
DROP INDEX "VideoScene_runwayJobId_idx";

-- DropIndex
DROP INDEX "VideoScene_videoId_idx";

-- AlterTable
ALTER TABLE "Video" DROP COLUMN "assembledThumbnailUrl",
DROP COLUMN "assembledVideoUrl",
DROP COLUMN "assemblyErrorMessage",
DROP COLUMN "assemblyJobId",
DROP COLUMN "assemblyStatus",
DROP COLUMN "duration",
DROP COLUMN "hasNarration",
DROP COLUMN "narrationUrl",
DROP COLUMN "scenePrompt",
DROP COLUMN "status",
DROP COLUMN "videoUrl",
ADD COLUMN     "blueprint" JSONB,
ADD COLUMN     "errorLayer" INTEGER,
ADD COLUMN     "finalVideoUrl" TEXT,
ADD COLUMN     "perspective" JSONB,
ADD COLUMN     "pipelineStatus" TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN     "totalDuration" INTEGER,
ADD COLUMN     "understanding" JSONB;

-- AlterTable
ALTER TABLE "VideoScene" DROP COLUMN "prompt",
DROP COLUMN "s3InputUrl",
ADD COLUMN     "runwayPrompt" TEXT,
ADD COLUMN     "setting" TEXT,
ADD COLUMN     "symbolism" TEXT,
ADD COLUMN     "timeOfDay" TEXT,
ALTER COLUMN "description" DROP NOT NULL,
ALTER COLUMN "duration" SET DEFAULT 15,
ALTER COLUMN "runwayJobId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "NarrationSegment" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "segmentType" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "audioUrl" TEXT,
    "duration" DOUBLE PRECISION,
    "startTime" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NarrationSegment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NarrationSegment_videoId_segmentType_key" ON "NarrationSegment"("videoId", "segmentType");

-- CreateIndex
CREATE INDEX "Video_pipelineStatus_idx" ON "Video"("pipelineStatus");

-- AddForeignKey
ALTER TABLE "NarrationSegment" ADD CONSTRAINT "NarrationSegment_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;
