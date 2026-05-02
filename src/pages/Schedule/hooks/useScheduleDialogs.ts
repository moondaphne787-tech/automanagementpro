import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import { scheduledClassDb } from '@/db'
import { formatDateISO } from '@/lib/utils'
import type { ScheduledClass } from '@/types'

interface ClassForm {
  student_id: string
  teacher_id: string
  class_date: string
  start_time: string
  end_time: string
  notes: string
}

const INITIAL_CLASS_FORM: ClassForm = {
  student_id: '',
  teacher_id: '',
  class_date: '',
  start_time: '09:00',
  end_time: '11:00',
  notes: ''
}

function calcEndTime(startTime: string): string {
  const [hours] = startTime.split(':').map(Number)
  return `${(hours + 2).toString().padStart(2, '0')}:00`
}

export function useClassDialog(loadData: () => void) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<ClassForm>(INITIAL_CLASS_FORM)
  const [editingClass, setEditingClass] = useState<ScheduledClass | null>(null)
  const [saving, setSaving] = useState(false)

  const initForCreate = useCallback((date?: string, time?: string) => {
    const startTime = time || '09:00'
    setForm({
      student_id: '',
      teacher_id: '',
      class_date: date || formatDateISO(new Date()),
      start_time: startTime,
      end_time: calcEndTime(startTime),
      notes: ''
    })
    setEditingClass(null)
  }, [])

  const initForEdit = useCallback((cls: ScheduledClass) => {
    setForm({
      student_id: cls.student_id,
      teacher_id: cls.teacher_id || '',
      class_date: cls.class_date,
      start_time: cls.start_time || '09:00',
      end_time: cls.end_time || '11:00',
      notes: cls.notes || ''
    })
    setEditingClass(cls)
  }, [])

  const handleSave = useCallback(async () => {
    if (!form.student_id) { toast.error('请选择学员'); return false }
    if (!form.class_date) { toast.error('请选择日期'); return false }
    if (!form.start_time || !form.end_time) { toast.error('请设置时间'); return false }

    try {
      setSaving(true)
      if (editingClass) {
        if (form.teacher_id) {
          const conflict = await scheduledClassDb.checkConflict(
            form.teacher_id, form.class_date, form.start_time, form.end_time, editingClass.id
          )
          if (conflict) {
            toast.error(`时段冲突：该助教在 ${form.class_date} ${form.start_time}-${form.end_time} 已有课程安排`)
            return false
          }
        }
        await scheduledClassDb.update(editingClass.id, {
          student_id: form.student_id,
          teacher_id: form.teacher_id || null,
          class_date: form.class_date,
          start_time: form.start_time,
          end_time: form.end_time,
          notes: form.notes || null
        })
        toast.success('课程已更新')
      } else {
        if (form.teacher_id) {
          const conflict = await scheduledClassDb.checkConflict(
            form.teacher_id, form.class_date, form.start_time, form.end_time
          )
          if (conflict) {
            toast.error(`时段冲突：该助教在 ${form.class_date} ${form.start_time}-${form.end_time} 已有课程安排`)
            return false
          }
        }
        await scheduledClassDb.create({
          student_id: form.student_id,
          teacher_id: form.teacher_id || undefined,
          class_date: form.class_date,
          start_time: form.start_time,
          end_time: form.end_time,
          notes: form.notes || undefined
        })
        toast.success('排课成功')
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

  return { open, setOpen, form, setForm, editingClass, saving, initForCreate, initForEdit, onSave, handleDelete }
}
