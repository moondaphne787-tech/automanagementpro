/**
 * 朗读打卡独立 Store
 *
 * 从 appStore 中拆分出来，避免频繁的打卡状态变更触发其他 slice 的 selector 重新计算。
 *
 * 支持点击日历日期切换 targetDate，实现补录功能。
 * 默认 targetDate 为昨日。
 */

import { create } from 'zustand'
import type { ReadingCheckinSlice } from './types'
import { readingCheckinDb } from '@/db/readingCheckins'
import { toast } from 'sonner'

// 从 types 中重新导出 CheckinStudent，保持向后兼容
export type { CheckinStudent } from './types'

function getYesterdayDate(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toISOString().split('T')[0]
}

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

  // 目标日期，默认昨日
  targetDate: getYesterdayDate(),

  // 每日打卡人数统计
  dailyCheckinCounts: [],
  showDailyView: false,

  searchQuery: '',
  showOnlyUnchecked: false,
  selectedStudentIds: new Set<string>(),

  // 设置选中的月份（重置 targetDate 为昨日）
  setSelectedMonth: (year, month) => {
    set({ selectedYear: year, selectedMonth: month, targetDate: getYesterdayDate() })
    get().fetchMonthSummary()
    if (get().showDailyView) {
      get().fetchDailyCheckinCounts()
    }
  },

  // 设置目标日期（点击日历日期时调用）
  setTargetDate: (date) => {
    set({ targetDate: date })
    get().fetchMonthSummary()
  },

  // 重置为昨日
  resetTargetDate: () => {
    const yesterday = getYesterdayDate()
    const y = new Date()
    y.setDate(y.getDate() - 1)
    set({
      targetDate: yesterday,
      selectedYear: y.getFullYear(),
      selectedMonth: y.getMonth() + 1
    })
    get().fetchMonthSummary()
    if (get().showDailyView) {
      get().fetchDailyCheckinCounts()
    }
  },

  // 获取月度打卡统计
  fetchMonthSummary: async () => {
    set({ checkinLoading: true })

    try {
      const { selectedYear, selectedMonth, targetDate } = get()
      const result = await readingCheckinDb.getMonthSummary(selectedYear, selectedMonth, targetDate)

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

  // 为目标日期打卡（乐观更新）
  checkYesterday: async (studentId, studentName) => {
    const { checkinStudents, yesterdayCheckedCount, targetDate } = get()

    // 不允许为未来日期打卡
    const today = new Date().toISOString().split('T')[0]
    if (targetDate > today) {
      toast.error('不能为未来日期打卡')
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
      await readingCheckinDb.checkForDate(studentId, targetDate)
      const dateLabel = formatDateLabel(targetDate)
      toast.success(`${studentName} ${dateLabel}打卡已记录`)
    } catch (error) {
      console.error('Failed to check:', error)
      set({
        checkinStudents: oldStudents,
        yesterdayCheckedCount: oldCount
      })
      toast.error('打卡失败，请重试')
    }
  },

  // 撤销目标日期打卡（乐观更新）
  uncheckYesterday: async (studentId, studentName) => {
    const { checkinStudents, yesterdayCheckedCount, targetDate } = get()

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
      await readingCheckinDb.uncheckForDate(studentId, targetDate)
      const dateLabel = formatDateLabel(targetDate)
      toast.success(`${studentName} ${dateLabel}打卡已撤销`)
    } catch (error) {
      console.error('Failed to uncheck:', error)
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

  // 批量为目标日期打卡（乐观更新）
  batchCheckYesterday: async () => {
    const { checkinStudents, yesterdayCheckedCount, selectedStudentIds, targetDate } = get()

    const today = new Date().toISOString().split('T')[0]
    if (targetDate > today) {
      toast.error('不能为未来日期打卡')
      return
    }

    const ids = Array.from(selectedStudentIds)
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
      await readingCheckinDb.batchCheckForDate(Array.from(uncheckedIds), targetDate)
      const dateLabel = formatDateLabel(targetDate)
      toast.success(`已为 ${uncheckedIds.size} 名学员记录${dateLabel}打卡`)
    } catch (error) {
      console.error('Failed to batch check:', error)
      set({
        checkinStudents: oldStudents,
        yesterdayCheckedCount: oldCount
      })
      toast.error('批量打卡失败，请重试')
    }
  },

  // 获取每日打卡人数统计
  fetchDailyCheckinCounts: async () => {
    try {
      const { selectedYear, selectedMonth } = get()
      const counts = await readingCheckinDb.getDailyCheckinCounts(selectedYear, selectedMonth)
      set({ dailyCheckinCounts: counts })
    } catch (error) {
      console.error('Failed to fetch daily checkin counts:', error)
    }
  },

  // 切换日历视图显示
  toggleDailyView: () => {
    const willShow = !get().showDailyView
    set({ showDailyView: willShow })
    if (willShow) {
      get().fetchDailyCheckinCounts()
    }
  }
}))

/** 格式化日期标签用于 toast */
function formatDateLabel(date: string): string {
  const yesterday = getYesterdayDate()
  if (date === yesterday) return '昨日'
  const parts = date.split('-')
  return `${parseInt(parts[1])}月${parseInt(parts[2])}日`
}
