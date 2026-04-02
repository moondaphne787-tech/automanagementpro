import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import { scheduledClassDb, studentSchedulePreferenceDb } from '@/db'
import { generateId } from '@/db/utils'
import type { ScheduledClass, DayOfWeek, Student, Billing, StudentSchedulePreference } from '@/types'
import { DAY_LABELS } from '@/types'
import { formatDateISO, getDayOfWeek } from '@/lib/utils'
import { type ScheduleItem } from '../types'
import type { ScheduleDateConfig } from '@/ai/schedulePrompts'

type StudentWithPrefs = Student & { billing: Billing | null; preferences: StudentSchedulePreference[] }

interface DialogStates {
  addDateDialog: boolean
  classDialog: boolean
  rescheduleDialog: boolean
  cancelDialog: boolean
  preferenceDialog: boolean
  batchPrefDialog: boolean
}

interface FormStates {
  newDateForm: {
    date: string
    type: ScheduleDateConfig['type']
    label: string
    timeStart: string
    timeEnd: string
  }
  classForm: {
    student_id: string
    teacher_id: string
    schedules: ScheduleItem[]
    notes: string
  }
  rescheduleForm: {
    class_date: string
    start_time: string
    end_time: string
  }
  cancelReason: string
  preferenceForm: {
    day_of_week: DayOfWeek
    preferred_start: string
    preferred_end: string
    notes: string
  }
  batchPrefForm: {
    day_of_week: DayOfWeek
    preferred_start: string
    preferred_end: string
    notes: string
    grade_filter: string
  }
}

interface EditingStates {
  editingClass: ScheduledClass | null
  reschedulingClass: ScheduledClass | null
  cancellingClass: ScheduledClass | null
  selectedStudent: StudentWithPrefs | null
  batchSelectedStudents: string[]
}

