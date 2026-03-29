import type { 
  TeacherCardData, 
  ScheduledClass, 
  Teacher, 
  Student, 
  Billing, 
  StudentSchedulePreference,
  TeacherAvailability,
  DayOfWeek
} from './types'
import { HOUR_WIDTH, ROW_HEIGHT } from './constants'
import { getDayOfWeek, timeToMinutes } from './hooks/useManualSchedule'

interface TeacherTimelineRowProps {
  card: TeacherCardData
  timeRangeStart: number
  timeRangeEnd: number
  scheduledClasses: (ScheduledClass & { student?: Teacher })[]
  students: (Student & { billing: Billing | null; preferences: StudentSchedulePreference[] })[]
  selectedDate: string
  onClick: () => void
}

export function TeacherTimelineRow({
  card,
  timeRangeStart,
  timeRangeEnd,
  scheduledClasses,
  students,
  selectedDate,
  onClick
}: TeacherTimelineRowProps) {
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
      {/* 助教名称列 - 固定 */}
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
      
      {/* 时间轴区域 - 通过原生 JS 同步滚动，添加 data 属性便于查询 */}
      <div className="flex-1 overflow-hidden">
        {/* 内部内容容器 - 通过 transform 实现同步滚动 */}
        <div
          data-scroll-sync="timeline"
          className="relative h-full"
          style={{
            width: `${totalWidth}px`,
            transform: 'translateX(0px)',
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