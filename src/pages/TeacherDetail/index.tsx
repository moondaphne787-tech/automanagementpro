import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { ArrowLeft, Phone, GraduationCap, Calendar, Clock, Award, Edit, AlertTriangle } from 'lucide-react'
import { teacherDb, teacherAvailabilityDb, scheduledClassDb } from '@/db'
import type { Teacher, TeacherAvailability, ScheduledClass, TrainingStage, TeacherType } from '@/types'
import { TRAINING_STAGE_LABELS, TEACHER_TYPE_LABELS, SUITABLE_GRADE_OPTIONS, TEACHER_UPGRADE_THRESHOLDS } from '@/types'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { AvailabilitySection } from './AvailabilitySection'
import { UpcomingClassesSection } from './UpcomingClassesSection'

const TRAINING_STAGE_OPTIONS: { value: TrainingStage; label: string }[] = [
  { value: 'probation', label: '实训期' },
  { value: 'intern', label: '实习期' },
  { value: 'formal', label: '正式助教' }
]

export function TeacherDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  
  const [teacher, setTeacher] = useState<Teacher | null>(null)
  const [availabilities, setAvailabilities] = useState<TeacherAvailability[]>([])
  const [scheduledClasses, setScheduledClasses] = useState<ScheduledClass[]>([])
  const [loading, setLoading] = useState(true)
  
  // 编辑对话框
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editForm, setEditForm] = useState({
    training_stage: 'probation' as TrainingStage,
    teacher_types: [] as TeacherType[]
  })
  const [saving, setSaving] = useState(false)
  
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
      toast.success('助教信息已更新')
    } catch (error) {
      console.error('Failed to update teacher:', error)
      toast.error('更新失败，请重试')
    } finally {
      setSaving(false)
    }
  }
  
  // 切换助教类型
  const toggleTeacherType = (type: TeacherType) => {
    setEditForm(prev => ({
      ...prev,
      teacher_types: prev.teacher_types.includes(type)
        ? prev.teacher_types.filter(t => t !== type)
        : [...prev.teacher_types, type]
    }))
  }
  
  // 获取培训阶段颜色
  const getTrainingStageColor = (stage: TrainingStage) => {
    switch (stage) {
      case 'probation': return 'bg-yellow-100 text-yellow-700 border-yellow-200'
      case 'intern': return 'bg-blue-100 text-blue-700 border-blue-200'
      case 'formal': return 'bg-green-100 text-green-700 border-green-200'
    }
  }
  
  // 计算升级进度
  const upgradeProgress = useMemo(() => {
    if (!teacher) return null
    
    const stage = teacher.training_stage || 'probation'
    if (stage === 'formal') return null
    
    const hours = teacher.total_teaching_hours || 0
    const threshold = TEACHER_UPGRADE_THRESHOLDS[stage]
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
  }, [teacher])
  
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
                <div className="flex flex-wrap gap-1 mt-1">
                  {teacher.suitable_grades 
                    ? teacher.suitable_grades.split(',').map(g => {
                        const trimmed = g.trim()
                        const option = SUITABLE_GRADE_OPTIONS.find(o => o.value === trimmed)
                        return (
                          <span key={trimmed} className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs">
                            {option?.label || trimmed}
                          </span>
                        )
                      })
                    : <span className="text-muted-foreground">未设置</span>
                  }
                </div>
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
          <AvailabilitySection 
            teacherId={id!}
            availabilities={availabilities}
            onDataReload={loadData}
          />
          
          {/* 近期排课 */}
          <UpcomingClassesSection scheduledClasses={scheduledClasses} />
        </div>
      </div>
      
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