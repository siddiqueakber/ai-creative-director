'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { formatTimeUntilReset } from '@/lib/rate-limit'

interface RateLimitBannerProps {
  remaining: number
  limit: number
  resetAt: Date
  isAuthenticated: boolean
}

export function RateLimitBanner({ remaining, limit, resetAt, isAuthenticated }: RateLimitBannerProps) {
  const showWarning = remaining <= 1
  const isExhausted = remaining === 0

  if (!showWarning && remaining > 2) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className={`rounded-2xl p-4 mb-6 ${
          isExhausted 
            ? 'bg-amber-50 border border-amber-200' 
            : 'bg-[var(--sand-100)] border border-[var(--sand-300)]'
        }`}
      >
        <div className="flex items-start gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
            isExhausted ? 'bg-amber-100' : 'bg-[var(--sage-100)]'
          }`}>
            {isExhausted ? (
              <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-[var(--sage-600)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </div>
          
          <div className="flex-1">
            {isExhausted ? (
              <>
                <p className="font-medium text-amber-800">Daily limit reached</p>
                <p className="text-sm text-amber-600 mt-1">
                  You've used all {limit} essays for today. 
                  Resets in {formatTimeUntilReset(resetAt)}.
                </p>
                {!isAuthenticated && (
                  <p className="text-sm text-amber-600 mt-2">
                    <a href="/auth/signin" className="underline font-medium">Sign in</a> to get more daily essays.
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="font-medium text-[var(--sage-700)]">
                  {remaining} essay{remaining !== 1 ? 's' : ''} remaining today
                </p>
                <p className="text-sm text-[var(--sage-500)] mt-1">
                  Your daily limit resets in {formatTimeUntilReset(resetAt)}.
                </p>
              </>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
