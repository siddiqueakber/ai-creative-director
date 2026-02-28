'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { VideoStatus } from '@/types'

interface VideoPlayerProps {
  videoUrl?: string
  narrationUrl?: string
  essayText: string
  status: VideoStatus
  errorMessage?: string
  errorLayer?: number
  currentLayer?: number
  microFacts?: string[]
  quotes?: string[]
  scenes?: Array<{
    index: number
    status: VideoStatus
    videoUrl?: string
  }>
  narrationProgress?: Record<string, { status: VideoStatus }>
  onClose?: () => void
  onSignIn?: () => void
  onRetry?: () => void
  onVideoEnd?: () => void
}

const LAYER_LABELS: Record<number, string> = {
  1: 'Understanding your prompt',
  2: 'Choosing perspective & structure',
  3: 'Choosing perspective & structure',
  4: 'Writing narration',
  5: 'Writing narration',
  6: 'Generating AI video (Vertex Veo)',
  7: 'Assembling your video',
}

function layerToStep(layer: number): number {
  if (layer <= 1) return 1
  if (layer <= 3) return 2
  if (layer <= 5) return 3
  if (layer <= 6) return 4
  return 5
}

export function VideoPlayer({
  videoUrl,
  narrationUrl,
  essayText,
  status,
  errorMessage,
  errorLayer,
  currentLayer,
  microFacts,
  quotes,
  scenes,
  narrationProgress,
  onClose,
  onSignIn,
  onRetry,
  onVideoEnd,
}: VideoPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isMuted, setIsMuted] = useState(false)
  const [showText, setShowText] = useState(false)
  const [microFactIndex, setMicroFactIndex] = useState(0)
  const [quoteIndex, setQuoteIndex] = useState(0)
  const [videoEnded, setVideoEnded] = useState(false)
  const [showBackButton, setShowBackButton] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    if (status === 'ready' && videoRef.current) {
      // Auto-play when ready
      const playVideo = async () => {
        try {
          await videoRef.current?.play()
          setIsPlaying(true)
        } catch (err) {
          console.log('Autoplay prevented:', err)
        }
      }
      playVideo()
    }
  }, [status])

  useEffect(() => {
    if (!microFacts || microFacts.length === 0) return
    setMicroFactIndex(0)
    const interval = setInterval(() => {
      setMicroFactIndex((prev) => (prev + 1) % microFacts.length)
    }, 6000)
    return () => clearInterval(interval)
  }, [microFacts])

  useEffect(() => {
    if (!quotes || quotes.length === 0) return
    setQuoteIndex(0)
    const interval = setInterval(() => {
      setQuoteIndex((prev) => (prev + 1) % quotes.length)
    }, 6000)
    return () => clearInterval(interval)
  }, [quotes])

  useEffect(() => {
    if (!videoEnded) return
    const timer = setTimeout(() => {
      setShowBackButton(true)
      onVideoEnd?.()
    }, 15000)
    return () => clearTimeout(timer)
  }, [videoEnded, onVideoEnd])

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause()
        audioRef.current?.pause()
      } else {
        videoRef.current.play()
        if (audioRef.current) {
          audioRef.current.currentTime = videoRef.current.currentTime
          audioRef.current.play()
        }
      }
      setIsPlaying(!isPlaying)
    }
  }

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime)
    }
  }

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration)
    }
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value)
    if (videoRef.current) {
      videoRef.current.currentTime = time
      if (audioRef.current) {
        audioRef.current.currentTime = time
      }
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleDownload = async () => {
    if (videoUrl) {
      try {
        const response = await fetch(videoUrl)
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'orbit-essay.mp4'
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      } catch (err) {
        console.error('Download failed:', err)
      }
    }
  }

  // Processing state
  if (
    status === 'pending' ||
    status === 'processing' ||
    status === 'understanding' ||
    status === 'blueprint' ||
    status === 'generating' ||
    status === 'assembling'
  ) {
    const stepNum = currentLayer != null ? layerToStep(currentLayer) : 1
    const stepLabel = currentLayer != null && LAYER_LABELS[currentLayer]
      ? LAYER_LABELS[currentLayer]
      : 'Creating your video'

    const readyCount = scenes?.filter((s) => s.status === 'ready').length ?? 0
    const totalCount = scenes?.length ?? 0

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="w-full max-w-2xl mx-auto space-y-5"
      >
        {/* Main progress card */}
        <div className="bg-gradient-to-br from-[var(--sage-700)] to-[var(--sage-900)] 
                      rounded-3xl overflow-hidden shadow-2xl px-6 py-8 sm:px-8 sm:py-10">
          <div className="flex flex-col items-center text-white">
            {/* Spinner */}
            <motion.div
              className="w-12 h-12 border-[3px] border-white/15 border-t-white rounded-full mb-5"
              animate={{ rotate: 360 }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            />

            {/* Step title */}
            <h3 className="text-lg sm:text-xl font-medium mb-1 text-center">{stepLabel}</h3>
            <p className="text-white/55 text-sm text-center">
              Step {stepNum} of 5 &middot; Can take 3–10 minutes
            </p>

            {/* Scene progress bar (only when we have scenes) */}
            {totalCount > 0 && (
              <div className="w-full max-w-sm mt-6">
                <div className="flex justify-between text-xs text-white/50 mb-1.5">
                  <span>Scenes</span>
                  <span>{readyCount} / {totalCount} ready</span>
                </div>
                <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-white/60 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${(readyCount / totalCount) * 100}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                  />
                </div>
              </div>
            )}

            {/* Progress dots (before scenes arrive) */}
            {totalCount === 0 && (
              <div className="flex gap-2 mt-5">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-1.5 h-1.5 bg-white rounded-full"
                    animate={{ opacity: [0.25, 1, 0.25] }}
                    transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Content cards — below the main card, not inside it */}
        {((microFacts && microFacts.length > 0) || (quotes && quotes.length > 0)) && (
          <div className="space-y-3">
            {microFacts && microFacts.length > 0 && (
              <div className="rounded-2xl border border-[var(--sage-300)] bg-[var(--sage-50)] px-5 py-4">
                <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--sage-500)] mb-2 font-medium">
                  Did you know
                </div>
                <AnimatePresence mode="wait">
                  <motion.p
                    key={`fact-${microFactIndex}`}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                    className="text-sm sm:text-base text-[var(--sage-800)] leading-relaxed font-serif"
                  >
                    {microFacts[microFactIndex]}
                  </motion.p>
                </AnimatePresence>
              </div>
            )}
            {quotes && quotes.length > 0 && (
              <div className="rounded-2xl border border-[var(--sage-300)] bg-[var(--sage-50)] px-5 py-4">
                <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--sage-500)] mb-2 font-medium">
                  Reflection
                </div>
                <AnimatePresence mode="wait">
                  <motion.p
                    key={`quote-${quoteIndex}`}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                    className="text-sm sm:text-base text-[var(--sage-800)] leading-relaxed font-serif italic"
                  >
                    {quotes[quoteIndex]}
                  </motion.p>
                </AnimatePresence>
              </div>
            )}
          </div>
        )}

        {/* Scene badges — compact row */}
        {scenes && scenes.length > 0 && (
          <div className="flex flex-wrap gap-1.5 justify-center">
            {scenes.map((scene) => {
              const isReady = scene.status === 'ready'
              const isProcessing = scene.status === 'processing'
              return (
                <span
                  key={scene.index}
                  className={[
                    'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium',
                    isReady
                      ? 'bg-[var(--sage-100)] text-[var(--sage-700)]'
                      : isProcessing
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-gray-100 text-gray-400',
                  ].join(' ')}
                >
                  <span className={[
                    'w-1.5 h-1.5 rounded-full',
                    isReady ? 'bg-[var(--sage-500)]' : isProcessing ? 'bg-amber-400' : 'bg-gray-300',
                  ].join(' ')} />
                  {scene.index + 1}
                </span>
              )
            })}
          </div>
        )}
      </motion.div>
    )
  }

  // Error state - Sign in required
  if (status === 'failed' && errorMessage === 'sign_in_required') {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="w-full max-w-2xl mx-auto"
      >
        <div className="relative aspect-video bg-gradient-to-br from-[var(--sage-100)] to-[var(--sage-200)] 
                      rounded-3xl overflow-hidden shadow-xl flex items-center justify-center">
          <div className="text-center px-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--sage-200)] flex items-center justify-center">
              <svg className="w-8 h-8 text-[var(--sage-600)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-[var(--sage-800)] mb-2">Sign In to Generate Videos</h3>
            <p className="text-[var(--sage-600)] text-sm mb-4">
              Create a free account to generate documentary-style essays from your prompts.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={onSignIn}
                className="px-5 py-2 bg-[var(--sage-500)] text-white rounded-full text-sm font-medium
                         hover:bg-[var(--sage-600)] transition-colors"
              >
                Sign In
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-white/50 text-[var(--sage-700)] rounded-full text-sm font-medium
                         hover:bg-white/70 transition-colors border border-[var(--sage-300)]"
              >
                Continue Reading
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    )
  }

  // Error state - General failure
  if (status === 'failed') {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="w-full max-w-2xl mx-auto"
      >
        <div className="relative aspect-video bg-gradient-to-br from-[var(--sand-200)] to-[var(--sand-300)] 
                      rounded-3xl overflow-hidden shadow-xl flex items-center justify-center">
          <div className="text-center px-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-[var(--sage-800)] mb-2">Something went wrong creating your video.</h3>
            {errorMessage ? (
              <p className="text-[var(--sage-600)] text-sm mb-1">Details: {errorMessage}</p>
            ) : (
              <p className="text-[var(--sage-600)] text-sm mb-1">We couldn&apos;t generate your video at this time. Your essay is still saved.</p>
            )}
            {errorLayer != null && (
              <p className="text-[var(--sage-500)] text-xs mb-4">Step that failed: {errorLayer}</p>
            )}
            {errorLayer == null && <div className="mb-4" />}
            <div className="flex gap-3 justify-center flex-wrap">
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="px-5 py-2 bg-[var(--sage-500)] text-white rounded-full text-sm font-medium
                           hover:bg-[var(--sage-600)] transition-colors"
                >
                  Try again
                </button>
              )}
              <button
                onClick={onClose}
                className="px-4 py-2 bg-white/50 text-[var(--sage-700)] rounded-full text-sm font-medium
                         hover:bg-[var(--sage-600)] transition-colors border border-[var(--sage-300)]"
              >
                Continue Reading
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    )
  }

  // Ready state - Video player
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full max-w-3xl mx-auto"
    >
      <div className="relative aspect-video bg-black rounded-3xl overflow-hidden shadow-2xl group">
        {/* Video */}
        <video
          ref={videoRef}
          src={videoUrl}
          className="w-full h-full object-cover"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={() => { setIsPlaying(false); setVideoEnded(true) }}
          muted={isMuted}
          playsInline
        />

        {/* Narration audio */}
        {narrationUrl && (
          <audio ref={audioRef} src={narrationUrl} />
        )}

        {/* Text Overlay */}
        <AnimatePresence>
          {showText && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center p-8 pointer-events-none"
            >
              <div className="bg-black/50 backdrop-blur-sm rounded-2xl p-6 max-w-xl border border-white/10">
                <p className="text-white text-base md:text-lg text-center leading-relaxed">
                  {essayText}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Muted hint - show when muted so user knows why there's no voice */}
        {isMuted && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-black/60 text-white text-xs pointer-events-none">
            Unmute to hear narration
          </div>
        )}

        {/* Controls Overlay */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          {/* Gradient overlay */}
          <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/60 to-transparent" />

          {/* Play/Pause button */}
          <button
            onClick={togglePlay}
            className="absolute inset-0 flex items-center justify-center group"
          >
            <div className="w-20 h-20 rounded-full bg-white/25 backdrop-blur-sm flex items-center justify-center
                          hover:bg-white/35 transition-all duration-300 group-hover:scale-110
                          shadow-lg">
              {isPlaying ? (
                <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                </svg>
              ) : (
                <svg className="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </div>
          </button>

          {/* Bottom controls */}
          <div className="absolute inset-x-0 bottom-0 p-4 space-y-2">
            {/* Progress bar */}
            <input
              type="range"
              min="0"
              max={duration || 100}
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-1.5 bg-white/20 rounded-full appearance-none cursor-pointer
                       transition-all duration-200 hover:h-2
                       [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 
                       [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full 
                       [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md
                       [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-125"
              style={{
                background: `linear-gradient(to right, var(--sage-400) 0%, var(--sage-400) ${(currentTime / (duration || 1)) * 100}%, rgba(255,255,255,0.2) ${(currentTime / (duration || 1)) * 100}%, rgba(255,255,255,0.2) 100%)`
              }}
            />

            <div className="flex items-center justify-between text-white text-sm">
              <div className="flex items-center gap-4">
                <span className="font-mono">{formatTime(currentTime)} / {formatTime(duration)}</span>

                {/* Mute toggle */}
                <button
                  onClick={() => setIsMuted(!isMuted)}
                  className="hover:text-white/70 flex items-center gap-1.5"
                  title={isMuted ? 'Unmute to hear narration' : 'Mute'}
                >
                  {isMuted ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    </svg>
                  )}
                </button>

                {/* Text toggle */}
                <button
                  onClick={() => setShowText(!showText)}
                  className={[
                    'px-3 py-1.5 rounded-full text-xs border transition-colors',
                    showText ? 'bg-white/25 border-white/30' : 'bg-white/10 border-white/20 hover:bg-white/15'
                  ].join(' ')}
                >
                  {showText ? 'Hide text' : 'Show text'}
                </button>
              </div>

              <div className="flex items-center gap-3">
                {/* Download */}
                <button onClick={handleDownload} className="hover:text-white/70">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Post-video blank screen for perceptual settling */}
        <AnimatePresence>
          {videoEnded && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 2 }}
              className="absolute inset-0 bg-black z-50 flex items-center justify-center"
            >
              <AnimatePresence>
                {showBackButton && onClose && (
                  <motion.button
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.4 }}
                    whileHover={{ opacity: 0.8 }}
                    transition={{ duration: 2 }}
                    onClick={onClose}
                    className="text-white/40 text-sm tracking-wide hover:text-white/80 transition-colors"
                  >
                    back
                  </motion.button>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
