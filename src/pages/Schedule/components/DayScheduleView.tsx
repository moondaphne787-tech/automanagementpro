import { motion } from 'framer-motion'
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  User,
  Pencil,
  RefreshCw,
  Trash2,
  CalendarDays,
  Sun,
  Moon
} from 'lucide-react'
import type { Student, Teacher, ScheduledClass } from '@/types'
import type { ScheduleDateConfig } from '@/ai/schedulePrompts'
import { Button } from '@/components/ui/button'
import { formatDate, formatDisplayDate, DAYTIME_SLOTS, EVENING_SLOTS } from '../types'

interface DayScheduleViewProps {
  scheduleDates: ScheduleDateConfig[]
  classes: (ScheduledClass & { student?: Student; teacher?: Teacher })[]
  activeMenu: string | null
  onPrevDay: () => void
  onNextDay: () => void
  currentDateIndex: number
  setCurrentDateIndex: (index: number) => void
  onCreateClass: (date?: string, time?: string) => void
  onClassClick: (e: React.MouseEvent, classId: string) => void
  menuPosition: { top: number; left: number } | null
  onEditClass: (cls: ScheduledClass) => void
  onReschedule: (cls: ScheduledClass) => void
  onCancel: (cls: ScheduledClass) => void
  onDeleteClass: (cls: ScheduledClass) => void
}

// 获取日期显示图标
function getDateIcon(type: ScheduleDateConfig['type']) {
  switch (type) {
    case 'friday_evening':
      return <Moon className="h-4 w-4 text-indigo-500" />
    case 'holiday':
      return <Sun className="h-4 w-4 text-amber-500" />
    default:
      return <Sun className="h-4 w-4 text-orange-500" />
  }
}

// 获取时间槽
function getTimeSlots(dateConfig: ScheduleDateConfig): string[] {
  if (dateConfig.type === 'friday_evening') {
    return EVENING_SLOTS
  }
  return DAYTIME_SLOTS
}

