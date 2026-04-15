interface StatisticsBarProps {
  totalCount: number
  selectedCount: number
  planCount: number
}

export function StatisticsBar({ totalCount, selectedCount, planCount }: StatisticsBarProps) {
  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="bg-muted rounded-lg p-3 text-center">
        <div className="text-2xl font-semibold">{totalCount}</div>
        <div className="text-xs text-muted-foreground">今日排课学员</div>
      </div>
      <div className="bg-green-500/10 rounded-lg p-3 text-center">
        <div className="text-2xl font-semibold text-green-600">{selectedCount}</div>
        <div className="text-xs text-muted-foreground">已选择</div>
      </div>
      <div className="bg-blue-500/10 rounded-lg p-3 text-center">
        <div className="text-2xl font-semibold text-blue-600">{planCount}</div>
        <div className="text-xs text-muted-foreground">有课程计划</div>
      </div>
    </div>
  )
}
