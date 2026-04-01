import { cn } from '@/lib/utils'
import { CheckCircle } from 'lucide-react'

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
      {/* 图例 */}
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

      {/* 图表 */}
      <div className="flex items-end gap-1 h-32 pt-4">
        {data.map((item) => {
          const height = (item.rate / maxRate) * 100
          return (
            <div key={item.date} className="flex-1 flex flex-col items-center min-w-[40px]">
              {/* 柱子 */}
              <div className="w-full relative flex flex-col justify-end h-24">
                {/* 背景条（总课次） */}
                <div
                  className="w-full bg-blue-500/20 rounded-t"
                  style={{ height: `${Math.min(item.total * 20, 96)}px` }}
                />
                {/* 完成率条 */}
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
              {/* 标签 */}
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

      {/* 汇总 */}
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