import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { studentSchedulePreferenceDb } from '@/db'
import type { DayOfWeek } from '@/types'

interface BatchPrefForm {
  day_of_week: DayOfWeek
  preferred_start: string
  preferred_end: string
  notes: string
  grade_filter: string
}

const INITIAL_FORM: BatchPrefForm = {
  day_of_week: 'saturday',
  preferred_start: '09:00',
  preferred_end: '11:00',
  notes: '',
  grade_filter: 'all'
}

export function useBatchPrefDialog(onSuccess: () => void) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<BatchPrefForm>(INITIAL_FORM)
  const [selectedStudents, setSelectedStudents] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  const handleSave = useCallback(async () => {
    if (selectedStudents.length === 0) {
      toast.error('请至少选择一名学生')
      return false
    }

    setSaving(true)
    try {
      const result = await studentSchedulePreferenceDb.batchCreateIfNotExists(
        selectedStudents.map(studentId => ({
          student_id: studentId,
          day_of_week: form.day_of_week,
          preferred_start: form.preferred_start,
          preferred_end: form.preferred_end,
          notes: form.notes || undefined
        }))
      )

      setOpen(false)
      setSelectedStudents([])
      onSuccess()

      if (result.skipped > 0) {
        toast.success(`已为 ${result.success} 名学生添加时段偏好，${result.skipped} 名学生已有相同偏好已跳过`)
      } else {
        toast.success(`已为 ${result.success} 名学生添加时段偏好`)
      }

      if (result.failed > 0) {
        toast.error(`${result.failed} 名学生保存失败`)
      }

      return true
    } catch (error) {
      toast.error('批量设置失败：' + (error as Error).message)
      return false
    } finally {
      setSaving(false)
    }
  }, [selectedStudents, form, onSuccess])

  const onSave = useCallback(async () => { await handleSave() }, [handleSave])

  return {
    open,
    setOpen,
    form,
    setForm,
    selectedStudents,
    setSelectedStudents,
    saving,
    onSave
  }
}
