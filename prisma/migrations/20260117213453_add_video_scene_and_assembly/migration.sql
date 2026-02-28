-- AlterTable
ALTER TABLE "Video" ADD COLUMN     "assembledThumbnailUrl" TEXT,
ADD COLUMN     "assembledVideoUrl" TEXT,
ADD COLUMN     "assemblyErrorMessage" TEXT,
ADD COLUMN     "assemblyJobId" TEXT,
ADD COLUMN     "assemblyStatus" TEXT NOT NULL DEFAULT 'pending';

-- CreateTable
CREATE TABLE "VideoScene" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "sceneIndex" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "prompt" TEXT,
    "duration" INTEGER NOT NULL,
    "runwayJobId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "runwayVideoUrl" TEXT,
    "s3InputUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VideoScene_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VideoScene_videoId_idx" ON "VideoScene"("videoId");

-- CreateIndex
CREATE INDEX "VideoScene_runwayJobId_idx" ON "VideoScene"("runwayJobId");

-- CreateIndex
CREATE INDEX "VideoScene_status_idx" ON "VideoScene"("status");

-- CreateIndex
CREATE UNIQUE INDEX "VideoScene_videoId_sceneIndex_key" ON "VideoScene"("videoId", "sceneIndex");

-- AddForeignKey
ALTER TABLE "VideoScene" ADD CONSTRAINT "VideoScene_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;
