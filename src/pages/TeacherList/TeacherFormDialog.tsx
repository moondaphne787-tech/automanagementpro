import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import type { Teacher, TeacherStatus, OralLevel, TrainingStage, TeacherType } from '@/types'
import { TRAINING_STAGE_LABELS, TEACHER_TYPE_LABELS, SUITABLE_GRADE_OPTIONS } from '@/types'
import { teacherDb } from '@/db'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { DateInput } from '@/components/ui/date-input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'

const LEVEL_OPTIONS = ['weak', 'medium', 'advanced']

const TRAINING_STAGE_OPTIONS: { value: TrainingStage; label: string }[] = [
  { value: 'probation', label: '实训期' },
  { value: 'intern', label: '实习期' },
  { value: 'formal', label: '正式助教' }
]

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
  suitable_grades: string[]
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
  suitable_grades: [],
  suitable_levels: [],
  training_stage: 'probation',
  teacher_types: [],
  notes: ''
}

interface TeacherFormDialogProps {
  open: boolean
  editingTeacher: Teacher | null
  onClose: () => void
  onSuccess: () => void
}

export function TeacherFormDialog({ open, editingTeacher, onClose, onSuccess }: TeacherFormDialogProps) {
  const [formData, setFormData] = useState<TeacherFormData>(initialFormData)
  const [saving, setSaving] = useState(false)
  
  // 当编辑教师变化时，更新表单数据
  useEffect(() => {
    if (editingTeacher) {
      setFormData({
        name: editingTeacher.name,
        phone: editingTeacher.phone || '',
        university: editingTeacher.university || '',
        major: editingTeacher.major || '',
        enroll_date: editingTeacher.enroll_date || '',
        status: editingTeacher.status,
        vocab_level: editingTeacher.vocab_level || '',
        oral_level: editingTeacher.oral_level,
        teaching_style: editingTeacher.teaching_style || '',
        suitable_grades: editingTeacher.suitable_grades ? editingTeacher.suitable_grades.split(',').map(s => s.trim()) : [],
        suitable_levels: editingTeacher.suitable_levels || [],
        training_stage: editingTeacher.training_stage || 'probation',
        teacher_types: editingTeacher.teacher_types || [],
        notes: editingTeacher.notes || ''
      })
    } else {
      setFormData(initialFormData)
    }
  }, [editingTeacher, open])
  
  // 切换适合程度
  const toggleLevel = (level: string) => {
    setFormData(prev => ({
      ...prev,
      suitable_levels: prev.suitable_levels.includes(level)
        ? prev.suitable_levels.filter(l => l !== level)
        : [...prev.suitable_levels, level]
    }))
  }
  
  // 切换适合年级范围
  const toggleSuitableGrade = (grade: string) => {
    setFormData(prev => ({
      ...prev,
      suitable_grades: prev.suitable_grades.includes(grade)
        ? prev.suitable_grades.filter(g => g !== grade)
        : [...prev.suitable_grades, grade]
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
  
  // 保存助教
  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('请输入助教姓名')
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
          suitable_grades: formData.suitable_grades.length > 0 ? formData.suitable_grades.join(',') : undefined,
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
          suitable_grades: formData.suitable_grades.length > 0 ? formData.suitable_grades.join(',') : undefined,
          suitable_levels: formData.suitable_levels.length > 0 ? formData.suitable_levels : undefined,
          training_stage: formData.training_stage,
          teacher_types: formData.teacher_types.length > 0 ? formData.teacher_types : undefined,
          notes: formData.notes || undefined
        })
      }
      
      onClose()
      onSuccess()
    } catch (error) {
      console.error('Failed to save teacher:', error)
      toast.error('保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
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
            <div className="flex flex-wrap gap-2">
              {SUITABLE_GRADE_OPTIONS.map(option => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => toggleSuitableGrade(option.value)}
                  className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                    formData.suitable_grades.includes(option.value)
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              可多选，例如选择"小学+初中"表示该助教适合教小学和初中学生
            </p>
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
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? '保存中...' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}