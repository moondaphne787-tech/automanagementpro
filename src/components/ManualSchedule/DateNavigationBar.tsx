import { useMemo } from 'react'
import { ChevronLeft, ChevronRight, UserPlus, Trash2, Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DateInput } from '@/components/ui/date-input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { DAY_LABELS } from '@/types'
import { getDayOfWeek, formatDateISO } from '@/lib/utils'
import type { Student } from '@/types'

interface DateNavigationBarProps {
  selectedDate: string
  saving: boolean
  localSchedulesCount: number
  studentsNotInPanel: Student[]
  quickAddTime: { start: string; end: string }
  quickAddTodayOnly: boolean
  onDateChange: (date: string) => void
  onPrevDay: () => void
  onNextDay: () => void
  onToday: () => void
  onClearDay: () => void
  onSave: () => void
  onQuickAddTimeChange: (time: { start: string; end: string }) => void
  onQuickAddTodayOnlyChange: (todayOnly: boolean) => void
  onQuickAddStudent: (studentId: string) => void
}

export function DateNavigationBar({
  selectedDate, saving, localSchedulesCount, studentsNotInPanel,
  quickAddTime, quickAddTodayOnly,
  onDateChange, onPrevDay, onNextDay, onToday, onClearDay, onSave,
  onQuickAddTimeChange, onQuickAddTodayOnlyChange, onQuickAddStudent
}: DateNavigationBarProps) {
  return (
    <header className="h-14 border-b bg-card flex items-center justify-between px-4">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold">人工排课</h1>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={onPrevDay}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <DateInput value={selectedDate} onChange={(date: string | Date) => {
            onDateChange(typeof date === 'string' ? date : formatDateISO(date))
          }} />
          <Button variant="outline" size="icon" onClick={onNextDay}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={onToday}>今天</Button>
        </div>

        <span className="text-sm text-muted-foreground">
          {DAY_LABELS[getDayOfWeek(selectedDate)]}
        </span>
      </div>

      <div className="flex items-center gap-2">
        {studentsNotInPanel.length > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <UserPlus className="h-4 w-4 mr-1" />
                添加学员 ({studentsNotInPanel.length})
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-3" align="end">
              <div className="text-xs font-medium mb-2">添加学员到今日排课</div>
              <div className="text-xs text-muted-foreground mb-2">点击学员为其添加今日时段</div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-muted-foreground">时段:</span>
                <input
                  type="time"
                  value={quickAddTime.start}
                  onChange={e => onQuickAddTimeChange({ ...quickAddTime, start: e.target.value })}
                  className="text-xs border rounded px-1.5 py-0.5 w-20"
                />
                <span className="text-xs">-</span>
                <input
                  type="time"
                  value={quickAddTime.end}
                  onChange={e => onQuickAddTimeChange({ ...quickAddTime, end: e.target.value })}
                  className="text-xs border rounded px-1.5 py-0.5 w-20"
                />
              </div>
              <label className="flex items-center gap-2 text-xs cursor-pointer mb-2">
                <input
                  type="checkbox"
                  checked={quickAddTodayOnly}
                  onChange={e => onQuickAddTodayOnlyChange(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-gray-300"
                />
                <span className={quickAddTodayOnly ? 'text-primary font-medium' : 'text-muted-foreground'}>
                  仅限今日（不保存为长期偏好）
                </span>
              </label>
              <div className="text-[10px] text-muted-foreground px-1 mb-3">
                {quickAddTodayOnly
                  ? '将直接创建今日排课，不影响后续排课建议'
                  : '将保存为每周固定时段偏好'}
              </div>
              <div className="max-h-48 overflow-y-auto space-y-0.5">
                {studentsNotInPanel.map(s => (
                  <button
                    key={s.id}
                    onClick={() => onQuickAddStudent(s.id)}
                    className="w-full text-left px-2 py-1.5 text-sm hover:bg-muted rounded flex items-center justify-between"
                  >
                    <span>{s.name}</span>
                    <span className="text-xs text-muted-foreground">{s.grade}</span>
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}

        <Button variant="outline" onClick={onClearDay}>
          <Trash2 className="h-4 w-4 mr-2" />
          清空本日排课
        </Button>
        <Button onClick={onSave} disabled={saving || localSchedulesCount === 0}>
          {saving ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" />保存中...</>
          ) : (
            <><Check className="h-4 w-4 mr-2" />保存排课 ({localSchedulesCount})</>
          )}
        </Button>
      </div>
    </header>
  )
}
