import { Users, UserCheck, UserX, GraduationCap, UserPlus, ArrowRightLeft } from 'lucide-react'
import type { StudentOverviewData } from '../../hooks/useDashboard'
import { useNavigate } from 'react-router-dom'

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
    { icon: <UserCheck className="w-3 h-3" />, label: '在读', value: data.active, color: 'text-emerald-500' },
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
        {/* 状态分布 */}
        <div className="grid grid-cols-4 gap-2">
          {metrics.map((m, i) => (
            <div key={i} className="text-center p-2 rounded-lg bg-muted/30">
              <div className="flex justify-center mb-1 text-muted-foreground">{m.icon}</div>
              <div className={`text-lg font-bold ${m.color}`}>{m.value}</div>
              <div className="text-[10px] text-muted-foreground">{m.label}</div>
            </div>
          ))}
        </div>

        {/* 本月转化 */}
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