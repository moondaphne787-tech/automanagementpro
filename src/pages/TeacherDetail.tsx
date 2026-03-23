import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Plus, Trash2, Clock, Calendar, Phone, GraduationCap, Award, Edit, AlertTriangle, Check, TrendingUp, Copy, ChevronDown, ChevronUp } from 'lucide-react'
import { teacherDb, teacherAvailabilityDb, scheduledClassDb } from '@/db'
import type { Teacher, TeacherAvailability, ScheduledClass, DayOfWeek, TrainingStage } from '@/types'
import { TRAINING_STAGE_LABELS, TEACHER_TYPE_LABELS } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'

const DAY_LABELS: Record<DayOfWeek, string> = {
  monday: '周一',
  tuesday: '周二',
  wednesday: '周三',
  thursday: '周四',
  friday: '周五',
  saturday: '周六',
  sunday: '周日'
}

const DAY_OPTIONS = [
  { value: 'monday', label: '周一' },
  { value: 'tuesday', label: '周二' },
  { value: 'wednesday', label: '周三' },
  { value: 'thursday', label: '周四' },
  { value: 'friday', label: '周五' },
  { value: 'saturday', label: '周六' },
  { value: 'sunday', label: '周日' }
]

// 周末选项（用于快速筛选）
const WEEKEND_DAYS: DayOfWeek[] = ['saturday', 'sunday']
// 工作日选项
const WEEKDAY_DAYS: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']

// 获取本周周一日期
function getWeekStart(date: Date = new Date()): string {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // 调整到周一
  d.setDate(diff)
  return d.toISOString().split('T')[0]
}

// 格式化日期显示
function formatWeekDisplay(weekStart: string): string {
  const date = new Date(weekStart)
  const month = date.getMonth() + 1
  const day = date.getDate()
  const endDate = new Date(date)
  endDate.setDate(endDate.getDate() + 6)
  const endMonth = endDate.getMonth() + 1
  const endDay = endDate.getDate()
  return `${month}月${day}日 - ${endMonth}月${endDay}日`
}

const TRAINING_STAGE_OPTIONS: { value: TrainingStage; label: string }[] = [
  { value: 'probation', label: '实训期' },
  { value: 'intern', label: '实习期' },
  { value: 'formal', label: '正式助教' }
]

// 升级阈值配置
const UPGRADE_THRESHOLDS = {
  probation: { hours: 2, nextStage: 'intern' as TrainingStage, nextLabel: '实习期' },
  intern: { hours: 10, nextStage: 'formal' as TrainingStage, nextLabel: '正式助教' }
}

