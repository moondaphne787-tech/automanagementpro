/**
 * 朗读打卡数据库访问层
 * 
 * 注意：统计逻辑使用"昨日"日期，因为有些学生晚上10点后才打卡，
 * 第二天统计前一天的数据更完整。
 * 
 * P2-4 修复：主键使用 UUID TEXT 类型，与其他表保持一致
 */

import type { ReadingCheckinAggRow } from './utils'
import { ipcQuery, ipcQueryOne, generateId } from './utils'

/**
 * 获取昨天的日期字符串 (YYYY-MM-DD)
 */
function getYesterdayDate(): string {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  return yesterday.toISOString().split('T')[0]
}

/**
 * 获取今天的日期字符串 (YYYY-MM-DD)
 */
function getTodayDate(): string {
  return new Date().toISOString().split('T')[0]
}

// 打卡记录行类型
export interface ReadingCheckinRow {
  id: string
  name: string
  monthlyCount: number
  checkedYesterday: boolean  // 改为昨日打卡状态
}

// 月度统计返回类型
export interface MonthSummaryResult {
  students: ReadingCheckinRow[]
  totalStudents: number
  yesterdayCheckedCount: number  // 改为昨日打卡数
  yesterday: string  // 昨日日期
  today: string  // 保留今日日期用于显示
}

/**
 * 获取某月所有在读学员的打卡统计
 * 统计基准日期为昨日（因为学生可能晚上10点后才打卡）
 */
export async function getMonthSummary(year: number, month: number): Promise<MonthSummaryResult> {
  const yesterday = getYesterdayDate()
  const today = getTodayDate()
  const monthPrefix = `${year}-${String(month).padStart(2, '0')}%`
  
  const result = await ipcQuery<ReadingCheckinAggRow[]>(
    `SELECT
      s.id,
      s.name,
      COUNT(rc.id) AS monthly_count,
      MAX(CASE WHEN rc.checked_date = ? THEN 1 ELSE 0 END) AS checked_yesterday
    FROM students s
    LEFT JOIN reading_checkins rc
      ON rc.student_id = s.id
      AND rc.checked_date LIKE ?
    WHERE s.status = 'active'
    GROUP BY s.id
    ORDER BY 
      MAX(CASE WHEN rc.checked_date = ? THEN 1 ELSE 0 END) ASC,
      s.name ASC`,
    [yesterday, monthPrefix, yesterday]
  )
  
  // 获取在读学员总数
  const totalResult = await ipcQueryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM students WHERE status = 'active'`
  )
  
  // 获取昨日已打卡人数
  const yesterdayResult = await ipcQueryOne<{ count: number }>(
    `SELECT COUNT(DISTINCT student_id) as count 
     FROM reading_checkins 
     WHERE checked_date = ?`,
    [yesterday]
  )
  
  // 转换字段名
  return {
    students: result.map((row) => ({
      id: row.id,
      name: row.name,
      monthlyCount: row.monthly_count,
      checkedYesterday: row.checked_yesterday === 1
    })),
    totalStudents: totalResult?.count ?? 0,
    yesterdayCheckedCount: yesterdayResult?.count ?? 0,
    yesterday,
    today
  }
}

/**
 * 为某学生记录昨日打卡
 * 实际插入的是昨天的日期，便于第二天统计前一天的数据
 * 
 * P2-4 修复：INSERT 时传入 UUID 主键，与其他表保持一致
 */
export async function checkYesterday(studentId: string): Promise<{ success: boolean; inserted: boolean; yesterday: string }> {
  const yesterday = getYesterdayDate()
  const id = generateId()  // 生成 UUID 主键
  
  const result = await ipcQuery<{ changes: number }>(
    `INSERT OR IGNORE INTO reading_checkins (id, student_id, checked_date) VALUES (?, ?, ?)`,
    [id, studentId, yesterday]
  )
  
  return {
    success: true,
    inserted: result.changes > 0,
    yesterday
  }
}

/**
 * 批量为多个学生记录昨日打卡
 * 使用事务确保原子性
 */
export async function batchCheckYesterday(studentIds: string[]): Promise<{ success: boolean; insertedCount: number; yesterday: string }> {
  const yesterday = getYesterdayDate()
  let insertedCount = 0

  for (const studentId of studentIds) {
    const id = generateId()
    const result = await ipcQuery<{ changes: number }>(
      `INSERT OR IGNORE INTO reading_checkins (id, student_id, checked_date) VALUES (?, ?, ?)`,
      [id, studentId, yesterday]
    )
    if (result.changes > 0) insertedCount++
  }

  return { success: true, insertedCount, yesterday }
}

/**
 * 撤销昨日打卡记录
 */
export async function uncheckYesterday(studentId: string): Promise<{ success: boolean; deleted: boolean; yesterday: string }> {
  const yesterday = getYesterdayDate()
  
  const result = await ipcQuery<{ changes: number }>(
    `DELETE FROM reading_checkins WHERE student_id = ? AND checked_date = ?`,
    [studentId, yesterday]
  )
  
  return {
    success: true,
    deleted: result.changes > 0,
    yesterday
  }
}

// 导出为 db 对象
export const readingCheckinDb = {
  getMonthSummary,
  checkYesterday,
  batchCheckYesterday,
  uncheckYesterday
}