export function useScheduleDialogs(
  scheduleDates: ScheduleDateConfig[],
  students: Student[],
  loadData: () => void
) {
  // 对话框开关状态
  const [dialogs, setDialogs] = useState<DialogStates>({
    addDateDialog: false,
    classDialog: false,
    rescheduleDialog: false,
    cancelDialog: false,
    preferenceDialog: false,
    batchPrefDialog: false
  })

  // 表单状态
  const [forms, setForms] = useState<FormStates>({
    newDateForm: {
      date: '',
      type: 'custom',
      label: '',
      timeStart: '08:00',
      timeEnd: '18:00'
    },
    classForm: {
      student_id: '',
      teacher_id: '',
      schedules: [],
      notes: ''
    },
    rescheduleForm: {
      class_date: '',
      start_time: '',
      end_time: ''
    },
    cancelReason: '',
    preferenceForm: {
      day_of_week: 'saturday',
      preferred_start: '09:00',
      preferred_end: '11:00',
      notes: ''
    },
    batchPrefForm: {
      day_of_week: 'saturday',
      preferred_start: '09:00',
      preferred_end: '11:00',
      notes: '',
      grade_filter: 'all'
    }
  })

  // 编辑状态
  const [editing, setEditing] = useState<EditingStates>({
    editingClass: null,
    reschedulingClass: null,
    cancellingClass: null,
    selectedStudent: null,
    batchSelectedStudents: []
  })

  // 保存状态
  const [saving, setSaving] = useState(false)
  const [batchSaving, setBatchSaving] = useState(false)

  // 对话框开关操作
  const openDialog = useCallback((dialog: keyof DialogStates) => {
    setDialogs(prev => ({ ...prev, [dialog]: true }))
  }, [])

  const closeDialog = useCallback((dialog: keyof DialogStates) => {
    setDialogs(prev => ({ ...prev, [dialog]: false }))
  }, [])

  const setDialogOpen = useCallback((dialog: keyof DialogStates, open: boolean) => {
    setDialogs(prev => ({ ...prev, [dialog]: open }))
  }, [])

  // 表单更新操作 - 提供 setState 风格的函数以匹配 Dialog 组件的接口
  const setNewDateForm = useCallback((action: React.SetStateAction<FormStates['newDateForm']>) => {
    setForms(prev => ({
      ...prev,
      newDateForm: typeof action === 'function' ? action(prev.newDateForm) : action
    }))
  }, [])

  const setClassForm = useCallback((action: React.SetStateAction<FormStates['classForm']>) => {
    setForms(prev => ({
      ...prev,
      classForm: typeof action === 'function' ? action(prev.classForm) : action
    }))
  }, [])

  const setRescheduleForm = useCallback((action: React.SetStateAction<FormStates['rescheduleForm']>) => {
    setForms(prev => ({
      ...prev,
      rescheduleForm: typeof action === 'function' ? action(prev.rescheduleForm) : action
    }))
  }, [])

  const setPreferenceForm = useCallback((action: React.SetStateAction<FormStates['preferenceForm']>) => {
    setForms(prev => ({
      ...prev,
      preferenceForm: typeof action === 'function' ? action(prev.preferenceForm) : action
    }))
  }, [])

  const setBatchPrefForm = useCallback((action: React.SetStateAction<FormStates['batchPrefForm']>) => {
    setForms(prev => ({
      ...prev,
      batchPrefForm: typeof action === 'function' ? action(prev.batchPrefForm) : action
    }))
  }, [])

  const setCancelReason = useCallback((action: React.SetStateAction<string>) => {
    setForms(prev => ({
      ...prev,
      cancelReason: typeof action === 'function' ? action(prev.cancelReason) : action
    }))
  }, [])

  const setBatchSelectedStudents = useCallback((action: React.SetStateAction<string[]>) => {
    setEditing(prev => ({
      ...prev,
      batchSelectedStudents: typeof action === 'function' ? action(prev.batchSelectedStudents) : action
    }))
  }, [])

  // 编辑状态更新
  const setEditingClass = useCallback((cls: ScheduledClass | null) => {
    setEditing(prev => ({ ...prev, editingClass: cls }))
  }, [])

  const setReschedulingClass = useCallback((cls: ScheduledClass | null) => {
    setEditing(prev => ({ ...prev, reschedulingClass: cls }))
  }, [])

  const setCancellingClass = useCallback((cls: ScheduledClass | null) => {
    setEditing(prev => ({ ...prev, cancellingClass: cls }))
  }, [])

  const setSelectedStudent = useCallback((student: StudentWithPrefs | null) => {
    setEditing(prev => ({ ...prev, selectedStudent: student }))
  }, [])

  // 业务操作
  const handleAddCustomDate = useCallback(() => {
    if (!forms.newDateForm.date) {
      toast.error('请选择日期')
      return false
    }

    const dayOfWeek = getDayOfWeek(forms.newDateForm.date)
    const label = forms.newDateForm.label || `${DAY_LABELS[dayOfWeek]}${forms.newDateForm.type === 'holiday' ? '（假期）' : ''}`

    return {
      date: forms.newDateForm.date,
      type: forms.newDateForm.type,
      label,
      timeRange: forms.newDateForm.type === 'friday_evening'
        ? { start: '18:00', end: '21:00' }
        : { start: forms.newDateForm.timeStart, end: forms.newDateForm.timeEnd }
    }
  }, [forms.newDateForm])

  const resetNewDateForm = useCallback(() => {
    setForms(prev => ({
      ...prev,
      newDateForm: {
        date: '',
        type: 'custom',
        label: '',
        timeStart: '08:00',
        timeEnd: '18:00'
      }
    }))
  }, [])

  const initClassFormForCreate = useCallback((date?: string, time?: string) => {
    const initialSchedule: ScheduleItem = {
      id: generateId(),
      date: date || scheduleDates[0]?.date || formatDateISO(new Date()),
      start_time: time || '09:00',
      end_time: time ? `${(parseInt(time.split(':')[0]) + 2).toString().padStart(2, '0')}:${time.split(':')[1]}` : '11:00',
      duration_hours: 2
    }
    setForms(prev => ({
      ...prev,
      classForm: {
        student_id: '',
        teacher_id: '',
        schedules: [initialSchedule],
        notes: ''
      }
    }))
    setEditingClass(null)
  }, [scheduleDates])

  const initClassFormForEdit = useCallback((cls: ScheduledClass) => {
    setForms(prev => ({
      ...prev,
      classForm: {
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
      }
    }))
    setEditingClass(cls)
  }, [])

  const initRescheduleForm = useCallback((cls: ScheduledClass) => {
    setForms(prev => ({
      ...prev,
      rescheduleForm: {
        class_date: cls.class_date,
        start_time: cls.start_time || '09:00',
        end_time: cls.end_time || '11:00'
      }
    }))
    setReschedulingClass(cls)
  }, [])

  const initCancelDialog = useCallback((cls: ScheduledClass) => {
    setForms(prev => ({ ...prev, cancelReason: '' }))
    setCancellingClass(cls)
  }, [])

  const initPreferenceDialog = useCallback((student: StudentWithPrefs) => {
    setForms(prev => ({
      ...prev,
      preferenceForm: {
        day_of_week: 'saturday',
        preferred_start: '09:00',
        preferred_end: '11:00',
        notes: ''
      }
    }))
    setSelectedStudent(student)
  }, [])

  // 保存操作
  const handleSaveClass = useCallback(async () => {
    if (!forms.classForm.student_id) {
      toast.error('请选择学员')
      return false
    }

    if (forms.classForm.schedules.length === 0) {
      toast.error('请添加排课项')
      return false
    }

    const emptySchedule = forms.classForm.schedules.find(s => !s.date)
    if (emptySchedule) {
      toast.error('请为所有排课项设置日期')
      return false
    }

    try {
      setSaving(true)

      if (editing.editingClass) {
        const schedule = forms.classForm.schedules[0]
        if (forms.classForm.teacher_id) {
          const conflict = await scheduledClassDb.checkConflict(
            forms.classForm.teacher_id,
            schedule.date,
            schedule.start_time,
            schedule.end_time,
            editing.editingClass.id
          )
          if (conflict) {
            toast.error(`时段冲突：该助教在 ${schedule.date} ${schedule.start_time}-${schedule.end_time} 已有课程安排`)
            return false
          }
        }

        await scheduledClassDb.update(editing.editingClass.id, {
          student_id: forms.classForm.student_id,
          teacher_id: forms.classForm.teacher_id || null,
          class_date: schedule.date,
          start_time: schedule.start_time,
          end_time: schedule.end_time,
          duration_hours: schedule.duration_hours,
          notes: forms.classForm.notes || null
        })
      } else {
        if (forms.classForm.teacher_id) {
          for (const schedule of forms.classForm.schedules) {
            const conflict = await scheduledClassDb.checkConflict(
              forms.classForm.teacher_id,
              schedule.date,
              schedule.start_time,
              schedule.end_time
            )
            if (conflict) {
              toast.error(`时段冲突：该助教在 ${schedule.date} ${schedule.start_time}-${schedule.end_time} 已有课程安排`)
              return false
            }
          }
        }

        const results = await scheduledClassDb.batchCreate(
          forms.classForm.schedules.map(schedule => ({
            student_id: forms.classForm.student_id,
            teacher_id: forms.classForm.teacher_id || undefined,
            class_date: schedule.date,
            start_time: schedule.start_time,
            end_time: schedule.end_time,
            duration_hours: schedule.duration_hours,
            notes: forms.classForm.notes || undefined
          }))
        )

        if (results.failed > 0) {
          toast.warning(`排课完成：成功 ${results.success} 条，失败 ${results.failed} 条`)
        } else {
          toast.success(`排课成功：${results.success} 条`)
        }
      }

      closeDialog('classDialog')
      loadData()
      return true
    } catch (error) {
      console.error('Failed to save class:', error)
      toast.error('保存失败，请重试')
      return false
    } finally {
      setSaving(false)
    }
  }, [forms.classForm, editing.editingClass, closeDialog, loadData])

  const handleDeleteClass = useCallback(async (cls: ScheduledClass) => {
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

  const handleReschedule = useCallback(async () => {
    if (!editing.reschedulingClass) return false

    try {
      await scheduledClassDb.reschedule(
        editing.reschedulingClass.id,
        forms.rescheduleForm.class_date,
        forms.rescheduleForm.start_time,
        forms.rescheduleForm.end_time
      )

      closeDialog('rescheduleDialog')
      setReschedulingClass(null)
      loadData()
      toast.success('调课成功')
      return true
    } catch (error) {
      console.error('Failed to reschedule:', error)
      toast.error('调课失败，请重试')
      return false
    }
  }, [editing.reschedulingClass, forms.rescheduleForm, closeDialog, loadData])

  const handleCancel = useCallback(async () => {
    if (!editing.cancellingClass) return false

    try {
      await scheduledClassDb.cancel(editing.cancellingClass.id, forms.cancelReason || undefined)
      closeDialog('cancelDialog')
      setCancellingClass(null)
      loadData()
      toast.success('课程已取消')
      return true
    } catch (error) {
      console.error('Failed to cancel class:', error)
      toast.error('取消失败，请重试')
      return false
    }
  }, [editing.cancellingClass, forms.cancelReason, closeDialog, loadData])

  const handleAddPreference = useCallback(async () => {
    if (!editing.selectedStudent) return false

    try {
      await studentSchedulePreferenceDb.create({
        student_id: editing.selectedStudent.id,
        day_of_week: forms.preferenceForm.day_of_week,
        preferred_start: forms.preferenceForm.preferred_start,
        preferred_end: forms.preferenceForm.preferred_end,
        notes: forms.preferenceForm.notes || undefined
      })

      const prefs = await studentSchedulePreferenceDb.getByStudentId(editing.selectedStudent.id)
      setSelectedStudent({ ...editing.selectedStudent, preferences: prefs })
      loadData()
      toast.success('时段偏好已添加')
      return true
    } catch (error) {
      console.error('Failed to add preference:', error)
      toast.error('添加失败，请重试')
      return false
    }
  }, [editing.selectedStudent, forms.preferenceForm, loadData])

  const handleDeletePreference = useCallback(async (prefId: string) => {
    if (!editing.selectedStudent) return false

    try {
      await studentSchedulePreferenceDb.delete(prefId)
      const prefs = await studentSchedulePreferenceDb.getByStudentId(editing.selectedStudent.id)
      setSelectedStudent({ ...editing.selectedStudent, preferences: prefs })
      loadData()
      toast.success('时段偏好已删除')
      return true
    } catch (error) {
      console.error('Failed to delete preference:', error)
      toast.error('删除失败，请重试')
      return false
    }
  }, [editing.selectedStudent, loadData])

  const handleBatchSavePreferences = useCallback(async () => {
    if (editing.batchSelectedStudents.length === 0) {
      toast.error('请至少选择一名学生')
      return false
    }

    setBatchSaving(true)
    try {
      for (const studentId of editing.batchSelectedStudents) {
        const existing = await studentSchedulePreferenceDb.getByStudentId(studentId)
        const duplicate = existing.find(
          p => p.day_of_week === forms.batchPrefForm.day_of_week &&
            p.preferred_start === forms.batchPrefForm.preferred_start
        )
        if (!duplicate) {
          await studentSchedulePreferenceDb.create({
            student_id: studentId,
            day_of_week: forms.batchPrefForm.day_of_week,
            preferred_start: forms.batchPrefForm.preferred_start,
            preferred_end: forms.batchPrefForm.preferred_end,
            notes: forms.batchPrefForm.notes || undefined
          })
        }
      }

      closeDialog('batchPrefDialog')
      setBatchSelectedStudents([])
      loadData()
      toast.success(`已为 ${editing.batchSelectedStudents.length} 名学生添加时段偏好`)
      return true
    } catch (error) {
      toast.error('批量设置失败：' + (error as Error).message)
      return false
    } finally {
      setBatchSaving(false)
    }
  }, [editing.batchSelectedStudents, forms.batchPrefForm, closeDialog, loadData])

  // 包装回调函数使其返回 void（匹配 Dialog 组件接口）
  const onSaveClass = useCallback(async () => {
    await handleSaveClass()
  }, [handleSaveClass])

  const onReschedule = useCallback(async () => {
    await handleReschedule()
  }, [handleReschedule])

  const onCancel = useCallback(async () => {
    await handleCancel()
  }, [handleCancel])

  const onAddPreference = useCallback(async () => {
    await handleAddPreference()
  }, [handleAddPreference])

  const onDeletePreference = useCallback(async (prefId: string) => {
    await handleDeletePreference(prefId)
  }, [handleDeletePreference])

  const onBatchSavePreferences = useCallback(async () => {
    await handleBatchSavePreferences()
  }, [handleBatchSavePreferences])

  return {
    // 状态
    dialogs,
    forms,
    editing,
    saving,
    batchSaving,

    // 对话框操作
    openDialog,
    closeDialog,
    setDialogOpen,

    // 表单更新 (setState 风格)
    setNewDateForm,
    setClassForm,
    setRescheduleForm,
    setPreferenceForm,
    setBatchPrefForm,
    setCancelReason,
    setBatchSelectedStudents,

    // 编辑状态更新
    setEditingClass,
    setReschedulingClass,
    setCancellingClass,
    setSelectedStudent,

    // 初始化操作
    handleAddCustomDate,
    resetNewDateForm,
    initClassFormForCreate,
    initClassFormForEdit,
    initRescheduleForm,
    initCancelDialog,
    initPreferenceDialog,

    // 业务操作（返回 void）
    onSaveClass,
    handleDeleteClass,
    onReschedule,
    onCancel,
    onAddPreference,
    onDeletePreference,
    onBatchSavePreferences
  }
}