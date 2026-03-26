interface StatCardProps {
  label: string
  value: number
  unit?: string
  icon: React.ReactNode
  color: 'blue' | 'orange' | 'red' | 'green' | 'purple'
  loading?: boolean
  alert?: boolean
}

const colorMap = {
  blue: { bg: 'bg-blue-50 dark:bg-blue-950/30', text: 'text-blue-600 dark:text-blue-400', icon: 'text-blue-500' },
  orange: { bg: 'bg-orange-50 dark:bg-orange-950/30', text: 'text-orange-600 dark:text-orange-400', icon: 'text-orange-500' },
  red: { bg: 'bg-red-50 dark:bg-red-950/30', text: 'text-red-600 dark:text-red-400', icon: 'text-red-500' },
  green: { bg: 'bg-emerald-50 dark:bg-emerald-950/30', text: 'text-emerald-600 dark:text-emerald-400', icon: 'text-emerald-500' },
  purple: { bg: 'bg-purple-50 dark:bg-purple-950/30', text: 'text-purple-600 dark:text-purple-400', icon: 'text-purple-500' },
}

export function StatCard({ label, value, unit, icon, color, loading, alert }: StatCardProps) {
  const c = colorMap[color]
  return (
    <div className={`rounded-xl border p-4 ${alert ? 'border-current/30' : 'border-border'} ${c.bg}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className={c.icon}>{icon}</span>
      </div>
      {loading ? (
        <div className="h-7 w-16 bg-muted animate-pulse rounded" />
      ) : (
        <div className="flex items-baseline gap-1">
          <span className={`text-2xl font-bold ${c.text}`}>{value}</span>
          {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
        </div>
      )}
    </div>
  )
}