import type { Student, Billing, FilterOptions, SortOptions } from '@/types'
import type { StudentRow, StudentWithBillingRow } from './utils'
import { generateId, ipcQuery, ipcQueryOne, ipcTransaction, mapStudent, isAllowedField, STUDENT_UPDATABLE_FIELDS } from './utils'

// 学员操作
export const studentDb = {
  async create(data: Omit<Student, 'id' | 'created_at' | 'updated_at'>): Promise<Student> {
    const id = generateId()
    const now = new Date().toISOString()
    
    await ipcQuery(
      `INSERT INTO students (id, student_no, name, school, grade, account, enroll_date, student_type, status, level, initial_score, initial_vocab, phonics_progress, phonics_completed, ipa_completed, reading_progress, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.student_no, data.name, data.school, data.grade, data.account, data.enroll_date, data.student_type, data.status, data.level, data.initial_score, data.initial_vocab, data.phonics_progress, data.phonics_completed ? 1 : 0, data.ipa_completed ? 1 : 0, data.reading_progress, data.notes, now, now]
    )
    
    // 创建课时记录
    await ipcQuery(
      `INSERT INTO billing (id, student_id, total_hours, used_hours, warning_threshold, created_at, updated_at)
       VALUES (?, ?, 0, 0, 10, ?, ?)`,
      [generateId(), id, now, now]
    )
    
    const result = await this.getById(id)
    if (!result) throw new Error('Failed to create student')
    return result
  },
  
  async getById(id: string): Promise<Student | undefined> {
    const student = await ipcQueryOne<StudentRow>(`SELECT * FROM students WHERE id = ?`, [id])
    return student ? mapStudent(student) : undefined
  },
  
  async getAllWithBilling(filters: FilterOptions, sort: SortOptions): Promise<(Student & { billing: Billing | null })[]> {
    // remaining_hours 是 billing 表的生成列，会自动计算 total_hours - used_hours
    let sql = `
      SELECT s.*, b.id as billing_id, b.total_hours, b.used_hours, b.remaining_hours, b.warning_threshold, b.last_payment_date,
        (SELECT MAX(cr.class_date) FROM class_records cr WHERE cr.student_id = s.id) as last_class_date
      FROM students s
      LEFT JOIN billing b ON s.id = b.student_id
      WHERE 1=1
    `
    const params: unknown[] = []
    
    if (filters.status !== 'all') {
      sql += ` AND s.status = ?`
      params.push(filters.status)
    }
    if (filters.student_type !== 'all') {
      sql += ` AND s.student_type = ?`
      params.push(filters.student_type)
    }
    if (filters.level !== 'all') {
      sql += ` AND s.level = ?`
      params.push(filters.level)
    }
    if (filters.grade !== 'all') {
      sql += ` AND s.grade = ?`
      params.push(filters.grade)
    }
    if (filters.search) {
      sql += ` AND (s.name LIKE ? OR s.student_no LIKE ?)`
      params.push(`%${filters.search}%`, `%${filters.search}%`)
    }
    
    // 按周几筛选有课学员：同时查询偏好表和已排课记录
    // 偏好表存储 day_of_week，排课表存储 class_date（需要计算星期几）
    if (filters.day_of_week !== 'all') {
      // SQLite 使用 strftime('%w', class_date) 计算星期几
      // %w: 0=周日, 1=周一, 2=周二, 3=周三, 4=周四, 5=周五, 6=周六
      const dayOfWeekMap: Record<string, number> = {
        'sunday': 0,
        'monday': 1,
        'tuesday': 2,
        'wednesday': 3,
        'thursday': 4,
        'friday': 5,
        'saturday': 6
      }
      const dayNum = dayOfWeekMap[filters.day_of_week]
      const today = new Date().toISOString().split('T')[0]
      sql += ` AND (
        EXISTS (SELECT 1 FROM student_schedule_preferences ssp WHERE ssp.student_id = s.id AND ssp.day_of_week = ?)
        OR EXISTS (SELECT 1 FROM scheduled_classes sc WHERE sc.student_id = s.id AND sc.status = 'scheduled' AND sc.class_date >= ? AND strftime('%w', sc.class_date) = ?)
      )`
      params.push(filters.day_of_week, today, String(dayNum))
    }
    
    // 排序
    const sortFieldMap: Record<string, string> = {
      student_no: 's.student_no',
      total_hours: 'b.total_hours',
      remaining_hours: 'b.remaining_hours',  // 使用 v11 添加的生成列
      enroll_date: 's.enroll_date',
      last_class: `(SELECT IFNULL(MAX(cr.class_date), '1970-01-01') FROM class_records cr WHERE cr.student_id = s.id)`
    }
    sql += ` ORDER BY ${sortFieldMap[sort.field] || 's.student_no'} ${sort.direction === 'desc' ? 'DESC' : 'ASC'}`
    
    const results = await ipcQuery<StudentWithBillingRow[]>(sql, params)
    
    return results.map((row) => ({
      ...mapStudent(row),
      billing: row.billing_id ? {
        id: row.billing_id,
        student_id: row.id,
        total_hours: row.total_hours || 0,
        used_hours: row.used_hours || 0,
        remaining_hours: row.remaining_hours ?? 0,
        warning_threshold: row.warning_threshold || 10,
        last_payment_date: row.last_payment_date,
        notes: null,
        created_at: row.created_at,
        updated_at: row.updated_at
      } : null,
      last_class_date: row.last_class_date || null
    }))
  },
  
  async update(id: string, data: Partial<Student>): Promise<Student | undefined> {
    const fields: string[] = []
    const values: unknown[] = []
    
    for (const [key, value] of Object.entries(data)) {
      if (!isAllowedField(key, STUDENT_UPDATABLE_FIELDS)) continue
      if (key === 'phonics_completed' || key === 'ipa_completed') {
        fields.push(`${key} = ?`)
        values.push(value ? 1 : 0)
      } else {
        fields.push(`${key} = ?`)
        values.push(value)
      }
    }
    
    if (fields.length > 0) {
      fields.push('updated_at = ?')
      values.push(new Date().toISOString())
      values.push(id)
      
      await ipcQuery(`UPDATE students SET ${fields.join(', ')} WHERE id = ?`, values)
    }
    
    return this.getById(id)
  },
  
  async delete(id: string): Promise<void> {
    // 级联清理所有关联数据，使用事务保证原子性
    await ipcTransaction([
      { sql: `DELETE FROM billing WHERE student_id = ?`, params: [id] },
      { sql: `DELETE FROM class_records WHERE student_id = ?`, params: [id] },
      { sql: `DELETE FROM lesson_plans WHERE student_id = ?`, params: [id] },
      { sql: `DELETE FROM scheduled_classes WHERE student_id = ?`, params: [id] },
      { sql: `DELETE FROM student_schedule_preferences WHERE student_id = ?`, params: [id] },
      { sql: `DELETE FROM exam_scores WHERE student_id = ?`, params: [id] },
      { sql: `DELETE FROM student_wordbank_progress WHERE student_id = ?`, params: [id] },
      { sql: `DELETE FROM learning_phases WHERE student_id = ?`, params: [id] },
      { sql: `DELETE FROM reading_checkins WHERE student_id = ?`, params: [id] },
      { sql: `DELETE FROM trial_conversions WHERE student_id = ?`, params: [id] },
      // todos 的 student_id 置空而非删除，保留待办事项本身
      { sql: `UPDATE todos SET student_id = NULL WHERE student_id = ?`, params: [id] },
      // 最后删除学员主记录
      { sql: `DELETE FROM students WHERE id = ?`, params: [id] },
    ])
  },

  async getAll(): Promise<Student[]> {
    const results = await ipcQuery<StudentRow[]>(`SELECT * FROM students ORDER BY name ASC`)
    return results.map(mapStudent)
  }
}
