/**
 * 朗读打卡状态管理 Slice
 */

import type { StateCreator } from 'zustand'
import type { AppState, ReadingCheckinSlice } from './types'
import { readingCheckinDb } from '@/db/readingCheckins'
import { toast } from 'sonner'

// 打卡行数据类型
export interface CheckinStudent {
  id: string
  name: string
  monthlyCount: number
  checkedToday: boolean
}

/**
 * 创建朗读打卡 Slice
 */
export const createReadingCheckinSlice: StateCreator<AppState, [], [], ReadingCheckinSlice> = (set, get) => ({
  // 初始状态：使用当前日期
  selectedYear: new Date().getFullYear(),
  selectedMonth: new Date().getMonth() + 1, // JavaScript month 是 0-11，需要 +1
  checkinStudents: [],
  totalStudents: 0,
  todayCheckedCount: 0,
  todayDate: '',
  checkinLoading: false,
  
  searchQuery: '',
  showOnlyUnchecked: false,
  
  // 设置选中的月份
  setSelectedMonth: (year, month) => {
    set({ selectedYear: year, selectedMonth: month })
    get().fetchMonthSummary()
  },
  
  // 获取月度打卡统计
  fetchMonthSummary: async () => {
    set({ checkinLoading: true })
    
    try {
      const { selectedYear, selectedMonth } = get()
      const result = await readingCheckinDb.getMonthSummary(selectedYear, selectedMonth)
      
      set({
        checkinStudents: result.students,
        totalStudents: result.totalStudents,
        todayCheckedCount: result.todayCheckedCount,
        todayDate: result.today,
        checkinLoading: false
      })
    } catch (error) {
      console.error('Failed to fetch month summary:', error)
      set({ checkinLoading: false })
      toast.error('加载打卡数据失败')
    }
  },
  
  // 今日打卡（乐观更新）
  checkToday: async (studentId, studentName) => {
    const { checkinStudents, todayCheckedCount, selectedYear, selectedMonth } = get()
    
    // 判断是否是当前月份
    const currentYear = new Date().getFullYear()
    const currentMonth = new Date().getMonth() + 1
    const isCurrentMonth = selectedYear === currentYear && selectedMonth === currentMonth
    
    if (!isCurrentMonth) {
      toast.error('只能在当前月份进行打卡操作')
      return
    }
    
    // 保存旧状态用于回滚
    const oldStudents = [...checkinStudents]
    const oldCount = todayCheckedCount
    
    // 乐观更新：立即更新本地状态
    const updatedStudents = checkinStudents.map(student => {
      if (student.id === studentId) {
        return {
          ...student,
          monthlyCount: student.monthlyCount + 1,
          checkedToday: true
        }
      }
      return student
    })
    
    // 重新排序：已打卡学员沉底
    const sortedStudents = [...updatedStudents].sort((a, b) => {
      if (a.checkedToday !== b.checkedToday) {
        return a.checkedToday ? 1 : -1
      }
      return a.name.localeCompare(b.name, 'zh-CN')
    })
    
    set({
      checkinStudents: sortedStudents,
      todayCheckedCount: oldCount + 1
    })
    
    // 后台调用 IPC
    try {
      await readingCheckinDb.checkToday(studentId)
      toast.success(`${studentName} 今日打卡已记录`)
    } catch (error) {
      console.error('Failed to check today:', error)
      // 回滚状态
      set({
        checkinStudents: oldStudents,
        todayCheckedCount: oldCount
      })
      toast.error('打卡失败，请重试')
    }
  },
  
  // 撤销今日打卡（乐观更新）
  uncheckToday: async (studentId, studentName) => {
    const { checkinStudents, todayCheckedCount, selectedYear, selectedMonth } = get()
    
    // 判断是否是当前月份
    const currentYear = new Date().getFullYear()
    const currentMonth = new Date().getMonth() + 1
    const isCurrentMonth = selectedYear === currentYear && selectedMonth === currentMonth
    
    if (!isCurrentMonth) {
      toast.error('只能在当前月份撤销打卡')
      return
    }
    
    // 保存旧状态用于回滚
    const oldStudents = [...checkinStudents]
    const oldCount = todayCheckedCount
    
    // 乐观更新
    const updatedStudents = checkinStudents.map(student => {
      if (student.id === studentId) {
        return {
          ...student,
          monthlyCount: student.monthlyCount - 1,
          checkedToday: false
        }
      }
      return student
    })
    
    // 重新排序：未打卡学员浮顶
    const sortedStudents = [...updatedStudents].sort((a, b) => {
      if (a.checkedToday !== b.checkedToday) {
        return a.checkedToday ? 1 : -1
      }
      return a.name.localeCompare(b.name, 'zh-CN')
    })
    
    set({
      checkinStudents: sortedStudents,
      todayCheckedCount: oldCount - 1
    })
    
    // 后台调用 IPC
    try {
      await readingCheckinDb.uncheckToday(studentId)
      toast.success(`${studentName} 今日打卡已撤销`)
    } catch (error) {
      console.error('Failed to uncheck today:', error)
      // 回滚状态
      set({
        checkinStudents: oldStudents,
        todayCheckedCount: oldCount
      })
      toast.error('撤销失败，请重试')
    }
  },
  
  // 设置搜索查询
  setSearchQuery: (query) => {
    set({ searchQuery: query })
  },
  
  // 切换只看未打卡
  toggleShowOnlyUnchecked: () => {
    set(state => ({ showOnlyUnchecked: !state.showOnlyUnchecked }))
  }
})