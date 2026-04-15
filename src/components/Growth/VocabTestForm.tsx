import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DateInput } from '@/components/ui/date-input'
import type { VocabTest } from '@/types'

interface VocabTestFormProps {
  studentId: string
  onSave: (data: any) => void
  onCancel: () => void
  initialData?: VocabTest
}

export function VocabTestForm({ studentId, onSave, onCancel, initialData }: VocabTestFormProps) {
  const [form, setForm] = useState({
    test_date: initialData?.test_date || new Date().toISOString().split('T')[0],
    vocab_count: initialData?.vocab_count?.toString() || '',
    test_source: initialData?.test_source || '',
    notes: initialData?.notes || ''
  })

  const handleSubmit = () => {
    if (!form.vocab_count) return
    onSave({
      student_id: studentId,
      test_date: form.test_date,
      vocab_count: parseInt(form.vocab_count),
      test_source: form.test_source || undefined,
      notes: form.notes || undefined
    })
  }

  return (
    <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">测试日期</label>
          <DateInput
            value={form.test_date}
            onChange={(val) => setForm({ ...form, test_date: val })}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">词汇量</label>
          <Input
            type="number"
            value={form.vocab_count}
            onChange={(e) => setForm({ ...form, vocab_count: e.target.value })}
            placeholder="如 1500"
          />
        </div>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">测试来源</label>
        <Input
          value={form.test_source}
          onChange={(e) => setForm({ ...form, test_source: e.target.value })}
          placeholder="如：百词斩、扇贝等"
        />
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
        <Button onClick={handleSubmit} disabled={!form.vocab_count}>保存</Button>
      </div>
    </div>
  )
}
