import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import type { StudentRow as StudentRowType, StudentSlot, TeacherWithColor, TeacherAssignStatus } from './types'
import { HOUR_WIDTH, ROW_HEIGHT, LEVEL_LABELS } from './constants'
import { calculateSlotStyle } from './hooks/useManualSchedule'
import { AssignTeacherPopover } from './AssignTeacherPopover'

interface StudentRowProps {
  row: StudentRowType
  timeRangeStart: number
  timeRangeEnd: number
  teachers: TeacherWithColor[]
  getTeacherAssignStatuses: (slot: StudentSlot) => TeacherAssignStatus[]
  onAssign: (slotId: string, teacherId: string) => void
  onRemove: (slotId: string) => void
  scrollLeft: number
}

// 学生时段色块组件
function StudentSlotBlock({ 
  slot, 
  timeRangeStart,
  teachers,
  teacherAssignStatuses,
  onAssign,
  onRemove
}: { 
  slot: StudentSlot
  timeRangeStart: number
  teachers: TeacherWithColor[]
  teacherAssignStatuses: TeacherAssignStatus[]
  onAssign: (teacherId: string) => void
  onRemove: () => void
}) {
  const [popoverOpen, setPopoverOpen] = useState(false)
  const { left, width } = calculateSlotStyle(slot.preferredStart, slot.preferredEnd, timeRangeStart)
  
  // 背景色
  const getBackgroundColor = () => {
    if (slot.status === 'scheduled' && slot.teacher) {
      return slot.teacher.color || '#3B82F6'
    }
    return '#E5E7EB' // 浅灰色
  }
  
  // 文字颜色
  const getTextColor = () => {
    if (slot.status === 'scheduled' && slot.teacher) {
      return '#FFFFFF'
    }
    return '#6B7280' // 灰色
  }
  
  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger asChild>
        <div
          className="absolute top-2 bottom-2 rounded-lg cursor-pointer transition-all duration-150 hover:ring-2 hover:ring-offset-1 hover:ring-blue-400"
          style={{
            left: `${left}px`,
            width: `${width}px`,
            backgroundColor: getBackgroundColor(),
            minHeight: '40px',
          }}
        >
          <div className="p-2 h-full flex flex-col justify-center" style={{ color: getTextColor() }}>
            <div className="text-xs font-medium truncate">
              {slot.preferredStart.slice(0, 5)}-{slot.preferredEnd.slice(0, 5)}
            </div>
            <div className="text-xs truncate">
              {slot.status === 'scheduled' && slot.teacher 
                ? slot.teacher.name 
                : '待分配'}
            </div>
          </div>
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-80 max-h-96 overflow-y-auto" align="start">
        <AssignTeacherPopover
          slot={slot}
          teachers={teachers}
          teacherAssignStatuses={teacherAssignStatuses}
          onAssign={(teacherId) => {
            onAssign(teacherId)
            setPopoverOpen(false)
          }}
          onRemove={() => {
            onRemove()
            setPopoverOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

export function StudentRowComponent({ 
  row, 
  timeRangeStart,
  timeRangeEnd,
  teachers,
  getTeacherAssignStatuses,
  onAssign,
  onRemove,
  scrollLeft
}: StudentRowProps) {
  const totalWidth = ((timeRangeEnd - timeRangeStart) / 60) * HOUR_WIDTH
  
  // 检查是否需要显示课时警告
  const billing = row.student.billing
  const shouldShowWarning = billing && billing.remaining_hours <= billing.warning_threshold
  const isCritical = billing && billing.remaining_hours <= 0
  
  return (
    <div className="flex border-b hover:bg-muted/30">
      {/* 学生信息列 */}
      <div className="w-32 flex-shrink-0 border-r p-2 flex flex-col justify-center">
        <div className="flex items-center gap-1">
          <span className="font-medium text-sm truncate">{row.student.name}</span>
          {shouldShowWarning && (
            <Popover>
              <PopoverTrigger asChild>
                <span 
                  className={`cursor-pointer flex-shrink-0 ${isCritical ? 'text-red-500' : 'text-orange-500'}`}
                  title="课时不足警告"
                >
                  <AlertTriangle className="h-3.5 w-3.5" />
                </span>
              </PopoverTrigger>
              <PopoverContent className="w-48" align="start">
                <div className="space-y-2">
                  <div className="font-medium text-sm flex items-center gap-1.5">
                    <AlertTriangle className={`h-4 w-4 ${isCritical ? 'text-red-500' : 'text-orange-500'}`} />
                    课时警告
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div className="flex justify-between">
                      <span>剩余课时：</span>
                      <span className={`font-medium ${isCritical ? 'text-red-500' : 'text-orange-500'}`}>
                        {billing?.remaining_hours ?? 0} 小时
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>警告阈值：</span>
                      <span>{billing?.warning_threshold ?? 0} 小时</span>
                    </div>
                    {isCritical && (
                      <div className="text-red-500 pt-1 border-t">
                        课时已耗尽，请及时续费！
                      </div>
                    )}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>
        <div className="text-xs text-muted-foreground">
          {row.student.grade} · {LEVEL_LABELS[row.student.level]}
        </div>
      </div>
      
      {/* 时间轴区域 - 使用 transform 同步滚动，与助教区域保持一致 */}
      <div className="flex-1 overflow-hidden">
        <div
          className="relative"
          style={{
            width: `${totalWidth}px`,
            height: `${ROW_HEIGHT}px`,
            transform: `translateX(-${scrollLeft}px)`,
          }}
        >
          {/* 时间网格线 */}
          <div className="absolute inset-0">
            {Array.from({ length: (timeRangeEnd - timeRangeStart) / 60 + 1 }).map((_, i) => (
              <div
                key={i}
                className="absolute top-0 bottom-0 border-l border-dashed border-muted"
                style={{ left: `${i * HOUR_WIDTH}px` }}
              />
            ))}
          </div>
          
          {/* 时段色块 */}
          <div className="relative" style={{ width: `${totalWidth}px`, height: '100%' }}>
            {row.slots.map(slot => (
              <StudentSlotBlock
                key={slot.id}
                slot={slot}
                timeRangeStart={timeRangeStart}
                teachers={teachers}
                teacherAssignStatuses={getTeacherAssignStatuses(slot)}
                onAssign={(teacherId) => onAssign(slot.id, teacherId)}
                onRemove={() => onRemove(slot.id)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}