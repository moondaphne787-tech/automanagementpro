import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import { scheduledClassDb } from '@/db'
import { generateId } from '@/db/utils'
import { formatDateISO } from '@/lib/utils'
import type { ScheduledClass } from '@/types'
import type { ScheduleDateConfig } from '@/ai/schedulePrompts'
import { type ScheduleItem } from '../types'

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

export function useClassDialog(
  scheduleDates: ScheduleDateConfig[],
  loadData: () => void
) {
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
    setForm({
      student_id: '',
      teacher_id: '',
      schedules: [initialSchedule],
      notes: ''
    })
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
    if (!form.student_id) {
      toast.error('请选择学员')
      return false
    }
    if (form.schedules.length === 0) {
      toast.error('请添加排课项')
      return false
    }
    if (form.schedules.find(s => !s.date)) {
      toast.error('请为所有排课项设置日期')
      return false
    }

    try {
      setSaving(true)

      if (editingClass) {
        const schedule = form.schedules[0]
        if (form.teacher_id) {
          const conflict = await scheduledClassDb.checkConflict(
            form.teacher_id, schedule.date, schedule.start_time, schedule.end_time, editingClass.id
          )
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
            const conflict = await scheduledClassDb.checkConflict(
              form.teacher_id, schedule.date, schedule.start_time, schedule.end_time
            )
            if (conflict) {
              toast.error(`时段冲突：该助教在 ${schedule.date} ${schedule.start_time}-${schedule.end_time} 已有课程安排`)
              return false
            }
          }
        }
        const results = await scheduledClassDb.batchCreate(
          form.schedules.map(schedule => ({
            student_id: form.student_id,
            teacher_id: form.teacher_id || undefined,
            class_date: schedule.date,
            start_time: schedule.start_time,
            end_time: schedule.end_time,
            duration_hours: schedule.duration_hours,
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

  return {
    open,
    setOpen,
    form,
    setForm,
    editingClass,
    setEditingClass,
    saving,
    initForCreate,
    initForEdit,
    onSave,
    handleDelete
  }
}
