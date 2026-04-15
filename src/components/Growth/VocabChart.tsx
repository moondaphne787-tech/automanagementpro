import { useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import type { VocabTest } from '@/types'

interface VocabChartProps {
  tests: VocabTest[]
}

export function VocabChart({ tests }: VocabChartProps) {
  const chartData = useMemo(() => {
    if (tests.length === 0) return []
    // 按日期正序排列
    return [...tests]
      .sort((a, b) => a.test_date.localeCompare(b.test_date))
      .map(t => ({
        date: t.test_date.slice(5), // MM-DD
        fullDate: t.test_date,
        count: t.vocab_count,
        source: t.test_source || ''
      }))
  }, [tests])

  if (chartData.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8 text-sm">
        暂无词汇量测试数据
      </div>
    )
  }

  // 计算增长
  const first = chartData[0].count
  const last = chartData[chartData.length - 1].count
  const growth = last - first

  return (
    <div className="space-y-3">
      {chartData.length >= 2 && (
        <div className="flex items-center gap-4 text-sm">
          <span className="text-muted-foreground">
            首次 <span className="font-medium text-foreground">{first}</span> 词
          </span>
          <span className="text-muted-foreground">→</span>
          <span className="text-muted-foreground">
            最近 <span className="font-medium text-foreground">{last}</span> 词
          </span>
          <span className={growth > 0 ? 'text-green-600 font-medium' : growth < 0 ? 'text-red-600 font-medium' : 'text-muted-foreground'}>
            {growth > 0 ? `+${growth}` : growth} 词
          </span>
        </div>
      )}

      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip
            formatter={(value: number) => [`${value} 词`, '词汇量']}
            labelFormatter={(label, payload) => {
              if (payload?.[0]?.payload) {
                const d = payload[0].payload
                return `${d.fullDate}${d.source ? ` (${d.source})` : ''}`
              }
              return label
            }}
          />
          <Line
            type="monotone"
            dataKey="count"
            stroke="#6366f1"
            strokeWidth={2}
            dot={{ r: 4, fill: '#6366f1' }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
