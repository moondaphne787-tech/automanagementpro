import { useMemo } from 'react'
import { HOUR_WIDTH } from './constants'
import { minutesToTime } from '@/lib/utils'
import { StudentRowComponent } from './StudentRow'
import type { TeacherWithColor } from './types'

interface StudentSchedulePanelProps {
  studentRows: any[]
  timeRange: { start: number; end: number }
  teachers: TeacherWithColor[]
  selectedDate: string
  headerScrollRef: React.RefObject<HTMLDivElement>
  getTeacherAssignStatuses: any
  onAssign: any
  onRemove: any
  onAddPreference: any
}

export function StudentSchedulePanel({
  studentRows, timeRange, teachers, selectedDate,
  headerScrollRef, getTeacherAssignStatuses,
  onAssign, onRemove, onAddPreference
}: StudentSchedulePanelProps) {
  const timeLabels = useMemo(() => {
    const labels: string[] = []
    for (let min = timeRange.start; min <= timeRange.end; min += 60) {
      labels.push(minutesToTime(min))
    }
    return labels
  }, [timeRange])

  const timelineWidth = ((timeRange.end - timeRange.start) / 60) * HOUR_WIDTH

  return (
    <>
      {/* 时间轴头部 */}
      <div className="h-10 border-b bg-muted/30 flex flex-shrink-0">
        <div className="w-32 flex-shrink-0 border-r flex items-center justify-center text-sm font-medium text-muted-foreground">
          学生
        </div>
        <div ref={headerScrollRef} className="flex-1 overflow-x-auto overflow-y-hidden scrollbar-none">
          <div className="flex" style={{ width: `${timelineWidth}px` }}>
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

      {/* 学生行 */}
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
              onAssign={onAssign}
              onRemove={onRemove}
              selectedDate={selectedDate}
              onAddPreference={onAddPreference}
            />
          ))
        )}
      </div>
    </>
  )
}
