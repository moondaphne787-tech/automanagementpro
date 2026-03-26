import { useNavigate } from 'react-router-dom'
import { User, CheckCircle2, AlertCircle, FileText } from 'lucide-react'
import type { TodayScheduleItem } from '../../hooks/useDashboard'

interface TodaySchedulePanelProps {
  schedules: TodayScheduleItem[]
  loading: boolean
}

export function TodaySchedulePanel({ schedules, loading }: TodaySchedulePanelProps) {
  const navigate = useNavigate()
  const today = new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground">今日排课</h3>
          <span className="text-xs text-muted-foreground">{today}</span>
        </div>
        {schedules.length > 0 && (
          <span className="text-xs text-muted-foreground">{schedules.length} 节课</span>
        )}
      </div>

      <div className="p-3">
        {loading ? (
          <div className="space-y-2">
            {[1, 2].map(i => <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />)}
          </div>
        ) : schedules.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <p className="text-xs">今日无排课</p>
          </div>
        ) : (
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
                <div className="flex flex-col gap-1 flex-shrink-0">
                  {s.hasPlan
                    ? <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                    : <AlertCircle className="w-3 h-3 text-orange-400" />
                  }
                  {s.hasClassRecord
                    ? <FileText className="w-3 h-3 text-blue-500" />
                    : <FileText className="w-3 h-3 text-muted-foreground/40" />
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