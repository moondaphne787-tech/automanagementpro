import { TrendingUp, Clock, CheckCircle, Users, AlertTriangle } from 'lucide-react'
import type { WeeklySummary } from '../../hooks/useDashboard'

interface WeeklyClassSummaryProps {
  summary: WeeklySummary | null
  loading: boolean
}

export function WeeklyClassSummary({ summary, loading }: WeeklyClassSummaryProps) {
  if (loading || !summary) {
    return (
      <div className="rounded-xl border border-border bg-card">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">课堂总结</h3>
        </div>
        <div className="p-4 space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-6 bg-muted animate-pulse rounded" />)}
        </div>
      </div>
    )
  }

  const metrics = [
    { icon: <Users className="w-3.5 h-3.5" />, label: '已上课', value: summary.totalLessons, unit: '节' },
    { icon: <Clock className="w-3.5 h-3.5" />, label: '总课时', value: summary.totalHours, unit: '小时' },
    { icon: <CheckCircle className="w-3.5 h-3.5" />, label: '完成率', value: summary.avgCompletionRate, unit: '%' },
    { icon: <TrendingUp className="w-3.5 h-3.5" />, label: '出勤率', value: summary.attendanceRate, unit: '%' },
  ]

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">{summary.label}课堂总结</h3>
        <span className="text-[10px] text-muted-foreground">{summary.dateRange}</span>
      </div>

      <div className="p-3">
        <div className="grid grid-cols-2 gap-2">
          {metrics.map((m, i) => (
            <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
              <span className="text-muted-foreground">{m.icon}</span>
              <div className="flex-1">
                <div className="text-[10px] text-muted-foreground">{m.label}</div>
                <div className="text-sm font-semibold text-foreground">
                  {m.value}<span className="text-[10px] font-normal text-muted-foreground ml-0.5">{m.unit}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {summary.unrecordedCount > 0 && (
          <div className="mt-2 flex items-center gap-2 px-2 py-1.5 rounded-lg bg-orange-50 dark:bg-orange-950/20 text-orange-600 dark:text-orange-400">
            <AlertTriangle className="w-3 h-3" />
            <span className="text-xs">{summary.unrecordedCount} 节课已上课但未录入记录</span>
          </div>
        )}
      </div>
    </div>
  )
}