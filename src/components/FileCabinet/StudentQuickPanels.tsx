import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import {
  FilePenLine, BarChart3, Calendar,
  Loader2, Plus
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription
} from '@/components/ui/sheet'
import { Card, CardContent } from '@/components/ui/card'
import { createEmptyTask } from '@/components/TaskBlock/TaskBlock'
import { PlanEditor } from '@/components/PlanEditor/PlanEditor'
import { useAppStore } from '@/store/appStore'
import { classRecordDb, progressDb } from '@/db'
import { cn } from '@/lib/utils'
import { LEVEL_LABELS } from '@/types'
import type {
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
  const lessonPlans = useAppStore(s => s.lessonPlans)
  const loadLessonPlans = useAppStore(s => s.loadLessonPlans)
  const createLessonPlan = useAppStore(s => s.createLessonPlan)
  const student = students.find(s => s.id === studentId)

  const [loading, setLoading] = useState(false)

  const refreshPlans = async () => {
    if (!studentId) return
    await loadLessonPlans(studentId)
  }

  useEffect(() => {
    if (open && studentId) {
      setLoading(true)
      loadLessonPlans(studentId).then(() => {
        setLoading(false)
      })
    }
  }, [open, studentId])

  const handleAddPlan = async () => {
    if (!studentId) return
    try {
      await createLessonPlan({
        student_id: studentId,
        plan_date: new Date().toISOString().split('T')[0],
        tasks: [createEmptyTask()],
        generated_by_ai: false
      })
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

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <PlanEditor
            studentId={studentId!}
            plans={lessonPlans}
            onPlansChange={refreshPlans}
            compact
            wordbanks={wordbanks}
            showDeleteInEdit
          />
        )}
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
