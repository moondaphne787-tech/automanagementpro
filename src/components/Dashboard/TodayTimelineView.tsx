import { useNavigate } from 'react-router-dom'
import { CheckCircle2, AlertCircle, PenLine } from 'lucide-react'
import type { TodayScheduleItem } from '@/types'

interface TodayTimelineViewProps {
  schedules: TodayScheduleItem[]
  startHour: number
  totalMinutes: number
  hours: number[]
  onQuickRecord?: (schedule: TodayScheduleItem) => void
}

const TIMELINE_COLORS = [
  { bg: 'bg-blue-100 dark:bg-blue-900/30', border: 'border-blue-300 dark:border-blue-700', text: 'text-blue-700 dark:text-blue-300' },
  { bg: 'bg-emerald-100 dark:bg-emerald-900/30', border: 'border-emerald-300 dark:border-emerald-700', text: 'text-emerald-700 dark:text-emerald-300' },
  { bg: 'bg-purple-100 dark:bg-purple-900/30', border: 'border-purple-300 dark:border-purple-700', text: 'text-purple-700 dark:text-purple-300' },
  { bg: 'bg-orange-100 dark:bg-orange-900/30', border: 'border-orange-300 dark:border-orange-700', text: 'text-orange-700 dark:text-orange-300' },
  { bg: 'bg-pink-100 dark:bg-pink-900/30', border: 'border-pink-300 dark:border-pink-700', text: 'text-pink-700 dark:text-pink-300' },
]

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

export function TodayTimelineView({ schedules, startHour, totalMinutes, hours, onQuickRecord }: TodayTimelineViewProps) {
  const navigate = useNavigate()

  return (
    <div className="relative">
      {/* 时间刻度 */}
      <div className="flex items-end mb-1 ml-0">
        {hours.map(h => {
          const offset = ((h - startHour) * 60 / totalMinutes) * 100
          return (
            <div
              key={h}
              className="absolute text-[10px] text-muted-foreground"
              style={{ left: `${offset}%` }}
            >
              {String(h).padStart(2, '0')}:00
            </div>
          )
        })}
      </div>

      {/* 时间轴背景 */}
      <div className="relative mt-5 mb-2">
        <div className="h-px bg-border w-full" />
        {hours.map(h => {
          const offset = ((h - startHour) * 60 / totalMinutes) * 100
          return (
            <div
              key={h}
              className="absolute top-0 w-px h-2 bg-border -translate-y-1/2"
              style={{ left: `${offset}%` }}
            />
          )
        })}
      </div>

      {/* 课程块 */}
      <div className="relative space-y-1.5 mt-1">
        {schedules.map((s, i) => {
          const startMin = timeToMinutes(s.startTime) - startHour * 60
          const endMin = timeToMinutes(s.endTime) - startHour * 60
          const left = (startMin / totalMinutes) * 100
          const width = ((endMin - startMin) / totalMinutes) * 100
          const color = TIMELINE_COLORS[i % TIMELINE_COLORS.length]

          return (
            <div key={i} className="relative h-8">
              <button
                onClick={() => navigate(`/students/${s.studentId}`)}
                className={`absolute h-full rounded-md border ${color.bg} ${color.border} hover:opacity-80 transition-opacity flex items-center gap-1.5 px-2 overflow-hidden`}
                style={{ left: `${left}%`, width: `${Math.max(width, 8)}%` }}
                title={`${s.startTime}-${s.endTime} ${s.studentName}${s.teacherName ? ` (${s.teacherName})` : ''}`}
              >
                <span className={`text-[10px] font-medium truncate ${color.text}`}>
                  {s.studentName}
                </span>
                {s.hasPlan
                  ? <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500 flex-shrink-0" />
                  : <AlertCircle className="w-2.5 h-2.5 text-orange-400 flex-shrink-0" />
                }
                {!s.hasClassRecord && onQuickRecord && (
                  <span
                    onClick={(e) => { e.stopPropagation(); onQuickRecord(s) }}
                    className="flex-shrink-0 cursor-pointer"
                    title="快速录入"
                  >
                    <PenLine className="w-2.5 h-2.5 text-primary" />
                  </span>
                )}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
