import { useNavigate } from 'react-router-dom'
import { DollarSign, FileText, ClipboardList, UserCheck, CalendarClock, Users, UserCheck as UserCheckIcon, UserX, GraduationCap, UserPlus, ArrowRightLeft, TrendingUp, Clock, CheckCircle, AlertTriangle } from 'lucide-react'
import type { AlertStudentItem, StudentOverviewData, WeeklySummary } from '@/types'

// ===== AlertStudents =====

const alertTypeConfig: Record<string, { emoji: string; color: string }> = {
  low_hours:      { emoji: '⚡', color: 'text-red-500' },
  absent:         { emoji: '📅', color: 'text-orange-500' },
  no_record:      { emoji: '📝', color: 'text-yellow-500' },
  trial_followup: { emoji: '👤', color: 'text-purple-500' },
  expired_plans:  { emoji: '🗓️', color: 'text-orange-500' },
}

const alertActionConfig: Record<string, { icon: React.ReactNode; label: string; tab: string }> = {
  low_hours:      { icon: <DollarSign className="w-3 h-3" />, label: '续费', tab: 'info' },
  no_record:      { icon: <FileText className="w-3 h-3" />, label: '补录', tab: 'records' },
  expired_plans:  { icon: <ClipboardList className="w-3 h-3" />, label: '更新计划', tab: 'plans' },
  trial_followup: { icon: <UserCheck className="w-3 h-3" />, label: '跟进', tab: 'info' },
  absent:         { icon: <CalendarClock className="w-3 h-3" />, label: '查看排课', tab: 'records' },
}

interface AlertStudentsProps {
  students: AlertStudentItem[]
  loading: boolean
}

export function AlertStudents({ students, loading }: AlertStudentsProps) {
  const navigate = useNavigate()
  const displayStudents = students.slice(0, 8)

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">需关注学员</h3>
        {students.length > 8 && (
          <button
            onClick={() => navigate('/students?filter=alerts')}
            className="text-xs text-primary"
          >
            +{students.length - 8} 更多
          </button>
        )}
      </div>

      <div className="p-2">
        {loading ? (
          <div className="grid grid-cols-2 gap-2">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="p-2 rounded-lg border border-border/50">
                <div className="space-y-1.5">
                  <div className="h-3 w-20 bg-muted animate-pulse rounded" />
                  <div className="h-2 w-16 bg-muted animate-pulse rounded" />
                  <div className="h-5 w-10 bg-muted animate-pulse rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : students.length === 0 ? (
          <div className="text-center py-5 text-muted-foreground">
            <p className="text-xs">无需特别关注的学员</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {displayStudents.map(s => {
              const primaryAlert = s.alerts[0]
              const action = primaryAlert ? alertActionConfig[primaryAlert.type] : null

              return (
                <div
                  key={s.studentId}
                  className="p-2 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors"
                >
                  <button
                    onClick={() => navigate(`/students/${s.studentId}`)}
                    className="w-full text-left"
                  >
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-medium text-foreground truncate">{s.studentName}</span>
                      {s.grade && <span className="text-[10px] text-muted-foreground shrink-0">· {s.grade}</span>}
                    </div>
                  </button>

                  <div className="flex flex-wrap gap-0.5 mt-1">
                    {s.alerts.map((a, i) => {
                      const cfg = alertTypeConfig[a.type]
                      return (
                        <span key={i} className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                          <span>{cfg.emoji}</span>
                          {a.message}
                        </span>
                      )
                    })}
                  </div>

                  <div className="flex items-center justify-between mt-1.5">
                    {action && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          navigate(`/students/${s.studentId}`)
                        }}
                        className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                        title={action.label}
                      >
                        {action.icon}
                        {action.label}
                      </button>
                    )}
                    <span className="text-[10px] px-1 py-0.5 rounded bg-muted font-medium ml-auto">
                      {s.alerts.length} 项
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ===== StudentOverview =====

interface StudentOverviewProps {
  data: StudentOverviewData | null
  loading: boolean
}

export function StudentOverview({ data, loading }: StudentOverviewProps) {
  const navigate = useNavigate()

  if (loading || !data) {
    return (
      <div className="rounded-xl border border-border bg-card">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">学员总览</h3>
        </div>
        <div className="p-4 space-y-2">
          {[1, 2].map(i => <div key={i} className="h-6 bg-muted animate-pulse rounded" />)}
        </div>
      </div>
    )
  }

  const metrics = [
    { icon: <Users className="w-3 h-3" />, label: '总学员', value: data.total, color: 'text-foreground' },
    { icon: <UserCheckIcon className="w-3 h-3" />, label: '在读', value: data.active, color: 'text-emerald-500' },
    { icon: <UserX className="w-3 h-3" />, label: '休学', value: data.paused, color: 'text-yellow-500' },
    { icon: <GraduationCap className="w-3 h-3" />, label: '已毕业', value: data.graduated, color: 'text-blue-500' },
  ]

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">学员总览</h3>
        <button
          onClick={() => navigate('/students')}
          className="text-xs text-primary hover:underline flex items-center gap-0.5"
        >
          查看全部
          <ArrowRightLeft className="w-3 h-3 rotate-180" />
        </button>
      </div>

      <div className="p-3 space-y-3">
        <div className="grid grid-cols-4 gap-2">
          {metrics.map((m, i) => (
            <div key={i} className="text-center p-2 rounded-lg bg-muted/30">
              <div className="flex justify-center mb-1 text-muted-foreground">{m.icon}</div>
              <div className={`text-lg font-bold ${m.color}`}>{m.value}</div>
              <div className="text-[10px] text-muted-foreground">{m.label}</div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-purple-50/50 dark:bg-purple-950/20">
          <div className="flex items-center gap-2 text-xs text-purple-600 dark:text-purple-400">
            <UserPlus className="w-3.5 h-3.5" />
            <span>本月新增体验</span>
          </div>
          <span className="text-sm font-semibold text-purple-600 dark:text-purple-400">{data.trialThisMonth}</span>
        </div>
      </div>
    </div>
  )
}

// ===== WeeklyClassSummary =====

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
