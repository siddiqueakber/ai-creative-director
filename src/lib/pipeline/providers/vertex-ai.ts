/**
 * Vertex AI Veo 3.1 – AI video generation
 *
 * Flow: Orchestrator calls startVertexAIJob(prompt, duration) per scene → we call
 * Vertex predictLongRunning → return operation name. Orchestrator then polls
 * checkVertexAIJob(jobId) until status is ready/failed; we use fetchPredictOperation.
 * When all scenes are ready, pipeline moves to assembly (Layer 7).
 */
import { PredictionServiceClient } from '@google-cloud/aiplatform'
import type { RunwayJobResult } from '../types'
import { writePublicFile } from './storage'

function getProjectId(): string {
  return process.env.GOOGLE_CLOUD_PROJECT_ID || ''
}

function getLocation(): string {
  return process.env.GOOGLE_CLOUD_LOCATION || 'us-central1'
}

function getVeoModel(): string {
  return process.env.VEO_MODEL || 'veo-3.1-generate-001'
}

function getVeoAudio(): boolean {
  return process.env.VEO_ENABLE_AUDIO === 'true'
}

// Timeline uses 6 and 8s only for fewer cuts; Veo 3.1 supports 4, 6, 8 — we request 6 or 8
const VEO_ALLOWED_DURATIONS = [6, 8]

// Initialize the client
let predictionClient: PredictionServiceClient | null = null

function getPredictionClient(): PredictionServiceClient {
  if (!predictionClient) {
    const projectId = getProjectId()
    if (!projectId) {
      throw new Error('GOOGLE_CLOUD_PROJECT_ID is not set in environment variables')
    }
    predictionClient = new PredictionServiceClient({
      apiEndpoint: `${getLocation()}-aiplatform.googleapis.com`,
    })
  }
  return predictionClient
}

function getAllowedDurations(): number[] {
  return VEO_ALLOWED_DURATIONS
}

function normalizeDuration(duration: number): number {
  const allowed = getAllowedDurations()
  if (!Number.isFinite(duration) || duration <= 0) return allowed[0]
  const clamped = Math.min(duration, allowed[allowed.length - 1])
  return allowed.reduce((nearest, current) =>
    Math.abs(current - clamped) < Math.abs(nearest - clamped) ? current : nearest
  )
}

function getModelPath(): string {
  return `projects/${getProjectId()}/locations/${getLocation()}/publishers/google/models/${getVeoModel()}`
}

function mapVertexStatus(vertexStatus: string): RunwayJobResult['status'] {
  // Vertex AI uses different status values
  // Common statuses: PENDING, RUNNING, SUCCEEDED, FAILED, CANCELLED
  switch (vertexStatus?.toUpperCase()) {
    case 'SUCCEEDED':
    case 'SUCCESS':
    case 'COMPLETED':
      return 'ready'
    case 'FAILED':
    case 'ERROR':
    case 'CANCELLED':
      return 'failed'
    case 'PENDING':
    case 'RUNNING':
    case 'IN_PROGRESS':
      return 'processing'
    default:
      return 'pending'
  }
}

/**
 * Extract video from fetchPredictOperation response.
 * Doc: response.videos[] with gcsUri (if storageUri set) or bytesBase64Encoded.
 */
function extractVideoFromResponse(data: any): { gcsUri?: string; bytesBase64?: string } | undefined {
  const videos = data?.videos
  if (!Array.isArray(videos) || videos.length === 0) return undefined
  const first = videos[0]
  if (first?.gcsUri) return { gcsUri: first.gcsUri }
  if (first?.bytesBase64Encoded) return { bytesBase64: first.bytesBase64Encoded }
  return undefined
}

/**
 * Start a Vertex AI Veo 3.1 video generation job
 */
export async function startVertexAIJob(
  prompt: string,
  duration: number
): Promise<RunwayJobResult> {
  const projectId = getProjectId()
  if (!projectId) {
    return {
      jobId: `placeholder_${Date.now()}`,
      status: 'ready',
      videoUrl: `/api/placeholder-video?type=documentary&scene=calm&duration=${duration}`,
    }
  }

  try {
    const modelPath = getModelPath()
    const normalizedDuration = normalizeDuration(duration)
    const veoModel = getVeoModel()
    const veoAudio = getVeoAudio()

    // Vertex AI Veo 3.1 request (see Veo video generation API doc):
    // instances = [{ prompt }], parameters = durationSeconds, generateAudio, aspectRatio, sampleCount
    const body = {
      instances: [{ prompt }],
      parameters: {
        durationSeconds: normalizedDuration,
        generateAudio: veoAudio,
        aspectRatio: '16:9',
        sampleCount: 1, // 1 video per request (doc: 1–4)
      },
    }

    // Optional: store output in GCS to get gcsUri in response (else base64 in response)
    const storageUri = process.env.VEO_OUTPUT_STORAGE_URI
    if (storageUri) {
      (body.parameters as Record<string, unknown>).storageUri = storageUri
    }

    if (process.env.VEO_DEBUG === 'true') {
      console.log('Vertex AI request:', {
        model: veoModel,
        durationSeconds: normalizedDuration,
        generateAudio: veoAudio,
        promptLength: prompt.length,
      })
    }

    const { GoogleAuth } = await import('google-auth-library')
    const auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    })
    const authClient = await auth.getClient()
    const accessToken = await authClient.getAccessToken()

    const predictUrl = `https://${getLocation()}-aiplatform.googleapis.com/v1/${modelPath}:predictLongRunning`
    const httpResponse = await fetch(predictUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken?.token || ''}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!httpResponse.ok) {
      const errorText = await httpResponse.text()
      throw new Error(`Vertex AI API error: ${httpResponse.status} ${errorText}`)
    }

    const operation = await httpResponse.json()
    
    // predictLongRunning returns an Operation object
    // The operation name is in operation.name
    const operationName = operation.name
    if (!operationName) {
      throw new Error('No operation name returned from predictLongRunning')
    }

    return {
      jobId: operationName,
      status: 'processing',
    }
  } catch (error) {
    console.error('Vertex AI job start failed:', error)
    const errorMessage =
      error instanceof Error ? error.message : 'Vertex AI API error'
    return {
      jobId: `error_${Date.now()}`,
      status: 'failed',
      errorMessage,
    }
  }
}

