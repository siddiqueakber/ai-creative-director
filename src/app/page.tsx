'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSession, signIn } from 'next-auth/react'
import { motion, AnimatePresence } from 'framer-motion'
import { ThoughtInput } from '@/components/ThoughtInput'
import { VideoPlayer } from '@/components/VideoPlayer'
import { DisclaimerModal } from '@/components/DisclaimerModal'
import type { CognitiveAnalysis, EssayResult, VideoStatus } from '@/types'
import Link from 'next/link'

type ViewState = 'input' | 'processing' | 'video'

interface ProcessingState {
  promptText: string
  analysis?: CognitiveAnalysis
  essay?: EssayResult
  thoughtId?: string
  videoId?: string
  videoStatus?: VideoStatus
  videoUrl?: string
  narrationUrl?: string
  videoError?: string
  currentLayer?: number
  errorLayer?: number
  microFacts?: string[]
  // Documentary pipeline response (preferred)
  sceneVideos?: Array<{
    index: number
    description: string
    status: VideoStatus
    videoUrl?: string
    duration: number
    jobId?: string
  }>
  narrationProgress?: Record<string, { status: VideoStatus }>
  minimalNarration?: {
    validation: string
    sharedPerspective: string
    agency: string
    disclaimer?: string
  }
}

export default function Home() {
  const { data: session } = useSession()
  const [viewState, setViewState] = useState<ViewState>('input')
  const [isProcessing, setIsProcessing] = useState(false)
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false)
  const [showDisclaimer, setShowDisclaimer] = useState(false)
  const [processingState, setProcessingState] = useState<ProcessingState>({ promptText: '' })
  const currentStep = useMemo(() => {
    switch (viewState) {
      case 'input': return 1
      case 'processing': return 2
      case 'video': return 3
      default: return 1
    }
  }, [viewState])

  const [error, setError] = useState<string | null>(null)
  const [backgroundVideoUrls, setBackgroundVideoUrls] = useState<string[]>([])
  const [backgroundVideoIndex, setBackgroundVideoIndex] = useState(0)
  const [videoCompleted, setVideoCompleted] = useState(false)

  // Fetch background video URLs for the prompt section
  useEffect(() => {
    let cancelled = false
    fetch('/api/videos/background')
      .then((res) => res.json())
      .then((data: { urls?: string[] }) => {
        if (!cancelled && Array.isArray(data.urls) && data.urls.length > 0) {
          setBackgroundVideoUrls(data.urls)
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  // Check if user has accepted disclaimer
  useEffect(() => {
    const hasAccepted = localStorage.getItem('orbit_disclaimer_accepted')
    if (!hasAccepted) {
      setShowDisclaimer(true)
    }
  }, [])

  const handleDisclaimerAccept = () => {
    localStorage.setItem('orbit_disclaimer_accepted', 'true')
    setShowDisclaimer(false)
  }

  const handlePromptSubmit = useCallback(async (promptText: string) => {
    setIsProcessing(true)
    setError(null)
    setProcessingState({
      promptText,
    })
    setViewState('processing')

    try {
      const response = await fetch('/api/thought', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: promptText,
          inputType: 'text',
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to interpret prompt')
      }

      setProcessingState({
        promptText,
        analysis: data.analysis,
        essay: data.essay,
        thoughtId: data.thoughtId,
      })
      setViewState('video')

    } catch (err) {
      console.error('Error processing prompt:', err)
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setViewState('input')
    } finally {
      setIsProcessing(false)
    }
  }, [])

  const handleGenerateVideo = useCallback(async () => {
    if (!processingState.analysis || !processingState.essay) return

    // Check if user is signed in - required for video generation
    if (!session?.user) {
      setViewState('video')
      setProcessingState(prev => ({
        ...prev,
        videoStatus: 'failed',
        videoError: 'sign_in_required'
      }))
      return
    }

    // Check if thoughtId exists - required for video pipeline
    if (!processingState.thoughtId) {
      console.error('No thoughtId available - user may need to sign in')
      setViewState('video')
      setProcessingState(prev => ({
        ...prev,
        videoStatus: 'failed',
        videoError: 'sign_in_required'
      }))
      return
    }

    setIsGeneratingVideo(true)
    setViewState('video')
    setProcessingState(prev => ({ ...prev, videoStatus: 'pending' }))

    const fetchMicrofacts = async () => {
      try {
        const response = await fetch('/api/microfacts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            promptText: processingState.promptText,
            analysis: processingState.analysis,
            essay: processingState.essay,
          })
        })

        if (!response.ok) {
          return
        }

        const data = await response.json()
        if (data?.facts?.length) {
          setProcessingState(prev => ({ ...prev, microFacts: data.facts }))
        }
      } catch (error) {
        console.error('Microfacts request failed:', error)
      }
    }

    void fetchMicrofacts()

    try {
      const response = await fetch('/api/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          thoughtId: processingState.thoughtId,
          includeNarration: true,
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate video')
      }

      setProcessingState(prev => ({
        ...prev,
        videoId: data.videoId,
        videoStatus: data.status || 'pending',
        videoUrl: undefined,
        narrationUrl: undefined,
        sceneVideos: undefined,
        minimalNarration: undefined,
        videoError: undefined,
        errorLayer: undefined,
        currentLayer: undefined,
      }))

      // Poll for video status if still processing
      if (data.videoId) {
        pollVideoStatus(data.videoId)
      }

    } catch (err) {
      console.error('Error generating video:', err)
      setProcessingState(prev => ({ ...prev, videoStatus: 'failed' }))
    } finally {
      setIsGeneratingVideo(false)
    }
  }, [processingState])

  const pollVideoStatus = async (videoId: string) => {
    let attempts = 0
    const maxAttempts = 450 // 15 minutes with 2s intervals (Vertex AI Veo can take 5–10+ min)

    const checkStatus = async () => {
      try {
        const response = await fetch(`/api/video/${videoId}`)
        const data = await response.json()

        if (data.status === 'ready') {
          setProcessingState(prev => ({
            ...prev,
            videoStatus: 'ready',
            videoUrl: data.finalVideoUrl || data.videoUrl,
            narrationUrl: data.narrationUrl,
            sceneVideos: data.progress?.scenes,
            narrationProgress: data.progress?.narration,
            currentLayer: data.progress?.currentLayer,
          }))
          return
        }

        if (data.status === 'failed') {
          setProcessingState(prev => ({
            ...prev,
            videoStatus: 'failed',
            videoError: data.errorMessage ?? prev.videoError,
            errorLayer: data.errorLayer ?? prev.errorLayer,
          }))
          return
        }

        setProcessingState(prev => ({
          ...prev,
          videoStatus: data.status || prev.videoStatus,
          sceneVideos: data.progress?.scenes,
          narrationProgress: data.progress?.narration,
          currentLayer: data.progress?.currentLayer,
        }))

        attempts++
        if (attempts < maxAttempts) {
          setTimeout(checkStatus, 2000)
        } else {
          setProcessingState(prev => ({ ...prev, videoStatus: 'failed' }))
        }
      } catch (err) {
        console.error('Error polling video status:', err)
        setProcessingState(prev => ({ ...prev, videoStatus: 'failed' }))
      }
    }

    setTimeout(checkStatus, 2000)
  }

  // Auto-trigger video generation when viewState becomes 'video'
  // and we have a thoughtId but haven't started generating yet
  useEffect(() => {
    if (
      viewState === 'video' &&
      processingState.thoughtId &&
      !processingState.videoId &&
      !isGeneratingVideo &&
      processingState.videoStatus !== 'failed' &&
      session?.user
    ) {
      handleGenerateVideo()
    }
  }, [viewState, processingState.thoughtId, processingState.videoId, isGeneratingVideo, processingState.videoStatus, session?.user, handleGenerateVideo])

  const handleRetryVideo = useCallback(async () => {
    if (!processingState.thoughtId || !session?.user) return
    setIsGeneratingVideo(true)
    try {
      const response = await fetch('/api/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          thoughtId: processingState.thoughtId,
          includeNarration: true,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to retry')
      setProcessingState(prev => ({
        ...prev,
        videoId: data.videoId,
        videoStatus: 'pending',
        videoError: undefined,
        errorLayer: undefined,
        currentLayer: undefined,
        sceneVideos: undefined,
        narrationProgress: undefined,
      }))
      if (data.videoId) pollVideoStatus(data.videoId)
    } catch (err) {
      console.error('Retry failed:', err)
      setProcessingState(prev => ({
        ...prev,
        videoStatus: 'failed',
        videoError: err instanceof Error ? err.message : 'Try again failed',
      }))
    } finally {
      setIsGeneratingVideo(false)
    }
  }, [processingState.thoughtId, session?.user])

  const handleStartOver = () => {
    setViewState('input')
    setProcessingState({ promptText: '' })
    setError(null)
  }

  const currentBackgroundUrl = backgroundVideoUrls.length > 0
    ? backgroundVideoUrls[backgroundVideoIndex % backgroundVideoUrls.length]
    : null

  return (
    <main className="min-h-screen gradient-bg relative">
      <DisclaimerModal isOpen={showDisclaimer} onAccept={handleDisclaimerAccept} />

      {/* Background videos behind prompt section (input view only) */}
      {viewState === 'input' && currentBackgroundUrl && (
        <div className="fixed inset-0 z-0">
          <video
            key={currentBackgroundUrl}
            src={currentBackgroundUrl}
            muted
            autoPlay
            playsInline
            loop={backgroundVideoUrls.length === 1}
            className="absolute inset-0 w-full h-full object-cover"
            onEnded={() => {
              if (backgroundVideoUrls.length > 1) {
                setBackgroundVideoIndex((i) => (i + 1) % backgroundVideoUrls.length)
              }
            }}
          />
          <div
            className="absolute inset-0 bg-black/25"
            aria-hidden
          />
        </div>
      )}

      {/* Content above background */}
      <div className="relative z-10">
      {/* Header */}
      <header className="sticky top-0 z-40 glass elevated backdrop-blur-xl transition-all duration-300 border-b-2 border-white/30 dark:border-white/15 shadow-[0_4px_16px_rgba(45,54,45,0.08)]">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <motion.div
              className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--sage-500)] to-[var(--sage-700)] flex items-center justify-center shadow-md shadow-[inset_0_1px_0_rgba(255,255,255,0.15),inset_0_-1px_0_rgba(0,0,0,0.1)]"
              whileHover={{ scale: 1.05, rotate: 5 }}
              transition={{ type: "spring", stiffness: 400 }}
            >
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </motion.div>
            <span className="text-xl font-medium text-primary group-hover:text-[var(--sage-700)] transition-colors">Orbit</span>
          </Link>

          <nav className="flex items-center gap-4">
            {session ? (
              <div className="flex items-center gap-2">
                {session.user?.image && (
                  <img
                    src={session.user.image}
                    alt=""
                    className="w-8 h-8 rounded-full"
                  />
                )}
                <span className="text-sm text-secondary">
                  {session.user?.name?.split(' ')[0]}
                </span>
              </div>
            ) : (
              <button
                onClick={() => signIn('google')}
                className="px-5 py-2.5 bg-gradient-to-r from-[var(--sage-500)] to-[var(--sage-600)] text-white text-sm font-medium 
                         rounded-full hover:from-[var(--sage-600)] hover:to-[var(--sage-700)] 
                         transition-all duration-300 
                         hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_2px_4px_rgba(45,54,45,0.1),0_8px_16px_rgba(45,54,45,0.15)]
                         hover:scale-105
                         active:shadow-inner active:scale-95
                         shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]"
              >
                Sign In
              </button>
            )}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-4 py-10">
        {/* Stepper */}
        <div className="max-w-3xl mx-auto mb-12">
          <div className="glass elevated elevated-premium rounded-2xl px-6 py-5 border border-white/40 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-primary">Your flow</div>
                <div className="text-xs text-secondary mt-0.5">A guided film in three steps</div>
              </div>
              <div className="flex items-center gap-2">
                {[
                  { n: 1, label: 'Prompt' },
                  { n: 2, label: 'Your journey' },
                  { n: 3, label: 'Your film' },
                ].map(step => {
                  const isActive = currentStep === step.n
                  const isCompleted = currentStep > step.n
                  return (
                  <div key={step.n} className="flex items-center gap-2">
                    <motion.div
                      className={[
                        'w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300',
                        isActive && 'bg-gradient-to-br from-[var(--sage-600)] to-[var(--sage-700)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_0_0_3px_rgba(92,122,92,0.2),0_4px_12px_rgba(45,54,45,0.15)]',
                        isCompleted && !isActive && 'bg-gradient-to-br from-[var(--sage-500)] to-[var(--sage-600)] text-white shadow-md',
                        !isActive && !isCompleted && 'bg-white/50 dark:bg-white/10 text-secondary',
                      ].filter(Boolean).join(' ')}
                      whileHover={{ scale: currentStep >= step.n ? 1.1 : 1 }}
                      transition={{ type: "spring", stiffness: 300 }}
                    >
                      {isCompleted && !isActive ? (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        step.n
                      )}
                    </motion.div>
                    <span className={[
                      'hidden sm:block text-sm font-medium transition-colors duration-200',
                      currentStep >= step.n ? 'text-primary' : 'text-muted'
                    ].join(' ')}>
                      {step.label}
                    </span>
                    {step.n < 3 && <div className={[
                      'w-6 h-0.5 rounded-full transition-colors duration-300',
                      currentStep > step.n ? 'bg-[var(--sage-500)]' : 'bg-white/30 dark:bg-white/15'
                    ].join(' ')} />}
                  </div>
                )
                })}
              </div>
            </div>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {/* Input View */}
          {viewState === 'input' && (
            <motion.div
              key="input"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-8"
            >
              {/* Hero */}
              <div className="text-center space-y-5 mb-14">
                <motion.h1
                  className="text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-medium text-primary text-balance"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                   Put your life in perspective
                </motion.h1>
                <motion.p
                  className="text-lg md:text-xl text-secondary max-w-xl mx-auto text-balance leading-snug"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  Describe what you&apos;re going through. Orbit turns it into a short cinematic journey — helping you see your place in the wider story of life.
                </motion.p>
              </div>

              {/* Error Message */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                  className="max-w-2xl mx-auto p-5 bg-red-50/90 dark:bg-red-950/30 border border-red-200 dark:border-red-800/30 text-red-700 dark:text-red-300 rounded-2xl text-center shadow-sm"
                >
                  <div className="flex items-center justify-center gap-2 font-medium">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {error}
                  </div>
                </motion.div>
              )}

              {/* Thought Input */}
              <ThoughtInput onSubmit={handlePromptSubmit} isLoading={isProcessing} />


            </motion.div>
          )}

          {/* Processing View */}
          {viewState === 'processing' && (
            <motion.div
              key="processing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-20"
            >
              <div className="animate-breathe mb-8">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[var(--sage-400)] to-[var(--sage-600)] 
                              flex items-center justify-center shadow-lg shadow-[var(--sage-200)]">
                  <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
              </div>
              <h2 className="text-2xl font-medium text-primary mb-3">
                We&apos;re building your film.
              </h2>
              <p className="text-secondary text-center max-w-md">
                Shaping a narrative arc and visual language for your journey.
              </p>
            </motion.div>
          )}

          {/* Video View */}
          {viewState === 'video' && processingState.essay && (
            <motion.div
              key="video"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              {/* Back and step indicator — hidden during post-video blank screen */}
              {(processingState.videoStatus !== 'ready' || videoCompleted) && (
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => { setVideoCompleted(false); setViewState('input') }}
                    className="flex items-center gap-2 text-muted hover:text-primary transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Back to prompt
                  </button>
                  <span className="text-xs text-muted">Step 3 of 3</span>
                </div>
              )}

              <VideoPlayer
                videoUrl={processingState.videoUrl}
                narrationUrl={processingState.narrationUrl}
                essayText={processingState.essay.essayText}
                status={processingState.videoStatus || 'pending'}
                errorMessage={processingState.videoError}
                errorLayer={processingState.errorLayer}
                currentLayer={processingState.currentLayer}
                scenes={processingState.sceneVideos}
                narrationProgress={processingState.narrationProgress}
                microFacts={processingState.microFacts}
                quotes={processingState.essay.quotes}
                onClose={() => { setVideoCompleted(false); setViewState('input') }}
                onSignIn={() => signIn()}
                onRetry={handleRetryVideo}
                onVideoEnd={() => setVideoCompleted(true)}
              />

              {/* Actions — only visible after the post-video blank screen completes */}
              {videoCompleted && (
                <div className="flex justify-center gap-4 pt-8">
                  <button
                    onClick={() => { setVideoCompleted(false); handleStartOver() }}
                    className="px-6 py-3 bg-gradient-to-r from-[var(--sage-600)] to-[var(--sage-700)]
                             hover:from-[var(--sage-700)] hover:to-[var(--sage-800)]
                             text-white font-semibold rounded-2xl
                             transition-all duration-300 ease-[var(--ease-smooth)]
                             hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_2px_4px_rgba(45,54,45,0.1)]
                             shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]"
                  >
                    Create another film
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <footer className="py-10 text-center space-y-1">
        <p className="text-sm text-muted font-medium">Orbit is a creative reflection tool, not a source of professional advice.</p>
        <p className="text-xs text-muted">Your data is not used for training.</p>
      </footer>
      </div>
    </main>
  )
}
