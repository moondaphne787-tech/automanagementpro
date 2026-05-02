import { Pencil, Trash2, Calendar } from 'lucide-react'
import type { Student, Teacher, ScheduledClass } from '@/types'
import { Button } from '@/components/ui/button'

interface DayScheduleViewProps {
  classes: (ScheduledClass & { student?: Student; teacher?: Teacher })[]
  loading: boolean
  onEditClass: (cls: ScheduledClass & { student?: Student; teacher?: Teacher }) => void
  onDeleteClass: (cls: ScheduledClass) => void
}

export function DayScheduleView({ classes, loading, onEditClass, onDeleteClass }: DayScheduleViewProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        加载中...
      </div>
    )
  }

  const dayClasses = classes.filter(c => c.status === 'scheduled')

  if (dayClasses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <Calendar className="h-12 w-12 mb-4 opacity-50" />
        <p>该日期暂无排课</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {dayClasses.map(cls => (
        <div
          key={cls.id}
          className="flex items-center justify-between p-4 bg-card border rounded-lg hover:shadow-sm transition-shadow"
        >
          <div className="flex items-center gap-6">
            <div className="text-lg font-semibold text-primary min-w-[120px]">
              {cls.start_time?.slice(0, 5)} - {cls.end_time?.slice(0, 5)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{cls.student?.name || '未知'}</span>
                {cls.student?.grade && (
                  <span className="text-xs text-muted-foreground">({cls.student.grade})</span>
                )}
              </div>
              <div className="text-sm text-muted-foreground mt-0.5">
                助教: {cls.teacher?.name || '未指定'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => onEditClass(cls)}>
              <Pencil className="h-3.5 w-3.5 mr-1" />编辑
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => onDeleteClass(cls)}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />删除
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}
