import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { studentSchedulePreferenceDb } from '@/db'
import type { Student, Billing, StudentSchedulePreference, DayOfWeek } from '@/types'

type StudentWithPrefs = Student & { billing: Billing | null; preferences: StudentSchedulePreference[] }

interface PreferenceForm {
  day_of_week: DayOfWeek
  preferred_start: string
  preferred_end: string
  notes: string
}

const INITIAL_FORM: PreferenceForm = {
  day_of_week: 'saturday',
  preferred_start: '09:00',
  preferred_end: '11:00',
  notes: ''
}

export function usePreferenceDialog(loadData: () => void) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<PreferenceForm>(INITIAL_FORM)
  const [selectedStudent, setSelectedStudent] = useState<StudentWithPrefs | null>(null)

  const init = useCallback((student: StudentWithPrefs) => {
    setForm({ ...INITIAL_FORM })
    setSelectedStudent(student)
  }, [])

  const handleAdd = useCallback(async () => {
    if (!selectedStudent) return false

    try {
      await studentSchedulePreferenceDb.create({
        student_id: selectedStudent.id,
        day_of_week: form.day_of_week,
        preferred_start: form.preferred_start,
        preferred_end: form.preferred_end,
        notes: form.notes || undefined
      })

      const prefs = await studentSchedulePreferenceDb.getByStudentId(selectedStudent.id)
      setSelectedStudent({ ...selectedStudent, preferences: prefs })
      loadData()
      toast.success('时段偏好已添加')
      return true
    } catch (error) {
      console.error('Failed to add preference:', error)
      toast.error('添加失败，请重试')
      return false
    }
  }, [selectedStudent, form, loadData])

  const handleDelete = useCallback(async (prefId: string) => {
    if (!selectedStudent) return false

    try {
      await studentSchedulePreferenceDb.delete(prefId)
      const prefs = await studentSchedulePreferenceDb.getByStudentId(selectedStudent.id)
      setSelectedStudent({ ...selectedStudent, preferences: prefs })
      loadData()
      toast.success('时段偏好已删除')
      return true
    } catch (error) {
      console.error('Failed to delete preference:', error)
      toast.error('删除失败，请重试')
      return false
    }
  }, [selectedStudent, loadData])

  const onAdd = useCallback(async () => { await handleAdd() }, [handleAdd])
  const onDelete = useCallback(async (prefId: string) => { await handleDelete(prefId) }, [handleDelete])

  return {
    open,
    setOpen,
    form,
    setForm,
    selectedStudent,
    init,
    onAdd,
    onDelete
  }
}
