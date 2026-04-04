import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import {
  FilePenLine, BarChart3, Calendar, Clock,
  FileText, Loader2, Save, Plus, Trash2, Check
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription
} from '@/components/ui/sheet'
import { Card, CardContent } from '@/components/ui/card'
import { TaskBlock, createEmptyTask } from '@/components/TaskBlock/TaskBlock'
import { useAppStore } from '@/store/appStore'
import { lessonPlanDb, classRecordDb, progressDb } from '@/db'
import { cn } from '@/lib/utils'
import { LEVEL_LABELS } from '@/types'
import type {
  Student, LessonPlan, TaskBlock as TaskBlockType,
  ClassRecord, StudentWordbankProgress
} from '@/types'

// ==================== 编辑计划面板 ====================

interface EditPlansPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  studentId: string | null
}

export function EditPlansPanel({ open, onOpenChange, studentId }: EditPlansPanelProps) {
  const students = useAppStore(s => s.students)
  const wordbanks = useAppStore(s => s.wordbanks)
  const student = students.find(s => s.id === studentId)

  const [plans, setPlans] = useState<LessonPlan[]>([])
  const [loading, setLoading] = useState(false)
  // 直接编辑状态：哪个 plan 正在编辑
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTasks, setEditTasks] = useState<TaskBlockType[]>([])
  const [editNotes, setEditNotes] = useState('')
  const [editDate, setEditDate] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open && studentId) {
      setLoading(true)
      setEditingId(null)
      lessonPlanDb.getByStudentId(studentId).then(p => {
        setPlans(p)
        setLoading(false)
      })
    }
  }, [open, studentId])

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

  const handleSave = async (planId: string) => {
    setSaving(true)
    try {
      await lessonPlanDb.update(planId, {
        plan_date: editDate || null,
        tasks: editTasks,
        notes: editNotes || null
      })
      const updated = await lessonPlanDb.getByStudentId(studentId!)
      setPlans(updated)
      setEditingId(null)
      toast.success('计划已保存')
    } catch (e) {
      toast.error('保存失败：' + (e as Error).message)
    }
    setSaving(false)
  }

  const handleDelete = async (planId: string) => {
    try {
      await lessonPlanDb.delete(planId)
      const updated = await lessonPlanDb.getByStudentId(studentId!)
      setPlans(updated)
      if (editingId === planId) cancelEdit()
      toast.success('计划已删除')
    } catch (e) {
      toast.error('删除失败')
    }
  }

  const handleAddPlan = async () => {
    if (!studentId) return
    try {
      await lessonPlanDb.create({
        student_id: studentId,
        plan_date: new Date().toISOString().split('T')[0],
        tasks: [createEmptyTask()],
        generated_by_ai: false
      })
      const updated = await lessonPlanDb.getByStudentId(studentId)
      setPlans(updated)
      // 自动进入编辑最新的计划
      if (updated.length > 0) {
        startEdit(updated[0])
      }
    } catch (e) {
      toast.error('创建失败')
    }
  }

  if (!student) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[520px] sm:max-w-[520px] overflow-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <FilePenLine className="w-4 h-4 text-blue-600" />
            编辑计划 — {student.name}
          </SheetTitle>
          <SheetDescription>点击计划卡片直接编辑，修改后自动保存</SheetDescription>
        </SheetHeader>

        <div className="mt-4 mb-3">
          <Button size="sm" variant="outline" onClick={handleAddPlan}>
            <Plus className="w-4 h-4 mr-1" />
            新建计划
          </Button>
        </div>

        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : plans.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p>暂无课程计划</p>
              <p className="text-xs mt-1">点击上方「新建计划」开始</p>
            </div>
          ) : (
            plans.map(plan => {
              const isEditing = editingId === plan.id

              if (isEditing) {
                return (
                  <Card key={plan.id} className="border-blue-300 bg-blue-50/30">
                    <CardContent className="p-4 space-y-3">
                      {/* 日期 */}
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">计划日期</label>
                        <Input
                          type="date"
                          value={editDate}
                          onChange={(e) => setEditDate(e.target.value)}
                          className="h-8"
                        />
                      </div>

                      {/* 任务列表 */}
                      <div className="space-y-2">
                        {editTasks.map((task, i) => (
                          <TaskBlock
                            key={i} task={task} index={i} editable
                            wordbanks={wordbanks}
                            onChange={updated => {
                              const next = [...editTasks]; next[i] = updated; setEditTasks(next)
                            }}
                            onDelete={editTasks.length > 1 ? () => setEditTasks(editTasks.filter((_, idx) => idx !== i)) : undefined}
                          />
                        ))}
                        <Button
                          variant="ghost" size="sm"
                          onClick={() => setEditTasks([...editTasks, createEmptyTask()])}
                          disabled={editTasks.length >= 4}
                        >
                          <Plus className="w-3.5 h-3.5 mr-1" />
                          添加任务
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

                      {/* 操作 */}
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleSave(plan.id)} disabled={saving}>
                          {saving ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Check className="w-3.5 h-3.5 mr-1" />}
                          保存
                        </Button>
                        <Button size="sm" variant="outline" onClick={cancelEdit}>取消</Button>
                        <Button size="sm" variant="ghost" className="text-destructive ml-auto" onClick={() => handleDelete(plan.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              }

              // 只读卡片 — 点击进入编辑
              return (
                <Card
                  key={plan.id}
                  className="cursor-pointer hover:border-blue-300 transition-colors"
                  onClick={() => startEdit(plan)}
                >
                  <CardContent className="p-4 space-y-3">
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

                    <div className="flex flex-wrap gap-1.5">
                      {plan.tasks.map((task, i) => (
                        <TaskBlock key={i} task={task} index={i} />
                      ))}
                    </div>

                    {plan.notes && (
                      <div className="bg-yellow-500/5 border border-yellow-200 rounded p-2 text-sm">
                        <span className="text-xs text-yellow-700">助教提示：</span> {plan.notes}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ==================== 查看进度面板 ====================

interface ViewProgressPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  studentId: string | null
}

export function ViewProgressPanel({ open, onOpenChange, studentId }: ViewProgressPanelProps) {
  const students = useAppStore(s => s.students)
  const student = students.find(s => s.id === studentId)

  const [records, setRecords] = useState<ClassRecord[]>([])
  const [progress, setProgress] = useState<StudentWordbankProgress[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open && studentId) {
      setLoading(true)
      Promise.all([
        classRecordDb.getByStudentId(studentId),
        progressDb.getByStudentId(studentId),
      ]).then(([recs, prog]) => {
        setRecords(recs)
        setProgress(prog)
        setLoading(false)
      })
    }
  }, [open, studentId])

  if (!student) return null

  const totalClasses = records.length
  const totalHours = records.reduce((sum, r) => sum + r.duration_hours, 0)
  const completedCount = records.filter(r => r.task_completed === 'completed').length
  const completionRate = totalClasses > 0 ? Math.round((completedCount / totalClasses) * 100) : 0

  const recentRecords = records.slice(0, 5)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[480px] sm:max-w-[480px] overflow-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-green-600" />
            学习进度 — {student.name}
          </SheetTitle>
          <SheetDescription>
            {student.grade || '-'} · {LEVEL_LABELS[student.level]}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* 概览统计 */}
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <div className="text-xl font-semibold">{totalClasses}</div>
                  <div className="text-xs text-muted-foreground">总课次</div>
                </div>
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <div className="text-xl font-semibold">{totalHours.toFixed(1)}h</div>
                  <div className="text-xs text-muted-foreground">总课时</div>
                </div>
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <div className={cn("text-xl font-semibold", completionRate >= 80 ? "text-green-600" : completionRate >= 50 ? "text-yellow-600" : "text-red-600")}>
                    {completionRate}%
                  </div>
                  <div className="text-xs text-muted-foreground">完成率</div>
                </div>
              </div>

              {/* 词库进度 */}
              {progress.length > 0 && (
                <Card>
                  <CardContent className="p-4">
                    <h4 className="text-sm font-medium mb-3">词库进度</h4>
                    <div className="space-y-2">
                      {progress.map(p => (
                        <div key={p.id} className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{p.wordbank_label}</span>
                          <span className="font-medium">第 {p.current_level} 关</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* 最近课堂记录 */}
              <div>
                <h4 className="text-sm font-medium mb-3">最近课堂记录</h4>
                {recentRecords.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">暂无课堂记录</div>
                ) : (
                  <div className="space-y-2">
                    {recentRecords.map(record => (
                      <div key={record.id} className="flex items-center justify-between p-3 border rounded-lg text-sm">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                          <span>{record.class_date}</span>
                          <span className="text-muted-foreground">{record.duration_hours}h</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "text-xs px-1.5 py-0.5 rounded",
                            record.task_completed === 'completed' && "bg-green-500/10 text-green-600",
                            record.task_completed === 'partial' && "bg-yellow-500/10 text-yellow-600",
                            record.task_completed === 'not_completed' && "bg-red-500/10 text-red-600",
                          )}>
                            {record.task_completed === 'completed' ? '已完成' : record.task_completed === 'partial' ? '部分完成' : '未完成'}
                          </span>
                          <span className={cn(
                            "text-xs px-1.5 py-0.5 rounded",
                            record.performance === 'excellent' && "bg-purple-500/10 text-purple-600",
                            record.performance === 'good' && "bg-blue-500/10 text-blue-600",
                            record.performance === 'needs_improvement' && "bg-orange-500/10 text-orange-600",
                          )}>
                            {record.performance === 'excellent' ? '优秀' : record.performance === 'good' ? '良好' : '待提高'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
