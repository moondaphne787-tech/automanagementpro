import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'

interface TooltipProps {
  content: string
  side?: 'top' | 'right' | 'bottom' | 'left'
  children: React.ReactElement
  className?: string
  disabled?: boolean
}

export function Tooltip({ content, side = 'right', children, className, disabled }: TooltipProps) {
  const [visible, setVisible] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>()

  const show = () => {
    if (disabled) return
    timeoutRef.current = setTimeout(() => setVisible(true), 150)
  }

  const hide = () => {
    clearTimeout(timeoutRef.current)
    setVisible(false)
  }

  useEffect(() => () => clearTimeout(timeoutRef.current), [])

  const positionClass = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-1.5',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-1.5',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
  }[side]

  return (
    <div className="relative inline-flex" onMouseEnter={show} onMouseLeave={hide}>
      {children}
      {visible && (
        <div className={cn(
          "absolute z-50 px-2.5 py-1 text-xs font-medium rounded-md shadow-md whitespace-nowrap pointer-events-none",
          "bg-foreground text-background",
          positionClass,
          className
        )}>
          {content}
        </div>
      )}
    </div>
  )
}
