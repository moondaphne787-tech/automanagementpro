import { useState, useCallback } from 'react'
import { Dialog, DialogContent, DialogTitle } from './dialog'
import { Button } from './button'
import { AlertTriangle, Info, CheckCircle, XCircle } from 'lucide-react'

export type ConfirmVariant = 'default' | 'danger' | 'warning' | 'info'

interface ConfirmOptions {
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: ConfirmVariant
}

interface ConfirmDialogState extends ConfirmOptions {
  open: boolean
  resolve: ((value: boolean) => void) | null
}

// 全局状态管理
let confirmDialogState: ConfirmDialogState = {
  open: false,
  message: '',
  resolve: null
}

let setConfirmDialogState: ((state: ConfirmDialogState) => void) | null = null

// 全局confirm函数
export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    const newState: ConfirmDialogState = {
      ...options,
      open: true,
      resolve,
      title: options.title || '确认操作',
      confirmText: options.confirmText || '确定',
      cancelText: options.cancelText || '取消',
      variant: options.variant || 'default'
    }
    if (setConfirmDialogState) {
      setConfirmDialogState(newState)
    } else {
      // 如果组件还没挂载，fallback到原生confirm
      resolve(confirm(options.message))
    }
  })
}

// 便捷方法
export const confirmDelete = (itemName: string, warning?: string): Promise<boolean> => {
  return confirmDialog({
    title: '确认删除',
    message: warning || `确定要删除${itemName}吗？此操作不可恢复。`,
    confirmText: '删除',
    cancelText: '取消',
    variant: 'danger'
  })
}

export const confirmAction = (message: string, title?: string): Promise<boolean> => {
  return confirmDialog({
    title: title || '确认操作',
    message,
    variant: 'warning'
  })
}

// ConfirmDialog组件
export function ConfirmDialog() {
  const [state, setState] = useState<ConfirmDialogState>({
    open: false,
    message: '',
    resolve: null,
    title: '确认操作',
    confirmText: '确定',
    cancelText: '取消',
    variant: 'default'
  })

  // 注册全局状态更新函数
  if (!setConfirmDialogState) {
    setConfirmDialogState = setState
  }

  const handleConfirm = useCallback(() => {
    state.resolve?.(true)
    setState(prev => ({ ...prev, open: false, resolve: null }))
  }, [state])

  const handleCancel = useCallback(() => {
    state.resolve?.(false)
    setState(prev => ({ ...prev, open: false, resolve: null }))
  }, [state])

  const getIcon = () => {
    switch (state.variant) {
      case 'danger':
        return <XCircle className="w-6 h-6 text-destructive" />
      case 'warning':
        return <AlertTriangle className="w-6 h-6 text-yellow-500" />
      case 'info':
        return <Info className="w-6 h-6 text-blue-500" />
      default:
        return <CheckCircle className="w-6 h-6 text-primary" />
    }
  }

  const getConfirmButtonVariant = () => {
    switch (state.variant) {
      case 'danger':
        return 'destructive' as const
      default:
        return 'default' as const
    }
  }

  return (
    <Dialog open={state.open} onOpenChange={(open) => !open && handleCancel()}>
      <DialogContent className="sm:max-w-sm">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 mt-0.5">
            {getIcon()}
          </div>
          <div className="flex-1">
            <DialogTitle className="text-lg font-semibold mb-2">{state.title}</DialogTitle>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {state.message}
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={handleCancel}>
            {state.cancelText}
          </Button>
          <Button variant={getConfirmButtonVariant()} onClick={handleConfirm}>
            {state.confirmText}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}