/**
 * Check the status of a Vertex AI Veo job
 * Note: Vertex AI uses Operations API for long-running tasks
 */
export async function checkVertexAIJob(jobId: string): Promise<RunwayJobResult> {
  const projectId = getProjectId()
  if (!projectId) {
    return { jobId, status: 'failed', errorMessage: 'Vertex AI not configured' }
  }

  try {
    // Veo long-running predictions must be polled via fetchPredictOperation, not the generic Operations API.
    // See: https://cloud.google.com/vertex-ai/generative-ai/docs/reference/rest/v1/projects.locations.publishers.models/fetchPredictOperation
    // jobId = projects/{project}/locations/{location}/publishers/google/models/{model}/operations/{operation_id}
    const location = getLocation()
    const projectId = getProjectId()
    const model = getVeoModel()

    // Endpoint for fetchPredictOperation: {endpoint}:fetchPredictOperation
    // where endpoint = projects/{project}/locations/{location}/publishers/google/models/{model}
    const endpoint = `projects/${projectId}/locations/${location}/publishers/google/models/${model}`
    const fetchPredictUrl = `https://${location}-aiplatform.googleapis.com/v1/${endpoint}:fetchPredictOperation`

    if (process.env.VEO_DEBUG === 'true') {
      console.log('Checking operation via fetchPredictOperation:', fetchPredictUrl)
    }

    const { GoogleAuth } = await import('google-auth-library')
    const auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    })
    const authClient = await auth.getClient()
    const accessToken = await authClient.getAccessToken()

    const httpResponse = await fetch(fetchPredictUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken?.token || ''}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ operationName: jobId }),
    })

    if (!httpResponse.ok) {
      const errorText = await httpResponse.text()
      return {
        jobId,
        status: 'failed',
        errorMessage: errorText || 'Failed to check operation status',
      }
    }

    const operation = await httpResponse.json()

    if (!operation) {
      return {
        jobId,
        status: 'failed',
        errorMessage: 'Operation not found',
      }
    }

    const done = operation.done
    const error = operation.error

    if (error) {
      return {
        jobId,
        status: 'failed',
        errorMessage: error.message || 'Vertex AI operation failed',
      }
    }

    if (!done) {
      return {
        jobId,
        status: 'processing',
      }
    }

    // Operation is done - extract the result (doc: response.videos[].gcsUri or bytesBase64Encoded)
    const operationResponse = operation.response
    const videoResult = extractVideoFromResponse(operationResponse)

    let videoUrl: string | undefined
    if (videoResult?.gcsUri) {
      videoUrl = videoResult.gcsUri
    } else if (videoResult?.bytesBase64) {
      try {
        const buf = Buffer.from(videoResult.bytesBase64, 'base64')
        const safeId = jobId.replace(/[^a-zA-Z0-9-_]/g, '_').slice(-48)
        videoUrl = await writePublicFile(buf, `generated/veo_scenes/${safeId}.mp4`)
      } catch (e) {
        console.error('Failed to write Veo base64 video to public file:', e)
      }
    }

    // Detect RAI (Responsible AI) content filtering
    const raiFiltered = operationResponse?.raiMediaFilteredCount > 0
    const raiReasons = operationResponse?.raiMediaFilteredReasons

    if (process.env.VEO_DEBUG === 'true') {
      console.log('Vertex AI operation completed:', {
        jobId,
        hasVideoUrl: !!videoUrl,
        raiFiltered,
        raiReasons,
        responseKeys: operationResponse ? Object.keys(operationResponse) : [],
      })
    }

    // If the operation is done but no video was returned, it's a failure
    // (e.g. RAI content filter blocked the generation)
    if (!videoUrl) {
      return {
        jobId,
        status: 'failed',
        errorMessage: raiFiltered
          ? `Video blocked by content safety filter${raiReasons ? `: ${JSON.stringify(raiReasons)}` : ''}`
          : 'Video generation completed but no video was returned',
      }
    }

    return {
      jobId,
      status: 'ready',
      videoUrl,
    }
  } catch (error) {
    console.error('Vertex AI status check failed:', error)
    
    // If Operations API fails, try direct prediction check
    // (some Vertex AI models return results directly)
    try {
      const client = getPredictionClient()
      const modelPath = getModelPath()
      
      // This is a fallback - might not work for async operations
      // In practice, Veo uses Operations API
      return {
        jobId,
        status: 'processing',
        errorMessage: error instanceof Error ? error.message : 'Status check failed',
      }
    } catch (fallbackError) {
      return {
        jobId,
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Connection error',
      }
    }
  }
}
