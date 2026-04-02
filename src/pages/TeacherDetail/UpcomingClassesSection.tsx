import { ScheduledClass } from '@/types'
import { Card } from '@/components/ui/card'
import { useMemo } from 'react'

interface UpcomingClassesSectionProps {
  scheduledClasses: ScheduledClass[]
}

export function UpcomingClassesSection({ scheduledClasses }: UpcomingClassesSectionProps) {
  // 获取即将到来的课程
  const today = useMemo(() => new Date().toISOString().split('T')[0], [])
  
  const upcomingClasses = useMemo(() => {
    return scheduledClasses
      .filter(c => c.class_date >= today && c.status === 'scheduled')
      .sort((a, b) => a.class_date.localeCompare(b.class_date))
      .slice(0, 10)
  }, [scheduledClasses, today])

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'scheduled': return '已排课'
      case 'completed': return '已完成'
      case 'cancelled': return '已取消'
      case 'rescheduled': return '已调课'
      default: return status
    }
  }

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-green-100 text-green-700'
      case 'completed': return 'bg-blue-100 text-blue-700'
      case 'cancelled': return 'bg-red-100 text-red-700'
      default: return 'bg-yellow-100 text-yellow-700'
    }
  }

  return (
    <Card className="p-6 lg:col-span-3">
      <h2 className="font-semibold mb-4">近期排课</h2>
      
      {upcomingClasses.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          暂无近期排课
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {upcomingClasses.map(c => (
            <div
              key={c.id}
              className="flex items-center justify-between p-3 bg-muted/50 rounded-lg text-sm"
            >
              <div>
                <div className="font-medium">{c.class_date}</div>
                <div className="text-muted-foreground">
                  {c.start_time?.slice(0, 5)} - {c.end_time?.slice(0, 5)}
                </div>
              </div>
              <div className={`px-2 py-0.5 rounded-full text-xs ${getStatusClass(c.status)}`}>
                {getStatusLabel(c.status)}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}