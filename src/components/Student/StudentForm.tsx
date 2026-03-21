import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { useAppStore } from '@/store/appStore'
import { GRADE_OPTIONS, LEVEL_LABELS, STUDENT_TYPE_LABELS } from '@/types'
import type { Student, StudentType, StudentStatus, LevelType } from '@/types'

interface StudentFormProps {
  student?: Student
  onSubmit: (data: Omit<Student, 'id' | 'created_at' | 'updated_at'>) => Promise<void>
  onCancel: () => void
}

const typeOptions = Object.entries(STUDENT_TYPE_LABELS).map(([value, label]) => ({
  value,
  label
}))

const statusOptions = [
  { value: 'active', label: '在读' },
  { value: 'paused', label: '暂停' },
  { value: 'graduated', label: '结课' },
]

const levelOptions = Object.entries(LEVEL_LABELS).map(([value, label]) => ({
  value,
  label
}))

const gradeOptions = GRADE_OPTIONS.map(g => ({ value: g, label: g }))

export function StudentForm({ student, onSubmit, onCancel }: StudentFormProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    student_no: student?.student_no || '',
    name: student?.name || '',
    school: student?.school || '',
    grade: student?.grade || '',
    account: student?.account || '',
    enroll_date: student?.enroll_date || '',
    student_type: (student?.student_type || 'formal') as StudentType,
    status: (student?.status || 'active') as StudentStatus,
    level: (student?.level || 'medium') as LevelType,
    initial_score: student?.initial_score?.toString() || '',
    initial_vocab: student?.initial_vocab?.toString() || '',
    phonics_progress: student?.phonics_progress || '',
    phonics_completed: student?.phonics_completed || false,
    ipa_completed: student?.ipa_completed || false,
    notes: student?.notes || '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await onSubmit({
        student_no: formData.student_no || null,
        name: formData.name,
        school: formData.school || null,
        grade: formData.grade || null,
        account: formData.account || null,
        enroll_date: formData.enroll_date || null,
        student_type: formData.student_type,
        status: formData.status,
        level: formData.level,
        initial_score: formData.initial_score ? parseInt(formData.initial_score) : null,
        initial_vocab: formData.initial_vocab ? parseInt(formData.initial_vocab) : null,
        phonics_progress: formData.phonics_progress || null,
        phonics_completed: formData.phonics_completed,
        ipa_completed: formData.ipa_completed,
        notes: formData.notes || null,
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* 基本信息 */}
      <div className="space-y-4">
        <h3 className="font-medium text-sm text-muted-foreground">基本信息</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">姓名 <span className="text-warning">*</span></label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="请输入学员姓名"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">学号</label>
            <Input
              value={formData.student_no}
              onChange={(e) => setFormData({ ...formData, student_no: e.target.value })}
              placeholder="自动生成或手动输入"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">学员类型</label>
            <Select
              value={formData.student_type}
              onChange={(e) => setFormData({ ...formData, student_type: e.target.value as StudentType })}
              options={typeOptions}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">状态</label>
            <Select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as StudentStatus })}
              options={statusOptions}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">年级</label>
            <Select
              value={formData.grade}
              onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
              options={[{ value: '', label: '请选择' }, ...gradeOptions]}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">程度等级</label>
            <Select
              value={formData.level}
              onChange={(e) => setFormData({ ...formData, level: e.target.value as LevelType })}
              options={levelOptions}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">就读学校</label>
            <Input
              value={formData.school}
              onChange={(e) => setFormData({ ...formData, school: e.target.value })}
              placeholder="请输入就读学校"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">学员账号</label>
            <Input
              value={formData.account}
              onChange={(e) => setFormData({ ...formData, account: e.target.value })}
              placeholder="慧学鲸等平台账号"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">入学日期</label>
            <Input
              type="date"
              value={formData.enroll_date}
              onChange={(e) => setFormData({ ...formData, enroll_date: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">入学成绩</label>
            <Input
              type="number"
              value={formData.initial_score}
              onChange={(e) => setFormData({ ...formData, initial_score: e.target.value })}
              placeholder="入学时考试成绩"
            />
          </div>
        </div>
      </div>

      {/* 语音进度 */}
      <div className="space-y-4">
        <h3 className="font-medium text-sm text-muted-foreground">语音训练进度</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">自然拼读进度</label>
            <Input
              value={formData.phonics_progress}
              onChange={(e) => setFormData({ ...formData, phonics_progress: e.target.value })}
              placeholder="如：第52页"
            />
          </div>
          <div className="space-y-2 flex items-end gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.phonics_completed}
                onChange={(e) => setFormData({ ...formData, phonics_completed: e.target.checked })}
                className="w-4 h-4 rounded border-input"
              />
              <span className="text-sm">自然拼读已完成</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.ipa_completed}
                onChange={(e) => setFormData({ ...formData, ipa_completed: e.target.checked })}
                className="w-4 h-4 rounded border-input"
              />
              <span className="text-sm">国际音标已完成</span>
            </label>
          </div>
        </div>
      </div>

      {/* 备注 */}
      <div className="space-y-2">
        <label className="text-sm font-medium">备注</label>
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder="内部备注信息..."
          className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      {/* 操作按钮 */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          取消
        </Button>
        <Button type="submit" disabled={loading || !formData.name}>
          {loading ? '保存中...' : (student ? '保存修改' : '创建学员')}
        </Button>
      </div>
    </form>
  )
}