import { useState, useEffect } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  CalendarPlus,
  Users,
  Hand,
  X,
  Sun,
  Moon
} from 'lucide-react'
import { scheduledClassDb, studentSchedulePreferenceDb } from '@/db'
import { generateId } from '@/db/utils'
import type { ScheduledClass, DayOfWeek, Student, Billing, StudentSchedulePreference } from '@/types'
import {
  getWeekendWithFridayConfigs,
  getWeekDateConfigs,
  type ScheduleDateConfig
} from '@/ai/schedulePrompts'
import { ManualSchedule } from '@/components/ManualSchedule'
import { Button } from '@/components/ui/button'
import { useScheduleData } from './hooks/useScheduleData'
import { useAISchedule } from './hooks/useAISchedule'
import { DayScheduleView } from './components/DayScheduleView'
import { ClassDialog } from './components/ClassDialog'
import { RescheduleDialog } from './components/RescheduleDialog'
import { CancelDialog } from './components/CancelDialog'
import { PreferenceDialog } from './components/PreferenceDialog'
import { BatchPrefDialog } from './components/BatchPrefDialog'
import { AddDateDialog } from './components/AddDateDialog'
import { ArrangeView } from './ArrangeView'
import {
  ViewMode,
  SchedulePreset,
  ScheduleItem,
  DAY_LABELS,
  formatDate,
  formatDisplayDate,
  getDayOfWeek
} from './types'

type StudentWithPrefs = Student & { billing: Billing | null; preferences: StudentSchedulePreference[] }

