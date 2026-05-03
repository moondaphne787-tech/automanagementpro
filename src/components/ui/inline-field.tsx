import { useState, useRef, useEffect } from 'react'
import { Pencil, Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface InlineFieldProps {
  label: string
  value: string | number | boolean | null | undefined
  displayValue?: string
  type?: 'text' | 'number' | 'select' | 'checkbox' | 'date'
  options?: { value: string; label: string }[]
  placeholder?: string
  onSave: (value: string | number | boolean | null) => Promise<void>
  className?: string
}

export function InlineField({
  label,
  value,
  displayValue,
  type = 'text',
  options,
  placeholder = '-',
  onSave,
  className
}: InlineFieldProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement>(null)

  // checkbox 类型：点击直接切换，不进入编辑模式
  if (type === 'checkbox') {
    const checked = !!value
    return (
      <div className={cn("flex justify-between items-center", className)}>
        <span className="text-muted-foreground text-sm">{label}</span>
        <button
          onClick={async () => {
            setSaving(true)
            try { await onSave(!checked) } finally { setSaving(false) }
          }}
          disabled={saving}
          className="flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity"
        >
          {saving ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
          ) : (
            <div className={cn(
              "w-4 h-4 rounded border-2 flex items-center justify-center transition-colors",
              checked ? "bg-primary border-primary" : "border-muted-foreground/40"
            )}>
              {checked && <Check className="w-3 h-3 text-primary-foreground" />}
            </div>
          )}
          <span className="text-sm">{checked ? '已完成' : '未完成'}</span>
        </button>
      </div>
    )
  }

  const startEdit = () => {
    if (type === 'select') {
      setDraft(String(value ?? ''))
    } else if (type === 'number') {
      setDraft(value != null && value !== '' ? String(value) : '')
    } else {
      setDraft(String(value ?? ''))
    }
    setEditing(true)
  }

  const save = async (overrideValue?: string) => {
    const raw = overrideValue ?? draft
    let newValue: string | number | null
    if (type === 'number') {
      const num = parseFloat(raw)
      newValue = isNaN(num) ? null : num
    } else {
      newValue = raw.trim() || null
    }

    // 跳过无变化的保存
    const oldValue = value ?? null
    if (newValue === oldValue || String(newValue) === String(oldValue)) {
      setEditing(false)
      return
    }

    setSaving(true)
    try {
      await onSave(newValue)
    } finally {
      setSaving(false)
      setEditing(false)
    }
  }

  const cancel = () => {
    setEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      save()
    } else if (e.key === 'Escape') {
      cancel()
    }
  }

  // 自动聚焦
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      if (inputRef.current instanceof HTMLInputElement) {
        inputRef.current.select()
      }
    }
  }, [editing])

  const display = displayValue ?? (value != null && value !== '' ? String(value) : placeholder)

  // select 类型：编辑时渲染下拉框
  if (editing && type === 'select' && options) {
    return (
      <div className={cn("flex justify-between items-center", className)}>
        <span className="text-muted-foreground text-sm">{label}</span>
        <select
          ref={inputRef as React.RefObject<HTMLSelectElement>}
          value={draft}
          onChange={(e) => save(e.target.value)}
          onBlur={cancel}
          onKeyDown={handleKeyDown}
          className="h-7 px-2 rounded border border-primary/50 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
        >
          {options.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
    )
  }

  // 编辑模式：input
  if (editing) {
    return (
      <div className={cn("flex justify-between items-center", className)}>
        <span className="text-muted-foreground text-sm">{label}</span>
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type={type === 'date' ? 'date' : type === 'number' ? 'number' : 'text'}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => save()}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="h-7 px-2 rounded border border-primary/50 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary text-right w-[140px]"
        />
      </div>
    )
  }

  // 显示模式
  return (
    <div className={cn("flex justify-between items-center", className)}>
      <span className="text-muted-foreground text-sm">{label}</span>
      <button
        onClick={startEdit}
        disabled={saving}
        className="group flex items-center gap-1 text-sm hover:text-primary transition-colors cursor-pointer rounded px-1.5 py-0.5 -mr-1.5 hover:bg-primary/5"
      >
        {saving ? (
          <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
        ) : (
          <>
            <span className={cn(
              value == null || value === '' ? 'text-muted-foreground/50' : ''
            )}>
              {display}
            </span>
            <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-40 transition-opacity" />
          </>
        )}
      </button>
    </div>
  )
}
