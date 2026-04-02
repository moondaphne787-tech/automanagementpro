import type { ClassRecord, TaskType } from '@/types'
import { TASK_TYPE_LABELS } from '@/types'

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
