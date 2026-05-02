import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { DAY_LABELS } from '@/types'
import { getDayOfWeek } from '@/lib/utils'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import { studentSchedulePreferenceDb, scheduledClassDb } from '@/db'
import { generateId } from '@/db/utils'
import { formatDateISO } from '@/lib/utils'
import type { Student, Billing, StudentSchedulePreference, DayOfWeek, ScheduledClass } from '@/types'
import type { ScheduleDateConfig, ScheduleItem } from '../types'

// ─── Add Date Dialog ─────────────────────────────────────────────

interface NewDateForm {
  date: string
  type: ScheduleDateConfig['type']
  label: string
  timeStart: string
  timeEnd: string
}

const INITIAL_DATE_FORM: NewDateForm = {
  date: '',
  type: 'custom',
  label: '',
  timeStart: '08:00',
  timeEnd: '18:00'
}

export function useAddDateDialog() {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<NewDateForm>(INITIAL_DATE_FORM)

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

  const reset = useCallback(() => setForm({ ...INITIAL_DATE_FORM }), [])

  return { open, setOpen, form, setForm, buildDateConfig, reset }
}

// ─── Cancel Dialog ───────────────────────────────────────────────

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

  return { open, setOpen, cancelReason, setCancelReason, cancellingClass, init, onCancel }
}

// ─── Class Dialog ────────────────────────────────────────────────

interface ClassForm {
  student_id: string
  teacher_id: string
  schedules: ScheduleItem[]
  notes: string
}

const INITIAL_CLASS_FORM: ClassForm = {
  student_id: '',
  teacher_id: '',
  schedules: [],
  notes: ''
}

export function useClassDialog(scheduleDates: ScheduleDateConfig[], loadData: () => void) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<ClassForm>(INITIAL_CLASS_FORM)
  const [editingClass, setEditingClass] = useState<ScheduledClass | null>(null)
  const [saving, setSaving] = useState(false)

  const initForCreate = useCallback((date?: string, time?: string) => {
    const initialSchedule: ScheduleItem = {
      id: generateId(),
      date: date || scheduleDates[0]?.date || formatDateISO(new Date()),
      start_time: time || '09:00',
      end_time: time
        ? `${(parseInt(time.split(':')[0]) + 2).toString().padStart(2, '0')}:${time.split(':')[1]}`
        : '11:00',
      duration_hours: 2
    }
    setForm({ student_id: '', teacher_id: '', schedules: [initialSchedule], notes: '' })
    setEditingClass(null)
  }, [scheduleDates])

  const initForEdit = useCallback((cls: ScheduledClass) => {
    setForm({
      student_id: cls.student_id,
      teacher_id: cls.teacher_id || '',
      schedules: [{
        id: generateId(),
        date: cls.class_date,
        start_time: cls.start_time || '09:00',
        end_time: cls.end_time || '11:00',
        duration_hours: cls.duration_hours
      }],
      notes: cls.notes || ''
    })
    setEditingClass(cls)
  }, [])

  const handleSave = useCallback(async () => {
    if (!form.student_id) { toast.error('请选择学员'); return false }
    if (form.schedules.length === 0) { toast.error('请添加排课项'); return false }
    if (form.schedules.find(s => !s.date)) { toast.error('请为所有排课项设置日期'); return false }

    try {
      setSaving(true)
      if (editingClass) {
        const schedule = form.schedules[0]
        if (form.teacher_id) {
          const conflict = await scheduledClassDb.checkConflict(form.teacher_id, schedule.date, schedule.start_time, schedule.end_time, editingClass.id)
          if (conflict) {
            toast.error(`时段冲突：该助教在 ${schedule.date} ${schedule.start_time}-${schedule.end_time} 已有课程安排`)
            return false
          }
        }
        await scheduledClassDb.update(editingClass.id, {
          student_id: form.student_id,
          teacher_id: form.teacher_id || null,
          class_date: schedule.date,
          start_time: schedule.start_time,
          end_time: schedule.end_time,
          duration_hours: schedule.duration_hours,
          notes: form.notes || null
        })
      } else {
        if (form.teacher_id) {
          for (const schedule of form.schedules) {
            const conflict = await scheduledClassDb.checkConflict(form.teacher_id, schedule.date, schedule.start_time, schedule.end_time)
            if (conflict) {
              toast.error(`时段冲突：该助教在 ${schedule.date} ${schedule.start_time}-${schedule.end_time} 已有课程安排`)
              return false
            }
          }
        }
        const results = await scheduledClassDb.batchCreate(
          form.schedules.map(s => ({
            student_id: form.student_id,
            teacher_id: form.teacher_id || undefined,
            class_date: s.date,
            start_time: s.start_time,
            end_time: s.end_time,
            duration_hours: s.duration_hours,
            notes: form.notes || undefined
          }))
        )
        if (results.failed > 0) {
          toast.warning(`排课完成：成功 ${results.success} 条，失败 ${results.failed} 条`)
        } else {
          toast.success(`排课成功：${results.success} 条`)
        }
      }
      setOpen(false)
      loadData()
      return true
    } catch (error) {
      console.error('Failed to save class:', error)
      toast.error('保存失败，请重试')
      return false
    } finally {
      setSaving(false)
    }
  }, [form, editingClass, loadData])

  const handleDelete = useCallback(async (cls: ScheduledClass) => {
    const confirmed = await confirmDialog({
      title: '删除课程',
      message: '确定要删除这节课程吗？',
      confirmText: '删除',
      variant: 'danger'
    })
    if (!confirmed) return false
    try {
      await scheduledClassDb.delete(cls.id)
      loadData()
      toast.success('课程已删除')
      return true
    } catch (error) {
      console.error('Failed to delete class:', error)
      toast.error('删除失败，请重试')
      return false
    }
  }, [loadData])

  const onSave = useCallback(async () => { await handleSave() }, [handleSave])

  return { open, setOpen, form, setForm, editingClass, setEditingClass, saving, initForCreate, initForEdit, onSave, handleDelete }
}

// ─── Preference Dialog ───────────────────────────────────────────

type StudentWithPrefs = Student & { billing: Billing | null; preferences: StudentSchedulePreference[] }

interface PreferenceForm {
  day_of_week: DayOfWeek
  preferred_start: string
  preferred_end: string
  notes: string
}

const INITIAL_PREF_FORM: PreferenceForm = {
  day_of_week: 'saturday',
  preferred_start: '09:00',
  preferred_end: '11:00',
  notes: ''
}

export function usePreferenceDialog(loadData: () => void) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<PreferenceForm>(INITIAL_PREF_FORM)
  const [selectedStudent, setSelectedStudent] = useState<StudentWithPrefs | null>(null)

  const init = useCallback((student: StudentWithPrefs) => {
    setForm({ ...INITIAL_PREF_FORM })
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

  return { open, setOpen, form, setForm, selectedStudent, init, onAdd, onDelete }
}

// ─── Reschedule Dialog ───────────────────────────────────────────

interface RescheduleForm {
  class_date: string
  start_time: string
  end_time: string
}

export function useRescheduleDialog(loadData: () => void) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<RescheduleForm>({ class_date: '', start_time: '', end_time: '' })
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
      await scheduledClassDb.reschedule(reschedulingClass.id, form.class_date, form.start_time, form.end_time)
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

  return { open, setOpen, form, setForm, reschedulingClass, init, onReschedule }
}
