import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  X, Check, CheckCheck, AlertCircle, Loader2, 
  Copy, Users, Clock, Calendar, Zap
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
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
  schedule: ScheduledClassWithInfo
  plan?: LessonPlan
  selected: boolean
  attendance: AttendanceType
  taskCompleted: TaskCompletedType
  performance: PerformanceType
  durationHours: number
  teacherName: string
  tasks: TaskBlockType[]
  hasPlan: boolean
}

interface QuickClassRecordDrawerProps {
  open: boolean
  onClose: () => void
}

export function QuickClassRecordDrawer({ open, onClose }: QuickClassRecordDrawerProps) {
  const { wordbanks, batchImportClassRecords, loadStudents } = useAppStore()
  
  // 今日日期
  const today = useMemo(() => formatDate(new Date()), [])
  const todayDisplay = useMemo(() => formatDateDisplay(today), [today])
  
  // 学员排课信息
  const [studentSchedules, setStudentSchedules] = useState<StudentScheduleInfo[]>([])
  const [loading, setLoading] = useState(false)
  
  // 保存状态
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<{ success: number; failed: number; errors: string[] } | null>(null)
  const [showResult, setShowResult] = useState(false)
  
  // 加载今日排课数据
  const loadTodaySchedules = async () => {
    setLoading(true)
    try {
      // 获取今日的所有排课
      const schedules = await scheduledClassDb.getByDate(today)
      
      // 过滤掉已取消和已调课的排课
      const validSchedules = schedules.filter(s => s.status === 'scheduled' || s.status === 'completed')
      
      // 转换为学员排课信息
      const infos: StudentScheduleInfo[] = await Promise.all(
        validSchedules.map(async (schedule) => {
          // 获取该学员今日的课程计划
          const plans = await lessonPlanDb.getByStudentId(schedule.student_id)
          const todayPlan = plans.find(p => p.plan_date === today)
          
          return {
            student: schedule.student!,
            schedule: schedule as ScheduledClassWithInfo,
            plan: todayPlan,
            selected: true, // 默认全选
            attendance: 'present',
            taskCompleted: 'completed',
            performance: 'good',
            durationHours: schedule.duration_hours || 1,
            teacherName: (schedule as ScheduledClassWithInfo).teacher?.name || '',
            tasks: todayPlan ? [...todayPlan.tasks] : [],
            hasPlan: !!todayPlan
          }
        })
      )
      
      setStudentSchedules(infos)
    } catch (error) {
      console.error('Failed to load today schedules:', error)
      alert('加载今日排课数据失败')
    }
    setLoading(false)
  }
  
  // 抽屉打开时加载数据
  useEffect(() => {
    if (open) {
      loadTodaySchedules()
      setResult(null)
      setShowResult(false)
    }
  }, [open])
  
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
    if (info.plan) {
      setStudentSchedules(prev => prev.map((item, i) => 
        i === index ? { ...item, tasks: [...info.plan!.tasks], hasPlan: true } : item
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
      
      setResult({
        success: successCount,
        failed: selectedStudents.length - successCount,
        errors: []
      })
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
  
  // 关闭抽屉
  const handleClose = () => {
    onClose()
  }
  
  // 选中的学员数量
  const selectedCount = useMemo(() => 
    studentSchedules.filter(s => s.selected).length, 
    [studentSchedules]
  )
  
  return (
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
            className="fixed right-0 top-0 h-full w-[600px] bg-background border-l shadow-xl z-50 flex flex-col"
          >
            {/* 头部 */}
            <div className="h-16 border-b flex items-center justify-between px-6">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold">快速录入今日课堂</h2>
              </div>
              <Button variant="ghost" size="icon" onClick={handleClose}>
                <X className="w-5 h-5" />
              </Button>
            </div>
            
            {/* 日期信息栏 */}
            <div className="px-6 py-3 border-b bg-muted/30">
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-primary" />
                <div>
                  <span className="font-medium">{todayDisplay}</span>
                  <span className="text-muted-foreground ml-2">今日有排课的学员</span>
                </div>
              </div>
            </div>
            
            {/* 内容区域 */}
            <div className="flex-1 overflow-auto p-6">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                  <p className="text-muted-foreground mt-4">加载排课数据中...</p>
                </div>
              ) : showResult ? (
                /* 结果展示 */
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
                              <h3 className="text-xl font-semibold">录入完成</h3>
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
                    <Button variant="outline" onClick={() => {
                      setShowResult(false)
                      setResult(null)
                      loadTodaySchedules()
                    }} className="flex-1">
                      继续录入
                    </Button>
                    <Button onClick={handleClose} className="flex-1">
                      完成
                    </Button>
                  </div>
                </div>
              ) : studentSchedules.length === 0 ? (
                /* 无排课数据 */
                <Card className="border-dashed">
                  <CardContent className="p-8 text-center">
                    <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">今日没有排课记录</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      请先在排课页面添加今日的排课
                    </p>
                  </CardContent>
                </Card>
              ) : (
                /* 学员列表 */
                <div className="space-y-6">
                  {/* 统计信息 */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-muted rounded-lg p-3 text-center">
                      <div className="text-2xl font-semibold">{studentSchedules.length}</div>
                      <div className="text-xs text-muted-foreground">今日排课学员</div>
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
                  
                  {/* 快捷操作 */}
                  <div className="flex items-center justify-between">
                    <Button variant="outline" size="sm" onClick={handleSelectAll}>
                      {selectedCount === studentSchedules.length ? '取消全选' : '全选'}
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleMarkAllCompleted}>
                      <CheckCheck className="w-4 h-4 mr-1" />
                      一键全部完成
                    </Button>
                  </div>
                  
                  {/* 学员记录编辑列表 */}
                  <div className="space-y-4">
                    {studentSchedules.map((info, index) => (
                      <Card 
                        key={info.student.id}
                        className={cn(
                          "transition-all",
                          info.selected && "border-primary"
                        )}
                      >
                        <CardContent className="p-4 space-y-4">
                          {/* 学员标题 */}
                          <div className="flex items-center justify-between">
                            <div 
                              className="flex items-center gap-3 cursor-pointer flex-1"
                              onClick={() => handleToggleStudent(index)}
                            >
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
                              <div>
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
                                  {info.schedule.start_time && (
                                    <span className="flex items-center gap-1">
                                      <Clock className="w-3 h-3" />
                                      {info.schedule.start_time}
                                      {info.schedule.end_time && `-${info.schedule.end_time}`}
                                    </span>
                                  )}
                                  {info.teacherName && (
                                    <span>助教: {info.teacherName}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            
                            {info.hasPlan && (
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleCopyTasksFromPlan(index)}
                              >
                                <Copy className="w-4 h-4 mr-1" />
                                从计划复制
                              </Button>
                            )}
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
                                  handleUpdateTasks(index, [...info.tasks, newTask])
                                }}
                                disabled={info.tasks.length >= 4}
                              >
                                添加任务
                              </Button>
                            </div>
                            <div className="space-y-2">
                              {info.tasks.length === 0 ? (
                                <div className="text-sm text-muted-foreground text-center py-3 border rounded-lg border-dashed">
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
                                      handleUpdateTasks(index, newTasks)
                                    }}
                                    onDelete={info.tasks.length > 1 ? () => {
                                      handleUpdateTasks(index, info.tasks.filter((_, i) => i !== taskIndex))
                                    } : undefined}
                                  />
                                ))
                              )}
                            </div>
                          </div>
                          
                          {/* 完成状态和表现 */}
                          <div className="grid grid-cols-3 gap-3">
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
                                onChange={(e) => handleUpdateStudentInfo(index, {
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
                                onChange={(e) => handleUpdateStudentInfo(index, {
                                  attendance: e.target.value as AttendanceType
                                })}
                              />
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground mb-1 block">完成状态</label>
                              <Select
                                value={info.taskCompleted}
                                options={[
                                  { value: 'completed', label: '全部完成' },
                                  { value: 'partial', label: '部分完成' },
                                  { value: 'not_completed', label: '未完成' }
                                ]}
                                onChange={(e) => handleUpdateStudentInfo(index, {
                                  taskCompleted: e.target.value as TaskCompletedType
                                })}
                              />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            {/* 底部操作栏 */}
            {!loading && !showResult && studentSchedules.length > 0 && (
              <div className="h-16 border-t flex items-center justify-end px-6">
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
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      创建 {selectedCount} 条记录
                    </>
                  )}
                </Button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}