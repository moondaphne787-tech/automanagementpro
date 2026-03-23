import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Plus, Pencil, Trash2, Phone, GraduationCap, Search, Clock, Award, AlertTriangle, Check, X } from 'lucide-react'
import { teacherDb } from '@/db'
import type { Teacher, TeacherStatus, OralLevel, TrainingStage, TeacherType } from '@/types'
import { TRAINING_STAGE_LABELS, TEACHER_TYPE_LABELS } from '@/types'
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

const ORAL_LEVEL_LABELS: Record<OralLevel, string> = {
  basic: '基础',
  intermediate: '中级',
  advanced: '高级'
}

const STATUS_LABELS: Record<TeacherStatus, string> = {
  active: '在职',
  inactive: '离职'
}

const LEVEL_OPTIONS = ['weak', 'medium', 'advanced']

const STATUS_SELECT_OPTIONS = [
  { value: 'all', label: '全部状态' },
  { value: 'active', label: '在职' },
  { value: 'inactive', label: '离职' }
]

const TRAINING_STAGE_OPTIONS: { value: TrainingStage; label: string }[] = [
  { value: 'probation', label: '实训期' },
  { value: 'intern', label: '实习期' },
  { value: 'formal', label: '正式助教' }
]

// 升级阈值配置
const UPGRADE_THRESHOLDS = {
  probation: { hours: 2, nextStage: 'intern' as TrainingStage },
  intern: { hours: 10, nextStage: 'formal' as TrainingStage }
}

interface TeacherFormData {
  name: string
  phone: string
  university: string
  major: string
  enroll_date: string
  status: TeacherStatus
  vocab_level: string
  oral_level: OralLevel
  teaching_style: string
  suitable_grades: string
  suitable_levels: string[]
  training_stage: TrainingStage
  teacher_types: TeacherType[]
  notes: string
}

const initialFormData: TeacherFormData = {
  name: '',
  phone: '',
  university: '',
  major: '',
  enroll_date: '',
  status: 'active',
  vocab_level: '',
  oral_level: 'intermediate',
  teaching_style: '',
  suitable_grades: '',
  suitable_levels: [],
  training_stage: 'probation',
  teacher_types: [],
  notes: ''
}

interface UpgradeReminder {
  teacher: Teacher
  newStage: TrainingStage
  message: string
  currentHours: number
  threshold: number
}

