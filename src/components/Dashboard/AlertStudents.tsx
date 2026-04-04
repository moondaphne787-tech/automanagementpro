import { useNavigate } from 'react-router-dom'
import { DollarSign, FileText, ClipboardList, UserCheck, CalendarClock } from 'lucide-react'
import type { AlertStudentItem } from '@/types'

const alertTypeConfig = {
  low_hours:      { emoji: '⚡', color: 'text-red-500' },
  absent:         { emoji: '📅', color: 'text-orange-500' },
  no_record:      { emoji: '📝', color: 'text-yellow-500' },
  trial_followup: { emoji: '👤', color: 'text-purple-500' },
  expired_plans:  { emoji: '🗓️', color: 'text-orange-500' },
}

// 每种预警类型对应的快捷操作
const alertActionConfig: Record<string, { icon: React.ReactNode; label: string; getPath: (studentId: string) => string }> = {
  low_hours:      { icon: <DollarSign className="w-3 h-3" />, label: '续费', getPath: (id) => `/students/${id}?tab=info` },
  no_record:      { icon: <FileText className="w-3 h-3" />, label: '补录', getPath: (id) => `/students/${id}?tab=records` },
  expired_plans:  { icon: <ClipboardList className="w-3 h-3" />, label: '更新计划', getPath: (id) => `/students/${id}?tab=plans` },
  trial_followup: { icon: <UserCheck className="w-3 h-3" />, label: '跟进', getPath: (id) => `/students/${id}?tab=info` },
  absent:         { icon: <CalendarClock className="w-3 h-3" />, label: '查看排课', getPath: (id) => `/students/${id}?tab=records` },
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
                  {/* 姓名行 */}
                  <button
                    onClick={() => navigate(`/students/${s.studentId}`)}
                    className="w-full text-left"
                  >
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-medium text-foreground truncate">{s.studentName}</span>
                      {s.grade && <span className="text-[10px] text-muted-foreground shrink-0">· {s.grade}</span>}
                    </div>
                  </button>
                  
                  {/* 预警标签行 */}
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
                  
                  {/* 操作按钮行 */}
                  <div className="flex items-center justify-between mt-1.5">
                    {action && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          navigate(action.getPath(s.studentId))
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
