import type { ClassRecord, LessonPlan } from '@/types'
import type { ClassRecordRow, ClassRecordWithPlanRow } from './utils'
import { generateId, ipcQuery, ipcQueryOne, ipcTransaction, mapClassRecord, parseTasks, isAllowedField, CLASS_RECORD_UPDATABLE_FIELDS } from './utils'

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
    const record = await ipcQueryOne<ClassRecordRow>(`SELECT * FROM class_records WHERE id = ?`, [id])
    return record ? mapClassRecord(record) : undefined
  },
  
  async getByStudentId(studentId: string, limit?: number): Promise<ClassRecord[]> {
    let sql = `SELECT * FROM class_records WHERE student_id = ? ORDER BY class_date DESC`
    if (limit) {
      sql += ` LIMIT ${limit}`
    }
    const records = await ipcQuery<ClassRecordRow[]>(sql, [studentId])
    return records.map(mapClassRecord)
  },
  
  // 获取课堂记录及关联的计划信息
  async getWithPlan(studentId: string, options?: { startDate?: string; endDate?: string; limit?: number }): Promise<(ClassRecord & { plan?: LessonPlan })[]> {
    let sql = `
      SELECT cr.*, lp.id as plan_id_ref, lp.tasks as plan_tasks, lp.notes as plan_notes, lp.ai_reason as plan_ai_reason
      FROM class_records cr
      LEFT JOIN lesson_plans lp ON cr.plan_id = lp.id
      WHERE cr.student_id = ?
    `
    const params: unknown[] = [studentId]
    
    // 添加日期范围过滤
    if (options?.startDate) {
      sql += ` AND cr.class_date >= ?`
      params.push(options.startDate)
    }
    if (options?.endDate) {
      sql += ` AND cr.class_date <= ?`
      params.push(options.endDate)
    }
    
    sql += ` ORDER BY cr.class_date DESC`
    
    if (options?.limit) {
      sql += ` LIMIT ${options.limit}`
    }
    
    const records = await ipcQuery<ClassRecordWithPlanRow[]>(sql, params)
    return records.map(record => {
      const classRecord: ClassRecord & { plan?: LessonPlan } = {
        ...mapClassRecord(record),
      }
      
      if (record.plan_id_ref) {
        classRecord.plan = {
          id: record.plan_id_ref,
          student_id: record.student_id,
          phase_id: null,
          plan_date: record.class_date,
          tasks: parseTasks(record.plan_tasks),
          notes: record.plan_notes,
          ai_reason: record.plan_ai_reason,
          generated_by_ai: false,
          plan_status_json: null,
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
      if (!isAllowedField(key, CLASS_RECORD_UPDATABLE_FIELDS)) continue
      if (key === 'tasks') {
        fields.push(`${key} = ?`)
        values.push(JSON.stringify(value))
      } else if (key === 'checkin_completed' || key === 'imported_from_excel') {
        fields.push(`${key} = ?`)
        values.push(value ? 1 : 0)
      } else {
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
    
    const records = await ipcQuery<ClassRecordRow[]>(sql, params)
    
    const result = new Map<string, ClassRecord[]>()
    for (const record of records) {
      const mapped = mapClassRecord(record)
      if (!result.has(mapped.student_id)) {
        result.set(mapped.student_id, [])
      }
      result.get(mapped.student_id)!.push(mapped)
    }
    
    return result
  },
  
  // 按日期范围查询课堂记录
  async getByDateRange(start: string, end: string): Promise<ClassRecord[]> {
    const records = await ipcQuery<ClassRecordRow[]>(
      `SELECT * FROM class_records WHERE class_date BETWEEN ? AND ? ORDER BY class_date ASC`,
      [start, end]
    )
    return records.map(mapClassRecord)
  },

  // 获取所有课堂记录（用于导出）
  async getAll(): Promise<ClassRecord[]> {
    const records = await ipcQuery<ClassRecordRow[]>(
      `SELECT * FROM class_records ORDER BY class_date DESC`
    )
    return records.map(mapClassRecord)
  },

  /**
   * 原子性地创建课堂记录并更新课时
   * 使用数据库事务确保课堂记录插入和课时更新的原子性
   * 如果中途失败，两者都会回滚
   * @param data 课堂记录数据
   * @param billingUpdate 课时更新数据（可选，如果提供则与记录创建在同一事务中执行）
   * @returns 创建的课堂记录
   */
  async createWithBillingUpdate(data: {
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
  }, billingUpdate?: {
    student_id: string
    used_hours_delta: number  // 课时变化量（正数表示增加已用课时）
  }): Promise<ClassRecord> {
    const id = generateId()
    const now = new Date().toISOString()
    
    // 如果没有指定 plan_id，尝试自动关联同日期的计划（事务前查询）
    let planId = data.plan_id || null
    if (!planId) {
      const plan = await ipcQueryOne<{ id: string }>(
        `SELECT id FROM lesson_plans WHERE student_id = ? AND plan_date = ? LIMIT 1`,
        [data.student_id, data.class_date]
      )
      planId = plan?.id || null
    }
    
    // 构建事务语句数组
    const statements: Array<{ sql: string; params: unknown[] }> = []
    
    // 1. 插入课堂记录
    statements.push({
      sql: `INSERT INTO class_records (id, student_id, class_date, duration_hours, teacher_name, attendance, tasks, task_completed, incomplete_reason, performance, detail_feedback, highlights, issues, checkin_completed, phase_id, plan_id, imported_from_excel, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [
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
    })
    
    // 2. 更新课时（如果提供了billingUpdate）
    if (billingUpdate && billingUpdate.used_hours_delta > 0) {
      statements.push({
        sql: `UPDATE billing SET used_hours = used_hours + ?, updated_at = ? WHERE student_id = ?`,
        params: [
          billingUpdate.used_hours_delta,
          now,
          billingUpdate.student_id
        ]
      })
    }
    
    // 执行事务
    await ipcTransaction(statements)
    
    // 返回创建的记录
    const result = await this.getById(id)
    if (!result) throw new Error('Failed to create class record')
    return result
  },
  
  /**
   * 批量创建课堂记录并原子性更新课时（使用事务保障）
   * 确保所有记录插入和课时更新要么全部成功，要么全部回滚
   * @param records 课堂记录数组
   * @param billingUpdates 课时更新映射（studentId -> hoursDelta）
   * @returns 成功创建的记录数量
   */
  async batchCreateWithBillingUpdate(
    records: Array<{
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
    }>,
    billingUpdates: Map<string, number>  // studentId -> hoursDelta
  ): Promise<number> {
    if (records.length === 0) return 0
    
    const now = new Date().toISOString()
    const statements: Array<{ sql: string; params: unknown[] }> = []
    
    // 预先查询所有需要的 plan_id（避免事务内嵌套查询）
    const planQueryDates = new Map<string, Set<string>>()  // studentId -> Set<date>
    for (const data of records) {
      if (!data.plan_id) {
        if (!planQueryDates.has(data.student_id)) {
          planQueryDates.set(data.student_id, new Set())
        }
        planQueryDates.get(data.student_id)!.add(data.class_date)
      }
    }
    
    // 批量查询 plan_id
    const planIdMap = new Map<string, string>()  // "studentId:date" -> planId
    for (const [studentId, dates] of planQueryDates) {
      for (const date of dates) {
        const plan = await ipcQueryOne<{ id: string }>(
          `SELECT id FROM lesson_plans WHERE student_id = ? AND plan_date = ? LIMIT 1`,
          [studentId, date]
        )
        if (plan?.id) {
          planIdMap.set(`${studentId}:${date}`, plan.id)
        }
      }
    }
    
    // 构建所有插入语句
    for (const data of records) {
      const id = generateId()
      
      // 获取 plan_id
      let planId = data.plan_id || null
      if (!planId) {
        planId = planIdMap.get(`${data.student_id}:${data.class_date}`) || null
      }
      
      statements.push({
        sql: `INSERT INTO class_records (id, student_id, class_date, duration_hours, teacher_name, attendance, tasks, task_completed, incomplete_reason, performance, detail_feedback, highlights, issues, checkin_completed, phase_id, plan_id, imported_from_excel, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [
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
      })
    }
    
    // 添加课时更新语句
    for (const [studentId, hoursDelta] of billingUpdates) {
      if (hoursDelta > 0) {
        statements.push({
          sql: `UPDATE billing SET used_hours = used_hours + ?, updated_at = ? WHERE student_id = ?`,
          params: [hoursDelta, now, studentId]
        })
      }
    }
    
    // 执行事务
    await ipcTransaction(statements)
    
    return records.length
  },

  // 获取完成率统计（用于成长档案趋势图）
  async getCompletionRateStats(studentId: string, months: number = 6): Promise<{ date: string; total: number; completed: number; rate: number }[]> {
    const startDate = new Date()
    startDate.setMonth(startDate.getMonth() - months)
    const startDateStr = startDate.toISOString().split('T')[0]
    
    const records = await ipcQuery<Pick<ClassRecordRow, 'class_date' | 'task_completed'>[]>(
      `SELECT class_date, task_completed FROM class_records 
       WHERE student_id = ? AND class_date >= ? 
       ORDER BY class_date ASC`,
      [studentId, startDateStr]
    )
    
    // 按周汇总
    const weeklyStats = new Map<string, { total: number; completed: number }>()
    
    records.forEach(record => {
      const date = new Date(record.class_date)
      // 获取周起始日（周一）
      const day = date.getDay()
      const monday = new Date(date)
      const daysToMonday = day === 0 ? 6 : day - 1
      monday.setDate(date.getDate() - daysToMonday)
      const weekKey = monday.toISOString().split('T')[0]
      
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