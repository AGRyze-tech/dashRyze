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
  primary: 'bg-[#40916C] hover:bg-[#2D6A4F] text-white shadow-sm hover:shadow-green-md active:scale-[0.98]',
  secondary: 'bg-[#1B4332] hover:bg-[#2D6A4F] text-[#95D5B2] hover:text-white',
  ghost: 'bg-transparent hover:bg-gray-100 text-gray-600 hover:text-gray-900',
  danger: 'bg-red-50 hover:bg-red-100 text-red-600 border border-red-200',
  outline: 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 shadow-sm',
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
