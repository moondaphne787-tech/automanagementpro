import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TaskBlock } from '@/components/TaskBlock/TaskBlock'
import { SortableTaskList } from '@/components/TaskBlock/SortableTaskList'
import { cn } from '@/lib/utils'
import { ChevronDown, ChevronUp, RefreshCw, Edit, Save, SkipForward, CheckCheck, Plus, Loader2 } from 'lucide-react'
import type { Student, TaskBlock as TaskBlockType, Wordbank, ClassRecord } from '@/types'
import { FileText, BookOpen } from 'lucide-react'

export type GenerationStatus = 'pending' | 'generating' | 'success' | 'failed' | 'saved' | 'skipped'

export interface StudentContext {
  lastRecord: ClassRecord | null
  lastRecordSummary: string | null
}

export interface StudentPlanState {
  student: Student
  status: GenerationStatus
  plan: {
    tasks: TaskBlockType[]
    notes: string
    reason: string
  } | null
  error: string | null
  expanded: boolean
  editing: boolean
  extraNote: string
  context?: StudentContext
}

interface PlanResultCardProps {
  item: StudentPlanState
  wordbanks: Wordbank[]
  onToggleExpand: (studentId: string) => void
  onToggleEditing: (studentId: string) => void
  onRegenerate: (studentId: string) => void
  onSave: (studentId: string) => void
  onSkip: (studentId: string) => void
  onUpdateExtraNote: (studentId: string, note: string) => void
  onUpdateTask: (studentId: string, taskIndex: number, updatedTask: TaskBlockType) => void
  onDeleteTask: (studentId: string, taskIndex: number) => void
  onAddTask: (studentId: string) => void
  onReorderTasks: (studentId: string, tasks: TaskBlockType[]) => void
  onUpdateNotes: (studentId: string, notes: string) => void
  onUpdateReason: (studentId: string, reason: string) => void
}

