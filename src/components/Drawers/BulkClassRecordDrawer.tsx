import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  X, Calendar, Check, CheckCheck, AlertCircle, Loader2, 
  ChevronLeft, ChevronRight, Copy, Users, Clock
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { DateInput } from '@/components/ui/date-input'
import { TaskBlock } from '@/components/TaskBlock/TaskBlock'
import { useAppStore } from '@/store/appStore'
import { scheduledClassDb } from '@/db/schedule'
import { lessonPlanDb } from '@/db'
import { cn } from '@/lib/utils'
import type { 
  TaskBlock as TaskBlockType, 
  AttendanceType, 
  TaskCompletedType, 
  PerformanceType,
  Student,
  Teacher,
  LessonPlan,
  ScheduledClass
} from '@/types'

// 获取周的起始日（周六）和结束日（周日）
function getWeekBounds(date: Date): { start: Date; end: Date } {
  const day = date.getDay()
  const start = new Date(date)
  const end = new Date(date)
  
  // 计算周六（起始日）
  if (day === 0) {
    // 周日，周六是昨天
    start.setDate(date.getDate() - 1)
  } else if (day === 6) {
    // 周六，就是今天
    // start 不变
  } else {
    // 周一到周五，周六在将来
    start.setDate(date.getDate() + (6 - day))
  }
  
  // 结束日是周日
  end.setTime(start.getTime())
  end.setDate(start.getDate() + 1)
  
  return { start, end }
}

// 格式化日期为 YYYY-MM-DD
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

// 格式化日期显示
function formatDateDisplay(dateStr: string): string {
  const date = new Date(dateStr)
  const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return `${date.getMonth() + 1}月${date.getDate()}日 ${days[date.getDay()]}`
}

// 扩展的排课类型，包含关联的学员和助教信息
interface ScheduledClassWithInfo extends ScheduledClass {
  student?: Student
  teacher?: Teacher
}

interface StudentScheduleInfo {
  student: Student
  schedules: ScheduledClassWithInfo[]
  plans: LessonPlan[]
  selected: boolean
  attendance: AttendanceType
  taskCompleted: TaskCompletedType
  performance: PerformanceType
  durationHours: number
  teacherName: string
  tasks: TaskBlockType[]
  hasPlan: boolean
}

type Step = 'selectWeek' | 'selectStudents' | 'editRecords' | 'result'

