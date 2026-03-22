import type { Student, Billing, Wordbank, StudentWordbankProgress, ClassRecord, LessonPlan, ExamScore, LearningPhase, TrialConversion, FilterOptions, SortOptions } from '@/types'

// 初始化数据库 - 在 Electron 中由主进程处理
export async function initDatabase(): Promise<void> {
  // 检查是否在 Electron 环境中
  const isElectron = typeof window !== 'undefined' && window.electronAPI?.isElectron
  
  console.log('initDatabase called, isElectron:', isElectron)
  console.log('window.electronAPI:', window.electronAPI)
  
  if (isElectron) {
    // Electron 环境中，数据库在主进程初始化
    // 测试 IPC 通信是否正常
    try {
      const dbPath = await window.electronAPI!.dbGetPath()
      console.log('Database path:', dbPath)
      console.log('Using Electron main process database (better-sqlite3)')
      return
    } catch (error) {
      console.error('Failed to connect to main process database:', error)
      throw new Error('无法连接到主进程数据库: ' + (error as Error).message)
    }
  }
  
  // 非 Electron 环境（浏览器）暂不支持
  throw new Error('此应用需要 Electron 环境运行，请使用桌面应用版本。')
}

// 辅助函数
function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// IPC 调用包装
async function ipcQuery<T>(sql: string, params: unknown[] = []): Promise<T> {
  if (!window.electronAPI) throw new Error('Electron API not available')
  return window.electronAPI.dbQuery(sql, params) as Promise<T>
}

async function ipcQueryOne<T>(sql: string, params: unknown[] = []): Promise<T | undefined> {
  if (!window.electronAPI) throw new Error('Electron API not available')
  return window.electronAPI.dbQueryOne(sql, params) as Promise<T | undefined>
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
       VALUES (?, ?, 0, 0, 3, ?, ?)`,
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
    let sql = `
      SELECT s.*, b.id as billing_id, b.total_hours, b.used_hours, b.warning_threshold, b.last_payment_date
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
    
    // 排序
    const sortFieldMap: Record<string, string> = {
      student_no: 's.student_no',
      total_hours: 'b.total_hours',
      remaining_hours: 'b.total_hours - b.used_hours',
      enroll_date: 's.enroll_date',
      last_class: 's.updated_at'
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
          remaining_hours: (row.total_hours || 0) - (row.used_hours || 0),
          warning_threshold: row.warning_threshold || 3,
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
  }
}

// 课时操作
export const billingDb = {
  async getByStudentId(studentId: string): Promise<Billing | undefined> {
    const billing = await ipcQueryOne<Billing>(`SELECT *, total_hours - used_hours as remaining_hours FROM billing WHERE student_id = ?`, [studentId])
    return billing
  },
  
  async update(studentId: string, data: Partial<Billing>): Promise<Billing | undefined> {
    const fields: string[] = []
    const values: unknown[] = []
    
    for (const [key, value] of Object.entries(data)) {
      if (key !== 'id' && key !== 'student_id' && key !== 'created_at' && key !== 'remaining_hours') {
        fields.push(`${key} = ?`)
        values.push(value)
      }
    }
    
    if (fields.length > 0) {
      fields.push('updated_at = ?')
      values.push(new Date().toISOString())
      values.push(studentId)
      
      await ipcQuery(`UPDATE billing SET ${fields.join(', ')} WHERE student_id = ?`, values)
    }
    
    return this.getByStudentId(studentId)
  },
  
  async addHours(studentId: string, hours: number): Promise<Billing | undefined> {
    const billing = await this.getByStudentId(studentId)
    if (!billing) return undefined
    
    return this.update(studentId, {
      total_hours: billing.total_hours + hours,
      last_payment_date: new Date().toISOString().split('T')[0]
    })
  }
}

// 词库操作
export const wordbankDb = {
  async getAll(): Promise<Wordbank[]> {
    return ipcQuery<Wordbank[]>(`SELECT * FROM wordbanks ORDER BY sort_order`)
  },
  
  async create(data: Omit<Wordbank, 'id'>): Promise<Wordbank> {
    const id = generateId()
    await ipcQuery(
      `INSERT INTO wordbanks (id, name, total_levels, nine_grid_interval, category, sort_order) VALUES (?, ?, ?, ?, ?, ?)`,
      [id, data.name, data.total_levels, data.nine_grid_interval, data.category, data.sort_order]
    )
    const result = await ipcQueryOne<Wordbank>(`SELECT * FROM wordbanks WHERE id = ?`, [id])
    return result!
  },
  
  async update(id: string, data: Partial<Wordbank>): Promise<Wordbank | undefined> {
    const fields: string[] = []
    const values: unknown[] = []
    
    for (const [key, value] of Object.entries(data)) {
      if (key !== 'id' && key !== 'created_at') {
        fields.push(`${key} = ?`)
        values.push(value)
      }
    }
    
    if (fields.length > 0) {
      values.push(id)
      await ipcQuery(`UPDATE wordbanks SET ${fields.join(', ')} WHERE id = ?`, values)
    }
    
    return ipcQueryOne<Wordbank>(`SELECT * FROM wordbanks WHERE id = ?`, [id])
  },
  
  async delete(id: string): Promise<void> {
    await ipcQuery(`DELETE FROM wordbanks WHERE id = ?`, [id])
  }
}