export function DayScheduleView({
  scheduleDates,
  classes,
  activeMenu,
  onPrevDay,
  onNextDay,
  currentDateIndex,
  setCurrentDateIndex,
  onCreateClass,
  onClassClick,
  menuPosition,
  onEditClass,
  onReschedule,
  onCancel,
  onDeleteClass
}: DayScheduleViewProps) {
  if (scheduleDates.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <CalendarDays className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>请点击"添加日期"按钮选择排课日期</p>
        </div>
      </div>
    )
  }

  const dateConfig = scheduleDates[currentDateIndex]
  if (!dateConfig) return null

  const dayClasses = classes.filter(c => c.class_date === dateConfig.date)
  const isToday = dateConfig.date === formatDate(new Date())
  const timeSlots = getTimeSlots(dateConfig)
  const startHour = dateConfig.type === 'friday_evening' ? 18 : 8

  return (
    <div className="flex-1 flex flex-col">
      {/* 日期导航 */}
      <div className="h-14 border-b bg-muted/30 flex items-center justify-between px-4">
        <Button variant="outline" size="icon" onClick={onPrevDay} disabled={currentDateIndex === 0}>
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <div className="flex items-center gap-3">
          {getDateIcon(dateConfig.type)}
          <div className="text-center">
            <div className="text-lg font-semibold">{dateConfig.label}</div>
            <div className="text-sm text-muted-foreground">
              {formatDisplayDate(new Date(dateConfig.date))}
              {dateConfig.type === 'friday_evening' && ' (晚)'}
              {dateConfig.type === 'holiday' && ' (假期)'}
              {isToday && ' · 今天'}
            </div>
          </div>
        </div>

        <Button variant="outline" size="icon" onClick={onNextDay} disabled={currentDateIndex === scheduleDates.length - 1}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* 日期指示器 */}
      {scheduleDates.length > 1 && (
        <div className="flex justify-center gap-2 py-2 bg-muted/20 border-b">
          {scheduleDates.map((d, i) => (
            <button
              key={d.date}
              onClick={() => setCurrentDateIndex(i)}
              className={`px-3 py-1 rounded-full text-xs transition-colors ${
                i === currentDateIndex ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      )}

      {/* 日历主体 */}
      <div className="flex-1 flex overflow-auto">
        {/* 时间轴 */}
        <div className="w-16 flex-shrink-0 border-r bg-muted/30">
          {timeSlots.map((time) => (
            <div key={time} className="flex items-start justify-end pr-2 pt-1 text-xs text-muted-foreground border-b" style={{ height: '60px' }}>
              {time}
            </div>
          ))}
        </div>

        {/* 课程区域 */}
        <div
          className="flex-1 relative"
          style={{ minHeight: `${timeSlots.length * 60}px` }}
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect()
            const y = e.clientY - rect.top
            const hour = Math.floor(y / 60) + startHour
            onCreateClass(dateConfig.date, `${hour.toString().padStart(2, '0')}:00`)
          }}
        >
          {/* 时间网格线 */}
          {timeSlots.map((time, i) => (
            <div key={time} className="absolute left-0 right-0 border-b border-dashed border-muted" style={{ top: `${i * 60}px`, height: '60px' }} />
          ))}

          {/* 课程卡片 */}
          {(() => {
            const classWithPosition = dayClasses
              .filter(cls => cls.status === 'scheduled')
              .map(cls => {
                const startTime = cls.start_time || '09:00'
                const endTime = cls.end_time || '10:00'
                const [startH, startM] = startTime.split(':').map(Number)
                const [endH, endM] = endTime.split(':').map(Number)
                const startOffset = (startH - startHour) * 60 + (startM || 0)
                const duration = (endH * 60 + (endM || 0)) - (startH * 60 + (startM || 0))
                return { ...cls, startOffset, duration, top: startOffset, height: duration }
              })

            const columns: (typeof classWithPosition)[] = []
            classWithPosition.forEach(cls => {
              let colIndex = 0
              for (let i = 0; i < columns.length; i++) {
                const hasConflict = columns[i].some(existing => !(cls.top + cls.height <= existing.top || cls.top >= existing.top + existing.height))
                if (!hasConflict) { colIndex = i; break }
                colIndex = columns.length
              }
              if (!columns[colIndex]) columns[colIndex] = []
              columns[colIndex].push(cls)
            })

            return classWithPosition.map(cls => {
              let colIndex = 0
              for (let i = 0; i < columns.length; i++) {
                if (columns[i]?.includes(cls)) { colIndex = i; break }
              }

              const maxCol = columns.length
              const width = `calc((100% - 16px) / ${maxCol})`
              const left = `calc((100% - 16px) / ${maxCol} * ${colIndex})`

              return (
                <motion.div
                  key={cls.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`absolute rounded-lg p-2 cursor-pointer shadow-sm border-2 ${
                    cls.status === 'cancelled' ? 'bg-red-50 border-red-200' : cls.status === 'rescheduled' ? 'bg-yellow-50 border-yellow-200' : 'bg-blue-50 border-blue-200 hover:border-blue-400'
                  } ${activeMenu === cls.id ? 'z-20 ring-2 ring-primary' : 'z-10'}`}
                  style={{ top: `${cls.top}px`, height: `${Math.max(cls.height, 40)}px`, width, left, minWidth: '80px' }}
                  onClick={(e) => onClassClick(e, cls.id)}
                >
                  <div className="flex flex-col h-full relative">
                    <div className="flex items-center gap-1 min-w-0">
                      <User className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      <span className="font-medium text-sm truncate">{cls.student?.name || '未知'}</span>
                    </div>
                    <div className="flex items-center gap-1 mt-1 min-w-0">
                      <Clock className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      <span className="text-xs text-muted-foreground">{cls.start_time?.slice(0, 5)}-{cls.end_time?.slice(0, 5)}</span>
                    </div>
                    {cls.teacher && <div className="text-xs text-muted-foreground mt-1 truncate">{cls.teacher.name}</div>}
                    {cls.status !== 'scheduled' && (
                      <div className={`absolute top-1 right-1 px-1.5 py-0.5 rounded text-[10px] ${cls.status === 'cancelled' ? 'bg-red-500 text-white' : 'bg-yellow-500 text-white'}`}>
                        {cls.status === 'cancelled' ? '已取消' : '已调课'}
                      </div>
                    )}
                  </div>
                </motion.div>
              )
            })
          })()}
        </div>
      </div>

      {/* 操作菜单 */}
      {activeMenu && menuPosition && (() => {
        const cls = classes.find(c => c.id === activeMenu)
        if (!cls || cls.status !== 'scheduled') return null
        return (
          <div className="fixed bg-card border rounded-lg shadow-lg py-1 z-[100] min-w-[120px]" style={{ top: `${menuPosition.top}px`, left: `${menuPosition.left}px` }} onClick={(e) => e.stopPropagation()}>
            <button className="w-full px-3 py-1.5 text-left text-sm hover:bg-muted flex items-center gap-2" onClick={() => onEditClass(cls)}><Pencil className="h-4 w-4" /> 编辑</button>
            <button className="w-full px-3 py-1.5 text-left text-sm hover:bg-muted flex items-center gap-2" onClick={() => onReschedule(cls)}><RefreshCw className="h-4 w-4" /> 调课</button>
            <button className="w-full px-3 py-1.5 text-left text-sm hover:bg-muted flex items-center gap-2" onClick={() => onCancel(cls)}><CalendarDays className="h-4 w-4" /> 取消</button>
            <button className="w-full px-3 py-1.5 text-left text-sm hover:bg-muted text-destructive flex items-center gap-2" onClick={() => onDeleteClass(cls)}><Trash2 className="h-4 w-4" /> 删除</button>
          </div>
        )
      })()}
    </div>
  )
}