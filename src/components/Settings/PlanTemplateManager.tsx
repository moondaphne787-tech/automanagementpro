import { useState, useEffect } from 'react'
import { Plus, Edit, Trash2, GripVertical, ChevronDown, Save, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import { planTemplateDb } from '@/db'
import { TASK_TYPE_LABELS } from '@/types'
import type { TaskBlock, TaskType } from '@/types'
import type { PlanTemplate } from '@/db/planTemplates'
import { cn } from '@/lib/utils'

const CATEGORY_OPTIONS = [
  { value: 'general', label: '通用' },
  { value: 'phonics', label: '拼读' },
  { value: 'exam_prep', label: '备考' },
  { value: 'new_concept', label: '新概念' },
  { value: 'other', label: '其他' },
]

const TASK_TYPE_OPTIONS_FULL = Object.entries(TASK_TYPE_LABELS).map(([value, label]) => ({ value, label }))

interface EditableTask extends TaskBlock {
  _key: string
}

function createEmptyTask(): EditableTask {
  return { type: 'vocab_new' as TaskType, content: '', _key: crypto.randomUUID() }
}

export function PlanTemplateManager() {
  const [templates, setTemplates] = useState<PlanTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)

  // 编辑表单
  const [editName, setEditName] = useState('')
  const [editCategory, setEditCategory] = useState('general')
  const [editTasks, setEditTasks] = useState<EditableTask[]>([])
  const [editNotes, setEditNotes] = useState('')
  const [editErrors, setEditErrors] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const loadTemplates = async () => {
    setLoading(true)
    try {
      const list = await planTemplateDb.getAll()
      setTemplates(list)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTemplates()
  }, [])

  // 开始新建
  const startNew = () => {
    setEditingId(null)
    setEditName('')
    setEditCategory('general')
    setEditTasks([createEmptyTask()])
    setEditNotes('')
    setEditErrors(null)
  }

  // 开始编辑
  const startEdit = (t: PlanTemplate) => {
    setEditingId(t.id)
    setEditName(t.name)
    setEditCategory(t.category || 'general')
    let tasks: EditableTask[] = []
    try { tasks = JSON.parse(t.tasks).map((x: TaskBlock, i: number) => ({ ...x, _key: `task-${i}` })) } catch { tasks = [createEmptyTask()] }
    if (tasks.length === 0) tasks = [createEmptyTask()]
    setEditTasks(tasks)
    setEditNotes(t.notes || '')
    setEditErrors(null)
  }

  const cancelEdit = () => {
    setEditingId(null)
  }

  const addTask = () => {
    setEditTasks(prev => [...prev, createEmptyTask()])
  }

  const removeTask = (key: string) => {
    setEditTasks(prev => prev.filter(t => t._key !== key))
  }

  const updateTaskType = (key: string, type: TaskType) => {
    setEditTasks(prev => prev.map(t => t._key === key ? { ...t, type, content: '' } : t))
  }

  const updateTaskContent = (key: string, content: string) => {
    setEditTasks(prev => prev.map(t => t._key === key ? { ...t, content } : t))
  }

  const moveTask = (index: number, direction: 'up' | 'down') => {
    setEditTasks(prev => {
      const arr = [...prev]
      const target = direction === 'up' ? index - 1 : index + 1
      if (target < 0 || target >= arr.length) return arr
      ;[arr[index], arr[target]] = [arr[target], arr[index]]
      return arr
    })
  }

  const handleSave = async () => {
    setEditErrors(null)
    if (!editName.trim()) { setEditErrors('请输入模板名称'); return }
    const validTasks = editTasks.filter(t => t.content?.trim())
    if (validTasks.length === 0) { setEditErrors('请至少添加一个任务内容'); return }

    setSaving(true)
    try {
      const tasksJson = JSON.stringify(validTasks.map(({ type, content }) => ({ type, content })))
      if (editingId) {
        await planTemplateDb.update(editingId, {
          name: editName.trim(),
          category: editCategory,
          tasks: tasksJson,
          notes: editNotes.trim() || null,
        })
      } else {
        await planTemplateDb.create({
          name: editName.trim(),
          category: editCategory,
          tasks: tasksJson,
          notes: editNotes.trim() || null,
        })
      }
      setEditingId(null)
      await loadTemplates()
    } catch (e) {
      setEditErrors('保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    const confirmed = await confirmDialog({
      title: '删除模板',
      message: '确定删除此课程设计模板吗？',
      confirmText: '删除',
      variant: 'danger',
    })
    if (!confirmed) return
    await planTemplateDb.delete(id)
    await loadTemplates()
  }

  // 按分类分组
  const grouped = templates.reduce<Record<string, PlanTemplate[]>>((acc, t) => {
    const cat = t.category || 'other'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(t)
    return acc
  }, {})

  const getCategoryLabel = (cat: string) => CATEGORY_OPTIONS.find(c => c.value === cat)?.label || cat

  return (
    <div className="space-y-6">
      {/* 编辑/新建表单 */}
      {editingId !== undefined && (
        <Card className="border-primary/30">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">{editingId ? '编辑模板' : '新建模板'}</h4>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={cancelEdit}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">模板名称</label>
                <Input value={editName} onChange={e => setEditName(e.target.value)} placeholder="如：新概念英语第1课" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">分类</label>
                <select
                  value={editCategory}
                  onChange={e => setEditCategory(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                >
                  {CATEGORY_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* 任务列表 */}
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">任务内容</label>
              {editTasks.map((task, i) => (
                <div key={task._key} className="flex items-start gap-2">
                  <div className="flex flex-col gap-0.5 pt-1">
                    <button onClick={() => moveTask(i, 'up')} disabled={i === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-30"><ChevronDown className="w-3 h-3 rotate-180" /></button>
                    <button onClick={() => moveTask(i, 'down')} disabled={i === editTasks.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-30"><ChevronDown className="w-3 h-3" /></button>
                  </div>
                  <select
                    value={task.type}
                    onChange={e => updateTaskType(task._key, e.target.value as TaskType)}
                    className="w-28 h-9 rounded-md border border-input bg-background px-2 text-xs shrink-0"
                  >
                    {TASK_TYPE_OPTIONS_FULL.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <input
                    value={task.content || ''}
                    onChange={e => updateTaskContent(task._key, e.target.value)}
                    placeholder="任务内容描述"
                    className="flex-1 h-9 rounded-md border border-input bg-background px-2 text-sm"
                  />
                  <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-destructive" onClick={() => removeTask(task._key)}>
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addTask}>
                <Plus className="w-3.5 h-3.5 mr-1" />添加任务
              </Button>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">助教提示（可选）</label>
              <textarea
                value={editNotes}
                onChange={e => setEditNotes(e.target.value)}
                placeholder="给助教的授课提示..."
                rows={2}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y"
              />
            </div>

            {editErrors && <p className="text-xs text-destructive">{editErrors}</p>}

            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave} disabled={saving}>
                <Save className="w-3.5 h-3.5 mr-1" />
                {saving ? '保存中...' : '保存模板'}
              </Button>
              <Button variant="outline" size="sm" onClick={cancelEdit}>取消</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 新建按钮 */}
      {editingId === undefined && (
        <Button onClick={startNew}>
          <Plus className="w-4 h-4 mr-1" />新建模板
        </Button>
      )}

      {/* 模板列表 */}
      {loading ? (
        <div className="text-sm text-muted-foreground py-8 text-center">加载中...</div>
      ) : templates.length === 0 ? (
        <div className="text-sm text-muted-foreground py-8 text-center">暂无模板，点击上方按钮创建</div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([cat, items]) => (
            <div key={cat}>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">{getCategoryLabel(cat)}</h4>
              <div className="space-y-2">
                {items.map(t => {
                  let tasks: TaskBlock[] = []
                  try { tasks = JSON.parse(t.tasks) } catch {}
                  return (
                    <div key={t.id} className="border rounded-lg p-3 hover:bg-muted/20 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{t.name}</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {tasks.slice(0, 6).map((task, i) => (
                              <span key={i} className="text-xs bg-muted px-1.5 py-0.5 rounded">
                                {TASK_TYPE_LABELS[task.type]}
                                {task.content ? `: ${task.content.length > 20 ? task.content.slice(0, 20) + '…' : task.content}` : ''}
                              </span>
                            ))}
                            {tasks.length > 6 && (
                              <span className="text-xs text-muted-foreground">+{tasks.length - 6}</span>
                            )}
                          </div>
                          {t.notes && <p className="text-xs text-muted-foreground mt-1">{t.notes}</p>}
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(t)}>
                            <Edit className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(t.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
