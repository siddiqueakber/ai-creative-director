import 'dotenv/config'
import prisma from '../src/lib/db'

async function main() {
  const videoId = process.argv[2]
  if (!videoId) {
    console.error('Usage: npx tsx scripts/view-qc-report.ts <videoId>')
    process.exit(1)
  }

  const video = await prisma.video.findUnique({
    where: { id: videoId },
    select: {
      pipelineStatus: true,
      errorMessage: true,
      qcReport: true,
    },
  })

  if (!video) {
    console.error(`Video not found: ${videoId}`)
    process.exit(1)
  }

  console.log(`Video: ${videoId}`)
  console.log(`Status: ${video.pipelineStatus}`)
  if (video.errorMessage) {
    console.log(`Error: ${video.errorMessage}`)
  }

  if (!video.qcReport) {
    console.log('No QC report found.')
    process.exit(0)
  }

  console.log('\nQC Report:')
  console.log(JSON.stringify(video.qcReport, null, 2))
}

main()
  .catch((error) => {
    console.error('Failed to load QC report:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
