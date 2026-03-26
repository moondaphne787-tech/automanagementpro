import { useNavigate } from 'react-router-dom'
import { AlertTriangle, XCircle, Clock } from 'lucide-react'
import type { PlanStatusItem } from '../../hooks/useDashboard'

const issueConfig = {
  missing: { icon: <XCircle className="w-3 h-3 text-red-500" />, label: '无计划', bg: 'bg-red-50/50 dark:bg-red-950/20' },
  expired: { icon: <Clock className="w-3 h-3 text-orange-500" />, label: '有过期', bg: 'bg-orange-50/50 dark:bg-orange-950/20' },
  partial: { icon: <AlertTriangle className="w-3 h-3 text-yellow-500" />, label: '不够用', bg: 'bg-yellow-50/50 dark:bg-yellow-950/20' },
}

interface WeeklyPlanStatusProps {
  items: PlanStatusItem[]
  loading: boolean
}

export function WeeklyPlanStatus({ items, loading }: WeeklyPlanStatusProps) {
  const navigate = useNavigate()

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">本周计划状态</h3>
        <span className="text-xs text-muted-foreground">
          {loading ? '...' : items.length === 0 ? '全部已就绪' : `${items.length} 位需处理`}
        </span>
      </div>

      <div className="p-3">
        {loading ? (
          <div className="space-y-1.5">
            {[1, 2, 3].map(i => <div key={i} className="h-8 bg-muted animate-pulse rounded" />)}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-5 text-muted-foreground">
            <p className="text-xs">本周所有学员计划已就绪</p>
          </div>
        ) : (
          <div className="space-y-1">
            {items.map(item => {
              const cfg = issueConfig[item.issue]
              return (
                <button
                  key={item.studentId}
                  onClick={() => navigate(`/students/${item.studentId}?tab=plans`)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg ${cfg.bg} hover:opacity-80 transition-opacity text-left`}
                >
                  {cfg.icon}
                  <span className="text-xs font-medium text-foreground flex-1">{item.studentName}</span>
                  {item.grade && <span className="text-[10px] text-muted-foreground">{item.grade}</span>}
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
        )}
      </div>
    </div>
  )
}