export function Schedule() {
  const [viewMode, setViewMode] = useState<ViewMode>('week')
  const [currentDate, setCurrentDate] = useState(new Date())

  // 排课日期配置
  const [scheduleDates, setScheduleDates] = useState<ScheduleDateConfig[]>(() =>
    getWeekendWithFridayConfigs(new Date())
  )
  const [schedulePreset, setSchedulePreset] = useState<SchedulePreset>('weekend_with_friday')

  // 数据加载
  const {
    students,
    teachers,
    classes,
    loading,
    loadData,
    unscheduledStudents
  } = useScheduleData({ scheduleDates })

  // AI排课
  const [extraInstructions, setExtraInstructions] = useState('')
  const {
    aiScheduling,
    aiResults,
    aiConflicts,
    aiError,
    selectedAiResults,
    setSelectedAiResults,
    handleAISchedule,
    toggleAiResultSelection,
    handleConfirmAISchedule,
    saving: aiSaving
  } = useAISchedule({
    students,
    teachers,
    scheduleDates,
    extraInstructions,
    onSuccess: loadData
  })

  // 添加日期对话框
  const [addDateDialogOpen, setAddDateDialogOpen] = useState(false)
  const [newDateForm, setNewDateForm] = useState({
    date: '',
    type: 'custom' as ScheduleDateConfig['type'],
    label: '',
    timeStart: '08:00',
    timeEnd: '18:00'
  })

  // 新增/编辑课程对话框
  const [classDialogOpen, setClassDialogOpen] = useState(false)
  const [editingClass, setEditingClass] = useState<ScheduledClass | null>(null)
  const [classForm, setClassForm] = useState({
    student_id: '',
    teacher_id: '',
    schedules: [] as ScheduleItem[],
    notes: ''
  })
  const [saving, setSaving] = useState(false)

  // 更多操作菜单
  const [activeMenu, setActiveMenu] = useState<string | null>(null)
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null)

  // 调课对话框
  const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState(false)
  const [reschedulingClass, setReschedulingClass] = useState<ScheduledClass | null>(null)
  const [rescheduleForm, setRescheduleForm] = useState({
    class_date: '',
    start_time: '',
    end_time: ''
  })

  // 取消对话框
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [cancellingClass, setCancellingClass] = useState<ScheduledClass | null>(null)
  const [cancelReason, setCancelReason] = useState('')

  // 学生时段偏好对话框
  const [preferenceDialogOpen, setPreferenceDialogOpen] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState<StudentWithPrefs | null>(null)
  const [preferenceForm, setPreferenceForm] = useState({
    day_of_week: 'saturday' as DayOfWeek,
    preferred_start: '09:00',
    preferred_end: '11:00',
    notes: ''
  })

  // 批量设置时段偏好
  const [batchPrefDialogOpen, setBatchPrefDialogOpen] = useState(false)
  const [batchSelectedStudents, setBatchSelectedStudents] = useState<string[]>([])
  const [batchPrefForm, setBatchPrefForm] = useState({
    day_of_week: 'saturday' as DayOfWeek,
    preferred_start: '09:00',
    preferred_end: '11:00',
    notes: '',
    grade_filter: 'all',
  })
  const [batchSaving, setBatchSaving] = useState(false)

  // 单日视图当前日期索引
  const [currentDateIndex, setCurrentDateIndex] = useState(0)

  // 人工排课跳转日期
  const [manualScheduleDate, setManualScheduleDate] = useState<string | null>(null)

  // 跳转到人工排课并选中日期
  const handleJumpToManualSchedule = (date: string) => {
    setManualScheduleDate(date)
    setViewMode('manual')
  }

  // 切换预设模式
  const handlePresetChange = (preset: SchedulePreset) => {
    setSchedulePreset(preset)
    setCurrentDateIndex(0)
    if (preset === 'weekend_with_friday') {
      setScheduleDates(getWeekendWithFridayConfigs(currentDate))
    } else if (preset === 'week') {
      setScheduleDates(getWeekDateConfigs(currentDate))
    }
  }

  // 切换周
  const goToPrevWeek = () => {
    const newDate = new Date(currentDate)
    newDate.setDate(newDate.getDate() - 7)
    setCurrentDate(newDate)
    setCurrentDateIndex(0)
    if (schedulePreset === 'weekend_with_friday') {
      setScheduleDates(getWeekendWithFridayConfigs(newDate))
    } else if (schedulePreset === 'week') {
      setScheduleDates(getWeekDateConfigs(newDate))
    }
  }

  const goToNextWeek = () => {
    const newDate = new Date(currentDate)
    newDate.setDate(newDate.getDate() + 7)
    setCurrentDate(newDate)
    setCurrentDateIndex(0)
    if (schedulePreset === 'weekend_with_friday') {
      setScheduleDates(getWeekendWithFridayConfigs(newDate))
    } else if (schedulePreset === 'week') {
      setScheduleDates(getWeekDateConfigs(newDate))
    }
  }

  const goToToday = () => {
    setCurrentDate(new Date())
    setCurrentDateIndex(0)
    if (schedulePreset === 'weekend_with_friday') {
      setScheduleDates(getWeekendWithFridayConfigs(new Date()))
    } else if (schedulePreset === 'week') {
      setScheduleDates(getWeekDateConfigs(new Date()))
    }
  }

  // 添加自定义日期
  const handleAddCustomDate = () => {
    if (!newDateForm.date) {
      alert('请选择日期')
      return
    }

    const dayOfWeek = getDayOfWeek(newDateForm.date)
    const label = newDateForm.label || `${DAY_LABELS[dayOfWeek]}${newDateForm.type === 'holiday' ? '（假期）' : ''}`

    const newConfig: ScheduleDateConfig = {
      date: newDateForm.date,
      type: newDateForm.type,
      label,
      timeRange: newDateForm.type === 'friday_evening'
        ? { start: '18:00', end: '21:00' }
        : { start: newDateForm.timeStart, end: newDateForm.timeEnd }
    }

    if (scheduleDates.some(d => d.date === newDateForm.date)) {
      alert('该日期已添加')
      return
    }

    setScheduleDates(prev => [...prev, newConfig].sort((a, b) => a.date.localeCompare(b.date)))
    setAddDateDialogOpen(false)
    setNewDateForm({
      date: '',
      type: 'custom',
      label: '',
      timeStart: '08:00',
      timeEnd: '18:00'
    })
  }

  // 移除日期
  const handleRemoveDate = (date: string) => {
    setScheduleDates(prev => prev.filter(d => d.date !== date))
  }

  // 打开新增课程对话框
  const handleCreateClass = (date?: string, time?: string) => {
    setEditingClass(null)
    const initialSchedule: ScheduleItem = {
      id: generateId(),
      date: date || scheduleDates[0]?.date || formatDate(new Date()),
      start_time: time || '09:00',
      end_time: time ? `${(parseInt(time.split(':')[0]) + 2).toString().padStart(2, '0')}:${time.split(':')[1]}` : '11:00',
      duration_hours: 2
    }
    setClassForm({
      student_id: '',
      teacher_id: '',
      schedules: [initialSchedule],
      notes: ''
    })
    setClassDialogOpen(true)
  }

  // 打开编辑课程对话框
  const handleEditClass = (cls: ScheduledClass) => {
    setEditingClass(cls)
    setClassForm({
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
    setClassDialogOpen(true)
    setActiveMenu(null)
  }

  // 保存课程
  const handleSaveClass = async () => {
    if (!classForm.student_id) {
      alert('请选择学员')
      return
    }

    if (classForm.schedules.length === 0) {
      alert('请添加排课项')
      return
    }

    const emptySchedule = classForm.schedules.find(s => !s.date)
    if (emptySchedule) {
      alert('请为所有排课项设置日期')
      return
    }

    try {
      setSaving(true)

      if (editingClass) {
        const schedule = classForm.schedules[0]
        if (classForm.teacher_id) {
          const conflict = await scheduledClassDb.checkConflict(
            classForm.teacher_id,
            schedule.date,
            schedule.start_time,
            schedule.end_time,
            editingClass.id
          )
          if (conflict) {
            alert(`时段冲突：该助教在 ${schedule.date} ${schedule.start_time}-${schedule.end_time} 已有课程安排`)
            return
          }
        }

        await scheduledClassDb.update(editingClass.id, {
          student_id: classForm.student_id,
          teacher_id: classForm.teacher_id || null,
          class_date: schedule.date,
          start_time: schedule.start_time,
          end_time: schedule.end_time,
          duration_hours: schedule.duration_hours,
          notes: classForm.notes || null
        })
      } else {
        if (classForm.teacher_id) {
          for (const schedule of classForm.schedules) {
            const conflict = await scheduledClassDb.checkConflict(
              classForm.teacher_id,
              schedule.date,
              schedule.start_time,
              schedule.end_time
            )
            if (conflict) {
              alert(`时段冲突：该助教在 ${schedule.date} ${schedule.start_time}-${schedule.end_time} 已有课程安排`)
              return
            }
          }
        }

        const results = await scheduledClassDb.batchCreate(
          classForm.schedules.map(schedule => ({
            student_id: classForm.student_id,
            teacher_id: classForm.teacher_id || undefined,
            class_date: schedule.date,
            start_time: schedule.start_time,
            end_time: schedule.end_time,
            duration_hours: schedule.duration_hours,
            notes: classForm.notes || undefined
          }))
        )

        if (results.failed > 0) {
          alert(`排课完成：成功 ${results.success} 条，失败 ${results.failed} 条`)
        }
      }

      setClassDialogOpen(false)
      loadData()
    } catch (error) {
      console.error('Failed to save class:', error)
      alert('保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  // 删除课程
  const handleDeleteClass = async (cls: ScheduledClass) => {
    if (!confirm('确定要删除这节课程吗？')) return

    try {
      await scheduledClassDb.delete(cls.id)
      setActiveMenu(null)
      loadData()
    } catch (error) {
      console.error('Failed to delete class:', error)
      alert('删除失败，请重试')
    }
  }

  // 打开调课对话框
  const handleOpenReschedule = (cls: ScheduledClass) => {
    setReschedulingClass(cls)
    setRescheduleForm({
      class_date: cls.class_date,
      start_time: cls.start_time || '09:00',
      end_time: cls.end_time || '10:00'
    })
    setRescheduleDialogOpen(true)
    setActiveMenu(null)
  }

  // 执行调课
  const handleReschedule = async () => {
    if (!reschedulingClass) return

    try {
      await scheduledClassDb.reschedule(
        reschedulingClass.id,
        rescheduleForm.class_date,
        rescheduleForm.start_time,
        rescheduleForm.end_time
      )

      setRescheduleDialogOpen(false)
      setReschedulingClass(null)
      loadData()
    } catch (error) {
      console.error('Failed to reschedule:', error)
      alert('调课失败，请重试')
    }
  }

  // 打开取消对话框
  const handleOpenCancel = (cls: ScheduledClass) => {
    setCancellingClass(cls)
    setCancelReason('')
    setCancelDialogOpen(true)
    setActiveMenu(null)
  }

  // 执行取消
  const handleCancel = async () => {
    if (!cancellingClass) return

    try {
      await scheduledClassDb.cancel(cancellingClass.id, cancelReason || undefined)
      setCancelDialogOpen(false)
      setCancellingClass(null)
      loadData()
    } catch (error) {
      console.error('Failed to cancel class:', error)
      alert('取消失败，请重试')
    }
  }

  // 打开学生时段偏好对话框
  const handleOpenPreferenceDialog = (student: StudentWithPrefs) => {
    setSelectedStudent(student)
    setPreferenceForm({
      day_of_week: 'saturday',
      preferred_start: '09:00',
      preferred_end: '11:00',
      notes: ''
    })
    setPreferenceDialogOpen(true)
  }

  // 添加学生时段偏好
  const handleAddPreference = async () => {
    if (!selectedStudent) return

    try {
      await studentSchedulePreferenceDb.create({
        student_id: selectedStudent.id,
        day_of_week: preferenceForm.day_of_week,
        preferred_start: preferenceForm.preferred_start,
        preferred_end: preferenceForm.preferred_end,
        notes: preferenceForm.notes || undefined
      })

      const prefs = await studentSchedulePreferenceDb.getByStudentId(selectedStudent.id)
      setSelectedStudent({ ...selectedStudent, preferences: prefs })
      loadData()
    } catch (error) {
      console.error('Failed to add preference:', error)
      alert('添加失败，请重试')
    }
  }

  // 删除学生时段偏好
  const handleDeletePreference = async (prefId: string) => {
    if (!selectedStudent) return

    try {
      await studentSchedulePreferenceDb.delete(prefId)
      const prefs = await studentSchedulePreferenceDb.getByStudentId(selectedStudent.id)
      setSelectedStudent({ ...selectedStudent, preferences: prefs })
      loadData()
    } catch (error) {
      console.error('Failed to delete preference:', error)
      alert('删除失败，请重试')
    }
  }

  // 批量保存时段偏好
  const handleBatchSavePreferences = async () => {
    if (batchSelectedStudents.length === 0) {
      alert('请至少选择一名学生')
      return
    }

    setBatchSaving(true)
    try {
      for (const studentId of batchSelectedStudents) {
        const existing = await studentSchedulePreferenceDb.getByStudentId(studentId)
        const duplicate = existing.find(
          p => p.day_of_week === batchPrefForm.day_of_week &&
            p.preferred_start === batchPrefForm.preferred_start
        )
        if (!duplicate) {
          await studentSchedulePreferenceDb.create({
            student_id: studentId,
            day_of_week: batchPrefForm.day_of_week,
            preferred_start: batchPrefForm.preferred_start,
            preferred_end: batchPrefForm.preferred_end,
            notes: batchPrefForm.notes || undefined,
          })
        }
      }

      setBatchPrefDialogOpen(false)
      setBatchSelectedStudents([])
      loadData()
      alert(`已为 ${batchSelectedStudents.length} 名学生添加时段偏好`)
    } catch (error) {
      alert('批量设置失败：' + (error as Error).message)
    } finally {
      setBatchSaving(false)
    }
  }

  // 处理课程卡片点击
  const handleClassClick = (e: React.MouseEvent, classId: string) => {
    e.stopPropagation()
    if (activeMenu === classId) {
      setActiveMenu(null)
      setMenuPosition(null)
    } else {
      const rect = e.currentTarget.getBoundingClientRect()
      const menuHeight = 160
      const windowHeight = window.innerHeight

      const wouldOverflowBottom = rect.bottom + 4 + menuHeight > windowHeight

      if (wouldOverflowBottom) {
        setMenuPosition({
          top: rect.top - menuHeight - 4,
          left: Math.min(rect.right - 120, window.innerWidth - 130)
        })
      } else {
        setMenuPosition({
          top: rect.bottom + 4,
          left: Math.min(rect.right - 120, window.innerWidth - 130)
        })
      }
      setActiveMenu(classId)
    }
  }

  // 点击其他地方关闭菜单
  useEffect(() => {
    const handleClickOutside = () => {
      if (activeMenu) {
        setActiveMenu(null)
        setMenuPosition(null)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [activeMenu])

  // 获取日期显示图标
  const getDateIcon = (type: ScheduleDateConfig['type']) => {
    switch (type) {
      case 'friday_evening':
        return <Moon className="h-4 w-4 text-indigo-500" />
      case 'holiday':
        return <Sun className="h-4 w-4 text-amber-500" />
      default:
        return <Sun className="h-4 w-4 text-orange-500" />
    }
  }

  // 处理AI排课选择切换
  const handleToggleAiResult = (studentId: string) => {
    if (studentId === 'all') {
      setSelectedAiResults(new Set(aiResults.filter(r => !r.unmatched).map(r => r.student_id)))
    } else if (studentId === 'none') {
      setSelectedAiResults(new Set())
    } else {
      toggleAiResultSelection(studentId)
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* 头部 */}
      <header className="h-16 border-b bg-card flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold">排课管理</h1>

          <div className="flex bg-muted rounded-lg p-1">
            <button
              onClick={() => setViewMode('week')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                viewMode === 'week' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              周课表
            </button>
            <button
              onClick={() => setViewMode('arrange')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                viewMode === 'arrange' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              排课操作
            </button>
            <button
              onClick={() => setViewMode('manual')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors flex items-center gap-1 ${
                viewMode === 'manual' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Hand className="h-4 w-4" />
              人工排课
            </button>
          </div>

          <div className="flex bg-muted rounded-lg p-1">
            <button
              onClick={() => handlePresetChange('weekend_with_friday')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                schedulePreset === 'weekend_with_friday' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              含周五晚
            </button>
            <button
              onClick={() => handlePresetChange('week')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                schedulePreset === 'week' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              一周
            </button>
            <button
              onClick={() => handlePresetChange('custom')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                schedulePreset === 'custom' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              自定义
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {viewMode === 'week' && (
            <>
              <Button variant="outline" size="icon" onClick={goToPrevWeek}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm min-w-[120px] text-center">
                {scheduleDates.length > 0 ? (
                  scheduleDates.length === 1
                    ? formatDisplayDate(new Date(scheduleDates[0].date))
                    : `${formatDisplayDate(new Date(scheduleDates[0].date))} - ${formatDisplayDate(new Date(scheduleDates[scheduleDates.length - 1].date))}`
                ) : '请添加日期'}
              </span>
              <Button variant="outline" size="icon" onClick={goToNextWeek}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={goToToday}>
                本周
              </Button>
            </>
          )}
          {viewMode === 'arrange' && (
            <Button variant="outline" size="sm" onClick={() => setBatchPrefDialogOpen(true)}>
              <Users className="h-4 w-4 mr-2" />
              批量设置时段偏好
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setAddDateDialogOpen(true)}>
            <CalendarPlus className="h-4 w-4 mr-2" />
            添加日期
          </Button>
          <Button onClick={() => handleCreateClass()}>
            <Plus className="h-4 w-4 mr-2" />
            新增排课
          </Button>
        </div>
      </header>

      {/* 当前排课日期标签 */}
      {scheduleDates.length > 0 && (
        <div className="border-b bg-muted/30 px-6 py-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground">排课日期：</span>
            {scheduleDates.map((dateConfig) => (
              <button
                key={dateConfig.date}
                onClick={() => handleJumpToManualSchedule(dateConfig.date)}
                className="flex items-center gap-1 px-2 py-1 bg-background rounded-md border text-sm hover:bg-blue-50 hover:border-blue-300 cursor-pointer transition-colors"
                title="点击跳转到人工排课"
              >
                {getDateIcon(dateConfig.type)}
                <span>{dateConfig.label}</span>
                <span className="text-muted-foreground">({formatDisplayDate(new Date(dateConfig.date))})</span>
                {schedulePreset === 'custom' && (
                  <span
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRemoveDate(dateConfig.date)
                    }}
                    className="ml-1 text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 内容区 */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            加载中...
          </div>
        ) : viewMode === 'manual' ? (
          <ManualSchedule initialDate={manualScheduleDate || undefined} />
        ) : viewMode === 'week' ? (
          <DayScheduleView
            scheduleDates={scheduleDates}
            classes={classes}
            activeMenu={activeMenu}
            onPrevDay={() => setCurrentDateIndex(prev => Math.max(0, prev - 1))}
            onNextDay={() => setCurrentDateIndex(prev => Math.min(scheduleDates.length - 1, prev + 1))}
            currentDateIndex={currentDateIndex}
            setCurrentDateIndex={setCurrentDateIndex}
            onCreateClass={handleCreateClass}
            onClassClick={handleClassClick}
            menuPosition={menuPosition}
            onEditClass={handleEditClass}
            onReschedule={handleOpenReschedule}
            onCancel={handleOpenCancel}
            onDeleteClass={handleDeleteClass}
          />
        ) : (
          <ArrangeView
            students={students}
            teachers={teachers}
            scheduleDates={scheduleDates}
            unscheduledStudents={unscheduledStudents}
            onOpenPreferenceDialog={handleOpenPreferenceDialog}
            onCreateClass={(studentId, schedules) => {
              setClassForm({
                student_id: studentId,
                teacher_id: '',
                schedules,
                notes: ''
              })
              setClassDialogOpen(true)
            }}
            aiScheduling={aiScheduling}
            aiResults={aiResults}
            aiConflicts={aiConflicts}
            aiError={aiError}
            selectedAiResults={selectedAiResults}
            extraInstructions={extraInstructions}
            setExtraInstructions={setExtraInstructions}
            onAISchedule={handleAISchedule}
            onToggleAiResultSelection={handleToggleAiResult}
            onConfirmAISchedule={handleConfirmAISchedule}
            saving={aiSaving}
          />
        )}
      </div>

      {/* 对话框 */}
      <AddDateDialog
        open={addDateDialogOpen}
        onOpenChange={setAddDateDialogOpen}
        newDateForm={newDateForm}
        setNewDateForm={setNewDateForm}
        onAdd={handleAddCustomDate}
      />

      <ClassDialog
        open={classDialogOpen}
        onOpenChange={setClassDialogOpen}
        editingClass={editingClass}
        classForm={classForm}
        setClassForm={setClassForm}
        students={students}
        teachers={teachers}
        scheduleDates={scheduleDates}
        saving={saving}
        onSave={handleSaveClass}
      />

      <RescheduleDialog
        open={rescheduleDialogOpen}
        onOpenChange={setRescheduleDialogOpen}
        reschedulingClass={reschedulingClass}
        rescheduleForm={rescheduleForm}
        setRescheduleForm={setRescheduleForm}
        onConfirm={handleReschedule}
      />

      <CancelDialog
        open={cancelDialogOpen}
        onOpenChange={setCancelDialogOpen}
        cancellingClass={cancellingClass}
        cancelReason={cancelReason}
        setCancelReason={setCancelReason}
        onConfirm={handleCancel}
      />

      <PreferenceDialog
        open={preferenceDialogOpen}
        onOpenChange={setPreferenceDialogOpen}
        selectedStudent={selectedStudent}
        preferenceForm={preferenceForm}
        setPreferenceForm={setPreferenceForm}
        onAddPreference={handleAddPreference}
        onDeletePreference={handleDeletePreference}
      />

      <BatchPrefDialog
        open={batchPrefDialogOpen}
        onOpenChange={setBatchPrefDialogOpen}
        students={students}
        batchSelectedStudents={batchSelectedStudents}
        setBatchSelectedStudents={setBatchSelectedStudents}
        batchPrefForm={batchPrefForm}
        setBatchPrefForm={setBatchPrefForm}
        batchSaving={batchSaving}
        onSave={handleBatchSavePreferences}
      />
    </div>
  )
}