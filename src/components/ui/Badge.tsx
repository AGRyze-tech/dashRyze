'use client'
import { cn } from '@/lib/utils'

type BadgeColor = 'green' | 'yellow' | 'red' | 'gray' | 'blue' | 'purple'

interface BadgeProps {
  color?: BadgeColor
  children: React.ReactNode
  dot?: boolean
  className?: string
}

const colorMap: Record<BadgeColor, string> = {
  green: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  yellow: 'bg-amber-50 text-amber-700 border border-amber-200',
  red: 'bg-red-50 text-red-600 border border-red-200',
  gray: 'bg-gray-100 text-gray-600 border border-gray-200',
  blue: 'bg-blue-50 text-blue-700 border border-blue-200',
  purple: 'bg-purple-50 text-purple-700 border border-purple-200',
}

const dotColorMap: Record<BadgeColor, string> = {
  green: 'bg-emerald-500',
  yellow: 'bg-amber-500',
  red: 'bg-red-500',
  gray: 'bg-gray-400',
  blue: 'bg-blue-500',
  purple: 'bg-purple-500',
}

export function Badge({ color = 'gray', children, dot = true, className }: BadgeProps) {
  return (
    <span className={cn('badge', colorMap[color], className)}>
      {dot && <span className={cn('w-1.5 h-1.5 rounded-full', dotColorMap[color])} />}
      {children}
    </span>
  )
}
