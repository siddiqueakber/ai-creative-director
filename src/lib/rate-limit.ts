import { prisma } from '@/lib/db'

const DAILY_LIMIT_FREE = 3
const DAILY_LIMIT_AUTHENTICATED = 10

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  limit: number
  resetAt: Date
}

export async function checkRateLimit(userId?: string): Promise<RateLimitResult> {
  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000)

  if (!userId) {
    // For anonymous users, we can't track server-side
    // Rate limiting would need to be done via cookies or IP
    return {
      allowed: true,
      remaining: DAILY_LIMIT_FREE,
      limit: DAILY_LIMIT_FREE,
      resetAt: endOfDay,
    }
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      dailyUseCount: true,
      lastUseDate: true,
    }
  })

  if (!user) {
    return {
      allowed: true,
      remaining: DAILY_LIMIT_AUTHENTICATED,
      limit: DAILY_LIMIT_AUTHENTICATED,
      resetAt: endOfDay,
    }
  }

  // Reset count if last use was before today
  const lastUseDate = user.lastUseDate ? new Date(user.lastUseDate) : null
  const isNewDay = !lastUseDate || lastUseDate < startOfDay

  const currentCount = isNewDay ? 0 : user.dailyUseCount
  const limit = DAILY_LIMIT_AUTHENTICATED
  const remaining = Math.max(0, limit - currentCount)

  // Reset count if it's a new day
  if (isNewDay && user.dailyUseCount > 0) {
    await prisma.user.update({
      where: { id: userId },
      data: { dailyUseCount: 0 }
    })
  }

  return {
    allowed: currentCount < limit,
    remaining,
    limit,
    resetAt: endOfDay,
  }
}

export async function incrementUsage(userId: string): Promise<void> {
  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { lastUseDate: true }
  })

  const lastUseDate = user?.lastUseDate ? new Date(user.lastUseDate) : null
  const isNewDay = !lastUseDate || lastUseDate < startOfDay

  await prisma.user.update({
    where: { id: userId },
    data: {
      dailyUseCount: isNewDay ? 1 : { increment: 1 },
      lastUseDate: now,
    }
  })
}

export function formatTimeUntilReset(resetAt: Date): string {
  const now = new Date()
  const diff = resetAt.getTime() - now.getTime()
  
  if (diff <= 0) return 'now'
  
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  return `${minutes}m`
}
