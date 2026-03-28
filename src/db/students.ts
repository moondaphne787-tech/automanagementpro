import type { Student, Billing, FilterOptions, SortOptions, DayOfWeek } from '@/types'
import { generateId, ipcQuery, ipcQueryOne } from './utils'

// 获取当前日期对应的星期
function getDayOfWeekFromDate(date: Date): DayOfWeek {
  const days: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  return days[date.getDay()]
}

// 学员操作
export const studentDb = {
  async create(data: Omit<Student, 'id' | 'created_at' | 'updated_at'>): Promise<Student> {
    const id = generateId()
    const now = new Date().toISOString()
    
    await ipcQuery(
      `INSERT INTO students (id, student_no, name, school, grade, account, enroll_date, student_type, status, level, initial_score, initial_vocab, phonics_progress, phonics_completed, ipa_completed, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.student_no, data.name, data.school, data.grade, data.account, data.enroll_date, data.student_type, data.status, data.level, data.initial_score, data.initial_vocab, data.phonics_progress, data.phonics_completed ? 1 : 0, data.ipa_completed ? 1 : 0, data.notes, now, now]
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
    const student = await ipcQueryOne<Record<string, unknown>>(`SELECT * FROM students WHERE id = ?`, [id])
    if (student) {
      student.phonics_completed = !!student.phonics_completed
      student.ipa_completed = !!student.ipa_completed
      return student as unknown as Student
    }
    return undefined
  },
  
  async getAllWithBilling(filters: FilterOptions, sort: SortOptions): Promise<(Student & { billing: Billing | null })[]> {
    // remaining_hours 是 billing 表的生成列，会自动计算 total_hours - used_hours
    let sql = `
      SELECT s.*, b.id as billing_id, b.total_hours, b.used_hours, b.remaining_hours, b.warning_threshold, b.last_payment_date
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
      sql += ` AND s.name LIKE ?`
      params.push(`%${filters.search}%`)
    }
    
    // 按周几筛选有课学员
    if (filters.day_of_week !== 'all') {
      sql += ` AND EXISTS (SELECT 1 FROM student_schedule_preferences ssp WHERE ssp.student_id = s.id AND ssp.day_of_week = ?)`
      params.push(filters.day_of_week)
    }
    
    // 排序
    const sortFieldMap: Record<string, string> = {
      student_no: 's.student_no',
      total_hours: 'b.total_hours',
      remaining_hours: 'b.total_hours - b.used_hours',
      enroll_date: 's.enroll_date',
      last_class: `(SELECT IFNULL(MAX(cr.class_date), '1970-01-01') FROM class_records cr WHERE cr.student_id = s.id)`
    }
    sql += ` ORDER BY ${sortFieldMap[sort.field] || 's.student_no'} ${sort.direction === 'desc' ? 'DESC' : 'ASC'}`
    
    const results = await ipcQuery(sql, params) as any[]
    
    return results.map((row: any) => {
      const student: Student & { billing: Billing | null } = {
        id: row.id,
        student_no: row.student_no,
        name: row.name,
        school: row.school,
        grade: row.grade,
        account: row.account,
        enroll_date: row.enroll_date,
        student_type: row.student_type,
        status: row.status,
        level: row.level,
        initial_score: row.initial_score,
        initial_vocab: row.initial_vocab,
        phonics_progress: row.phonics_progress,
        phonics_completed: !!row.phonics_completed,
        ipa_completed: !!row.ipa_completed,
        notes: row.notes,
        created_at: row.created_at,
        updated_at: row.updated_at,
        billing: row.billing_id ? {
          id: row.billing_id,
          student_id: row.id,
          total_hours: row.total_hours || 0,
          used_hours: row.used_hours || 0,
          // remaining_hours 是生成列，直接从查询结果获取
          remaining_hours: row.remaining_hours ?? (row.total_hours || 0) - (row.used_hours || 0),
          warning_threshold: row.warning_threshold || 10,
          last_payment_date: row.last_payment_date,
          notes: null,
          created_at: row.created_at,
          updated_at: row.updated_at
        } : null
      }
      return student
    })
  },
  
  async update(id: string, data: Partial<Student>): Promise<Student | undefined> {
    const fields: string[] = []
    const values: unknown[] = []
    
    for (const [key, value] of Object.entries(data)) {
      if (key === 'phonics_completed' || key === 'ipa_completed') {
        fields.push(`${key} = ?`)
        values.push(value ? 1 : 0)
      } else if (key !== 'id' && key !== 'created_at') {
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
    await ipcQuery(`DELETE FROM students WHERE id = ?`, [id])
  },

  async getAll(): Promise<Student[]> {
    const results = await ipcQuery<Record<string, unknown>[]>(`SELECT * FROM students ORDER BY name ASC`)
    return results.map(row => {
      row.phonics_completed = !!row.phonics_completed
      row.ipa_completed = !!row.ipa_completed
      return row as unknown as Student
    })
  }
}
