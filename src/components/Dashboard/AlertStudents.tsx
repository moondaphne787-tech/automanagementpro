import { useNavigate } from 'react-router-dom'
import type { AlertStudentItem } from '../../hooks/useDashboard'

const alertTypeConfig = {
  low_hours: { emoji: '', color: 'text-red-500' },
  absent: { emoji: '', color: 'text-orange-500' },
  no_record: { emoji: '', color: 'text-yellow-500' },
  trial_followup: { emoji: '', color: 'text-purple-500' },
  expired_plans: { emoji: '', color: 'text-orange-500' },
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
          <div className="space-y-1.5">
            {[1, 2].map(i => <div key={i} className="h-10 bg-muted animate-pulse rounded" />)}
          </div>
        ) : students.length === 0 ? (
          <div className="text-center py-5 text-muted-foreground">
            <p className="text-xs">无需特别关注的学员</p>
          </div>
        ) : (
          <div className="space-y-1">
            {displayStudents.map(s => (
              <button
                key={s.studentId}
                onClick={() => navigate(`/students/${s.studentId}`)}
                className="w-full flex items-start gap-2 px-2 py-2 rounded-lg hover:bg-muted/50 transition-colors text-left"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-foreground">{s.studentName}</span>
                    {s.grade && <span className="text-[10px] text-muted-foreground">{s.grade}</span>}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-0.5">
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
                </div>
                <span className="text-[10px] px-1 py-0.5 rounded bg-muted font-medium">
                  {s.alerts.length} 项
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}