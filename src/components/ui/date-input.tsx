import * as React from "react"
import { cn } from "@/lib/utils"

interface DateInputProps {
  value: string // 格式: YYYY-MM-DD
  onChange: (value: string) => void
  className?: string
  disabled?: boolean
  placeholder?: string
}

export function DateInput({ value, onChange, className, disabled, placeholder }: DateInputProps) {
  // 解析日期值
  const [year, month, day] = React.useMemo(() => {
    if (!value) return ['', '', '']
    const parts = value.split('-')
    return parts.length === 3 ? parts : ['', '', '']
  }, [value])

  const yearRef = React.useRef<HTMLInputElement>(null)
  const monthRef = React.useRef<HTMLInputElement>(null)
  const dayRef = React.useRef<HTMLInputElement>(null)

  const updateDate = (newYear: string, newMonth: string, newDay: string) => {
    // 只有在所有字段都有值时才格式化并更新
    if (newYear.length === 4 && newMonth.length === 2 && newDay.length === 2) {
      // 完整日期，进行格式化
      const y = newYear
      const m = newMonth.padStart(2, '0')
      const d = newDay.padStart(2, '0')
      onChange(`${y}-${m}-${d}`)
    } else if (newYear || newMonth || newDay) {
      // 部分输入时，保持原始值
      const y = newYear || ''
      const m = newMonth || ''
      const d = newDay || ''
      onChange(`${y}-${m}-${d}`)
    } else {
      onChange('')
    }
  }

  const handleYearChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 4)
    updateDate(val, month, day)
    
    // 年份输入四位后自动跳转到月份（仅当月份为空时）
    if (val.length === 4 && !month) {
      monthRef.current?.focus()
    }
  }

  const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '').slice(0, 2)
    
    // 月份验证 (01-12)，只在输入两位时验证
    if (val.length === 2) {
      const num = parseInt(val, 10)
      if (num > 12) val = '12'
      if (num === 0) val = '01'
    }
    
    updateDate(year, val, day)
    
    // 月份输入两位后自动跳转到日期（仅当日期为空时）
    if (val.length === 2 && !day) {
      dayRef.current?.focus()
    }
  }

  const handleDayChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '').slice(0, 2)
    
    // 日期验证 (01-31)
    if (val.length === 2) {
      const num = parseInt(val, 10)
      if (num > 31) val = '31'
      if (num === 0) val = '01'
    }
    
    updateDate(year, month, val)
  }

  const handleKeyDown = (e: React.KeyboardEvent, field: 'year' | 'month' | 'day') => {
    // 退格键处理：当前字段为空时跳到上一个字段
    if (e.key === 'Backspace') {
      const target = e.target as HTMLInputElement
      if (target.value === '') {
        if (field === 'month') {
          e.preventDefault()
          yearRef.current?.focus()
        } else if (field === 'day') {
          e.preventDefault()
          monthRef.current?.focus()
        }
      }
    }
  }

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <input
        ref={yearRef}
        type="text"
        inputMode="numeric"
        value={year}
        onChange={handleYearChange}
        onKeyDown={(e) => handleKeyDown(e, 'year')}
        disabled={disabled}
        placeholder={placeholder ? '----' : '年份'}
        className="flex h-9 w-16 rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 text-center"
        maxLength={4}
      />
      <span className="text-muted-foreground">年</span>
      <input
        ref={monthRef}
        type="text"
        inputMode="numeric"
        value={month}
        onChange={handleMonthChange}
        onKeyDown={(e) => handleKeyDown(e, 'month')}
        disabled={disabled}
        placeholder="月份"
        className="flex h-9 w-12 rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 text-center"
        maxLength={2}
      />
      <span className="text-muted-foreground">月</span>
      <input
        ref={dayRef}
        type="text"
        inputMode="numeric"
        value={day}
        onChange={handleDayChange}
        onKeyDown={(e) => handleKeyDown(e, 'day')}
        disabled={disabled}
        placeholder="日期"
        className="flex h-9 w-12 rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 text-center"
        maxLength={2}
      />
      <span className="text-muted-foreground">日</span>
    </div>
  )
}