import { useState, useEffect, useCallback } from 'react'
import type { ScheduledClass, Student, Billing, StudentSchedulePreference } from '@/types'
import { ManualSchedule } from '@/components/ManualSchedule'
import { useScheduleData } from './hooks/useScheduleData'
import { useAISchedule } from './hooks/useAISchedule'
import { useClassDialog } from './hooks/useClassDialog'
import { useRescheduleDialog } from './hooks/useRescheduleDialog'
import { useCancelDialog } from './hooks/useCancelDialog'
import { usePreferenceDialog } from './hooks/usePreferenceDialog'
import { useBatchPrefDialog } from '@/hooks/useBatchPrefDialog'
import { useScheduleNavigation } from './hooks/useScheduleNavigation'
import { ScheduleHeader } from './components/ScheduleHeader'
import { DateTagBar } from './components/DateTagBar'
import { DayScheduleView } from './components/DayScheduleView'
import { ClassDialog } from './components/ClassDialog'
import { RescheduleDialog } from './components/RescheduleDialog'
import { CancelDialog } from './components/CancelDialog'
import { PreferenceDialog } from './components/PreferenceDialog'
import { BatchPrefDialog } from '@/components/Preferences/BatchPrefDialog'
import { AddDateDialog } from './components/AddDateDialog'
import type { ViewMode } from './types'

type StudentWithPrefs = Student & { billing: Billing | null; preferences: StudentSchedulePreference[] }

