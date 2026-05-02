import { useState, useEffect, useCallback } from 'react'
import type { ScheduledClass, Student, Billing, StudentSchedulePreference } from '@/types'
import { ManualSchedule } from '@/components/ManualSchedule'
import { useScheduleData } from './hooks/useScheduleData'
import { useClassDialog, useRescheduleDialog, useCancelDialog, usePreferenceDialog } from './hooks/useScheduleDialogs'
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

  const nav = useScheduleNavigation()

  const {
    students, teachers, classes, loading, loadData, unscheduledStudents
  } = useScheduleData({ scheduleDates: nav.scheduleDates })

  const classDialog = useClassDialog(nav.scheduleDates, loadData)
  const rescheduleDialog = useRescheduleDialog(loadData)
  const cancelDialog = useCancelDialog(loadData)
  const preferenceDialog = usePreferenceDialog(loadData)
  const batchPrefDialog = useBatchPrefDialog(loadData)

  const [activeMenu, setActiveMenu] = useState<string | null>(null)
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null)
  const [manualScheduleDate, setManualScheduleDate] = useState<string | null>(null)

  const handleJumpToManualSchedule = useCallback((date: string) => {
    setManualScheduleDate(date)
    setViewMode('manual')
  }, [])

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

  useEffect(() => {
    if (!activeMenu) return
    const handleClickOutside = () => { setActiveMenu(null); setMenuPosition(null) }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [activeMenu])

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

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            加载中...
          </div>
        ) : viewMode === 'manual' ? (
          <ManualSchedule
            initialDate={manualScheduleDate || undefined}
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
