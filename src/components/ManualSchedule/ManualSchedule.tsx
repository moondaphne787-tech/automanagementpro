import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Clock, User, AlertCircle, Check, X, Loader2, CalendarDays, 
  Info, Trash2, RefreshCw, ChevronLeft, ChevronRight, AlertTriangle,
  Moon, Sun, ChevronUp, ChevronDown, FileText
} from 'lucide-react'
import { studentDb, teacherDb, scheduledClassDb, studentSchedulePreferenceDb, teacherAvailabilityDb } from '@/db'
import type { Student, Teacher, ScheduledClass, DayOfWeek, Billing, StudentSchedulePreference, TeacherAvailability, LevelType } from '@/types'
import { getGradesFromSuitableGrades } from '@/types'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DateInput } from '@/components/ui/date-input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'

// 预设颜色板
const TEACHER_COLORS = [
  '#3B82F6', // blue
  '#10B981', // emerald
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#84CC16', // lime
  '#F97316', // orange
  '#6366F1', // indigo
]

// 每小时像素宽度
const HOUR_WIDTH = 80

// 学生行高度
const ROW_HEIGHT = 60

// 格式化日期
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

const DAY_LABELS: Record<DayOfWeek, string> = {
  monday: '周一',
  tuesday: '周二',
  wednesday: '周三',
  thursday: '周四',
  friday: '周五',
  saturday: '周六',
  sunday: '周日'
}

// 获取日期对应的星期
function getDayOfWeek(dateStr: string): DayOfWeek {
  const days: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const date = new Date(dateStr)
  return days[date.getDay()]
}

// 程度等级显示
const LEVEL_LABELS: Record<LevelType, string> = {
  weak: '薄弱',
  medium: '较好',
  advanced: '优秀'
}

// 带颜色的助教类型
interface TeacherWithColor extends Teacher {
  color: string
  availabilities?: TeacherAvailability[]
}

// 学生时段数据
interface StudentSlot {
  id: string
  student: Student & { billing: Billing | null; preferences: StudentSchedulePreference[] }
  preferredStart: string
  preferredEnd: string
  durationHours: number
  scheduledClass?: ScheduledClass & { teacher?: Teacher }
  teacherId?: string
  teacher?: TeacherWithColor
  status: 'unscheduled' | 'scheduled'
}

// 学生行数据
interface StudentRow {
  student: Student & { billing: Billing | null; preferences: StudentSchedulePreference[] }
  slots: StudentSlot[]
}

// 冲突类型
type ConflictType = 'none' | 'hard' | 'soft'

interface ConflictInfo {
  type: ConflictType
  reasons: string[]
}

// 助教卡片数据
interface TeacherCardData {
  teacher: TeacherWithColor
  color: string
  todayAvailability: string
  suitableLevels: string[]
  suitableGrades: string
  scheduledHours: number
  remainingHours: number
  isFull: boolean
  hasAvailabilityToday: boolean  // 当日是否有可用时段
}

// 助教分配状态
interface TeacherAssignStatus {
  teacher: TeacherWithColor
  canAssign: boolean
  conflictType: ConflictType
  reasons: string[]
}

// 将时间字符串转换为分钟数
function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

// 将分钟数转换为时间字符串
function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}

// 计算时间范围
function getTimeRange(slots: StudentSlot[]): { start: number; end: number } {
  let startMin = 8 * 60 // 默认从8点开始
  let endMin = 21 * 60 // 默认到21点结束
  
  slots.forEach(slot => {
    const slotStart = timeToMinutes(slot.preferredStart)
    const slotEnd = timeToMinutes(slot.preferredEnd)
    if (slotStart < startMin) startMin = slotStart
    if (slotEnd > endMin) endMin = slotEnd
  })
  
  // 向上取整到整点
  startMin = Math.floor(startMin / 60) * 60
  endMin = Math.ceil(endMin / 60) * 60
  
  return { start: startMin, end: endMin }
}

