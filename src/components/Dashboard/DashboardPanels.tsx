import { useNavigate } from 'react-router-dom'
import { User, CheckCircle2, AlertCircle, FileText, PenLine, AlertTriangle, XCircle, Clock, Sparkles } from 'lucide-react'
import type { TodayScheduleItem, PlanStatusItem } from '@/types'

// ===== TodaySchedulePanel =====

interface TodaySchedulePanelProps {
  schedules: TodayScheduleItem[]
  loading: boolean
  onQuickRecord?: (schedule: TodayScheduleItem) => void
}

export function TodaySchedulePanel({ schedules, loading, onQuickRecord }: TodaySchedulePanelProps) {
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

// ===== WeeklyPlanStatus =====

const issueConfig = {
  missing: { icon: <XCircle className="w-3 h-3 text-red-500" />, label: '无计划', bg: 'bg-red-50/50 dark:bg-red-950/20' },
  expired: { icon: <Clock className="w-3 h-3 text-orange-500" />, label: '有过期', bg: 'bg-orange-50/50 dark:bg-orange-950/20' },
  partial: { icon: <AlertTriangle className="w-3 h-3 text-yellow-500" />, label: '不够用', bg: 'bg-yellow-50/50 dark:bg-yellow-950/20' },
}

interface WeeklyPlanStatusProps {
  items: PlanStatusItem[]
  loading: boolean
  onBatchGenerate?: (studentIds: string[]) => void
}

export function WeeklyPlanStatus({ items, loading, onBatchGenerate }: WeeklyPlanStatusProps) {
  const navigate = useNavigate()

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">本周计划状态</h3>
        <div className="flex items-center gap-2">
          {!loading && items.length > 0 && (
            <button
              onClick={() => onBatchGenerate?.(items.map(i => i.studentId))}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-primary bg-primary/10 hover:bg-primary/20 transition-colors"
            >
              <Sparkles className="w-3 h-3" />
              批量生成
            </button>
          )}
          <span className="text-xs text-muted-foreground">
            {loading ? '...' : items.length === 0 ? '全部已就绪' : `${items.length} 位需处理`}
          </span>
        </div>
      </div>

      <div className="p-2">
        {loading ? (
          <div className="space-y-1">
            {[1, 2, 3].map(i => (
              <div key={i} className="grid grid-cols-[1fr_auto_2fr_auto] gap-2 items-center px-2 py-1.5">
                <div className="h-3 w-16 bg-muted animate-pulse rounded" />
                <div className="h-2.5 w-10 bg-muted animate-pulse rounded" />
                <div className="h-2.5 w-24 bg-muted animate-pulse rounded" />
                <div className="h-4 w-10 bg-muted animate-pulse rounded-full" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-5 text-muted-foreground">
            <p className="text-xs">本周所有学员计划已就绪</p>
          </div>
        ) : (
          <div>
            <div className="grid grid-cols-[1fr_auto_2fr_auto] gap-2 items-center px-2 py-1 text-[10px] text-muted-foreground font-medium border-b border-border/50">
              <span>学员</span>
              <span>年级</span>
              <span>状态</span>
              <span>类型</span>
            </div>
            <div className="space-y-0.5 mt-0.5">
              {items.map(item => {
                const cfg = issueConfig[item.issue]
                return (
                  <button
                    key={item.studentId}
                    onClick={() => navigate(`/students/${item.studentId}?tab=plans`)}
                    className={`w-full grid grid-cols-[1fr_auto_2fr_auto] gap-2 items-center px-2 py-1.5 rounded-lg ${cfg.bg} hover:opacity-80 transition-opacity text-left`}
                  >
                    <span className="text-xs font-medium text-foreground truncate">{item.studentName}</span>
                    <span className="text-[10px] text-muted-foreground">{item.grade || '-'}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {item.issue === 'missing' && `本周 ${item.scheduledCount} 节课，0 条计划`}
                      {item.issue === 'expired' && `${item.expiredCount} 条过期`}
                      {item.issue === 'partial' && `${item.planCount}/${item.scheduledCount} 条`}
                    </span>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full
                      ${item.issue === 'missing' ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' :
                        item.issue === 'expired' ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400' :
                        'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400'}`}>
                      {cfg.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
