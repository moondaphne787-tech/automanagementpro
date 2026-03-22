import { useState, useEffect, ReactNode } from 'react'
import { Button } from './button'
import { Input } from './input'
import { motion, AnimatePresence } from 'framer-motion'

// 通用Dialog组件
interface DialogProps {
  open: boolean
  onOpenChange?: (open: boolean) => void
  children: ReactNode
}

export function Dialog({ open, onOpenChange, children }: DialogProps) {
  // ESC键关闭
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onOpenChange?.(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onOpenChange])

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50"
            onClick={() => onOpenChange?.(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="relative bg-card rounded-lg shadow-lg w-full max-w-lg mx-4 max-h-[90vh] overflow-auto"
          >
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

export function DialogHeader({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col space-y-1.5 p-6 pb-0 ${className}`}>
      {children}
    </div>
  )
}

export function DialogTitle({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <h3 className={`text-lg font-semibold leading-none tracking-tight ${className}`}>
      {children}
    </h3>
  )
}

export function DialogContent({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`p-6 ${className}`}>
      {children}
    </div>
  )
}

export function DialogFooter({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`flex items-center justify-end gap-2 p-6 pt-0 ${className}`}>
      {children}
    </div>
  )
}

// PromptDialog组件（保留原有功能）
interface PromptDialogProps {
  open: boolean
  title: string
  label?: string
  defaultValue?: string
  onConfirm: (value: string) => void
  onCancel: () => void
}

export function PromptDialog({ open, title, label, defaultValue = '', onConfirm, onCancel }: PromptDialogProps) {
  const [value, setValue] = useState(defaultValue)

  useEffect(() => {
    if (open) {
      setValue(defaultValue)
    }
  }, [open, defaultValue])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onCancel} />
      <div className="relative bg-card rounded-lg shadow-lg p-6 w-full max-w-sm mx-4">
        <h3 className="text-lg font-semibold mb-4">{title}</h3>
        {label && <label className="text-sm text-muted-foreground mb-2 block">{label}</label>}
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              onConfirm(value)
            } else if (e.key === 'Escape') {
              onCancel()
            }
          }}
          autoFocus
        />
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onCancel}>取消</Button>
          <Button onClick={() => onConfirm(value)}>确定</Button>
        </div>
      </div>
    </div>
  )
}

// Hook for easier usage
export function usePrompt() {
  const [state, setState] = useState<{
    open: boolean
    title: string
    defaultValue: string
    resolve: ((value: string | null) => void) | null
  }>({
    open: false,
    title: '',
    defaultValue: '',
    resolve: null
  })

  const prompt = (title: string, defaultValue: string = ''): Promise<string | null> => {
    return new Promise((resolve) => {
      setState({
        open: true,
        title,
        defaultValue,
        resolve
      })
    })
  }

  const handleConfirm = (value: string) => {
    state.resolve?.(value)
    setState(prev => ({ ...prev, open: false, resolve: null }))
  }

  const handleCancel = () => {
    state.resolve?.(null)
    setState(prev => ({ ...prev, open: false, resolve: null }))
  }

  return {
    prompt,
    dialogProps: {
      open: state.open,
      title: state.title,
      defaultValue: state.defaultValue,
      onConfirm: handleConfirm,
      onCancel: handleCancel
    }
  }
}