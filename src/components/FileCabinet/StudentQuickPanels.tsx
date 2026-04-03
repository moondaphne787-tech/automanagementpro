import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import {
  PenLine, ClipboardList, BarChart3, Calendar, Clock,
  FileText, Loader2, Save, TrendingUp, TrendingDown
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { DateInput } from '@/components/ui/date-input'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription
} from '@/components/ui/sheet'
import { Card, CardContent } from '@/components/ui/card'
import { TaskBlock, createEmptyTask } from '@/components/TaskBlock/TaskBlock'
import { useAppStore } from '@/store/appStore'
import { lessonPlanDb, classRecordDb, progressDb } from '@/db'
import { teacherDb } from '@/db/teachers'
import { cn } from '@/lib/utils'
import { LEVEL_LABELS } from '@/types'
import type {
  Student, LessonPlan, TaskBlock as TaskBlockType,
  AttendanceType, TaskCompletedType, PerformanceType,
  Teacher, Wordbank, ClassRecord, StudentWordbankProgress
} from '@/types'

// ==================== 快速录入面板 ====================

interface QuickRecordPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  studentId: string | null
}

export function QuickRecordPanel({ open, onOpenChange, studentId }: QuickRecordPanelProps) {
  const students = useAppStore(s => s.students)
  const wordbanks = useAppStore(s => s.wordbanks)
  const createClassRecord = useAppStore(s => s.createClassRecord)
  const loadStudents = useAppStore(s => s.loadStudents)

  const student = students.find(s => s.id === studentId)

  const [classDate, setClassDate] = useState(new Date().toISOString().split('T')[0])
  const [durationHours, setDurationHours] = useState(1)
  const [teacherName, setTeacherName] = useState('')
  const [attendance, setAttendance] = useState<AttendanceType>('present')
  const [tasks, setTasks] = useState<TaskBlockType[]>([createEmptyTask()])
  const [taskCompleted, setTaskCompleted] = useState<TaskCompletedType>('completed')
  const [performance, setPerformance] = useState<PerformanceType>('good')
  const [saving, setSaving] = useState(false)
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [todayPlan, setTodayPlan] = useState<LessonPlan | null>(null)

  useEffect(() => {
    if (open && studentId) {
      // 重置表单
      const today = new Date().toISOString().split('T')[0]
      setClassDate(today)
      setDurationHours(1)
      setTeacherName('')
      setAttendance('present')
      setTasks([createEmptyTask()])
      setTaskCompleted('completed')
      setPerformance('good')
      setSaving(false)

      // 加载助教列表
      teacherDb.getActive().then(setTeachers)

      // 加载今日计划，自动预填
      lessonPlanDb.getByStudentId(studentId).then(plans => {
        const plan = plans.find(p => p.plan_date === today)
        setTodayPlan(plan || null)
        if (plan && plan.tasks.length > 0) {
          setTasks([...plan.tasks])
        }
      })
    }
  }, [open, studentId])

  const handleSave = async () => {
    if (!studentId) return
    const validTasks = tasks.filter(t => {
      if (['vocab_new', 'vocab_review'].includes(t.type)) return t.wordbank_label && t.level_from && t.level_to
      if (t.type === 'nine_grid') return !!t.wordbank_label
      return !!t.content
    })
    if (validTasks.length === 0) {
      toast.error('请至少添加一个有效的任务')
      return
    }
    setSaving(true)
    try {
      await createClassRecord({
        student_id: studentId,
        class_date: classDate,
        duration_hours: durationHours,
        teacher_name: teacherName || undefined,
        attendance,
        tasks: validTasks,
        task_completed: taskCompleted,
        performance,
      })
      await loadStudents()
      toast.success('课堂记录已创建')
      onOpenChange(false)
    } catch (e) {
      toast.error('保存失败：' + (e as Error).message)
    }
    setSaving(false)
  }

  if (!student) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[480px] sm:max-w-[480px] overflow-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <PenLine className="w-4 h-4 text-primary" />
            快速录入 — {student.name}
          </SheetTitle>
          <SheetDescription>精简版课堂记录，快速完成录入</SheetDescription>
        </SheetHeader>

        <div className="space-y-4 mt-6">
          {/* 日期 + 课时 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">上课日期</label>
              <DateInput value={classDate} onChange={setClassDate} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">课时</label>
              <Select
                value={durationHours.toString()}
                options={[
                  { value: '0.5', label: '0.5h' },
                  { value: '1', label: '1h' },
                  { value: '1.5', label: '1.5h' },
                  { value: '2', label: '2h' },
                ]}
                onChange={e => setDurationHours(parseFloat(e.target.value))}
              />
            </div>
          </div>

          {/* 助教 + 出勤 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">助教</label>
              <Select
                value={teacherName}
                options={[
                  { value: '', label: '请选择' },
                  ...teachers.map(t => ({ value: t.name, label: t.name }))
                ]}
                onChange={e => setTeacherName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">出勤</label>
              <Select
                value={attendance}
                options={[
                  { value: 'present', label: '到课' },
                  { value: 'late', label: '迟到' },
                  { value: 'absent', label: '缺课' },
                ]}
                onChange={e => setAttendance(e.target.value as AttendanceType)}
              />
            </div>
          </div>

          {/* 今日计划提示 */}
          {todayPlan && (
            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <div className="text-xs text-blue-600 dark:text-blue-400 mb-1">已自动从今日计划预填任务</div>
              <div className="flex flex-wrap gap-1">
                {todayPlan.tasks.map((t, i) => (
                  <span key={i} className="text-xs bg-blue-100 dark:bg-blue-900/50 px-1.5 py-0.5 rounded">
                    {t.wordbank_label || t.content || t.type}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 任务列表 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-muted-foreground">学习任务</label>
              <Button
                variant="ghost" size="sm"
                onClick={() => setTasks([...tasks, createEmptyTask()])}
                disabled={tasks.length >= 4}
              >
                添加任务
              </Button>
            </div>
            <div className="space-y-2">
              {tasks.map((task, i) => (
                <TaskBlock
                  key={i} task={task} index={i} editable
                  wordbanks={wordbanks}
                  onChange={updated => {
                    const next = [...tasks]; next[i] = updated; setTasks(next)
                  }}
                  onDelete={tasks.length > 1 ? () => setTasks(tasks.filter((_, idx) => idx !== i)) : undefined}
                />
              ))}
            </div>
          </div>

          {/* 完成 + 表现 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">完成情况</label>
              <Select
                value={taskCompleted}
                options={[
                  { value: 'completed', label: '全部完成' },
                  { value: 'partial', label: '部分完成' },
                  { value: 'not_completed', label: '未完成' },
                ]}
                onChange={e => setTaskCompleted(e.target.value as TaskCompletedType)}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">课堂表现</label>
              <Select
                value={performance}
                options={[
                  { value: 'excellent', label: '优秀' },
                  { value: 'good', label: '良好' },
                  { value: 'needs_improvement', label: '待提高' },
                ]}
                onChange={e => setPerformance(e.target.value as PerformanceType)}
              />
            </div>
          </div>

          {/* 保存 */}
          <Button className="w-full" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            {saving ? '保存中...' : '保存记录'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ==================== 查看计划面板 ====================

interface ViewPlansPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  studentId: string | null
}

export function ViewPlansPanel({ open, onOpenChange, studentId }: ViewPlansPanelProps) {
  const students = useAppStore(s => s.students)
  const student = students.find(s => s.id === studentId)

  const [plans, setPlans] = useState<LessonPlan[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open && studentId) {
      setLoading(true)
      lessonPlanDb.getByStudentId(studentId).then(p => {
        setPlans(p)
        setLoading(false)
      })
    }
  }, [open, studentId])

  if (!student) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[480px] sm:max-w-[480px] overflow-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-blue-600" />
            课程计划 — {student.name}
          </SheetTitle>
          <SheetDescription>查看该学员的课程计划</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : plans.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p>暂无课程计划</p>
            </div>
          ) : (
            plans.map(plan => (
              <Card key={plan.id}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 text-sm">
                      <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="font-medium">{plan.plan_date || '未设定日期'}</span>
                    </div>
                    {plan.generated_by_ai && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600">AI 生成</span>
                    )}
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

                  {plan.ai_reason && (
                    <div className="bg-blue-500/5 border border-blue-200 rounded p-2 text-sm">
                      <span className="text-xs text-blue-700">计划说明：</span> {plan.ai_reason}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
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

  // 最近 5 条记录
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
