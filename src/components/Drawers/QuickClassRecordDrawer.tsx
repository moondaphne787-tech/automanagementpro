import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Check, CheckCheck, Loader2, Users, Zap, Calendar } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useAppStore } from '@/store/appStore'
import { scheduledClassDb } from '@/db/schedule'
import { lessonPlanDb } from '@/db'
import { formatDateISO, formatDateDisplay } from '@/lib/utils'
import type { TaskBlock as TaskBlockType } from '@/types'
import { StatisticsBar } from './QuickRecord/StatisticsBar'
import { StudentRecordCard, StudentScheduleInfo } from './QuickRecord/StudentRecordCard'
import { ResultDisplay } from './QuickRecord/ResultDisplay'

interface QuickClassRecordDrawerProps {
  open: boolean
  onClose: () => void
  fullPage?: boolean
}

export function QuickClassRecordDrawer({ open, onClose, fullPage }: QuickClassRecordDrawerProps) {
  const wordbanks = useAppStore(s => s.wordbanks)
  const batchImportClassRecords = useAppStore(s => s.batchImportClassRecords)
  const loadStudents = useAppStore(s => s.loadStudents)

  const today = useMemo(() => formatDateISO(new Date()), [])
  const todayDisplay = useMemo(() => formatDateDisplay(today), [today])

  const [studentSchedules, setStudentSchedules] = useState<StudentScheduleInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<{ success: number; failed: number; errors: string[] } | null>(null)
  const [showResult, setShowResult] = useState(false)
  const [expandedStudents, setExpandedStudents] = useState<Set<string>>(new Set())

  const toggleExpanded = (studentId: string) => {
    setExpandedStudents(prev => {
      const next = new Set(prev)
      next.has(studentId) ? next.delete(studentId) : next.add(studentId)
      return next
    })
  }

  const loadTodaySchedules = async () => {
    setLoading(true)
    try {
      const schedules = await scheduledClassDb.getByDate(today)
      const validSchedules = schedules.filter(s => s.status === 'scheduled' || s.status === 'completed')
      const allTodayPlans = await lessonPlanDb.getByDate(today)
      const planByStudentId = new Map(allTodayPlans.map(p => [p.student_id, p]))

      const infos: StudentScheduleInfo[] = validSchedules.map((schedule) => {
        const todayPlan = planByStudentId.get(schedule.student_id)
        return {
          student: schedule.student!,
          schedule,
          plan: todayPlan,
          selected: true,
          attendance: 'present' as const,
          taskCompleted: 'completed' as const,
          performance: 'good' as const,
          durationHours: schedule.duration_hours || 1,
          teacherName: (schedule as any).teacher?.name || '',
          tasks: todayPlan?.tasks.length ? [...todayPlan.tasks] : [],
          hasPlan: !!todayPlan
        }
      })
      setStudentSchedules(infos)
    } catch (error) {
      console.error('Failed to load today schedules:', error)
      toast.error('加载今日排课数据失败')
    }
    setLoading(false)
  }

  useEffect(() => {
    if (open) {
      loadTodaySchedules()
      setResult(null)
      setShowResult(false)
      setExpandedStudents(new Set())
    }
  }, [open])

  const handleToggleStudent = (index: number) => {
    setStudentSchedules(prev => prev.map((item, i) =>
      i === index ? { ...item, selected: !item.selected } : item
    ))
  }

  const handleSelectAll = () => {
    const allSelected = studentSchedules.every(s => s.selected)
    setStudentSchedules(prev => prev.map(item => ({ ...item, selected: !allSelected })))
  }

  const handleCopyTasksFromPlan = (index: number) => {
    const info = studentSchedules[index]
    if (info.plan) {
      setStudentSchedules(prev => prev.map((item, i) =>
        i === index ? { ...item, tasks: [...info.plan!.tasks], hasPlan: true } : item
      ))
    }
  }

  const handleUpdateTasks = (index: number, tasks: TaskBlockType[]) => {
    setStudentSchedules(prev => prev.map((item, i) =>
      i === index ? { ...item, tasks } : item
    ))
  }

  const handleUpdateStudentInfo = (index: number, updates: Partial<StudentScheduleInfo>) => {
    setStudentSchedules(prev => prev.map((item, i) =>
      i === index ? { ...item, ...updates } : item
    ))
  }

  const handleMarkAllCompleted = () => {
    setStudentSchedules(prev => prev.map(item =>
      item.selected ? { ...item, taskCompleted: 'completed', attendance: 'present' } : item
    ))
  }

  const handleCreateRecords = async () => {
    const selectedStudents = studentSchedules.filter(s => s.selected && s.tasks.length > 0)
    if (selectedStudents.length === 0) {
      toast.warning('请至少选择一个学员并添加任务')
      return
    }
    setSaving(true)
    try {
      const records = selectedStudents.map(info => ({
        student_id: info.student.id,
        class_date: today,
        duration_hours: info.durationHours,
        teacher_name: info.teacherName || undefined,
        attendance: info.attendance,
        tasks: info.tasks,
        task_completed: info.taskCompleted,
        performance: info.performance,
        plan_id: info.plan?.id
      }))
      const successCount = await batchImportClassRecords(records)
      setResult({ success: successCount, failed: selectedStudents.length - successCount, errors: [] })
      setShowResult(true)
      await loadStudents()
    } catch (error) {
      setResult({
        success: 0,
        failed: selectedStudents.length,
        errors: [error instanceof Error ? error.message : '保存失败']
      })
      setShowResult(true)
    }
    setSaving(false)
  }

  const selectedCount = useMemo(() =>
    studentSchedules.filter(s => s.selected).length,
    [studentSchedules]
  )

  const planCount = useMemo(() =>
    studentSchedules.filter(s => s.hasPlan).length,
    [studentSchedules]
  )

  // 日期信息栏 + 内容 + 底部栏（fullPage 和 drawer 共用）
  const dateBar = (
    <div className="px-6 py-3 border-b bg-muted/30 shrink-0">
      <div className="flex items-center gap-3">
        <Calendar className="w-5 h-5 text-primary" />
        <div>
          <span className="font-medium">{todayDisplay}</span>
          <span className="text-muted-foreground ml-2">今日有排课的学员</span>
        </div>
      </div>
    </div>
  )

  const contentArea = (
    <div className="flex-1 overflow-auto p-6">
      {loading ? (
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground mt-4">加载排课数据中...</p>
        </div>
      ) : showResult ? (
        <ResultDisplay
          result={result}
          onContinue={() => { setShowResult(false); setResult(null); loadTodaySchedules() }}
          onClose={onClose}
        />
      ) : studentSchedules.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">今日没有排课记录</p>
            <p className="text-sm text-muted-foreground mt-1">请先在排课页面添加今日的排课</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <StatisticsBar totalCount={studentSchedules.length} selectedCount={selectedCount} planCount={planCount} />
          <div className="flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={handleSelectAll}>
              {selectedCount === studentSchedules.length ? '取消全选' : '全选'}
            </Button>
            <Button variant="outline" size="sm" onClick={handleMarkAllCompleted}>
              <CheckCheck className="w-4 h-4 mr-1" />一键全部完成
            </Button>
          </div>
          <div className="space-y-3">
            {studentSchedules.map((info, index) => (
              <StudentRecordCard
                key={info.student.id}
                info={info}
                index={index}
                isExpanded={expandedStudents.has(info.student.id)}
                wordbanks={wordbanks}
                onToggleSelect={handleToggleStudent}
                onToggleExpand={toggleExpanded}
                onCopyFromPlan={handleCopyTasksFromPlan}
                onUpdateTasks={handleUpdateTasks}
                onUpdateInfo={handleUpdateStudentInfo}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )

  const bottomBar = !loading && !showResult && studentSchedules.length > 0 ? (
    <div className="h-16 border-t flex items-center justify-end px-6 shrink-0">
      <Button onClick={handleCreateRecords} disabled={saving || selectedCount === 0}>
        {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />保存中...</> : <><Check className="w-4 h-4 mr-2" />创建 {selectedCount} 条记录</>}
      </Button>
    </div>
  ) : null

  // 全页模式
  if (fullPage) {
    if (!open) return null
    return (
      <div className="flex flex-col h-full">
        {dateBar}
        {contentArea}
        {bottomBar}
      </div>
    )
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
          <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} className="fixed right-0 top-0 h-full w-[600px] bg-background border-l shadow-xl z-50 flex flex-col">
            <div className="h-16 border-b flex items-center justify-between px-6">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold">快速录入今日课堂</h2>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
            </div>
            {dateBar}
            {contentArea}
            {bottomBar}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
