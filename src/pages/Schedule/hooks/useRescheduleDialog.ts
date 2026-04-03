import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { scheduledClassDb } from '@/db'
import type { ScheduledClass } from '@/types'

interface RescheduleForm {
  class_date: string
  start_time: string
  end_time: string
}

export function useRescheduleDialog(loadData: () => void) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<RescheduleForm>({
    class_date: '',
    start_time: '',
    end_time: ''
  })
  const [reschedulingClass, setReschedulingClass] = useState<ScheduledClass | null>(null)

  const init = useCallback((cls: ScheduledClass) => {
    setForm({
      class_date: cls.class_date,
      start_time: cls.start_time || '09:00',
      end_time: cls.end_time || '11:00'
    })
    setReschedulingClass(cls)
  }, [])

  const handleReschedule = useCallback(async () => {
    if (!reschedulingClass) return false

    try {
      await scheduledClassDb.reschedule(
        reschedulingClass.id,
        form.class_date,
        form.start_time,
        form.end_time
      )
      setOpen(false)
      setReschedulingClass(null)
      loadData()
      toast.success('调课成功')
      return true
    } catch (error) {
      console.error('Failed to reschedule:', error)
      toast.error('调课失败，请重试')
      return false
    }
  }, [reschedulingClass, form, loadData])

  const onReschedule = useCallback(async () => { await handleReschedule() }, [handleReschedule])

  return {
    open,
    setOpen,
    form,
    setForm,
    reschedulingClass,
    init,
    onReschedule
  }
}
