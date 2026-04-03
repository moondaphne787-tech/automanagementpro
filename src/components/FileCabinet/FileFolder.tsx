import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Clock, AlertTriangle, CalendarX, PenLine, ClipboardList, BarChart3 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getLevelColor, formatHours, isHoursWarning } from '@/lib/utils'
import type { StudentWithBilling, LEVEL_LABELS, STATUS_LABELS } from '@/types'
import { LEVEL_LABELS as levelLabels, STATUS_LABELS as statusLabels } from '@/types'

interface FileFolderProps {
  student: StudentWithBilling
  expiredPlansCount?: number
  onQuickRecord?: (studentId: string) => void
  onViewPlans?: (studentId: string) => void
  onViewProgress?: (studentId: string) => void
}

export function FileFolder({ student, expiredPlansCount = 0, onQuickRecord, onViewPlans, onViewProgress }: FileFolderProps) {
  const navigate = useNavigate()
  const isWarning = isHoursWarning(student.billing)
  const hasExpiredPlans = expiredPlansCount > 0
  
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
          title="快速录入"
          className="w-7 h-7 rounded-md bg-primary/10 hover:bg-primary/20 text-primary flex items-center justify-center transition-colors"
          onClick={(e) => { e.stopPropagation(); onQuickRecord?.(student.id) }}
        >
          <PenLine className="w-3.5 h-3.5" />
        </button>
        <button
          title="查看计划"
          className="w-7 h-7 rounded-md bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 flex items-center justify-center transition-colors"
          onClick={(e) => { e.stopPropagation(); onViewPlans?.(student.id) }}
        >
          <ClipboardList className="w-3.5 h-3.5" />
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