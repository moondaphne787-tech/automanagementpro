import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { scheduledClassDb } from '@/db'
import type { ScheduledClass } from '@/types'

export function useCancelDialog(loadData: () => void) {
  const [open, setOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [cancellingClass, setCancellingClass] = useState<ScheduledClass | null>(null)

  const init = useCallback((cls: ScheduledClass) => {
    setCancelReason('')
    setCancellingClass(cls)
  }, [])

  const handleCancel = useCallback(async () => {
    if (!cancellingClass) return false

    try {
      await scheduledClassDb.cancel(cancellingClass.id, cancelReason || undefined)
      setOpen(false)
      setCancellingClass(null)
      loadData()
      toast.success('课程已取消')
      return true
    } catch (error) {
      console.error('Failed to cancel class:', error)
      toast.error('取消失败，请重试')
      return false
    }
  }, [cancellingClass, cancelReason, loadData])

  const onCancel = useCallback(async () => { await handleCancel() }, [handleCancel])

  return {
    open,
    setOpen,
    cancelReason,
    setCancelReason,
    cancellingClass,
    init,
    onCancel
  }
}
