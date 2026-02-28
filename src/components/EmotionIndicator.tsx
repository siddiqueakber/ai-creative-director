'use client'

import { ReactNode } from 'react'
import { motion } from 'framer-motion'

interface EmotionIndicatorProps {
  emotion: string
  intensity: number
  size?: 'sm' | 'md' | 'lg'
}

const EMOTION_COLORS: Record<string, { bg: string; ring: string; text: string }> = {
  shame: { bg: '#d4a5a5', ring: '#c28e8e', text: '#6b4444' },
  fear: { bg: '#a5b8d4', ring: '#8ea2c2', text: '#445266' },
  anxiety: { bg: '#b8a5d4', ring: '#a28ec2', text: '#524466' },
  sadness: { bg: '#a5c4d4', ring: '#8eb0c2', text: '#446066' },
  anger: { bg: '#d4b5a5', ring: '#c29e8e', text: '#665044' },
  guilt: { bg: '#c4a5d4', ring: '#b08ec2', text: '#5e4466' },
  loneliness: { bg: '#a5d4c4', ring: '#8ec2b0', text: '#44665e' },
  frustration: { bg: '#d4c4a5', ring: '#c2b08e', text: '#665e44' },
  hopelessness: { bg: '#b8b8b8', ring: '#a0a0a0', text: '#505050' },
  overwhelm: { bg: '#d4a5c4', ring: '#c28eb0', text: '#66445e' },
}

const EMOTION_ICONS: Record<string, ReactNode> = {
  shame: (
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  ),
  fear: (
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  ),
  anxiety: (
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M13 10V3L4 14h7v7l9-11h-7z" />
  ),
  sadness: (
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  ),
  anger: (
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
  ),
  guilt: (
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
  ),
  loneliness: (
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  ),
  frustration: (
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  ),
  hopelessness: (
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
  ),
  overwhelm: (
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
  ),
}

const SIZE_CLASSES = {
  sm: { container: 'w-10 h-10', icon: 'w-4 h-4', ring: 'w-12 h-12' },
  md: { container: 'w-14 h-14', icon: 'w-6 h-6', ring: 'w-16 h-16' },
  lg: { container: 'w-20 h-20', icon: 'w-8 h-8', ring: 'w-24 h-24' },
}

export function EmotionIndicator({ emotion, intensity, size = 'md' }: EmotionIndicatorProps) {
  const colors = EMOTION_COLORS[emotion] || EMOTION_COLORS.overwhelm
  const icon = EMOTION_ICONS[emotion] || EMOTION_ICONS.overwhelm
  const sizeClasses = SIZE_CLASSES[size]

  // Intensity affects the animation speed and opacity
  const animationDuration = 4 - (intensity / 10) * 2 // 4s at intensity 1, 2s at intensity 10
  const ringOpacity = 0.2 + (intensity / 10) * 0.4 // 0.2 at intensity 1, 0.6 at intensity 10

  return (
    <div className="relative flex items-center justify-center">
      {/* Pulsing ring */}
      <motion.div
        className={`absolute ${sizeClasses.ring} rounded-full`}
        style={{ backgroundColor: colors.ring }}
        animate={{
          scale: [1, 1.2, 1],
          opacity: [ringOpacity, ringOpacity * 0.5, ringOpacity],
        }}
        transition={{
          duration: animationDuration,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      
      {/* Inner circle */}
      <motion.div
        className={`relative ${sizeClasses.container} rounded-full flex items-center justify-center`}
        style={{ backgroundColor: colors.bg }}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 15 }}
      >
        <svg 
          className={sizeClasses.icon} 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke={colors.text}
        >
          {icon}
        </svg>
      </motion.div>

      {/* Intensity indicator (small dots around the circle) */}
      {Array.from({ length: Math.ceil(intensity / 2) }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1.5 h-1.5 rounded-full"
          style={{
            backgroundColor: colors.ring,
            transform: `rotate(${i * (360 / 5)}deg) translateY(-${size === 'lg' ? 40 : size === 'md' ? 30 : 22}px)`,
          }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 0.7, scale: 1 }}
          transition={{ delay: 0.1 * i }}
        />
      ))}
    </div>
  )
}