export function PlanResultCard({
  item,
  wordbanks,
  onToggleExpand,
  onToggleEditing,
  onRegenerate,
  onSave,
  onSkip,
  onUpdateExtraNote,
  onUpdateTask,
  onDeleteTask,
  onAddTask,
  onReorderTasks,
  onUpdateNotes,
  onUpdateReason
}: PlanResultCardProps) {
  return (
    <Card className={cn(
      item.status === 'failed' && "border-red-300",
      item.status === 'saved' && "border-green-300"
    )}>
      <CardContent className="p-4">
        {/* 头部 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-2 h-2 rounded-full",
              item.status === 'pending' && "bg-gray-400",
              item.status === 'generating' && "bg-blue-500 animate-pulse",
              item.status === 'success' && "bg-green-500",
              item.status === 'failed' && "bg-red-500",
              item.status === 'saved' && "bg-green-600",
              item.status === 'skipped' && "bg-gray-300"
            )} />
            <span className="font-medium">{item.student.name}</span>
            <span className="text-sm text-muted-foreground">{item.student.grade}</span>
            <span className={cn(
              "text-xs px-2 py-0.5 rounded",
              item.status === 'pending' && "bg-gray-100 text-gray-600",
              item.status === 'generating' && "bg-blue-100 text-blue-600",
              item.status === 'success' && "bg-green-100 text-green-600",
              item.status === 'failed' && "bg-red-100 text-red-600",
              item.status === 'saved' && "bg-green-200 text-green-700",
              item.status === 'skipped' && "bg-gray-100 text-gray-500"
            )}>
              {item.status === 'pending' && '等待中'}
              {item.status === 'generating' && '生成中...'}
              {item.status === 'success' && '已完成'}
              {item.status === 'failed' && '失败'}
              {item.status === 'saved' && '已保存'}
              {item.status === 'skipped' && '已跳过'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* 附加提示词输入 - 仅在 pending/failed 状态显示 */}
            {(item.status === 'pending' || item.status === 'failed') && (
              <div className="flex items-center gap-2 flex-1 max-w-[300px]">
                <span className="text-xs text-muted-foreground whitespace-nowrap">附加提示：</span>
                <Input
                  value={item.extraNote}
                  onChange={(e) => onUpdateExtraNote(item.student.id, e.target.value)}
                  placeholder="可选，如：本次重点推进词库"
                  className="h-7 text-xs"
                  onKeyDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            )}
            {item.status === 'success' && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onToggleExpand(item.student.id)}
                >
                  {item.expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </Button>
                {item.expanded && !item.editing && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onToggleEditing(item.student.id)}
                  >
                    <Edit className="w-3 h-3 mr-1" />
                    编辑
                  </Button>
                )}
                {item.expanded && item.editing && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onToggleEditing(item.student.id)}
                  >
                    <CheckCheck className="w-3 h-3 mr-1" />
                    完成编辑
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onRegenerate(item.student.id)}
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  重新生成
                </Button>
                <Button
                  size="sm"
                  onClick={() => onSave(item.student.id)}
                >
                  <Save className="w-3 h-3 mr-1" />
                  保存
                </Button>
              </>
            )}
            {item.status === 'failed' && (
              <>
                <span className="text-xs text-red-600">{item.error}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onRegenerate(item.student.id)}
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  重试
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onSkip(item.student.id)}
                >
                  <SkipForward className="w-3 h-3 mr-1" />
                  跳过
                </Button>
              </>
            )}
            {item.status === 'generating' && (
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
            )}
          </div>
        </div>

        {/* 学员上下文信息：备注 + 上次课堂记录 */}
        {(item.student.notes || item.context?.lastRecordSummary) && (
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {item.student.notes && (
              <span className="flex items-center gap-1">
                <FileText className="w-3 h-3" />
                {item.student.notes}
              </span>
            )}
            {item.context?.lastRecordSummary && (
              <span className="flex items-center gap-1">
                <BookOpen className="w-3 h-3" />
                {item.context.lastRecordSummary}
              </span>
            )}
          </div>
        )}

        {/* 展开的计划内容 */}
        {item.expanded && item.plan && (
          <div className="mt-4 pt-4 border-t space-y-3">
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">任务列表：</p>
                {item.editing && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onAddTask(item.student.id)}
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    添加任务
                  </Button>
                )}
              </div>
              {item.editing ? (
                <>
                  {item.plan.tasks.length > 0 ? (
                    <SortableTaskList
                      tasks={item.plan.tasks}
                      compact
                      wordbanks={wordbanks}
                      onTasksChange={(newTasks) => onReorderTasks(item.student.id, newTasks)}
                      onUpdateTask={(idx, updatedTask) => onUpdateTask(item.student.id, idx, updatedTask)}
                      onDeleteTask={(idx) => onDeleteTask(item.student.id, idx)}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      暂无任务，点击上方按钮添加
                    </p>
                  )}
                </>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {item.plan.tasks.map((task, idx) => (
                    <TaskBlock key={idx} task={task} index={idx} />
                  ))}
                </div>
              )}
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">助教提示：</p>
              {item.editing ? (
                <textarea
                  className="w-full min-h-[60px] p-2 text-sm border rounded-md resize-y"
                  value={item.plan.notes || ''}
                  onChange={(e) => onUpdateNotes(item.student.id, e.target.value)}
                  placeholder="输入助教提示..."
                />
              ) : (
                <p className="text-sm">{item.plan.notes || '无'}</p>
              )}
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">计划说明：</p>
              {item.editing ? (
                <textarea
                  className="w-full min-h-[60px] p-2 text-sm border rounded-md resize-y"
                  value={item.plan.reason || ''}
                  onChange={(e) => onUpdateReason(item.student.id, e.target.value)}
                  placeholder="输入计划说明..."
                />
              ) : (
                <p className="text-sm">{item.plan.reason || '无'}</p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}