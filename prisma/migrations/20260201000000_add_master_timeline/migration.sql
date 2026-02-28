-- CreateTable
CREATE TABLE "MasterTimeline" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "totalDurationSec" INTEGER NOT NULL,
    "beats" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MasterTimeline_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MasterTimeline_videoId_key" ON "MasterTimeline"("videoId");

-- AddForeignKey
ALTER TABLE "MasterTimeline" ADD CONSTRAINT "MasterTimeline_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;
