import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Loader2 } from 'lucide-react'
import { useManualSchedule } from './hooks/useManualSchedule'
import { DateNavigationBar } from './DateNavigationBar'
import { StudentSchedulePanel } from './StudentSchedulePanel'
import { TeacherSchedulePanel } from './TeacherSchedulePanel'
import { AIPreviewSection } from './AIPreviewSection'
import { TeacherDetailCard } from './TeacherDetailCard'
import { ScheduleSidebar, type ScheduleSidebarProps } from './ScheduleSidebar'
import type { TeacherCardData } from './types'
import type { AIScheduleResult } from '@/ai/schedulePrompts'

export interface ManualScheduleSidebarProps {
  sidebarProps?: Omit<ScheduleSidebarProps, 'collapsed' | 'onToggleCollapse'>
  aiResults?: AIScheduleResult[]
  selectedAiResults?: Set<string>
}

interface ManualScheduleProps extends ManualScheduleSidebarProps {
  initialDate?: string
}

export function ManualSchedule({ initialDate, sidebarProps, aiResults, selectedAiResults }: ManualScheduleProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const {
    selectedDate, setSelectedDate,
    students, teachers, scheduledClasses, loading, saving,
    localSchedules, studentRows, timeRange, teacherCards,
    goToPrevDay, goToNextDay, goToToday,
    handleAssign, handleRemove, handleClearDay, handleSave,
    getTeacherAssignStatuses, loadSchedulesForDate, handleAddPreference
  } = useManualSchedule({ initialDate })

  const [showOnlyAvailable, setShowOnlyAvailable] = useState(true)
  const [selectedTeacherCard, setSelectedTeacherCard] = useState<TeacherCardData | null>(null)
  const [teacherPanelCollapsed, setTeacherPanelCollapsed] = useState(false)
  const [studentPanelHeightPercent, setStudentPanelHeightPercent] = useState(60)
  const [isDragging, setIsDragging] = useState(false)
  const [quickAddTime, setQuickAddTime] = useState({ start: '09:00', end: '11:00' })
  const [quickAddTodayOnly, setQuickAddTodayOnly] = useState(true)

  const headerScrollRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // 分隔线拖动
  const handleDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const newPercent = ((e.clientY - rect.top) / rect.height) * 100
      setStudentPanelHeightPercent(Math.max(30, Math.min(85, newPercent)))
    }
    const handleMouseUp = () => setIsDragging(false)

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging])

  // 滚动同步
  useEffect(() => {
    const headerEl = headerScrollRef.current
    const containerEl = containerRef.current
    if (!headerEl || !containerEl) return

    const handleScroll = () => {
      const scrollLeft = headerEl.scrollLeft
      const timelineElements = containerEl.querySelectorAll('[data-scroll-sync="timeline"]')
      timelineElements.forEach((el) => {
        (el as HTMLElement).style.transform = `translateX(-${scrollLeft}px)`
      })
    }

    headerEl.addEventListener('scroll', handleScroll)
    return () => headerEl.removeEventListener('scroll', handleScroll)
  }, [loading, teacherPanelCollapsed])

  const handleCloseTeacherDetail = useCallback(() => setSelectedTeacherCard(null), [])

  const handleRemoveClassFromDetail = useCallback(async (classId: string) => {
    const { scheduledClassDb } = await import('@/db')
    await scheduledClassDb.delete(classId)
    loadSchedulesForDate(selectedDate)
  }, [selectedDate, loadSchedulesForDate])

  const handleQuickAddStudentToday = useCallback(async (studentId: string) => {
    await handleAddPreference(studentId, selectedDate, quickAddTime.start, quickAddTime.end, quickAddTodayOnly)
  }, [handleAddPreference, selectedDate, quickAddTime, quickAddTodayOnly])

  const studentsNotInPanel = useMemo(() => {
    const panelStudentIds = new Set(studentRows.map(row => row.student.id))
    return students.filter(s => !panelStudentIds.has(s.id))
  }, [students, studentRows])

  const aiPreviewResults = useMemo(() => {
    if (!aiResults || !selectedAiResults || aiResults.length === 0) return []
    return aiResults.filter(r =>
      !r.unmatched && r.date === selectedDate && selectedAiResults.has(r.student_id)
    )
  }, [aiResults, selectedAiResults, selectedDate])

  return (
    <div className="h-full flex">
      <div className="flex-1 flex flex-col min-w-0">
        <DateNavigationBar
          selectedDate={selectedDate}
          saving={saving}
          localSchedulesCount={localSchedules.size}
          studentsNotInPanel={studentsNotInPanel}
          quickAddTime={quickAddTime}
          quickAddTodayOnly={quickAddTodayOnly}
          onDateChange={setSelectedDate}
          onPrevDay={goToPrevDay}
          onNextDay={goToNextDay}
          onToday={goToToday}
          onClearDay={handleClearDay}
          onSave={handleSave}
          onQuickAddTimeChange={setQuickAddTime}
          onQuickAddTodayOnlyChange={setQuickAddTodayOnly}
          onQuickAddStudent={handleQuickAddStudentToday}
        />

        <div ref={containerRef} className="flex-1 flex flex-col overflow-hidden relative select-none">
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* 学生排课区 */}
              <div
                className="flex flex-col overflow-hidden flex-shrink-0"
                style={{ height: `${studentPanelHeightPercent}%` }}
              >
                <StudentSchedulePanel
                  studentRows={studentRows}
                  timeRange={timeRange}
                  teachers={teachers}
                  selectedDate={selectedDate}
                  headerScrollRef={headerScrollRef}
                  getTeacherAssignStatuses={getTeacherAssignStatuses}
                  onAssign={handleAssign}
                  onRemove={handleRemove}
                  onAddPreference={handleAddPreference}
                />
              </div>

              {/* 可拖动分隔栏 */}
              <div
                className={`h-1.5 bg-border hover:bg-primary/50 cursor-row-resize flex-shrink-0 transition-colors ${isDragging ? 'bg-primary' : ''}`}
                onMouseDown={handleDividerMouseDown}
              />

              {/* 助教排课区 */}
              <TeacherSchedulePanel
                teacherCards={teacherCards}
                timeRange={timeRange}
                scheduledClasses={scheduledClasses}
                students={students}
                selectedDate={selectedDate}
                showOnlyAvailable={showOnlyAvailable}
                collapsed={teacherPanelCollapsed}
                onToggleShowOnlyAvailable={() => setShowOnlyAvailable(!showOnlyAvailable)}
                onToggleCollapsed={() => setTeacherPanelCollapsed(!teacherPanelCollapsed)}
                onSelectTeacher={setSelectedTeacherCard}
              />

              {/* AI 排课预览 */}
              <AIPreviewSection
                aiResults={aiPreviewResults}
                students={students}
                teachers={teachers}
                timeRange={timeRange}
              />

              {/* 助教详情浮层 */}
              {selectedTeacherCard && (
                <TeacherDetailCard
                  open={selectedTeacherCard !== null}
                  onClose={handleCloseTeacherDetail}
                  teacherData={selectedTeacherCard}
                  scheduledClasses={scheduledClasses}
                  students={students}
                  onRemoveClass={handleRemoveClassFromDetail}
                  selectedDate={selectedDate}
                />
              )}
            </>
          )}
        </div>
      </div>

      {sidebarProps && (
        <ScheduleSidebar
          {...sidebarProps}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
      )}
    </div>
  )
}