// 计算色块位置和宽度
function calculateSlotStyle(start: string, end: string, timeRangeStart: number): { left: number; width: number } {
  const startMin = timeToMinutes(start)
  const endMin = timeToMinutes(end)
  
  const left = ((startMin - timeRangeStart) / 60) * HOUR_WIDTH
  const width = ((endMin - startMin) / 60) * HOUR_WIDTH
  
  return { left, width: Math.max(width, 60) }
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

// 分配助教弹窗内容
function AssignTeacherPopover({
  slot,
  teachers,
  teacherAssignStatuses,
  onAssign,
  onRemove
}: { 
  slot: StudentSlot
  teachers: TeacherWithColor[]
  teacherAssignStatuses: TeacherAssignStatus[]
  onAssign: (teacherId: string) => void
  onRemove: () => void
}) {
  const [confirmTeacher, setConfirmTeacher] = useState<TeacherWithColor | null>(null)
  
  return (
    <div className="space-y-3">
      {/* 标题 */}
      <div className="font-medium text-base">{slot.student.name}</div>
      <div className="text-sm text-muted-foreground">
        {slot.preferredStart.slice(0, 5)} - {slot.preferredEnd.slice(0, 5)} ({slot.durationHours}h)
      </div>
      
      {/* 当前分配 */}
      {slot.status === 'scheduled' && slot.teacher && (
        <div 
          className="flex items-center justify-between p-2 rounded"
          style={{ backgroundColor: slot.teacher.color + '20', borderLeft: `4px solid ${slot.teacher.color}` }}
        >
          <span className="text-sm font-medium">当前: {slot.teacher.name}</span>
          <Button size="sm" variant="outline" onClick={onRemove}>
            取消分配
          </Button>
        </div>
      )}
      
      {/* 助教列表 */}
      <div className="text-sm font-medium pt-2 border-t">选择助教</div>
      <div className="space-y-1">
        {teacherAssignStatuses.map(status => {
          const isHardConflict = status.conflictType === 'hard'
          const isSoftConflict = status.conflictType === 'soft'
          
          return (
            <div key={status.teacher.id}>
              <button
                className={`w-full text-left p-2 rounded-lg transition-colors ${
                  isHardConflict 
                    ? 'bg-gray-100 cursor-not-allowed opacity-50' 
                    : 'hover:bg-muted cursor-pointer'
                }`}
                style={{ 
                  borderLeft: `4px solid ${status.teacher.color}`,
                  backgroundColor: isHardConflict ? undefined : status.teacher.color + '10'
                }}
                disabled={isHardConflict}
                onClick={() => {
                  if (isSoftConflict) {
                    setConfirmTeacher(status.teacher)
                  } else if (!isHardConflict) {
                    onAssign(status.teacher.id)
                  }
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{status.teacher.name}</span>
                  {isHardConflict && (
                    <span className="text-xs text-red-500 flex items-center gap-1">
                      <X className="h-3 w-3" />
                      不可用
                    </span>
                  )}
                  {isSoftConflict && (
                    <span className="text-xs text-orange-500 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      警告
                    </span>
                  )}
                </div>
                {status.reasons.length > 0 && (
                  <div className="text-xs text-muted-foreground mt-1">
                    {status.reasons.join('；')}
                  </div>
                )}
              </button>
            </div>
          )
        })}
        
        {teachers.length === 0 && (
          <div className="text-center text-muted-foreground py-4 text-sm">
            暂无可用助教
          </div>
        )}
      </div>
      
      {/* 软冲突确认弹窗 */}
      {confirmTeacher && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-4 max-w-sm mx-4">
            <div className="font-medium mb-2">确认分配</div>
            <div className="text-sm text-muted-foreground mb-4">
              该助教不完全匹配，是否仍然分配？
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setConfirmTeacher(null)}>
                取消
              </Button>
              <Button 
                size="sm" 
                onClick={() => {
                  onAssign(confirmTeacher.id)
                  setConfirmTeacher(null)
                }}
              >
                确认分配
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// 学生行组件
function StudentRowComponent({ 
  row, 
  timeRangeStart,
  timeRangeEnd,
  teachers,
  getTeacherAssignStatuses,
  onAssign,
  onRemove,
  scrollLeft
}: { 
  row: StudentRow
  timeRangeStart: number
  timeRangeEnd: number
  teachers: TeacherWithColor[]
  getTeacherAssignStatuses: (slot: StudentSlot) => TeacherAssignStatus[]
  onAssign: (slotId: string, teacherId: string) => void
  onRemove: (slotId: string) => void
  scrollLeft: number
}) {
  const totalWidth = ((timeRangeEnd - timeRangeStart) / 60) * HOUR_WIDTH
  
  return (
    <div className="flex border-b hover:bg-muted/30">
      {/* 学生信息列 */}
      <div className="w-32 flex-shrink-0 border-r p-2 flex flex-col justify-center">
        <div className="font-medium text-sm truncate">{row.student.name}</div>
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

// 助教时间轴行组件（用于下方助教排课一览）
function TeacherTimelineRow({
  card,
  timeRangeStart,
  timeRangeEnd,
  scheduledClasses,
  students,
  scrollLeft,
  selectedDate,
  onClick
}: {
  card: TeacherCardData
  timeRangeStart: number
  timeRangeEnd: number
  scheduledClasses: (ScheduledClass & { student?: Teacher })[]
  students: (Student & { billing: Billing | null; preferences: StudentSchedulePreference[] })[]
  scrollLeft: number
  selectedDate: string
  onClick: () => void
}) {
  const totalWidth = ((timeRangeEnd - timeRangeStart) / 60) * HOUR_WIDTH
  
  // 获取该助教今日可用时段 - 使用选中日期计算星期
  const dayOfWeek = getDayOfWeek(selectedDate)
  const todayAvail = (card.teacher.availabilities || []).filter(
    (a: TeacherAvailability) => a.day_of_week === dayOfWeek
  )
  
  // 获取该助教今日已排课程
  const teacherClasses = scheduledClasses.filter(
    c => c.teacher_id === card.teacher.id && c.status === 'scheduled'
  )
  
  return (
    <div
      className="flex border-b hover:bg-muted/20 cursor-pointer"
      style={{ height: `${ROW_HEIGHT}px` }}
      onClick={onClick}
    >
      {/* 助教名称列 */}
      <div className="w-32 flex-shrink-0 border-r px-2 flex flex-col justify-center">
        <div
          className="text-xs font-medium truncate"
          style={{ color: card.color }}
        >
          {card.teacher.name}
        </div>
        <div className="text-[10px] text-muted-foreground">
          {card.scheduledHours > 0 ? `已排 ${card.scheduledHours}h` : '未排课'}
        </div>
      </div>
      
      {/* 时间轴区域（通过 translateX 同步滚动） */}
      <div className="flex-1 overflow-hidden">
        <div
          className="relative h-full"
          style={{
            width: `${totalWidth}px`,
            transform: `translateX(-${scrollLeft}px)`,
          }}
        >
          {/* 可用时段背景 */}
          {todayAvail.map((avail: TeacherAvailability, i: number) => {
            const startMin = timeToMinutes(avail.start_time || '00:00')
            const endMin = timeToMinutes(avail.end_time || '23:59')
            const left = ((startMin - timeRangeStart) / 60) * HOUR_WIDTH
            const width = ((endMin - startMin) / 60) * HOUR_WIDTH
            return (
              <div
                key={i}
                className="absolute top-1 bottom-1 rounded"
                style={{
                  left: `${left}px`,
                  width: `${Math.max(width, 0)}px`,
                  backgroundColor: card.color + '15',
                  border: `1px solid ${card.color}30`,
                }}
              />
            )
          })}
          
          {/* 时间网格线 */}
          {Array.from({ length: (timeRangeEnd - timeRangeStart) / 60 + 1 }).map((_, i) => (
            <div
              key={i}
              className="absolute top-0 bottom-0 border-l border-dashed border-muted"
              style={{ left: `${i * HOUR_WIDTH}px` }}
            />
          ))}
          
          {/* 已排课程块 */}
          {teacherClasses.map(cls => {
            const startMin = timeToMinutes(cls.start_time || '09:00')
            const endMin = timeToMinutes(cls.end_time || '11:00')
            const left = ((startMin - timeRangeStart) / 60) * HOUR_WIDTH
            const width = ((endMin - startMin) / 60) * HOUR_WIDTH
            const student = students.find(s => s.id === cls.student_id)
            
            return (
              <div
                key={cls.id}
                className="absolute top-2 bottom-2 rounded flex items-center justify-center text-white text-[10px] font-medium overflow-hidden"
                style={{
                  left: `${left}px`,
                  width: `${Math.max(width - 2, 40)}px`,
                  backgroundColor: card.color,
                }}
                title={`${student?.name || '未知'} ${cls.start_time?.slice(0,5)}-${cls.end_time?.slice(0,5)}`}
              >
                <span className="truncate px-1">{student?.name}</span>
              </div>
            )
          })}
          
          {/* 无时段占位 */}
          {todayAvail.length === 0 && (
            <div className="absolute inset-0 flex items-center pl-4">
              <span className="text-xs text-muted-foreground">今日无可用时段</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// 助教卡片组件（右侧面板）- 紧凑竖排版本
function TeacherStatusCard({ 
  data,
  onClick
}: { 
  data: TeacherCardData
  onClick?: () => void
}) {
  return (
    <div
      className={`p-2 rounded border-l-4 transition-all duration-150 cursor-pointer hover:bg-muted/50 ${
        data.isFull ? 'bg-gray-50 opacity-60' : 'bg-white'
      }`}
      style={{ borderLeftColor: data.color }}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <span className="font-medium text-sm truncate">{data.teacher.name}</span>
        {data.isFull ? (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-400 text-white">已满</span>
        ) : (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">
            {data.scheduledHours}h/{data.scheduledHours + data.remainingHours}h
          </span>
        )}
      </div>
      <div className="text-[10px] text-muted-foreground mt-1 truncate">
        {data.todayAvailability === '今日无可用时段' ? '无时段' : data.todayAvailability}
      </div>
    </div>
  )
}

// 助教详情悬浮卡片组件
function TeacherDetailCard({
  open,
  onClose,
  teacherData,
  scheduledClasses,
  students,
  onRemoveClass,
  selectedDate
}: {
  open: boolean
  onClose: () => void
  teacherData: TeacherCardData | null
  scheduledClasses: (ScheduledClass & { teacher?: Teacher })[]
  students: (Student & { billing: Billing | null; preferences: StudentSchedulePreference[] })[]
  onRemoveClass: (classId: string) => void
  selectedDate: string
}) {
  const [removingClassId, setRemovingClassId] = useState<string | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  
  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open, onClose])
  
  // ESC关闭
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    
    if (open) {
      document.addEventListener('keydown', handleEsc)
    }
    
    return () => {
      document.removeEventListener('keydown', handleEsc)
    }
  }, [open, onClose])
  
  if (!open || !teacherData) return null
  
  // 获取该助教今日已排课程
  const teacherClasses = scheduledClasses.filter(c => 
    c.teacher_id === teacherData.teacher.id && c.status === 'scheduled'
  )
  
  // 获取助教今日可用时段范围
  const dayOfWeek = getDayOfWeek(selectedDate)
  const todayAvail = (teacherData.teacher.availabilities || [])
    .filter(a => a.day_of_week === dayOfWeek)
  
  // 计算时间范围（只显示可用时段）
  let minStart = 24 * 60
  let maxEnd = 0
  todayAvail.forEach(a => {
    const start = timeToMinutes(a.start_time || '00:00')
    const end = timeToMinutes(a.end_time || '23:59')
    if (start < minStart) minStart = start
    if (end > maxEnd) maxEnd = end
  })
  
  // 如果没有设置可用时段，使用默认值
  if (minStart === 24 * 60) minStart = 8 * 60
  if (maxEnd === 0) maxEnd = 21 * 60
  
  const timeSpan = maxEnd - minStart
  
  // 计算已排课程色块
  const classBlocks = teacherClasses.map(c => {
    const startMin = timeToMinutes(c.start_time || '09:00')
    const endMin = timeToMinutes(c.end_time || '11:00')
    
    // 查找学生姓名
    const student = students.find(s => s.id === c.student_id)
    
    return {
      id: c.id,
      start: c.start_time || '09:00',
      end: c.end_time || '11:00',
      startMin,
      endMin,
      studentName: student?.name || '未知学生',
      duration: c.duration_hours
    }
  })
  
  // 计算空档时段（只计算已排课程之间的间隔）
  const gaps: { start: number; end: number; duration: number }[] = []
  
  // 按开始时间排序课程
  const sortedClasses = [...classBlocks].sort((a, b) => a.startMin - b.startMin)
  
  // 只计算课程之间的空档（不包括可用时段的开始前和结束后的时间）
  for (let i = 0; i < sortedClasses.length - 1; i++) {
    const currentClass = sortedClasses[i]
    const nextClass = sortedClasses[i + 1]
    
    // 如果当前课程结束时间小于下一课程开始时间，存在空档
    if (currentClass.endMin < nextClass.startMin) {
      gaps.push({
        start: currentClass.endMin,
        end: nextClass.startMin,
        duration: nextClass.startMin - currentClass.endMin
      })
    }
  }
  
  // 汇总信息
  const totalScheduledHours = teacherClasses.reduce((sum, c) => sum + c.duration_hours, 0)
  const maxGapMinutes = Math.max(...gaps.map(g => g.duration), 0)
  const maxGapHours = maxGapMinutes / 60
  
  // 处理取消排课
  const handleRemoveClass = async (classId: string) => {
    if (!confirm('确定要取消该节排课吗？')) return
    setRemovingClassId(classId)
    try {
      await onRemoveClass(classId)
    } finally {
      setRemovingClassId(null)
    }
  }
  
  return (
    <div
      ref={cardRef}
      className="absolute top-0 right-0 z-50 bg-white rounded-lg shadow-lg border"
      style={{ width: '640px', maxHeight: '640px' }}
    >
      {/* 第一块：基本信息（一行） */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <div 
            className="w-2.5 h-2.5 rounded-full" 
            style={{ backgroundColor: teacherData.color }}
          />
          <span className="font-medium text-sm">{teacherData.teacher.name}</span>
          <span className="text-xs text-muted-foreground">
            {teacherData.todayAvailability === '今日无可用时段' ? '无时段' : teacherData.todayAvailability}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs">
            已排 <span className="font-medium">{totalScheduledHours}h</span>
          </span>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-muted"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      
      {/* 第二块：时间轴（紧凑） */}
      <div className="px-3 py-2 border-b">
        <div 
          className="relative h-12 bg-muted/20 rounded"
          style={{ 
            minWidth: '100%',
            overflow: 'hidden'
          }}
        >
          {/* 时间标签 */}
          <div className="flex text-[9px] text-muted-foreground absolute -top-0.5 left-0 right-0">
            {Array.from({ length: Math.ceil(timeSpan / 60) + 1 }).map((_, i) => {
              const time = minStart + i * 60
              if (time > maxEnd) return null
              const leftPercent = ((time - minStart) / timeSpan) * 100
              return (
                <div 
                  key={i} 
                  className="absolute"
                  style={{ left: `${leftPercent}%` }}
                >
                  {minutesToTime(time).slice(0, 5)}
                </div>
              )
            })}
          </div>
          
          {/* 空档区域（浅红色） */}
          {gaps.map((gap, i) => {
            const leftPercent = ((gap.start - minStart) / timeSpan) * 100
            const widthPercent = ((gap.end - gap.start) / timeSpan) * 100
            const gapHours = gap.duration / 60
            return (
              <div
                key={i}
                className="absolute top-3 bottom-1 bg-red-100"
                style={{ left: `${leftPercent}%`, width: `${widthPercent}%` }}
              >
                {gap.duration > 90 && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-[8px] text-orange-500 font-medium bg-orange-50 px-1 rounded">
                      空档{gapHours.toFixed(1)}h
                    </span>
                  </div>
                )}
              </div>
            )
          })}
          
          {/* 已排课程色块 */}
          {classBlocks.map(block => {
            const leftPercent = ((block.startMin - minStart) / timeSpan) * 100
            const widthPercent = ((block.endMin - block.startMin) / timeSpan) * 100
            return (
              <div
                key={block.id}
                className="absolute top-3 bottom-1 rounded cursor-pointer hover:opacity-80 transition-opacity flex items-center justify-center text-[9px] text-white font-medium"
                style={{ 
                  left: `${leftPercent}%`, 
                  width: `${Math.max(widthPercent, 8)}%`,
                  backgroundColor: teacherData.color,
                }}
                onClick={() => handleRemoveClass(block.id)}
                title={`${block.studentName} ${block.start.slice(0,5)}-${block.end.slice(0,5)} 点击取消`}
              >
                <span className="truncate px-1">{block.studentName}</span>
              </div>
            )
          })}
        </div>
      </div>
      
      {/* 第三块：已排课列表（紧凑） */}
      <div className="px-3 py-2 overflow-y-auto" style={{ maxHeight: '216px' }}>
        {teacherClasses.length === 0 ? (
          <div className="text-xs text-muted-foreground text-center py-3">
            今日暂无排课
          </div>
        ) : (
          <div className="space-y-1">
            {teacherClasses.map(c => {
              const student = students.find(s => s.id === c.student_id)
              return (
                <div 
                  key={c.id}
                  className="flex items-center justify-between h-9 px-2 bg-muted/20 rounded hover:bg-muted/40 transition-colors"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div 
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: teacherData.color }}
                    />
                    <span className="text-xs font-medium truncate">{student?.name || '未知'}</span>
                    <span className="text-[10px] text-muted-foreground flex-shrink-0">
                      {c.start_time?.slice(0, 5)}-{c.end_time?.slice(0, 5)}
                    </span>
                    <span className="text-[10px] text-muted-foreground flex-shrink-0">({c.duration_hours}h)</span>
                  </div>
                  <button
                    className="p-1 rounded hover:bg-red-100 text-red-500 flex-shrink-0"
                    onClick={() => handleRemoveClass(c.id)}
                    disabled={removingClassId === c.id}
                    title="取消排课"
                  >
                    {removingClassId === c.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Trash2 className="h-3 w-3" />
                    )}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
      
      {/* 底部：统计数据 */}
      <div className="px-3 py-2 border-t bg-muted/30 flex items-center justify-between text-[10px]">
        <span>总排课 <span className="font-medium">{totalScheduledHours}h</span></span>
        <div className="flex items-center gap-1">
          {maxGapHours > 1.5 ? (
            <span className="text-orange-500 font-medium flex items-center gap-0.5">
              <AlertTriangle className="h-2.5 w-2.5" />
              最长空档{maxGapHours.toFixed(1)}h
            </span>
          ) : (
            <span>最长空档 <span className="font-medium">{maxGapHours.toFixed(1)}h</span></span>
          )}
        </div>
        {totalScheduledHours < 2 && totalScheduledHours > 0 && (
          <span className="text-orange-500 flex items-center gap-0.5">
            <AlertTriangle className="h-2.5 w-2.5" />
            课时较少
          </span>
        )}
      </div>
    </div>
  )
}

interface ManualScheduleProps {
  initialDate?: string  // 初始日期参数
}

export function ManualSchedule({ initialDate }: ManualScheduleProps) {
  // 日期状态
  const [selectedDate, setSelectedDate] = useState(initialDate || formatDate(new Date()))
  
  // 监听初始日期变化
  useEffect(() => {
    if (initialDate) {
      setSelectedDate(initialDate)
    }
  }, [initialDate])
  
  // 数据状态
  const [students, setStudents] = useState<(Student & { billing: Billing | null; preferences: StudentSchedulePreference[] })[]>([])
  const [teachers, setTeachers] = useState<TeacherWithColor[]>([])
  const [scheduledClasses, setScheduledClasses] = useState<(ScheduledClass & { teacher?: Teacher })[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  // 本地排课状态（未保存）
  const [localSchedules, setLocalSchedules] = useState<Map<string, string>>(new Map()) // slotId -> teacherId
  
  // 筛选状态：只显示有可用时段的助教
  const [showOnlyAvailable, setShowOnlyAvailable] = useState(true)
  
  // 助教详情面板状态
  const [selectedTeacherCard, setSelectedTeacherCard] = useState<TeacherCardData | null>(null)
  
  // 助教面板折叠状态
  const [teacherPanelCollapsed, setTeacherPanelCollapsed] = useState(false)
  
  // 横向滚动位置（用于同步学生和助教面板）
  const [scrollLeft, setScrollLeft] = useState(0)
  
  // 分隔线拖动状态 - 学生区高度百分比
  const [studentPanelHeightPercent, setStudentPanelHeightPercent] = useState(60)
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  
  // 分隔线拖动处理
  const handleDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])
  
  // 全局拖动事件
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return
      
      const container = containerRef.current
      const rect = container.getBoundingClientRect()
      const newPercent = ((e.clientY - rect.top) / rect.height) * 100
      
      // 限制范围：最小30%，最大85%
      const clampedPercent = Math.max(30, Math.min(85, newPercent))
      setStudentPanelHeightPercent(clampedPercent)
    }
    
    const handleMouseUp = () => {
      setIsDragging(false)
    }
    
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging])
  
  // 关闭详情面板
  const handleCloseTeacherDetail = useCallback(() => {
    setSelectedTeacherCard(null)
  }, [])
  
  // 从详情面板取消排课
  const handleRemoveClassFromDetail = useCallback(async (classId: string) => {
    await scheduledClassDb.delete(classId)
    loadData()
  }, [])
  
  // 横向滚动同步 - 只需要监听时间轴头部的滚动
  const headerScrollRef = useRef<HTMLDivElement>(null)
  
  // 监听时间轴头部滚动，同步更新 scrollLeft 状态
  useEffect(() => {
    const headerEl = headerScrollRef.current
    if (!headerEl) return
    
    const handleScroll = () => {
      setScrollLeft(headerEl.scrollLeft)
    }
    
    headerEl.addEventListener('scroll', handleScroll)
    return () => {
      headerEl.removeEventListener('scroll', handleScroll)
    }
  }, [loading])
  
  // 加载数据
  const loadData = async () => {
    try {
      setLoading(true)
      
      // 加载学生（带偏好）
      const studentsData = await studentDb.getAllWithBilling(
        { status: 'active', student_type: 'all', level: 'all', grade: 'all', search: '' },
        { field: 'student_no', direction: 'asc' }
      )
      
      const studentsWithPrefs = await Promise.all(
        studentsData.map(async (s) => {
          const prefs = await studentSchedulePreferenceDb.getByStudentId(s.id)
          return { ...s, preferences: prefs }
        })
      )
      
      // 加载助教（带可用时段）
      const teachersData = await teacherDb.getActive()
      
      const teachersWithColor = await Promise.all(
        teachersData.map(async (t, index) => {
          // 加载每个助教的可用时段
          const availabilities = await teacherAvailabilityDb.getByTeacherId(t.id)
          return { 
            ...t, 
            color: TEACHER_COLORS[index % TEACHER_COLORS.length],
            availabilities
          }
        })
      )
      
      // 加载当天已排课程
      const classes = await scheduledClassDb.getByDate(selectedDate)
      
      setStudents(studentsWithPrefs)
      setTeachers(teachersWithColor)
      setScheduledClasses(classes)
      setLocalSchedules(new Map()) // 重置本地排课
      
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }
  
  useEffect(() => {
    loadData()
  }, [selectedDate])
  
  // 构建学生行数据
  const studentRows = useMemo((): StudentRow[] => {
    const dayOfWeek = getDayOfWeek(selectedDate)
    const rowsMap = new Map<string, StudentRow>()
    
    students.forEach(student => {
      const slots: StudentSlot[] = []
      
      // 查找当天对应的偏好时段
      const todayPrefs = student.preferences.filter(p => p.day_of_week === dayOfWeek)
      
      if (todayPrefs.length > 0) {
        todayPrefs.forEach(pref => {
          const start = pref.preferred_start || '09:00'
          const end = pref.preferred_end || '11:00'
          const [startH, startM] = start.split(':').map(Number)
          const [endH, endM] = end.split(':').map(Number)
          const durationHours = (endH * 60 + endM - startH * 60 - startM) / 60
          
          // 检查是否已排课
          const existingClass = scheduledClasses.find(c => 
            c.student_id === student.id && 
            c.status === 'scheduled' &&
            c.start_time === start
          )
          
          // 检查本地排课
          const slotId = `${student.id}-${start}`
          const localTeacherId = localSchedules.get(slotId)
          
          let teacher: TeacherWithColor | undefined
          let status: 'unscheduled' | 'scheduled' = 'unscheduled'
          
          if (localTeacherId) {
            teacher = teachers.find(t => t.id === localTeacherId)
            status = 'scheduled'
          } else if (existingClass && existingClass.teacher_id) {
            teacher = teachers.find(t => t.id === existingClass.teacher_id)
            status = 'scheduled'
          }
          
          slots.push({
            id: slotId,
            student,
            preferredStart: start,
            preferredEnd: end,
            durationHours,
            scheduledClass: existingClass,
            teacherId: teacher?.id,
            teacher,
            status
          })
        })
      } else {
        // 没有偏好时段，检查是否有已排课程
        const existingClasses = scheduledClasses.filter(c => 
          c.student_id === student.id && 
          c.status === 'scheduled'
        )
        
        existingClasses.forEach(existingClass => {
          const start = existingClass.start_time || '09:00'
          const end = existingClass.end_time || '11:00'
          const [startH, startM] = start.split(':').map(Number)
          const [endH, endM] = end.split(':').map(Number)
          const durationHours = (endH * 60 + endM - startH * 60 - startM) / 60
          
          let teacher: TeacherWithColor | undefined
          if (existingClass.teacher_id) {
            teacher = teachers.find(t => t.id === existingClass.teacher_id)
          }
          
          slots.push({
            id: `${student.id}-${start}`,
            student,
            preferredStart: start,
            preferredEnd: end,
            durationHours,
            scheduledClass: existingClass,
            teacherId: teacher?.id,
            teacher,
            status: 'scheduled'
          })
        })
      }
      
      // 只添加有时段的学生
      if (slots.length > 0) {
        rowsMap.set(student.id, { student, slots })
      }
    })
    
    // 转换为数组并按学生姓名排序
    return Array.from(rowsMap.values()).sort((a, b) => 
      a.student.name.localeCompare(b.student.name, 'zh-CN')
    )
  }, [students, scheduledClasses, localSchedules, teachers, selectedDate])
  
  // 计算时间范围
  const timeRange = useMemo(() => {
    const allSlots = studentRows.flatMap(row => row.slots)
    if (allSlots.length === 0) {
      return { start: 8 * 60, end: 21 * 60 }
    }
    return getTimeRange(allSlots)
  }, [studentRows])
  
  // 构建助教卡片数据
  const teacherCards = useMemo(() => {
    const dayOfWeek = getDayOfWeek(selectedDate)
    
    return teachers.map(teacher => {
      // 获取今日可用时段
      const teacherAvails = (teacher as any).availabilities || []
      const todayAvail = teacherAvails.filter((a: TeacherAvailability) => a.day_of_week === dayOfWeek)
      const availabilityStr = todayAvail.map((a: TeacherAvailability) => 
        `${a.start_time?.slice(0, 5) || '00:00'}-${a.end_time?.slice(0, 5) || '23:59'}`
      ).join(', ') || '今日无可用时段'
      
      // 计算已排课时
      const teacherClasses = scheduledClasses.filter(c => 
        c.teacher_id === teacher.id && 
        c.status === 'scheduled'
      )
      const scheduledHours = teacherClasses.reduce((sum, c) => sum + c.duration_hours, 0)
      
      // 计算可用时长
      const totalAvailMinutes = todayAvail.reduce((sum: number, a: TeacherAvailability) => {
        const [startH, startM] = (a.start_time || '00:00').split(':').map(Number)
        const [endH, endM] = (a.end_time || '23:59').split(':').map(Number)
        return sum + (endH * 60 + endM - startH * 60 - startM)
      }, 0)
      const remainingHours = Math.max(0, totalAvailMinutes / 60 - scheduledHours)
      
      // 是否已满
      const isFull = remainingHours <= 0
      
      // 适合程度
      const suitableLevelsRaw = teacher.suitable_levels
      let suitableLevelsParsed: string[] = []
      try {
        if (Array.isArray(suitableLevelsRaw)) {
          suitableLevelsParsed = suitableLevelsRaw
        } else if (typeof suitableLevelsRaw === 'string' && suitableLevelsRaw) {
          const parsed = JSON.parse(suitableLevelsRaw)
          if (Array.isArray(parsed)) suitableLevelsParsed = parsed
        }
      } catch {
        suitableLevelsParsed = []
      }
      
      // 适合年级
      const suitableGrades = teacher.suitable_grades || ''
      
      return {
        teacher: teacher,
        color: teacher.color,
        todayAvailability: availabilityStr,
        suitableLevels: suitableLevelsParsed.map(l => LEVEL_LABELS[l as LevelType] || l),
        suitableGrades,
        scheduledHours,
        remainingHours,
        isFull,
        hasAvailabilityToday: todayAvail.length > 0
      }
    })
  }, [teachers, scheduledClasses, selectedDate])
  
  // 检查助教冲突
  const checkTeacherConflict = useCallback((teacherId: string, slot: StudentSlot): ConflictInfo => {
    const teacher = teachers.find(t => t.id === teacherId)
    if (!teacher) {
      return { type: 'hard', reasons: ['助教不存在'] }
    }
    
    const dayOfWeek = getDayOfWeek(selectedDate)
    const reasons: string[] = []
    let hasHardConflict = false
    
    // 1. 检查助教可用时段（硬冲突）
    const teacherAvails = (teacher as any).availabilities || []
    const teacherAvailToday = teacherAvails.filter((a: TeacherAvailability) => a.day_of_week === dayOfWeek)
    const slotStart = slot.preferredStart
    const slotEnd = slot.preferredEnd
    
    const isAvailable = teacherAvailToday.some((avail: TeacherAvailability) => {
      const availStart = avail.start_time || '00:00'
      const availEnd = avail.end_time || '23:59'
      return availStart <= slotStart && availEnd >= slotEnd
    })
    
    if (!isAvailable) {
      reasons.push('该时段不可用')
      hasHardConflict = true
    }
    
    // 2. 检查时段冲突 - 已保存到数据库的课程（硬冲突）
    const existingClasses = scheduledClasses.filter(c => 
      c.teacher_id === teacherId && 
      c.status === 'scheduled' &&
      c.id !== slot.scheduledClass?.id
    )
    
    const hasTimeConflict = existingClasses.some(c => {
      const cStart = c.start_time || '00:00'
      const cEnd = c.end_time || '23:59'
      return !(slotEnd <= cStart || slotStart >= cEnd)
    })
    
    if (hasTimeConflict) {
      reasons.push('该时段已有其他课程')
      hasHardConflict = true
    }
    
    // 3. 检查时段冲突 - 本地临时排课（硬冲突）
    const allSlots = studentRows.flatMap(row => row.slots)
    localSchedules.forEach((localTeacherId, localSlotId) => {
      // 只检查同一助教的分配
      if (localTeacherId !== teacherId) return
      // 不检查当前正在编辑的时段
      if (localSlotId === slot.id) return
      
      const localSlot = allSlots.find(s => s.id === localSlotId)
      if (!localSlot) return
      
      const localStart = localSlot.preferredStart
      const localEnd = localSlot.preferredEnd
      
      // 检查时间是否重叠
      const hasOverlap = !(slotEnd <= localStart || slotStart >= localEnd)
      if (hasOverlap) {
        reasons.push(`该时段已被分配给 ${localSlot.student.name}`)
        hasHardConflict = true
      }
    })
    
    // 3. 检查程度匹配（软冲突）
    if (teacher.suitable_levels) {
      let levels: string[] = []
      if (Array.isArray(teacher.suitable_levels)) {
        levels = teacher.suitable_levels
      } else if (typeof teacher.suitable_levels === 'string' && teacher.suitable_levels) {
        try {
          const parsed = JSON.parse(teacher.suitable_levels)
          if (Array.isArray(parsed)) levels = parsed
        } catch { /* ignore */ }
      }
      
      if (levels.length > 0 && !levels.includes(slot.student.level)) {
        reasons.push(`程度不匹配(适合: ${levels.map(l => LEVEL_LABELS[l as LevelType] || l).join('、')})`)
      }
    }
    
    // 4. 检查年级匹配（软冲突）
    if (teacher.suitable_grades && slot.student.grade) {
      const suitableGradeList = getGradesFromSuitableGrades(teacher.suitable_grades)
      if (suitableGradeList.length > 0 && !suitableGradeList.includes(slot.student.grade)) {
        reasons.push(`年级不匹配(适合: ${teacher.suitable_grades})`)
      }
    }
    
    return {
      type: hasHardConflict ? 'hard' : reasons.length > 0 ? 'soft' : 'none',
      reasons
    }
  }, [teachers, scheduledClasses, selectedDate, localSchedules, studentRows])
  
  // 获取所有助教的分配状态
  const getTeacherAssignStatuses = useCallback((slot: StudentSlot): TeacherAssignStatus[] => {
    return teachers.map(teacher => {
      const conflict = checkTeacherConflict(teacher.id, slot)
      return {
        teacher,
        canAssign: conflict.type !== 'hard',
        conflictType: conflict.type,
        reasons: conflict.reasons
      }
    })
  }, [teachers, checkTeacherConflict])
  
  // 分配助教
  const handleAssign = useCallback((slotId: string, teacherId: string) => {
    const slot = studentRows.flatMap(row => row.slots).find(s => s.id === slotId)
    if (!slot) return
    
    const conflict = checkTeacherConflict(teacherId, slot)
    
    if (conflict.type === 'hard') {
      alert(`无法分配：${conflict.reasons.join('；')}`)
      return
    }
    
    if (conflict.type === 'soft') {
      const confirmed = confirm(`警告：${conflict.reasons.join('；')}\n\n是否仍然分配？`)
      if (!confirmed) return
    }
    
    // 本地更新
    setLocalSchedules(prev => new Map(prev).set(slotId, teacherId))
  }, [studentRows, checkTeacherConflict])
  
  // 取消分配
  const handleRemove = useCallback((slotId: string) => {
    const slot = studentRows.flatMap(row => row.slots).find(s => s.id === slotId)
    if (!slot) return
    
    if (slot.scheduledClass) {
      // 已保存到数据库的课程
      scheduledClassDb.delete(slot.scheduledClass.id).then(() => {
        loadData()
      })
    } else {
      // 仅本地排课
      setLocalSchedules(prev => {
        const newMap = new Map(prev)
        newMap.delete(slotId)
        return newMap
      })
    }
  }, [studentRows])
  
  // 清空本日排课
  const handleClearDay = async () => {
    if (!confirm('确定要清空本日所有排课吗？此操作不可恢复。')) return
    
    try {
      for (const cls of scheduledClasses) {
        if (cls.status === 'scheduled') {
          await scheduledClassDb.delete(cls.id)
        }
      }
      setLocalSchedules(new Map())
      loadData()
    } catch (error) {
      console.error('Failed to clear day:', error)
      alert('清空失败')
    }
  }
  
  // 保存排课
  const handleSave = async () => {
    if (localSchedules.size === 0) {
      alert('没有需要保存的排课')
      return
    }
    
    try {
      setSaving(true)
      
      const allSlots = studentRows.flatMap(row => row.slots)
      
      for (const [slotId, teacherId] of localSchedules) {
        const slot = allSlots.find(s => s.id === slotId)
        if (!slot) continue
        
        await scheduledClassDb.create({
          student_id: slot.student.id,
          teacher_id: teacherId,
          class_date: selectedDate,
          start_time: slot.preferredStart,
          end_time: slot.preferredEnd,
          duration_hours: slot.durationHours
        })
      }
      
      alert('保存成功')
      loadData()
      
    } catch (error) {
      console.error('Failed to save:', error)
      alert('保存失败')
    } finally {
      setSaving(false)
    }
  }
  
  // 切换日期
  const goToPrevDay = () => {
    const date = new Date(selectedDate)
    date.setDate(date.getDate() - 1)
    setSelectedDate(formatDate(date))
  }
  
  const goToNextDay = () => {
    const date = new Date(selectedDate)
    date.setDate(date.getDate() + 1)
    setSelectedDate(formatDate(date))
  }
  
  const goToToday = () => {
    setSelectedDate(formatDate(new Date()))
  }
  
  // 生成时间轴标签
  const timeLabels = useMemo(() => {
    const labels: string[] = []
    for (let min = timeRange.start; min <= timeRange.end; min += 60) {
      labels.push(minutesToTime(min))
    }
    return labels
  }, [timeRange])
  
  // 快捷日期列表（整周：周一到周日）
  const quickDates = useMemo(() => {
    const today = new Date()
    const dates: { date: string; label: string; icon: 'moon' | 'sun'; dayOfWeek: DayOfWeek }[] = []
    
    // 找到本周的周一
    const monday = new Date(today)
    const dayOfWeek = today.getDay()
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1 // 周日需要回退6天
    monday.setDate(today.getDate() - daysToMonday)
    
    const dayOrder: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    
    dayOrder.forEach((day, index) => {
      const date = new Date(monday)
      date.setDate(monday.getDate() + index)
      
      // 周五显示月亮（晚上），周六周日显示太阳，其他天不显示图标
      let icon: 'moon' | 'sun' | null = null
      if (day === 'friday') {
        icon = 'moon'
      } else if (day === 'saturday' || day === 'sunday') {
        icon = 'sun'
      }
      
      dates.push({
        date: formatDate(date),
        label: DAY_LABELS[day],
        icon: icon as 'moon' | 'sun',
        dayOfWeek: day
      })
    })
    
    return dates
  }, [])
  
  return (
    <div className="h-full flex flex-col">
      {/* 顶部工具栏 */}
      <header className="h-14 border-b bg-card flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold">人工排课</h1>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={goToPrevDay}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <DateInput value={selectedDate} onChange={setSelectedDate} />
            <Button variant="outline" size="icon" onClick={goToNextDay}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={goToToday}>今天</Button>
          </div>
          
          <span className="text-sm text-muted-foreground">
            {DAY_LABELS[getDayOfWeek(selectedDate)]}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleClearDay}>
            <Trash2 className="h-4 w-4 mr-2" />
            清空本日排课
          </Button>
          <Button onClick={handleSave} disabled={saving || localSchedules.size === 0}>
            {saving ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />保存中...</>
            ) : (
              <><Check className="h-4 w-4 mr-2" />保存排课 ({localSchedules.size})</>
            )}
          </Button>
        </div>
      </header>
      
      {/* 主内容区：上下分区 */}
      <div ref={containerRef} className="flex-1 flex flex-col overflow-hidden relative select-none">
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* 上方：学生排课区（动态高度，内容可滚动） */}
            <div 
              className="flex flex-col overflow-hidden flex-shrink-0" 
              style={{ height: `${studentPanelHeightPercent}%` }}
            >
              {/* 时间轴头部（带学生列标题） */}
              <div className="h-10 border-b bg-muted/30 flex flex-shrink-0">
                <div className="w-32 flex-shrink-0 border-r flex items-center justify-center text-sm font-medium text-muted-foreground">
                  学生
                </div>
                <div
                  ref={headerScrollRef}
                  className="flex-1 overflow-x-auto overflow-y-hidden scrollbar-none"
                >
                  <div className="flex" style={{ width: `${((timeRange.end - timeRange.start) / 60) * HOUR_WIDTH}px` }}>
                    {timeLabels.map((time) => (
                      <div
                        key={time}
                        className="flex-shrink-0 text-center text-xs text-muted-foreground border-l"
                        style={{ width: `${HOUR_WIDTH}px` }}
                      >
                        {time.slice(0, 5)}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              
              {/* 学生行（可纵向滚动） */}
              <div className="flex-1 overflow-y-auto">
                {studentRows.length === 0 ? (
                  <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
                    今日无待排课学生（请先为学生设置时段偏好）
                  </div>
                ) : (
                  studentRows.map(row => (
                    <StudentRowComponent
                      key={row.student.id}
                      row={row}
                      timeRangeStart={timeRange.start}
                      timeRangeEnd={timeRange.end}
                      teachers={teachers}
                      getTeacherAssignStatuses={getTeacherAssignStatuses}
                      onAssign={handleAssign}
                      onRemove={handleRemove}
                      scrollLeft={scrollLeft}
                    />
                  ))
                )}
              </div>
            </div>
            
            {/* 可拖动分隔栏 */}
            <div
              className={`h-1.5 bg-border hover:bg-primary/50 cursor-row-resize flex-shrink-0 transition-colors ${
                isDragging ? 'bg-primary' : ''
              }`}
              onMouseDown={handleDividerMouseDown}
            />
            
            {/* 分隔栏信息栏 + 折叠控制 */}
            <div
              className="h-7 border-b bg-muted/30 flex items-center justify-between px-4 flex-shrink-0"
            >
              <span className="text-xs font-medium text-muted-foreground">
                今日助教排课一览
                <span className="ml-2 text-primary">
                  ({teacherCards.filter(c => c.hasAvailabilityToday).length} 位有时段)
                </span>
              </span>
              <div className="flex items-center gap-2">
                {/* 可用助教筛选切换 */}
                <button
                  className={`text-[10px] px-2 py-0.5 rounded ${
                    showOnlyAvailable ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                  }`}
                  onClick={e => { e.stopPropagation(); setShowOnlyAvailable(!showOnlyAvailable) }}
                >
                  {showOnlyAvailable ? '仅今日有空' : '显示全部'}
                </button>
                <button
                  className="p-0.5 rounded hover:bg-muted"
                  onClick={() => setTeacherPanelCollapsed(!teacherPanelCollapsed)}
                  title={teacherPanelCollapsed ? '展开助教面板' : '折叠助教面板'}
                >
                  {teacherPanelCollapsed 
                    ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  }
                </button>
              </div>
            </div>
            
            {/* 下方：助教排课一览（动态高度，填充剩余空间） */}
            {!teacherPanelCollapsed && (
              <div className="border-b flex flex-col flex-1 overflow-hidden">
                {/* 助教面板时间轴头部 */}
                <div className="h-7 border-b bg-muted/20 flex flex-shrink-0">
                  <div className="w-32 flex-shrink-0 border-r flex items-center px-2">
                    <span className="text-xs text-muted-foreground">助教</span>
                  </div>
                  {/* 时间轴标签（只读，与上方同步显示） */}
                  <div className="flex-1 overflow-hidden">
                    <div className="flex" style={{ width: `${((timeRange.end - timeRange.start) / 60) * HOUR_WIDTH}px`, transform: `translateX(-${scrollLeft}px)` }}>
                      {timeLabels.map((time) => (
                        <div
                          key={time}
                          className="flex-shrink-0 text-center text-[10px] text-muted-foreground border-l"
                          style={{ width: `${HOUR_WIDTH}px` }}
                        >
                          {time.slice(0, 5)}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                
                {/* 助教行（可纵向滚动，填充剩余空间） */}
                <div className="overflow-y-auto flex-1">
                  {(() => {
                    const displayCards = showOnlyAvailable
                      ? teacherCards.filter(c => c.hasAvailabilityToday)
                      : teacherCards
                    
                    if (displayCards.length === 0) {
                      return (
                        <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
                          今日无可用助教
                        </div>
                      )
                    }
                    
                    return displayCards.map(card => (
                      <TeacherTimelineRow
                        key={card.teacher.id}
                        card={card}
                        timeRangeStart={timeRange.start}
                        timeRangeEnd={timeRange.end}
                        scheduledClasses={scheduledClasses}
                        students={students}
                        scrollLeft={scrollLeft}
                        selectedDate={selectedDate}
                        onClick={() => setSelectedTeacherCard(card)}
                      />
                    ))
                  })()}
                </div>
              </div>
            )}
            
            {/* 助教详情浮层（点击助教行后出现） */}
            {selectedTeacherCard && (
              <TeacherDetailCard
                open={selectedTeacherCard !== null}
                onClose={handleCloseTeacherDetail}
                teacherData={selectedTeacherCard}
                scheduledClasses={scheduledClasses}
                students={students}
                onRemoveClass={handleRemoveClassFromDetail}
                selectedDate={selectedDate}
              />
            )}
          </>
        )}
      </div>
      
    </div>
  )
}
