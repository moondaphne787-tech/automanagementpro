import type { ClassRecord, LessonPlan } from '@/types'
import { generateId, ipcQuery, ipcQueryOne } from './utils'

// 课堂记录操作
export const classRecordDb = {
  async create(data: {
    student_id: string
    class_date: string
    duration_hours?: number
    teacher_name?: string
    attendance?: 'present' | 'absent' | 'late'
    tasks: unknown[]
    task_completed?: 'completed' | 'partial' | 'not_completed'
    incomplete_reason?: string
    performance?: 'excellent' | 'good' | 'needs_improvement'
    detail_feedback?: string
    highlights?: string
    issues?: string
    checkin_completed?: boolean
    phase_id?: string
    plan_id?: string  // 关联的课程计划ID
    imported_from_excel?: boolean
  }): Promise<ClassRecord> {
    const id = generateId()
    const now = new Date().toISOString()
    
    // 如果没有指定 plan_id，尝试自动关联同日期的计划
    let planId = data.plan_id || null
    if (!planId) {
      const plan = await ipcQueryOne<{ id: string }>(
        `SELECT id FROM lesson_plans WHERE student_id = ? AND plan_date = ? LIMIT 1`,
        [data.student_id, data.class_date]
      )
      planId = plan?.id || null
    }
    
    await ipcQuery(
      `INSERT INTO class_records (id, student_id, class_date, duration_hours, teacher_name, attendance, tasks, task_completed, incomplete_reason, performance, detail_feedback, highlights, issues, checkin_completed, phase_id, plan_id, imported_from_excel, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, 
        data.student_id, 
        data.class_date, 
        data.duration_hours || 1, 
        data.teacher_name || null,
        data.attendance || 'present',
        JSON.stringify(data.tasks),
        data.task_completed || 'completed',
        data.incomplete_reason || null,
        data.performance || 'good',
        data.detail_feedback || null,
        data.highlights || null,
        data.issues || null,
        data.checkin_completed ? 1 : 0,
        data.phase_id || null,
        planId,
        data.imported_from_excel ? 1 : 0,
        now
      ]
    )
    
    const result = await this.getById(id)
    if (!result) throw new Error('Failed to create class record')
    return result
  },
  
  async getById(id: string): Promise<ClassRecord | undefined> {
    const record = await ipcQueryOne<any>(`SELECT * FROM class_records WHERE id = ?`, [id])
    if (record) {
      record.tasks = JSON.parse(record.tasks || '[]')
      record.checkin_completed = !!record.checkin_completed
      record.imported_from_excel = !!record.imported_from_excel
      record.plan_id = record.plan_id || null
    }
    return record as ClassRecord | undefined
  },
  
  async getByStudentId(studentId: string, limit?: number): Promise<ClassRecord[]> {
    let sql = `SELECT * FROM class_records WHERE student_id = ? ORDER BY class_date DESC`
    if (limit) {
      sql += ` LIMIT ${limit}`
    }
    const records = await ipcQuery<any[]>(sql, [studentId])
    return records.map(record => {
      record.tasks = JSON.parse(record.tasks || '[]')
      record.checkin_completed = !!record.checkin_completed
      record.imported_from_excel = !!record.imported_from_excel
      record.plan_id = record.plan_id || null
      return record as ClassRecord
    })
  },
  
  // 获取课堂记录及关联的计划信息
  async getWithPlan(studentId: string, limit?: number): Promise<(ClassRecord & { plan?: LessonPlan })[]> {
    let sql = `
      SELECT cr.*, lp.id as plan_id_ref, lp.tasks as plan_tasks, lp.notes as plan_notes, lp.ai_reason as plan_ai_reason
      FROM class_records cr
      LEFT JOIN lesson_plans lp ON cr.plan_id = lp.id
      WHERE cr.student_id = ?
      ORDER BY cr.class_date DESC
    `
    if (limit) {
      sql += ` LIMIT ${limit}`
    }
    const records = await ipcQuery<any[]>(sql, [studentId])
    return records.map(record => {
      const classRecord: ClassRecord & { plan?: LessonPlan } = {
        id: record.id,
        student_id: record.student_id,
        class_date: record.class_date,
        duration_hours: record.duration_hours,
        teacher_name: record.teacher_name,
        attendance: record.attendance,
        tasks: JSON.parse(record.tasks || '[]'),
        task_completed: record.task_completed,
        incomplete_reason: record.incomplete_reason,
        performance: record.performance,
        detail_feedback: record.detail_feedback,
        highlights: record.highlights,
        issues: record.issues,
        checkin_completed: !!record.checkin_completed,
        phase_id: record.phase_id,
        plan_id: record.plan_id || null,
        imported_from_excel: !!record.imported_from_excel,
        created_at: record.created_at
      }
      
      if (record.plan_id_ref) {
        classRecord.plan = {
          id: record.plan_id_ref,
          student_id: record.student_id,
          phase_id: null,
          plan_date: record.class_date,
          tasks: JSON.parse(record.plan_tasks || '[]'),
          notes: record.plan_notes,
          ai_reason: record.plan_ai_reason,
          generated_by_ai: false,
          created_at: ''
        }
      }
      
      return classRecord
    })
  },
  
  async update(id: string, data: Partial<ClassRecord>): Promise<ClassRecord | undefined> {
    const fields: string[] = []
    const values: unknown[] = []
    
    for (const [key, value] of Object.entries(data)) {
      if (key === 'tasks') {
        fields.push(`${key} = ?`)
        values.push(JSON.stringify(value))
      } else if (key === 'checkin_completed' || key === 'imported_from_excel') {
        fields.push(`${key} = ?`)
        values.push(value ? 1 : 0)
      } else if (key !== 'id' && key !== 'created_at') {
        fields.push(`${key} = ?`)
        values.push(value)
      }
    }
    
    if (fields.length > 0) {
      values.push(id)
      await ipcQuery(`UPDATE class_records SET ${fields.join(', ')} WHERE id = ?`, values)
    }
    
    return this.getById(id)
  },
  
  async delete(id: string): Promise<void> {
    await ipcQuery(`DELETE FROM class_records WHERE id = ?`, [id])
  },
  
  async getLastClassDate(studentId: string): Promise<string | null> {
    const result = await ipcQueryOne<{ class_date: string }>(
      `SELECT class_date FROM class_records WHERE student_id = ? ORDER BY class_date DESC LIMIT 1`,
      [studentId]
    )
    return result?.class_date || null
  },
  
  async getRecentRecords(studentId: string, count: number = 3): Promise<ClassRecord[]> {
    return this.getByStudentId(studentId, count)
  },
  
  async batchCreate(records: Array<{
    student_id: string
    class_date: string
    duration_hours?: number
    teacher_name?: string
    attendance?: 'present' | 'absent' | 'late'
    tasks: unknown[]
    task_completed?: 'completed' | 'partial' | 'not_completed'
    incomplete_reason?: string
    performance?: 'excellent' | 'good' | 'needs_improvement'
    detail_feedback?: string
    highlights?: string
    issues?: string
    checkin_completed?: boolean
    phase_id?: string
    plan_id?: string
    imported_from_excel?: boolean
  }>): Promise<number> {
    let successCount = 0
    for (const data of records) {
      try {
        await this.create(data)
        successCount++
      } catch (error) {
        console.error('Failed to create class record:', error)
      }
    }
    return successCount
  },
  
  // 批量获取多个学员的课堂记录（解决 N+1 查询问题）
  async getAllForStudents(studentIds: string[], options?: { startDate?: string; endDate?: string }): Promise<Map<string, ClassRecord[]>> {
    if (studentIds.length === 0) return new Map()
    
    const placeholders = studentIds.map(() => '?').join(',')
    let sql = `SELECT * FROM class_records WHERE student_id IN (${placeholders})`
    const params: unknown[] = [...studentIds]
    
    // 添加日期范围过滤
    if (options?.startDate) {
      sql += ` AND class_date >= ?`
      params.push(options.startDate)
    }
    if (options?.endDate) {
      sql += ` AND class_date <= ?`
      params.push(options.endDate)
    }
    
    sql += ` ORDER BY class_date DESC`
    
    const records = await ipcQuery<any[]>(sql, params)
    
    const result = new Map<string, ClassRecord[]>()
    for (const record of records) {
      record.tasks = JSON.parse(record.tasks || '[]')
      record.checkin_completed = !!record.checkin_completed
      record.imported_from_excel = !!record.imported_from_excel
      record.plan_id = record.plan_id || null
      
      if (!result.has(record.student_id)) {
        result.set(record.student_id, [])
      }
      result.get(record.student_id)!.push(record as ClassRecord)
    }
    
    return result
  },
  
  // 按日期范围查询课堂记录
  async getByDateRange(start: string, end: string): Promise<ClassRecord[]> {
    const records = await ipcQuery<any[]>(
      `SELECT * FROM class_records WHERE class_date BETWEEN ? AND ? ORDER BY class_date ASC`,
      [start, end]
    )
    return records.map(record => {
      record.tasks = JSON.parse(record.tasks || '[]')
      record.checkin_completed = !!record.checkin_completed
      record.imported_from_excel = !!record.imported_from_excel
      record.plan_id = record.plan_id || null
      return record as ClassRecord
    })
  },

  // 获取完成率统计（用于成长档案趋势图）
  async getCompletionRateStats(studentId: string, months: number = 6): Promise<{ date: string; total: number; completed: number; rate: number }[]> {
    const startDate = new Date()
    startDate.setMonth(startDate.getMonth() - months)
    const startDateStr = startDate.toISOString().split('T')[0]
    
    const records = await ipcQuery<any[]>(
      `SELECT class_date, task_completed FROM class_records 
       WHERE student_id = ? AND class_date >= ? 
       ORDER BY class_date ASC`,
      [studentId, startDateStr]
    )
    
    // 按周汇总
    const weeklyStats = new Map<string, { total: number; completed: number }>()
    
    records.forEach(record => {
      const date = new Date(record.class_date)
      // 获取周起始日（周六）
      const day = date.getDay()
      const saturday = new Date(date)
      if (day === 0) {
        saturday.setDate(date.getDate() - 1)
      } else if (day !== 6) {
        saturday.setDate(date.getDate() + (6 - day))
      }
      const weekKey = saturday.toISOString().split('T')[0]
      
      const current = weeklyStats.get(weekKey) || { total: 0, completed: 0 }
      current.total += 1
      if (record.task_completed === 'completed') {
        current.completed += 1
      }
      weeklyStats.set(weekKey, current)
    })
    
    // 转换为数组并计算比率
    const result: { date: string; total: number; completed: number; rate: number }[] = []
    weeklyStats.forEach((stats, date) => {
      result.push({
        date,
        total: stats.total,
        completed: stats.completed,
        rate: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0
      })
    })
    
    return result.sort((a, b) => a.date.localeCompare(b.date))
  }
}