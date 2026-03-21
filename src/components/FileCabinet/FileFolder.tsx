import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Clock, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getLevelColor, formatHours, isHoursWarning } from '@/lib/utils'
import type { StudentWithBilling, LEVEL_LABELS, STATUS_LABELS } from '@/types'
import { LEVEL_LABELS as levelLabels, STATUS_LABELS as statusLabels } from '@/types'

interface FileFolderProps {
  student: StudentWithBilling
}

export function FileFolder({ student }: FileFolderProps) {
  const navigate = useNavigate()
  const isWarning = isHoursWarning(student.billing)
  
  return (
    <motion.div
      whileHover={{ y: -8 }}
      transition={{ duration: 0.15 }}
      onClick={() => navigate(`/students/${student.id}`)}
      className={cn(
        "folder-card cursor-pointer bg-card border rounded-lg p-4 relative",
        "hover:shadow-lg transition-shadow",
        student.status !== 'active' && "opacity-60"
      )}
    >
      {/* 体验生标签 */}
      {student.student_type === 'trial' && (
        <div className="absolute top-2 right-2 trial-badge">体验</div>
      )}
      
      {/* 课时预警角标 */}
      {isWarning && student.billing && (
        <div className="absolute -top-1 -left-1 w-4 h-4 bg-warning rounded-full flex items-center justify-center">
          <AlertTriangle className="w-2.5 h-2.5 text-white" />
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