import { describe, it, expect } from 'vitest'
import { 
  formatDateISO, 
  getDayOfWeek, 
  formatDateDisplay,
  formatLocalDate,
  getWeekRange,
  timeToMinutes,
  minutesToTime,
  getTodayStr,
  getWeekStartFromDate
} from './dateUtils'

// 同时测试 utils.ts 的重新导出
import {
  formatDateISO as formatDateISOFromUtils,
  getDayOfWeek as getDayOfWeekFromUtils,
  formatDateDisplay as formatDateDisplayFromUtils,
  formatLocalDate as formatLocalDateFromUtils,
  getWeekRange as getWeekRangeFromUtils,
  timeToMinutes as timeToMinutesFromUtils,
  minutesToTime as minutesToTimeFromUtils,
  getTodayStr as getTodayStrFromUtils,
  getWeekStartFromDate as getWeekStartFromDateFromUtils
} from './utils'

describe('formatDateISO', () => {
  it('格式化 Date 对象为 YYYY-MM-DD 格式', () => {
    const date = new Date('2024-03-15T08:00:00Z')
    const result = formatDateISO(date)
    expect(result).toBe('2024-03-15')
  })

  it('处理不同时区的日期', () => {
    // 创建一个 UTC 时间在下午的日期，确保在东八区仍是同一天
    const date = new Date('2024-01-01T16:00:00Z') // UTC 下午4点 = 东八区晚上12点
    const result = formatDateISO(date)
    expect(result).toBe('2024-01-01')
  })

  it('使用 UTC 时间格式化（toISOString 特性）', () => {
    // toISOString() 总是使用 UTC，所以本地时间可能转换后日期不同
    // 这是函数的预期行为，与原实现一致
    const localDate = new Date(2024, 0, 1) // 本地 2024年1月1日 00:00
    const result = formatDateISO(localDate)
    // 在东八区 (UTC+8)，本地午夜等于 UTC 前一天的 16:00
    // 所以结果是 2023-12-31，这是 toISOString 的预期行为
    expect(typeof result).toBe('string')
    expect(result.length).toBe(10) // YYYY-MM-DD 格式
  })

  it('处理边界日期', () => {
    const date = new Date('2024-12-31T23:59:59Z')
    const result = formatDateISO(date)
    expect(result).toBe('2024-12-31')
  })
})

describe('getDayOfWeek', () => {
  it('正确识别周一', () => {
    // 2024-03-18 是周一
    const result = getDayOfWeek('2024-03-18')
    expect(result).toBe('monday')
  })

  it('正确识别周二', () => {
    // 2024-03-19 是周二
    const result = getDayOfWeek('2024-03-19')
    expect(result).toBe('tuesday')
  })

  it('正确识别周三', () => {
    // 2024-03-20 是周三
    const result = getDayOfWeek('2024-03-20')
    expect(result).toBe('wednesday')
  })

  it('正确识别周四', () => {
    // 2024-03-21 是周四
    const result = getDayOfWeek('2024-03-21')
    expect(result).toBe('thursday')
  })

  it('正确识别周五', () => {
    // 2024-03-22 是周五
    const result = getDayOfWeek('2024-03-22')
    expect(result).toBe('friday')
  })

  it('正确识别周六', () => {
    // 2024-03-23 是周六
    const result = getDayOfWeek('2024-03-23')
    expect(result).toBe('saturday')
  })

  it('正确识别周日', () => {
    // 2024-03-17 是周日
    const result = getDayOfWeek('2024-03-17')
    expect(result).toBe('sunday')
  })

  it('接受 Date 对象作为输入', () => {
    const date = new Date('2024-03-18')
    const result = getDayOfWeek(date)
    expect(result).toBe('monday')
  })

  it('处理 ISO 日期字符串带时间部分', () => {
    const result = getDayOfWeek('2024-03-22T14:30:00Z')
    expect(result).toBe('friday')
  })
})

describe('formatDateDisplay', () => {
  it('格式化日期为中文显示格式', () => {
    const result = formatDateDisplay('2024-03-15')
    expect(result).toContain('3月')
    expect(result).toContain('15日')
  })

  it('包含正确的星期信息', () => {
    // 2024-03-18 是周一
    const result = formatDateDisplay('2024-03-18')
    expect(result).toContain('周一')
  })

  it('处理周六', () => {
    // 2024-03-23 是周六
    const result = formatDateDisplay('2024-03-23')
    expect(result).toContain('周六')
  })

  it('处理周日', () => {
    // 2024-03-17 是周日
    const result = formatDateDisplay('2024-03-17')
    expect(result).toContain('周日')
  })
})

describe('formatLocalDate', () => {
  it('使用本地时区格式化日期', () => {
    const date = new Date(2024, 2, 15) // 本地 2024年3月15日
    const result = formatLocalDate(date)
    expect(result).toBe('2024-03-15')
  })

  it('处理月份边界', () => {
    const date = new Date(2024, 0, 1) // 本地 2024年1月1日
    const result = formatLocalDate(date)
    expect(result).toBe('2024-01-01')
  })

  it('处理年末日期', () => {
    const date = new Date(2024, 11, 31) // 本地 2024年12月31日
    const result = formatLocalDate(date)
    expect(result).toBe('2024-12-31')
  })
})

