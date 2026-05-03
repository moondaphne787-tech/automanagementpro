import { Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DAY_LABELS } from '@/types'
import type { DayOfWeek } from '@/types'

export interface PreferenceFormData {
  day_of_week: DayOfWeek
  preferred_start: string
  preferred_end: string
  semester?: string
  notes: string
}

interface PreferenceFormProps {
  form: PreferenceFormData
  onChange: (form: PreferenceFormData) => void
  onSubmit: () => void
  onCancel: () => void
  submitLabel?: string
  title?: string
  periods?: { name: string }[]
  /** 内联模式（PreferenceManage 行内编辑/添加） */
  inline?: boolean
  /** 紧凑按钮（内联编辑模式下使用 Check/X 图标按钮） */
  compactButtons?: boolean
  loading?: boolean
}

const DAY_OPTIONS: { value: DayOfWeek; label: string }[] = [
  { value: 'monday', label: '周一' },
  { value: 'tuesday', label: '周二' },
  { value: 'wednesday', label: '周三' },
  { value: 'thursday', label: '周四' },
  { value: 'friday', label: '周五' },
  { value: 'saturday', label: '周六' },
  { value: 'sunday', label: '周日' },
]

export function PreferenceForm({
  form,
  onChange,
  onSubmit,
  onCancel,
  submitLabel = '保存',
  title,
  periods,
  inline = false,
  compactButtons = false,
  loading = false,
}: PreferenceFormProps) {
  if (inline) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={form.day_of_week}
          onChange={(e) => onChange({ ...form, day_of_week: e.target.value as DayOfWeek })}
          className="border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        >
          {DAY_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <input
          type="time"
          value={form.preferred_start}
          onChange={(e) => onChange({ ...form, preferred_start: e.target.value })}
          className="border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <span className="text-muted-foreground">-</span>
        <input
          type="time"
          value={form.preferred_end}
          onChange={(e) => onChange({ ...form, preferred_end: e.target.value })}
          className="border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <div className="flex items-center gap-1 ml-auto">
          {compactButtons ? (
            <>
              <Button size="sm" variant="ghost" onClick={onSubmit} disabled={loading} className="h-7 w-7 p-0">
                <Check className="h-4 w-4 text-green-600" />
              </Button>
              <Button size="sm" variant="ghost" onClick={onCancel} disabled={loading} className="h-7 w-7 p-0">
                <X className="h-4 w-4 text-muted-foreground" />
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="default" onClick={onSubmit} disabled={loading}>
                {submitLabel}
              </Button>
              <Button size="sm" variant="ghost" onClick={onCancel} disabled={loading}>
                取消
              </Button>
            </>
          )}
        </div>
      </div>
    )
  }

  // 垂直表单模式（InfoTab 风格）
  return (
    <div className="border rounded-lg p-3 bg-blue-50/30 space-y-2">
      {title && <div className="text-xs font-medium text-muted-foreground">{title}</div>}
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-xs text-muted-foreground">星期</label>
          <select
            value={form.day_of_week}
            onChange={(e) => onChange({ ...form, day_of_week: e.target.value as DayOfWeek })}
            className="w-full h-8 px-2 rounded border text-sm"
          >
            {DAY_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">开始</label>
          <Input
            type="time"
            value={form.preferred_start}
            onChange={(e) => onChange({ ...form, preferred_start: e.target.value })}
            className="h-8 text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">结束</label>
          <Input
            type="time"
            value={form.preferred_end}
            onChange={(e) => onChange({ ...form, preferred_end: e.target.value })}
            className="h-8 text-sm"
          />
        </div>
      </div>
      {periods && periods.length > 0 && (
        <div>
          <label className="text-xs text-muted-foreground">所属时段</label>
          <select
            value={form.semester || ''}
            onChange={(e) => onChange({ ...form, semester: e.target.value })}
            className="w-full h-8 px-2 rounded border text-sm"
          >
            <option value="">平时</option>
            {periods.map(p => (
              <option key={p.name} value={p.name}>{p.name}</option>
            ))}
          </select>
        </div>
      )}
      <div>
        <label className="text-xs text-muted-foreground">备注</label>
        <Input
          value={form.notes}
          onChange={(e) => onChange({ ...form, notes: e.target.value })}
          placeholder="可选"
          className="h-8 text-sm"
        />
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={onSubmit}>{submitLabel}</Button>
        <Button variant="outline" size="sm" onClick={onCancel}>取消</Button>
      </div>
    </div>
  )
}
