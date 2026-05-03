import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { Edit2, Check, X, Plus, MoreVertical, GripVertical, TrendingUp, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PromptDialog } from '@/components/ui/dialog'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import { useAppStore } from '@/store/appStore'
import { cn } from '@/lib/utils'
import type { Milestone } from '@/types'

interface PlanningTabProps {
  studentId: string
}

const STATUS_COLORS: Record<string, string> = {
  '按计划': 'bg-green-100 text-green-700',
  '略超前': 'bg-blue-100 text-blue-700',
  '略落后': 'bg-yellow-100 text-yellow-700',
  '明显落后': 'bg-red-100 text-red-700',
}

interface MilestoneFormData {
  label: string
  targetWordbank: string
  targetLevel: string
  targetDate: string
  note: string
}

const WORDBANK_OPTIONS = ['小学考纲', '小学进阶', '初中考纲', '初中进阶', '高中考纲', '高中进阶', '大学四级']
const emptyMilestoneForm = (): MilestoneFormData => ({ label: '', targetWordbank: '', targetLevel: '', targetDate: '', note: '' })

function MilestoneDialog({ open, title, initial, onConfirm, onCancel }: {
  open: boolean; title: string; initial?: MilestoneFormData
  onConfirm: (data: MilestoneFormData) => void; onCancel: () => void
}) {
  const [form, setForm] = useState<MilestoneFormData>(initial ?? emptyMilestoneForm())
  useEffect(() => { if (open) setForm(initial ?? emptyMilestoneForm()) }, [open])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-background rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
        <h3 className="font-semibold text-base">{title}</h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">里程碑名称 *</label>
            <input className="w-full mt-1 h-9 px-3 rounded-md border text-sm bg-background" value={form.label}
              onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="如：完成初中考纲" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">目标词库</label>
              <select className="w-full mt-1 h-9 px-3 rounded-md border text-sm bg-background" value={form.targetWordbank}
                onChange={e => setForm(f => ({ ...f, targetWordbank: e.target.value }))}>
                <option value="">不限</option>
                {WORDBANK_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">目标关数</label>
              <input type="number" className="w-full mt-1 h-9 px-3 rounded-md border text-sm bg-background"
                value={form.targetLevel} onChange={e => setForm(f => ({ ...f, targetLevel: e.target.value }))} placeholder="如：36" />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">预计完成月份</label>
            <input type="month" className="w-full mt-1 h-9 px-3 rounded-md border text-sm bg-background"
              value={form.targetDate} onChange={e => setForm(f => ({ ...f, targetDate: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">备注</label>
            <input className="w-full mt-1 h-9 px-3 rounded-md border text-sm bg-background"
              value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="可选" />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={onCancel}>取消</Button>
          <Button size="sm" onClick={() => {
            if (!form.label.trim()) { toast.error('请填写里程碑名称'); return }
            onConfirm(form)
          }}>确定</Button>
        </div>
      </div>
    </div>
  )
}

export function PlanningTab({ studentId }: PlanningTabProps) {
  const plan = useAppStore(s => s.plan)
  const milestones = useAppStore(s => s.milestones)
  const planStatus = useAppStore(s => s.planStatus)
  const planStatusDate = useAppStore(s => s.planStatusDate)
  const loadPlanningData = useAppStore(s => s.loadPlanningData)
  const savePlan = useAppStore(s => s.savePlan)
  const addMilestone = useAppStore(s => s.addMilestone)
  const updateMilestone = useAppStore(s => s.updateMilestone)
  const deleteMilestone = useAppStore(s => s.deleteMilestone)
  const reorderMilestones = useAppStore(s => s.reorderMilestones)

  const currentStudent = useAppStore(s => s.currentStudent)
  const updateStudent = useAppStore(s => s.updateStudent)
  const selectStudent = useAppStore(s => s.selectStudent)
  const currentProgress = useAppStore(s => s.currentProgress)
  const wordbanks = useAppStore(s => s.wordbanks)
  const upsertProgress = useAppStore(s => s.upsertProgress)
  const deleteProgress = useAppStore(s => s.deleteProgress)

  // 大纲
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({ summary: '', phonicsPlan: '', textbookPlan: '', readingPlan: '' })
  const [savingPlan, setSavingPlan] = useState(false)

  // 阅读进度
  const [readingProgress, setReadingProgress] = useState('')

  // 里程碑
  const [milestoneDialog, setMilestoneDialog] = useState<{ open: boolean; mode: 'add' | 'edit'; target?: Milestone }>({ open: false, mode: 'add' })
  const [openMenuId, setOpenMenuId] = useState<number | null>(null)

  // 拖拽排序
  const [draggingId, setDraggingId] = useState<number | null>(null)
  const [dragOverId, setDragOverId] = useState<number | null>(null)

  // 词库进度 prompt
  const [promptState, setPromptState] = useState<{ open: boolean; title: string; defaultValue: string; onConfirm: ((v: string) => void) | null }>({ open: false, title: '', defaultValue: '', onConfirm: null })

  const loadAll = useCallback(async () => {
    await loadPlanningData(studentId)
  }, [studentId, loadPlanningData])

  useEffect(() => { loadAll() }, [loadAll])

  useEffect(() => {
    if (currentStudent) setReadingProgress(currentStudent.reading_progress || '')
  }, [currentStudent])

  const handleSaveReadingProgress = async () => {
    await updateStudent(studentId, { reading_progress: readingProgress || null })
    await selectStudent(studentId)
    toast.success('已保存')
  }

  const handleSavePlan = async () => {
    setSavingPlan(true)
    try {
      const ok = await savePlan({ studentId, ...editForm })
      if (ok) {
        toast.success('保存成功')
        setEditing(false)
        await loadAll()
      } else {
        toast.error('保存失败')
      }
    } catch {
      toast.error('保存失败')
    } finally { setSavingPlan(false) }
  }

  const handleAddMilestone = async (form: MilestoneFormData) => {
    const ok = await addMilestone({ studentId, label: form.label, targetWordbank: form.targetWordbank || undefined, targetLevel: form.targetLevel ? parseInt(form.targetLevel) : undefined, targetDate: form.targetDate || undefined, note: form.note || undefined })
    if (ok) {
      toast.success('里程碑已添加')
      setMilestoneDialog({ open: false, mode: 'add' })
      await loadAll()
    } else {
      toast.error('添加失败')
    }
  }

  const handleEditMilestone = async (form: MilestoneFormData) => {
    if (!milestoneDialog.target) return
    const ok = await updateMilestone(milestoneDialog.target.id, {
      label: form.label,
      targetWordbank: form.targetWordbank || undefined,
      targetLevel: form.targetLevel ? parseInt(form.targetLevel) : undefined,
      targetDate: form.targetDate || undefined,
      note: form.note || undefined,
    })
    if (ok) {
      toast.success('已更新')
      setMilestoneDialog({ open: false, mode: 'add' })
      await loadAll()
    } else {
      toast.error('更新失败')
    }
  }

  const handleToggleComplete = async (m: Milestone) => {
    const ok = await updateMilestone(m.id, {
      isCompleted: !m.isCompleted,
      completedDate: !m.isCompleted ? new Date().toISOString().split('T')[0] : undefined,
    })
    if (ok) {
      setOpenMenuId(null)
      await loadAll()
    } else {
      toast.error('操作失败')
    }
  }

  const handleDeleteMilestone = async (m: Milestone) => {
    const confirmed = await confirmDialog({ title: '删除里程碑', message: `确认删除「${m.label}」吗？`, confirmText: '删除', variant: 'danger' })
    if (!confirmed) return
    await deleteMilestone(m.id)
    toast.success('已删除')
    setOpenMenuId(null)
    await loadAll()
  }

  const handleDragEnd = async () => {
    if (draggingId === null || dragOverId === null || draggingId === dragOverId) {
      setDraggingId(null); setDragOverId(null); return
    }
    const fromIdx = milestones.findIndex(m => m.id === draggingId)
    const toIdx = milestones.findIndex(m => m.id === dragOverId)
    const reordered = [...milestones]
    const [moved] = reordered.splice(fromIdx, 1)
    reordered.splice(toIdx, 0, moved)
    setDraggingId(null); setDragOverId(null)
    await reorderMilestones(reordered)
  }

  const firstIncompleteIdx = milestones.findIndex(m => !m.isCompleted)
  const getMilestoneStatus = (m: Milestone, idx: number) => {
    if (m.isCompleted) return 'done'
    if (idx === firstIncompleteIdx) return 'active'
    return 'pending'
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 max-w-5xl">
      {/* 左列 */}
      <div className="space-y-4">
        {/* 大纲概览 */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">📋 大纲概览</CardTitle>
              {!editing && (
                <Button variant="ghost" size="sm" onClick={() => {
                  setEditForm({ summary: plan?.summary || '', phonicsPlan: plan?.phonicsPlan || '', textbookPlan: plan?.textbookPlan || '', readingPlan: plan?.readingPlan || '' })
                  setEditing(true)
                }}>
                  <Edit2 className="w-3.5 h-3.5 mr-1" />编辑
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {editing ? (
              <>
                {[
                  { key: 'summary', label: '整体规划方向' },
                  { key: 'phonicsPlan', label: '语音训练计划' },
                  { key: 'textbookPlan', label: '课文梳理计划' },
                  { key: 'readingPlan', label: '阅读训练计划' },
                ].map(({ key, label }) => (
                  <div key={key}>
                    <label className="text-xs text-muted-foreground">{label}</label>
                    <textarea
                      className="w-full mt-0.5 px-3 py-1.5 rounded-md border text-sm bg-background resize-none min-h-[52px]"
                      value={editForm[key as keyof typeof editForm]}
                      onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                      placeholder={`填写${label}...`}
                    />
                  </div>
                ))}
                <div className="flex gap-2 pt-1">
                  <Button size="sm" onClick={handleSavePlan} disabled={savingPlan}>
                    <Check className="w-3.5 h-3.5 mr-1" />{savingPlan ? '保存中...' : '保存'}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setEditing(false)}>
                    <X className="w-3.5 h-3.5 mr-1" />取消
                  </Button>
                </div>
              </>
            ) : (
              <div className="space-y-1.5 text-sm">
                {[
                  { label: '整体方向', value: plan?.summary },
                  { label: '语音计划', value: plan?.phonicsPlan },
                  { label: '课文梳理', value: plan?.textbookPlan },
                  { label: '阅读训练', value: plan?.readingPlan },
                ].map(({ label, value }) => (
                  <div key={label} className="flex gap-2">
                    <span className="text-muted-foreground shrink-0 w-14 text-xs pt-0.5">{label}：</span>
                    <span className={cn('text-sm', !value && 'text-muted-foreground/50 italic text-xs')}>{value || '暂未填写'}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 里程碑 */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">🏁 里程碑</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setMilestoneDialog({ open: true, mode: 'add' })}>
                <Plus className="w-3.5 h-3.5 mr-1" />添加
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {milestones.length === 0 ? (
              <p className="text-sm text-muted-foreground/60 italic py-1">暂无里程碑</p>
            ) : (
              <div className="space-y-1">
                {milestones.map((m, idx) => {
                  const status = getMilestoneStatus(m, idx)
                  return (
                    <div
                      key={m.id}
                      draggable
                      onDragStart={() => setDraggingId(m.id)}
                      onDragOver={e => { e.preventDefault(); setDragOverId(m.id) }}
                      onDragEnd={handleDragEnd}
                      className={cn(
                        'flex items-center gap-2 px-2 py-2 rounded-lg border transition-colors',
                        draggingId === m.id && 'opacity-40',
                        dragOverId === m.id && draggingId !== m.id && 'border-primary bg-primary/5',
                        status === 'done' && 'bg-muted/30',
                      )}
                    >
                      <GripVertical className="w-3 h-3 text-muted-foreground/30 cursor-grab shrink-0" />
                      <div className={cn(
                        'w-4 h-4 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold',
                        status === 'done' && 'bg-green-500 text-white',
                        status === 'active' && 'bg-blue-500 text-white',
                        status === 'pending' && 'bg-muted text-muted-foreground border',
                      )}>
                        {status === 'done' ? '✓' : status === 'active' ? '→' : '○'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={cn('text-sm', status === 'done' && 'line-through text-muted-foreground')}>{m.label}</span>
                          {m.targetWordbank && <span className="text-xs text-muted-foreground">{m.targetWordbank}{m.targetLevel ? `第${m.targetLevel}关` : ''}</span>}
                          {m.targetDate && <span className="text-xs text-muted-foreground">{m.targetDate}</span>}
                          {status === 'active' && <span className="text-[10px] bg-blue-100 text-blue-600 px-1 py-0.5 rounded">进行中</span>}
                        </div>
                        {m.note && <p className="text-xs text-muted-foreground">{m.note}</p>}
                      </div>
                      <div className="relative shrink-0">
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setOpenMenuId(openMenuId === m.id ? null : m.id)}>
                          <MoreVertical className="w-3 h-3" />
                        </Button>
                        {openMenuId === m.id && (
                          <div className="absolute right-0 top-7 z-20 bg-background border rounded-lg shadow-lg py-1 w-32">
                            <button className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted" onClick={() => handleToggleComplete(m)}>
                              {m.isCompleted ? '取消完成' : '标记完成'}
                            </button>
                            <button className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted" onClick={() => { setOpenMenuId(null); setMilestoneDialog({ open: true, mode: 'edit', target: m }) }}>
                              编辑
                            </button>
                            <button className="w-full text-left px-3 py-1.5 text-sm text-destructive hover:bg-muted" onClick={() => handleDeleteMilestone(m)}>
                              删除
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 阅读训练进度 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">📖 阅读训练进度</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Input
                value={readingProgress}
                onChange={(e) => setReadingProgress(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSaveReadingProgress() }}
                placeholder="如：初中B级,12（级别,已完成篇数）"
                className="h-8 text-sm"
              />
              <Button size="sm" className="shrink-0" onClick={handleSaveReadingProgress}
                disabled={readingProgress === (currentStudent?.reading_progress || '')}>
                保存
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">初中A → 初中B → 初中C → 高中A，每级30篇</p>
          </CardContent>
        </Card>

        {/* 进度状态 */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5" />最新进度状态
              </CardTitle>
              {planStatusDate && <span className="text-xs text-muted-foreground">{planStatusDate.slice(5).replace('-', '/')}</span>}
            </div>
          </CardHeader>
          <CardContent>
            {planStatus ? (
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-xs">状态：</span>
                  <span className={cn('px-2 py-0.5 rounded text-xs font-medium', STATUS_COLORS[planStatus.status] || 'bg-muted text-muted-foreground')}>
                    {planStatus.status}
                  </span>
                </div>
                <p className="text-sm leading-relaxed">{planStatus.current_vs_plan}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{planStatus.suggestion}</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground/60 italic">首次生成课程计划后显示</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 右列：词库进度 */}
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">📚 词库进度</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {currentProgress.length === 0 ? (
              <p className="text-sm text-muted-foreground/60 italic py-1">暂无词库进度</p>
            ) : (
              <div className="space-y-3">
                {currentProgress.map((progress) => {
                  const wordbank = wordbanks.find(w => w.id === progress.wordbank_id)
                  const totalLevels = progress.total_levels_override || wordbank?.total_levels || 60
                  const pct = Math.round((progress.current_level / totalLevels) * 100)
                  return (
                    <div key={progress.id} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{progress.wordbank_label}</span>
                          <span className={cn(
                            'text-xs px-1.5 py-0.5 rounded',
                            progress.status === 'completed' && 'bg-green-100 text-green-700',
                            progress.status === 'active' && 'bg-blue-100 text-blue-700',
                            progress.status === 'paused' && 'bg-muted text-muted-foreground',
                          )}>
                            {progress.status === 'completed' ? '已完成' : progress.status === 'active' ? '进行中' : '已暂停'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">第 {progress.current_level}/{totalLevels} 关</span>
                          <button
                            className="text-xs text-primary hover:underline"
                            onClick={() => setPromptState({
                              open: true,
                              title: `更新「${progress.wordbank_label}」关数（最大 ${totalLevels}）`,
                              defaultValue: progress.current_level.toString(),
                              onConfirm: (v) => {
                                const level = Math.min(parseInt(v) || 0, totalLevels)
                                if (!isNaN(level)) upsertProgress({ student_id: studentId, wordbank_id: progress.wordbank_id, current_level: level, status: level >= totalLevels ? 'completed' : 'active' })
                              }
                            })}
                          >
                            更新
                          </button>
                          <button
                            className="text-muted-foreground hover:text-destructive transition-colors"
                            onClick={async () => {
                              const confirmed = await confirmDialog({ title: '删除词库进度', message: `确定删除「${progress.wordbank_label}」的进度记录吗？`, confirmText: '删除', variant: 'danger' })
                              if (confirmed) deleteProgress(studentId, progress.wordbank_id)
                            }}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="text-xs text-muted-foreground">已学至第 {progress.current_level} 关</p>
                    </div>
                  )
                })}
              </div>
            )}

            {/* 添加词库 */}
            {wordbanks.length > currentProgress.length && (
              <div className="pt-2 border-t">
                <Select
                  placeholder="+ 添加词库"
                  options={wordbanks.filter(w => !currentProgress.some(p => p.wordbank_id === w.id)).map(w => ({ value: w.id, label: w.name }))}
                  onChange={(e) => {
                    if (e.target.value) upsertProgress({ student_id: studentId, wordbank_id: e.target.value, current_level: 0, status: 'active' })
                  }}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 里程碑对话框 */}
      <MilestoneDialog
        open={milestoneDialog.open}
        title={milestoneDialog.mode === 'add' ? '添加里程碑' : '编辑里程碑'}
        initial={milestoneDialog.target ? {
          label: milestoneDialog.target.label,
          targetWordbank: milestoneDialog.target.targetWordbank || '',
          targetLevel: milestoneDialog.target.targetLevel?.toString() || '',
          targetDate: milestoneDialog.target.targetDate || '',
          note: milestoneDialog.target.note || '',
        } : undefined}
        onConfirm={milestoneDialog.mode === 'add' ? handleAddMilestone : handleEditMilestone}
        onCancel={() => setMilestoneDialog({ open: false, mode: 'add' })}
      />

      <PromptDialog
        open={promptState.open}
        title={promptState.title}
        defaultValue={promptState.defaultValue}
        onConfirm={(v) => { promptState.onConfirm?.(v); setPromptState({ open: false, title: '', defaultValue: '', onConfirm: null }) }}
        onCancel={() => setPromptState({ open: false, title: '', defaultValue: '', onConfirm: null })}
      />

      {openMenuId !== null && <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />}
    </div>
  )
}
