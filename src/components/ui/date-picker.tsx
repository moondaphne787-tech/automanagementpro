import * as React from 'react'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { DayPicker } from 'react-day-picker'
import { Calendar as CalendarIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

// react-day-picker 样式
import 'react-day-picker/style.css'

interface DatePickerProps {
  value: string // 格式: YYYY-MM-DD
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

export function DatePicker({ value, onChange, placeholder = '选择日期', className, disabled }: DatePickerProps) {
  const [open, setOpen] = React.useState(false)
  
  // 解析日期字符串为 Date 对象
  const selectedDate = React.useMemo(() => {
    if (!value) return undefined
    const parts = value.split('-')
    if (parts.length !== 3) return undefined
    const year = parseInt(parts[0], 10)
    const month = parseInt(parts[1], 10) - 1 // JavaScript 月份从 0 开始
    const day = parseInt(parts[2], 10)
    const date = new Date(year, month, day)
    // 验证日期是否有效
    if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) {
      return undefined
    }
    return date
  }, [value])

  const handleSelect = (date: Date | undefined) => {
    if (date) {
      const formatted = format(date, 'yyyy-MM-dd')
      onChange(formatted)
    }
    setOpen(false)
  }

  // 格式化显示日期
  const displayDate = selectedDate 
    ? format(selectedDate, 'yyyy年MM月dd日', { locale: zhCN })
    : placeholder

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'justify-start text-left font-normal',
            !selectedDate && 'text-muted-foreground',
            className
          )}
          disabled={disabled}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {displayDate}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <DayPicker
          mode="single"
          selected={selectedDate}
          onSelect={handleSelect}
          locale={zhCN}
          captionLayout="dropdown"
          fromYear={2020}
          toYear={2030}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  )
}