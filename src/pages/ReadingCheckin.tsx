/**
 * 朗读打卡快录页面
 * 
 * 注意：统计基准为"昨日"，因为有些学生晚上10点后才打卡，
 * 第二天统计前一天的数据更完整。
 * 
 * 3.5 优化：
 * - 批量打卡：勾选多个学员后一键打卡
 * - 快捷键：选中学员后按 Enter 打卡
 * - 动画过渡：打卡后学员移到列表底部时使用 CSS transition
 */

import { useEffect, useMemo, useCallback, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Search, BookOpen, Loader2, Check, CheckSquare, CalendarDays, RotateCcw, Download, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { useReadingCheckinStore } from '@/store/readingCheckinStore'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { exportReadingCheckinReport } from '@/utils/readingCheckinExport'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import type { DailyCheckinCount } from '@/store/types'

/** 每日打卡人数日历视图 */
function DailyCheckinCalendar({ year, month, dailyCounts, totalStudents, selectedDate, onDateClick }: {
  year: number
  month: number
  dailyCounts: DailyCheckinCount[]
  totalStudents: number
  selectedDate: string
  onDateClick: (date: string) => void
}) {
  // 构建日期→人数映射
  const countMap = useMemo(() => {
    const map = new Map<number, number>()
    dailyCounts.forEach(item => {
      const day = parseInt(item.date.split('-')[2], 10)
      map.set(day, item.count)
    })
    return map
  }, [dailyCounts])

  // 该月天数和第一天是星期几
  const daysInMonth = new Date(year, month, 0).getDate()
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay() // 0=周日

  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const todayDay = today.getFullYear() === year && today.getMonth() + 1 === month ? today.getDate() : -1
  const selectedDay = (() => {
    const parts = selectedDate.split('-')
    if (parseInt(parts[0]) === year && parseInt(parts[1]) === month) return parseInt(parts[2])
    return -1
  })()

  const weekLabels = ['日', '一', '二', '三', '四', '五', '六']

  // 构建日历格子
  const cells: (number | null)[] = []
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  // 最大打卡人数（用于颜色深浅）
  const maxCount = Math.max(...dailyCounts.map(d => d.count), 1)

  return (
    <div className="px-4 py-3 border-b bg-muted/20">
      <div className="grid grid-cols-7 gap-1 max-w-md mx-auto">
        {/* 星期标题 */}
        {weekLabels.map(label => (
          <div key={label} className="text-center text-xs text-muted-foreground font-medium py-1">
            {label}
          </div>
        ))}
        {/* 日期格子 */}
        {cells.map((day, idx) => {
          if (day === null) return <div key={`empty-${idx}`} />
          const count = countMap.get(day) || 0
          const isToday = day === todayDay
          const isSelected = day === selectedDay
          const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const isFuture = dateStr > todayStr
          const intensity = count > 0 ? Math.max(0.15, count / maxCount) : 0
          return (
            <div
              key={day}
              onClick={() => !isFuture && onDateClick(dateStr)}
              className={cn(
                "relative flex flex-col items-center justify-center rounded-md py-1.5 text-xs",
                !isFuture && "cursor-pointer hover:ring-1 hover:ring-primary/50",
                isFuture && "opacity-40 cursor-not-allowed",
                isSelected && "ring-2 ring-primary bg-primary/10",
                !isSelected && isToday && "ring-1 ring-primary/40",
                count > 0 && !isSelected ? "text-foreground" : !isSelected ? "text-muted-foreground" : "text-primary font-semibold"
              )}
              style={count > 0 && !isSelected ? { backgroundColor: `rgba(34, 197, 94, ${intensity})` } : undefined}
              title={`${month}月${day}日：${count} 人打卡${isFuture ? '（未来日期）' : '（点击切换）'}`}
            >
              <span className="font-medium">{day}</span>
              {count > 0 && (
                <span className="text-[10px] leading-none font-semibold">{count}人</span>
              )}
            </div>
          )
        })}
      </div>
      {/* 汇总 */}
      <div className="text-center text-xs text-muted-foreground mt-2">
        本月共 {dailyCounts.length} 天有打卡记录，在读学员 {totalStudents} 人
        <span className="ml-2 text-primary">点击日期可切换补录</span>
      </div>
    </div>
  )
}

/** 每日打卡人数趋势图 */
function DailyCheckinTrend({
  currentCounts,
  prevCounts,
  currentYear,
  currentMonth,
}: {
  currentCounts: DailyCheckinCount[]
  prevCounts: DailyCheckinCount[]
  currentYear: number
  currentMonth: number
}) {
  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate()

  // 构建日期→数量映射
  const currentMap = useMemo(() => {
    const map = new Map<number, number>()
    currentCounts.forEach(d => {
      const day = parseInt(d.date.split('-')[2], 10)
      map.set(day, d.count)
    })
    return map
  }, [currentCounts])

  const prevMap = useMemo(() => {
    const map = new Map<number, number>()
    prevCounts.forEach(d => {
      const day = parseInt(d.date.split('-')[2], 10)
      map.set(day, d.count)
    })
    return map
  }, [prevCounts])

  // 合并为 recharts 数据格式
  const chartData = useMemo(() => {
    const data: { day: number; current: number | null; previous: number | null }[] = []
    for (let d = 1; d <= daysInMonth; d++) {
      data.push({
        day: d,
        current: currentMap.get(d) ?? null,
        previous: prevMap.get(d) ?? null,
      })
    }
    return data
  }, [daysInMonth, currentMap, prevMap])

  // 计算平均值和变化
  const currentAvg = useMemo(() => {
    const vals = currentCounts.map(d => d.count)
    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
  }, [currentCounts])

  const prevAvg = useMemo(() => {
    const vals = prevCounts.map(d => d.count)
    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
  }, [prevCounts])

  const changePct = prevAvg > 0 ? ((currentAvg - prevAvg) / prevAvg * 100) : 0

  return (
    <div className="px-4 py-3 border-b bg-card">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="w-4 h-4 text-primary" />
        <span className="text-sm font-medium">打卡趋势对比</span>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="day"
            tick={{ fontSize: 12 }}
            stroke="hsl(var(--muted-foreground))"
            label={{ value: '日期', position: 'insideBottom', offset: -5, style: { fontSize: 12, fill: 'hsl(var(--muted-foreground))' } }}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 12 }}
            stroke="hsl(var(--muted-foreground))"
            width={30}
          />
          <Tooltip
            contentStyle={{
              fontSize: 12,
              borderRadius: 8,
              border: '1px solid hsl(var(--border))',
              background: 'hsl(var(--card))',
            }}
            formatter={(value: number, name: string) => {
              const label = name === 'current' ? '当月' : '上月'
              return [`${value} 人`, label]
            }}
            labelFormatter={(day: number) => `${currentMonth}月${day}日`}
          />
          <Legend
            formatter={(value: string) => (value === 'current' ? '当月' : '上月')}
          />
          <Line
            type="monotone"
            dataKey="current"
            stroke="hsl(221.2 83.2% 53.3%)"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
            connectNulls={false}
            name="current"
          />
          <Line
            type="monotone"
            dataKey="previous"
            stroke="hsl(215.4 16.3% 46.9%)"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={{ r: 2 }}
            connectNulls={false}
            name="previous"
          />
        </LineChart>
      </ResponsiveContainer>
      <div className="text-xs text-muted-foreground text-center mt-2">
        本月日均 <span className="font-semibold text-foreground">{currentAvg.toFixed(1)}</span> 人
        &nbsp;·&nbsp; 上月日均 <span className="font-semibold text-foreground">{prevAvg.toFixed(1)}</span> 人
        &nbsp;·&nbsp;
        <span className={cn(
          'font-semibold',
          changePct > 0 ? 'text-green-600' : changePct < 0 ? 'text-red-600' : ''
        )}>
          {changePct > 0 ? '↑' : changePct < 0 ? '↓' : ''}
          {Math.abs(changePct).toFixed(1)}%
        </span>
      </div>
    </div>
  )
}

