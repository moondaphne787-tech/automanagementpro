import { cn } from '@/lib/utils'
import { CheckCircle } from 'lucide-react'
import type { ClassRecord, TaskType } from '@/types'
import { TASK_TYPE_LABELS } from '@/types'

// ===== PerformanceStats =====

interface PerformanceStatsProps {
  records: ClassRecord[]
}

const PERFORMANCE_LABELS: Record<string, { label: string; color: string }> = {
  excellent: { label: '表现优秀', color: 'bg-green-500' },
  good: { label: '表现良好', color: 'bg-blue-500' },
  needs_improvement: { label: '待提高', color: 'bg-orange-500' }
}

export function PerformanceStats({ records }: PerformanceStatsProps) {
  const stats = records.reduce((acc, record) => {
    acc[record.performance] = (acc[record.performance] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const total = records.length

  if (total === 0) {
    return (
      <div className="text-center text-muted-foreground py-4">
        暂无课堂记录
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-1 h-4 rounded-full overflow-hidden">
        {(['excellent', 'good', 'needs_improvement'] as const).map((type) => {
          const count = stats[type] || 0
          const percentage = (count / total) * 100
          if (percentage === 0) return null
          return (
            <div
              key={type}
              className={PERFORMANCE_LABELS[type].color}
              style={{ width: `${percentage}%` }}
              title={`${PERFORMANCE_LABELS[type].label}: ${count}次`}
            />
          )
        })}
      </div>
      <div className="flex flex-wrap gap-4 text-sm">
        {(['excellent', 'good', 'needs_improvement'] as const).map((type) => (
          <div key={type} className="flex items-center gap-2">
            <div className={cn("w-3 h-3 rounded", PERFORMANCE_LABELS[type].color)} />
            <span>{PERFORMANCE_LABELS[type].label}: {stats[type] || 0}次</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export { PERFORMANCE_LABELS }

// ===== TaskStats =====

interface TaskStatsProps {
  records: ClassRecord[]
}

export function TaskStats({ records }: TaskStatsProps) {
  const taskStats = records.reduce((acc, record) => {
    record.tasks.forEach((task) => {
      const type = task.type
      acc[type] = (acc[type] || 0) + 1
    })
    return acc
  }, {} as Record<string, number>)

  const sortedStats = Object.entries(taskStats).sort((a, b) => b[1] - a[1])

  if (sortedStats.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-4">
        暂无任务记录
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {sortedStats.map(([type, count]) => (
        <div key={type} className="flex items-center justify-between text-sm">
          <span>{TASK_TYPE_LABELS[type as TaskType] || type}</span>
          <span className="text-muted-foreground">{count} 次</span>
        </div>
      ))}
    </div>
  )
}

// ===== CompletionRateChart =====

interface CompletionRateData {
  date: string
  total: number
  completed: number
  rate: number
}

interface CompletionRateChartProps {
  data: CompletionRateData[]
}

export function CompletionRateChart({ data }: CompletionRateChartProps) {
  if (data.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        暂无完成率数据
      </div>
    )
  }

  const maxRate = 100

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4 text-xs text-muted-foreground mb-2">
        <div className="flex items-center gap-1">
          <CheckCircle className="w-3 h-3 text-green-500" />
          <span>完成率</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-blue-500/30 rounded" />
          <span>课次</span>
        </div>
      </div>

      <div className="flex items-end gap-1 h-32 pt-4">
        {data.map((item) => {
          const height = (item.rate / maxRate) * 100
          return (
            <div key={item.date} className="flex-1 flex flex-col items-center min-w-[40px]">
              <div className="w-full relative flex flex-col justify-end h-24">
                <div
                  className="w-full bg-blue-500/20 rounded-t"
                  style={{ height: `${Math.min(item.total * 20, 96)}px` }}
                />
                <div
                  className={cn(
                    "absolute bottom-0 w-full rounded-t transition-all",
                    item.rate >= 80 ? "bg-green-500" :
                    item.rate >= 60 ? "bg-blue-500" :
                    item.rate >= 40 ? "bg-yellow-500" : "bg-red-500"
                  )}
                  style={{ height: `${height}%` }}
                />
              </div>
              <div className="text-xs text-muted-foreground mt-1 text-center">
                <div className="font-medium">{item.rate}%</div>
                <div className="text-[10px]">
                  {new Date(item.date).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-3 gap-2 pt-2 border-t">
        <div className="text-center">
          <div className="text-lg font-semibold">{data.reduce((sum, d) => sum + d.total, 0)}</div>
          <div className="text-xs text-muted-foreground">总课次</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-semibold">{data.reduce((sum, d) => sum + d.completed, 0)}</div>
          <div className="text-xs text-muted-foreground">完成课次</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-semibold">
            {Math.round(data.reduce((sum, d) => sum + d.rate, 0) / data.length)}%
          </div>
          <div className="text-xs text-muted-foreground">平均完成率</div>
        </div>
      </div>
    </div>
  )
}