// 进度操作
export const progressDb = {
  async getByStudentId(studentId: string): Promise<StudentWordbankProgress[]> {
    return ipcQuery<StudentWordbankProgress[]>(
      `SELECT * FROM student_wordbank_progress WHERE student_id = ? ORDER BY created_at`,
      [studentId]
    )
  },
  
  async upsert(data: {
    student_id: string
    wordbank_id: string
    current_level: number
    total_levels_override?: number
    last_nine_grid_level?: number
    status?: 'active' | 'completed' | 'paused'
    notes?: string
  }): Promise<void> {
    const wordbanks = await wordbankDb.getAll()
    const wordbank = wordbanks.find(w => w.id === data.wordbank_id)
    const existing = await ipcQueryOne<StudentWordbankProgress>(
      `SELECT * FROM student_wordbank_progress WHERE student_id = ? AND wordbank_id = ?`,
      [data.student_id, data.wordbank_id]
    )
    
    if (existing) {
      await ipcQuery(
        `UPDATE student_wordbank_progress SET current_level = ?, total_levels_override = ?, last_nine_grid_level = ?, status = ?, notes = ?, updated_at = ? WHERE id = ?`,
        [data.current_level, data.total_levels_override || null, data.last_nine_grid_level || existing.last_nine_grid_level, data.status || 'active', data.notes || null, new Date().toISOString(), existing.id]
      )
    } else {
      const id = generateId()
      const now = new Date().toISOString()
      await ipcQuery(
        `INSERT INTO student_wordbank_progress (id, student_id, wordbank_id, wordbank_label, current_level, total_levels_override, last_nine_grid_level, status, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, data.student_id, data.wordbank_id, wordbank?.name || '未知词库', data.current_level, data.total_levels_override || null, data.last_nine_grid_level || 0, data.status || 'active', data.notes || null, now, now]
      )
    }
  },
  
  async delete(studentId: string, wordbankId: string): Promise<void> {
    await ipcQuery(`DELETE FROM student_wordbank_progress WHERE student_id = ? AND wordbank_id = ?`, [studentId, wordbankId])
  }
}

// 设置操作
export const settingsDb = {
  async get(key: string): Promise<string | null> {
    const result = await ipcQueryOne<{ value: string }>(`SELECT value FROM settings WHERE key = ?`, [key])
    return result?.value || null
  },
  
  async set(key: string, value: string): Promise<void> {
    await ipcQuery(
      `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`,
      [key, value]
    )
  }
}

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
    imported_from_excel?: boolean
  }): Promise<ClassRecord> {
    const id = generateId()
    const now = new Date().toISOString()
    
    await ipcQuery(
      `INSERT INTO class_records (id, student_id, class_date, duration_hours, teacher_name, attendance, tasks, task_completed, incomplete_reason, performance, detail_feedback, highlights, issues, checkin_completed, phase_id, imported_from_excel, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      return record as ClassRecord
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
  }
}

// 课程计划操作
export const lessonPlanDb = {
  async create(data: {
    student_id: string
    phase_id?: string
    plan_date?: string
    tasks: unknown[]
    notes?: string
    ai_reason?: string
    generated_by_ai?: boolean
  }): Promise<LessonPlan> {
    const id = generateId()
    const now = new Date().toISOString()
    
    await ipcQuery(
      `INSERT INTO lesson_plans (id, student_id, phase_id, plan_date, tasks, notes, ai_reason, generated_by_ai, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, 
        data.student_id, 
        data.phase_id || null,
        data.plan_date || null,
        JSON.stringify(data.tasks),
        data.notes || null,
        data.ai_reason || null,
        data.generated_by_ai ? 1 : 0,
        now
      ]
    )
    
    const result = await this.getById(id)
    if (!result) throw new Error('Failed to create lesson plan')
    return result
  },
  
  async getById(id: string): Promise<LessonPlan | undefined> {
    const plan = await ipcQueryOne<any>(`SELECT * FROM lesson_plans WHERE id = ?`, [id])
    if (plan) {
      plan.tasks = JSON.parse(plan.tasks || '[]')
      plan.generated_by_ai = !!plan.generated_by_ai
    }
    return plan as LessonPlan | undefined
  },
  
  async getByStudentId(studentId: string): Promise<LessonPlan[]> {
    const plans = await ipcQuery<any[]>(
      `SELECT * FROM lesson_plans WHERE student_id = ? ORDER BY plan_date DESC, created_at DESC`,
      [studentId]
    )
    return plans.map(plan => {
      plan.tasks = JSON.parse(plan.tasks || '[]')
      plan.generated_by_ai = !!plan.generated_by_ai
      return plan as LessonPlan
    })
  },
  
  async update(id: string, data: Partial<LessonPlan>): Promise<LessonPlan | undefined> {
    const fields: string[] = []
    const values: unknown[] = []
    
    for (const [key, value] of Object.entries(data)) {
      if (key === 'tasks') {
        fields.push(`${key} = ?`)
        values.push(JSON.stringify(value))
      } else if (key === 'generated_by_ai') {
        fields.push(`${key} = ?`)
        values.push(value ? 1 : 0)
      } else if (key !== 'id' && key !== 'created_at') {
        fields.push(`${key} = ?`)
        values.push(value)
      }
    }
    
    if (fields.length > 0) {
      values.push(id)
      await ipcQuery(`UPDATE lesson_plans SET ${fields.join(', ')} WHERE id = ?`, values)
    }
    
    return this.getById(id)
  },
  
  async delete(id: string): Promise<void> {
    await ipcQuery(`DELETE FROM lesson_plans WHERE id = ?`, [id])
  },
  
  async getLastPlanSummary(studentId: string): Promise<string | null> {
    const plan = await ipcQueryOne<any>(
      `SELECT tasks, notes FROM lesson_plans WHERE student_id = ? ORDER BY created_at DESC LIMIT 1`,
      [studentId]
    )
    if (!plan) return null
    
    const tasks = JSON.parse(plan.tasks || '[]')
    if (tasks.length === 0) return null
    
    const taskSummary = tasks.map((t: any) => {
      if (t.wordbank_label && t.level_from && t.level_to) {
        return `${t.wordbank_label}第${t.level_from}-${t.level_to}关`
      }
      return t.content || t.type
    }).join(' + ')
    
    return `上次计划：${taskSummary}`
  }
}

// 考试成绩操作
export const examScoreDb = {
  async create(data: {
    student_id: string
    exam_date: string
    exam_name?: string
    exam_type?: 'school_exam' | 'placement' | 'mock'
    score?: number
    full_score?: number
    notes?: string
  }): Promise<ExamScore> {
    const id = generateId()
    
    await ipcQuery(
      `INSERT INTO exam_scores (id, student_id, exam_date, exam_name, exam_type, score, full_score, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.student_id, data.exam_date, data.exam_name || null, data.exam_type || 'school_exam', data.score ?? null, data.full_score || 100, data.notes || null]
    )
    
    const result = await this.getById(id)
    if (!result) throw new Error('Failed to create exam score')
    return result
  },
  
  async getById(id: string): Promise<ExamScore | undefined> {
    return ipcQueryOne<ExamScore>(`SELECT * FROM exam_scores WHERE id = ?`, [id])
  },
  
  async getByStudentId(studentId: string): Promise<ExamScore[]> {
    return ipcQuery<ExamScore[]>(
      `SELECT * FROM exam_scores WHERE student_id = ? ORDER BY exam_date DESC`,
      [studentId]
    )
  },
  
  async update(id: string, data: Partial<ExamScore>): Promise<ExamScore | undefined> {
    const fields: string[] = []
    const values: unknown[] = []
    
    for (const [key, value] of Object.entries(data)) {
      if (key !== 'id') {
        fields.push(`${key} = ?`)
        values.push(value)
      }
    }
    
    if (fields.length > 0) {
      values.push(id)
      await ipcQuery(`UPDATE exam_scores SET ${fields.join(', ')} WHERE id = ?`, values)
    }
    
    return this.getById(id)
  },
  
  async delete(id: string): Promise<void> {
    await ipcQuery(`DELETE FROM exam_scores WHERE id = ?`, [id])
  }
}

// 学习阶段操作
export const learningPhaseDb = {
  async create(data: {
    student_id: string
    phase_name?: string
    phase_type?: 'semester' | 'summer' | 'winter'
    start_date?: string
    end_date?: string
    goal?: string
    vocab_start?: number
    vocab_end?: number
    summary?: string
  }): Promise<LearningPhase> {
    const id = generateId()
    const now = new Date().toISOString()
    
    await ipcQuery(
      `INSERT INTO learning_phases (id, student_id, phase_name, phase_type, start_date, end_date, goal, vocab_start, vocab_end, summary, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.student_id, data.phase_name || null, data.phase_type || 'semester', data.start_date || null, data.end_date || null, data.goal || null, data.vocab_start ?? null, data.vocab_end ?? null, data.summary || null, now]
    )
    
    const result = await this.getById(id)
    if (!result) throw new Error('Failed to create learning phase')
    return result
  },
  
  async getById(id: string): Promise<LearningPhase | undefined> {
    return ipcQueryOne<LearningPhase>(`SELECT * FROM learning_phases WHERE id = ?`, [id])
  },
  
  async getByStudentId(studentId: string): Promise<LearningPhase[]> {
    return ipcQuery<LearningPhase[]>(
      `SELECT * FROM learning_phases WHERE student_id = ? ORDER BY start_date DESC`,
      [studentId]
    )
  },
  
  async getCurrentPhase(studentId: string): Promise<LearningPhase | undefined> {
    const today = new Date().toISOString().split('T')[0]
    return ipcQueryOne<LearningPhase>(
      `SELECT * FROM learning_phases WHERE student_id = ? AND start_date <= ? AND (end_date IS NULL OR end_date >= ?) ORDER BY start_date DESC LIMIT 1`,
      [studentId, today, today]
    )
  },
  
  async update(id: string, data: Partial<LearningPhase>): Promise<LearningPhase | undefined> {
    const fields: string[] = []
    const values: unknown[] = []
    
    for (const [key, value] of Object.entries(data)) {
      if (key !== 'id' && key !== 'created_at') {
        fields.push(`${key} = ?`)
        values.push(value)
      }
    }
    
    if (fields.length > 0) {
      values.push(id)
      await ipcQuery(`UPDATE learning_phases SET ${fields.join(', ')} WHERE id = ?`, values)
    }
    
    return this.getById(id)
  },
  
  async delete(id: string): Promise<void> {
    await ipcQuery(`DELETE FROM learning_phases WHERE id = ?`, [id])
  }
}

// 体验生成交记录操作
export const trialConversionDb = {
  async create(data: {
    student_id: string
    trial_date?: string
    conversion_date?: string
    converted?: boolean
    commission_note?: string
    notes?: string
  }): Promise<TrialConversion> {
    const id = generateId()
    const now = new Date().toISOString()
    
    await ipcQuery(
      `INSERT INTO trial_conversions (id, student_id, trial_date, conversion_date, converted, commission_note, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.student_id, data.trial_date || null, data.conversion_date || null, data.converted ? 1 : 0, data.commission_note || null, data.notes || null, now]
    )
    
    const result = await this.getById(id)
    if (!result) throw new Error('Failed to create trial conversion')
    return result
  },
  
  async getById(id: string): Promise<TrialConversion | undefined> {
    const record = await ipcQueryOne<any>(`SELECT * FROM trial_conversions WHERE id = ?`, [id])
    if (record) {
      record.converted = !!record.converted
    }
    return record as TrialConversion | undefined
  },
  
  async getByStudentId(studentId: string): Promise<TrialConversion | undefined> {
    const record = await ipcQueryOne<any>(
      `SELECT * FROM trial_conversions WHERE student_id = ?`,
      [studentId]
    )
    if (record) {
      record.converted = !!record.converted
    }
    return record as TrialConversion | undefined
  },
  
  async update(id: string, data: Partial<TrialConversion>): Promise<TrialConversion | undefined> {
    const fields: string[] = []
    const values: unknown[] = []
    
    for (const [key, value] of Object.entries(data)) {
      if (key === 'converted') {
        fields.push(`${key} = ?`)
        values.push(value ? 1 : 0)
      } else if (key !== 'id' && key !== 'created_at') {
        fields.push(`${key} = ?`)
        values.push(value)
      }
    }
    
    if (fields.length > 0) {
      values.push(id)
      await ipcQuery(`UPDATE trial_conversions SET ${fields.join(', ')} WHERE id = ?`, values)
    }
    
    return this.getById(id)
  },
  
  async delete(id: string): Promise<void> {
    await ipcQuery(`DELETE FROM trial_conversions WHERE id = ?`, [id])
  },
  
  // 获取所有体验生（带学员信息）
  async getAllTrialStudents(): Promise<(Student & { conversion: TrialConversion | null, billing: Billing | null })[]> {
    const results = await ipcQuery<any[]>(`
      SELECT s.*, 
             tc.id as conversion_id, tc.trial_date, tc.conversion_date, tc.converted, tc.commission_note as tc_commission_note, tc.notes as tc_notes, tc.created_at as tc_created_at,
             b.id as billing_id, b.total_hours, b.used_hours, b.warning_threshold
      FROM students s
      LEFT JOIN trial_conversions tc ON s.id = tc.student_id
      LEFT JOIN billing b ON s.id = b.student_id
      WHERE s.student_type = 'trial'
      ORDER BY s.created_at DESC
    `)
    
    return results.map((row: any) => ({
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
      conversion: row.conversion_id ? {
        id: row.conversion_id,
        student_id: row.id,
        trial_date: row.trial_date,
        conversion_date: row.conversion_date,
        converted: !!row.converted,
        commission_note: row.tc_commission_note,
        notes: row.tc_notes,
        created_at: row.tc_created_at
      } : null,
      billing: row.billing_id ? {
        id: row.billing_id,
        student_id: row.id,
        total_hours: row.total_hours || 0,
        used_hours: row.used_hours || 0,
        remaining_hours: (row.total_hours || 0) - (row.used_hours || 0),
        warning_threshold: row.warning_threshold || 3,
        last_payment_date: null,
        notes: null,
        created_at: row.created_at,
        updated_at: row.updated_at
      } : null
    }))
  },
  
  // 获取月度成交统计
  async getMonthlyConversions(year: number, month: number): Promise<{
    total: number
    converted: number
    pending: number
    conversions: (TrialConversion & { student: Student })[]
  }> {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const endDate = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`
    
    const results = await ipcQuery<any[]>(`
      SELECT tc.*, s.id as student_id, s.student_no, s.name, s.school, s.grade, s.account, s.enroll_date, s.student_type, s.status, s.level, s.initial_score, s.initial_vocab, s.phonics_progress, s.phonics_completed, s.ipa_completed, s.notes, s.created_at as student_created_at, s.updated_at
      FROM trial_conversions tc
      JOIN students s ON tc.student_id = s.id
      WHERE tc.trial_date >= ? AND tc.trial_date < ?
      ORDER BY tc.trial_date DESC
    `, [startDate, endDate])
    
    const conversions = results.map((row: any) => ({
      id: row.id,
      student_id: row.student_id,
      trial_date: row.trial_date,
      conversion_date: row.conversion_date,
      converted: !!row.converted,
      commission_note: row.commission_note,
      notes: row.notes,
      created_at: row.created_at,
      student: {
        id: row.student_id,
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
        created_at: row.student_created_at,
        updated_at: row.updated_at
      }
    }))
    
    const converted = conversions.filter(c => c.converted).length
    
    return {
      total: conversions.length,
      converted,
      pending: conversions.length - converted,
      conversions
    }
  },
  
  // 获取年度月度统计数据
  async getYearlyStats(year: number): Promise<{ month: number; total: number; converted: number }[]> {
    const stats: { month: number; total: number; converted: number }[] = []
    
    for (let month = 1; month <= 12; month++) {
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`
      const endDate = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`
      
      const result = await ipcQueryOne<{ total: number; converted: number }>(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN converted = 1 THEN 1 ELSE 0 END) as converted
        FROM trial_conversions
        WHERE trial_date >= ? AND trial_date < ?
      `, [startDate, endDate])
      
      stats.push({
        month,
        total: result?.total || 0,
        converted: result?.converted || 0
      })
    }
    
    return stats
  },
  
  // 标记成交（自动转正式学员）
  async markConverted(studentId: string, conversionDate: string, commissionNote?: string): Promise<{ student: Student; conversion: TrialConversion }> {
    // 更新学员类型为正式学员
    await ipcQuery(
      `UPDATE students SET student_type = 'formal', status = 'active', updated_at = ? WHERE id = ?`,
      [new Date().toISOString(), studentId]
    )
    
    // 查找或创建成交记录
    let conversion = await this.getByStudentId(studentId)
    
    if (conversion) {
      conversion = await this.update(conversion.id, {
        converted: true,
        conversion_date: conversionDate,
        commission_note: commissionNote
      })
    } else {
      conversion = await this.create({
        student_id: studentId,
        converted: true,
        conversion_date: conversionDate,
        commission_note: commissionNote
      })
    }
    
    const student = await studentDb.getById(studentId)
    if (!student || !conversion) throw new Error('Failed to mark conversion')
    
    return { student, conversion }
  }
}
