import {
  ChevronLeft,
  ChevronRight,
  Plus,
  CalendarPlus,
  Users
} from 'lucide-react'
import type { ScheduleDateConfig } from '@/ai/schedulePrompts'
import { Button } from '@/components/ui/button'
import { ViewMode, SchedulePreset, formatDisplayDate } from '../types'

interface ScheduleHeaderProps {
  viewMode: ViewMode
  setViewMode: (mode: ViewMode) => void
  schedulePreset: SchedulePreset
  onPresetChange: (preset: SchedulePreset) => void
  scheduleDates: ScheduleDateConfig[]
  onPrevWeek: () => void
  onNextWeek: () => void
  onToday: () => void
  onOpenAddDate: () => void
  onOpenBatchPref: () => void
  onCreateClass: () => void
}

export function ScheduleHeader({
  viewMode,
  setViewMode,
  schedulePreset,
  onPresetChange,
  scheduleDates,
  onPrevWeek,
  onNextWeek,
  onToday,
  onOpenAddDate,
  onOpenBatchPref,
  onCreateClass
}: ScheduleHeaderProps) {
  return (
    <header className="h-16 border-b bg-card flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold">排课管理</h1>

        <div className="flex bg-muted rounded-lg p-1">
          <button
            onClick={() => setViewMode('week')}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              viewMode === 'week' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            周课表
          </button>
          <button
            onClick={() => setViewMode('manual')}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              viewMode === 'manual' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            排课操作
          </button>
        </div>

        <div className="flex bg-muted rounded-lg p-1">
          <button
            onClick={() => onPresetChange('weekend_with_friday')}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              schedulePreset === 'weekend_with_friday' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            含周五晚
          </button>
          <button
            onClick={() => onPresetChange('week')}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              schedulePreset === 'week' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            一周
          </button>
          <button
            onClick={() => onPresetChange('custom')}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              schedulePreset === 'custom' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            自定义
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {viewMode === 'week' && (
          <>
            <Button variant="outline" size="icon" onClick={onPrevWeek}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm min-w-[120px] text-center">
              {scheduleDates.length > 0 ? (
                scheduleDates.length === 1
                  ? formatDisplayDate(new Date(scheduleDates[0].date))
                  : `${formatDisplayDate(new Date(scheduleDates[0].date))} - ${formatDisplayDate(new Date(scheduleDates[scheduleDates.length - 1].date))}`
              ) : '请添加日期'}
            </span>
            <Button variant="outline" size="icon" onClick={onNextWeek}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={onToday}>
              本周
            </Button>
          </>
        )}
        {viewMode === 'manual' && (
          <Button variant="outline" size="sm" onClick={onOpenBatchPref}>
            <Users className="h-4 w-4 mr-2" />
            批量设置时段偏好
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={onOpenAddDate}>
          <CalendarPlus className="h-4 w-4 mr-2" />
          添加日期
        </Button>
        <Button onClick={onCreateClass}>
          <Plus className="h-4 w-4 mr-2" />
          新增排课
        </Button>
      </div>
    </header>
  )
}
