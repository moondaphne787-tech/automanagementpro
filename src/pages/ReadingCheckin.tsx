/**
 * 朗读打卡快录页面
 */

import { useEffect, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Search, BookOpen, Loader2, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAppStore } from '@/store/appStore'
import { cn } from '@/lib/utils'

export function ReadingCheckin() {
  const {
    selectedYear,
    selectedMonth,
    checkinStudents,
    totalStudents,
    todayCheckedCount,
    todayDate,
    checkinLoading,
    searchQuery,
    showOnlyUnchecked,
    setSelectedMonth,
    fetchMonthSummary,
    checkToday,
    uncheckToday,
    setSearchQuery,
    toggleShowOnlyUnchecked
  } = useAppStore()
  
  // 加载月度数据
  useEffect(() => {
    fetchMonthSummary()
  }, [])
  
  // 判断是否是当前月份
  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1
  const isCurrentMonth = selectedYear === currentYear && selectedMonth === currentMonth
  
  // 上一个月
  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(selectedYear - 1, 12)
    } else {
      setSelectedMonth(selectedYear, selectedMonth - 1)
    }
  }
  
  // 下一个月
  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(selectedYear + 1, 1)
    } else {
      setSelectedMonth(selectedYear, selectedMonth + 1)
    }
  }
  
  // 过滤学员列表
  const filteredStudents = useMemo(() => {
    let result = [...checkinStudents]
    
    // 搜索过滤
    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase()
      result = result.filter(student => 
        student.name.toLowerCase().includes(query)
      )
    }
    
    // 只看未打卡过滤
    if (showOnlyUnchecked && isCurrentMonth) {
      result = result.filter(student => !student.checkedToday)
    }
    
    return result
  }, [checkinStudents, searchQuery, showOnlyUnchecked, isCurrentMonth])
  
  // 计算本月已打卡学员数（有至少一次打卡的学员）
  const monthlyCheckedStudents = useMemo(() => {
    return checkinStudents.filter(s => s.monthlyCount > 0).length
  }, [checkinStudents])
  
  // 格式化月份显示
  const monthDisplay = `${selectedYear}年${selectedMonth}月`
  
  return (
    <div className="h-full flex flex-col">
      {/* 页面标题 */}
      <div className="p-6 border-b bg-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BookOpen className="w-6 h-6 text-primary" />
            <h1 className="text-xl font-semibold">朗读打卡快录</h1>
          </div>
          
          {/* 月份切换 */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={handlePrevMonth}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-lg font-medium px-4">{monthDisplay}</span>
            <Button variant="outline" size="icon" onClick={handleNextMonth}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
        
        {/* 统计栏 */}
        <div className="mt-4 flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">当月已打卡学员</span>
            <span className="font-semibold text-primary">{monthlyCheckedStudents}</span>
            <span className="text-muted-foreground">/</span>
            <span className="text-muted-foreground">共 {totalStudents} 人</span>
          </div>
          {isCurrentMonth && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">今日已打卡</span>
              <span className="font-semibold text-green-600">{todayCheckedCount}</span>
              <span className="text-muted-foreground">人</span>
            </div>
          )}
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
      
      {/* 学员列表 */}
      <div className="flex-1 overflow-auto p-4">
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
            <div className="grid grid-cols-3 gap-4 p-3 bg-muted/50 border-b text-sm font-medium text-muted-foreground">
              <div>学员姓名</div>
              <div className="text-center">本月天数</div>
              <div className={cn("text-right", !isCurrentMonth && "text-center")}>
                {isCurrentMonth ? '今日操作' : '统计'}
              </div>
            </div>
            
            {/* 学员行 */}
            {filteredStudents.map((student) => (
              <div
                key={student.id}
                className={cn(
                  "grid grid-cols-3 gap-4 p-3 border-b last:border-b-0 items-center transition-colors",
                  student.checkedToday && isCurrentMonth && "bg-muted/30 opacity-60"
                )}
              >
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
                
                {/* 今日操作 */}
                <div className={cn("flex items-center justify-end gap-2", !isCurrentMonth && "justify-center")}>
                  {isCurrentMonth ? (
                    student.checkedToday ? (
                      <>
                        <Button variant="outline" size="sm" disabled className="gap-1">
                          <Check className="w-3 h-3" />
                          已打卡
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => uncheckToday(student.id, student.name)}
                          className="text-red-500 hover:text-red-600 hover:bg-red-50"
                        >
                          撤
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => checkToday(student.id, student.name)}
                        className="gap-1"
                      >
                        <Check className="w-3 h-3" />
                        今日打卡
                      </Button>
                    )
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      {student.monthlyCount > 0 ? `${student.monthlyCount} 次` : '无记录'}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}