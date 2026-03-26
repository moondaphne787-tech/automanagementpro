import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Check, Loader2, Trash2, ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DateInput } from '@/components/ui/date-input'
import { HOUR_WIDTH, DAY_LABELS } from './constants'
import { useManualSchedule, getDayOfWeek, minutesToTime, formatDate } from './hooks/useManualSchedule'
import { StudentRowComponent } from './StudentRow'
import { TeacherTimelineRow } from './TeacherTimeline'
import { TeacherDetailCard } from './TeacherDetailCard'
import type { DayOfWeek } from './types'

interface ManualScheduleProps {
  initialDate?: string  // 初始日期参数
}

export function ManualSchedule({ initialDate }: ManualScheduleProps) {
  // 使用自定义hook获取排课逻辑
  const {
    selectedDate,
    setSelectedDate,
    students,
    teachers,
    scheduledClasses,
    loading,
    saving,
    localSchedules,
    studentRows,
    timeRange,
    teacherCards,
    goToPrevDay,
    goToNextDay,
    goToToday,
    handleAssign,
    handleRemove,
    handleClearDay,
    handleSave,
    getTeacherAssignStatuses,
    loadSchedulesForDate
  } = useManualSchedule({ initialDate })
  
  // 筛选状态：只显示有可用时段的助教
  const [showOnlyAvailable, setShowOnlyAvailable] = useState(true)
  
  // 助教详情面板状态
  const [selectedTeacherCard, setSelectedTeacherCard] = useState<import('./types').TeacherCardData | null>(null)
  
  // 助教面板折叠状态
  const [teacherPanelCollapsed, setTeacherPanelCollapsed] = useState(false)
  
  // 横向滚动位置（用于同步学生和助教面板）
  const [scrollLeft, setScrollLeft] = useState(0)
  
  // 分隔线拖动状态 - 学生区高度百分比
  const [studentPanelHeightPercent, setStudentPanelHeightPercent] = useState(60)
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  
  // 分隔线拖动处理
  const handleDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])
  
  // 全局拖动事件
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return
      
      const container = containerRef.current
      const rect = container.getBoundingClientRect()
      const newPercent = ((e.clientY - rect.top) / rect.height) * 100
      
      // 限制范围：最小30%，最大85%
      const clampedPercent = Math.max(30, Math.min(85, newPercent))
      setStudentPanelHeightPercent(clampedPercent)
    }
    
    const handleMouseUp = () => {
      setIsDragging(false)
    }
    
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging])
  
  // 关闭详情面板
  const handleCloseTeacherDetail = useCallback(() => {
    setSelectedTeacherCard(null)
  }, [])
  
  // 从详情面板取消排课
  const handleRemoveClassFromDetail = useCallback(async (classId: string) => {
    const { scheduledClassDb } = await import('@/db')
    await scheduledClassDb.delete(classId)
    loadSchedulesForDate(selectedDate)
  }, [selectedDate, loadSchedulesForDate])
  
  // 横向滚动同步 - 只需要监听时间轴头部的滚动
  const headerScrollRef = useRef<HTMLDivElement>(null)
  
  // 监听时间轴头部滚动，同步更新 scrollLeft 状态
  useEffect(() => {
    const headerEl = headerScrollRef.current
    if (!headerEl) return
    
    const handleScroll = () => {
      setScrollLeft(headerEl.scrollLeft)
    }
    
    headerEl.addEventListener('scroll', handleScroll)
    return () => {
      headerEl.removeEventListener('scroll', handleScroll)
    }
  }, [loading])
  
  // 生成时间轴标签
  const timeLabels = useMemo(() => {
    const labels: string[] = []
    for (let min = timeRange.start; min <= timeRange.end; min += 60) {
      labels.push(minutesToTime(min))
    }
    return labels
  }, [timeRange])
  
  // 快捷日期列表（整周：周一到周日）
  const quickDates = useMemo(() => {
    const today = new Date()
    const dates: { date: string; label: string; icon: 'moon' | 'sun'; dayOfWeek: DayOfWeek }[] = []
    
    // 找到本周的周一
    const monday = new Date(today)
    const dayOfWeek = today.getDay()
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1 // 周日需要回退6天
    monday.setDate(today.getDate() - daysToMonday)
    
    const dayOrder: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    
    dayOrder.forEach((day, index) => {
      const date = new Date(monday)
      date.setDate(monday.getDate() + index)
      
      // 周五显示月亮（晚上），周六周日显示太阳，其他天不显示图标
      let icon: 'moon' | 'sun' | null = null
      if (day === 'friday') {
        icon = 'moon'
      } else if (day === 'saturday' || day === 'sunday') {
        icon = 'sun'
      }
      
      dates.push({
        date: date.toISOString().split('T')[0],
        label: DAY_LABELS[day],
        icon: icon as 'moon' | 'sun',
        dayOfWeek: day
      })
    })
    
    return dates
  }, [])
  
  return (
    <div className="h-full flex flex-col">
      {/* 顶部工具栏 */}
      <header className="h-14 border-b bg-card flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold">人工排课</h1>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={goToPrevDay}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <DateInput value={selectedDate} onChange={(date: string | Date) => {
              if (typeof date === 'string') {
                setSelectedDate(date)
              } else {
                setSelectedDate(formatDate(date))
              }
            }} />
            <Button variant="outline" size="icon" onClick={goToNextDay}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={goToToday}>今天</Button>
          </div>
          
          <span className="text-sm text-muted-foreground">
            {DAY_LABELS[getDayOfWeek(selectedDate)]}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleClearDay}>
            <Trash2 className="h-4 w-4 mr-2" />
            清空本日排课
          </Button>
          <Button onClick={handleSave} disabled={saving || localSchedules.size === 0}>
            {saving ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />保存中...</>
            ) : (
              <><Check className="h-4 w-4 mr-2" />保存排课 ({localSchedules.size})</>
            )}
          </Button>
        </div>
      </header>
      
      {/* 主内容区：上下分区 */}
      <div ref={containerRef} className="flex-1 flex flex-col overflow-hidden relative select-none">
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* 上方：学生排课区（动态高度，内容可滚动） */}
            <div 
              className="flex flex-col overflow-hidden flex-shrink-0" 
              style={{ height: `${studentPanelHeightPercent}%` }}
            >
              {/* 时间轴头部（带学生列标题） */}
              <div className="h-10 border-b bg-muted/30 flex flex-shrink-0">
                <div className="w-32 flex-shrink-0 border-r flex items-center justify-center text-sm font-medium text-muted-foreground">
                  学生
                </div>
                <div
                  ref={headerScrollRef}
                  className="flex-1 overflow-x-auto overflow-y-hidden scrollbar-none"
                >
                  <div className="flex" style={{ width: `${((timeRange.end - timeRange.start) / 60) * HOUR_WIDTH}px` }}>
                    {timeLabels.map((time) => (
                      <div
                        key={time}
                        className="flex-shrink-0 text-center text-xs text-muted-foreground border-l"
                        style={{ width: `${HOUR_WIDTH}px` }}
                      >
                        {time.slice(0, 5)}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              
              {/* 学生行（可纵向滚动） */}
              <div className="flex-1 overflow-y-auto">
                {studentRows.length === 0 ? (
                  <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
                    今日无待排课学生（请先为学生设置时段偏好）
                  </div>
                ) : (
                  studentRows.map(row => (
                    <StudentRowComponent
                      key={row.student.id}
                      row={row}
                      timeRangeStart={timeRange.start}
                      timeRangeEnd={timeRange.end}
                      teachers={teachers}
                      getTeacherAssignStatuses={getTeacherAssignStatuses}
                      onAssign={handleAssign}
                      onRemove={handleRemove}
                      scrollLeft={scrollLeft}
                    />
                  ))
                )}
              </div>
            </div>
            
            {/* 可拖动分隔栏 */}
            <div
              className={`h-1.5 bg-border hover:bg-primary/50 cursor-row-resize flex-shrink-0 transition-colors ${
                isDragging ? 'bg-primary' : ''
              }`}
              onMouseDown={handleDividerMouseDown}
            />
            
            {/* 分隔栏信息栏 + 折叠控制 */}
            <div
              className="h-7 border-b bg-muted/30 flex items-center justify-between px-4 flex-shrink-0"
            >
              <span className="text-xs font-medium text-muted-foreground">
                今日助教排课一览
                <span className="ml-2 text-primary">
                  ({teacherCards.filter(c => c.hasAvailabilityToday).length} 位有时段)
                </span>
              </span>
              <div className="flex items-center gap-2">
                {/* 可用助教筛选切换 */}
                <button
                  className={`text-[10px] px-2 py-0.5 rounded ${
                    showOnlyAvailable ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                  }`}
                  onClick={e => { e.stopPropagation(); setShowOnlyAvailable(!showOnlyAvailable) }}
                >
                  {showOnlyAvailable ? '仅今日有空' : '显示全部'}
                </button>
                <button
                  className="p-0.5 rounded hover:bg-muted"
                  onClick={() => setTeacherPanelCollapsed(!teacherPanelCollapsed)}
                  title={teacherPanelCollapsed ? '展开助教面板' : '折叠助教面板'}
                >
                  {teacherPanelCollapsed 
                    ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  }
                </button>
              </div>
            </div>
            
            {/* 下方：助教排课一览（动态高度，填充剩余空间） */}
            {!teacherPanelCollapsed && (
              <div className="border-b flex flex-col flex-1 overflow-hidden">
                {/* 助教面板时间轴头部 */}
                <div className="h-7 border-b bg-muted/20 flex flex-shrink-0">
                  <div className="w-32 flex-shrink-0 border-r flex items-center px-2">
                    <span className="text-xs text-muted-foreground">助教</span>
                  </div>
                  {/* 时间轴标签（只读，与上方同步显示） */}
                  <div className="flex-1 overflow-hidden">
                    <div className="flex" style={{ width: `${((timeRange.end - timeRange.start) / 60) * HOUR_WIDTH}px`, transform: `translateX(-${scrollLeft}px)` }}>
                      {timeLabels.map((time) => (
                        <div
                          key={time}
                          className="flex-shrink-0 text-center text-[10px] text-muted-foreground border-l"
                          style={{ width: `${HOUR_WIDTH}px` }}
                        >
                          {time.slice(0, 5)}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                
                {/* 助教行（可纵向滚动，填充剩余空间） */}
                <div className="overflow-y-auto flex-1">
                  {(() => {
                    const displayCards = showOnlyAvailable
                      ? teacherCards.filter(c => c.hasAvailabilityToday)
                      : teacherCards
                    
                    if (displayCards.length === 0) {
                      return (
                        <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
                          今日无可用助教
                        </div>
                      )
                    }
                    
                    return displayCards.map(card => (
                      <TeacherTimelineRow
                        key={card.teacher.id}
                        card={card}
                        timeRangeStart={timeRange.start}
                        timeRangeEnd={timeRange.end}
                        scheduledClasses={scheduledClasses}
                        students={students}
                        scrollLeft={scrollLeft}
                        selectedDate={selectedDate}
                        onClick={() => setSelectedTeacherCard(card)}
                      />
                    ))
                  })()}
                </div>
              </div>
            )}
            
            {/* 助教详情浮层（点击助教行后出现） */}
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
  )
}