import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * DateInput - 年/月/日 分框输入组件
 * 
 * 使用场景：高频输入场景（如课堂记录日期、学员入学日期等表单）
 * 
 * 特点：
 * - 三框分离式输入（年/月/日），适合快速键盘输入
 * - 自动跳转（年份满 4 位跳月份，月份满 2 位跳日期）
 * - 输入验证（月份 01-12，日期 01-31）
 * 
 * 与 DatePicker 的区别：
 * - DatePicker 是日历弹窗式选择，适合低频筛选场景
 * - DateInput 是直接输入式，适合高频表单场景
 * 
 * 使用规范：请勿随意混用，表单输入优先使用 DateInput
 */

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
    
    // 年份输入四位后自动跳转到月份
    if (val.length === 4) {
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
    
    // 月份输入两位后自动跳转到日期
    if (val.length === 2) {
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