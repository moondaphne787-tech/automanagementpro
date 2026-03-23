import { useState, useEffect, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Clock,
  User,
  MoreHorizontal,
  Pencil,
  Trash2,
  CalendarDays,
  RefreshCw,
  Sparkles,
  Settings,
  AlertCircle,
  Check,
  X,
  Loader2,
  Users,
  BookOpen,
  CalendarPlus,
  Sun,
  Moon,
  Hand
} from 'lucide-react'
import { studentDb, teacherDb, scheduledClassDb, studentSchedulePreferenceDb, teacherAvailabilityDb, settingsDb } from '@/db'
import type { Student, Teacher, ScheduledClass, DayOfWeek, Billing, StudentSchedulePreference, TeacherAvailability } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { DateInput } from '@/components/ui/date-input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { sendAIRequest } from '@/ai/client'
import { 
  AI_SCHEDULE_SYSTEM_PROMPT, 
  buildSchedulePromptInput, 
  parseAIScheduleResponse, 
  validateScheduleResults,
  getWeekendWithFridayConfigs,
  getWeekDateConfigs,
  type AIScheduleResult,
  type ScheduleDateConfig
} from '@/ai/schedulePrompts'
import { ManualSchedule } from '@/components/ManualSchedule/ManualSchedule'

// 白天时间槽（8点到18点）
const DAYTIME_SLOTS: string[] = []
for (let h = 8; h <= 18; h++) {
  DAYTIME_SLOTS.push(`${h.toString().padStart(2, '0')}:00`)
}

// 晚上时间槽（18点到21点）
const EVENING_SLOTS: string[] = []
for (let h = 18; h <= 21; h++) {
  EVENING_SLOTS.push(`${h.toString().padStart(2, '0')}:00`)
}

// 格式化日期
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

