import { useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { StudentSlot, TeacherWithColor, TeacherAssignStatus } from './types'

interface AssignTeacherPopoverProps {
  slot: StudentSlot
  teachers: TeacherWithColor[]
  teacherAssignStatuses: TeacherAssignStatus[]
  onAssign: (teacherId: string) => void
  onRemove: () => void
}

export function AssignTeacherPopover({
  slot,
  teachers,
  teacherAssignStatuses,
  onAssign,
  onRemove
}: AssignTeacherPopoverProps) {
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