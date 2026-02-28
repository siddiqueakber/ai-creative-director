'use client'

import { motion } from 'framer-motion'

interface SectionIconProps {
  type: 'prompt' | 'angle' | 'outline' | 'reflection'
  delay?: number
}

export function SectionIcon({ type, delay = 0 }: SectionIconProps) {
  const icons = {
    prompt: (
      <svg className="w-full h-full" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <motion.path
          d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1.2, delay, ease: "easeOut" }}
        />
      </svg>
    ),
    angle: (
      <svg className="w-full h-full" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <motion.circle
          cx="12"
          cy="12"
          r="10"
          strokeWidth="2"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1, delay, ease: "easeOut" }}
        />
        <motion.path
          d="M12 2L12 12L19 16"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1, delay: delay + 0.3, ease: "easeOut" }}
        />
      </svg>
    ),
    outline: (
      <svg className="w-full h-full" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <motion.path
          d="M12 2v4m0 12v4M5 12h14"
          strokeWidth="2"
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1, delay, ease: "easeOut" }}
        />
        <motion.path
          d="M12 6L8 10M12 6L16 10M12 18L8 14M12 18L16 14"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1, delay: delay + 0.2, ease: "easeOut" }}
        />
      </svg>
    ),
    reflection: (
      <svg className="w-full h-full" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <motion.circle
          cx="12"
          cy="12"
          r="3"
          strokeWidth="2"
          initial={{ pathLength: 0, scale: 0, opacity: 0 }}
          animate={{ pathLength: 1, scale: 1, opacity: 1 }}
          transition={{ duration: 0.8, delay, ease: "easeOut" }}
        />
        <motion.circle
          cx="12"
          cy="12"
          r="6"
          strokeWidth="2"
          opacity="0.6"
          initial={{ pathLength: 0, scale: 0, opacity: 0 }}
          animate={{ pathLength: 1, scale: 1, opacity: 0.6 }}
          transition={{ duration: 1, delay: delay + 0.2, ease: "easeOut" }}
        />
        <motion.circle
          cx="12"
          cy="12"
          r="9"
          strokeWidth="2"
          opacity="0.3"
          initial={{ pathLength: 0, scale: 0, opacity: 0 }}
          animate={{ pathLength: 1, scale: 1, opacity: 0.3 }}
          transition={{ duration: 1.2, delay: delay + 0.4, ease: "easeOut" }}
        />
      </svg>
    ),
  }

  return (
    <motion.div
      initial={{ scale: 0, rotate: -180 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ 
        type: "spring",
        stiffness: 200,
        damping: 15,
        delay 
      }}
      className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[var(--sage-100)] to-[var(--sage-200)] 
                 dark:from-[var(--sage-800)] dark:to-[var(--sage-900)] 
                 p-2 shadow-lg flex items-center justify-center
                 text-[var(--sage-600)] dark:text-[var(--sage-400)]"
    >
      {icons[type]}
    </motion.div>
  )
}
