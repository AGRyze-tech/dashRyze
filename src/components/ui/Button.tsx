'use client'
import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  children: React.ReactNode
}

const variantMap = {
  primary: 'bg-gradient-to-b from-[#4DA37A] to-[#32B86A] hover:from-[#32B86A] hover:to-[#1A5C35] text-white shadow-sm shadow-[#32B86A]/20 active:scale-[0.98]',
  secondary: 'bg-[#0F3A20] hover:bg-[#1A5C35] text-[#95D5B2] hover:text-white',
  ghost: 'bg-transparent hover:bg-gray-100 dark:hover:bg-[#2a2a2a] text-gray-600 dark:text-[#3E9E60] hover:text-gray-900 dark:hover:text-[#F8FBF9]',
  danger: 'bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800',
  outline: 'bg-white dark:bg-transparent hover:bg-gray-50 dark:hover:bg-[#2a2a2a] text-gray-700 dark:text-[#A7C4AF] border border-gray-200 dark:border-[#333333] shadow-sm',
}

const sizeMap = {
  sm: 'px-3 py-1.5 text-sm gap-1.5',
  md: 'px-4 py-2 text-sm gap-2',
  lg: 'px-5 py-2.5 text-base gap-2.5',
}

export function Button({ variant = 'primary', size = 'md', loading, children, className, disabled, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-150 disabled:opacity-50 disabled:pointer-events-none cursor-pointer',
        variantMap[variant],
        sizeMap[size],
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="animate-spin" size={14} />}
      {children}
    </button>
  )
}