describe('timeToMinutes', () => {
  it('将时间字符串转换为分钟数', () => {
    expect(timeToMinutes('09:00')).toBe(540)
    expect(timeToMinutes('12:30')).toBe(750)
    expect(timeToMinutes('00:00')).toBe(0)
    expect(timeToMinutes('23:59')).toBe(1439)
  })
})

describe('minutesToTime', () => {
  it('将分钟数转换为时间字符串', () => {
    expect(minutesToTime(540)).toBe('09:00')
    expect(minutesToTime(750)).toBe('12:30')
    expect(minutesToTime(0)).toBe('00:00')
    expect(minutesToTime(1439)).toBe('23:59')
  })

  it('与 timeToMinutes 互为逆运算', () => {
    const times = ['08:00', '09:30', '14:15', '18:45', '21:00']
    times.forEach(time => {
      expect(minutesToTime(timeToMinutes(time))).toBe(time)
    })
  })
})

describe('getWeekRange', () => {
  it('返回本周范围', () => {
    const result = getWeekRange(0)
    expect(result.label).toBe('本周')
    expect(result.start).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(result.end).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('返回上周范围', () => {
    const result = getWeekRange(-1)
    expect(result.label).toBe('上周')
  })

  it('返回下周范围', () => {
    const result = getWeekRange(1)
    expect(result.label).toBe('下周')
  })

  it('返回多周前范围', () => {
    const result = getWeekRange(-2)
    expect(result.label).toBe('2周前')
  })
})

describe('getTodayStr', () => {
  it('返回今日日期字符串', () => {
    const result = getTodayStr()
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    
    // 验证确实是今天
    const today = new Date()
    const expected = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    expect(result).toBe(expected)
  })
})

describe('getWeekStartFromDate', () => {
  it('获取周一日期（从周日开始）', () => {
    // 2024-03-17 是周日，按照周一为一周开始，该周的周一应该是 2024-03-11
    const result = getWeekStartFromDate('2024-03-17')
    expect(result).toBe('2024-03-11')
  })

  it('获取周一日期（从周一开始）', () => {
    // 2024-03-18 是周一
    const result = getWeekStartFromDate('2024-03-18')
    expect(result).toBe('2024-03-18')
  })

  it('获取周一日期（从周三开始）', () => {
    // 2024-03-20 是周三，周一应该是 2024-03-18
    const result = getWeekStartFromDate('2024-03-20')
    expect(result).toBe('2024-03-18')
  })

  it('获取周一日期（从周六开始）', () => {
    // 2024-03-23 是周六，周一应该是 2024-03-18
    const result = getWeekStartFromDate('2024-03-23')
    expect(result).toBe('2024-03-18')
  })
})

describe('统一导出验证', () => {
  it('formatDateISO 与之前各处的实现结果一致', () => {
    // 模拟之前的 formatDate 实现
    const oldFormatDate = (date: Date) => date.toISOString().split('T')[0]
    
    const testDate = new Date('2024-03-15T10:30:00Z')
    expect(formatDateISO(testDate)).toBe(oldFormatDate(testDate))
  })

  it('getDayOfWeek 与之前各处的实现结果一致', () => {
    // 模拟之前的 getDayOfWeek 实现
    const oldGetDayOfWeek = (dateStr: string) => {
      const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
      const date = new Date(dateStr)
      return days[date.getDay()]
    }
    
    const testDates = ['2024-03-17', '2024-03-18', '2024-03-19', '2024-03-20', '2024-03-21', '2024-03-22', '2024-03-23']
    
    testDates.forEach(dateStr => {
      expect(getDayOfWeek(dateStr)).toBe(oldGetDayOfWeek(dateStr))
    })
  })

  it('utils.ts 正确重新导出 formatDateISO', () => {
    const date = new Date('2024-03-15T08:00:00Z')
    expect(formatDateISOFromUtils(date)).toBe(formatDateISO(date))
  })

  it('utils.ts 正确重新导出 getDayOfWeek', () => {
    expect(getDayOfWeekFromUtils('2024-03-18')).toBe(getDayOfWeek('2024-03-18'))
  })

  it('utils.ts 正确重新导出 formatDateDisplay', () => {
    expect(formatDateDisplayFromUtils('2024-03-15')).toBe(formatDateDisplay('2024-03-15'))
  })

  it('utils.ts 正确重新导出 formatLocalDate', () => {
    const date = new Date(2024, 2, 15)
    expect(formatLocalDateFromUtils(date)).toBe(formatLocalDate(date))
  })

  it('utils.ts 正确重新导出 timeToMinutes', () => {
    expect(timeToMinutesFromUtils('09:00')).toBe(timeToMinutes('09:00'))
  })

  it('utils.ts 正确重新导出 minutesToTime', () => {
    expect(minutesToTimeFromUtils(540)).toBe(minutesToTime(540))
  })

  it('utils.ts 正确重新导出 getWeekRange', () => {
    const result1 = getWeekRangeFromUtils(0)
    const result2 = getWeekRange(0)
    expect(result1.start).toBe(result2.start)
    expect(result1.end).toBe(result2.end)
    expect(result1.label).toBe(result2.label)
  })

  it('utils.ts 正确重新导出 getTodayStr', () => {
    expect(getTodayStrFromUtils()).toBe(getTodayStr())
  })

  it('utils.ts 正确重新导出 getWeekStartFromDate', () => {
    expect(getWeekStartFromDateFromUtils('2024-03-17')).toBe(getWeekStartFromDate('2024-03-17'))
  })
})