export function BulkClassRecordDrawer() {
  const { students, wordbanks, batchImportClassRecords, loadStudents } = useAppStore()
  
  // 当前步骤
  const [step, setStep] = useState<Step>('selectWeek')
  
  // 周选择
  const [currentDate, setCurrentDate] = useState(new Date())
  const [weekStart, setWeekStart] = useState('')
  const [weekEnd, setWeekEnd] = useState('')
  
  // 学员排课信息
  const [studentSchedules, setStudentSchedules] = useState<StudentScheduleInfo[]>([])
  const [loading, setLoading] = useState(false)
  
  // 保存状态
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<{ success: number; failed: number; errors: string[] } | null>(null)
  
  // 抽屉开关状态
  const [open, setOpen] = useState(false)
  
  // 初始化周日期
  useEffect(() => {
    const { start, end } = getWeekBounds(currentDate)
    setWeekStart(formatDate(start))
    setWeekEnd(formatDate(end))
  }, [currentDate])
  
  // 切换到上一周
  const handlePrevWeek = () => {
    const newDate = new Date(currentDate)
    newDate.setDate(currentDate.getDate() - 7)
    setCurrentDate(newDate)
  }
  
  // 切换到下一周
  const handleNextWeek = () => {
    const newDate = new Date(currentDate)
    newDate.setDate(currentDate.getDate() + 7)
    setCurrentDate(newDate)
  }
  
  // 加载该周的排课数据
  const loadWeekSchedules = async () => {
    setLoading(true)
    try {
      // 获取该周的所有排课
      const schedules = await scheduledClassDb.getByWeek(weekStart, weekEnd)
      
      // 按学员分组
      const studentMap = new Map<string, StudentScheduleInfo>()
      
      for (const schedule of schedules) {
        if (!schedule.student) continue
        
        const studentId = schedule.student_id
        const scheduleWithInfo = schedule as ScheduledClassWithInfo
        
        if (!studentMap.has(studentId)) {
          // 获取该学员的课程计划
          const plans = await lessonPlanDb.getByStudentId(studentId)
          const relevantPlans = plans.filter(p => 
            p.plan_date && p.plan_date >= weekStart && p.plan_date <= weekEnd
          )
          
          studentMap.set(studentId, {
            student: schedule.student,
            schedules: [scheduleWithInfo],
            plans: relevantPlans,
            selected: false,
            attendance: 'present',
            taskCompleted: 'completed',
            performance: 'good',
            durationHours: schedule.duration_hours || 1,
            teacherName: scheduleWithInfo.teacher?.name || '',
            tasks: relevantPlans.length > 0 ? [...relevantPlans[0].tasks] : [],
            hasPlan: relevantPlans.length > 0
          })
        } else {
          const info = studentMap.get(studentId)!
          info.schedules.push(scheduleWithInfo)
        }
      }
      
      setStudentSchedules(Array.from(studentMap.values()))
      setStep('selectStudents')
    } catch (error) {
      console.error('Failed to load week schedules:', error)
      alert('加载排课数据失败')
    }
    setLoading(false)
  }
  
  // 切换学员选择
  const handleToggleStudent = (index: number) => {
    setStudentSchedules(prev => prev.map((item, i) => 
      i === index ? { ...item, selected: !item.selected } : item
    ))
  }
  
  // 全选/取消全选
  const handleSelectAll = () => {
    const allSelected = studentSchedules.every(s => s.selected)
    setStudentSchedules(prev => prev.map(item => ({ ...item, selected: !allSelected })))
  }
  
  // 从计划复制任务
  const handleCopyTasksFromPlan = (index: number) => {
    const info = studentSchedules[index]
    if (info.plans.length > 0) {
      setStudentSchedules(prev => prev.map((item, i) => 
        i === index ? { ...item, tasks: [...item.plans[0].tasks], hasPlan: true } : item
      ))
    }
  }
  
  // 更新学员任务
  const handleUpdateTasks = (index: number, tasks: TaskBlockType[]) => {
    setStudentSchedules(prev => prev.map((item, i) => 
      i === index ? { ...item, tasks } : item
    ))
  }
  
  // 更新学员属性
  const handleUpdateStudentInfo = (index: number, updates: Partial<StudentScheduleInfo>) => {
    setStudentSchedules(prev => prev.map((item, i) => 
      i === index ? { ...item, ...updates } : item
    ))
  }
  
  // 一键标记全部完成
  const handleMarkAllCompleted = () => {
    setStudentSchedules(prev => prev.map(item => 
      item.selected ? { ...item, taskCompleted: 'completed', attendance: 'present' } : item
    ))
  }
  
  // 批量创建课堂记录
  const handleCreateRecords = async () => {
    const selectedStudents = studentSchedules.filter(s => s.selected && s.tasks.length > 0)
    
    if (selectedStudents.length === 0) {
      alert('请至少选择一个学员并添加任务')
      return
    }
    
    setSaving(true)
    try {
      const records = selectedStudents.map(info => ({
        student_id: info.student.id,
        class_date: info.schedules[0]?.class_date || weekStart,
        duration_hours: info.durationHours,
        teacher_name: info.teacherName || undefined,
        attendance: info.attendance,
        tasks: info.tasks,
        task_completed: info.taskCompleted,
        performance: info.performance,
        plan_id: info.plans[0]?.id
      }))
      
      const successCount = await batchImportClassRecords(records)
      
      setResult({
        success: successCount,
        failed: selectedStudents.length - successCount,
        errors: []
      })
      
      setStep('result')
      await loadStudents()
    } catch (error) {
      setResult({
        success: 0,
        failed: selectedStudents.length,
        errors: [error instanceof Error ? error.message : '保存失败']
      })
      setStep('result')
    }
    setSaving(false)
  }
  
  // 重置状态
  const handleReset = () => {
    setStep('selectWeek')
    setStudentSchedules([])
    setResult(null)
  }
  
  // 关闭抽屉
  const handleClose = () => {
    handleReset()
    setOpen(false)
  }
  
  // 选中的学员数量
  const selectedCount = useMemo(() => 
    studentSchedules.filter(s => s.selected).length, 
    [studentSchedules]
  )
  
  return (
    <>
      {/* 触发按钮 */}
      <Button 
        variant="outline" 
        className="flex items-center gap-2"
        onClick={() => setOpen(true)}
      >
        <Calendar className="w-4 h-4" />
        按周批量录入
      </Button>
      
      {/* 抽屉 */}
      <AnimatePresence>
        {open && (
          <>
            {/* 背景遮罩 */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-40"
              onClick={handleClose}
            />
            
            {/* 抽屉面板 */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 h-full w-[700px] bg-background border-l shadow-xl z-50 flex flex-col"
            >
              {/* 头部 */}
              <div className="h-16 border-b flex items-center justify-between px-6">
                <h2 className="text-lg font-semibold">按周批量录入课堂记录</h2>
                <Button variant="ghost" size="icon" onClick={handleClose}>
                  <X className="w-5 h-5" />
                </Button>
              </div>
              
              {/* 步骤指示器 */}
              <div className="px-6 py-4 border-b">
                <div className="flex items-center gap-2">
                  {['选择周次', '选择学员', '编辑记录', '完成'].map((label, i) => (
                    <div key={i} className="flex items-center">
                      <div className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium",
                        (step === 'selectWeek' && i === 0) ||
                        (step === 'selectStudents' && i <= 1) ||
                        (step === 'editRecords' && i <= 2) ||
                        (step === 'result' && i <= 3)
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      )}>
                        {i + 1}
                      </div>
                      <span className={cn(
                        "ml-2 text-sm",
                        (step === 'selectWeek' && i === 0) ||
                        (step === 'selectStudents' && i === 1) ||
                        (step === 'editRecords' && i === 2) ||
                        (step === 'result' && i === 3)
                          ? "text-foreground"
                          : "text-muted-foreground"
                      )}>
                        {label}
                      </span>
                      {i < 3 && (
                        <div className={cn(
                          "w-8 h-0.5 mx-2",
                          (step === 'selectStudents' && i === 0) ||
                          (step === 'editRecords' && i <= 1) ||
                          (step === 'result')
                            ? "bg-primary"
                            : "bg-muted"
                        )} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
              
              {/* 内容区域 */}
              <div className="flex-1 overflow-auto p-6">
                {/* 步骤1: 选择周次 */}
                {step === 'selectWeek' && (
                  <div className="space-y-6">
                    <Card>
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-6">
                          <Button variant="outline" size="icon" onClick={handlePrevWeek}>
                            <ChevronLeft className="w-4 h-4" />
                          </Button>
                          <div className="text-center">
                            <div className="text-lg font-semibold">
                              {formatDateDisplay(weekStart)} - {formatDateDisplay(weekEnd)}
                            </div>
                            <div className="text-sm text-muted-foreground mt-1">
                              选择要录入课堂记录的周次
                            </div>
                          </div>
                          <Button variant="outline" size="icon" onClick={handleNextWeek}>
                            <ChevronRight className="w-4 h-4" />
                          </Button>
                        </div>
                        
                        <div className="bg-blue-50/50 border border-blue-200 rounded-lg p-4">
                          <div className="flex items-start gap-3">
                            <Calendar className="w-5 h-5 text-blue-600 mt-0.5" />
                            <div>
                              <p className="font-medium text-blue-700">周次选择说明</p>
                              <p className="text-sm text-blue-600 mt-1">
                                系统将自动加载该周（周六至周日）内有排课的学员列表。
                                您可以为这些学员批量创建课堂记录。
                              </p>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    
                    <div className="flex justify-end">
                      <Button onClick={loadWeekSchedules} disabled={loading}>
                        {loading ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            加载中...
                          </>
                        ) : (
                          <>
                            加载排课数据
                            <ChevronRight className="w-4 h-4 ml-2" />
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
                
                {/* 步骤2: 选择学员 */}
                {step === 'selectStudents' && (
                  <div className="space-y-6">
                    {/* 统计信息 */}
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-muted rounded-lg p-3 text-center">
                        <div className="text-2xl font-semibold">{studentSchedules.length}</div>
                        <div className="text-xs text-muted-foreground">本周有排课学员</div>
                      </div>
                      <div className="bg-green-500/10 rounded-lg p-3 text-center">
                        <div className="text-2xl font-semibold text-green-600">{selectedCount}</div>
                        <div className="text-xs text-muted-foreground">已选择</div>
                      </div>
                      <div className="bg-blue-500/10 rounded-lg p-3 text-center">
                        <div className="text-2xl font-semibold text-blue-600">
                          {studentSchedules.filter(s => s.hasPlan).length}
                        </div>
                        <div className="text-xs text-muted-foreground">有课程计划</div>
                      </div>
                    </div>
                    
                    {/* 操作栏 */}
                    <div className="flex items-center justify-between">
                      <Button variant="outline" size="sm" onClick={handleSelectAll}>
                        {selectedCount === studentSchedules.length ? '取消全选' : '全选'}
                      </Button>
                      <div className="text-sm text-muted-foreground">
                        点击学员卡片选择/取消选择
                      </div>
                    </div>
                    
                    {/* 学员列表 */}
                    <div className="space-y-3">
                      {studentSchedules.length === 0 ? (
                        <Card className="border-dashed">
                          <CardContent className="p-8 text-center">
                            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                            <p className="text-muted-foreground">该周没有排课记录</p>
                            <p className="text-sm text-muted-foreground mt-1">
                              请选择其他周次或先在排课页面添加排课
                            </p>
                          </CardContent>
                        </Card>
                      ) : (
                        studentSchedules.map((info, index) => (
                          <Card 
                            key={info.student.id}
                            className={cn(
                              "cursor-pointer transition-all",
                              info.selected && "border-primary bg-primary/5"
                            )}
                            onClick={() => handleToggleStudent(index)}
                          >
                            <CardContent className="p-4">
                              <div className="flex items-center gap-4">
                                {/* 选择状态 */}
                                <div className={cn(
                                  "w-5 h-5 rounded border-2 flex items-center justify-center",
                                  info.selected 
                                    ? "bg-primary border-primary text-primary-foreground"
                                    : "border-muted-foreground"
                                )}>
                                  {info.selected && <Check className="w-3 h-3" />}
                                </div>
                                
                                {/* 学员信息 */}
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">{info.student.name}</span>
                                    <span className="text-sm text-muted-foreground">
                                      {info.student.grade}
                                    </span>
                                    {info.hasPlan && (
                                      <span className="text-xs bg-blue-500/10 text-blue-600 px-2 py-0.5 rounded">
                                        有计划
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                      <Clock className="w-3 h-3" />
                                      {info.schedules.length} 节课
                                    </span>
                                    {info.teacherName && (
                                      <span>助教: {info.teacherName}</span>
                                    )}
                                  </div>
                                </div>
                                
                                {/* 计划任务预览 */}
                                {info.hasPlan && info.plans[0]?.tasks && (
                                  <div className="flex flex-wrap gap-1">
                                    {info.plans[0].tasks.slice(0, 2).map((task, i) => (
                                      <span 
                                        key={i}
                                        className="text-xs bg-muted px-2 py-0.5 rounded"
                                      >
                                        {task.wordbank_label || task.content || task.type}
                                      </span>
                                    ))}
                                    {info.plans[0].tasks.length > 2 && (
                                      <span className="text-xs text-muted-foreground">
                                        +{info.plans[0].tasks.length - 2}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        ))
                      )}
                    </div>
                  </div>
                )}
                
                {/* 步骤3: 编辑记录 */}
                {step === 'editRecords' && (
                  <div className="space-y-6">
                    {/* 快捷操作 */}
                    <div className="flex items-center justify-between">
                      <Button variant="outline" size="sm" onClick={handleMarkAllCompleted}>
                        <CheckCheck className="w-4 h-4 mr-1" />
                        一键全部完成
                      </Button>
                      <div className="text-sm text-muted-foreground">
                        已选择 {selectedCount} 名学员
                      </div>
                    </div>
                    
                    {/* 学员记录编辑列表 */}
                    <div className="space-y-4">
                      {studentSchedules.filter(s => s.selected).map((info, index) => {
                        const originalIndex = studentSchedules.findIndex(s => s.student.id === info.student.id)
                        return (
                          <Card key={info.student.id}>
                            <CardContent className="p-4 space-y-4">
                              {/* 学员标题 */}
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{info.student.name}</span>
                                  <span className="text-sm text-muted-foreground">{info.student.grade}</span>
                                </div>
                                {info.hasPlan && (
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={() => handleCopyTasksFromPlan(originalIndex)}
                                  >
                                    <Copy className="w-4 h-4 mr-1" />
                                    从计划复制
                                  </Button>
                                )}
                              </div>
                              
                              {/* 日期和时长 */}
                              <div className="grid grid-cols-3 gap-4">
                                <div>
                                  <label className="text-xs text-muted-foreground mb-1 block">上课日期</label>
                                  <Select
                                    value={info.schedules[0]?.class_date || ''}
                                    options={info.schedules.map(s => ({
                                      value: s.class_date,
                                      label: formatDateDisplay(s.class_date)
                                    }))}
                                    onChange={(e) => {
                                      const newSchedule = info.schedules.find(s => s.class_date === e.target.value)
                                      if (newSchedule) {
                                        handleUpdateStudentInfo(originalIndex, {
                                          schedules: [newSchedule],
                                          teacherName: (newSchedule as ScheduledClassWithInfo).teacher?.name || info.teacherName
                                        })
                                      }
                                    }}
                                  />
                                </div>
                                <div>
                                  <label className="text-xs text-muted-foreground mb-1 block">课时时长</label>
                                  <Select
                                    value={info.durationHours.toString()}
                                    options={[
                                      { value: '0.5', label: '0.5小时' },
                                      { value: '1', label: '1小时' },
                                      { value: '1.5', label: '1.5小时' },
                                      { value: '2', label: '2小时' }
                                    ]}
                                    onChange={(e) => handleUpdateStudentInfo(originalIndex, {
                                      durationHours: parseFloat(e.target.value)
                                    })}
                                  />
                                </div>
                                <div>
                                  <label className="text-xs text-muted-foreground mb-1 block">出勤状态</label>
                                  <Select
                                    value={info.attendance}
                                    options={[
                                      { value: 'present', label: '到课' },
                                      { value: 'late', label: '迟到' },
                                      { value: 'absent', label: '缺课' }
                                    ]}
                                    onChange={(e) => handleUpdateStudentInfo(originalIndex, {
                                      attendance: e.target.value as AttendanceType
                                    })}
                                  />
                                </div>
                              </div>
                              
                              {/* 任务列表 */}
                              <div>
                                <div className="flex items-center justify-between mb-2">
                                  <label className="text-xs text-muted-foreground">学习任务</label>
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={() => {
                                      const newTask: TaskBlockType = { type: 'other', content: '' }
                                      handleUpdateTasks(originalIndex, [...info.tasks, newTask])
                                    }}
                                    disabled={info.tasks.length >= 4}
                                  >
                                    添加任务
                                  </Button>
                                </div>
                                <div className="space-y-2">
                                  {info.tasks.length === 0 ? (
                                    <div className="text-sm text-muted-foreground text-center py-4 border rounded-lg border-dashed">
                                      暂无任务，点击"从计划复制"或"添加任务"
                                    </div>
                                  ) : (
                                    info.tasks.map((task, taskIndex) => (
                                      <TaskBlock
                                        key={taskIndex}
                                        task={task}
                                        index={taskIndex}
                                        editable
                                        wordbanks={wordbanks}
                                        onChange={(updated) => {
                                          const newTasks = [...info.tasks]
                                          newTasks[taskIndex] = updated
                                          handleUpdateTasks(originalIndex, newTasks)
                                        }}
                                        onDelete={info.tasks.length > 1 ? () => {
                                          handleUpdateTasks(originalIndex, info.tasks.filter((_, i) => i !== taskIndex))
                                        } : undefined}
                                      />
                                    ))
                                  )}
                                </div>
                              </div>
                              
                              {/* 完成状态和表现 */}
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="text-xs text-muted-foreground mb-1 block">完成状态</label>
                                  <Select
                                    value={info.taskCompleted}
                                    options={[
                                      { value: 'completed', label: '全部完成' },
                                      { value: 'partial', label: '部分完成' },
                                      { value: 'not_completed', label: '未完成' }
                                    ]}
                                    onChange={(e) => handleUpdateStudentInfo(originalIndex, {
                                      taskCompleted: e.target.value as TaskCompletedType
                                    })}
                                  />
                                </div>
                                <div>
                                  <label className="text-xs text-muted-foreground mb-1 block">课堂表现</label>
                                  <Select
                                    value={info.performance}
                                    options={[
                                      { value: 'excellent', label: '优秀' },
                                      { value: 'good', label: '良好' },
                                      { value: 'needs_improvement', label: '待提高' }
                                    ]}
                                    onChange={(e) => handleUpdateStudentInfo(originalIndex, {
                                      performance: e.target.value as PerformanceType
                                    })}
                                  />
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        )
                      })}
                    </div>
                  </div>
                )}
                
                {/* 步骤4: 完成 */}
                {step === 'result' && (
                  <div className="space-y-6">
                    <Card>
                      <CardContent className="p-6">
                        <div className="text-center space-y-4">
                          {result && result.success > 0 ? (
                            <>
                              <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
                                <Check className="w-8 h-8 text-green-600" />
                              </div>
                              <div>
                                <h3 className="text-xl font-semibold">批量录入完成</h3>
                                <p className="text-muted-foreground mt-1">
                                  成功创建 <span className="text-green-600 font-medium">{result.success}</span> 条课堂记录
                                </p>
                                {result.failed > 0 && (
                                  <p className="text-sm text-red-500 mt-1">
                                    {result.failed} 条记录创建失败
                                  </p>
                                )}
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto">
                                <AlertCircle className="w-8 h-8 text-red-600" />
                              </div>
                              <div>
                                <h3 className="text-xl font-semibold">录入失败</h3>
                                <p className="text-muted-foreground mt-1">
                                  {result?.errors.join(', ') || '没有可创建的记录'}
                                </p>
                              </div>
                            </>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                    
                    <div className="flex gap-3">
                      <Button variant="outline" onClick={handleReset} className="flex-1">
                        继续录入
                      </Button>
                      <Button onClick={handleClose} className="flex-1">
                        完成
                      </Button>
                    </div>
                  </div>
                )}
              </div>
              
              {/* 底部操作栏 */}
              {step === 'selectStudents' && studentSchedules.length > 0 && (
                <div className="h-16 border-t flex items-center justify-between px-6">
                  <Button variant="outline" onClick={() => setStep('selectWeek')}>
                    返回
                  </Button>
                  <Button 
                    onClick={() => setStep('editRecords')}
                    disabled={selectedCount === 0}
                  >
                    下一步：编辑记录 ({selectedCount}人)
                  </Button>
                </div>
              )}
              
              {step === 'editRecords' && (
                <div className="h-16 border-t flex items-center justify-between px-6">
                  <Button variant="outline" onClick={() => setStep('selectStudents')}>
                    返回
                  </Button>
                  <Button 
                    onClick={handleCreateRecords}
                    disabled={saving || selectedCount === 0}
                  >
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        保存中...
                      </>
                    ) : (
                      `创建 ${selectedCount} 条记录`
                    )}
                  </Button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}