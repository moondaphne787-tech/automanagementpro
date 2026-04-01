import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { DateInput } from '@/components/ui/date-input'
import type { ExamScore, ExamType } from '@/types'

interface ExamScoreFormProps {
  studentId: string
  onSave: (data: any) => void
  onCancel: () => void
  initialData?: ExamScore
}

export function ExamScoreForm({ studentId, onSave, onCancel, initialData }: ExamScoreFormProps) {
  const [form, setForm] = useState<{
    exam_date: string
    exam_name: string
    exam_type: 'school_exam' | 'placement' | 'mock'
    score: string
    full_score: string
    notes: string
  }>({
    exam_date: initialData?.exam_date || new Date().toISOString().split('T')[0],
    exam_name: initialData?.exam_name || '',
    exam_type: initialData?.exam_type || 'school_exam',
    score: initialData?.score?.toString() || '',
    full_score: initialData?.full_score?.toString() || '100',
    notes: initialData?.notes || ''
  })

  const handleSubmit = () => {
    onSave({
      student_id: studentId,
      exam_date: form.exam_date,
      exam_name: form.exam_name || undefined,
      exam_type: form.exam_type,
      score: form.score ? parseInt(form.score) : undefined,
      full_score: form.full_score ? parseInt(form.full_score) : 100,
      notes: form.notes || undefined
    })
  }

  return (
    <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">考试日期</label>
          <DateInput
            value={form.exam_date}
            onChange={(val) => setForm({ ...form, exam_date: val })}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">考试类型</label>
          <Select
            value={form.exam_type}
            onChange={(e) => setForm({ ...form, exam_type: e.target.value as 'school_exam' | 'placement' | 'mock' })}
            options={[
              { value: 'school_exam', label: '学校考试' },
              { value: 'placement', label: '分班考试' },
              { value: 'mock', label: '模拟考试' }
            ]}
          />
        </div>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">考试名称</label>
        <Input
          value={form.exam_name}
          onChange={(e) => setForm({ ...form, exam_name: e.target.value })}
          placeholder="如：期中考试、月考等"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">得分</label>
          <Input
            type="number"
            value={form.score}
            onChange={(e) => setForm({ ...form, score: e.target.value })}
            placeholder="分数"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">满分</label>
          <Input
            type="number"
            value={form.full_score}
            onChange={(e) => setForm({ ...form, full_score: e.target.value })}
            placeholder="100"
          />
        </div>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">备注</label>
        <Input
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          placeholder="可选备注"
        />
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={onCancel}>取消</Button>
        <Button onClick={handleSubmit}>保存</Button>
      </div>
    </div>
  )
}