import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { DAY_LABELS } from '@/types'
import { getDayOfWeek } from '@/lib/utils'
import type { ScheduleDateConfig } from '@/ai/schedulePrompts'

interface NewDateForm {
  date: string
  type: ScheduleDateConfig['type']
  label: string
  timeStart: string
  timeEnd: string
}

const INITIAL_FORM: NewDateForm = {
  date: '',
  type: 'custom',
  label: '',
  timeStart: '08:00',
  timeEnd: '18:00'
}

export function useAddDateDialog() {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<NewDateForm>(INITIAL_FORM)

  const buildDateConfig = useCallback(() => {
    if (!form.date) {
      toast.error('请选择日期')
      return null
    }

    const dayOfWeek = getDayOfWeek(form.date)
    const label = form.label || `${DAY_LABELS[dayOfWeek]}${form.type === 'holiday' ? '（假期）' : ''}`

    return {
      date: form.date,
      type: form.type,
      label,
      timeRange: form.type === 'friday_evening'
        ? { start: '18:00', end: '21:00' }
        : { start: form.timeStart, end: form.timeEnd }
    }
  }, [form])

  const reset = useCallback(() => {
    setForm({ ...INITIAL_FORM })
  }, [])

  return {
    open,
    setOpen,
    form,
    setForm,
    buildDateConfig,
    reset
  }
}
