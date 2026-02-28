import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const apiKey = process.env.RUNWAY_API_KEY
  const version = '2024-11-06'

  if (!apiKey) {
    return NextResponse.json(
      { error: 'Runway API key not configured' },
      { status: 500 }
    )
  }

  const { id: jobId } = await params
  if (!jobId) {
    return NextResponse.json({ error: 'Missing task id' }, { status: 400 })
  }

  try {
    const tryUrls = [
      `https://api.dev.runwayml.com/v1/tasks/${jobId}`,
      `https://api.dev.runwayml.com/v1/generations/${jobId}`,
    ]

    let response: Response | undefined
    let lastError = ''
    for (const url of tryUrls) {
      response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'X-Runway-Version': version,
        },
      })
      if (response.ok) break
      lastError = await response.text()
    }

    if (!response || !response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch task', details: lastError },
        { status: 502 }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      { error: 'Runway request failed', details: String(error) },
      { status: 502 }
    )
  }
}
