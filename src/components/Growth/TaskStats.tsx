import type { ClassRecord } from '@/types'

interface TaskStatsProps {
  records: ClassRecord[]
}

// 任务类型标签映射
const TASK_TYPE_LABELS: Record<string, string> = {
  phonics: '语音训练',
  vocab_new: '词库学习',
  vocab_review: '词库复习',
  nine_grid: '九宫格清理',
  textbook: '课文梳理',
  reading: '阅读训练',
  picture_book: '绘本阅读',
  exercise: '专项练习',
  other: '其他'
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
          <span>{TASK_TYPE_LABELS[type] || type}</span>
          <span className="text-muted-foreground">{count} 次</span>
        </div>
      ))}
    </div>
  )
}

export { TASK_TYPE_LABELS }