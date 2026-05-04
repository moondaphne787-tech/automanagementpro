import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const CATEGORY_OPTIONS = [
  { value: 'semester_summary', label: '学期总结' },
  { value: 'attitude', label: '学习态度观察' },
  { value: 'parent_comm', label: '家长沟通记录' },
  { value: 'highlight', label: '特别亮点记录' },
]

interface NoteFormProps {
  studentId: string
  onSave: (data: { student_id: string; note_date: string; category: string; content: string }) => Promise<void>
}

export function NoteForm({ studentId, onSave }: NoteFormProps) {
  const [open, setOpen] = useState(false)
  const [noteDate, setNoteDate] = useState(new Date().toISOString().split('T')[0])
  const [category, setCategory] = useState('highlight')
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!content.trim()) return
    setSaving(true)
    await onSave({
      student_id: studentId,
      note_date: noteDate,
      category,
      content: content.trim(),
    })
    setContent('')
    setNoteDate(new Date().toISOString().split('T')[0])
    setCategory('highlight')
    setSaving(false)
    setOpen(false)
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="w-full">
        <Plus className="w-4 h-4 mr-1" />添加成长记录
      </Button>
    )
  }

  return (
    <div className="border rounded-lg p-3 bg-card space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium">添加成长记录</span>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setOpen(false)}>
          <X className="w-3 h-3" />
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-muted-foreground">日期</label>
          <Input type="date" value={noteDate} onChange={e => setNoteDate(e.target.value)} className="h-8 text-xs" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">分类</label>
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="h-8 w-full text-xs rounded-md border border-input bg-transparent px-2"
          >
            {CATEGORY_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>
      <textarea
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder="输入记录内容..."
        className="w-full min-h-[60px] rounded-md border border-input bg-transparent p-2 text-xs resize-none placeholder:text-muted-foreground"
      />
      <div className="flex justify-end">
        <Button size="sm" disabled={!content.trim() || saving} onClick={handleSave}>
          {saving ? '保存中...' : '保存'}
        </Button>
      </div>
    </div>
  )
}