export function TeacherDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  
  const [teacher, setTeacher] = useState<Teacher | null>(null)
  const [availabilities, setAvailabilities] = useState<TeacherAvailability[]>([])
  const [scheduledClasses, setScheduledClasses] = useState<ScheduledClass[]>([])
  const [loading, setLoading] = useState(true)
  
  // 时段对话框
  const [availabilityDialogOpen, setAvailabilityDialogOpen] = useState(false)
  const [availabilityForm, setAvailabilityForm] = useState({
    day_of_week: 'saturday' as DayOfWeek,
    start_time: '09:00',
    end_time: '12:00',
    notes: '',
    is_week_specific: false,
    week_start: ''
  })
  const [saving, setSaving] = useState(false)
  
  // 周选择
  const [selectedWeekStart, setSelectedWeekStart] = useState(getWeekStart())
  const [showGeneralSlots, setShowGeneralSlots] = useState(true)
  const [showWeekSlots, setShowWeekSlots] = useState(true)
  
  // 编辑对话框
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editForm, setEditForm] = useState({
    training_stage: 'probation' as TrainingStage,
    teacher_types: [] as ('regular' | 'vacation')[]
  })
  
  // 加载数据
  const loadData = async () => {
    if (!id) return
    
    try {
      setLoading(true)
      const teacherData = await teacherDb.getById(id)
      if (!teacherData) {
        navigate('/teachers')
        return
      }
      setTeacher(teacherData)
      
      const [availData, classesData] = await Promise.all([
        teacherAvailabilityDb.getByTeacherId(id),
        scheduledClassDb.getByTeacherId(id)
      ])
      
      setAvailabilities(availData)
      setScheduledClasses(classesData)
    } catch (error) {
      console.error('Failed to load teacher:', error)
    } finally {
      setLoading(false)
    }
  }
  
  useEffect(() => {
    loadData()
  }, [id])
  
  // 打开添加时段对话框
  const handleOpenAvailabilityDialog = (isWeekSpecific: boolean = false) => {
    setAvailabilityForm({
      day_of_week: 'saturday',
      start_time: '09:00',
      end_time: '12:00',
      notes: '',
      is_week_specific: isWeekSpecific,
      week_start: isWeekSpecific ? selectedWeekStart : ''
    })
    setAvailabilityDialogOpen(true)
  }
  
  // 添加时段
  const handleAddAvailability = async () => {
    if (!id) return
    
    try {
      setSaving(true)
      await teacherAvailabilityDb.create({
        teacher_id: id,
        day_of_week: availabilityForm.day_of_week,
        start_time: availabilityForm.start_time,
        end_time: availabilityForm.end_time,
        notes: availabilityForm.notes || undefined,
        week_start: availabilityForm.is_week_specific ? availabilityForm.week_start : undefined
      })
      
      setAvailabilityDialogOpen(false)
      setAvailabilityForm({
        day_of_week: 'saturday',
        start_time: '09:00',
        end_time: '12:00',
        notes: '',
        is_week_specific: false,
        week_start: ''
      })
      loadData()
    } catch (error) {
      console.error('Failed to add availability:', error)
      alert('添加失败，请重试')
    } finally {
      setSaving(false)
    }
  }
  
  // 复制通用时段到本周
  const handleCopyGeneralToWeek = async () => {
    if (!id || generalAvailabilities.length === 0) return
    
    if (!confirm('确定要将通用时段复制到本周吗？这将保留原有的通用时段，同时为本周创建副本。')) return
    
    try {
      setSaving(true)
      for (const a of generalAvailabilities) {
        await teacherAvailabilityDb.create({
          teacher_id: id,
          day_of_week: a.day_of_week,
          start_time: a.start_time || undefined,
          end_time: a.end_time || undefined,
          notes: a.notes || undefined,
          week_start: selectedWeekStart
        })
      }
      loadData()
    } catch (error) {
      console.error('Failed to copy availability:', error)
      alert('复制失败，请重试')
    } finally {
      setSaving(false)
    }
  }
  
  // 清除本周特定时段
  const handleClearWeekAvailability = async () => {
    if (!id || currentWeekAvailabilities.length === 0) return
    
    if (!confirm('确定要清除本周的特定时段吗？')) return
    
    try {
      setSaving(true)
      for (const a of currentWeekAvailabilities) {
        await teacherAvailabilityDb.delete(a.id)
      }
      loadData()
    } catch (error) {
      console.error('Failed to clear week availability:', error)
      alert('清除失败，请重试')
    } finally {
      setSaving(false)
    }
  }
  
  // 删除时段
  const handleDeleteAvailability = async (availabilityId: string) => {
    if (!confirm('确定要删除这个时段吗？')) return
    
    try {
      await teacherAvailabilityDb.delete(availabilityId)
      loadData()
    } catch (error) {
      console.error('Failed to delete availability:', error)
      alert('删除失败，请重试')
    }
  }
  
  // 打开编辑对话框
  const handleOpenEditDialog = () => {
    setEditForm({
      training_stage: teacher?.training_stage || 'probation',
      teacher_types: teacher?.teacher_types || []
    })
    setEditDialogOpen(true)
  }
  
  // 保存编辑
  const handleSaveEdit = async () => {
    if (!id) return
    
    try {
      setSaving(true)
      await teacherDb.update(id, {
        training_stage: editForm.training_stage,
        teacher_types: editForm.teacher_types
      })
      setEditDialogOpen(false)
      loadData()
    } catch (error) {
      console.error('Failed to update teacher:', error)
      alert('更新失败，请重试')
    } finally {
      setSaving(false)
    }
  }
  
  // 切换助教类型
  const toggleTeacherType = (type: 'regular' | 'vacation') => {
    setEditForm(prev => ({
      ...prev,
      teacher_types: prev.teacher_types.includes(type)
        ? prev.teacher_types.filter(t => t !== type)
        : [...prev.teacher_types, type]
    }))
  }
  
  // 按星期分组时段（区分通用和特定周）
  const { generalAvailabilities, weekSpecificAvailabilities } = useMemo(() => {
    const general: TeacherAvailability[] = []
    const weekSpecific: Record<string, TeacherAvailability[]> = {}
    
    availabilities.forEach(a => {
      if (!a.week_start) {
        general.push(a)
      } else {
        if (!weekSpecific[a.week_start]) {
          weekSpecific[a.week_start] = []
        }
        weekSpecific[a.week_start].push(a)
      }
    })
    
    return { generalAvailabilities: general, weekSpecificAvailabilities: weekSpecific }
  }, [availabilities])
  
  // 获取当前选中周的时段
  const currentWeekAvailabilities = weekSpecificAvailabilities[selectedWeekStart] || []
  
  // 按星期分组的通用时段
  const groupedGeneralAvailabilities = generalAvailabilities.reduce((acc, a) => {
    const day = a.day_of_week
    if (!acc[day]) acc[day] = []
    acc[day].push(a)
    return acc
  }, {} as Record<DayOfWeek, TeacherAvailability[]>)
  
  // 按星期分组的特定周时段
  const groupedWeekAvailabilities = currentWeekAvailabilities.reduce((acc, a) => {
    const day = a.day_of_week
    if (!acc[day]) acc[day] = []
    acc[day].push(a)
    return acc
  }, {} as Record<DayOfWeek, TeacherAvailability[]>)
  
  // 获取所有有特定时段的周
  const weeksWithAvailability = Object.keys(weekSpecificAvailabilities).sort()
  
  // 获取即将到来的课程
  const today = new Date().toISOString().split('T')[0]
  const upcomingClasses = scheduledClasses
    .filter(c => c.class_date >= today && c.status === 'scheduled')
    .sort((a, b) => a.class_date.localeCompare(b.class_date))
    .slice(0, 10)
  
  // 获取培训阶段颜色
  const getTrainingStageColor = (stage: TrainingStage) => {
    switch (stage) {
      case 'probation': return 'bg-yellow-100 text-yellow-700 border-yellow-200'
      case 'intern': return 'bg-blue-100 text-blue-700 border-blue-200'
      case 'formal': return 'bg-green-100 text-green-700 border-green-200'
    }
  }
  
  // 计算升级进度
  const getUpgradeProgress = () => {
    if (!teacher) return null
    
    const stage = teacher.training_stage || 'probation'
    if (stage === 'formal') return null
    
    const hours = teacher.total_teaching_hours || 0
    const threshold = UPGRADE_THRESHOLDS[stage]
    const progress = Math.min((hours / threshold.hours) * 100, 100)
    const canUpgrade = hours >= threshold.hours
    
    return {
      currentStage: stage,
      currentHours: hours,
      threshold: threshold.hours,
      nextStage: threshold.nextStage,
      nextLabel: threshold.nextLabel,
      progress,
      canUpgrade
    }
  }
  
  const upgradeProgress = getUpgradeProgress()
  
  // 检查是否需要升级提醒
  const needsUpgradeReminder = upgradeProgress?.canUpgrade
  
  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        加载中...
      </div>
    )
  }
  
  if (!teacher) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        助教不存在
      </div>
    )
  }
  
  return (
    <div className="h-full flex flex-col">
      {/* 头部 */}
      <header className="h-16 border-b bg-card flex items-center px-6 gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/teachers')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold">{teacher.name}</h1>
          <p className="text-sm text-muted-foreground">
            {teacher.university}{teacher.major ? ` · ${teacher.major}` : ''}
          </p>
        </div>
        <Button variant="outline" onClick={handleOpenEditDialog}>
          <Edit className="h-4 w-4 mr-2" />
          编辑
        </Button>
      </header>
      
      {/* 升级提醒横幅 */}
      {needsUpgradeReminder && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-orange-50 border-b border-orange-200 px-6 py-3"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              <span className="text-sm text-orange-800">
                {teacher.name} 已累计教学 {teacher.total_teaching_hours} 小时，建议从{TRAINING_STAGE_LABELS[teacher.training_stage || 'probation']}升级为{upgradeProgress?.nextLabel}
              </span>
            </div>
            <Button
              size="sm"
              onClick={async () => {
                if (upgradeProgress) {
                  await teacherDb.update(teacher.id, { training_stage: upgradeProgress.nextStage })
                  loadData()
                }
              }}
            >
              <Award className="h-4 w-4 mr-1" />
              确认升级
            </Button>
          </div>
        </motion.div>
      )}
      
      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 基本信息 */}
          <Card className="p-6">
            <h2 className="font-semibold mb-4">基本信息</h2>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{teacher.phone || '未填写'}</span>
              </div>
              <div className="flex items-center gap-3">
                <GraduationCap className="h-4 w-4 text-muted-foreground" />
                <span>{teacher.university || '未填写'}{teacher.major ? ` · ${teacher.major}` : ''}</span>
              </div>
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>入职日期: {teacher.enroll_date || '未填写'}</span>
              </div>
              <div className="pt-2 border-t">
                <span className="text-muted-foreground">词汇量水平: </span>
                <span>{teacher.vocab_level || '未填写'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">口语水平: </span>
                <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs">
                  {teacher.oral_level === 'basic' ? '基础' : teacher.oral_level === 'intermediate' ? '中级' : '高级'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">适合年级: </span>
                <span>{teacher.suitable_grades || '未填写'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">适合程度: </span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {teacher.suitable_levels && teacher.suitable_levels.length > 0 
                    ? teacher.suitable_levels.map(level => (
                        <span key={level} className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-xs">
                          {level === 'weak' ? '基础薄弱' : level === 'medium' ? '基础较好' : '非常优秀'}
                        </span>
                      ))
                    : <span className="text-muted-foreground">未设置</span>
                  }
                </div>
              </div>
              <div className="pt-2 border-t">
                <span className="text-muted-foreground">教学风格: </span>
                <span>{teacher.teaching_style || '未填写'}</span>
              </div>
              {teacher.notes && (
                <div className="pt-2 border-t">
                  <span className="text-muted-foreground">备注: </span>
                  <p className="mt-1 text-muted-foreground">{teacher.notes}</p>
                </div>
              )}
            </div>
          </Card>
          
          {/* 培训阶段 */}
          <Card className="p-6">
            <h2 className="font-semibold mb-4">培训阶段</h2>
            <div className="space-y-4">
              <div className={`p-4 rounded-lg border ${getTrainingStageColor(teacher.training_stage || 'probation')}`}>
                <div className="flex items-center gap-2">
                  <Award className="h-5 w-5" />
                  <span className="font-medium">{TRAINING_STAGE_LABELS[teacher.training_stage || 'probation']}</span>
                </div>
              </div>
              
              <div className="flex items-center gap-3 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>累计教学时长: <strong>{teacher.total_teaching_hours || 0}</strong> 小时</span>
              </div>
              
              {/* 升级进度 */}
              {upgradeProgress && (
                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-muted-foreground">升级进度</span>
                    <span className="font-medium">
                      {teacher.total_teaching_hours || 0} / {upgradeProgress.threshold} 小时
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all ${upgradeProgress.canUpgrade ? 'bg-green-500' : 'bg-primary'}`}
                      style={{ width: `${upgradeProgress.progress}%` }}
                    />
                  </div>
                  <div className="text-xs text-muted-foreground mt-2">
                    {upgradeProgress.canUpgrade ? (
                      <span className="text-green-600 font-medium">已达升级条件，可升级为{upgradeProgress.nextLabel}</span>
                    ) : (
                      <span>再教 {upgradeProgress.threshold - (teacher.total_teaching_hours || 0)} 小时可升级为{upgradeProgress.nextLabel}</span>
                    )}
                  </div>
                </div>
              )}
              
              {teacher.teacher_types && teacher.teacher_types.length > 0 && (
                <div>
                  <span className="text-sm text-muted-foreground">助教类型: </span>
                  <div className="flex gap-2 mt-1">
                    {teacher.teacher_types.map(type => (
                      <span key={type} className="px-2 py-1 rounded-full bg-gray-100 text-gray-700 text-xs">
                        {TEACHER_TYPE_LABELS[type]}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="text-xs text-muted-foreground p-3 bg-muted/50 rounded-lg">
                <p className="font-medium mb-1">升级规则:</p>
                <ul className="space-y-1 list-disc list-inside">
                  <li>实训期满2小时 → 实习期</li>
                  <li>实习期满10小时 → 正式助教</li>
                </ul>
              </div>
            </div>
          </Card>
          
          {/* 可用时段 */}
          <Card className="p-6 lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">可用时段</h2>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => handleOpenAvailabilityDialog(false)}>
                  <Plus className="h-4 w-4 mr-1" />
                  添加通用时段
                </Button>
                <Button size="sm" onClick={() => handleOpenAvailabilityDialog(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  添加本周时段
                </Button>
              </div>
            </div>
            
            {availabilities.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                暂无可用时段，点击上方按钮添加
              </p>
            ) : (
              <div className="space-y-6">
                {/* 通用时段（每周都可用） */}
                {generalAvailabilities.length > 0 && (
                  <div>
                    <button
                      className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
                      onClick={() => setShowGeneralSlots(!showGeneralSlots)}
                    >
                      {showGeneralSlots ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      通用时段（每周可用）
                      <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 text-xs">
                        {generalAvailabilities.length}
                      </span>
                    </button>
                    
                    <AnimatePresence>
                      {showGeneralSlots && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="grid grid-cols-2 gap-4 mt-3">
                            {(['saturday', 'sunday'] as DayOfWeek[]).map(day => (
                              <div key={day}>
                                <div className="text-sm font-medium mb-2">{DAY_LABELS[day]}</div>
                                <div className="space-y-2">
                                  {groupedGeneralAvailabilities[day]?.map(a => (
                                    <motion.div
                                      key={a.id}
                                      initial={{ opacity: 0, x: -10 }}
                                      animate={{ opacity: 1, x: 0 }}
                                      className="flex items-center justify-between p-2 bg-blue-50 border border-blue-100 rounded-lg"
                                    >
                                      <div className="flex items-center gap-2">
                                        <Clock className="h-4 w-4 text-blue-500" />
                                        <span className="text-sm">
                                          {a.start_time?.slice(0, 5)} - {a.end_time?.slice(0, 5)}
                                        </span>
                                        {a.notes && (
                                          <span className="text-xs text-muted-foreground">({a.notes})</span>
                                        )}
                                      </div>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 text-destructive hover:text-destructive"
                                        onClick={() => handleDeleteAvailability(a.id)}
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </motion.div>
                                  ))}
                                  {!groupedGeneralAvailabilities[day] && (
                                    <p className="text-xs text-muted-foreground py-2">暂无时段</p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
                
                {/* 特定周时段 */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium text-muted-foreground">特定周时段</label>
                      <Input
                        type="date"
                        value={selectedWeekStart}
                        onChange={e => setSelectedWeekStart(e.target.value)}
                        className="w-40"
                      />
                      <span className="text-sm text-muted-foreground">
                        {formatWeekDisplay(selectedWeekStart)}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      {generalAvailabilities.length > 0 && currentWeekAvailabilities.length === 0 && (
                        <Button variant="outline" size="sm" onClick={handleCopyGeneralToWeek}>
                          <Copy className="h-4 w-4 mr-1" />
                          复制通用时段
                        </Button>
                      )}
                      {currentWeekAvailabilities.length > 0 && (
                        <Button variant="outline" size="sm" onClick={handleClearWeekAvailability}>
                          <Trash2 className="h-4 w-4 mr-1" />
                          清除本周
                        </Button>
                      )}
                    </div>
                  </div>
                  
                  {currentWeekAvailabilities.length > 0 ? (
                    <div className="grid grid-cols-2 gap-4">
                      {(['saturday', 'sunday'] as DayOfWeek[]).map(day => (
                        <div key={day}>
                          <div className="text-sm font-medium mb-2">{DAY_LABELS[day]}</div>
                          <div className="space-y-2">
                            {groupedWeekAvailabilities[day]?.map(a => (
                              <motion.div
                                key={a.id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="flex items-center justify-between p-2 bg-green-50 border border-green-100 rounded-lg"
                              >
                                <div className="flex items-center gap-2">
                                  <Clock className="h-4 w-4 text-green-500" />
                                  <span className="text-sm">
                                    {a.start_time?.slice(0, 5)} - {a.end_time?.slice(0, 5)}
                                  </span>
                                  {a.notes && (
                                    <span className="text-xs text-muted-foreground">({a.notes})</span>
                                  )}
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-destructive hover:text-destructive"
                                  onClick={() => handleDeleteAvailability(a.id)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </motion.div>
                            ))}
                            {!groupedWeekAvailabilities[day] && (
                              <p className="text-xs text-muted-foreground py-2">暂无时段</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 bg-muted/30 rounded-lg">
                      <p className="text-sm text-muted-foreground mb-2">
                        本周暂无特定时段设置
                      </p>
                      {generalAvailabilities.length > 0 ? (
                        <Button variant="outline" size="sm" onClick={handleCopyGeneralToWeek}>
                          <Copy className="h-4 w-4 mr-1" />
                          从通用时段复制
                        </Button>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          请先添加通用时段或直接为本周添加特定时段
                        </p>
                      )}
                    </div>
                  )}
                  
                  {/* 其他周的时段（快速切换） */}
                  {weeksWithAvailability.length > 0 && (
                    <div className="mt-4 pt-4 border-t">
                      <div className="text-xs text-muted-foreground mb-2">其他已设置的周：</div>
                      <div className="flex flex-wrap gap-2">
                        {weeksWithAvailability.map(week => (
                          <button
                            key={week}
                            onClick={() => setSelectedWeekStart(week)}
                            className={`px-2 py-1 text-xs rounded transition-colors ${
                              week === selectedWeekStart
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted hover:bg-muted/80'
                            }`}
                          >
                            {formatWeekDisplay(week)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </Card>
          
          {/* 近期排课 */}
          <Card className="p-6 lg:col-span-3">
            <h2 className="font-semibold mb-4">近期排课</h2>
            
            {upcomingClasses.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                暂无近期排课
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {upcomingClasses.map(c => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg text-sm"
                  >
                    <div>
                      <div className="font-medium">{c.class_date}</div>
                      <div className="text-muted-foreground">
                        {c.start_time?.slice(0, 5)} - {c.end_time?.slice(0, 5)}
                      </div>
                    </div>
                    <div className={`px-2 py-0.5 rounded-full text-xs ${
                      c.status === 'scheduled' ? 'bg-green-100 text-green-700' :
                      c.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                      c.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {c.status === 'scheduled' ? '已排课' :
                       c.status === 'completed' ? '已完成' :
                       c.status === 'cancelled' ? '已取消' : '已调课'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
      
      {/* 添加时段对话框 */}
      <Dialog open={availabilityDialogOpen} onOpenChange={setAvailabilityDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {availabilityForm.is_week_specific ? '添加本周特定时段' : '添加通用时段'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* 显示当前设置的时段类型 */}
            {availabilityForm.is_week_specific && (
              <div className="p-3 bg-green-50 border border-green-100 rounded-lg text-sm">
                <div className="flex items-center gap-2 text-green-700">
                  <Calendar className="h-4 w-4" />
                  <span>为 <strong>{formatWeekDisplay(availabilityForm.week_start)}</strong> 添加特定时段</span>
                </div>
              </div>
            )}
            
            {!availabilityForm.is_week_specific && (
              <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-sm">
                <div className="flex items-center gap-2 text-blue-700">
                  <Clock className="h-4 w-4" />
                  <span>添加通用时段，每周都可用</span>
                </div>
              </div>
            )}
            
            <div className="space-y-2">
              <label className="text-sm font-medium">星期</label>
              <Select
                value={availabilityForm.day_of_week}
                onChange={e => setAvailabilityForm(prev => ({ ...prev, day_of_week: e.target.value as DayOfWeek }))}
                options={DAY_OPTIONS}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">开始时间</label>
                <Input
                  type="time"
                  value={availabilityForm.start_time}
                  onChange={e => setAvailabilityForm(prev => ({ ...prev, start_time: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">结束时间</label>
                <Input
                  type="time"
                  value={availabilityForm.end_time}
                  onChange={e => setAvailabilityForm(prev => ({ ...prev, end_time: e.target.value }))}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">备注</label>
              <Input
                value={availabilityForm.notes}
                onChange={e => setAvailabilityForm(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="可选备注"
              />
            </div>
            
            {/* 如果是添加本周时段，允许切换周 */}
            {availabilityForm.is_week_specific && (
              <div className="space-y-2">
                <label className="text-sm font-medium">选择周</label>
                <Input
                  type="date"
                  value={availabilityForm.week_start}
                  onChange={e => setAvailabilityForm(prev => ({ ...prev, week_start: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">
                  选择周一日期，该时段将仅对所选周有效
                </p>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setAvailabilityDialogOpen(false)}>取消</Button>
            <Button onClick={handleAddAvailability} disabled={saving}>
              {saving ? '添加中...' : '添加'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* 编辑对话框 */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑助教信息</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">培训阶段</label>
              <Select
                value={editForm.training_stage}
                onChange={e => setEditForm(prev => ({ ...prev, training_stage: e.target.value as TrainingStage }))}
                options={TRAINING_STAGE_OPTIONS}
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">助教类型</label>
              <div className="flex gap-2">
                {(['regular', 'vacation'] as const).map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => toggleTeacherType(type)}
                    className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                      editForm.teacher_types.includes(type)
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    {TEACHER_TYPE_LABELS[type]}
                  </button>
                ))}
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>取消</Button>
            <Button onClick={handleSaveEdit} disabled={saving}>
              {saving ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}