export function TeacherList() {
  const navigate = useNavigate()
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<TeacherStatus | 'all'>('all')
  
  // 对话框状态
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null)
  const [formData, setFormData] = useState<TeacherFormData>(initialFormData)
  const [saving, setSaving] = useState(false)
  
  // 删除确认对话框
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingTeacher, setDeletingTeacher] = useState<Teacher | null>(null)
  
  // 升级提醒
  const [upgradeReminders, setUpgradeReminders] = useState<UpgradeReminder[]>([])
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false)
  const [currentUpgradeIndex, setCurrentUpgradeIndex] = useState(0)
  
  // 加载助教列表
  const loadTeachers = async () => {
    try {
      setLoading(true)
      const data = await teacherDb.getAll()
      setTeachers(data)
      
      // 检查升级提醒
      checkUpgradeReminders(data)
    } catch (error) {
      console.error('Failed to load teachers:', error)
    } finally {
      setLoading(false)
    }
  }
  
  // 检查升级提醒
  const checkUpgradeReminders = (teacherList: Teacher[]) => {
    const reminders: UpgradeReminder[] = []
    
    for (const teacher of teacherList) {
      if (teacher.status !== 'active') continue
      
      const hours = teacher.total_teaching_hours || 0
      const stage = teacher.training_stage || 'probation'
      
      // 实训期满2小时 → 提醒升级实习期
      if (stage === 'probation' && hours >= UPGRADE_THRESHOLDS.probation.hours) {
        reminders.push({
          teacher,
          newStage: 'intern',
          message: `${teacher.name} 已累计教学 ${hours} 小时，建议从实训期升级为实习期`,
          currentHours: hours,
          threshold: UPGRADE_THRESHOLDS.probation.hours
        })
      }
      
      // 实习期满10小时 → 提醒升级正式助教
      if (stage === 'intern' && hours >= UPGRADE_THRESHOLDS.intern.hours) {
        reminders.push({
          teacher,
          newStage: 'formal',
          message: `${teacher.name} 已累计教学 ${hours} 小时，建议从实习期升级为正式助教`,
          currentHours: hours,
          threshold: UPGRADE_THRESHOLDS.intern.hours
        })
      }
    }
    
    setUpgradeReminders(reminders)
  }
  
  useEffect(() => {
    loadTeachers()
  }, [])
  
  // 筛选后的列表
  const filteredTeachers = teachers.filter(teacher => {
    const matchesSearch = teacher.name.includes(search) || 
      (teacher.phone && teacher.phone.includes(search)) ||
      (teacher.university && teacher.university.includes(search))
    const matchesStatus = statusFilter === 'all' || teacher.status === statusFilter
    return matchesSearch && matchesStatus
  })
  
  // 打开新建对话框
  const handleCreate = () => {
    setEditingTeacher(null)
    setFormData(initialFormData)
    setDialogOpen(true)
  }
  
  // 打开编辑对话框
  const handleEdit = (teacher: Teacher) => {
    setEditingTeacher(teacher)
    setFormData({
      name: teacher.name,
      phone: teacher.phone || '',
      university: teacher.university || '',
      major: teacher.major || '',
      enroll_date: teacher.enroll_date || '',
      status: teacher.status,
      vocab_level: teacher.vocab_level || '',
      oral_level: teacher.oral_level,
      teaching_style: teacher.teaching_style || '',
      suitable_grades: teacher.suitable_grades || '',
      suitable_levels: teacher.suitable_levels || [],
      training_stage: teacher.training_stage || 'probation',
      teacher_types: teacher.teacher_types || [],
      notes: teacher.notes || ''
    })
    setDialogOpen(true)
  }
  
  // 保存助教
  const handleSave = async () => {
    if (!formData.name.trim()) {
      alert('请输入助教姓名')
      return
    }
    
    try {
      setSaving(true)
      
      if (editingTeacher) {
        await teacherDb.update(editingTeacher.id, {
          name: formData.name,
          phone: formData.phone || undefined,
          university: formData.university || undefined,
          major: formData.major || undefined,
          enroll_date: formData.enroll_date || undefined,
          status: formData.status,
          vocab_level: formData.vocab_level || undefined,
          oral_level: formData.oral_level,
          teaching_style: formData.teaching_style || undefined,
          suitable_grades: formData.suitable_grades || undefined,
          suitable_levels: formData.suitable_levels.length > 0 ? formData.suitable_levels : undefined,
          training_stage: formData.training_stage,
          teacher_types: formData.teacher_types.length > 0 ? formData.teacher_types : undefined,
          notes: formData.notes || undefined
        })
      } else {
        await teacherDb.create({
          name: formData.name,
          phone: formData.phone || undefined,
          university: formData.university || undefined,
          major: formData.major || undefined,
          enroll_date: formData.enroll_date || undefined,
          status: formData.status,
          vocab_level: formData.vocab_level || undefined,
          oral_level: formData.oral_level,
          teaching_style: formData.teaching_style || undefined,
          suitable_grades: formData.suitable_grades || undefined,
          suitable_levels: formData.suitable_levels.length > 0 ? formData.suitable_levels : undefined,
          training_stage: formData.training_stage,
          teacher_types: formData.teacher_types.length > 0 ? formData.teacher_types : undefined,
          notes: formData.notes || undefined
        })
      }
      
      setDialogOpen(false)
      loadTeachers()
    } catch (error) {
      console.error('Failed to save teacher:', error)
      alert('保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }
  
  // 删除助教
  const handleDelete = async () => {
    if (!deletingTeacher) return
    
    try {
      await teacherDb.delete(deletingTeacher.id)
      setDeleteDialogOpen(false)
      setDeletingTeacher(null)
      loadTeachers()
    } catch (error) {
      console.error('Failed to delete teacher:', error)
      alert('删除失败，请重试')
    }
  }
  
  // 切换适合程度
  const toggleLevel = (level: string) => {
    setFormData(prev => ({
      ...prev,
      suitable_levels: prev.suitable_levels.includes(level)
        ? prev.suitable_levels.filter(l => l !== level)
        : [...prev.suitable_levels, level]
    }))
  }
  
  // 切换助教类型
  const toggleTeacherType = (type: TeacherType) => {
    setFormData(prev => ({
      ...prev,
      teacher_types: prev.teacher_types.includes(type)
        ? prev.teacher_types.filter(t => t !== type)
        : [...prev.teacher_types, type]
    }))
  }
  
  // 处理升级
  const handleUpgrade = async (reminder: UpgradeReminder) => {
    try {
      await teacherDb.update(reminder.teacher.id, {
        training_stage: reminder.newStage
      })
      
      // 从提醒列表中移除
      setUpgradeReminders(prev => prev.filter(r => r.teacher.id !== reminder.teacher.id))
      loadTeachers()
    } catch (error) {
      console.error('Failed to upgrade teacher:', error)
      alert('升级失败，请重试')
    }
  }
  
  // 跳过当前升级提醒
  const handleSkipUpgrade = () => {
    if (upgradeReminders.length === 0) return
    
    // 移除当前提醒
    const newReminders = upgradeReminders.slice(1)
    setUpgradeReminders(newReminders)
    setCurrentUpgradeIndex(0)
  }
  
  // 获取培训阶段颜色
  const getTrainingStageColor = (stage: TrainingStage) => {
    switch (stage) {
      case 'probation': return 'bg-yellow-100 text-yellow-700'
      case 'intern': return 'bg-blue-100 text-blue-700'
      case 'formal': return 'bg-green-100 text-green-700'
    }
  }
  
  // 检查是否有升级提醒需要显示
  const currentReminder = upgradeReminders[currentUpgradeIndex]
  
  return (
    <div className="h-full flex flex-col">
      {/* 升级提醒横幅 */}
      {currentReminder && !upgradeDialogOpen && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-orange-50 border-b border-orange-200 px-6 py-3"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              <span className="text-sm text-orange-800">{currentReminder.message}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSkipUpgrade}
              >
                稍后处理
              </Button>
              <Button
                size="sm"
                onClick={() => handleUpgrade(currentReminder)}
              >
                <Award className="h-4 w-4 mr-1" />
                确认升级
              </Button>
            </div>
          </div>
        </motion.div>
      )}
      
      {/* 头部 */}
      <header className="h-16 border-b bg-card flex items-center justify-between px-6">
        <h1 className="text-lg font-semibold">助教管理</h1>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          新增助教
        </Button>
      </header>
      
      {/* 筛选栏 */}
      <div className="p-4 border-b bg-card/50 flex gap-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索姓名/电话/院校"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as TeacherStatus | 'all')}
          options={STATUS_SELECT_OPTIONS}
          className="w-32"
        />
      </div>
      
      {/* 列表 */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="text-center text-muted-foreground py-12">加载中...</div>
        ) : filteredTeachers.length === 0 ? (
          <div className="text-center text-muted-foreground py-12">
            {search || statusFilter !== 'all' ? '没有找到匹配的助教' : '暂无助教，点击上方按钮新增'}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTeachers.map((teacher, index) => {
              // 检查是否需要升级提醒
              const needsUpgrade = upgradeReminders.some(r => r.teacher.id === teacher.id)
              
              return (
                <motion.div
                  key={teacher.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card 
                    className={`p-4 hover:shadow-md transition-shadow cursor-pointer ${
                      needsUpgrade ? 'ring-2 ring-orange-300' : ''
                    }`}
                    onClick={() => navigate(`/teachers/${teacher.id}`)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <GraduationCap className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <div className="font-medium flex items-center gap-2">
                            {teacher.name}
                            {needsUpgrade && (
                              <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" title="需要升级" />
                            )}
                          </div>
                          <div className={`text-xs ${teacher.status === 'active' ? 'text-green-600' : 'text-muted-foreground'}`}>
                            {STATUS_LABELS[teacher.status]}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={e => {
                            e.stopPropagation()
                            handleEdit(teacher)
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={e => {
                            e.stopPropagation()
                            setDeletingTeacher(teacher)
                            setDeleteDialogOpen(true)
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    
                    <div className="space-y-2 text-sm text-muted-foreground">
                      {teacher.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4" />
                          <span>{teacher.phone}</span>
                        </div>
                      )}
                      {teacher.university && (
                        <div className="flex items-center gap-2">
                          <GraduationCap className="h-4 w-4" />
                          <span>{teacher.university}{teacher.major ? ` · ${teacher.major}` : ''}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        <span>累计教学: <strong className="text-foreground">{teacher.total_teaching_hours || 0}</strong> 小时</span>
                        {/* 升级进度条 */}
                        {teacher.training_stage !== 'formal' && (
                          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden ml-2">
                            <div 
                              className={`h-full transition-all ${
                                (teacher.training_stage === 'probation' && (teacher.total_teaching_hours || 0) >= 2) ||
                                (teacher.training_stage === 'intern' && (teacher.total_teaching_hours || 0) >= 10)
                                  ? 'bg-green-500' : 'bg-primary'
                              }`}
                              style={{ 
                                width: `${Math.min(
                                  ((teacher.total_teaching_hours || 0) / 
                                    (teacher.training_stage === 'probation' ? 2 : 10)) * 100, 
                                  100
                                )}%` 
                              }}
                            />
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${getTrainingStageColor(teacher.training_stage || 'probation')}`}>
                          {TRAINING_STAGE_LABELS[teacher.training_stage || 'probation']}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs">
                          口语: {ORAL_LEVEL_LABELS[teacher.oral_level]}
                        </span>
                        {teacher.teacher_types && teacher.teacher_types.length > 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-xs">
                            {teacher.teacher_types.map(t => TEACHER_TYPE_LABELS[t]).join('、')}
                          </span>
                        )}
                      </div>
                      {teacher.suitable_levels && teacher.suitable_levels.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          <span className="text-xs">适合:</span>
                          {teacher.suitable_levels.map(level => (
                            <span key={level} className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 text-xs">
                              {level === 'weak' ? '基础薄弱' : level === 'medium' ? '基础较好' : '非常优秀'}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </Card>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>
      
      {/* 新建/编辑对话框 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTeacher ? '编辑助教' : '新增助教'}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">姓名 *</label>
                <Input
                  value={formData.name}
                  onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="请输入姓名"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">联系电话</label>
                <Input
                  value={formData.phone}
                  onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="请输入电话"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">就读院校</label>
                <Input
                  value={formData.university}
                  onChange={e => setFormData(prev => ({ ...prev, university: e.target.value }))}
                  placeholder="请输入院校"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">专业</label>
                <Input
                  value={formData.major}
                  onChange={e => setFormData(prev => ({ ...prev, major: e.target.value }))}
                  placeholder="请输入专业"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">入职日期</label>
                <DateInput
                  value={formData.enroll_date}
                  onChange={value => setFormData(prev => ({ ...prev, enroll_date: value }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">状态</label>
                <Select
                  value={formData.status}
                  onChange={e => setFormData(prev => ({ ...prev, status: e.target.value as TeacherStatus }))}
                  options={[
                    { value: 'active', label: '在职' },
                    { value: 'inactive', label: '离职' }
                  ]}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">词汇量水平</label>
                <Input
                  value={formData.vocab_level}
                  onChange={e => setFormData(prev => ({ ...prev, vocab_level: e.target.value }))}
                  placeholder="如：大学英语六级"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">口语水平</label>
                <Select
                  value={formData.oral_level}
                  onChange={e => setFormData(prev => ({ ...prev, oral_level: e.target.value as OralLevel }))}
                  options={[
                    { value: 'basic', label: '基础' },
                    { value: 'intermediate', label: '中级' },
                    { value: 'advanced', label: '高级' }
                  ]}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">培训阶段</label>
                <Select
                  value={formData.training_stage}
                  onChange={e => setFormData(prev => ({ ...prev, training_stage: e.target.value as TrainingStage }))}
                  options={TRAINING_STAGE_OPTIONS}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">适合年级范围</label>
                <Input
                  value={formData.suitable_grades}
                  onChange={e => setFormData(prev => ({ ...prev, suitable_grades: e.target.value }))}
                  placeholder="如：小学、初中"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">助教类型</label>
              <div className="flex gap-2">
                {(['regular', 'vacation'] as TeacherType[]).map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => toggleTeacherType(type)}
                    className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                      formData.teacher_types.includes(type)
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    {TEACHER_TYPE_LABELS[type]}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">适合学生程度</label>
              <div className="flex gap-2">
                {LEVEL_OPTIONS.map(level => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => toggleLevel(level)}
                    className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                      formData.suitable_levels.includes(level)
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    {level === 'weak' ? '基础薄弱' : level === 'medium' ? '基础较好' : '非常优秀'}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">教学风格</label>
              <Input
                value={formData.teaching_style}
                onChange={e => setFormData(prev => ({ ...prev, teaching_style: e.target.value }))}
                placeholder="如：耐心细致、善于引导"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">备注</label>
              <textarea
                className="w-full min-h-[80px] px-3 py-2 rounded-md border border-input bg-background text-sm resize-none"
                value={formData.notes}
                onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="其他备注信息"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* 删除确认对话框 */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
          </DialogHeader>
          <p className="py-4">
            确定要删除助教 <strong>{deletingTeacher?.name}</strong> 吗？此操作不可撤销。
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>取消</Button>
            <Button variant="destructive" onClick={handleDelete}>删除</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}