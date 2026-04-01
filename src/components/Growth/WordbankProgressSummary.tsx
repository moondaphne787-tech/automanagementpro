import type { StudentWordbankProgress } from '@/types'

interface WordbankProgressSummaryProps {
  progress: StudentWordbankProgress[]
}

export function WordbankProgressSummary({ progress }: WordbankProgressSummaryProps) {
  if (progress.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-4">
        暂无词库进度
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {progress.map((p) => {
        const percentage = Math.round((p.current_level / (p.total_levels_override || 60)) * 100)
        return (
          <div key={p.id} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span>{p.wordbank_label}</span>
              <span className="text-muted-foreground">
                第 {p.current_level} 关 ({percentage}%)
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}