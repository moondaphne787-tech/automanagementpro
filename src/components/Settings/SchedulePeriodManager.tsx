import { useState, useEffect } from 'react'
import { Plus, Edit, Trash2, Save, X, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import { schedulePeriodDb, studentSchedulePreferenceDb } from '@/db'
import type { SchedulePeriod } from '@/db/schedulePeriods'
import { cn } from '@/lib/utils'

export function SchedulePeriodManager() {
  const [periods, setPeriods] = useState<SchedulePeriod[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)

  // 编辑表单
  const [editName, setEditName] = useState('')
  const [editStart, setEditStart] = useState('')
  const [editEnd, setEditEnd] = useState('')
  const [editErrors, setEditErrors] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const list = await schedulePeriodDb.getAll()
      setPeriods(list)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const startNew = () => {
    setEditingId('__new__')
    setEditName('')
    setEditStart('')
    setEditEnd('')
    setEditErrors(null)
  }

  const startEdit = (p: SchedulePeriod) => {
    setEditingId(p.id)
    setEditName(p.name)
    setEditStart(p.start_date)
    setEditEnd(p.end_date)
    setEditErrors(null)
  }

  const cancelEdit = () => {
    setEditingId(null)
  }

  const handleSave = async () => {
    setEditErrors(null)
    if (!editName.trim()) { setEditErrors('请输入时段名称'); return }
    if (!editStart) { setEditErrors('请选择开始日期'); return }
    if (!editEnd) { setEditErrors('请选择结束日期'); return }
    if (editEnd < editStart) { setEditErrors('结束日期不能早于开始日期'); return }

    // 检查日期重叠
    const overlap = periods.find(p => {
      if (p.id === editingId) return false
      return !(editEnd < p.start_date || editStart > p.end_date)
    })
    if (overlap) {
      setEditErrors(`与"${overlap.name}"( ${overlap.start_date} ~ ${overlap.end_date} )日期重叠`)
      return
    }

    setSaving(true)
    try {
      if (editingId === '__new__') {
        await schedulePeriodDb.create({ name: editName.trim(), start_date: editStart, end_date: editEnd })
      } else if (editingId) {
        await schedulePeriodDb.update(editingId, { name: editName.trim(), start_date: editStart, end_date: editEnd })
      }
      setEditingId(null)
      await load()
    } catch {
      setEditErrors('保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    const confirmed = await confirmDialog({
      title: '删除时段',
      message: '确定删除此排课时段吗？关联的学员偏好会保留仅不再被匹配。',
      confirmText: '删除',
      variant: 'danger',
    })
    if (!confirmed) return
    await schedulePeriodDb.delete(id)
    await load()
  }

  // 批量操作：从平时复制偏好到某时段
  const [copying, setCopying] = useState<string | null>(null)
  const handleCopyFromRegular = async (periodName: string) => {
    const confirmed = await confirmDialog({
      title: '复制平时偏好',
      message: `将当前所有学员的"平时"偏好复制到"${periodName}"？已存在的假期偏好不会覆盖。`,
      confirmText: '复制',
      variant: 'warning',
    })
    if (!confirmed) return

    setCopying(periodName)
    try {
      // 获取所有平时偏好（semester IS NULL）
      const allPrefs = await studentSchedulePreferenceDb.getAllWithStudents()
      const regularPrefs = allPrefs.filter(p => !p.semester)
      if (regularPrefs.length === 0) {
        setEditErrors('暂无平时偏好可复制')
        setCopying(null)
        return
      }

      // 批量创建为指定时段的偏好
      const holidayPrefs = regularPrefs.map(p => ({
        student_id: p.student_id,
        day_of_week: p.day_of_week,
        preferred_start: p.preferred_start ?? undefined,
        preferred_end: p.preferred_end ?? undefined,
        semester: periodName,
        notes: p.notes ?? undefined,
      }))
      await studentSchedulePreferenceDb.batchCreateIfNotExists(holidayPrefs)
      setCopying(null)
      await load()
    } catch {
      setCopying(null)
    }
  }

  // 判断时段是否包含今天
  const todayStr = new Date().toISOString().split('T')[0]
  const isTodayInPeriod = (p: SchedulePeriod) => p.start_date <= todayStr && p.end_date >= todayStr

  return (
    <div className="space-y-6">
      {/* 说明 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800 space-y-1">
        <p className="font-medium">什么是排课时段？</p>
        <p className="text-xs text-blue-600">
          配置假期/特殊时段后，排课时系统会根据日期自动匹配对应的学员偏好时段。未配置时段的日子默认使用"平时"偏好。
        </p>
        <p className="text-xs text-blue-600">
          例如：配置"2026五一"(5.1-5.5)，那几天的排课会自动走五一对应的学员偏好，5月6日起自动恢复平时偏好。
        </p>
      </div>

      {/* 编辑 / 新建表单 */}
      {editingId !== null && (
        <div className="border border-primary/30 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">{editingId === '__new__' ? '新建排课时段' : '编辑排课时段'}</h4>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={cancelEdit}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">时段名称</label>
            <Input value={editName} onChange={e => setEditName(e.target.value)} placeholder="如：2026五一、2026暑假" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">开始日期</label>
              <Input type="date" value={editStart} onChange={e => setEditStart(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">结束日期</label>
              <Input type="date" value={editEnd} onChange={e => setEditEnd(e.target.value)} />
            </div>
          </div>

          {editErrors && (
            <p className="text-xs text-destructive flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />{editErrors}
            </p>
          )}

          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={saving}>
              <Save className="w-3.5 h-3.5 mr-1" />{saving ? '保存中...' : '保存'}
            </Button>
            <Button variant="outline" size="sm" onClick={cancelEdit}>取消</Button>
          </div>
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex gap-2">
        <Button onClick={startNew} size="sm">
          <Plus className="w-3.5 h-3.5 mr-1" />新增时段
        </Button>
      </div>

      {/* 时段列表 */}
      {loading ? (
        <div className="text-sm text-muted-foreground py-8 text-center">加载中...</div>
      ) : periods.length === 0 ? (
        <div className="text-sm text-muted-foreground py-8 text-center border rounded-lg">
          <p>暂无排课时段配置</p>
          <p className="text-xs mt-1">不配置时段则始终使用"平时"偏好排课</p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* 平时（始终存在） */}
          <div className="border rounded-lg p-3 bg-muted/20">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">平时</span>
                  {!periods.some(p => isTodayInPeriod(p)) && (
                    <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">当前</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">未匹配到任何时段的日子默认使用此偏好</p>
              </div>
            </div>
          </div>

          {periods.map(p => {
            const active = isTodayInPeriod(p)
            return (
              <div
                key={p.id}
                className={cn(
                  'border rounded-lg p-3 transition-colors',
                  active && 'border-primary/40 bg-primary/[0.02]'
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{p.name}</span>
                      {active && (
                        <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">当前生效</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {p.start_date} ~ {p.end_date}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => handleCopyFromRegular(p.name)}
                      disabled={copying === p.name}
                    >
                      {copying === p.name ? '复制中...' : '从平时复制'}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(p)}>
                      <Edit className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(p.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