export function Schedule() {
  const [viewMode, setViewMode] = useState<ViewMode>('week')

  // 日期导航
  const nav = useScheduleNavigation()

  // 数据加载
  const {
    students, teachers, classes, loading, loadData, unscheduledStudents
  } = useScheduleData({ scheduleDates: nav.scheduleDates })

  // AI 排课
  const [extraInstructions, setExtraInstructions] = useState('')
  const ai = useAISchedule({
    students, teachers,
    scheduleDates: nav.scheduleDates,
    extraInstructions,
    onSuccess: loadData
  })

  // 各对话框
  const classDialog = useClassDialog(nav.scheduleDates, loadData)
  const rescheduleDialog = useRescheduleDialog(loadData)
  const cancelDialog = useCancelDialog(loadData)
  const preferenceDialog = usePreferenceDialog(loadData)
  const batchPrefDialog = useBatchPrefDialog(loadData)

  // 课程卡片菜单
  const [activeMenu, setActiveMenu] = useState<string | null>(null)
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null)

  // 人工排课跳转日期
  const [manualScheduleDate, setManualScheduleDate] = useState<string | null>(null)

  const handleJumpToManualSchedule = useCallback((date: string) => {
    setManualScheduleDate(date)
    setViewMode('manual')
  }, [])

  // 课程操作
  const handleCreateClass = useCallback((date?: string, time?: string) => {
    classDialog.initForCreate(date, time)
    classDialog.setOpen(true)
  }, [classDialog])

  const handleEditClass = useCallback((cls: ScheduledClass) => {
    classDialog.initForEdit(cls)
    classDialog.setOpen(true)
    setActiveMenu(null)
  }, [classDialog])

  const handleOpenReschedule = useCallback((cls: ScheduledClass) => {
    rescheduleDialog.init(cls)
    rescheduleDialog.setOpen(true)
    setActiveMenu(null)
  }, [rescheduleDialog])

  const handleOpenCancel = useCallback((cls: ScheduledClass) => {
    cancelDialog.init(cls)
    cancelDialog.setOpen(true)
    setActiveMenu(null)
  }, [cancelDialog])

  const handleOpenPreferenceDialog = useCallback((student: StudentWithPrefs) => {
    preferenceDialog.init(student)
    preferenceDialog.setOpen(true)
  }, [preferenceDialog])

  // 课程卡片点击（弹出操作菜单）
  const handleClassClick = useCallback((e: React.MouseEvent, classId: string) => {
    e.stopPropagation()
    if (activeMenu === classId) {
      setActiveMenu(null)
      setMenuPosition(null)
    } else {
      const rect = e.currentTarget.getBoundingClientRect()
      const menuHeight = 160
      const wouldOverflowBottom = rect.bottom + 4 + menuHeight > window.innerHeight
      setMenuPosition({
        top: wouldOverflowBottom ? rect.top - menuHeight - 4 : rect.bottom + 4,
        left: Math.min(rect.right - 120, window.innerWidth - 130)
      })
      setActiveMenu(classId)
    }
  }, [activeMenu])

  // 点击其他地方关闭菜单
  useEffect(() => {
    if (!activeMenu) return
    const handleClickOutside = () => { setActiveMenu(null); setMenuPosition(null) }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [activeMenu])

  // AI 排课批量操作
  const handleSelectAllAiResults = () => {
    ai.aiResults.filter(r => !r.unmatched).forEach(r => {
      if (!ai.selectedAiResults.has(r.student_id)) ai.toggleAiResultSelection(r.student_id)
    })
  }
  const handleClearAiResultSelection = () => {
    ai.selectedAiResults.forEach(id => ai.toggleAiResultSelection(id))
  }

  return (
    <div className="h-full flex flex-col">
      <ScheduleHeader
        viewMode={viewMode}
        setViewMode={setViewMode}
        schedulePreset={nav.schedulePreset}
        onPresetChange={nav.handlePresetChange}
        scheduleDates={nav.scheduleDates}
        onPrevWeek={nav.goToPrevWeek}
        onNextWeek={nav.goToNextWeek}
        onToday={nav.goToToday}
        onOpenAddDate={() => nav.addDateDialog.setOpen(true)}
        onOpenBatchPref={() => batchPrefDialog.setOpen(true)}
        onCreateClass={() => handleCreateClass()}
      />

      <DateTagBar
        scheduleDates={nav.scheduleDates}
        schedulePreset={nav.schedulePreset}
        classes={classes}
        onJumpToManualSchedule={handleJumpToManualSchedule}
        onCreateClass={(date) => handleCreateClass(date)}
        onRemoveDate={nav.handleRemoveDate}
      />

      {/* 内容区 */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            加载中...
          </div>
        ) : viewMode === 'manual' ? (
          <ManualSchedule
            initialDate={manualScheduleDate || undefined}
            aiResults={ai.aiResults}
            selectedAiResults={ai.selectedAiResults}
            sidebarProps={{
              students, teachers,
              scheduleDates: nav.scheduleDates,
              unscheduledStudents,
              onOpenPreferenceDialog: handleOpenPreferenceDialog,
              onCreateClass: (studentId: string, schedules: any[]) => {
                classDialog.setForm(prev => ({
                  ...prev, student_id: studentId, teacher_id: '', schedules, notes: ''
                }))
                classDialog.setOpen(true)
              },
              aiScheduling: ai.aiScheduling,
              aiResults: ai.aiResults,
              aiConflicts: ai.aiConflicts,
              aiError: ai.aiError,
              selectedAiResults: ai.selectedAiResults,
              extraInstructions,
              setExtraInstructions,
              onAISchedule: ai.handleAISchedule,
              onSelectAllAiResults: handleSelectAllAiResults,
              onClearAiResultSelection: handleClearAiResultSelection,
              onToggleAiResult: ai.toggleAiResultSelection,
              onConfirmAISchedule: ai.handleConfirmAISchedule,
              saving: ai.saving
            }}
          />
        ) : (
          <DayScheduleView
            scheduleDates={nav.scheduleDates}
            classes={classes}
            activeMenu={activeMenu}
            onPrevDay={() => nav.setCurrentDateIndex(prev => Math.max(0, prev - 1))}
            onNextDay={() => nav.setCurrentDateIndex(prev => Math.min(nav.scheduleDates.length - 1, prev + 1))}
            currentDateIndex={nav.currentDateIndex}
            setCurrentDateIndex={nav.setCurrentDateIndex}
            onCreateClass={handleCreateClass}
            onClassClick={handleClassClick}
            menuPosition={menuPosition}
            onEditClass={handleEditClass}
            onReschedule={handleOpenReschedule}
            onCancel={handleOpenCancel}
            onDeleteClass={classDialog.handleDelete}
          />
        )}
      </div>

      {/* 对话框 */}
      <AddDateDialog
        open={nav.addDateDialog.open}
        onOpenChange={nav.addDateDialog.setOpen}
        newDateForm={nav.addDateDialog.form}
        setNewDateForm={nav.addDateDialog.setForm}
        onAdd={nav.handleAddDate}
      />

      <ClassDialog
        open={classDialog.open}
        onOpenChange={classDialog.setOpen}
        editingClass={classDialog.editingClass}
        classForm={classDialog.form}
        setClassForm={classDialog.setForm}
        students={students}
        teachers={teachers}
        scheduleDates={nav.scheduleDates}
        saving={classDialog.saving}
        onSave={classDialog.onSave}
      />

      <RescheduleDialog
        open={rescheduleDialog.open}
        onOpenChange={rescheduleDialog.setOpen}
        reschedulingClass={rescheduleDialog.reschedulingClass}
        rescheduleForm={rescheduleDialog.form}
        setRescheduleForm={rescheduleDialog.setForm}
        onConfirm={rescheduleDialog.onReschedule}
      />

      <CancelDialog
        open={cancelDialog.open}
        onOpenChange={cancelDialog.setOpen}
        cancellingClass={cancelDialog.cancellingClass}
        cancelReason={cancelDialog.cancelReason}
        setCancelReason={cancelDialog.setCancelReason}
        onConfirm={cancelDialog.onCancel}
      />

      <PreferenceDialog
        open={preferenceDialog.open}
        onOpenChange={preferenceDialog.setOpen}
        selectedStudent={preferenceDialog.selectedStudent}
        preferenceForm={preferenceDialog.form}
        setPreferenceForm={preferenceDialog.setForm}
        onAddPreference={preferenceDialog.onAdd}
        onDeletePreference={preferenceDialog.onDelete}
      />

      <BatchPrefDialog
        open={batchPrefDialog.open}
        onOpenChange={batchPrefDialog.setOpen}
        students={students}
        batchSelectedStudents={batchPrefDialog.selectedStudents}
        setBatchSelectedStudents={batchPrefDialog.setSelectedStudents}
        batchPrefForm={batchPrefDialog.form}
        setBatchPrefForm={batchPrefDialog.setForm}
        batchSaving={batchPrefDialog.saving}
        onSave={batchPrefDialog.onSave}
      />
    </div>
  )
}
