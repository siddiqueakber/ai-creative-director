'use client'

import { motion } from 'framer-motion'

export function AnimatedDivider() {
  return (
    <div className="relative h-px my-8 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-transparent 
                      via-[var(--sage-300)] dark:via-[var(--sage-700)] to-transparent opacity-30" />
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent 
                   via-[var(--sage-500)] to-transparent w-1/3"
        animate={{
          x: ['-100%', '300%'],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "linear",
          repeatDelay: 1
        }}
      />
    </div>
  )
}