function formatDisplayDate(date: Date): string {
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

const DAY_LABELS: Record<DayOfWeek, string> = {
  monday: '周一',
  tuesday: '周二',
  wednesday: '周三',
  thursday: '周四',
  friday: '周五',
  saturday: '周六',
  sunday: '周日'
}

// 获取日期对应的星期
function getDayOfWeek(dateStr: string): DayOfWeek {
  const days: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const date = new Date(dateStr)
  return days[date.getDay()]
}

// 视图模式类型
type ViewMode = 'week' | 'arrange' | 'manual'

// 预设排课模式
type SchedulePreset = 'weekend_with_friday' | 'week' | 'custom'

// 单个排课项
interface ScheduleItem {
  id: string
  date: string
  start_time: string
  end_time: string
  duration_hours: number
}

// 单日课表视图组件
function DayScheduleView({
  scheduleDates,
  classes,
  activeMenu,
  onPrevDay,
  onNextDay,
  currentDateIndex,
  setCurrentDateIndex,
  onCreateClass,
  onClassClick,
  menuPosition,
  onEditClass,
  onReschedule,
  onCancel,
  onDeleteClass,
  getTimeSlots,
  getDateIcon
}: {
  scheduleDates: ScheduleDateConfig[]
  classes: (ScheduledClass & { student?: Student; teacher?: Teacher })[]
  activeMenu: string | null
  onPrevDay: () => void
  onNextDay: () => void
  currentDateIndex: number
  setCurrentDateIndex: (index: number) => void
  onCreateClass: (date?: string, time?: string) => void
  onClassClick: (e: React.MouseEvent, classId: string) => void
  menuPosition: { top: number; left: number } | null
  onEditClass: (cls: ScheduledClass) => void
  onReschedule: (cls: ScheduledClass) => void
  onCancel: (cls: ScheduledClass) => void
  onDeleteClass: (cls: ScheduledClass) => void
  getTimeSlots: (dateConfig: ScheduleDateConfig) => string[]
  getDateIcon: (type: ScheduleDateConfig['type']) => React.ReactNode
}) {
  if (scheduleDates.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <CalendarDays className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>请点击"添加日期"按钮选择排课日期</p>
        </div>
      </div>
    )
  }
  
  const dateConfig = scheduleDates[currentDateIndex]
  if (!dateConfig) return null
  
  const dayClasses = classes.filter(c => c.class_date === dateConfig.date)
  const isToday = dateConfig.date === formatDate(new Date())
  const timeSlots = getTimeSlots(dateConfig)
  const startHour = dateConfig.type === 'friday_evening' ? 18 : 8
  
  return (
    <div className="flex-1 flex flex-col">
      {/* 日期导航 */}
      <div className="h-14 border-b bg-muted/30 flex items-center justify-between px-4">
        <Button variant="outline" size="icon" onClick={onPrevDay} disabled={currentDateIndex === 0}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        
        <div className="flex items-center gap-3">
          {getDateIcon(dateConfig.type)}
          <div className="text-center">
            <div className="text-lg font-semibold">{dateConfig.label}</div>
            <div className="text-sm text-muted-foreground">
              {formatDisplayDate(new Date(dateConfig.date))}
              {dateConfig.type === 'friday_evening' && ' (晚)'}
              {dateConfig.type === 'holiday' && ' (假期)'}
              {isToday && ' · 今天'}
            </div>
          </div>
        </div>
        
        <Button variant="outline" size="icon" onClick={onNextDay} disabled={currentDateIndex === scheduleDates.length - 1}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      
      {/* 日期指示器 */}
      {scheduleDates.length > 1 && (
        <div className="flex justify-center gap-2 py-2 bg-muted/20 border-b">
          {scheduleDates.map((d, i) => (
            <button
              key={d.date}
              onClick={() => setCurrentDateIndex(i)}
              className={`px-3 py-1 rounded-full text-xs transition-colors ${
                i === currentDateIndex ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      )}
      
      {/* 日历主体 */}
      <div className="flex-1 flex overflow-auto">
        {/* 时间轴 */}
        <div className="w-16 flex-shrink-0 border-r bg-muted/30">
          {timeSlots.map((time) => (
            <div key={time} className="flex items-start justify-end pr-2 pt-1 text-xs text-muted-foreground border-b" style={{ height: '60px' }}>
              {time}
            </div>
          ))}
        </div>
        
        {/* 课程区域 */}
        <div
          className="flex-1 relative"
          style={{ minHeight: `${timeSlots.length * 60}px` }}
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect()
            const y = e.clientY - rect.top
            const hour = Math.floor(y / 60) + startHour
            onCreateClass(dateConfig.date, `${hour.toString().padStart(2, '0')}:00`)
          }}
        >
          {/* 时间网格线 */}
          {timeSlots.map((time, i) => (
            <div key={time} className="absolute left-0 right-0 border-b border-dashed border-muted" style={{ top: `${i * 60}px`, height: '60px' }} />
          ))}
          
          {/* 课程卡片 */}
          {(() => {
            const classWithPosition = dayClasses
              .filter(cls => cls.status === 'scheduled')
              .map(cls => {
                const startTime = cls.start_time || '09:00'
                const endTime = cls.end_time || '10:00'
                const [startH, startM] = startTime.split(':').map(Number)
                const [endH, endM] = endTime.split(':').map(Number)
                const startOffset = (startH - startHour) * 60 + (startM || 0)
                const duration = (endH * 60 + (endM || 0)) - (startH * 60 + (startM || 0))
                return { ...cls, startOffset, duration, top: startOffset, height: duration }
              })
            
            const columns: (typeof classWithPosition)[] = []
            classWithPosition.forEach(cls => {
              let colIndex = 0
              for (let i = 0; i < columns.length; i++) {
                const hasConflict = columns[i].some(existing => !(cls.top + cls.height <= existing.top || cls.top >= existing.top + existing.height))
                if (!hasConflict) { colIndex = i; break }
                colIndex = columns.length
              }
              if (!columns[colIndex]) columns[colIndex] = []
              columns[colIndex].push(cls)
            })
            
            return classWithPosition.map(cls => {
              let colIndex = 0
              for (let i = 0; i < columns.length; i++) {
                if (columns[i]?.includes(cls)) { colIndex = i; break }
              }
              
              const maxCol = columns.length
              const width = `calc((100% - 16px) / ${maxCol})`
              const left = `calc((100% - 16px) / ${maxCol} * ${colIndex})`
              
              return (
                <motion.div
                  key={cls.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`absolute rounded-lg p-2 cursor-pointer shadow-sm border-2 ${
                    cls.status === 'cancelled' ? 'bg-red-50 border-red-200' : cls.status === 'rescheduled' ? 'bg-yellow-50 border-yellow-200' : 'bg-blue-50 border-blue-200 hover:border-blue-400'
                  } ${activeMenu === cls.id ? 'z-20 ring-2 ring-primary' : 'z-10'}`}
                  style={{ top: `${cls.top}px`, height: `${Math.max(cls.height, 40)}px`, width, left, minWidth: '80px' }}
                  onClick={(e) => onClassClick(e, cls.id)}
                >
                  <div className="flex flex-col h-full relative">
                    <div className="flex items-center gap-1 min-w-0">
                      <User className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      <span className="font-medium text-sm truncate">{cls.student?.name || '未知'}</span>
                    </div>
                    <div className="flex items-center gap-1 mt-1 min-w-0">
                      <Clock className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      <span className="text-xs text-muted-foreground">{cls.start_time?.slice(0, 5)}-{cls.end_time?.slice(0, 5)}</span>
                    </div>
                    {cls.teacher && <div className="text-xs text-muted-foreground mt-1 truncate">{cls.teacher.name}</div>}
                    {cls.status !== 'scheduled' && (
                      <div className={`absolute top-1 right-1 px-1.5 py-0.5 rounded text-[10px] ${cls.status === 'cancelled' ? 'bg-red-500 text-white' : 'bg-yellow-500 text-white'}`}>
                        {cls.status === 'cancelled' ? '已取消' : '已调课'}
                      </div>
                    )}
                  </div>
                </motion.div>
              )
            })
          })()}
        </div>
      </div>
      
      {/* 操作菜单 */}
      {activeMenu && menuPosition && (() => {
        const cls = classes.find(c => c.id === activeMenu)
        if (!cls || cls.status !== 'scheduled') return null
        return (
          <div className="fixed bg-card border rounded-lg shadow-lg py-1 z-[100] min-w-[120px]" style={{ top: `${menuPosition.top}px`, left: `${menuPosition.left}px` }} onClick={(e) => e.stopPropagation()}>
            <button className="w-full px-3 py-1.5 text-left text-sm hover:bg-muted flex items-center gap-2" onClick={() => onEditClass(cls)}><Pencil className="h-4 w-4" /> 编辑</button>
            <button className="w-full px-3 py-1.5 text-left text-sm hover:bg-muted flex items-center gap-2" onClick={() => onReschedule(cls)}><RefreshCw className="h-4 w-4" /> 调课</button>
            <button className="w-full px-3 py-1.5 text-left text-sm hover:bg-muted flex items-center gap-2" onClick={() => onCancel(cls)}><CalendarDays className="h-4 w-4" /> 取消</button>
            <button className="w-full px-3 py-1.5 text-left text-sm hover:bg-muted text-destructive flex items-center gap-2" onClick={() => onDeleteClass(cls)}><Trash2 className="h-4 w-4" /> 删除</button>
          </div>
        )
      })()}
    </div>
  )
}

export function Schedule() {
  const [viewMode, setViewMode] = useState<ViewMode>('week')
  const [currentDate, setCurrentDate] = useState(new Date())
  
  // 排课日期配置
  const [scheduleDates, setScheduleDates] = useState<ScheduleDateConfig[]>(() => 
    getWeekendWithFridayConfigs(new Date())
  )
  const [schedulePreset, setSchedulePreset] = useState<SchedulePreset>('weekend_with_friday')
  
  // 添加日期对话框
  const [addDateDialogOpen, setAddDateDialogOpen] = useState(false)
  const [newDateForm, setNewDateForm] = useState({
    date: '',
    type: 'custom' as ScheduleDateConfig['type'],
    label: '',
    timeStart: '08:00',
    timeEnd: '18:00'
  })
  
  const [students, setStudents] = useState<(Student & { billing: Billing | null; preferences: StudentSchedulePreference[] })[]>([])
  const [teachers, setTeachers] = useState<(Teacher & { availabilities: TeacherAvailability[] })[]>([])
  const [classes, setClasses] = useState<(ScheduledClass & { student?: Student; teacher?: Teacher })[]>([])
  const [loading, setLoading] = useState(true)
  
  // 新增/编辑课程对话框
  const [classDialogOpen, setClassDialogOpen] = useState(false)
  const [editingClass, setEditingClass] = useState<ScheduledClass | null>(null)
  // 支持多日期独立时间段排课
  const [classForm, setClassForm] = useState({
    student_id: '',
    teacher_id: '',
    schedules: [] as ScheduleItem[],
    notes: ''
  })
  const [saving, setSaving] = useState(false)
  
  // 更多操作菜单
  const [activeMenu, setActiveMenu] = useState<string | null>(null)
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null)
  
  // 调课对话框
  const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState(false)
  const [reschedulingClass, setReschedulingClass] = useState<ScheduledClass | null>(null)
  const [rescheduleForm, setRescheduleForm] = useState({
    class_date: '',
    start_time: '',
    end_time: ''
  })
  
  // 取消对话框
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [cancellingClass, setCancellingClass] = useState<ScheduledClass | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  
  // 学生时段偏好对话框
  const [preferenceDialogOpen, setPreferenceDialogOpen] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState<Student & { billing: Billing | null; preferences: StudentSchedulePreference[] } | null>(null)
  const [preferenceForm, setPreferenceForm] = useState({
    day_of_week: 'saturday' as DayOfWeek,
    preferred_start: '09:00',
    preferred_end: '11:00',
    notes: ''
  })
  
  // AI排课状态
  const [aiScheduling, setAiScheduling] = useState(false)
  const [aiResults, setAiResults] = useState<AIScheduleResult[]>([])
  const [aiConflicts, setAiConflicts] = useState<AIScheduleResult[]>([])
  const [aiError, setAiError] = useState<string | null>(null)
  const [selectedAiResults, setSelectedAiResults] = useState<Set<string>>(new Set())
  const [extraInstructions, setExtraInstructions] = useState('')
  
  // 单日视图当前日期索引
  const [currentDateIndex, setCurrentDateIndex] = useState(0)
  
  // 人工排课跳转日期
  const [manualScheduleDate, setManualScheduleDate] = useState<string | null>(null)
  
  // 跳转到人工排课并选中日期
  const handleJumpToManualSchedule = (date: string) => {
    setManualScheduleDate(date)
    setViewMode('manual')
  }
  
  // 生成唯一ID
  const generateId = () => Math.random().toString(36).substr(2, 9)
  
  // 加载数据
  const loadData = async () => {
    try {
      setLoading(true)
      const [studentsData, teachersData] = await Promise.all([
        studentDb.getAllWithBilling({ status: 'active', student_type: 'all', level: 'all', grade: 'all', search: '' }, { field: 'student_no', direction: 'asc' }),
        teacherDb.getActive()
      ])
      
      const studentsWithPrefs = await Promise.all(
        studentsData.map(async (s) => {
          const prefs = await studentSchedulePreferenceDb.getByStudentId(s.id)
          return { ...s, preferences: prefs }
        })
      )
      
      const teachersWithAvail = await Promise.all(
        teachersData.map(async (t) => {
          const avail = await teacherAvailabilityDb.getByTeacherId(t.id)
          return { ...t, availabilities: avail }
        })
      )
      
      setStudents(studentsWithPrefs)
      setTeachers(teachersWithAvail)
      
      if (scheduleDates.length > 0) {
        const startDate = scheduleDates.reduce((min, d) => d.date < min ? d.date : min, scheduleDates[0].date)
        const endDate = scheduleDates.reduce((max, d) => d.date > max ? d.date : max, scheduleDates[0].date)
        const classesData = await scheduledClassDb.getByWeek(startDate, endDate)
        setClasses(classesData)
      }
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }
  
  useEffect(() => {
    loadData()
  }, [scheduleDates])
  
  // 切换预设模式
  const handlePresetChange = (preset: SchedulePreset) => {
    setSchedulePreset(preset)
    setCurrentDateIndex(0)
    if (preset === 'weekend_with_friday') {
      setScheduleDates(getWeekendWithFridayConfigs(currentDate))
    } else if (preset === 'week') {
      setScheduleDates(getWeekDateConfigs(currentDate))
    }
    // custom 不自动设置日期
  }
  
  // 切换周
  const goToPrevWeek = () => {
    const newDate = new Date(currentDate)
    newDate.setDate(newDate.getDate() - 7)
    setCurrentDate(newDate)
    setCurrentDateIndex(0)
    if (schedulePreset === 'weekend_with_friday') {
      setScheduleDates(getWeekendWithFridayConfigs(newDate))
    } else if (schedulePreset === 'week') {
      setScheduleDates(getWeekDateConfigs(newDate))
    }
  }
  
  const goToNextWeek = () => {
    const newDate = new Date(currentDate)
    newDate.setDate(newDate.getDate() + 7)
    setCurrentDate(newDate)
    setCurrentDateIndex(0)
    if (schedulePreset === 'weekend_with_friday') {
      setScheduleDates(getWeekendWithFridayConfigs(newDate))
    } else if (schedulePreset === 'week') {
      setScheduleDates(getWeekDateConfigs(newDate))
    }
  }
  
  const goToToday = () => {
    setCurrentDate(new Date())
    setCurrentDateIndex(0)
    if (schedulePreset === 'weekend_with_friday') {
      setScheduleDates(getWeekendWithFridayConfigs(new Date()))
    } else if (schedulePreset === 'week') {
      setScheduleDates(getWeekDateConfigs(new Date()))
    }
  }
  
  // 添加自定义日期
  const handleAddCustomDate = () => {
    if (!newDateForm.date) {
      alert('请选择日期')
      return
    }
    
    const dayOfWeek = getDayOfWeek(newDateForm.date)
    const label = newDateForm.label || `${DAY_LABELS[dayOfWeek]}${newDateForm.type === 'holiday' ? '（假期）' : ''}`
    
    const newConfig: ScheduleDateConfig = {
      date: newDateForm.date,
      type: newDateForm.type,
      label,
      timeRange: newDateForm.type === 'friday_evening' 
        ? { start: '18:00', end: '21:00' }
        : { start: newDateForm.timeStart, end: newDateForm.timeEnd }
    }
    
    if (scheduleDates.some(d => d.date === newDateForm.date)) {
      alert('该日期已添加')
      return
    }
    
    setScheduleDates(prev => [...prev, newConfig].sort((a, b) => a.date.localeCompare(b.date)))
    setAddDateDialogOpen(false)
    setNewDateForm({
      date: '',
      type: 'custom',
      label: '',
      timeStart: '08:00',
      timeEnd: '18:00'
    })
  }
  
  // 移除日期
  const handleRemoveDate = (date: string) => {
    setScheduleDates(prev => prev.filter(d => d.date !== date))
  }
  
  // 打开新增课程对话框
  const handleCreateClass = (date?: string, time?: string) => {
    setEditingClass(null)
    // 初始化一个排课项
    const initialSchedule: ScheduleItem = {
      id: generateId(),
      date: date || scheduleDates[0]?.date || formatDate(new Date()),
      start_time: time || '09:00',
      end_time: time ? `${(parseInt(time.split(':')[0]) + 2).toString().padStart(2, '0')}:${time.split(':')[1]}` : '11:00',
      duration_hours: 2
    }
    setClassForm({
      student_id: '',
      teacher_id: '',
      schedules: [initialSchedule],
      notes: ''
    })
    setClassDialogOpen(true)
  }
  
  // 添加排课项
  const handleAddScheduleItem = () => {
    const newItem: ScheduleItem = {
      id: generateId(),
      date: scheduleDates.find(d => !classForm.schedules.some(s => s.date === d.date))?.date || scheduleDates[0]?.date || formatDate(new Date()),
      start_time: '09:00',
      end_time: '11:00',
      duration_hours: 2
    }
    setClassForm(prev => ({
      ...prev,
      schedules: [...prev.schedules, newItem]
    }))
  }
  
  // 删除排课项
  const handleRemoveScheduleItem = (id: string) => {
    setClassForm(prev => ({
      ...prev,
      schedules: prev.schedules.filter(s => s.id !== id)
    }))
  }
  
  // 更新排课项
  const handleUpdateScheduleItem = (id: string, field: keyof ScheduleItem, value: string | number) => {
    setClassForm(prev => ({
      ...prev,
      schedules: prev.schedules.map(s => {
        if (s.id !== id) return s
        
        if (field === 'start_time') {
          const startTime = value as string
          const [hours, minutes] = startTime.split(':').map(Number)
          const endHours = hours + 2
          const endTime = `${endHours.toString().padStart(2, '0')}:${(minutes || 0).toString().padStart(2, '0')}`
          return { 
            ...s, 
            start_time: startTime, 
            end_time: endTime,
            duration_hours: 2
          }
        }
        return { ...s, [field]: value }
      })
    }))
  }
  
  // 打开编辑课程对话框
  const handleEditClass = (cls: ScheduledClass) => {
    setEditingClass(cls)
    setClassForm({
      student_id: cls.student_id,
      teacher_id: cls.teacher_id || '',
      schedules: [{
        id: generateId(),
        date: cls.class_date,
        start_time: cls.start_time || '09:00',
        end_time: cls.end_time || '11:00',
        duration_hours: cls.duration_hours
      }],
      notes: cls.notes || ''
    })
    setClassDialogOpen(true)
    setActiveMenu(null)
  }
  
  // 保存课程
  const handleSaveClass = async () => {
    if (!classForm.student_id) {
      alert('请选择学员')
      return
    }
    
    if (classForm.schedules.length === 0) {
      alert('请添加排课项')
      return
    }
    
    // 检查是否有未设置日期的排课项
    const emptySchedule = classForm.schedules.find(s => !s.date)
    if (emptySchedule) {
      alert('请为所有排课项设置日期')
      return
    }
    
    try {
      setSaving(true)
      
      if (editingClass) {
        // 编辑模式：只更新单个课程
        const schedule = classForm.schedules[0]
        if (classForm.teacher_id) {
          const conflict = await scheduledClassDb.checkConflict(
            classForm.teacher_id,
            schedule.date,
            schedule.start_time,
            schedule.end_time,
            editingClass.id
          )
          if (conflict) {
            alert(`时段冲突：该助教在 ${schedule.date} ${schedule.start_time}-${schedule.end_time} 已有课程安排`)
            return
          }
        }
        
        await scheduledClassDb.update(editingClass.id, {
          student_id: classForm.student_id,
          teacher_id: classForm.teacher_id || null,
          class_date: schedule.date,
          start_time: schedule.start_time,
          end_time: schedule.end_time,
          duration_hours: schedule.duration_hours,
          notes: classForm.notes || null
        })
      } else {
        // 新增模式：批量创建多个排课
        if (classForm.teacher_id) {
          for (const schedule of classForm.schedules) {
            const conflict = await scheduledClassDb.checkConflict(
              classForm.teacher_id,
              schedule.date,
              schedule.start_time,
              schedule.end_time
            )
            if (conflict) {
              alert(`时段冲突：该助教在 ${schedule.date} ${schedule.start_time}-${schedule.end_time} 已有课程安排`)
              return
            }
          }
        }
        
        const results = await scheduledClassDb.batchCreate(
          classForm.schedules.map(schedule => ({
            student_id: classForm.student_id,
            teacher_id: classForm.teacher_id || undefined,
            class_date: schedule.date,
            start_time: schedule.start_time,
            end_time: schedule.end_time,
            duration_hours: schedule.duration_hours,
            notes: classForm.notes || undefined
          }))
        )
        
        if (results.failed > 0) {
          alert(`排课完成：成功 ${results.success} 条，失败 ${results.failed} 条`)
        }
      }
      
      setClassDialogOpen(false)
      loadData()
    } catch (error) {
      console.error('Failed to save class:', error)
      alert('保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }
  
  // 删除课程
  const handleDeleteClass = async (cls: ScheduledClass) => {
    if (!confirm('确定要删除这节课程吗？')) return
    
    try {
      await scheduledClassDb.delete(cls.id)
      setActiveMenu(null)
      loadData()
    } catch (error) {
      console.error('Failed to delete class:', error)
      alert('删除失败，请重试')
    }
  }
  
  // 打开调课对话框
  const handleOpenReschedule = (cls: ScheduledClass) => {
    setReschedulingClass(cls)
    setRescheduleForm({
      class_date: cls.class_date,
      start_time: cls.start_time || '09:00',
      end_time: cls.end_time || '10:00'
    })
    setRescheduleDialogOpen(true)
    setActiveMenu(null)
  }
  
  // 执行调课
  const handleReschedule = async () => {
    if (!reschedulingClass) return
    
    try {
      await scheduledClassDb.reschedule(
        reschedulingClass.id,
        rescheduleForm.class_date,
        rescheduleForm.start_time,
        rescheduleForm.end_time
      )
      
      setRescheduleDialogOpen(false)
      setReschedulingClass(null)
      loadData()
    } catch (error) {
      console.error('Failed to reschedule:', error)
      alert('调课失败，请重试')
    }
  }
  
  // 打开取消对话框
  const handleOpenCancel = (cls: ScheduledClass) => {
    setCancellingClass(cls)
    setCancelReason('')
    setCancelDialogOpen(true)
    setActiveMenu(null)
  }
  
  // 执行取消
  const handleCancel = async () => {
    if (!cancellingClass) return
    
    try {
      await scheduledClassDb.cancel(cancellingClass.id, cancelReason || undefined)
      setCancelDialogOpen(false)
      setCancellingClass(null)
      loadData()
    } catch (error) {
      console.error('Failed to cancel class:', error)
      alert('取消失败，请重试')
    }
  }
  
  // 打开学生时段偏好对话框
  const handleOpenPreferenceDialog = (student: Student & { billing: Billing | null; preferences: StudentSchedulePreference[] }) => {
    setSelectedStudent(student)
    setPreferenceForm({
      day_of_week: 'saturday',
      preferred_start: '09:00',
      preferred_end: '11:00',
      notes: ''
    })
    setPreferenceDialogOpen(true)
  }
  
  // 添加学生时段偏好
  const handleAddPreference = async () => {
    if (!selectedStudent) return
    
    try {
      await studentSchedulePreferenceDb.create({
        student_id: selectedStudent.id,
        day_of_week: preferenceForm.day_of_week,
        preferred_start: preferenceForm.preferred_start,
        preferred_end: preferenceForm.preferred_end,
        notes: preferenceForm.notes || undefined
      })
      
      const prefs = await studentSchedulePreferenceDb.getByStudentId(selectedStudent.id)
      setSelectedStudent({ ...selectedStudent, preferences: prefs })
      loadData()
    } catch (error) {
      console.error('Failed to add preference:', error)
      alert('添加失败，请重试')
    }
  }
  
  // 删除学生时段偏好
  const handleDeletePreference = async (prefId: string) => {
    if (!selectedStudent) return
    
    try {
      await studentSchedulePreferenceDb.delete(prefId)
      const prefs = await studentSchedulePreferenceDb.getByStudentId(selectedStudent.id)
      setSelectedStudent({ ...selectedStudent, preferences: prefs })
      loadData()
    } catch (error) {
      console.error('Failed to delete preference:', error)
      alert('删除失败，请重试')
    }
  }
  
  // AI排课
  const handleAISchedule = async () => {
    if (students.length === 0) {
      alert('没有需要排课的学生')
      return
    }
    
    if (teachers.length === 0) {
      alert('没有可用的助教')
      return
    }
    
    if (scheduleDates.length === 0) {
      alert('请先添加排课日期')
      return
    }
    
    try {
      setAiScheduling(true)
      setAiError(null)
      setAiResults([])
      setAiConflicts([])
      setSelectedAiResults(new Set())
      
      const apiUrl = await settingsDb.get('ai_api_url') || 'https://api.deepseek.com/v1'
      const apiKey = await settingsDb.get('ai_api_key')
      const model = await settingsDb.get('ai_model') || 'deepseek-chat'
      
      if (!apiKey) {
        alert('请先在设置页面配置 AI API Key')
        setAiScheduling(false)
        return
      }
      
      const userInput = buildSchedulePromptInput({
        students,
        teachers,
        targetDates: scheduleDates,
        extraInstructions
      })
      
      const response = await sendAIRequest(
        { api_url: apiUrl, api_key: apiKey, model, temperature: 0.7, max_tokens: 4096 },
        AI_SCHEDULE_SYSTEM_PROMPT,
        userInput
      )
      
      const results = parseAIScheduleResponse(response)
      
      if (!results) {
        setAiError('AI 返回的数据格式不正确，请重试')
        return
      }
      
      const { valid, conflicts } = validateScheduleResults(results)
      setAiResults(valid)
      setAiConflicts(conflicts)
      setSelectedAiResults(new Set(valid.filter(r => !r.unmatched).map(r => r.student_id)))
      
    } catch (error) {
      console.error('AI scheduling failed:', error)
      setAiError(`AI 排课失败：${(error as Error).message}`)
    } finally {
      setAiScheduling(false)
    }
  }
  
  const toggleAiResultSelection = (studentId: string) => {
    setSelectedAiResults(prev => {
      const newSet = new Set(prev)
      if (newSet.has(studentId)) {
        newSet.delete(studentId)
      } else {
        newSet.add(studentId)
      }
      return newSet
    })
  }
  
  const handleConfirmAISchedule = async () => {
    const toSave = aiResults.filter(r => selectedAiResults.has(r.student_id) && !r.unmatched)
    
    if (toSave.length === 0) {
      alert('请至少选择一个排课结果')
      return
    }
    
    try {
      setSaving(true)
      
      const results = await scheduledClassDb.batchCreate(
        toSave.map(r => ({
          student_id: r.student_id,
          teacher_id: r.teacher_id,
          class_date: r.date,
          start_time: r.start_time,
          end_time: r.end_time,
          duration_hours: r.duration_hours,
          notes: r.match_reason
        }))
      )
      
      alert(`排课完成：成功 ${results.success} 条，失败 ${results.failed} 条${results.conflicts.length > 0 ? `，冲突 ${results.conflicts.length} 条` : ''}`)
      
      setAiResults([])
      setAiConflicts([])
      setSelectedAiResults(new Set())
      loadData()
      
    } catch (error) {
      console.error('Failed to save AI schedule:', error)
      alert('保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }
  
  // 计算时间到位置
  const getTimePosition = (time: string, dateConfig: ScheduleDateConfig): number => {
    const h = parseInt(time.split(':')[0])
    const startHour = dateConfig.type === 'friday_evening' ? 18 : 8
    return h - startHour
  }
  
  // 获取时间槽
  const getTimeSlots = (dateConfig: ScheduleDateConfig): string[] => {
    if (dateConfig.type === 'friday_evening') {
      return EVENING_SLOTS
    }
    return DAYTIME_SLOTS
  }
  
  // 获取课程在时间轴上的高度
  const getClassHeight = (startTime: string, endTime: string): number => {
    const start = parseInt(startTime.split(':')[0]) + parseInt(startTime.split(':')[1]) / 60
    const end = parseInt(endTime.split(':')[0]) + parseInt(endTime.split(':')[1]) / 60
    return (end - start) * 60
  }
  
  // 构建学员选项
  const studentOptions = students.map(s => ({
    value: s.id,
    label: `${s.name} (${s.grade || '未设年级'})${s.billing ? ` - 剩余${s.billing.remaining_hours}课时` : ''}`
  }))
  
  // 构建助教选项
  const teacherOptions = [
    { value: '', label: '不指定助教' },
    ...teachers.map(t => ({ value: t.id, label: t.name }))
  ]
  
  // 获取未排课的学生
  const unscheduledStudents = useMemo(() => {
    const scheduledStudentIds = new Set(classes.filter(c => c.status === 'scheduled').map(c => c.student_id))
    return students.filter(s => !scheduledStudentIds.has(s.id))
  }, [students, classes])
  
  // 根据老师ID获取名字
  const getTeacherName = (teacherId?: string) => {
    if (!teacherId) return '未指定'
    const teacher = teachers.find(t => t.id === teacherId)
    return teacher?.name || '未知'
  }
  
  // 获取日期显示图标
  const getDateIcon = (type: ScheduleDateConfig['type']) => {
    switch (type) {
      case 'friday_evening':
        return <Moon className="h-4 w-4 text-indigo-500" />
      case 'holiday':
        return <Sun className="h-4 w-4 text-amber-500" />
      default:
        return <Sun className="h-4 w-4 text-orange-500" />
    }
  }
  
  // 获取日期配置
  const getDateConfig = (date: string) => scheduleDates.find(d => d.date === date)
  
  // 处理课程卡片点击
  const handleClassClick = (e: React.MouseEvent, classId: string) => {
    e.stopPropagation()
    if (activeMenu === classId) {
      setActiveMenu(null)
      setMenuPosition(null)
    } else {
      const rect = e.currentTarget.getBoundingClientRect()
      const menuHeight = 160
      const windowHeight = window.innerHeight
      
      const wouldOverflowBottom = rect.bottom + 4 + menuHeight > windowHeight
      
      if (wouldOverflowBottom) {
        setMenuPosition({
          top: rect.top - menuHeight - 4,
          left: Math.min(rect.right - 120, window.innerWidth - 130)
        })
      } else {
        setMenuPosition({
          top: rect.bottom + 4,
          left: Math.min(rect.right - 120, window.innerWidth - 130)
        })
      }
      setActiveMenu(classId)
    }
  }
  
  // 点击其他地方关闭菜单
  useEffect(() => {
    const handleClickOutside = () => {
      if (activeMenu) {
        setActiveMenu(null)
        setMenuPosition(null)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [activeMenu])

  return (
    <div className="h-full flex flex-col">
      {/* 头部 */}
      <header className="h-16 border-b bg-card flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold">排课管理</h1>
          
          <div className="flex bg-muted rounded-lg p-1">
            <button
              onClick={() => setViewMode('week')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                viewMode === 'week' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              周课表
            </button>
            <button
              onClick={() => setViewMode('arrange')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                viewMode === 'arrange' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              排课操作
            </button>
            <button
              onClick={() => setViewMode('manual')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors flex items-center gap-1 ${
                viewMode === 'manual' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Hand className="h-4 w-4" />
              人工排课
            </button>
          </div>
          
          <div className="flex bg-muted rounded-lg p-1">
            <button
              onClick={() => handlePresetChange('weekend_with_friday')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                schedulePreset === 'weekend_with_friday' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              含周五晚
            </button>
            <button
              onClick={() => handlePresetChange('week')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                schedulePreset === 'week' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              一周
            </button>
            <button
              onClick={() => handlePresetChange('custom')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                schedulePreset === 'custom' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              自定义
            </button>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {viewMode === 'week' && (
            <>
              <Button variant="outline" size="icon" onClick={goToPrevWeek}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm min-w-[120px] text-center">
                {scheduleDates.length > 0 ? (
                  scheduleDates.length === 1 
                    ? formatDisplayDate(new Date(scheduleDates[0].date))
                    : `${formatDisplayDate(new Date(scheduleDates[0].date))} - ${formatDisplayDate(new Date(scheduleDates[scheduleDates.length - 1].date))}`
                ) : '请添加日期'}
              </span>
              <Button variant="outline" size="icon" onClick={goToNextWeek}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={goToToday}>
                本周
              </Button>
            </>
          )}
          <Button variant="outline" size="sm" onClick={() => setAddDateDialogOpen(true)}>
            <CalendarPlus className="h-4 w-4 mr-2" />
            添加日期
          </Button>
          <Button onClick={() => handleCreateClass()}>
            <Plus className="h-4 w-4 mr-2" />
            新增排课
          </Button>
        </div>
      </header>
      
      {/* 当前排课日期标签 */}
      {scheduleDates.length > 0 && (
        <div className="border-b bg-muted/30 px-6 py-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground">排课日期：</span>
            {scheduleDates.map((dateConfig) => (
              <button
                key={dateConfig.date}
                onClick={() => handleJumpToManualSchedule(dateConfig.date)}
                className="flex items-center gap-1 px-2 py-1 bg-background rounded-md border text-sm hover:bg-blue-50 hover:border-blue-300 cursor-pointer transition-colors"
                title="点击跳转到人工排课"
              >
                {getDateIcon(dateConfig.type)}
                <span>{dateConfig.label}</span>
                <span className="text-muted-foreground">({formatDisplayDate(new Date(dateConfig.date))})</span>
                {schedulePreset === 'custom' && (
                  <span
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRemoveDate(dateConfig.date)
                    }}
                    className="ml-1 text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
      
      {/* 内容区 */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            加载中...
          </div>
        ) : viewMode === 'manual' ? (
          /* 人工排课视图 */
          <ManualSchedule initialDate={manualScheduleDate || undefined} />
        ) : viewMode === 'week' ? (
          /* 单日课表视图 - 支持翻页切换 */
          <DayScheduleView
            scheduleDates={scheduleDates}
            classes={classes}
            activeMenu={activeMenu}
            onPrevDay={() => setCurrentDateIndex(prev => Math.max(0, prev - 1))}
            onNextDay={() => setCurrentDateIndex(prev => Math.min(scheduleDates.length - 1, prev + 1))}
            currentDateIndex={currentDateIndex}
            setCurrentDateIndex={setCurrentDateIndex}
            onCreateClass={handleCreateClass}
            onClassClick={handleClassClick}
            menuPosition={menuPosition}
            onEditClass={handleEditClass}
            onReschedule={handleOpenReschedule}
            onCancel={handleOpenCancel}
            onDeleteClass={handleDeleteClass}
            getTimeSlots={getTimeSlots}
            getDateIcon={getDateIcon}
          />
        ) : (
          /* 排课操作视图 */
          <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold flex items-center gap-2">
                    <Users className="h-5 w-5" /> 待排课学员
                  </h2>
                  <span className="text-sm text-muted-foreground">共 {unscheduledStudents.length} 人</span>
                </div>
                
                {unscheduledStudents.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">当前日期所有在读学员已排课</p>
                ) : (
                  <div className="space-y-3 max-h-[400px] overflow-auto">
                    {unscheduledStudents.map(student => (
                      <div key={student.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div>
                          <div className="font-medium">{student.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {student.grade} · {student.level === 'weak' ? '基础薄弱' : student.level === 'medium' ? '基础较好' : '非常优秀'}
                            {student.billing && ` · 剩余${student.billing.remaining_hours}课时`}
                          </div>
                          {student.preferences.length > 0 && (
                            <div className="flex gap-1 mt-1 flex-wrap">
                              {student.preferences.map(p => (
                                <span key={p.id} className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">
                                  {DAY_LABELS[p.day_of_week]} {p.preferred_start?.slice(0, 5)}-{p.preferred_end?.slice(0, 5)}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => handleOpenPreferenceDialog(student)}>
                            <Settings className="h-4 w-4 mr-1" /> 时段
                          </Button>
                          <Button size="sm" onClick={() => {
                            // 根据学生偏好生成排课项
                            let schedules: ScheduleItem[] = []
                            
                            if (student.preferences.length > 0) {
                              // 有偏好：为每个偏好创建一个排课项，匹配对应的日期
                              student.preferences.forEach(pref => {
                                // 找到匹配的排课日期（根据星期几）
                                const matchingDate = scheduleDates.find(d => {
                                  const dayOfWeek = getDayOfWeek(d.date)
                                  return dayOfWeek === pref.day_of_week
                                })
                                
                                if (matchingDate) {
                                  schedules.push({
                                    id: generateId(),
                                    date: matchingDate.date,
                                    start_time: pref.preferred_start || '09:00',
                                    end_time: pref.preferred_end || '11:00',
                                    duration_hours: 2
                                  })
                                }
                              })
                            }
                            
                            // 如果没有匹配到任何偏好日期，使用第一个排课日期
                            if (schedules.length === 0) {
                              schedules = [{
                                id: generateId(),
                                date: scheduleDates[0]?.date || formatDate(new Date()),
                                start_time: '09:00',
                                end_time: '11:00',
                                duration_hours: 2
                              }]
                            }
                            
                            setClassForm({
                              student_id: student.id,
                              teacher_id: '',
                              schedules,
                              notes: ''
                            })
                            setClassDialogOpen(true)
                          }}>
                            <Plus className="h-4 w-4 mr-1" /> 排课
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
              
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" /> AI 智能排课
                  </h2>
                </div>
                
                <div className="space-y-4">
                  <div className="p-3 bg-primary/5 rounded-lg text-sm">
                    <p className="text-muted-foreground">
                      AI 将根据学员时段偏好和助教可用时段，自动生成最优排课方案。
                    </p>
                  </div>
                  
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <div className="text-sm font-medium mb-2">排课日期</div>
                    {scheduleDates.length === 0 ? (
                      <p className="text-sm text-muted-foreground">请先添加排课日期</p>
                    ) : (
                      <div className="space-y-1">
                        {scheduleDates.map(d => (
                          <div key={d.date} className="text-sm text-muted-foreground flex items-center gap-2">
                            {getDateIcon(d.type)}
                            <span>{d.label} ({formatDisplayDate(new Date(d.date))})</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">额外说明（可选）</label>
                    <textarea
                      className="w-full min-h-[60px] px-3 py-2 rounded-md border border-input bg-background text-sm resize-none"
                      value={extraInstructions}
                      onChange={e => setExtraInstructions(e.target.value)}
                      placeholder="例如：优先安排初二学生..."
                    />
                  </div>
                  
                  <Button className="w-full" onClick={handleAISchedule} disabled={aiScheduling || unscheduledStudents.length === 0 || scheduleDates.length === 0}>
                    {aiScheduling ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> AI 正在排课...</>
                    ) : (
                      <><Sparkles className="h-4 w-4 mr-2" /> 开始 AI 排课</>
                    )}
                  </Button>
                  
                  {aiError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      {aiError}
                    </div>
                  )}
                  
                  {aiResults.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium">排课结果</h3>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => setSelectedAiResults(new Set(aiResults.filter(r => !r.unmatched).map(r => r.student_id)))}>全选</Button>
                          <Button variant="outline" size="sm" onClick={() => setSelectedAiResults(new Set())}>清空</Button>
                        </div>
                      </div>
                      
                      {aiConflicts.length > 0 && (
                        <div className="p-2 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700">
                          ⚠️ {aiConflicts.length} 个结果存在时段冲突，已自动排除
                        </div>
                      )}
                      
                      <div className="space-y-2 max-h-[300px] overflow-auto">
                        {aiResults.map((result, index) => {
                          const student = students.find(s => s.id === result.student_id)
                          const isSelected = selectedAiResults.has(result.student_id)
                          
                          return (
                            <div
                              key={index}
                              className={`p-3 rounded-lg border ${
                                result.unmatched ? 'bg-red-50 border-red-200' : isSelected ? 'bg-primary/10 border-primary' : 'bg-muted/50 border-transparent'
                              } ${!result.unmatched ? 'cursor-pointer' : ''}`}
                              onClick={() => !result.unmatched && toggleAiResultSelection(result.student_id)}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  {!result.unmatched && (
                                    <div className={`w-4 h-4 rounded border flex items-center justify-center ${isSelected ? 'bg-primary border-primary' : 'border-muted-foreground'}`}>
                                      {isSelected && <Check className="h-3 w-3 text-white" />}
                                    </div>
                                  )}
                                  <span className="font-medium">{student?.name || '未知学员'}</span>
                                </div>
                                <span className={`text-xs px-2 py-0.5 rounded ${result.unmatched ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                  {result.unmatched ? '无法匹配' : '已匹配'}
                                </span>
                              </div>
                              {!result.unmatched && (
                                <div className="mt-1 text-sm text-muted-foreground">
                                  <div>{result.date} · {result.start_time.slice(0, 5)}-{result.end_time.slice(0, 5)}</div>
                                  <div>助教：{getTeacherName(result.teacher_id)} · {result.duration_hours}小时</div>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                      
                      <Button className="w-full" onClick={handleConfirmAISchedule} disabled={selectedAiResults.size === 0 || saving}>
                        {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> 保存中...</> : <><Check className="h-4 w-4 mr-2" /> 确认保存 {selectedAiResults.size} 个排课</>}
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
              
              <Card className="p-6 lg:col-span-2">
                <h2 className="font-semibold flex items-center gap-2 mb-4">
                  <BookOpen className="h-5 w-5" /> 助教可用时段
                </h2>
                
                {teachers.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">暂无在职助教</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {teachers.map(teacher => (
                      <div key={teacher.id} className="p-3 bg-muted/50 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">{teacher.name}</span>
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            teacher.training_stage === 'formal' ? 'bg-green-100 text-green-700' :
                            teacher.training_stage === 'intern' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {teacher.training_stage === 'formal' ? '正式' : teacher.training_stage === 'intern' ? '实习' : '实训'}
                          </span>
                        </div>
                        {teacher.availabilities.length === 0 ? (
                          <p className="text-xs text-muted-foreground">未设置可用时段</p>
                        ) : (
                          <div className="space-y-1">
                            {teacher.availabilities.map(a => (
                              <div key={a.id} className="text-xs text-muted-foreground">
                                {DAY_LABELS[a.day_of_week]} {a.start_time?.slice(0, 5)}-{a.end_time?.slice(0, 5)}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </div>
        )}
      </div>
      
      {/* 添加日期对话框 */}
      <Dialog open={addDateDialogOpen} onOpenChange={setAddDateDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>添加排课日期</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">日期 *</label>
              <DateInput value={newDateForm.date} onChange={value => setNewDateForm(prev => ({ ...prev, date: value }))} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">日期类型</label>
              <Select
                value={newDateForm.type}
                onChange={e => setNewDateForm(prev => ({ ...prev, type: e.target.value as ScheduleDateConfig['type'] }))}
                options={[
                  { value: 'regular_weekend', label: '常规周末' },
                  { value: 'friday_evening', label: '周五晚上' },
                  { value: 'holiday', label: '假期' },
                  { value: 'custom', label: '自定义' }
                ]}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDateDialogOpen(false)}>取消</Button>
            <Button onClick={handleAddCustomDate}>添加</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* 新增/编辑课程对话框 */}
      <Dialog open={classDialogOpen} onOpenChange={setClassDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingClass ? '编辑课程' : '新增排课'}</DialogTitle></DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">学员 *</label>
                <Select
                  value={classForm.student_id}
                  onChange={e => setClassForm(prev => ({ ...prev, student_id: e.target.value }))}
                  options={studentOptions}
                  placeholder="选择学员"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">助教</label>
                <Select
                  value={classForm.teacher_id}
                  onChange={e => setClassForm(prev => ({ ...prev, teacher_id: e.target.value }))}
                  options={teacherOptions}
                  placeholder="选择助教（可选）"
                />
              </div>
            </div>
            
            {/* 排课项列表 */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">排课时间</label>
                {!editingClass && (
                  <Button variant="outline" size="sm" onClick={handleAddScheduleItem}>
                    <Plus className="h-4 w-4 mr-1" /> 添加时段
                  </Button>
                )}
              </div>
              
              {classForm.schedules.map((schedule, index) => {
                const dateConfig = getDateConfig(schedule.date)
                return (
                  <div key={schedule.id} className="p-3 bg-muted/50 rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">排课 {index + 1}</span>
                      {classForm.schedules.length > 1 && (
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleRemoveScheduleItem(schedule.id)}>
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">日期</label>
                        <Select
                          value={schedule.date}
                          onChange={e => handleUpdateScheduleItem(schedule.id, 'date', e.target.value)}
                          options={scheduleDates.map(d => ({ value: d.date, label: `${d.label} (${formatDisplayDate(new Date(d.date))})` }))}
                          placeholder="选择日期"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">开始时间</label>
                        <Input
                          type="time"
                          value={schedule.start_time}
                          onChange={e => handleUpdateScheduleItem(schedule.id, 'start_time', e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">结束时间</label>
                        <Input
                          type="time"
                          value={schedule.end_time}
                          onChange={e => handleUpdateScheduleItem(schedule.id, 'end_time', e.target.value)}
                        />
                      </div>
                    </div>
                    
                    {dateConfig && (
                      <div className="text-xs text-muted-foreground">
                        {dateConfig.label} · 时长 {schedule.duration_hours} 小时
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">备注</label>
              <Input value={classForm.notes} onChange={e => setClassForm(prev => ({ ...prev, notes: e.target.value }))} placeholder="可选备注" />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setClassDialogOpen(false)}>取消</Button>
            <Button onClick={handleSaveClass} disabled={saving}>{saving ? '保存中...' : '保存'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* 调课对话框 */}
      <Dialog open={rescheduleDialogOpen} onOpenChange={setRescheduleDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>调课</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">将课程调至新的时间</p>
            <div className="space-y-2">
              <label className="text-sm font-medium">新日期</label>
              <DateInput value={rescheduleForm.class_date} onChange={value => setRescheduleForm(prev => ({ ...prev, class_date: value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">开始时间</label>
                <Input type="time" value={rescheduleForm.start_time} onChange={e => setRescheduleForm(prev => ({ ...prev, start_time: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">结束时间</label>
                <Input type="time" value={rescheduleForm.end_time} onChange={e => setRescheduleForm(prev => ({ ...prev, end_time: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRescheduleDialogOpen(false)}>取消</Button>
            <Button onClick={handleReschedule}>确认调课</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* 取消对话框 */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>取消课程</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">确定要取消这节课程吗？</p>
            <div className="space-y-2">
              <label className="text-sm font-medium">取消原因（可选）</label>
              <Input value={cancelReason} onChange={e => setCancelReason(e.target.value)} placeholder="请输入取消原因" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>返回</Button>
            <Button variant="destructive" onClick={handleCancel}>确认取消</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* 学生时段偏好对话框 */}
      <Dialog open={preferenceDialogOpen} onOpenChange={setPreferenceDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{selectedStudent?.name} 的时段偏好</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            {selectedStudent && selectedStudent.preferences.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium">已设置的偏好</label>
                <div className="space-y-2">
                  {selectedStudent.preferences.map(p => (
                    <div key={p.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                      <span className="text-sm">{DAY_LABELS[p.day_of_week]} {p.preferred_start?.slice(0, 5)}-{p.preferred_end?.slice(0, 5)}</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleDeletePreference(p.id)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div className="space-y-2">
              <label className="text-sm font-medium">添加新偏好</label>
              <div className="space-y-2">
                <Select
                  value={preferenceForm.day_of_week}
                  onChange={e => setPreferenceForm(prev => ({ ...prev, day_of_week: e.target.value as DayOfWeek }))}
                  options={[
                    { value: 'monday', label: '周一' }, { value: 'tuesday', label: '周二' },
                    { value: 'wednesday', label: '周三' }, { value: 'thursday', label: '周四' },
                    { value: 'friday', label: '周五' }, { value: 'saturday', label: '周六' },
                    { value: 'sunday', label: '周日' }
                  ]}
                />
                <div className="grid grid-cols-2 gap-2">
                  <Input 
                    type="time" 
                    value={preferenceForm.preferred_start} 
                    onChange={e => {
                      const startTime = e.target.value
                      // 自动计算结束时间为开始时间+2小时
                      const [hours, minutes] = startTime.split(':').map(Number)
                      const endHours = hours + 2
                      const endTime = `${endHours.toString().padStart(2, '0')}:${(minutes || 0).toString().padStart(2, '0')}`
                      setPreferenceForm(prev => ({ 
                        ...prev, 
                        preferred_start: startTime,
                        preferred_end: endTime
                      }))
                    }} 
                    placeholder="开始时间" 
                  />
                  <Input 
                    type="time" 
                    value={preferenceForm.preferred_end} 
                    onChange={e => setPreferenceForm(prev => ({ ...prev, preferred_end: e.target.value }))} 
                    placeholder="结束时间" 
                  />
                </div>
              </div>
              <Button size="sm" onClick={handleAddPreference}><Plus className="h-4 w-4 mr-1" /> 添加</Button>
            </div>
          </div>
          <DialogFooter><Button onClick={() => setPreferenceDialogOpen(false)}>完成</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}