import { useState } from 'react'
import { toast } from 'sonner'
import { Plus, Calendar, FileText, Check, Loader2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { TaskBlock, createEmptyTask } from '@/components/TaskBlock/TaskBlock'
import { SortableTaskList } from '@/components/TaskBlock/SortableTaskList'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/appStore'
import type { LessonPlan, TaskBlock as TaskBlockType, Wordbank } from '@/types'

interface PlanEditorProps {
  studentId: string
  plans: LessonPlan[]
  onPlansChange: () => void
  compact?: boolean
  wordbanks?: Wordbank[]
  /** 只读卡片右侧的额外操作按钮 */
  renderCardActions?: (plan: LessonPlan) => React.ReactNode
  /** 是否在编辑态显示删除按钮（紧凑模式默认显示） */
  showDeleteInEdit?: boolean
}

export function PlanEditor({
  studentId,
  plans,
  onPlansChange,
  compact = false,
  wordbanks = [],
  renderCardActions,
  showDeleteInEdit = false,
}: PlanEditorProps) {
  const updateLessonPlan = useAppStore(s => s.updateLessonPlan)
  const deleteLessonPlan = useAppStore(s => s.deleteLessonPlan)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTasks, setEditTasks] = useState<TaskBlockType[]>([])
  const [editNotes, setEditNotes] = useState('')
  const [editDate, setEditDate] = useState('')
  const [saving, setSaving] = useState(false)

  const startEdit = (plan: LessonPlan) => {
    setEditingId(plan.id)
    setEditTasks([...plan.tasks])
    setEditNotes(plan.notes || '')
    setEditDate(plan.plan_date || '')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditTasks([])
    setEditNotes('')
    setEditDate('')
  }

  const handleSave = async () => {
    if (!editingId) return
    setSaving(true)
    try {
      await updateLessonPlan(editingId, {
        plan_date: editDate || null,
        tasks: editTasks,
        notes: editNotes || null,
      })
      await onPlansChange()
      cancelEdit()
      toast.success('计划已保存')
    } catch (e) {
      toast.error('保存失败：' + (e as Error).message)
    }
    setSaving(false)
  }

  const handleDelete = async (planId: string) => {
    try {
      await deleteLessonPlan(planId)
      await onPlansChange()
      if (editingId === planId) cancelEdit()
      toast.success('计划已删除')
    } catch (e) {
      toast.error('删除失败')
    }
  }

  const handleAddTask = () => {
    setEditTasks([...editTasks, createEmptyTask()])
  }

  const handleUpdateTask = (index: number, updated: TaskBlockType) => {
    const next = [...editTasks]
    next[index] = updated
    setEditTasks(next)
  }

  const handleDeleteTask = (index: number) => {
    setEditTasks(editTasks.filter((_, i) => i !== index))
  }

  // 空状态
  if (plans.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-12">
        <FileText className={cn("mx-auto mb-3 opacity-50", compact ? "w-10 h-10" : "w-12 h-12")} />
        <p>暂无课程计划</p>
        <p className="text-xs mt-1">
          {compact ? '点击上方「新建计划」开始' : '点击「AI 生成计划」创建新计划'}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {plans.map((plan) => {
        const isEditing = editingId === plan.id

        // 编辑模式
        if (isEditing) {
          return (
            <Card key={plan.id} className="border-blue-300 bg-blue-50/30">
              <CardContent className={cn("space-y-3", compact ? "p-4 space-y-3" : "p-4 space-y-4")}>
                {/* 顶部操作栏：日期 + 保存/取消/删除 */}
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <Input
                      type="date"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      className={cn("h-8", !compact && "max-w-[200px]")}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" onClick={handleSave} disabled={saving}>
                      {saving ? (
                        <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                      ) : compact ? (
                        <Check className="w-3.5 h-3.5 mr-1" />
                      ) : null}
                      保存
                    </Button>
                    <Button size="sm" variant="outline" onClick={cancelEdit}>取消</Button>
                    {showDeleteInEdit && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => handleDelete(plan.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* 任务列表 */}
                <div>
                  <label className="text-xs text-muted-foreground mb-2 block">任务列表</label>
                  <SortableTaskList
                    tasks={editTasks}
                    compact={compact}
                    wordbanks={wordbanks}
                    onTasksChange={setEditTasks}
                    onUpdateTask={handleUpdateTask}
                    onDeleteTask={handleDeleteTask}
                  />
                  {/* 添加任务按钮在列表下方 */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleAddTask}
                    disabled={compact && editTasks.length >= 4}
                    className="w-full mt-2 border border-dashed text-muted-foreground hover:text-foreground"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" /> 添加任务
                  </Button>
                </div>

                {/* 备注 */}
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">助教提示</label>
                  <Input
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="可选备注"
                    className="h-8"
                  />
                </div>
              </CardContent>
            </Card>
          )
        }

        // 只读卡片
        return (
          <Card
            key={plan.id}
            className={cn(
              "cursor-pointer hover:border-blue-200 transition-colors",
              compact && "hover:border-blue-300"
            )}
            onClick={() => startEdit(plan)}
          >
            <CardContent className={cn(compact ? "p-4 space-y-3" : "p-4")}>
              <div className={cn(!compact && "flex items-start justify-between")}>
                <div className={cn("flex-1", !compact && "space-y-3")}>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 text-sm">
                      <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="font-medium">{plan.plan_date || '未设定日期'}</span>
                    </div>
                    {plan.generated_by_ai && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600">AI 生成</span>
                    )}
                    <span className="text-xs text-muted-foreground ml-auto">点击编辑</span>
                  </div>

                  <div className={cn("flex flex-wrap", compact ? "gap-1.5 mt-3" : "gap-2 mt-3")}>
                    {plan.tasks.map((task, i) => (
                      <TaskBlock key={i} task={task} index={i} />
                    ))}
                  </div>

                  {plan.notes && (
                    <div className="bg-yellow-500/5 border border-yellow-200 rounded p-2 mt-3">
                      <span className="text-xs text-yellow-700">助教提示：</span>
                      <span className="text-sm">{plan.notes}</span>
                    </div>
                  )}

                  {!compact && plan.ai_reason && (
                    <div className="bg-blue-500/5 border border-blue-200 rounded p-2 mt-3">
                      <span className="text-xs text-blue-700">计划说明：</span>
                      <span className="text-sm">{plan.ai_reason}</span>
                    </div>
                  )}
                </div>

                {/* 额外操作按钮（非紧凑模式下，如复制/打印/删除） */}
                {!compact && renderCardActions && (
                  <div className="flex items-center gap-1 ml-4" onClick={(e) => e.stopPropagation()}>
                    {renderCardActions(plan)}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
