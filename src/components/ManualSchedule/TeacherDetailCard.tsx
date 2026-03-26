import { useState, useEffect, useRef } from 'react'
import { X, Trash2, Loader2, AlertTriangle } from 'lucide-react'
import type { 
  TeacherCardData, 
  ScheduledClass, 
  Teacher, 
  Student, 
  Billing, 
  StudentSchedulePreference 
} from './types'
import { getDayOfWeek, timeToMinutes, minutesToTime } from './hooks/useManualSchedule'

interface TeacherDetailCardProps {
  open: boolean
  onClose: () => void
  teacherData: TeacherCardData | null
  scheduledClasses: (ScheduledClass & { teacher?: Teacher })[]
  students: (Student & { billing: Billing | null; preferences: StudentSchedulePreference[] })[]
  onRemoveClass: (classId: string) => void
  selectedDate: string
}

export function TeacherDetailCard({
  open,
  onClose,
  teacherData,
  scheduledClasses,
  students,
  onRemoveClass,
  selectedDate
}: TeacherDetailCardProps) {
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