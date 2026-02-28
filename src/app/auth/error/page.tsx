'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Suspense } from 'react'

function ErrorContent() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')

  const errorMessages: Record<string, string> = {
    Configuration: 'There is a problem with the server configuration.',
    AccessDenied: 'You do not have access to this resource.',
    Verification: 'The verification link has expired or has already been used.',
    Default: 'An error occurred during authentication.',
  }

  const message = error ? errorMessages[error] || errorMessages.Default : errorMessages.Default

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md text-center"
      >
        <div className="glass rounded-3xl p-8 shadow-xl">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-100 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>

          <h1 className="text-2xl font-medium text-[var(--sage-800)] mb-2">
            Authentication Error
          </h1>
          <p className="text-[var(--sage-500)] mb-8">
            {message}
          </p>

          <div className="space-y-3">
            <Link
              href="/auth/signin"
              className="block w-full px-6 py-3 bg-[var(--sage-500)] hover:bg-[var(--sage-600)]
                       text-white font-medium rounded-full transition-colors"
            >
              Try Again
            </Link>
            <Link
              href="/"
              className="block w-full px-6 py-3 text-[var(--sage-600)] hover:text-[var(--sage-800)]
                       font-medium transition-colors"
            >
              Go Home
            </Link>
          </div>
        </div>
      </motion.div>
    </main>
  )
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[var(--sage-200)] border-t-[var(--sage-500)] rounded-full animate-spin" />
      </div>
    }>
      <ErrorContent />
    </Suspense>
  )
}
