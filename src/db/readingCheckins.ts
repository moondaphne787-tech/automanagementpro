/**
 * 朗读打卡数据库访问层
 */

import { ipcQuery, ipcQueryOne } from './utils'

// 打卡记录行类型
export interface ReadingCheckinRow {
  id: string
  name: string
  monthlyCount: number
  checkedToday: boolean
}

// 月度统计返回类型
export interface MonthSummaryResult {
  students: ReadingCheckinRow[]
  totalStudents: number
  todayCheckedCount: number
  today: string
}

/**
 * 获取某月所有在读学员的打卡统计
 */
export async function getMonthSummary(year: number, month: number): Promise<MonthSummaryResult> {
  const today = new Date().toISOString().split('T')[0]
  const monthPrefix = `${year}-${String(month).padStart(2, '0')}%`
  
  const result = await ipcQuery<any[]>(
    `SELECT
      s.id,
      s.name,
      COUNT(rc.id) AS monthly_count,
      MAX(CASE WHEN rc.checked_date = ? THEN 1 ELSE 0 END) AS checked_today
    FROM students s
    LEFT JOIN reading_checkins rc
      ON rc.student_id = s.id
      AND rc.checked_date LIKE ?
    WHERE s.status = 'active'
    GROUP BY s.id
    ORDER BY 
      MAX(CASE WHEN rc.checked_date = ? THEN 1 ELSE 0 END) ASC,
      s.name ASC`,
    [today, monthPrefix, today]
  )
  
  // 获取在读学员总数
  const totalResult = await ipcQueryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM students WHERE status = 'active'`
  )
  
  // 获取今日已打卡人数
  const todayResult = await ipcQueryOne<{ count: number }>(
    `SELECT COUNT(DISTINCT student_id) as count 
     FROM reading_checkins 
     WHERE checked_date = ?`,
    [today]
  )
  
  // 转换字段名
  return {
    students: result.map((row) => ({
      id: row.id,
      name: row.name,
      monthlyCount: row.monthly_count,
      checkedToday: row.checked_today === 1
    })),
    totalStudents: totalResult?.count ?? 0,
    todayCheckedCount: todayResult?.count ?? 0,
    today
  }
}

/**
 * 今日打卡
 */
export async function checkToday(studentId: string): Promise<{ success: boolean; inserted: boolean; today: string }> {
  const today = new Date().toISOString().split('T')[0]
  
  const result = await ipcQuery<{ changes: number }>(
    `INSERT OR IGNORE INTO reading_checkins (student_id, checked_date) VALUES (?, ?)`,
    [studentId, today]
  )
  
  return {
    success: true,
    inserted: result.changes > 0,
    today
  }
}

/**
 * 撤销今日打卡
 */
export async function uncheckToday(studentId: string): Promise<{ success: boolean; deleted: boolean; today: string }> {
  const today = new Date().toISOString().split('T')[0]
  
  const result = await ipcQuery<{ changes: number }>(
    `DELETE FROM reading_checkins WHERE student_id = ? AND checked_date = ?`,
    [studentId, today]
  )
  
  return {
    success: true,
    deleted: result.changes > 0,
    today
  }
}

// 导出为 db 对象
export const readingCheckinDb = {
  getMonthSummary,
  checkToday,
  uncheckToday
}