import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  CalendarPlus,
  Users,
  Hand,
  X
} from 'lucide-react'
import { scheduledClassDb } from '@/db'
import type { ScheduledClass, Student, Billing, StudentSchedulePreference } from '@/types'
import {
  getWeekendWithFridayConfigs,
  getWeekDateConfigs,
  type ScheduleDateConfig
} from '@/ai/schedulePrompts'
import { ManualSchedule } from '@/components/ManualSchedule'
import { Button } from '@/components/ui/button'
import { useScheduleData } from './hooks/useScheduleData'
import { useAISchedule } from './hooks/useAISchedule'
import { useScheduleDialogs } from './hooks/useScheduleDialogs'
import { DayScheduleView } from './components/DayScheduleView'
import { ClassDialog } from './components/ClassDialog'
import { RescheduleDialog } from './components/RescheduleDialog'
import { CancelDialog } from './components/CancelDialog'
import { PreferenceDialog } from './components/PreferenceDialog'
import { BatchPrefDialog } from '@/components/Preferences/BatchPrefDialog'
import { AddDateDialog } from './components/AddDateDialog'
import { ArrangeView } from './ArrangeView'
import {
  ViewMode,
  SchedulePreset,
  formatDisplayDate,
  getDateTypeIcon
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

  // 使用对话框管理 hook
  const {
    dialogs,
    forms,
    editing,
    saving,
    batchSaving,
    openDialog,
    closeDialog,
    setDialogOpen,
    setNewDateForm,
    setClassForm,
    setRescheduleForm,
    setPreferenceForm,
    setBatchPrefForm,
    setCancelReason,
    setBatchSelectedStudents,
    setEditingClass,
    setReschedulingClass,
    setCancellingClass,
    setSelectedStudent,
    handleAddCustomDate,
    resetNewDateForm,
    initClassFormForCreate,
    initClassFormForEdit,
    initRescheduleForm,
    initCancelDialog,
    initPreferenceDialog,
    onSaveClass,
    handleDeleteClass,
    onReschedule,
    onCancel,
    onAddPreference,
    onDeletePreference,
    onBatchSavePreferences
  } = useScheduleDialogs(scheduleDates, students, loadData)

  // 更多操作菜单
  const [activeMenu, setActiveMenu] = useState<string | null>(null)
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null)

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
  const handleAddDate = () => {
    const newConfig = handleAddCustomDate()
    if (!newConfig) return

    if (scheduleDates.some(d => d.date === newConfig.date)) {
      toast.error('该日期已添加')
      return
    }

    setScheduleDates(prev => [...prev, newConfig].sort((a, b) => a.date.localeCompare(b.date)))
    closeDialog('addDateDialog')
    resetNewDateForm()
  }

  // 移除日期
  const handleRemoveDate = (date: string) => {
    setScheduleDates(prev => prev.filter(d => d.date !== date))
  }

  // 打开新增课程对话框
  const handleCreateClass = (date?: string, time?: string) => {
    initClassFormForCreate(date, time)
    openDialog('classDialog')
  }

  // 打开编辑课程对话框
  const handleEditClass = (cls: ScheduledClass) => {
    initClassFormForEdit(cls)
    openDialog('classDialog')
    setActiveMenu(null)
  }

  // 打开调课对话框
  const handleOpenReschedule = (cls: ScheduledClass) => {
    initRescheduleForm(cls)
    openDialog('rescheduleDialog')
    setActiveMenu(null)
  }

  // 打开取消对话框
  const handleOpenCancel = (cls: ScheduledClass) => {
    initCancelDialog(cls)
    openDialog('cancelDialog')
    setActiveMenu(null)
  }

  // 打开学生时段偏好对话框
  const handleOpenPreferenceDialog = (student: StudentWithPrefs) => {
    initPreferenceDialog(student)
    openDialog('preferenceDialog')
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

  // 处理AI排课选择 - 全选
  const handleSelectAllAiResults = () => {
    const newSet = new Set(aiResults.filter(r => !r.unmatched).map(r => r.student_id))
    // 直接调用 toggleAiResultSelection 来设置全选状态
    aiResults.filter(r => !r.unmatched).forEach(r => {
      if (!selectedAiResults.has(r.student_id)) {
        toggleAiResultSelection(r.student_id)
      }
    })
  }

  // 处理AI排课选择 - 清空
  const handleClearAiResultSelection = () => {
    selectedAiResults.forEach(id => toggleAiResultSelection(id))
  }

  // 处理AI排课选择 - 单个切换
  const handleToggleAiResult = (studentId: string) => {
    toggleAiResultSelection(studentId)
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
            <Button variant="outline" size="sm" onClick={() => openDialog('batchPrefDialog')}>
              <Users className="h-4 w-4 mr-2" />
              批量设置时段偏好
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => openDialog('addDateDialog')}>
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
                <span>{getDateTypeIcon(dateConfig.type)}</span>
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
              setClassForm(prev => ({
                ...prev,
                student_id: studentId,
                teacher_id: '',
                schedules,
                notes: ''
              }))
              openDialog('classDialog')
            }}
            aiScheduling={aiScheduling}
            aiResults={aiResults}
            aiConflicts={aiConflicts}
            aiError={aiError}
            selectedAiResults={selectedAiResults}
            extraInstructions={extraInstructions}
            setExtraInstructions={setExtraInstructions}
            onAISchedule={handleAISchedule}
            onSelectAllAiResults={handleSelectAllAiResults}
            onClearAiResultSelection={handleClearAiResultSelection}
            onToggleAiResult={handleToggleAiResult}
            onConfirmAISchedule={handleConfirmAISchedule}
            saving={aiSaving}
          />
        )}
      </div>

      {/* 对话框 */}
      <AddDateDialog
        open={dialogs.addDateDialog}
        onOpenChange={(open) => setDialogOpen('addDateDialog', open)}
        newDateForm={forms.newDateForm}
        setNewDateForm={setNewDateForm}
        onAdd={handleAddDate}
      />

      <ClassDialog
        open={dialogs.classDialog}
        onOpenChange={(open) => setDialogOpen('classDialog', open)}
        editingClass={editing.editingClass}
        classForm={forms.classForm}
        setClassForm={setClassForm}
        students={students}
        teachers={teachers}
        scheduleDates={scheduleDates}
        saving={saving}
        onSave={onSaveClass}
      />

      <RescheduleDialog
        open={dialogs.rescheduleDialog}
        onOpenChange={(open) => setDialogOpen('rescheduleDialog', open)}
        reschedulingClass={editing.reschedulingClass}
        rescheduleForm={forms.rescheduleForm}
        setRescheduleForm={setRescheduleForm}
        onConfirm={onReschedule}
      />

      <CancelDialog
        open={dialogs.cancelDialog}
        onOpenChange={(open) => setDialogOpen('cancelDialog', open)}
        cancellingClass={editing.cancellingClass}
        cancelReason={forms.cancelReason}
        setCancelReason={setCancelReason}
        onConfirm={onCancel}
      />

      <PreferenceDialog
        open={dialogs.preferenceDialog}
        onOpenChange={(open) => setDialogOpen('preferenceDialog', open)}
        selectedStudent={editing.selectedStudent}
        preferenceForm={forms.preferenceForm}
        setPreferenceForm={setPreferenceForm}
        onAddPreference={onAddPreference}
        onDeletePreference={onDeletePreference}
      />

      <BatchPrefDialog
        open={dialogs.batchPrefDialog}
        onOpenChange={(open) => setDialogOpen('batchPrefDialog', open)}
        students={students}
        batchSelectedStudents={editing.batchSelectedStudents}
        setBatchSelectedStudents={setBatchSelectedStudents}
        batchPrefForm={forms.batchPrefForm}
        setBatchPrefForm={setBatchPrefForm}
        batchSaving={batchSaving}
        onSave={onBatchSavePreferences}
      />
    </div>
  )
}