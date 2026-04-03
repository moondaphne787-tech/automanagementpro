/**
 * 朗读打卡独立 Store
 * 
 * 从 appStore 中拆分出来，避免频繁的打卡状态变更触发其他 slice 的 selector 重新计算。
 * 
 * 注意：统计逻辑使用"昨日"日期，因为有些学生晚上10点后才打卡，
 * 第二天统计前一天的数据更完整。
 */

import { create } from 'zustand'
import type { ReadingCheckinSlice } from './types'
import { readingCheckinDb } from '@/db/readingCheckins'
import { toast } from 'sonner'

// 从 types 中重新导出 CheckinStudent，保持向后兼容
export type { CheckinStudent } from './types'

export const useReadingCheckinStore = create<ReadingCheckinSlice>()((set, get) => ({
  // 初始状态
  selectedYear: new Date().getFullYear(),
  selectedMonth: new Date().getMonth() + 1,
  checkinStudents: [],
  totalStudents: 0,
  yesterdayCheckedCount: 0,
  yesterdayDate: '',
  todayDate: '',
  checkinLoading: false,
  
  searchQuery: '',
  showOnlyUnchecked: false,
  selectedStudentIds: new Set<string>(),
  
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
        yesterdayCheckedCount: result.yesterdayCheckedCount,
        yesterdayDate: result.yesterday,
        todayDate: result.today,
        checkinLoading: false
      })
    } catch (error) {
      console.error('Failed to fetch month summary:', error)
      set({ checkinLoading: false })
      toast.error('加载打卡数据失败')
    }
  },
  
  // 昨日打卡（乐观更新）
  checkYesterday: async (studentId, studentName) => {
    const { checkinStudents, yesterdayCheckedCount, selectedYear, selectedMonth } = get()
    
    const currentYear = new Date().getFullYear()
    const currentMonth = new Date().getMonth() + 1
    const isCurrentMonth = selectedYear === currentYear && selectedMonth === currentMonth
    
    if (!isCurrentMonth) {
      toast.error('只能在当前月份进行打卡操作')
      return
    }
    
    const oldStudents = [...checkinStudents]
    const oldCount = yesterdayCheckedCount
    
    const updatedStudents = checkinStudents.map(student => {
      if (student.id === studentId) {
        return {
          ...student,
          monthlyCount: student.monthlyCount + 1,
          checkedYesterday: true
        }
      }
      return student
    })
    
    const sortedStudents = [...updatedStudents].sort((a, b) => {
      if (a.checkedYesterday !== b.checkedYesterday) {
        return a.checkedYesterday ? 1 : -1
      }
      return a.name.localeCompare(b.name, 'zh-CN')
    })
    
    set({
      checkinStudents: sortedStudents,
      yesterdayCheckedCount: oldCount + 1
    })
    
    try {
      await readingCheckinDb.checkYesterday(studentId)
      toast.success(`${studentName} 昨日打卡已记录`)
    } catch (error) {
      console.error('Failed to check yesterday:', error)
      set({
        checkinStudents: oldStudents,
        yesterdayCheckedCount: oldCount
      })
      toast.error('打卡失败，请重试')
    }
  },
  
  // 撤销昨日打卡（乐观更新）
  uncheckYesterday: async (studentId, studentName) => {
    const { checkinStudents, yesterdayCheckedCount, selectedYear, selectedMonth } = get()
    
    const currentYear = new Date().getFullYear()
    const currentMonth = new Date().getMonth() + 1
    const isCurrentMonth = selectedYear === currentYear && selectedMonth === currentMonth
    
    if (!isCurrentMonth) {
      toast.error('只能在当前月份撤销打卡')
      return
    }
    
    const oldStudents = [...checkinStudents]
    const oldCount = yesterdayCheckedCount
    
    const updatedStudents = checkinStudents.map(student => {
      if (student.id === studentId) {
        return {
          ...student,
          monthlyCount: student.monthlyCount - 1,
          checkedYesterday: false
        }
      }
      return student
    })
    
    const sortedStudents = [...updatedStudents].sort((a, b) => {
      if (a.checkedYesterday !== b.checkedYesterday) {
        return a.checkedYesterday ? 1 : -1
      }
      return a.name.localeCompare(b.name, 'zh-CN')
    })
    
    set({
      checkinStudents: sortedStudents,
      yesterdayCheckedCount: oldCount - 1
    })
    
    try {
      await readingCheckinDb.uncheckYesterday(studentId)
      toast.success(`${studentName} 昨日打卡已撤销`)
    } catch (error) {
      console.error('Failed to uncheck yesterday:', error)
      set({
        checkinStudents: oldStudents,
        yesterdayCheckedCount: oldCount
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
  },

  // 切换选中某个学员
  toggleSelectStudent: (studentId) => {
    set(state => {
      const next = new Set(state.selectedStudentIds)
      if (next.has(studentId)) {
        next.delete(studentId)
      } else {
        next.add(studentId)
      }
      return { selectedStudentIds: next }
    })
  },

  // 全选当前过滤列表中未打卡的学员
  selectAllUnchecked: (filteredIds) => {
    const { checkinStudents } = get()
    const uncheckedIds = checkinStudents
      .filter(s => !s.checkedYesterday && filteredIds.includes(s.id))
      .map(s => s.id)
    set({ selectedStudentIds: new Set(uncheckedIds) })
  },

  // 清空选择
  clearSelection: () => {
    set({ selectedStudentIds: new Set<string>() })
  },

  // 批量昨日打卡（乐观更新）
  batchCheckYesterday: async () => {
    const { checkinStudents, yesterdayCheckedCount, selectedStudentIds, selectedYear, selectedMonth } = get()

    const currentYear = new Date().getFullYear()
    const currentMonth = new Date().getMonth() + 1
    const isCurrentMonth = selectedYear === currentYear && selectedMonth === currentMonth

    if (!isCurrentMonth) {
      toast.error('只能在当前月份进行打卡操作')
      return
    }

    const ids = Array.from(selectedStudentIds)
    // 只对未打卡的学员执行
    const uncheckedIds = new Set(
      checkinStudents.filter(s => ids.includes(s.id) && !s.checkedYesterday).map(s => s.id)
    )

    if (uncheckedIds.size === 0) {
      toast.info('所选学员均已打卡')
      return
    }

    const oldStudents = [...checkinStudents]
    const oldCount = yesterdayCheckedCount

    const updatedStudents = checkinStudents.map(student => {
      if (uncheckedIds.has(student.id)) {
        return { ...student, monthlyCount: student.monthlyCount + 1, checkedYesterday: true }
      }
      return student
    })

    const sortedStudents = [...updatedStudents].sort((a, b) => {
      if (a.checkedYesterday !== b.checkedYesterday) return a.checkedYesterday ? 1 : -1
      return a.name.localeCompare(b.name, 'zh-CN')
    })

    set({
      checkinStudents: sortedStudents,
      yesterdayCheckedCount: oldCount + uncheckedIds.size,
      selectedStudentIds: new Set<string>()
    })

    try {
      await readingCheckinDb.batchCheckYesterday(Array.from(uncheckedIds))
      toast.success(`已为 ${uncheckedIds.size} 名学员记录昨日打卡`)
    } catch (error) {
      console.error('Failed to batch check yesterday:', error)
      set({
        checkinStudents: oldStudents,
        yesterdayCheckedCount: oldCount
      })
      toast.error('批量打卡失败，请重试')
    }
  }
}))
