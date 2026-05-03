import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, CheckCircle2, AlertCircle, FileText, PenLine, LayoutGrid, Clock } from 'lucide-react'
import { TodayTimelineView } from './TodayTimelineView'
import type { TodayScheduleItem } from '@/types'

type ViewMode = 'grid' | 'timeline'

interface TodaySchedulePanelProps {
  schedules: TodayScheduleItem[]
  loading: boolean
  onQuickRecord?: (schedule: TodayScheduleItem) => void
}

/** 将 "HH:MM" 转为分钟数 */
function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

export function TodaySchedulePanel({ schedules, loading, onQuickRecord }: TodaySchedulePanelProps) {
  const navigate = useNavigate()
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const today = new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })

  // 计算时间线范围
  const timelineRange = useMemo(() => {
    if (schedules.length === 0) return { startHour: 8, endHour: 18, hours: [] as number[] }
    const starts = schedules.map(s => timeToMinutes(s.startTime))
    const ends = schedules.map(s => timeToMinutes(s.endTime))
    const startHour = Math.max(Math.floor(Math.min(...starts) / 60), 7)
    const endHour = Math.min(Math.ceil(Math.max(...ends) / 60) + 1, 22)
    const hours: number[] = []
    for (let h = startHour; h <= endHour; h++) hours.push(h)
    return { startHour, endHour, hours }
  }, [schedules])

  const totalMinutes = (timelineRange.endHour - timelineRange.startHour) * 60

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground">今日排课</h3>
          <span className="text-xs text-muted-foreground">{today}</span>
        </div>
        <div className="flex items-center gap-2">
          {schedules.length > 0 && (
            <>
              <span className="text-xs text-muted-foreground">{schedules.length} 节课</span>
              <div className="flex rounded-md border border-border overflow-hidden">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-1 transition-colors ${viewMode === 'grid' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                  title="卡片视图"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setViewMode('timeline')}
                  className={`p-1 transition-colors ${viewMode === 'timeline' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                  title="时间线视图"
                >
                  <Clock className="w-3.5 h-3.5" />
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="p-3">
        {loading ? (
          <div className="grid grid-cols-2 gap-2">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg border border-border">
                <div className="flex-shrink-0 space-y-1">
                  <div className="h-3 w-8 bg-muted animate-pulse rounded" />
                  <div className="h-2 w-6 bg-muted animate-pulse rounded" />
                </div>
                <div className="w-px h-8 bg-border flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-16 bg-muted animate-pulse rounded" />
                  <div className="h-2 w-10 bg-muted animate-pulse rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : schedules.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <p className="text-xs">今日无排课</p>
          </div>
        ) : viewMode === 'timeline' ? (
          <TodayTimelineView
            schedules={schedules}
            startHour={timelineRange.startHour}
            totalMinutes={totalMinutes}
            hours={timelineRange.hours}
            onQuickRecord={onQuickRecord}
          />
        ) : (
          /* ===== 卡片视图 ===== */
          <div className="grid grid-cols-2 gap-2">
            {schedules.map((s, i) => (
              <button
                key={i}
                onClick={() => navigate(`/students/${s.studentId}`)}
                className="flex items-center gap-3 p-2.5 rounded-lg border border-border hover:bg-muted/50 transition-colors text-left group"
              >
                <div className="flex-shrink-0 text-center">
                  <div className="text-xs font-semibold text-foreground">{s.startTime}</div>
                  <div className="text-[10px] text-muted-foreground">{s.endTime}</div>
                </div>
                <div className="w-px h-8 bg-border flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-medium text-foreground truncate">{s.studentName}</span>
                    {s.grade && <span className="text-[10px] text-muted-foreground flex-shrink-0">{s.grade}</span>}
                  </div>
                  {s.teacherName && (
                    <div className="text-[10px] text-muted-foreground flex items-center gap-0.5 mt-0.5">
                      <User className="w-2.5 h-2.5" />
                      {s.teacherName}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1 flex-shrink-0 items-center">
                  {s.hasPlan
                    ? <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                    : <AlertCircle className="w-3 h-3 text-orange-400" />
                  }
                  {s.hasClassRecord
                    ? <FileText className="w-3 h-3 text-blue-500" />
                    : onQuickRecord ? (
                      <span
                        onClick={(e) => {
                          e.stopPropagation()
                          onQuickRecord(s)
                        }}
                        className="p-0.5 rounded hover:bg-primary/10 transition-colors cursor-pointer"
                        title="快速录入课堂记录"
                      >
                        <PenLine className="w-3 h-3 text-primary" />
                      </span>
                    ) : (
                      <FileText className="w-3 h-3 text-muted-foreground/40" />
                    )
                  }
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
