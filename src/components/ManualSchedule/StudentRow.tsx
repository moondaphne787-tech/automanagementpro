import { useState } from 'react'
import { AlertTriangle, Settings2 } from 'lucide-react'
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
  selectedDate: string
  onAddPreference: (studentId: string, date: string, startTime: string, endTime: string) => Promise<void>
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
  selectedDate,
  onAddPreference
}: StudentRowProps) {
  // 快速偏好编辑状态
  const [prefPopoverOpen, setPrefPopoverOpen] = useState(false)
  const [quickPrefForm, setQuickPrefForm] = useState({
    start_time: '09:00',
    end_time: '11:00'
  })
  const [isAddingPref, setIsAddingPref] = useState(false)
  
  const totalWidth = ((timeRangeEnd - timeRangeStart) / 60) * HOUR_WIDTH
  
  // 检查是否需要显示课时警告
  const billing = row.student.billing
  const shouldShowWarning = billing && billing.remaining_hours <= billing.warning_threshold
  const isCritical = billing && billing.remaining_hours <= 0
  
  // 根据课时状态确定背景色
  const getRowBackgroundClass = () => {
    if (isCritical) {
      return 'bg-red-50 border-red-200' // 课时耗尽：红色背景
    }
    if (shouldShowWarning) {
      return 'bg-orange-50 border-orange-200' // 课时不足：橙色背景
    }
    return 'hover:bg-muted/30'
  }
  
  return (
    <div className={`flex border-b ${getRowBackgroundClass()}`}>
      {/* 学生信息列 - 固定 */}
      <div className="w-32 flex-shrink-0 border-r p-2 flex flex-col justify-center group">
        <div className="flex items-center gap-1">
          <span className="font-medium text-sm truncate">{row.student.name}</span>
          
          {/* 快速偏好编辑按钮 */}
          <Popover open={prefPopoverOpen} onOpenChange={setPrefPopoverOpen}>
            <PopoverTrigger asChild>
              <button
                className="opacity-0 group-hover:opacity-60 hover:!opacity-100 text-muted-foreground transition-opacity flex-shrink-0"
                onClick={e => e.stopPropagation()}
                title="快速添加今日时段偏好"
              >
                <Settings2 className="h-3 w-3" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-3" align="start">
              <div className="text-xs font-medium mb-2">快速添加时段偏好</div>
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-muted-foreground">开始时间</label>
                    <input 
                      type="time" 
                      value={quickPrefForm.start_time}
                      onChange={e => setQuickPrefForm(p => ({ ...p, start_time: e.target.value }))}
                      className="w-full text-xs border rounded px-1.5 py-1 mt-0.5" 
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground">结束时间</label>
                    <input 
                      type="time" 
                      value={quickPrefForm.end_time}
                      onChange={e => setQuickPrefForm(p => ({ ...p, end_time: e.target.value }))}
                      className="w-full text-xs border rounded px-1.5 py-1 mt-0.5" 
                    />
                  </div>
                </div>
                <button
                  onClick={async () => {
                    if (isAddingPref) return
                    setIsAddingPref(true)
                    try {
                      await onAddPreference(row.student.id, selectedDate, quickPrefForm.start_time, quickPrefForm.end_time)
                      setPrefPopoverOpen(false)
                      // 重置表单
                      setQuickPrefForm({ start_time: '09:00', end_time: '11:00' })
                    } catch (error) {
                      console.error('Failed to add preference:', error)
                      alert('添加偏好失败')
                    } finally {
                      setIsAddingPref(false)
                    }
                  }}
                  disabled={isAddingPref}
                  className="w-full text-xs bg-primary text-primary-foreground rounded py-1.5 hover:bg-primary/90 disabled:opacity-50"
                >
                  {isAddingPref ? '添加中...' : '添加'}
                </button>
              </div>
            </PopoverContent>
          </Popover>
          
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
      
      {/* 时间轴区域 - 通过原生 JS 同步滚动，添加 data 属性便于查询 */}
      <div className="flex-1 overflow-hidden">
        {/* 内部内容容器 - 通过 transform 实现同步滚动 */}
        <div
          data-scroll-sync="timeline"
          className="relative"
          style={{
            width: `${totalWidth}px`,
            height: `${ROW_HEIGHT}px`,
            transform: 'translateX(0px)',
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