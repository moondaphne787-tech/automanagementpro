import { useState, useEffect } from 'react'
import { Button } from './button'
import { Input } from './input'

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