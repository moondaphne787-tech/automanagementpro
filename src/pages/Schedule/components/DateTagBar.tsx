import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { X } from 'lucide-react'
import type { ScheduledClass } from '@/types'
import type { ScheduleDateConfig } from '@/ai/schedulePrompts'
import { SchedulePreset, formatDisplayDate, getDateTypeIcon } from '../types'

interface DateTagBarProps {
  scheduleDates: ScheduleDateConfig[]
  schedulePreset: SchedulePreset
  classes: ScheduledClass[]
  onJumpToManualSchedule: (date: string) => void
  onCreateClass: (date: string) => void
  onRemoveDate: (date: string) => void
}

export function DateTagBar({
  scheduleDates,
  schedulePreset,
  classes,
  onJumpToManualSchedule,
  onCreateClass,
  onRemoveDate
}: DateTagBarProps) {
  const [contextMenu, setContextMenu] = useState<{ date: string; x: number; y: number } | null>(null)

  useEffect(() => {
    if (!contextMenu) return
    const handleClick = () => setContextMenu(null)
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [contextMenu])

  if (scheduleDates.length === 0) return null

  return (
    <div className="border-b bg-muted/30 px-6 py-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-muted-foreground">排课日期：</span>
        {scheduleDates.map((dateConfig) => (
          <button
            key={dateConfig.date}
            onClick={() => onJumpToManualSchedule(dateConfig.date)}
            onContextMenu={(e) => {
              e.preventDefault()
              setContextMenu({ date: dateConfig.date, x: e.clientX, y: e.clientY })
            }}
            className="flex items-center gap-1 px-2 py-1 bg-background rounded-md border text-sm hover:bg-blue-50 hover:border-blue-300 cursor-pointer transition-colors"
            title="左键跳转排课, 右键更多操作"
          >
            <span>{getDateTypeIcon(dateConfig.type)}</span>
            <span>{dateConfig.label}</span>
            <span className="text-muted-foreground">({formatDisplayDate(new Date(dateConfig.date))})</span>
            {schedulePreset === 'custom' && (
              <span
                onClick={(e) => {
                  e.stopPropagation()
                  onRemoveDate(dateConfig.date)
                }}
                className="ml-1 text-muted-foreground hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 右键菜单 */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-popover border rounded-lg shadow-lg py-1 min-w-[160px]"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={() => setContextMenu(null)}
        >
          <button
            className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted transition-colors flex items-center gap-2"
            onClick={() => onJumpToManualSchedule(contextMenu.date)}
          >
            📋 查看当日排课
          </button>
          <button
            className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted transition-colors flex items-center gap-2"
            onClick={() => onCreateClass(contextMenu.date)}
          >
            ➕ 添加排课
          </button>
          <button
            className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted transition-colors flex items-center gap-2"
            onClick={() => {
              const dayClasses = classes.filter(c => c.class_date === contextMenu.date && c.status === 'scheduled')
              toast.info(`${formatDisplayDate(new Date(contextMenu.date))} 已排 ${dayClasses.length} 节课`)
            }}
          >
            📊 当日统计
          </button>
          {schedulePreset === 'custom' && (
            <>
              <div className="border-t my-1" />
              <button
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted transition-colors flex items-center gap-2 text-destructive"
                onClick={() => onRemoveDate(contextMenu.date)}
              >
                🗑️ 移除此日期
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
