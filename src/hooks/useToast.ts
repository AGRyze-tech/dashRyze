import { useState, useEffect } from 'react'

export function useToast(duration = 3500) {
  const [toast, setToast] = useState('')

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), duration)
    return () => clearTimeout(t)
  }, [toast, duration])

  return { toast, showToast: setToast }
}
