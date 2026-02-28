import { prisma } from '@/lib/db'

export type StepType = 'start' | 'end' | 'error'

export interface StepPayload {
  durationMs?: number
  message?: string
  [key: string]: unknown
}

/**
 * Write one pipeline step to the DB. Never throws — logging failure must not crash the pipeline.
 */
export async function recordStep(
  videoId: string,
  layer: string,
  step: StepType,
  payload?: StepPayload | null
): Promise<void> {
  try {
    await prisma.pipelineStep.create({
      data: {
        videoId,
        layer,
        step,
        durationMs: payload?.durationMs ?? undefined,
        payload: payload ? (payload as object) : undefined,
      },
    })
  } catch (err) {
    console.error('[PipelineLogger] recordStep failed:', err instanceof Error ? err.message : err)
  }
}

/**
 * Run fn with layer timing: record "start", run fn, then record "end" (with durationMs) or "error" (with message) on throw.
 * Returns fn's result. Re-throws after recording error.
 */
export async function withLayerTiming<T>(
  videoId: string,
  layer: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = Date.now()
  await recordStep(videoId, layer, 'start')
  try {
    const result = await fn()
    const durationMs = Date.now() - start
    await recordStep(videoId, layer, 'end', { durationMs })
    return result
  } catch (err) {
    const durationMs = Date.now() - start
    const message = err instanceof Error ? err.message : String(err)
    await recordStep(videoId, layer, 'error', { durationMs, message })
    throw err
  }
}