export function ReadingCheckin() {
  const selectedYear = useReadingCheckinStore(s => s.selectedYear)
  const selectedMonth = useReadingCheckinStore(s => s.selectedMonth)
  const checkinStudents = useReadingCheckinStore(s => s.checkinStudents)
  const totalStudents = useReadingCheckinStore(s => s.totalStudents)
  const yesterdayCheckedCount = useReadingCheckinStore(s => s.yesterdayCheckedCount)
  const yesterdayDate = useReadingCheckinStore(s => s.yesterdayDate)
  const checkinLoading = useReadingCheckinStore(s => s.checkinLoading)
  const searchQuery = useReadingCheckinStore(s => s.searchQuery)
  const showOnlyUnchecked = useReadingCheckinStore(s => s.showOnlyUnchecked)
  const selectedStudentIds = useReadingCheckinStore(s => s.selectedStudentIds)
  const targetDate = useReadingCheckinStore(s => s.targetDate)
  const setSelectedMonth = useReadingCheckinStore(s => s.setSelectedMonth)
  const setTargetDate = useReadingCheckinStore(s => s.setTargetDate)
  const resetTargetDate = useReadingCheckinStore(s => s.resetTargetDate)
  const fetchMonthSummary = useReadingCheckinStore(s => s.fetchMonthSummary)
  const checkYesterday = useReadingCheckinStore(s => s.checkYesterday)
  const uncheckYesterday = useReadingCheckinStore(s => s.uncheckYesterday)
  const batchCheckYesterday = useReadingCheckinStore(s => s.batchCheckYesterday)
  const toggleSelectStudent = useReadingCheckinStore(s => s.toggleSelectStudent)
  const selectAllUnchecked = useReadingCheckinStore(s => s.selectAllUnchecked)
  const clearSelection = useReadingCheckinStore(s => s.clearSelection)
  const setSearchQuery = useReadingCheckinStore(s => s.setSearchQuery)
  const toggleShowOnlyUnchecked = useReadingCheckinStore(s => s.toggleShowOnlyUnchecked)
  const dailyCheckinCounts = useReadingCheckinStore(s => s.dailyCheckinCounts)
  const prevDailyCheckinCounts = useReadingCheckinStore(s => s.prevDailyCheckinCounts)
  const showDailyView = useReadingCheckinStore(s => s.showDailyView)
  const toggleDailyView = useReadingCheckinStore(s => s.toggleDailyView)

  const focusedIndexRef = useRef<number>(-1)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchMonthSummary()
  }, [])

  // 是否为昨日（默认模式）
  const isYesterday = targetDate === yesterdayDate
  // targetDate 的显示标签
  const targetDateLabel = useMemo(() => {
    if (isYesterday) return '昨日'
    const parts = targetDate.split('-')
    return `${parseInt(parts[1])}月${parseInt(parts[2])}日`
  }, [targetDate, isYesterday])

  // 点击日历日期时，同步切换月份
  const handleDateClick = useCallback((date: string) => {
    setTargetDate(date)
    // 同步刷新日历统计
    if (showDailyView) {
      useReadingCheckinStore.getState().fetchDailyCheckinCounts()
    }
  }, [setTargetDate, showDailyView])

  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(selectedYear - 1, 12)
    } else {
      setSelectedMonth(selectedYear, selectedMonth - 1)
    }
  }

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(selectedYear + 1, 1)
    } else {
      setSelectedMonth(selectedYear, selectedMonth + 1)
    }
  }

  const filteredStudents = useMemo(() => {
    let result = [...checkinStudents]
    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase()
      result = result.filter(student => 
        student.name.toLowerCase().includes(query) ||
        (student.studentNo && student.studentNo.toLowerCase().includes(query))
      )
    }
    if (showOnlyUnchecked) {
      result = result.filter(student => !student.checkedYesterday)
    }
    return result
  }, [checkinStudents, searchQuery, showOnlyUnchecked])

  const uncheckedInFiltered = useMemo(() => {
    return filteredStudents.filter(s => !s.checkedYesterday).length
  }, [filteredStudents])

  const allUncheckedSelected = useMemo(() => {
    const unchecked = filteredStudents.filter(s => !s.checkedYesterday)
    return unchecked.length > 0 && unchecked.every(s => selectedStudentIds.has(s.id))
  }, [filteredStudents, selectedStudentIds])

  const monthlyCheckedStudents = useMemo(() => {
    return checkinStudents.filter(s => s.monthlyCount > 0).length
  }, [checkinStudents])

  const handleToggleSelectAll = useCallback(() => {
    if (allUncheckedSelected) {
      clearSelection()
    } else {
      selectAllUnchecked(filteredStudents.map(s => s.id))
    }
  }, [allUncheckedSelected, clearSelection, selectAllUnchecked, filteredStudents])

  const [exporting, setExporting] = useState(false)
  const handleExport = useCallback(async () => {
    setExporting(true)
    try {
      await exportReadingCheckinReport(selectedYear, selectedMonth, checkinStudents)
      toast.success('导出成功')
    } catch {
      toast.error('导出失败')
    } finally {
      setExporting(false)
    }
  }, [selectedYear, selectedMonth, checkinStudents])

  const scrollToFocused = () => {
    const rows = listRef.current?.querySelectorAll('[data-row]')
    if (rows && rows[focusedIndexRef.current]) {
      rows[focusedIndexRef.current].scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }

  const updateFocusStyles = () => {
    listRef.current?.querySelectorAll('[data-row]').forEach((el, i) => {
      el.classList.toggle('ring-2', i === focusedIndexRef.current)
      el.classList.toggle('ring-primary', i === focusedIndexRef.current)
    })
  }

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (selectedStudentIds.size > 0) {
        batchCheckYesterday()
        return
      }
      if (focusedIndexRef.current >= 0 && focusedIndexRef.current < filteredStudents.length) {
        const student = filteredStudents[focusedIndexRef.current]
        if (!student.checkedYesterday) {
          checkYesterday(student.id, student.name)
        }
      }
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      focusedIndexRef.current = Math.min(focusedIndexRef.current + 1, filteredStudents.length - 1)
      scrollToFocused()
      updateFocusStyles()
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault()
      focusedIndexRef.current = Math.max(focusedIndexRef.current - 1, 0)
      scrollToFocused()
      updateFocusStyles()
    }

    if (e.key === ' ') {
      e.preventDefault()
      if (focusedIndexRef.current >= 0 && focusedIndexRef.current < filteredStudents.length) {
        const student = filteredStudents[focusedIndexRef.current]
        if (!student.checkedYesterday) {
          toggleSelectStudent(student.id)
        }
      }
    }
  }, [filteredStudents, selectedStudentIds, batchCheckYesterday, checkYesterday, toggleSelectStudent])

  const monthDisplay = `${selectedYear}年${selectedMonth}月`

  return (
    <div className="h-full flex flex-col" onKeyDown={handleKeyDown} tabIndex={0}>
      {/* 页面标题 */}
      <div className="px-6 py-3 border-b bg-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BookOpen className="w-5 h-5 text-primary" />
            <h1 className="text-lg font-semibold">朗读打卡快录</h1>
            <span className="text-sm text-muted-foreground">
              当月已打卡 <span className="font-semibold text-primary">{monthlyCheckedStudents}</span>/{totalStudents} 人
              {targetDate && (
                <> · {targetDateLabel}已打卡 <span className="font-semibold text-green-600">{yesterdayCheckedCount}</span> 人</>
              )}
            </span>
            {!isYesterday && (
              <Button variant="outline" size="sm" onClick={resetTargetDate} className="gap-1 ml-2">
                <RotateCcw className="w-3 h-3" />
                返回昨日
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={handlePrevMonth}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm font-medium px-2">{monthDisplay}</span>
            <Button variant="outline" size="icon" onClick={handleNextMonth}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* 搜索和过滤 */}
      <div className="p-4 border-b flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="搜索学员姓名或学号..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">只看未打卡</label>
          <Button
            variant={showOnlyUnchecked ? "default" : "outline"}
            size="sm"
            onClick={toggleShowOnlyUnchecked}
          >
            {showOnlyUnchecked ? '已开启' : '未开启'}
          </Button>
        </div>
        <Button
          variant={showDailyView ? "secondary" : "outline"}
          size="sm"
          onClick={toggleDailyView}
          className="gap-1.5"
        >
          <CalendarDays className="w-3.5 h-3.5" />
          每日统计
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={exporting}
          className="gap-1.5"
        >
          <Download className="w-3.5 h-3.5" />
          {exporting ? '导出中...' : '导出报表'}
        </Button>
      </div>

      {/* 每日打卡人数日历视图 */}
      {showDailyView && (
        <>
          <DailyCheckinCalendar
            year={selectedYear}
            month={selectedMonth}
            dailyCounts={dailyCheckinCounts}
            totalStudents={totalStudents}
            selectedDate={targetDate}
            onDateClick={handleDateClick}
          />
          <DailyCheckinTrend
            currentCounts={dailyCheckinCounts}
            prevCounts={prevDailyCheckinCounts}
            currentYear={selectedYear}
            currentMonth={selectedMonth}
          />
        </>
      )}

      {/* 批量操作栏 */}
      {uncheckedInFiltered > 0 && (
        <div className="px-4 py-2 border-b bg-muted/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleToggleSelectAll}
              className="gap-1.5"
            >
              <CheckSquare className="w-3.5 h-3.5" />
              {allUncheckedSelected ? '取消全选' : `全选未打卡 (${uncheckedInFiltered})`}
            </Button>
            {selectedStudentIds.size > 0 && (
              <span className="text-sm text-muted-foreground">
                已选 {selectedStudentIds.size} 人
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {selectedStudentIds.size > 0 && (
              <>
                <Button variant="ghost" size="sm" onClick={clearSelection}>
                  清除选择
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={batchCheckYesterday}
                  className="gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  一键打卡 ({selectedStudentIds.size})
                </Button>
              </>
            )}
            <span className="text-xs text-muted-foreground ml-2">
              ↑↓ 导航 · 空格 选中 · Enter 打卡
            </span>
          </div>
        </div>
      )}

      {/* 学员列表 */}
      <div className="flex-1 overflow-auto p-4" ref={listRef}>
        {checkinLoading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground mt-4">加载打卡数据中...</p>
          </div>
        ) : filteredStudents.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-8 text-center">
              <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">
                {searchQuery ? '没有找到匹配的学员' : '暂无学员数据'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="border rounded-lg">
            {/* 表头 */}
            <div className="grid grid-cols-[2rem_5rem_1fr_4.5rem_3.5rem_10rem] gap-4 p-3 bg-muted/50 border-b text-sm font-medium text-muted-foreground">
              <div />
              <div>学号</div>
              <div>学员姓名</div>
              <div className="text-center">本月天数</div>
              <div className="text-center">全勤</div>
              <div className="text-right">{targetDateLabel}操作</div>
            </div>

            {/* 学员行 */}
            {filteredStudents.map((student, index) => {
              const isSelected = selectedStudentIds.has(student.id)
              return (
                <div
                  key={student.id}
                  data-row
                  className={cn(
                    "grid grid-cols-[2rem_5rem_1fr_4.5rem_3.5rem_10rem] gap-4 p-3 border-b last:border-b-0 items-center",
                    "transition-all duration-300 ease-in-out",
                    student.checkedYesterday && "bg-muted/30 opacity-60",
                    isSelected && "bg-primary/5 border-l-2 border-l-primary"
                  )}
                  onClick={() => {
                    if (!student.checkedYesterday) {
                      focusedIndexRef.current = index
                    }
                  }}
                >
                  {/* 勾选框 */}
                  <div className="flex items-center justify-center">
                    {!student.checkedYesterday ? (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectStudent(student.id)}
                        className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                        aria-label={`选择 ${student.name}`}
                      />
                    ) : (
                      <div className="w-4 h-4" />
                    )}
                  </div>

                  {/* 学号 */}
                  <div className="text-sm text-muted-foreground truncate" title={student.studentNo || ''}>
                    {student.studentNo || '-'}
                  </div>

                  {/* 学员姓名 */}
                  <div className="font-medium">{student.name}</div>

                  {/* 本月天数 */}
                  <div className="text-center">
                    <span className={cn(
                      "font-semibold",
                      student.monthlyCount > 0 ? "text-primary" : "text-muted-foreground"
                    )}>
                      {student.monthlyCount}
                    </span>
                    <span className="text-muted-foreground ml-1">天</span>
                  </div>

                  {/* 全勤 */}
                  <div className="text-center">
                    {student.fullAttendance ? (
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-100 text-green-700 font-bold text-xs">✓</span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </div>

                  {/* 打卡操作 */}
                  <div className="flex items-center justify-end gap-2">
                    {student.checkedYesterday ? (
                      <>
                        <Button variant="outline" size="sm" disabled className="gap-1">
                          <Check className="w-3 h-3" />
                          已打卡
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => uncheckYesterday(student.id, student.name)}
                          className="text-red-500 hover:text-red-600 hover:bg-red-50"
                        >
                          撤
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => checkYesterday(student.id, student.name)}
                        className="gap-1"
                      >
                        <Check className="w-3 h-3" />
                        {targetDateLabel}打卡
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
