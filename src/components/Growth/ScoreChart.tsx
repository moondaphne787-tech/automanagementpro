import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import type { ExamScore } from '@/types'
import { ExamType } from '@/types'

// 考试类型标签
const EXAM_TYPE_LABELS: Record<ExamType, string> = {
  school_exam: '学校考试',
  placement: '分班考试',
  mock: '模拟考试'
}

interface ScoreChartProps {
  scores: ExamScore[]
}

export function ScoreChart({ scores }: ScoreChartProps) {
  if (scores.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        暂无成绩记录
      </div>
    )
  }

  const sortedScores = [...scores].sort((a, b) => a.exam_date.localeCompare(b.exam_date))
  const maxScore = Math.max(...sortedScores.map(s => s.full_score || 100))

  return (
    <div className="space-y-3">
      {sortedScores.map((score, index) => {
        const percentage = score.score != null ? (score.score / (score.full_score || 100)) * 100 : 0
        const prevScore = index > 0 ? sortedScores[index - 1] : null
        const trend = prevScore && score.score != null && prevScore.score != null
          ? score.score > prevScore.score ? 'up' : score.score < prevScore.score ? 'down' : 'same'
          : null

        return (
          <div key={score.id} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="truncate flex-1">
                {score.exam_name || EXAM_TYPE_LABELS[score.exam_type]}
                <span className="text-muted-foreground ml-2 text-xs">
                  {score.exam_date}
                </span>
              </span>
              <span className="flex items-center gap-1">
                {score.score ?? '-'}/{score.full_score || 100}
                {trend && (
                  trend === 'up' ? <TrendingUp className="w-3 h-3 text-green-500" /> :
                  trend === 'down' ? <TrendingDown className="w-3 h-3 text-red-500" /> :
                  <Minus className="w-3 h-3 text-muted-foreground" />
                )}
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full transition-all",
                  percentage >= 80 ? "bg-green-500" :
                  percentage >= 60 ? "bg-blue-500" :
                  percentage >= 40 ? "bg-yellow-500" : "bg-red-500"
                )}
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export { EXAM_TYPE_LABELS }