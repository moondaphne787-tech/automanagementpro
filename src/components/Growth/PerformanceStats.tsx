import { cn } from '@/lib/utils'
import type { ClassRecord } from '@/types'

interface PerformanceStatsProps {
  records: ClassRecord[]
}

// 表现类型标签和颜色映射
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