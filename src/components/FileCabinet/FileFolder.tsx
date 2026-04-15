import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Clock, AlertTriangle, CalendarX, UserCog, FilePenLine, BarChart3, Calendar, CalendarCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getLevelColor, formatHours, isHoursWarning } from '@/lib/utils'
import type { StudentWithBilling, LEVEL_LABELS, STATUS_LABELS } from '@/types'
import { LEVEL_LABELS as levelLabels, STATUS_LABELS as statusLabels } from '@/types'

interface FileFolderProps {
  student: StudentWithBilling
  expiredPlansCount?: number
  scheduleInfo?: { nextClassDate: string | null; hasThisWeekClass: boolean }
  onQuickRecord?: (studentId: string) => void
  onViewPlans?: (studentId: string) => void
  onViewProgress?: (studentId: string) => void
}

/** 格式化日期为简短显示：M/D */
function formatShortDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-'
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getMonth() + 1}/${d.getDate()}`
}

/** 计算距今天数 */
function daysAgo(dateStr: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = new Date(dateStr + 'T00:00:00')
  return Math.floor((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
}

export function FileFolder({ student, expiredPlansCount = 0, scheduleInfo, onQuickRecord, onViewPlans, onViewProgress }: FileFolderProps) {
  const navigate = useNavigate()
  const isWarning = isHoursWarning(student.billing)
  const hasExpiredPlans = expiredPlansCount > 0
  
  const lastClassDate = student.last_class_date
  const lastClassDaysAgo = lastClassDate ? daysAgo(lastClassDate) : null
  // 超过14天没上课视为"很久没上课"
  const isLongAbsent = lastClassDaysAgo !== null && lastClassDaysAgo > 14
  
  return (
    <motion.div
      whileHover={{ y: -8 }}
      transition={{ duration: 0.15 }}
      onClick={() => navigate(`/students/${student.id}`)}
      className={cn(
        "folder-card cursor-pointer bg-card border rounded-lg p-4 relative group",
        "hover:shadow-lg transition-shadow",
        student.status !== 'active' && "opacity-60"
      )}
    >
      {/* 体验生标签 — 悬浮时隐藏，让位给快捷按钮 */}
      {student.student_type === 'trial' && (
        <div className="absolute top-2 right-2 trial-badge group-hover:opacity-0 transition-opacity z-[5]">体验</div>
      )}

      {/* 悬浮快捷操作按钮 */}
      <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <button
          title="修改学员信息"
          className="w-7 h-7 rounded-md bg-primary/10 hover:bg-primary/20 text-primary flex items-center justify-center transition-colors"
          onClick={(e) => { e.stopPropagation(); onQuickRecord?.(student.id) }}
        >
          <UserCog className="w-3.5 h-3.5" />
        </button>
        <button
          title="编辑计划"
          className="w-7 h-7 rounded-md bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 flex items-center justify-center transition-colors"
          onClick={(e) => { e.stopPropagation(); onViewPlans?.(student.id) }}
        >
          <FilePenLine className="w-3.5 h-3.5" />
        </button>
        <button
          title="查看进度"
          className="w-7 h-7 rounded-md bg-green-500/10 hover:bg-green-500/20 text-green-600 flex items-center justify-center transition-colors"
          onClick={(e) => { e.stopPropagation(); onViewProgress?.(student.id) }}
        >
          <BarChart3 className="w-3.5 h-3.5" />
        </button>
      </div>
      
      {/* 课时预警角标 */}
      {isWarning && student.billing && !hasExpiredPlans && (
        <div className="absolute -top-1 -left-1 w-4 h-4 bg-warning rounded-full flex items-center justify-center">
          <AlertTriangle className="w-2.5 h-2.5 text-white" />
        </div>
      )}
      
      {/* 过期计划角标 */}
      {hasExpiredPlans && (
        <div className="absolute -top-1 -left-1 min-w-5 h-5 bg-orange-500 rounded-full flex items-center justify-center px-1">
          <CalendarX className="w-3 h-3 text-white" />
          {expiredPlansCount > 1 && (
            <span className="text-xs text-white font-medium ml-0.5">{expiredPlansCount}</span>
          )}
        </div>
      )}
      
      {/* 档案夹标签 */}
      <div className="bg-muted/50 rounded-t px-3 py-1.5 -mx-4 -mt-4 mb-3 border-b">
        <div className="flex items-center gap-2">
          {/* 程度色点 */}
          <div className={cn("w-2.5 h-2.5 rounded-full", getLevelColor(student.level))} />
          <span className="font-medium text-sm truncate">{student.name}</span>
          {/* 本周有课小图标 */}
          {scheduleInfo?.hasThisWeekClass && (
            <span title="本周有排课" className="ml-auto flex-shrink-0">
              <CalendarCheck className="w-3.5 h-3.5 text-green-500" />
            </span>
          )}
        </div>
      </div>
      
      {/* 基本信息 */}
      <div className="space-y-1.5 text-xs text-muted-foreground">
        <div className="flex justify-between">
          <span>学号</span>
          <span className="font-mono">{student.student_no || '-'}</span>
        </div>
        <div className="flex justify-between">
          <span>年级</span>
          <span>{student.grade || '-'}</span>
        </div>
        <div className="flex justify-between">
          <span>程度</span>
          <span>{levelLabels[student.level]}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            剩余课时
          </span>
          <span className={cn(
            "font-medium",
            isWarning && "text-warning font-semibold"
          )}>
            {student.billing ? formatHours(student.billing.remaining_hours) : '0'}h
          </span>
        </div>
        
        {/* 最近上课日期 */}
        <div className="flex justify-between items-center">
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            最近上课
          </span>
          <span className={cn(
            "font-medium",
            isLongAbsent && "text-orange-500"
          )}>
            {lastClassDate ? (
              <>
                {formatShortDate(lastClassDate)}
                {isLongAbsent && (
                  <span className="ml-1 text-[10px] text-orange-500">({lastClassDaysAgo}天前)</span>
                )}
              </>
            ) : (
              <span className="text-muted-foreground">暂无</span>
            )}
          </span>
        </div>
        
        {/* 下次课日期 */}
        {scheduleInfo?.nextClassDate && (
          <div className="flex justify-between items-center">
            <span className="flex items-center gap-1">
              <CalendarCheck className="w-3 h-3" />
              下次课
            </span>
            <span className="font-medium text-green-600 dark:text-green-400">
              {formatShortDate(scheduleInfo.nextClassDate)}
            </span>
          </div>
        )}
      </div>
      
      {/* 状态标签 */}
      {student.status !== 'active' && (
        <div className="mt-3 text-xs text-center py-1 bg-muted rounded">
          {statusLabels[student.status]}
        </div>
      )}
    </motion.div>
  )
}
