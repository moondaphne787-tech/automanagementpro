import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { todoDb } from '../../db/todos'
import { useAppStore } from '../../store/appStore'
import type { Student } from '../../types'

interface Props {
  onClose: () => void
  onCreated: () => void
}

export function AddTodoModal({ onClose, onCreated }: Props) {
  const { students } = useAppStore()
  const [content, setContent] = useState('')
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [studentSearch, setStudentSearch] = useState('')

  const activeStudents: Student[] = students.filter(s => s.status === 'active' || s.student_type === 'trial')
  const filteredStudents = studentSearch
    ? activeStudents.filter(s => s.name.includes(studentSearch))
    : activeStudents

  const selectedStudent = students.find(s => s.id === selectedStudentId)

  const handleSave = async () => {
    if (!content.trim()) return
    setSaving(true)
    await todoDb.create({
      content: content.trim(),
      student_id: selectedStudentId || undefined,
      student_name: selectedStudent?.name || undefined,
      due_date: dueDate || undefined,
      sort_order: Date.now(),
    })
    setSaving(false)
    onCreated()
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>新增待办</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">待办内容 *</label>
            <Input
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="例：联系小明家长确认下周上课时间"
              autoFocus
              onKeyDown={e => e.key === 'Enter' && handleSave()}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              关联学员（可选）
            </label>
            {selectedStudentId ? (
              <div className="flex items-center gap-2 text-sm border rounded-md px-3 py-1.5">
                <span>{selectedStudent?.name}</span>
                <button
                  onClick={() => { setSelectedStudentId(''); setStudentSearch('') }}
                  className="ml-auto text-muted-foreground hover:text-foreground text-xs"
                >
                  取消
                </button>
              </div>
            ) : (
              <div className="relative">
                <Input
                  value={studentSearch}
                  onChange={e => setStudentSearch(e.target.value)}
                  placeholder="搜索学员姓名..."
                />
                {studentSearch && filteredStudents.length > 0 && (
                  <div className="absolute top-full mt-1 w-full bg-popover border rounded-md shadow-md z-50 max-h-40 overflow-y-auto">
                    {filteredStudents.slice(0, 8).map(s => (
                      <button
                        key={s.id}
                        onClick={() => { setSelectedStudentId(s.id); setStudentSearch('') }}
                        className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted transition-colors"
                      >
                        {s.name}
                        {s.grade && <span className="text-muted-foreground ml-1 text-xs">{s.grade}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">截止日期（可选）</label>
            <Input
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={handleSave} disabled={!content.trim() || saving}>
            {saving ? '保存中...' : '添加'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}