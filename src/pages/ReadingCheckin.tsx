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

import { useEffect, useMemo, useCallback, useRef } from 'react'
import { ChevronLeft, ChevronRight, Search, BookOpen, Loader2, Check, CheckSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { useReadingCheckinStore } from '@/store/readingCheckinStore'
import { cn } from '@/lib/utils'

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
  const setSelectedMonth = useReadingCheckinStore(s => s.setSelectedMonth)
  const fetchMonthSummary = useReadingCheckinStore(s => s.fetchMonthSummary)
  const checkYesterday = useReadingCheckinStore(s => s.checkYesterday)
  const uncheckYesterday = useReadingCheckinStore(s => s.uncheckYesterday)
  const batchCheckYesterday = useReadingCheckinStore(s => s.batchCheckYesterday)
  const toggleSelectStudent = useReadingCheckinStore(s => s.toggleSelectStudent)
  const selectAllUnchecked = useReadingCheckinStore(s => s.selectAllUnchecked)
  const clearSelection = useReadingCheckinStore(s => s.clearSelection)
  const setSearchQuery = useReadingCheckinStore(s => s.setSearchQuery)
  const toggleShowOnlyUnchecked = useReadingCheckinStore(s => s.toggleShowOnlyUnchecked)

  const focusedIndexRef = useRef<number>(-1)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchMonthSummary()
  }, [])

  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1
  const isCurrentMonth = selectedYear === currentYear && selectedMonth === currentMonth

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
      result = result.filter(student => student.name.toLowerCase().includes(query))
    }
    if (showOnlyUnchecked && isCurrentMonth) {
      result = result.filter(student => !student.checkedYesterday)
    }
    return result
  }, [checkinStudents, searchQuery, showOnlyUnchecked, isCurrentMonth])

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
    if (!isCurrentMonth) return

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
  }, [isCurrentMonth, filteredStudents, selectedStudentIds, batchCheckYesterday, checkYesterday, toggleSelectStudent])

  const monthDisplay = `${selectedYear}年${selectedMonth}月`

  const formatDate = (dateStr: string) => {
    if (!dateStr) return ''
    const parts = dateStr.split('-')
    return `${parts[1]}月${parts[2]}日`
  }

  return (
    <div className="h-full flex flex-col" onKeyDown={handleKeyDown} tabIndex={0}>
      {/* 页面标题 - 紧凑合并 */}
      <div className="px-6 py-3 border-b bg-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BookOpen className="w-5 h-5 text-primary" />
            <h1 className="text-lg font-semibold">朗读打卡快录</h1>
            <span className="text-sm text-muted-foreground">
              当月已打卡 <span className="font-semibold text-primary">{monthlyCheckedStudents}</span>/{totalStudents} 人
              {isCurrentMonth && yesterdayDate && (
                <> · {formatDate(yesterdayDate)}已打卡 <span className="font-semibold text-green-600">{yesterdayCheckedCount}</span> 人</>
              )}
            </span>
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
      <div className="p-4 border-b flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="搜索学员..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        {isCurrentMonth && (
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
        )}
      </div>

      {/* 批量操作栏 */}
      {isCurrentMonth && uncheckedInFiltered > 0 && (
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
            <div className={cn(
              "grid gap-4 p-3 bg-muted/50 border-b text-sm font-medium text-muted-foreground",
              isCurrentMonth ? "grid-cols-[2rem_1fr_6rem_10rem]" : "grid-cols-3"
            )}>
              {isCurrentMonth && <div />}
              <div>学员姓名</div>
              <div className="text-center">本月天数</div>
              <div className={cn("text-right", !isCurrentMonth && "text-center")}>
                {isCurrentMonth ? '昨日操作' : '统计'}
              </div>
            </div>

            {/* 学员行 */}
            {filteredStudents.map((student, index) => {
              const isSelected = selectedStudentIds.has(student.id)
              return (
                <div
                  key={student.id}
                  data-row
                  className={cn(
                    "grid gap-4 p-3 border-b last:border-b-0 items-center",
                    "transition-all duration-300 ease-in-out",
                    student.checkedYesterday && isCurrentMonth && "bg-muted/30 opacity-60",
                    isSelected && "bg-primary/5 border-l-2 border-l-primary",
                    isCurrentMonth ? "grid-cols-[2rem_1fr_6rem_10rem]" : "grid-cols-3"
                  )}
                  onClick={() => {
                    if (isCurrentMonth && !student.checkedYesterday) {
                      focusedIndexRef.current = index
                    }
                  }}
                >
                  {/* 勾选框 */}
                  {isCurrentMonth && (
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
                  )}

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

                  {/* 昨日操作 */}
                  <div className={cn("flex items-center justify-end gap-2", !isCurrentMonth && "justify-center")}>
                    {isCurrentMonth ? (
                      student.checkedYesterday ? (
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
                          昨日打卡
                        </Button>
                      )
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        {student.monthlyCount > 0 ? `${student.monthlyCount} 次` : '无记录'}
                      </span>
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
