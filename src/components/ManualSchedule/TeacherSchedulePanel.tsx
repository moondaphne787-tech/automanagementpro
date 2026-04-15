import { useMemo } from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'
import { HOUR_WIDTH } from './constants'
import { minutesToTime } from '@/lib/utils'
import { TeacherTimelineRow } from './TeacherTimeline'
import type { Student, ScheduledClass, Billing, StudentSchedulePreference } from '@/types'
import type { TeacherCardData } from './types'

type StudentWithExtra = Student & { billing: Billing | null; preferences: StudentSchedulePreference[] }

interface TeacherSchedulePanelProps {
  teacherCards: TeacherCardData[]
  timeRange: { start: number; end: number }
  scheduledClasses: ScheduledClass[]
  students: StudentWithExtra[]
  selectedDate: string
  showOnlyAvailable: boolean
  collapsed: boolean
  onToggleShowOnlyAvailable: () => void
  onToggleCollapsed: () => void
  onSelectTeacher: (card: TeacherCardData) => void
}

export function TeacherSchedulePanel({
  teacherCards, timeRange, scheduledClasses, students, selectedDate,
  showOnlyAvailable, collapsed,
  onToggleShowOnlyAvailable, onToggleCollapsed, onSelectTeacher
}: TeacherSchedulePanelProps) {
  const timeLabels = useMemo(() => {
    const labels: string[] = []
    for (let min = timeRange.start; min <= timeRange.end; min += 60) {
      labels.push(minutesToTime(min))
    }
    return labels
  }, [timeRange])

  const timelineWidth = ((timeRange.end - timeRange.start) / 60) * HOUR_WIDTH

  const displayCards = showOnlyAvailable
    ? teacherCards.filter(c => c.hasAvailabilityToday)
    : teacherCards

  return (
    <>
      {/* 信息栏 + 折叠控制 */}
      <div className="h-7 border-b bg-muted/30 flex items-center justify-between px-4 flex-shrink-0">
        <span className="text-xs font-medium text-muted-foreground">
          今日助教排课一览
          <span className="ml-2 text-primary">
            ({teacherCards.filter(c => c.hasAvailabilityToday).length} 位有时段)
          </span>
        </span>
        <div className="flex items-center gap-2">
          <button
            className={`text-[10px] px-2 py-0.5 rounded ${
              showOnlyAvailable ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
            }`}
            onClick={e => { e.stopPropagation(); onToggleShowOnlyAvailable() }}
          >
            {showOnlyAvailable ? '仅今日有空' : '显示全部'}
          </button>
          <button
            className="p-0.5 rounded hover:bg-muted"
            onClick={onToggleCollapsed}
            title={collapsed ? '展开助教面板' : '折叠助教面板'}
          >
            {collapsed
              ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
              : <ChevronDown className="h-4 w-4 text-muted-foreground" />
            }
          </button>
        </div>
      </div>

      {/* 助教面板内容 */}
      {!collapsed && (
        <div className="border-b flex flex-col flex-1 overflow-hidden">
          {/* 时间轴头部 */}
          <div className="h-7 border-b bg-muted/20 flex flex-shrink-0">
            <div className="w-32 flex-shrink-0 border-r flex items-center px-2">
              <span className="text-xs text-muted-foreground">助教</span>
            </div>
            <div data-scroll-sync="timeline" className="flex-1 overflow-x-hidden overflow-y-hidden">
              <div className="flex" style={{ width: `${timelineWidth}px` }}>
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

          {/* 助教行 */}
          <div className="overflow-y-auto flex-1">
            {displayCards.length === 0 ? (
              <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
                今日无可用助教
              </div>
            ) : (
              displayCards.map(card => (
                <TeacherTimelineRow
                  key={card.teacher.id}
                  card={card}
                  timeRangeStart={timeRange.start}
                  timeRangeEnd={timeRange.end}
                  scheduledClasses={scheduledClasses}
                  students={students}
                  selectedDate={selectedDate}
                  onClick={() => onSelectTeacher(card)}
                />
              ))
            )}
          </div>
        </div>
      )}
    </>
  )
}
